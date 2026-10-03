/*
 * Map overlays. Each overlay is a self-contained OM.Overlay subclass that declares its sources
 * and MapLibre layers; the LayerManager adds them and toggles their visibility uniformly.
 */
OM.FONT = ["Noto Sans Medium"];
OM.FONT_REGULAR = ["Noto Sans Regular"];
OM.FONT_ITALIC = ["Noto Sans Italic"];

OM.Overlay = class {
  constructor({ id, title, visible = true, toggle = true }) {
    Object.assign(this, { id, title, visible, toggle });
  }
  sources() { return {}; }
  layers() { return []; }
  layerIds() { return this.layers().map((l) => l.id); }

  /* beforeId: insert below this existing layer (used to slide terrain under the basemap's roads). */
  addTo(map, beforeId) {
    for (const [id, src] of Object.entries(this.sources())) if (!map.getSource(id)) map.addSource(id, src);
    for (const layer of this.layers()) {
      layer.layout = { ...(layer.layout || {}), visibility: this.visible ? "visible" : "none" };
      map.addLayer(layer, beforeId);
    }
  }

  setVisible(map, visible) {
    this.visible = visible;
    for (const id of this.layerIds()) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
  }
};

/* ------------------------------------------------------------------ terrain */
OM.HillshadeOverlay = class extends OM.Overlay {
  constructor(bounds) { super({ id: "hillshade", title: "Hill shading" }); this.bounds = bounds; }
  sources() {
    return { "dem-hillshade": { type: "raster-dem", tiles: ["dem://{z}/{x}/{y}"], encoding: "terrarium", tileSize: 256, maxzoom: 12, bounds: this.bounds } };
  }
  layers() {
    return [{ id: "hillshade", type: "hillshade", source: "dem-hillshade",
      paint: { "hillshade-exaggeration": 0.55, "hillshade-shadow-color": "#3d3a35", "hillshade-highlight-color": "#ffffff", "hillshade-accent-color": "#5a5244" } }];
  }
};

OM.ContourOverlay = class extends OM.Overlay {
  constructor(demSource) { super({ id: "contours", title: "Contour lines" }); this.demSource = demSource; }
  sources() {
    return {
      contours: {
        type: "vector", maxzoom: 15,
        tiles: [this.demSource.contourProtocolUrl({
          thresholds: { 10: [200, 1000], 11: [100, 500], 12: [50, 250], 13: [50, 250], 14: [20, 100] },
          elevationKey: "ele", levelKey: "level", contourLayer: "contours",
        })],
      },
    };
  }
  layers() {
    return [
      { id: "contour-lines", type: "line", source: "contours", "source-layer": "contours",
        paint: { "line-color": "#a0703c", "line-opacity": ["match", ["get", "level"], 1, 0.55, 0.28], "line-width": ["match", ["get", "level"], 1, 0.9, 0.5] } },
      { id: "contour-labels", type: "symbol", source: "contours", "source-layer": "contours", filter: [">", ["get", "level"], 0],
        layout: { "symbol-placement": "line", "text-field": ["concat", ["number-format", ["get", "ele"], {}], " m"], "text-font": OM.FONT_REGULAR, "text-size": 10 },
        paint: { "text-color": "#8a5a2b", "text-halo-color": "#fff", "text-halo-width": 1.2 } },
    ];
  }
};

/* ------------------------------------------------------- OSM marked trails */
OM.HikingRoutesOverlay = class extends OM.Overlay {
  constructor() { super({ id: "osm-routes", title: "Marked trails (OSM)" }); }
  sources() { return { "osm-routes": { type: "geojson", data: OfflineData.json("osm_routes.geojson") } }; }
  layers() {
    const offset = ["interpolate", ["linear"], ["zoom"], 11, ["*", ["get", "slot"], 1.5], 16, ["*", ["get", "slot"], 4]];
    const colour = ["match", ["get", "colour_name"], ...Object.entries(OM.Icons.COLOURS).flat(), "#d7191c"];
    return [
      { id: "osm-routes-line", type: "line", source: "osm-routes", minzoom: 9,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": colour, "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1, 13, 2, 16, 3.5], "line-offset": offset,
          "line-opacity": 0.85, "line-dasharray": [3, 1.5] } },
      { id: "osm-routes-marks", type: "symbol", source: "osm-routes", minzoom: 13,
        layout: { "symbol-placement": "line", "symbol-spacing": 220, "icon-image": ["concat", "mk-", ["get", "colour_name"], "-", ["get", "shape"]],
          "icon-size": ["interpolate", ["linear"], ["zoom"], 13, 0.8, 16, 1.1], "icon-rotation-alignment": "viewport", "icon-allow-overlap": false } },
    ];
  }
};

