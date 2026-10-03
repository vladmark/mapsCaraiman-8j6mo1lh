/*
 * Routable trail network (built offline by build/mapbuild/steps/network.py).
 *   vertices: flat [lon*1e5, lat*1e5, ele, ...]
 *   edges:    [vertexChain, kindIndex, labelIndex]   chains run junction -> junction
 * Routing is Dijkstra over junctions; a clicked point may lie inside an edge, in which case
 * the two partial chains to the edge's ends act as virtual first/last steps.
 */
OM.MinHeap = class {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(item, key) {
    const a = this.items; a.push([key, item]);
    let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
  }
  pop() {
    const a = this.items, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
};

OM.TrailNetwork = class {
  static KINDS = ["trail", "featured", "aerial", "link"];
  static GRID = 0.005;
  static LINK_PENALTY_H = 0.01;
  static VIA_MIN_M = 200;

  constructor(data, meter) {
    this.meter = meter;
    this.labels = data.labels;
    const v = data.v, n = v.length / 3;
    this.points = new Array(n);
    for (let i = 0; i < n; i++) this.points[i] = [v[3 * i] / 1e5, v[3 * i + 1] / 1e5, v[3 * i + 2]];
    this.edges = data.e.map(([chain, kind, label]) => ({ chain, kind: OM.TrailNetwork.KINDS[kind], label }));
    this.adj = new Map();
    this.where = new Map();          // interior vertex -> {edge, pos}
    this.edges.forEach((e, idx) => {
      const c = e.chain;
      for (const [node, forward] of [[c[0], true], [c[c.length - 1], false]]) {
        if (!this.adj.has(node)) this.adj.set(node, []);
        this.adj.get(node).push({ edge: idx, forward });
      }
      for (let p = 1; p < c.length - 1; p++) this.where.set(c[p], { edge: idx, pos: p });
    });
    this.grid = new Map();
    this.points.forEach((pt, i) => {
      const k = this._cell(pt[0], pt[1]);
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push(i);
    });
    this.costCache = new Map();
  }

  _cell(lon, lat) { return `${Math.floor(lon / OM.TrailNetwork.GRID)},${Math.floor(lat / OM.TrailNetwork.GRID)}`; }

  /* Nearest network vertex within maxM metres of [lon, lat], or null. */
  snap(lonlat, maxM = 1500) {
    const g = OM.TrailNetwork.GRID, reach = Math.ceil(maxM / 1000 / (111 * g) * 1.6) + 1;
    const cx = Math.floor(lonlat[0] / g), cy = Math.floor(lonlat[1] / g);
    let best = null, bestD = maxM;
    for (let dx = -reach; dx <= reach; dx++) for (let dy = -reach; dy <= reach; dy++) {
      for (const i of this.grid.get(`${cx + dx},${cy + dy}`) || []) {
        const d = OM.geo.dist(lonlat, this.points[i]);
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    return best === null ? null : { vertex: best, distance: bestD };
  }

  /* ----------------------------------------------------------- costs */
  _chainPoints(chain, from, to) {
    const out = [];
    if (from <= to) for (let i = from; i <= to; i++) out.push(this.points[chain[i]]);
    else for (let i = from; i >= to; i--) out.push(this.points[chain[i]]);
    return out;
  }

  _legKind(edge) { return edge.kind === "aerial" ? "aerial" : "walk"; }

  _partialHours(edge, from, to) {
    return this.meter.measure(this._chainPoints(edge.chain, from, to), this._legKind(edge)).hours;
  }

  _edgeHours(idx, forward, opts) {
    const edge = this.edges[idx];
    if (edge.kind === "aerial" && !opts.allowAerial) return Infinity;
    const key = `${idx}:${forward}`;
    if (!this.costCache.has(key)) {
      const last = edge.chain.length - 1;
      const h = forward ? this._partialHours(edge, 0, last) : this._partialHours(edge, last, 0);
      // Small penalty on connector edges so the router doesn't hop between parallel copies of one path.
      this.costCache.set(key, h + (edge.kind === "link" ? OM.TrailNetwork.LINK_PENALTY_H : 0));
    }
    return this.costCache.get(key);
  }

  /* Pace changes scale every walking cost equally, but aerial costs don't scale, so reset. */
  invalidate() { this.costCache.clear(); }

  /* Ways to leave (or reach) a vertex: [{node, hours, edge, from, to}] */
  _attachments(vertex, opts, leaving) {
    if (this.adj.has(vertex)) return [{ node: vertex, hours: 0, edge: null }];
    const { edge: idx, pos } = this.where.get(vertex);
    const edge = this.edges[idx];
    if (edge.kind === "aerial" && !opts.allowAerial) return [];
    const last = edge.chain.length - 1;
    return [0, last].map((end) => {
      const [from, to] = leaving ? [pos, end] : [end, pos];
      return { node: edge.chain[end], hours: this._partialHours(edge, from, to), edge: idx, from, to };
    });
  }

  route(a, b, opts = { allowAerial: false }) {
    if (a === b) return null;
    const starts = this._attachments(a, opts, true);
    const ends = this._attachments(b, opts, false);
    const best = { hours: Infinity, steps: null };

    // Both points inside the same edge: the direct slice is a candidate.
    const wa = this.where.get(a), wb = this.where.get(b);
    if (wa && wb && wa.edge === wb.edge) {
      best.hours = this._partialHours(this.edges[wa.edge], wa.pos, wb.pos);
      best.steps = [{ edge: wa.edge, from: wa.pos, to: wb.pos }];
    }

    const dist = new Map(), prev = new Map(), heap = new OM.MinHeap();
    for (const s of starts) {
      if (s.hours < (dist.get(s.node) ?? Infinity)) {
        dist.set(s.node, s.hours); prev.set(s.node, { start: s }); heap.push(s.node, s.hours);
      }
    }
    const endByNode = new Map();
    for (const e of ends) if (!endByNode.has(e.node) || endByNode.get(e.node).hours > e.hours) endByNode.set(e.node, e);

    while (heap.size) {
      const [d, node] = heap.pop();
      if (d > (dist.get(node) ?? Infinity) || d >= best.hours) continue;
      const end = endByNode.get(node);
      if (end && d + end.hours < best.hours) {
        best.hours = d + end.hours;
        best.steps = [...this._unwind(node, prev), ...(end.edge === null ? [] : [{ edge: end.edge, from: end.from, to: end.to }])];
      }
      for (const { edge, forward } of this.adj.get(node) || []) {
        const h = this._edgeHours(edge, forward, opts);
        if (!isFinite(h)) continue;
        const chain = this.edges[edge].chain;
        const next = forward ? chain[chain.length - 1] : chain[0];
        const nd = d + h;
        if (nd < (dist.get(next) ?? Infinity)) {
          dist.set(next, nd);
          prev.set(next, { node, edge, forward });
          heap.push(next, nd);
        }
      }
    }
    return best.steps ? this._assemble(best.steps) : null;
  }

  _unwind(node, prev) {
    const steps = [];
    let cur = node;
    for (;;) {
      const p = prev.get(cur);
      if (p.start) {
        if (p.start.edge !== null) steps.push({ edge: p.start.edge, from: p.start.from, to: p.start.to });
        break;
      }
      const last = this.edges[p.edge].chain.length - 1;
      steps.push(p.forward ? { edge: p.edge, from: 0, to: last } : { edge: p.edge, from: last, to: 0 });
      cur = p.node;
    }
    return steps.reverse();
  }

  /* steps -> {legs, coords, via}. "via" lists route names in order, ignoring short stretches. */
  _assemble(steps) {
    const legs = [], walked = new Map();
    for (const s of steps) {
      if (s.from === s.to) continue;
      const edge = this.edges[s.edge];
      const kind = this._legKind(edge);
      const pts = this._chainPoints(edge.chain, s.from, s.to);
      const leg = legs[legs.length - 1];
      if (leg && leg.kind === kind) leg.points.push(...pts.slice(1));
      else legs.push({ kind, points: pts });
      if (edge.label === null || edge.label === undefined || edge.kind === "link") continue;
      let d = 0;
      for (let i = 1; i < pts.length; i++) d += OM.geo.dist(pts[i - 1], pts[i]);
      const names = this.labels[edge.label].routes.split(" / ").filter(Boolean);
      for (const name of names) walked.set(name, (walked.get(name) || 0) + (kind === "aerial" ? Infinity : d));
    }
    const via = [...walked].filter(([, d]) => d >= OM.TrailNetwork.VIA_MIN_M).map(([name]) => name);
    const coords = [];
    for (const leg of legs) for (const p of leg.points) coords.push([p[0], p[1]]);
    return { legs, coords, via };
  }
};
