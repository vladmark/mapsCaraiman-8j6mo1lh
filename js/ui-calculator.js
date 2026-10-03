/* "A → B" tab: walking-time calculator over the marked-trail network. */

/* Named, routable places: featured stops + OSM destinations + cable-car stations near a trail. */
OM.PlaceIndex = class {
  static MAX_SNAP_M = 400;
  static CATS = { hut: "hut", shelter: "shelter", peak: "peak", saddle: "saddle", viewpoint: "viewpoint", waterfall: "waterfall",
    cave: "cave", monastery: "monastery", castle: "castle", memorial: "memorial", attraction: "sight", train: "train station",
    museum: "museum", spring: "spring", camp: "camp" };

  constructor(network, tracks, pois, aerial) {
    const raw = [];
    for (const t of tracks) for (const s of t.stops) raw.push({ name: s.name, lonlat: t.coords[s.index].slice(0, 2), kind: "track stop" });
    for (const f of aerial.features) if (f.geometry.type === "Point" && f.properties.name) raw.push({ name: f.properties.name, lonlat: f.geometry.coordinates, kind: "cable car" });
    for (const f of pois.features) {
      const p = f.properties;
      if (p.name && OM.PlaceIndex.CATS[p.cat]) raw.push({ name: p.ele && p.cat === "peak" ? `${p.name} (${p.ele} m)` : p.name, lonlat: f.geometry.coordinates, kind: OM.PlaceIndex.CATS[p.cat] });
    }
    const seen = new Set();
    this.places = [];
    for (const p of raw) {
      const snap = network.snap(p.lonlat, OM.PlaceIndex.MAX_SNAP_M);
      const label = `${p.name} · ${p.kind}`;
      if (!snap || seen.has(label)) continue;
      seen.add(label);
      this.places.push({ ...p, label, vertex: snap.vertex });
    }
    this.places.sort((a, b) => a.label.localeCompare(b.label, "ro"));
    this.byLabel = new Map(this.places.map((p) => [p.label, p]));
  }
};

