/*
 * In-memory asset store. data/<bundle>.js files call OfflineData.add({name: base64, ...}).
 * Loading them through <script> tags is what makes the page work from file:// with no server.
 */
window.OM = window.OM || {};

window.OfflineData = (function () {
  const encoded = new Map();
  const decoded = new Map();

  function bytes(name) {
    if (!decoded.has(name)) {
      const b64 = encoded.get(name);
      if (b64 === undefined) return null;
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      decoded.set(name, out);
      encoded.delete(name);
    }
    return decoded.get(name);
  }

  return {
    add(entries) { for (const k in entries) encoded.set(k, entries[k]); },
    addBytes(name, bytes) { decoded.set(name, bytes); },
    has(name) { return encoded.has(name) || decoded.has(name); },
    names() { return [...encoded.keys(), ...decoded.keys()]; },
    bytes,
    buffer(name) { const b = bytes(name); return b && b.buffer; },
    text(name) { const b = bytes(name); return b && new TextDecoder().decode(b); },
    json(name) { const t = this.text(name); return t && JSON.parse(t); },
  };
})();

/*
 * Data loaders. data/manifest.js (self.OFFLINE_MANIFEST) says which one the build produced:
 *   "script": desktop folder opened from disk -> data/<bundle>.js files added as <script> tags
 *   "fetch":  hosted phone app -> raw binary files fetched (and kept offline by the service worker)
 */
OM.DataLoader = class {
  static for(manifest, onProgress) {
    const Impl = manifest.mode === "fetch" ? OM.FetchAssetLoader : OM.ScriptBundleLoader;
    return new Impl(manifest, onProgress);
  }

  constructor(manifest, onProgress) {
    this.manifest = manifest;
    this.onProgress = onProgress;
    this.total = manifest.bundles.reduce((s, b) => s + b.bytes, 0);
    this.done = 0;
  }

  report(name) { this.onProgress(this.done / this.total, name); }

  async load() {
    for (const bundle of this.manifest.bundles) {
      this.report(bundle.name);
      await this.loadBundle(bundle);
    }
    this.report("");
  }

  /* abstract */ async loadBundle(bundle) { throw new Error("not implemented"); }
};

OM.ScriptBundleLoader = class extends OM.DataLoader {
  loadBundle(bundle) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `data/${bundle.name}.js`;
      s.onload = () => { this.done += bundle.bytes; this.report(bundle.name); resolve(); };
      s.onerror = () => reject(new Error(`Could not load data/${bundle.name}.js`));
      document.head.appendChild(s);
    });
  }
};

OM.FetchAssetLoader = class extends OM.DataLoader {
  async loadBundle(bundle) {
    for (const file of bundle.files) OfflineData.addBytes(file.name, await this.fetchFile(file, bundle.name));
  }

  /* Streams the body so the progress bar moves during the big basemap download. */
  async fetchFile(file, bundleName) {
    const resp = await fetch(file.path);
    if (!resp.ok) throw new Error(`Could not load ${file.path} (HTTP ${resp.status})`);
    const out = new Uint8Array(file.bytes);
    const reader = resp.body.getReader();
    let offset = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out.set(value, offset);
      offset += value.length;
      this.done += value.length;
      this.report(bundleName);
    }
    if (offset !== file.bytes) throw new Error(`Incomplete download of ${file.path}`);
    return out;
  }
};