/* ------------------------------------------------------------- aerialways */
OM.AerialwayOverlay = class extends OM.Overlay {
  constructor() { super({ id: "aerialways", title: "Cable cars & lifts" }); }
  sources() { return { aerialways: { type: "geojson", data: OfflineData.json("aerialways.geojson") } }; }
  layers() {
    const hl = ["==", ["get", "highlight"], true];
    return [
      { id: "aerial-line", type: "line", source: "aerialways", filter: ["all", ["==", ["geometry-type"], "LineString"], ["!", hl]], minzoom: 10,
        paint: { "line-color": "#333", "line-width": 1.2, "line-dasharray": [1, 1] } },
      { id: "aerial-hl-casing", type: "line", source: "aerialways", filter: ["all", ["==", ["geometry-type"], "LineString"], hl],
        paint: { "line-color": "#fff", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 4, 15, 8] } },
      { id: "aerial-hl-line", type: "line", source: "aerialways", filter: ["all", ["==", ["geometry-type"], "LineString"], hl],
        paint: { "line-color": "#111", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 2, 15, 4], "line-dasharray": [2, 1] } },
      { id: "aerial-hl-label", type: "symbol", source: "aerialways", filter: ["all", ["==", ["geometry-type"], "LineString"], hl],
        layout: { "symbol-placement": "line-center", "text-field": ["get", "name"], "text-font": OM.FONT, "text-size": 12, "text-offset": [0, -1] },
        paint: { "text-color": "#111", "text-halo-color": "#fff", "text-halo-width": 2 } },
      { id: "aerial-stations", type: "symbol", source: "aerialways", filter: ["==", ["geometry-type"], "Point"],
        minzoom: 9,
        layout: { "icon-image": "poi-cablecar", "icon-size": ["case", hl, 1.25, 0.8], "icon-allow-overlap": true,
          "text-field": ["step", ["zoom"], ["case", hl, ["get", "name"], ""], 14, ["get", "name"]],
          "text-font": OM.FONT, "text-size": ["case", hl, 13, 11], "text-offset": [0, 1.3], "text-anchor": "top", "text-optional": true,
          "symbol-sort-key": ["case", hl, 0, 1] },
        paint: { "text-color": "#111", "text-halo-color": "#fff", "text-halo-width": 2 } },
    ];
  }
};