OM.CalculatorPanel = class extends OM.Panel {
  constructor(map, network, places, routeOverlay, settings, hover) {
    super("A → B time");
    Object.assign(this, { map, network, places, routeOverlay, settings, hover });
    this.ends = { A: null, B: null };      // {vertex, lonlat, name}
    this.nextPick = "A";
    this.active = false;
    settings.onChange(() => { this.network.invalidate(); this.compute(); });
    map.on("click", (e) => this.active && this.pickAt([e.lngLat.lng, e.lngLat.lat]));
  }

  render() {
    const datalist = OM.h("datalist", { id: "places" }, this.places.places.map((p) => OM.h("option", { value: p.label })));
    this.inputs = {};
    const field = (role) => {
      const input = OM.h("input", { list: "places", placeholder: `Type a place, or tap the map`, onchange: (e) => this.pickNamed(role, e.target.value) });
      this.inputs[role] = input;
      return OM.h("div", { class: `endpoint endpoint-${role}` },
        OM.h("span", { class: "badge" }, role), input,
        OM.h("button", { class: "small", title: "Pick on map", onclick: () => { this.nextPick = role; this.status("Tap the map to set point " + role); } }, "Map"));
    };
    const aerial = OM.h("input", { type: "checkbox", checked: this.settings.get("allowAerial"), onchange: (e) => this.settings.set("allowAerial", e.target.checked) });
    this.out = OM.h("div", { class: "result" });
    this.msg = OM.h("div", { class: "hint status" }, "While this tab is open, tapping the map sets A, then B. Points snap to the nearest marked trail.");
    this.root.replaceChildren(
      new OM.PaceControl(this.settings).root,
      OM.h("label", { class: "check" }, aerial, " Allow cable cars (≈9 min wait + ride)"),
      datalist, field("A"), field("B"),
      OM.h("div", { class: "row" },
        OM.h("button", { class: "small", onclick: () => this.swap() }, "⇅ Swap"),
        OM.h("button", { class: "small", onclick: () => this.clear() }, "✕ Clear")),
      this.msg, this.out);
    this.compute();
  }

  activate() { this.active = true; this.map.getCanvas().style.cursor = "crosshair"; }
  deactivate() { this.active = false; this.map.getCanvas().style.cursor = ""; }
  status(text) { this.msg.textContent = text; }

  pickAt(lonlat) {
    const snap = this.network.snap(lonlat, 2000);
    if (!snap) { this.status("No marked trail within 2 km of that point."); return; }
    const role = this.nextPick;
    this.set(role, { vertex: snap.vertex, lonlat: this.network.points[snap.vertex].slice(0, 2), name: `map point (${Math.round(this.network.points[snap.vertex][2])} m)` });
    this.nextPick = role === "A" ? "B" : "A";
  }

  pickNamed(role, label) {
    const p = this.places.byLabel.get(label);
    if (!p) { this.status(`Unknown place “${label}” – choose one from the list.`); return; }
    this.set(role, { vertex: p.vertex, lonlat: p.lonlat, name: p.name });
  }

  set(role, end) {
    this.ends[role] = end;
    if (this.inputs[role]) this.inputs[role].value = end ? end.name : "";
    this.compute();
  }

  swap() { const { A, B } = this.ends; this.ends = { A: B, B: A }; this.inputs.A.value = B ? B.name : ""; this.inputs.B.value = A ? A.name : ""; this.compute(); }
  clear() { this.ends = { A: null, B: null }; this.nextPick = "A"; this.inputs.A.value = this.inputs.B.value = ""; this.compute(); }

  compute() {
    const { A, B } = this.ends;
    const opts = { allowAerial: this.settings.get("allowAerial") };
    if (!this.out) return;
    if (!A || !B) {
      this.routeOverlay.show(this.map, null, A && A.lonlat, B && B.lonlat);
      this.out.replaceChildren();
      return;
    }
    const route = this.network.route(A.vertex, B.vertex, opts);
    if (!route) {
      this.routeOverlay.show(this.map, null, A.lonlat, B.lonlat);
      this.out.replaceChildren(OM.h("p", { class: "warn" }, "No connection found along marked trails between these points."));
      return;
    }
    const back = this.network.route(B.vertex, A.vertex, opts);
    const meter = this.network.meter;
    const m = meter.measureLegs(route.legs);
    const mb = back ? meter.measureLegs(back.legs) : null;
    this.routeOverlay.show(this.map, route.coords, A.lonlat, B.lonlat);
    this.status("Route found. Tap the map again to move A / B.");

    const points = route.legs.flatMap((l, i) => (i ? l.points.slice(1) : l.points));
    const cum = [0];
    for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + OM.geo.dist(points[i - 1], points[i]));
    const profile = new OM.ElevationProfile({ onHover: (i) => this.hover.show(points[i].slice(0, 2)), onLeave: () => this.hover.hide() });

    this.out.replaceChildren(
      OM.h("div", { class: "big-time" }, OM.fmt.hours(m.hours)),
      OM.h("div", { class: "summary" },
        `${OM.fmt.km(m.walkDist)} on foot · ↑${Math.round(m.up)} m ↓${Math.round(m.down)} m · ${Math.round(m.minEle)}–${Math.round(m.maxEle)} m`,
        m.rideDist ? OM.h("div", {}, `incl. ${OM.fmt.km(m.rideDist)} by cable car (${OM.fmt.hours(m.rideHours)} with waiting)`) : null,
        mb ? OM.h("div", { class: "hint" }, `Return B → A: ${OM.fmt.hours(mb.hours)}`) : null),
      profile.render(points, cum, [], "#ff00aa"),
      route.via.length ? OM.h("div", { class: "via" }, OM.h("b", {}, "Along: "), OM.h("ul", {}, route.via.map((v) => OM.h("li", {}, v)))) : null,
      OM.h("p", { class: "hint" }, "Pure walking time — add ~10 min per hour for short breaks. The route follows OSM-marked trails and the featured tracks only."));
  }
};
