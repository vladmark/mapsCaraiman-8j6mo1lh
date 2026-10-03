/* Shared UI pieces: settings bus, DOM helper, side panel with tabs, elevation profile. */

OM.h = function (tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else if (v !== false && v !== null && v !== undefined) el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(c));
  return el;
};

/* Map padding that keeps fitted content clear of the side panel (right on desktop, bottom on phones). */
OM.mapPadding = function (width = window.innerWidth, height = window.innerHeight) {
  return width > 700
    ? { top: 50, bottom: 50, left: 60, right: 430 }
    : { top: 40, bottom: Math.round(height * 0.5) + 20, left: 30, right: 30 };
};

/* Observable user settings shared by every panel (pace factor, cable cars allowed). */
OM.Settings = class {
  constructor() {
    this.values = { pace: 1, allowAerial: false };
    try { Object.assign(this.values, JSON.parse(localStorage.getItem("om-settings") || "{}")); } catch (_) { /* storage blocked */ }
    this.listeners = [];
  }
  get(k) { return this.values[k]; }
  set(k, v) {
    this.values[k] = v;
    try { localStorage.setItem("om-settings", JSON.stringify(this.values)); } catch (_) { /* ignore */ }
    this.listeners.forEach((fn) => fn(k, v));
  }
  onChange(fn) { this.listeners.push(fn); }
};

/* A tab in the side panel. Subclasses build their DOM in render(). */
OM.Panel = class {
  constructor(title) { this.title = title; this.root = OM.h("div", { class: "panel-body" }); }
  render() {}
  activate() {}
  deactivate() {}
};

OM.SidePanel = class {
  constructor(container, panels) {
    this.panels = panels;
    this.tabs = OM.h("div", { class: "tabs" });
    this.body = OM.h("div", { class: "tab-content" });
    const toggle = OM.h("button", { class: "collapse-btn", title: "Show / hide panel", onclick: () => container.classList.toggle("collapsed") }, "☰");
    container.append(toggle, this.tabs, this.body);
    panels.forEach((p, i) => {
      p.render();
      this.tabs.append(OM.h("button", { class: "tab", onclick: () => this.show(i) }, p.title));
    });
    this.show(0);
  }
  show(i) {
    if (this.current !== undefined) this.panels[this.current].deactivate();
    this.current = i;
    [...this.tabs.children].forEach((t, j) => t.classList.toggle("active", i === j));
    this.body.replaceChildren(this.panels[i].root);
    this.panels[i].activate();
  }
};

/* SVG elevation profile with stop markers and a hover callback (index into points). */
OM.ElevationProfile = class {
  constructor({ height = 130, onHover = () => {}, onLeave = () => {} } = {}) {
    Object.assign(this, { height, onHover, onLeave });
    this.root = OM.h("div", { class: "profile" });
  }

  render(points, cum, markers = [], color = "#d7191c") {
    const W = 340, H = this.height, padL = 34, padB = 16, padT = 6;
    const total = cum[cum.length - 1] || 1;
    const eles = points.map((p) => p[2]);
    const lo = Math.floor(Math.min(...eles) / 100) * 100, hi = Math.ceil(Math.max(...eles) / 100) * 100 || lo + 100;
    const x = (d) => padL + (d / total) * (W - padL - 4);
    const y = (e) => padT + (1 - (e - lo) / (hi - lo)) * (H - padT - padB);
    const line = points.map((p, i) => `${i ? "L" : "M"}${x(cum[i]).toFixed(1)},${y(p[2]).toFixed(1)}`).join("");
    const area = `${line}L${x(total)},${H - padB}L${x(0)},${H - padB}Z`;
    const step = (hi - lo) > 800 ? 500 : (hi - lo) > 300 ? 200 : 100;
    let grid = "";
    for (let e = lo; e <= hi; e += step) grid += `<line x1="${padL}" x2="${W - 4}" y1="${y(e)}" y2="${y(e)}" class="grid"/><text x="${padL - 3}" y="${y(e) + 3}" class="axis" text-anchor="end">${e}</text>`;
    const kmStep = total > 15000 ? 5000 : total > 5000 ? 2000 : total > 2000 ? 1000 : 500;
    for (let d = 0; d <= total; d += kmStep) grid += `<text x="${x(d)}" y="${H - 3}" class="axis" text-anchor="middle">${d / 1000}</text>`;
    const marks = markers.map((m) => `<line x1="${x(m.dist)}" x2="${x(m.dist)}" y1="${padT}" y2="${H - padB}" class="mark"/><title>${m.label}</title>`).join("");
    this.root.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      ${grid}<path d="${area}" fill="${color}" fill-opacity="0.18"/><path d="${line}" fill="none" stroke="${color}" stroke-width="1.6"/>
      ${marks}<line class="cursor" y1="${padT}" y2="${H - padB}" x1="-10" x2="-10"/></svg>
      <div class="profile-readout"></div>`;
    const svg = this.root.querySelector("svg"), cursor = this.root.querySelector(".cursor"), readout = this.root.querySelector(".profile-readout");
    svg.onmousemove = (ev) => {
      const r = svg.getBoundingClientRect();
      const d = ((ev.clientX - r.left) / r.width * W - padL) / (W - padL - 4) * total;
      let i = cum.findIndex((c) => c >= d); if (i < 0) i = cum.length - 1;
      cursor.setAttribute("x1", x(cum[i])); cursor.setAttribute("x2", x(cum[i]));
      readout.textContent = `${(cum[i] / 1000).toFixed(2)} km · ${Math.round(points[i][2])} m`;
      this.onHover(i);
    };
    svg.onmouseleave = () => { cursor.setAttribute("x1", -10); cursor.setAttribute("x2", -10); readout.textContent = ""; this.onLeave(); };
    return this.root;
  }
};