/* ------------------------------------------------------- OSM destinations */
OM.PoiOverlay = class extends OM.Overlay {
  constructor() { super({ id: "osm-pois", title: "Destinations (peaks, huts, sights)" }); }
  sources() { return { "osm-pois": { type: "geojson", data: OfflineData.json("osm_pois.geojson") } }; }
  layers() {
    // Peaks and huts show early; everything else from closer zooms.
    const groups = [
      [9, ["peak", "hut", "castle", "monastery"]],
      [11, ["train", "waterfall", "cave", "viewpoint", "attraction", "museum", "shelter"]],
      [13, ["saddle", "spring", "memorial", "ruins", "camp", "rescue"]],
    ];
    const label = ["case", ["all", ["==", ["get", "cat"], "peak"], ["to-boolean", ["get", "ele"]]],
      ["concat", ["get", "name"], "\n", ["to-string", ["get", "ele"]], " m"], ["get", "name"]];
    return groups.map(([minzoom, cats]) => ({
      id: `osm-pois-${minzoom}`, type: "symbol", source: "osm-pois", minzoom,
      filter: ["in", ["get", "cat"], ["literal", cats]],
      layout: { "icon-image": ["concat", "poi-", ["get", "cat"]], "icon-size": 0.85, "symbol-sort-key": ["-", 0, ["get", "rank"]],
        "text-field": label, "text-font": OM.FONT, "text-size": ["match", ["get", "cat"], ["peak", "hut"], 12, 11],
        "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true, "text-max-width": 9 },
      paint: { "text-color": ["match", ["get", "cat"], "peak", "#5a3415", "hut", "#a93226", "#2c3e50"], "text-halo-color": "#fff", "text-halo-width": 1.6 },
    }));
  }
};

/* --------------------------------------------------------- featured tracks */
OM.FeaturedTracksOverlay = class extends OM.Overlay {
  constructor(tracks) { super({ id: "featured", title: "Featured tracks", toggle: false }); this.tracks = tracks; }
  sources() {
    return {
      featured: { type: "geojson", data: { type: "FeatureCollection", features: this.tracks.map((t) => ({
        type: "Feature", properties: { slug: t.slug, color: t.color, dash: t.dash, title: t.title },
        geometry: { type: "LineString", coordinates: t.coords.map(([x, y]) => [x, y]) } })) } },
      "featured-stops": { type: "geojson", data: { type: "FeatureCollection", features: this.tracks.flatMap((t) => t.stops.map((s) => ({
        type: "Feature", properties: { name: s.name, color: t.color, kind: s.kind }, geometry: { type: "Point", coordinates: t.coords[s.index].slice(0, 2) } }))) } },
    };
  }
  layers() {
    const width = ["interpolate", ["linear"], ["zoom"], 9, 3, 15, 6];
    return [
      { id: "featured-casing", type: "line", source: "featured", layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#fff", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 6, 15, 11] } },
      { id: "featured-solid", type: "line", source: "featured", filter: ["!=", ["get", "dash"], true], layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": width } },
      { id: "featured-dashed", type: "line", source: "featured", filter: ["==", ["get", "dash"], true],
        paint: { "line-color": ["get", "color"], "line-width": width, "line-dasharray": [1.4, 1] } },
      { id: "featured-stops", type: "circle", source: "featured-stops",
        paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 15, 6], "circle-color": "#fff", "circle-stroke-color": ["get", "color"], "circle-stroke-width": 2.5 } },
      { id: "featured-stop-labels", type: "symbol", source: "featured-stops", minzoom: 11.5,
        layout: { "text-field": ["get", "name"], "text-font": OM.FONT, "text-size": 12.5, "text-offset": [0.9, 0], "text-anchor": "left", "text-optional": true },
        paint: { "text-color": "#111", "text-halo-color": "#fff", "text-halo-width": 2 } },
    ];
  }
};

OM.TrackPoiOverlay = class extends OM.Overlay {
  constructor(pois) { super({ id: "track-pois", title: "Track points (muntii-nostri)" }); this.pois = pois; }
  sources() {
    return { "track-pois": { type: "geojson", data: { type: "FeatureCollection", features: this.pois.map((p) => ({
      type: "Feature", properties: p, geometry: { type: "Point", coordinates: [p.lon, p.lat] } })) } } };
  }
  layers() {
    return [{ id: "track-pois", type: "symbol", source: "track-pois", minzoom: 13.5,
      layout: { "icon-image": ["concat", "mn-", ["get", "icon"]], "icon-size": 0.9, "icon-allow-overlap": false,
        "text-field": ["step", ["zoom"], "", 15.5, ["get", "name"]], "text-font": OM.FONT_REGULAR, "text-size": 10.5,
        "text-offset": [0, 1.1], "text-anchor": "top", "text-optional": true },
      paint: { "text-color": "#333", "text-halo-color": "#fff", "text-halo-width": 1.5 } }];
  }
};

/* ------------------------------------------------------ calculator result */
OM.RouteOverlay = class extends OM.Overlay {
  constructor() { super({ id: "calc-route", title: "Calculated route", toggle: false }); }
  sources() {
    return {
      "calc-route": { type: "geojson", data: { type: "FeatureCollection", features: [] } },
      "calc-points": { type: "geojson", data: { type: "FeatureCollection", features: [] } },
    };
  }
  layers() {
    return [
      { id: "calc-route-casing", type: "line", source: "calc-route", layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#fff", "line-width": 10, "line-opacity": 0.9 } },
      { id: "calc-route-line", type: "line", source: "calc-route", layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ff00aa", "line-width": 5, "line-opacity": 0.85 } },
      { id: "calc-points", type: "circle", source: "calc-points",
        paint: { "circle-radius": 9, "circle-color": ["match", ["get", "role"], "A", "#1a9641", "#d7191c"], "circle-stroke-color": "#fff", "circle-stroke-width": 2.5 } },
      { id: "calc-points-label", type: "symbol", source: "calc-points",
        layout: { "text-field": ["get", "role"], "text-font": OM.FONT, "text-size": 12, "text-allow-overlap": true },
        paint: { "text-color": "#fff" } },
    ];
  }
  show(map, coords, a, b) {
    map.getSource("calc-route").setData({ type: "FeatureCollection", features: coords ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }] : [] });
    const pts = [];
    if (a) pts.push({ type: "Feature", properties: { role: "A" }, geometry: { type: "Point", coordinates: a } });
    if (b) pts.push({ type: "Feature", properties: { role: "B" }, geometry: { type: "Point", coordinates: b } });
    map.getSource("calc-points").setData({ type: "FeatureCollection", features: pts });
  }
};
