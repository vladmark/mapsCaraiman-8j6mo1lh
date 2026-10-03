/*
 * Walking-time estimation.
 *
 * DIN 33466 (the formula used on German/Austrian/Romanian signposts):
 *   horizontal time  th = distance_km / 4 km/h
 *   vertical time    tv = ascent_m / 300 m/h + descent_m / 500 m/h
 *   total            t  = max(th, tv) + min(th, tv) / 2
 * Applied piecewise over ~250 m pieces so long routes mixing climbs and descents are not
 * under-estimated, then multiplied by a personal pace factor.
 */
OM.geo = {
  R: 6371008.8,
  dist(a, b) {
    const toRad = Math.PI / 180;
    const dLat = (b[1] - a[1]) * toRad, dLon = (b[0] - a[0]) * toRad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLon / 2) ** 2;
    return 2 * OM.geo.R * Math.asin(Math.sqrt(h));
  },
};

OM.DinTimeModel = class {
  constructor({ flatKmh = 4, upMh = 300, downMh = 500, pace = 1 } = {}) {
    Object.assign(this, { flatKmh, upMh, downMh, pace });
  }
  hours(distM, up, down) {
    const th = distM / 1000 / this.flatKmh;
    const tv = up / this.upMh + down / this.downMh;
    return (Math.max(th, tv) + Math.min(th, tv) / 2) * this.pace;
  }
};

/* Cable cars: fixed waiting/boarding allowance plus the ride itself (no pace factor). */
OM.AerialTimeModel = class {
  constructor({ waitHours = 0.15, speedKmh = 18 } = {}) { Object.assign(this, { waitHours, speedKmh }); }
  hours(distM) { return this.waitHours + distM / 1000 / this.speedKmh; }
};

/* Distance, climb and time for a polyline of [lon, lat, ele] points.
 * DEM elevations along steep paths are noisy (a path hugging a cliff samples both sides), so
 * elevations are first averaged over a ±100 m distance window, then climbs smaller than 10 m are
 * ignored (hysteresis). Calibrated on Bușteni → Babele, whose station altitudes are known. */
OM.PathMeter = class {
  static PIECE_M = 250;
  static SMOOTH_M = 100;
  static HYSTERESIS_M = 10;

  constructor(walkModel, aerialModel) { this.walk = walkModel; this.aerial = aerialModel; }

  static smooth(points, cum) {
    const out = new Array(points.length);
    let lo = 0, hi = -1, sum = 0;
    for (let i = 0; i < points.length; i++) {
      while (hi + 1 < points.length && cum[hi + 1] - cum[i] <= OM.PathMeter.SMOOTH_M) sum += points[++hi][2];
      while (cum[i] - cum[lo] > OM.PathMeter.SMOOTH_M) sum -= points[lo++][2];
      out[i] = sum / (hi - lo + 1);
    }
    return out;
  }

  measure(points, kind = "walk") {
    const cum = [0];
    for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + OM.geo.dist(points[i - 1], points[i]));
    const dist = cum[cum.length - 1] || 0;
    let maxEle = -Infinity, minEle = Infinity;
    for (const p of points) { maxEle = Math.max(maxEle, p[2]); minEle = Math.min(minEle, p[2]); }
    if (kind !== "walk") {
      const first = points[0][2], last = points[points.length - 1][2];
      return { dist, up: Math.max(0, last - first), down: Math.max(0, first - last), hours: this.aerial.hours(dist), maxEle, minEle, cum };
    }
    const ele = OM.PathMeter.smooth(points, cum);
    let up = 0, down = 0, hours = 0, ref = ele[0];
    let piece = { d: 0, up: 0, down: 0 };
    const flush = () => { hours += this.walk.hours(piece.d, piece.up, piece.down); piece = { d: 0, up: 0, down: 0 }; };
    for (let i = 1; i < points.length; i++) {
      piece.d += cum[i] - cum[i - 1];
      const delta = ele[i] - ref;
      if (delta >= OM.PathMeter.HYSTERESIS_M) { up += delta; piece.up += delta; ref = ele[i]; }
      else if (delta <= -OM.PathMeter.HYSTERESIS_M) { down -= delta; piece.down -= delta; ref = ele[i]; }
      if (piece.d >= OM.PathMeter.PIECE_M) flush();
    }
    if (piece.d > 0) flush();
    return { dist, up, down, hours, maxEle, minEle, cum };
  }

  /* legs: [{kind: "walk"|"aerial", points}] -> totals, with walking and riding kept apart. */
  measureLegs(legs) {
    const total = { dist: 0, up: 0, down: 0, hours: 0, walkDist: 0, rideDist: 0, rideHours: 0, maxEle: -Infinity, minEle: Infinity };
    for (const leg of legs) {
      const m = this.measure(leg.points, leg.kind);
      total.dist += m.dist; total.hours += m.hours;
      total.maxEle = Math.max(total.maxEle, m.maxEle); total.minEle = Math.min(total.minEle, m.minEle);
      if (leg.kind === "walk") { total.up += m.up; total.down += m.down; total.walkDist += m.dist; }
      else { total.rideDist += m.dist; total.rideHours += m.hours; }
    }
    return total;
  }
};

OM.fmt = {
  hours(h) {
    if (!isFinite(h)) return "–";
    const totalMin = Math.round(h * 60 / 5) * 5;
    return `${Math.floor(totalMin / 60)}:${String(totalMin % 60).padStart(2, "0")} h`;
  },
  km(m) { return `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`; },
  m(v) { return `${Math.round(v)} m`; },
};
