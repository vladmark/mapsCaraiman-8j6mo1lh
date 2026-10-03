/*
 * Icons drawn at runtime on canvas (no icon font or network needed):
 *   mk-<colour>-<shape>   Romanian trail waymarks (white square with band / cross / triangle / dot)
 *   poi-<category>        OSM destination icons
 *   mn-<file>             icons downloaded from muntii-nostri.ro for the featured-track POIs
 */
OM.Icons = class {
  static PIXEL_RATIO = 2;

  static COLOURS = {
    red: "#d7191c", blue: "#1f5fd1", yellow: "#e8b400", green: "#1a9641", black: "#222",
    white: "#888", orange: "#f07c00", purple: "#8e44ad", brown: "#8b5a2b",
  };

  /* category -> [background colour, painter] */
  static POI = {
    peak: ["#7a4b26", (g, s) => OM.Icons.poly(g, [[.5, .2], [.82, .78], [.18, .78]], s)],
    saddle: ["#7a4b26", (g, s) => { g.lineWidth = s * .1; g.beginPath(); g.moveTo(s * .18, s * .35); g.quadraticCurveTo(s * .5, s * .8, s * .82, s * .35); g.stroke(); }],
    hut: ["#c0392b", (g, s) => OM.Icons.poly(g, [[.5, .18], [.84, .5], [.74, .5], [.74, .8], [.26, .8], [.26, .5], [.16, .5]], s)],
    shelter: ["#d35400", (g, s) => OM.Icons.poly(g, [[.5, .22], [.85, .72], [.15, .72]], s, true)],
    viewpoint: ["#16a085", (g, s) => { OM.Icons.circle(g, s * .5, s * .5, s * .2); g.fillStyle = "#16a085"; OM.Icons.circle(g, s * .5, s * .5, s * .08); }],
    waterfall: ["#2980b9", (g, s) => { g.lineWidth = s * .09; for (const x of [.35, .5, .65]) { g.beginPath(); g.moveTo(s * x, s * .2); g.lineTo(s * x, s * .8); g.stroke(); } }],
    cave: ["#4a4a4a", (g, s) => { g.beginPath(); g.arc(s * .5, s * .72, s * .3, Math.PI, 0); g.fill(); }],
    spring: ["#3498db", (g, s) => { g.beginPath(); g.moveTo(s * .5, s * .18); g.quadraticCurveTo(s * .8, s * .6, s * .5, s * .8); g.quadraticCurveTo(s * .2, s * .6, s * .5, s * .18); g.fill(); }],
    castle: ["#6c3483", (g, s) => OM.Icons.poly(g, [[.2, .8], [.2, .25], [.32, .25], [.32, .38], [.44, .38], [.44, .25], [.56, .25], [.56, .38], [.68, .38], [.68, .25], [.8, .25], [.8, .8]], s)],
    monastery: ["#8e6c1f", (g, s) => { g.fillRect(s * .44, s * .15, s * .12, s * .7); g.fillRect(s * .25, s * .32, s * .5, s * .12); }],
    memorial: ["#5d6d7e", (g, s) => { g.fillRect(s * .44, s * .15, s * .12, s * .7); g.fillRect(s * .3, s * .3, s * .4, s * .1); }],
    ruins: ["#7f8c8d", (g, s) => { g.fillRect(s * .2, s * .5, s * .15, s * .3); g.fillRect(s * .42, s * .3, s * .15, s * .5); g.fillRect(s * .64, s * .55, s * .15, s * .25); }],
    museum: ["#7d3c98", (g, s) => { OM.Icons.poly(g, [[.5, .18], [.85, .38], [.15, .38]], s); for (const x of [.22, .44, .66]) g.fillRect(s * x, s * .42, s * .12, s * .3); g.fillRect(s * .15, s * .74, s * .7, s * .08); }],
    attraction: ["#e67e22", (g, s) => OM.Icons.star(g, s)],
    camp: ["#27ae60", (g, s) => OM.Icons.poly(g, [[.5, .2], [.85, .8], [.15, .8]], s)],
    rescue: ["#e74c3c", (g, s) => { g.fillRect(s * .42, s * .2, s * .16, s * .6); g.fillRect(s * .2, s * .42, s * .6, s * .16); }],
    train: ["#34495e", (g, s) => { g.fillRect(s * .25, s * .2, s * .5, s * .45); g.fillStyle = "#34495e"; g.fillRect(s * .32, s * .28, s * .36, s * .15); g.fillStyle = "#fff"; OM.Icons.circle(g, s * .35, s * .74, s * .07); OM.Icons.circle(g, s * .65, s * .74, s * .07); }],
    cablecar: ["#111", (g, s) => { g.lineWidth = s * .07; g.beginPath(); g.moveTo(s * .1, s * .2); g.lineTo(s * .9, s * .32); g.stroke(); g.fillRect(s * .47, s * .26, s * .06, s * .16); OM.Icons.roundRect(g, s * .27, s * .42, s * .46, s * .38, s * .08); }],
  };

  static poly(g, pts, s, stroke = false) {
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s)));
    g.closePath();
    if (stroke) { g.lineWidth = s * .09; g.stroke(); } else g.fill();
  }

  static circle(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, 2 * Math.PI); g.fill(); }

  static roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); }

  static star(g, s) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? .17 : .36, a = -Math.PI / 2 + i * Math.PI / 5;
      pts.push([.5 + r * Math.cos(a), .52 + r * Math.sin(a)]);
    }
    OM.Icons.poly(g, pts, s);
  }

  constructor(map) { this.map = map; }

  canvas(size) {
    const px = size * OM.Icons.PIXEL_RATIO;
    const c = document.createElement("canvas");
    c.width = c.height = px;
    return [c, c.getContext("2d"), px];
  }

  add(name, canvas) {
    const g = canvas.getContext("2d");
    if (!this.map.hasImage(name)) {
      this.map.addImage(name, g.getImageData(0, 0, canvas.width, canvas.height), { pixelRatio: OM.Icons.PIXEL_RATIO });
    }
  }

  /* White square with the coloured symbol, as painted on trees in Romanian mountains. */
  waymark(colourName, shape) {
    const [c, g, s] = this.canvas(16);
    const col = OM.Icons.COLOURS[colourName] || "#d7191c";
    g.fillStyle = "#fff"; g.strokeStyle = "#555"; g.lineWidth = 2;
    g.fillRect(1, 1, s - 2, s - 2); g.strokeRect(1, 1, s - 2, s - 2);
    g.fillStyle = col;
    const m = s * 0.18;
    if (shape === "cross") { g.fillRect(s * .42, m, s * .16, s - 2 * m); g.fillRect(m, s * .42, s - 2 * m, s * .16); }
    else if (shape === "triangle") OM.Icons.poly(g, [[.5, .2], [.82, .78], [.18, .78]], s);
    else if (shape === "dot") OM.Icons.circle(g, s / 2, s / 2, s * .28);
    else if (shape === "diamond") OM.Icons.poly(g, [[.5, .15], [.85, .5], [.5, .85], [.15, .5]], s);
    else g.fillRect(m, s * .36, s - 2 * m, s * .28);  // band (bandă)
    this.add(`mk-${colourName}-${shape}`, c);
  }

  poi(category) {
    const [bg, paint] = OM.Icons.POI[category];
    const [c, g, s] = this.canvas(20);
    g.fillStyle = bg; g.strokeStyle = "#fff"; g.lineWidth = s * .08;
    g.beginPath(); g.arc(s / 2, s / 2, s / 2 - g.lineWidth, 0, 2 * Math.PI); g.fill(); g.stroke();
    g.fillStyle = "#fff"; g.strokeStyle = "#fff";
    g.save(); g.translate(s * .15, s * .15); paint(g, s * .7); g.restore();
    this.add(`poi-${category}`, c);
  }

  async muntiiNostri(file) {
    const bytes = OfflineData.bytes(`icons/${file}`);
    if (!bytes) return;
    const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const [c, g, s] = this.canvas(18);
    g.drawImage(bmp, 0, 0, s, s);
    this.add(`mn-${file}`, c);
  }

  async registerAll() {
    for (const colour of Object.keys(OM.Icons.COLOURS)) {
      for (const shape of ["band", "cross", "triangle", "dot", "diamond", "other"]) this.waymark(colour, shape);
    }
    for (const cat of Object.keys(OM.Icons.POI)) this.poi(cat);
    const files = OfflineData.names().filter((n) => n.startsWith("icons/")).map((n) => n.slice(6));
    await Promise.all(files.map((f) => this.muntiiNostri(f)));
  }
};
