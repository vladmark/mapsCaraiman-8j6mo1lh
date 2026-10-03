/*
 * Serves every map resource from OfflineData through MapLibre custom protocols:
 *   pmtiles://basemap/{z}/{x}/{y}   vector basemap (via the pmtiles library)
 *   dem://{z}/{x}/{y}               Terrarium elevation PNGs, with over-zoom fallback
 *   offline://<asset name>          glyphs, sprites, icons
 */

/* pmtiles "Source" backed by an in-memory ArrayBuffer instead of HTTP range requests. */
OM.MemorySource = class {
  constructor(key, buffer) { this.key = key; this.buffer = buffer; }
  getKey() { return this.key; }
  async getBytes(offset, length) { return { data: this.buffer.slice(offset, offset + length) }; }
};

/* Elevation tiles. Outside the detailed core area only lower zooms exist, so a missing tile
 * is synthesised from its nearest ancestor (nearest-neighbour upscale, which keeps the
 * Terrarium RGB encoding valid — interpolating encoded pixels would corrupt elevations). */
OM.DemTileProvider = class {
  constructor(archive) {
    this.archive = archive;
    this.cache = new Map();
  }

  async raw(z, x, y) {
    const t = await this.archive.getZxy(z, x, y);
    return t && t.data;
  }

  async getTile(z, x, y) {
    const key = `${z}/${x}/${y}`;
    if (!this.cache.has(key)) this.cache.set(key, this._resolve(z, x, y));
    return this.cache.get(key);
  }

  async _resolve(z, x, y) {
    const direct = await this.raw(z, x, y);
    if (direct) return direct;
    for (let dz = 1; dz <= z; dz++) {
      const parent = await this.raw(z - dz, x >> dz, y >> dz);
      if (parent) return this._upscale(parent, dz, x, y);
    }
    return null;
  }

  /* OffscreenCanvas where available; a detached <canvas> on older iOS (< 16.4). */
  static canvas(w, h) {
    if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }

  async _upscale(parentData, dz, x, y) {
    const img = await createImageBitmap(new Blob([parentData], { type: "image/png" }));
    const n = 1 << dz;
    const size = img.width / n;
    const sx = (x % n) * size, sy = (y % n) * size;
    const canvas = OM.DemTileProvider.canvas(img.width, img.height);
    const g = canvas.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.drawImage(img, sx, sy, size, size, 0, 0, img.width, img.height);
    const blob = canvas.convertToBlob
      ? await canvas.convertToBlob({ type: "image/png" })
      : await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    return blob.arrayBuffer();
  }
};

OM.TileServer = class {
  constructor() {
    this.protocol = new pmtiles.Protocol();
    this.basemap = new pmtiles.PMTiles(new OM.MemorySource("basemap", OfflineData.buffer("basemap.pmtiles")));
    this.protocol.add(this.basemap);
    const terrain = new pmtiles.PMTiles(new OM.MemorySource("terrain", OfflineData.buffer("terrain.pmtiles")));
    this.dem = new OM.DemTileProvider(terrain);
    this.emptyPbf = new ArrayBuffer(0);
  }

  register(maplibregl) {
    maplibregl.addProtocol("pmtiles", this.protocol.tile);
    maplibregl.addProtocol("dem", async (params) => {
      const [z, x, y] = params.url.replace("dem://", "").split("/").map(Number);
      const data = await this.dem.getTile(z, x, y);
      if (!data) throw new Error(`no DEM tile ${z}/${x}/${y}`);
      return { data: data.slice(0) };
    });
    maplibregl.addProtocol("offline", async (params) => {
      const name = decodeURIComponent(params.url.replace("offline://", ""));
      const bytes = OfflineData.bytes(name);
      if (!bytes) {
        if (name.endsWith(".pbf")) return { data: this.emptyPbf };
        throw new Error(`Offline asset missing: ${name}`);
      }
      const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      return { data: name.endsWith(".json") ? JSON.parse(new TextDecoder().decode(bytes)) : data };
    });
  }

  /* getTile implementation for maplibre-contour (it expects {data: Blob}). */
  contourTileFetcher() {
    return async (url) => {
      const [z, x, y] = url.replace("dem://", "").split("/").map(Number);
      const data = await this.dem.getTile(z, x, y);
      if (!data) throw new Error(`no DEM tile ${url}`);
      return { data: new Blob([data], { type: "image/png" }) };
    };
  }
};
