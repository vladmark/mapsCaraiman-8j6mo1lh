/* "Tracks" tab: featured tracks with stage-by-stage time estimates and elevation profiles. */

OM.HoverMarker = class {
  constructor(map) {
    this.map = map;
    this.marker = new maplibregl.Marker({ element: OM.h("div", { class: "hover-dot" }) });
  }
  show(lonlat) { this.marker.setLngLat(lonlat).addTo(this.map); }
  hide() { this.marker.remove(); }
};

/* Pace factor slider + explanation; any number of instances stay in sync through Settings. */
OM.PaceControl = class {
  constructor(settings) {
    this.settings = settings;
    const value = OM.h("span", { class: "pace-value" });
    const input = OM.h("input", { type: "range", min: "0.6", max: "1.6", step: "0.05", value: settings.get("pace"),
      oninput: (e) => settings.set("pace", Number(e.target.value)) });
    const sync = () => { input.value = settings.get("pace"); value.textContent = `× ${Number(settings.get("pace")).toFixed(2)}`; };
    settings.onChange((k) => k === "pace" && sync());
    sync();
    this.root = OM.h("div", { class: "pace" },
      OM.h("label", {}, "Pace factor ", value), input,
      OM.h("div", { class: "hint" }, "DIN 33466: 4 km/h on the flat, 300 m/h up, 500 m/h down, no breaks. Below 1 = faster, above 1 = slower. ",
        "Romanian signposted times are usually optimistic: ×0.80 reproduces muntii-nostri's 3–4 h for Bușteni → Cabana Caraiman."));
  }
};

OM.TracksPanel = class extends OM.Panel {
  constructor(map, tracks, meter, settings, hover) {
    super("Tracks & times");
    Object.assign(this, { map, tracks, meter, settings, hover });
    this.reversed = new Set();
    settings.onChange((k) => k === "pace" && this.refresh());
  }

  render() {
    this.list = OM.h("div");
    this.root.replaceChildren(new OM.PaceControl(this.settings).root, this.list);
    this.refresh();
  }

  refresh() {
    if (this.list) this.list.replaceChildren(...this.tracks.map((t) => this.trackCard(t)));
  }

  trackCard(track) {
    const rev = this.reversed.has(track.slug);
    const coords = rev ? [...track.coords].reverse() : track.coords;
    const last = track.coords.length - 1;
    const stops = (rev ? [...track.stops].reverse().map((s) => ({ ...s, index: last - s.index })) : track.stops);
    const whole = this.meter.measure(coords);
    const back = this.meter.measure(rev ? track.coords : [...track.coords].reverse());

    const rows = [];
    let cumHours = 0;
    for (let i = 0; i + 1 < stops.length; i++) {
      const a = stops[i], b = stops[i + 1];
      const seg = coords.slice(a.index, b.index + 1);
      if (seg.length < 2) continue;
      const m = this.meter.measure(seg);
      cumHours += m.hours;
      rows.push(OM.h("tr", { class: "stage", title: "Zoom to this stage", onclick: () => this.fit(seg) },
        OM.h("td", {}, OM.h("div", { class: "from" }, a.name), OM.h("div", { class: "to" }, "→ ", b.name)),
        OM.h("td", {}, OM.fmt.km(m.dist)), OM.h("td", { class: "up" }, `↑${Math.round(m.up)}`), OM.h("td", { class: "down" }, `↓${Math.round(m.down)}`),
        OM.h("td", { class: "time" }, OM.fmt.hours(m.hours)), OM.h("td", { class: "cum" }, OM.fmt.hours(cumHours))));
    }

    // When the stops span the whole track, the headline time is the stage sum, so the two always agree.
    const spansAll = stops.length > 1 && stops[0].index === 0 && stops[stops.length - 1].index === last;
    const headline = spansAll ? cumHours : whole.hours;
    const profile = new OM.ElevationProfile({
      onHover: (i) => this.hover.show(coords[i].slice(0, 2)), onLeave: () => this.hover.hide(),
    });
    const swatch = OM.h("span", { class: `swatch ${track.dash ? "dashed" : ""}`, style: `--c:${track.color}` });
    return OM.h("section", { class: "track-card" },
      OM.h("h3", { onclick: () => this.fit(coords) }, swatch, track.title),
      OM.h("div", { class: "marking" }, `Marking: ${track.marking}`),
      OM.h("div", { class: "summary" },
        OM.h("b", {}, OM.fmt.hours(headline)), ` · ${OM.fmt.km(whole.dist)} · ↑${Math.round(whole.up)} m ↓${Math.round(whole.down)} m · max ${Math.round(whole.maxEle)} m`,
        OM.h("div", { class: "hint" }, `Opposite direction: ${OM.fmt.hours(back.hours)}`)),
      profile.render(coords, whole.cum, stops.map((s) => ({ dist: whole.cum[s.index], label: s.name })), track.color),
      OM.h("button", { class: "small", onclick: () => { rev ? this.reversed.delete(track.slug) : this.reversed.add(track.slug); this.refresh(); } },
        "⇄ Reverse direction"),
      OM.h("table", { class: "stages" },
        OM.h("thead", {}, OM.h("tr", {}, ...["Stage", "Dist.", "Up", "Down", "Time", "Total"].map((c) => OM.h("th", {}, c)))),
        OM.h("tbody", {}, rows)),
      OM.h("p", { class: "note" }, track.note),
      OM.h("a", { href: track.url, target: "_blank", rel: "noopener" }, "Original page on muntii-nostri.ro (online)"));
  }

  fit(coords) {
    const b = new maplibregl.LngLatBounds(coords[0].slice(0, 2), coords[0].slice(0, 2));
    coords.forEach((c) => b.extend(c.slice(0, 2)));
    this.map.fitBounds(b, { padding: OM.mapPadding(), maxZoom: 15.5 });
  }
};
