/* "Layers" tab: overlay toggles, 3D terrain, and a legend for trail markings. */
OM.LayersPanel = class extends OM.Panel {
  constructor(map, overlays) {
    super("Layers");
    Object.assign(this, { map, overlays });
  }

  render() {
    const toggles = this.overlays.filter((o) => o.toggle).map((o) =>
      OM.h("label", { class: "check" },
        OM.h("input", { type: "checkbox", checked: o.visible, onchange: (e) => o.setVisible(this.map, e.target.checked) }), " ", o.title));
    const terrain3d = OM.h("label", { class: "check" },
      OM.h("input", { type: "checkbox", onchange: (e) => this.setTerrain(e.target.checked) }), " 3D terrain (tilt with right-drag / two fingers)");
    const shapes = [["band", "bandă (stripe)"], ["cross", "cruce (cross)"], ["triangle", "triunghi (triangle)"], ["dot", "punct (dot)"]];
    const legend = OM.h("div", { class: "legend" },
      OM.h("h4", {}, "Trail markings"),
      ...shapes.map(([s, name]) => OM.h("div", { class: "legend-row" }, this.waymark(s), " ", name)),
      OM.h("div", { class: "hint" }, "Colours: red, blue, yellow (as painted). Parallel routes on one path are drawn side by side."),
      OM.h("h4", {}, "Featured"),
      OM.h("div", { class: "legend-row" }, OM.h("span", { class: "swatch", style: "--c:#d7191c" }), " Bușteni – Caraiman – Babele – Peștera"),
      OM.h("div", { class: "legend-row" }, OM.h("span", { class: "swatch dashed", style: "--c:#2b6cd4" }), " Caraiman – Crucea Eroilor"),
      OM.h("div", { class: "legend-row" }, OM.h("span", { class: "swatch dashed", style: "--c:#111" }), " Telecabina Bușteni–Babele / Babele–Peștera"));
    const credits = OM.h("p", { class: "hint credits" },
      "Map data © OpenStreetMap contributors (ODbL), basemap tiles by Protomaps. Elevation: Terrarium (Mapzen/AWS Open Data, SRTM & others). ",
      "Featured tracks and their points from muntii-nostri.ro.");
    this.root.replaceChildren(...toggles, terrain3d, legend, credits);
  }

  waymark(shape) {
    const id = `mk-red-${shape}`;
    const img = this.map.style.getImage(id);
    const c = OM.h("canvas", { width: img.data.width, height: img.data.height, class: "waymark" });
    c.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(img.data.data), img.data.width, img.data.height), 0, 0);
    return c;
  }

  setTerrain(on) {
    if (on) {
      this.map.setTerrain({ source: "dem-terrain", exaggeration: 1.3 });
      this.map.easeTo({ pitch: 60 });
    } else {
      this.map.setTerrain(null);
      this.map.easeTo({ pitch: 0 });
    }
  }
};
