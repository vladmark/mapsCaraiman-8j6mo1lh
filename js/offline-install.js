/*
 * Offline installation of the phone app: registers the service worker, makes sure it controls the
 * page before any data is downloaded (so every download is also stored), then verifies that all
 * files really are stored and tells the user whether it is safe to go offline.
 * In the desktop (file://) variant none of this applies and the status chip stays hidden.
 */
OM.OfflineInstaller = class {
  static CONTROL_TIMEOUT_MS = 15000;

  constructor(manifest, chip) {
    this.manifest = manifest;
    this.chip = chip;
    this.cacheName = `caraiman-${manifest.version}`;
    this.enabled = manifest.mode === "fetch" && "serviceWorker" in navigator && window.isSecureContext;
  }

  /* Call before downloading data. */
  async prepare() {
    if (!this.enabled) {
      if (this.manifest.mode === "fetch") this.show("warn", "Offline storage unavailable (needs HTTPS)");
      return;
    }
    try {
      await navigator.serviceWorker.register("sw.js");
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) => {
          navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
          setTimeout(resolve, OM.OfflineInstaller.CONTROL_TIMEOUT_MS);
        });
      }
      // Ask the browser not to evict our storage under pressure (granted automatically for installed apps).
      if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
    } catch (err) {
      console.warn("Service worker registration failed", err);
    }
  }

  /* Call after the data has been loaded. */
  async verify() {
    if (!this.enabled) return;
    try {
      const cache = await caches.open(this.cacheName);
      const paths = [...this.manifest.shell, ...this.manifest.bundles.flatMap((b) => b.files.map((f) => f.path))];
      const missing = [];
      for (const p of paths) if (!(await cache.match(p, { ignoreSearch: true }))) missing.push(p);
      if (missing.length) {
        console.warn("Not stored offline:", missing);
        this.show("warn", `Not fully saved for offline use (${missing.length} files missing) – reopen once with internet`);
      } else {
        this.show("ok", "Saved on this phone – works offline");
      }
    } catch (err) {
      this.show("warn", "Could not check offline storage");
    }
  }

  show(kind, text) {
    this.chip.className = `offline-status ${kind}`;
    this.chip.textContent = (kind === "ok" ? "✓ " : "⚠ ") + text;
    this.chip.hidden = false;
    if (kind === "ok") setTimeout(() => this.chip.classList.add("faded"), 6000);
  }
};
