/*
 * Service worker of the phone app (mapsCaraimanPhone). It keeps a copy of every file in the
 * browser's Cache Storage, so once the app has been opened with a connection it works with none.
 * The build replaces the marker line below with the manifest (version + file list), so any
 * rebuild changes this file and makes phones pick up the new version on their next online launch.
 */
self.OFFLINE_MANIFEST = {"mode": "fetch", "version": "5af64b6fb60e", "bundles": [{"name": "style", "bytes": 1364578, "files": [{"name": "glyphs/Noto Sans Regular/0-255.pbf", "path": "data/style/glyphs/Noto%20Sans%20Regular/0-255.pbf", "bytes": 76044}, {"name": "glyphs/Noto Sans Regular/256-511.pbf", "path": "data/style/glyphs/Noto%20Sans%20Regular/256-511.pbf", "bytes": 127726}, {"name": "glyphs/Noto Sans Regular/512-767.pbf", "path": "data/style/glyphs/Noto%20Sans%20Regular/512-767.pbf", "bytes": 94728}, {"name": "glyphs/Noto Sans Regular/768-1023.pbf", "path": "data/style/glyphs/Noto%20Sans%20Regular/768-1023.pbf", "bytes": 77034}, {"name": "glyphs/Noto Sans Regular/8192-8447.pbf", "path": "data/style/glyphs/Noto%20Sans%20Regular/8192-8447.pbf", "bytes": 64220}, {"name": "glyphs/Noto Sans Medium/0-255.pbf", "path": "data/style/glyphs/Noto%20Sans%20Medium/0-255.pbf", "bytes": 77628}, {"name": "glyphs/Noto Sans Medium/256-511.pbf", "path": "data/style/glyphs/Noto%20Sans%20Medium/256-511.pbf", "bytes": 129635}, {"name": "glyphs/Noto Sans Medium/512-767.pbf", "path": "data/style/glyphs/Noto%20Sans%20Medium/512-767.pbf", "bytes": 96169}, {"name": "glyphs/Noto Sans Medium/768-1023.pbf", "path": "data/style/glyphs/Noto%20Sans%20Medium/768-1023.pbf", "bytes": 71160}, {"name": "glyphs/Noto Sans Medium/8192-8447.pbf", "path": "data/style/glyphs/Noto%20Sans%20Medium/8192-8447.pbf", "bytes": 65101}, {"name": "glyphs/Noto Sans Italic/0-255.pbf", "path": "data/style/glyphs/Noto%20Sans%20Italic/0-255.pbf", "bytes": 79344}, {"name": "glyphs/Noto Sans Italic/256-511.pbf", "path": "data/style/glyphs/Noto%20Sans%20Italic/256-511.pbf", "bytes": 132976}, {"name": "glyphs/Noto Sans Italic/512-767.pbf", "path": "data/style/glyphs/Noto%20Sans%20Italic/512-767.pbf", "bytes": 96460}, {"name": "glyphs/Noto Sans Italic/768-1023.pbf", "path": "data/style/glyphs/Noto%20Sans%20Italic/768-1023.pbf", "bytes": 71308}, {"name": "glyphs/Noto Sans Italic/8192-8447.pbf", "path": "data/style/glyphs/Noto%20Sans%20Italic/8192-8447.pbf", "bytes": 52891}, {"name": "sprites/light.json", "path": "data/style/sprites/light.json", "bytes": 3549}, {"name": "sprites/light.png", "path": "data/style/sprites/light.png", "bytes": 16174}, {"name": "sprites/light@2x.json", "path": "data/style/sprites/light%402x.json", "bytes": 3579}, {"name": "sprites/light@2x.png", "path": "data/style/sprites/light%402x.png", "bytes": 28852}]}, {"name": "overlays", "bytes": 5944052, "files": [{"name": "tracks.json", "path": "data/overlays/tracks.json", "bytes": 40911}, {"name": "icons/Punct_de_orientare.png", "path": "data/overlays/icons/Punct_de_orientare.png", "bytes": 802}, {"name": "icons/Punct_de_acces.png", "path": "data/overlays/icons/Punct_de_acces.png", "bytes": 828}, {"name": "icons/Reper_geografic.png", "path": "data/overlays/icons/Reper_geografic.png", "bytes": 732}, {"name": "icons/Atractie_turistica.png", "path": "data/overlays/icons/Atractie_turistica.png", "bytes": 788}, {"name": "icons/Adapost.png", "path": "data/overlays/icons/Adapost.png", "bytes": 810}, {"name": "icons/Salvamont.png", "path": "data/overlays/icons/Salvamont.png", "bytes": 686}, {"name": "icons/Avertisment.png", "path": "data/overlays/icons/Avertisment.png", "bytes": 784}, {"name": "icons/Punct_panoramic.png", "path": "data/overlays/icons/Punct_panoramic.png", "bytes": 810}, {"name": "icons/Surse_de_apa.png", "path": "data/overlays/icons/Surse_de_apa.png", "bytes": 806}, {"name": "icons/Punct_de_informare.png", "path": "data/overlays/icons/Punct_de_informare.png", "bytes": 828}, {"name": "osm_routes.geojson", "path": "data/overlays/osm_routes.geojson", "bytes": 5587177}, {"name": "aerialways.geojson", "path": "data/overlays/aerialways.geojson", "bytes": 27325}, {"name": "osm_pois.geojson", "path": "data/overlays/osm_pois.geojson", "bytes": 280765}]}, {"name": "network", "bytes": 2931842, "files": [{"name": "network.json", "path": "data/network/network.json", "bytes": 2931842}]}, {"name": "terrain", "bytes": 22554770, "files": [{"name": "terrain.pmtiles", "path": "data/terrain/terrain.pmtiles", "bytes": 22554770}]}, {"name": "basemap", "bytes": 48121892, "files": [{"name": "basemap.pmtiles", "path": "data/basemap/basemap.pmtiles", "bytes": 48121892}]}], "shell": ["./", "css/app.css", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "index.html", "js/app.js", "js/icons.js", "js/layers.js", "js/network.js", "js/offline-data.js", "js/offline-install.js", "js/tile-sources.js", "js/time-model.js", "js/ui-calculator.js", "js/ui-common.js", "js/ui-layers.js", "js/ui-tracks.js", "lib/basemaps.js", "lib/maplibre-contour.js", "lib/maplibre-gl.css", "lib/maplibre-gl.js", "lib/pmtiles.js", "manifest.webmanifest", "data/manifest.js"]};

const MANIFEST = self.OFFLINE_MANIFEST;
const CACHE = `caraiman-${MANIFEST.version}`;

/* App shell (HTML, code, libraries) is stored up front; the large data files are stored as the
 * page downloads them, so the first visit downloads everything exactly once. */
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(MANIFEST.shell)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith("caraiman-") && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const resp = await fetch(req);
    if (resp.status === 200) await cache.put(req, resp.clone());
    return resp;
  })());
});
