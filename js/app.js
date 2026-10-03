/* Bootstrap: load data bundles, register offline protocols, build the map and the side panel. */
OM.App = class {
  constructor() {
    this.loading = document.getElementById("loading");
    this.bar = this.loading.querySelector(".bar > div");
    this.label = this.loading.querySelector(".label");
  }

  async start() {
    try {
      const manifest = self.OFFLINE_MANIFEST;
      const installer = new OM.OfflineInstaller(manifest, document.getElementById("offline-status"));
      this.label.textContent = "Preparing offline storage…";
      await installer.prepare();
      await OM.DataLoader.for(manifest, (f, name) => {
        this.bar.style.width = `${Math.round(f * 100)}%`;
        this.label.textContent = `Loading ${name} data… ${Math.round(f * 100)}%`;
      }).load();
      this.label.textContent = "Preparing map…";
      await this.buildMap();
      await installer.verify();
    } catch (err) {
      console.error(err);
      this.label.textContent = `Failed: ${err.message}`;
    }
  }

  async buildMap() {
    const server = new OM.TileServer();
    server.register(maplibregl);
    const header = await server.basemap.getHeader();
    const region = [[header.minLon, header.minLat], [header.maxLon, header.maxLat]];

    const demSource = new mlcontour.DemSource({ id: "contour-dem", url: "dem://{z}/{x}/{y}", encoding: "terrarium", maxzoom: 12, worker: false });
    // maplibre-contour 0.1.1 does not forward a getTile option to its in-thread manager, so set it directly:
    // tiles come from memory instead of fetch(), which cannot read our custom URL scheme.
    demSource.manager.getTile = server.contourTileFetcher();
    demSource.setupMaplibre(maplibregl);

    const { tracks, pois: trackPois } = OfflineData.json("tracks.json");
    const featuredBounds = new maplibregl.LngLatBounds(tracks[0].coords[0].slice(0, 2), tracks[0].coords[0].slice(0, 2));
    tracks.forEach((t) => t.coords.forEach((c) => featuredBounds.extend(c.slice(0, 2))));

    const map = new maplibregl.Map({
      container: "map",
      style: {
        version: 8,
        glyphs: "offline://glyphs/{fontstack}/{range}.pbf",
        sprite: "offline://sprites/light",
        sources: { protomaps: { type: "vector", url: "pmtiles://basemap",
          attribution: "© <a href='https://openstreetmap.org/copyright'>OpenStreetMap</a> · Protomaps · Terrarium DEM · muntii-nostri.ro" } },
        layers: basemaps.layers("protomaps", basemaps.namedFlavor("light"), { lang: "ro" }),
      },
      bounds: featuredBounds,
      fitBoundsOptions: { padding: OM.mapPadding() },
      maxBounds: [[region[0][0] - 0.3, region[0][1] - 0.2], [region[1][0] + 0.3, region[1][1] + 0.2]],
      minZoom: 7, maxZoom: 17.5,
      attributionControl: { compact: true },
    });
    this.map = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-left");
    map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
    map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), "top-left");

    await new Promise((resolve) => map.on("load", resolve));
    await new OM.Icons(map).registerAll();

    map.addSource("dem-terrain", { type: "raster-dem", tiles: ["dem://{z}/{x}/{y}"], encoding: "terrarium", tileSize: 256, maxzoom: 12,
      bounds: [region[0][0], region[0][1], region[1][0], region[1][1]] });
    const firstRoad = map.getStyle().layers.find((l) => l.id.startsWith("roads") || l.id.startsWith("boundaries"));

    const overlays = {
      hillshade: new OM.HillshadeOverlay([region[0][0], region[0][1], region[1][0], region[1][1]]),
      contours: new OM.ContourOverlay(demSource),
      routes: new OM.HikingRoutesOverlay(),
      aerial: new OM.AerialwayOverlay(),
      pois: new OM.PoiOverlay(),
      featured: new OM.FeaturedTracksOverlay(tracks),
      trackPois: new OM.TrackPoiOverlay(trackPois),
      calc: new OM.RouteOverlay(),
    };
    overlays.hillshade.addTo(map, firstRoad && firstRoad.id);
    overlays.contours.addTo(map, firstRoad && firstRoad.id);
    // Later = drawn on top = wins label collisions: cable-car stations must never be hidden.
    for (const key of ["routes", "featured", "calc", "trackPois", "pois", "aerial"]) overlays[key].addTo(map);

    const settings = new OM.Settings();
    const meter = new OM.PathMeter(new OM.DinTimeModel({ pace: settings.get("pace") }), new OM.AerialTimeModel());
    settings.onChange((k, v) => { if (k === "pace") meter.walk.pace = v; });
    const network = new OM.TrailNetwork(OfflineData.json("network.json"), meter);
    const places = new OM.PlaceIndex(network, tracks, OfflineData.json("osm_pois.geojson"), OfflineData.json("aerialways.geojson"));
    const hover = new OM.HoverMarker(map);

    new OM.SidePanel(document.getElementById("panel"), [
      new OM.TracksPanel(map, tracks, meter, settings, hover),
      new OM.CalculatorPanel(map, network, places, overlays.calc, settings, hover),
      new OM.LayersPanel(map, [overlays.hillshade, overlays.contours, overlays.routes, overlays.aerial, overlays.pois, overlays.trackPois]),
    ]);
    new OM.FeatureInfo(map, () => !document.querySelector(".tab.active")?.textContent.startsWith("A → B"));
    this.loading.remove();
  }
};

/* Click popups for POIs, stations and trails (disabled while the calculator is picking points). */
OM.FeatureInfo = class {
  static LAYERS = ["osm-pois-9", "osm-pois-11", "osm-pois-13", "track-pois", "aerial-stations", "aerial-hl-line", "osm-routes-line", "featured-solid", "featured-dashed"];

  constructor(map, enabled) {
    map.on("click", (e) => {
      if (!enabled()) return;
      const layers = OM.FeatureInfo.LAYERS.filter((l) => map.getLayer(l));
      const f = map.queryRenderedFeatures([[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]], { layers })[0];
      if (!f) return;
      new maplibregl.Popup({ maxWidth: "280px" }).setLngLat(e.lngLat).setDOMContent(this.describe(f)).addTo(map);
    });
    for (const l of OM.FeatureInfo.LAYERS) {
      map.on("mouseenter", l, () => { if (enabled()) map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", l, () => { if (enabled()) map.getCanvas().style.cursor = ""; });
    }
  }

  describe(f) {
    const p = f.properties;
    const lines = [];
    if (f.layer.id.startsWith("osm-pois")) lines.push(p.name || "(unnamed)", `${p.cat}${p.ele ? ` · ${p.ele} m` : ""}`);
    else if (f.layer.id === "track-pois") lines.push(p.name, p.category);
    else if (f.layer.id.startsWith("aerial")) lines.push(p.name || p.kind, p.kind === "station" ? `cable car station${p.ele ? ` · ${p.ele} m` : ""}` : p.kind);
    else if (f.layer.id === "osm-routes-line") lines.push(p.name || p.ref || "Marked trail", `marking: ${p.colour_name} ${p.shape}`);
    else lines.push(p.title);
    return OM.h("div", { class: "popup" }, OM.h("b", {}, lines[0]), ...lines.slice(1).map((l) => OM.h("div", {}, l)));
  }
};

window.addEventListener("DOMContentLoaded", () => (window.omApp = new OM.App()).start());
