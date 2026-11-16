// ../Tools/.t_cells.mjs
import { readFileSync } from "node:fs";

// src/core/geo.ts
var A = 6378137;
var F = 1 / 298.257223563;
var E2 = F * (2 - F);
var EP2 = E2 / (1 - E2);
var K0 = 0.9996;
var BANDS = "CDEFGHJKLMNPQRSTUVWX";
function utmOf(lat, lon) {
  const zone = Math.floor((lon + 180) / 6) + 1;
  return utmIn(zone, lat, lon);
}
function utmIn(zone, lat, lon) {
  const lam0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
  const phi = lat * Math.PI / 180;
  const lam = lon * Math.PI / 180;
  const sinP = Math.sin(phi);
  const cosP = Math.cos(phi);
  const tanP = Math.tan(phi);
  const n = A / Math.sqrt(1 - E2 * sinP * sinP);
  const t = tanP * tanP;
  const c = EP2 * cosP * cosP;
  const a = cosP * (lam - lam0);
  const m = A * ((1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 * E2 * E2 / 256) * phi - (3 * E2 / 8 + 3 * E2 * E2 / 32 + 45 * E2 * E2 * E2 / 1024) * Math.sin(2 * phi) + (15 * E2 * E2 / 256 + 45 * E2 * E2 * E2 / 1024) * Math.sin(4 * phi) - 35 * E2 * E2 * E2 / 3072 * Math.sin(6 * phi));
  const easting = K0 * n * (a + (1 - t + c) * a ** 3 / 6 + (5 - 18 * t + t * t + 72 * c - 58 * EP2) * a ** 5 / 120) + 5e5;
  let northing = K0 * (m + n * tanP * (a * a / 2 + (5 - t + 9 * c + 4 * c * c) * a ** 4 / 24 + (61 - 58 * t + t * t + 600 * c - 330 * EP2) * a ** 6 / 720));
  const south = lat < 0;
  if (south) northing += 1e7;
  const band = BANDS[Math.max(0, Math.min(BANDS.length - 1, Math.floor((lat + 80) / 8)))];
  return { zone, band, easting, northing, hemisphere: south ? "S" : "N" };
}
function utmToLonLat(zone, easting, northing, south) {
  const x = easting - 5e5;
  const y = south ? northing - 1e7 : northing;
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const mu = y / K0 / (A * (1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 * E2 * E2 / 256));
  const phi1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + 151 * e1 ** 3 / 96 * Math.sin(6 * mu) + 1097 * e1 ** 4 / 512 * Math.sin(8 * mu);
  const sin1 = Math.sin(phi1);
  const cos1 = Math.cos(phi1);
  const tan1 = Math.tan(phi1);
  const c1 = EP2 * cos1 * cos1;
  const t1 = tan1 * tan1;
  const n1 = A / Math.sqrt(1 - E2 * sin1 * sin1);
  const r1 = A * (1 - E2) / (1 - E2 * sin1 * sin1) ** 1.5;
  const d = x / (n1 * K0);
  const lat = phi1 - n1 * tan1 / r1 * (d * d / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * EP2) * d ** 4 / 24 + (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * EP2 - 3 * c1 * c1) * d ** 6 / 720);
  const lam0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
  const lon = lam0 + (d - (1 + 2 * t1 + c1) * d ** 3 / 6 + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * EP2 + 24 * t1 * t1) * d ** 5 / 120) / cos1;
  return [lon * 180 / Math.PI, lat * 180 / Math.PI];
}

// src/core/cells.ts
var BASE_STEP = 8e3;
var MIN_STEP = 1e3;
var MIN_URBAN_R = 1200;
var SPLIT_COVER = 0.16;
var CELL_BUDGET = 420;
var SAMPLES = 5;
var METERS_PER_DEG = 111320;
function cellLabel(c) {
  return `${c.zone}${c.band} ${Math.round(c.e / 1e3)} ${Math.round(c.n / 1e3)}`;
}
function cellRing(zone, e, n, step, south) {
  const sw = utmToLonLat(zone, e, n, south);
  const se = utmToLonLat(zone, e + step, n, south);
  const ne = utmToLonLat(zone, e + step, n + step, south);
  const nw = utmToLonLat(zone, e, n + step, south);
  return [sw, se, ne, nw, sw];
}
function cellsInView(bounds, near2, budget = CELL_BUDGET) {
  const t0 = performance.now();
  const [w, s, e, n] = bounds;
  const midLat = (s + n) / 2;
  const midLon = (w + e) / 2;
  const base = utmOf(midLat, midLon);
  const zone = base.zone;
  const south = base.band < "N";
  let eMin = Infinity;
  let eMax = -Infinity;
  let nMin = Infinity;
  let nMax = -Infinity;
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    for (const [lat, lon] of [
      [s + (n - s) * t, w],
      [s + (n - s) * t, e],
      [s, w + (e - w) * t],
      [n, w + (e - w) * t]
    ]) {
      const u = utmIn(zone, Math.max(-84, Math.min(84, lat)), lon);
      eMin = Math.min(eMin, u.easting);
      eMax = Math.max(eMax, u.easting);
      nMin = Math.min(nMin, u.northing);
      nMax = Math.max(nMax, u.northing);
    }
  }
  const make = (e0, n0, step) => {
    const ring = cellRing(zone, e0, n0, step, south);
    return { zone, band: base.band, e: e0, n: n0, step, cov: coverage(ring, near2), ring };
  };
  const nodes = [];
  for (let e0 = Math.floor(eMin / BASE_STEP) * BASE_STEP; e0 <= eMax; e0 += BASE_STEP) {
    for (let n0 = Math.floor(nMin / BASE_STEP) * BASE_STEP; n0 <= nMax; n0 += BASE_STEP) {
      nodes.push(make(e0, n0, BASE_STEP));
    }
  }
  while (nodes.length < budget) {
    let pick = -1;
    let best = 0;
    for (let i = 0; i < nodes.length; i++) {
      const c2 = nodes[i];
      if (c2.step <= MIN_STEP || c2.cov < SPLIT_COVER) continue;
      const score = c2.cov * c2.step * c2.step;
      if (score > best) {
        best = score;
        pick = i;
      }
    }
    if (pick < 0) break;
    const c = nodes[pick];
    const half = c.step / 2;
    nodes.splice(
      pick,
      1,
      make(c.e, c.n, half),
      make(c.e + half, c.n, half),
      make(c.e, c.n + half, half),
      make(c.e + half, c.n + half, half)
    );
  }
  return { cells: nodes, ms: performance.now() - t0, truncated: nodes.length >= budget };
}
function coverage(ring, near2) {
  const [p0, p1, p2, p3] = ring;
  const w = Math.min(p0[0], p1[0], p2[0], p3[0]);
  const e = Math.max(p0[0], p1[0], p2[0], p3[0]);
  const s = Math.min(p0[1], p1[1], p2[1], p3[1]);
  const n = Math.max(p0[1], p1[1], p2[1], p3[1]);
  const cities = near2([w, s, e, n]).filter((c) => c.r >= MIN_URBAN_R);
  if (!cities.length) return 0;
  let hit = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const u = (i + 0.5) / SAMPLES;
    for (let j = 0; j < SAMPLES; j++) {
      const v = (j + 0.5) / SAMPLES;
      const a = 1 - u;
      const b = 1 - v;
      const lon = a * b * p0[0] + u * b * p1[0] + u * v * p2[0] + a * v * p3[0];
      const lat = a * b * p0[1] + u * b * p1[1] + u * v * p2[1] + a * v * p3[1];
      const cos = Math.cos(lat * Math.PI / 180);
      for (const c of cities) {
        const dx = (lon - c.lon) * METERS_PER_DEG * cos;
        const dy = (lat - c.lat) * METERS_PER_DEG;
        if (dx * dx + dy * dy <= c.r * c.r) {
          hit++;
          break;
        }
      }
    }
  }
  return hit / (SAMPLES * SAMPLES);
}

// src/data/cities.ts
var BUCKET = 0.5;
var CityDex = class {
  buckets = /* @__PURE__ */ new Map();
  size;
  constructor(points2) {
    this.size = points2.length;
    for (const p of points2) {
      const key = `${Math.floor(p.lon / BUCKET)},${Math.floor(p.lat / BUCKET)}`;
      const arr = this.buckets.get(key);
      if (arr) arr.push(p);
      else this.buckets.set(key, [p]);
    }
  }
  near(b) {
    const [w, s, e, n] = b;
    const out = [];
    const x0 = Math.floor(w / BUCKET);
    const x1 = Math.floor(e / BUCKET);
    const y0 = Math.floor(s / BUCKET);
    const y1 = Math.floor(n / BUCKET);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const arr = this.buckets.get(`${x},${y}`);
        if (arr) out.push(...arr);
      }
    }
    return out;
  }
  nearest(lon, lat, maxR = 0.6) {
    const cities = this.near([lon - maxR, lat - maxR, lon + maxR, lat + maxR]);
    let best = null;
    let bestD = Infinity;
    for (const c of cities) {
      const dx = (lon - c.lon) * Math.cos(lat * Math.PI / 180);
      const dy = lat - c.lat;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }
};
function decodeCities(doc) {
  const bin = Uint8Array.from(atob(doc.b64), (ch) => ch.charCodeAt(0));
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const stride = doc.stride || 10;
  const out = [];
  for (let i = 0; i + stride <= bin.length; i += stride) {
    out.push({
      lon: dv.getFloat32(i, true),
      lat: dv.getFloat32(i + 4, true),
      r: dv.getUint8(i + 8) * doc.radiusScaleM
    });
  }
  return out;
}

// ../Tools/.t_cells.mjs
var load = (p) => decodeCities(JSON.parse(readFileSync(p, "utf8")));
var points = [...load("app/public/data/cities.json"), ...load("app/public/data/cities_fulda.json")];
var dex = new CityDex(points);
console.log("cities", points.length, "dex", dex.size);
var near = (b) => dex.near(b);
var mPerPx = (z, lat) => 156543.03392 * Math.cos(lat * Math.PI / 180) / 2 ** z;
function view(lon, lat, z, w = 1332, h = 852) {
  const mx = mPerPx(z, lat) * Math.cos(lat * Math.PI / 180) / 111320;
  const my = mPerPx(z, lat) / 111320;
  const dx = mx * w / 2;
  const dy = my * h / 2;
  const b = [lon - dx, lat - dy, lon + dx, lat + dy];
  const t = performance.now();
  const r = cellsInView(b, near, 420);
  const sizes = {};
  for (const c of r.cells) sizes[c.step] = (sizes[c.step] ?? 0) + 1;
  console.log(`
${lon},${lat} z${z} -> ${r.cells.length} cells ${r.ms.toFixed(1)}ms`, JSON.stringify(sizes));
  return r;
}
var f = view(9.675, 50.552, 14);
console.log("fulda cells:", f.cells.slice(0, 8).map((c) => `${cellLabel(c)}(${c.step}m cov=${c.cov.toFixed(2)})`).join(" "));
console.log("root?", BASE_STEP);
view(9.675, 50.552, 12);
view(9.675, 50.552, 16);
view(13.405, 52.52, 12);
view(2.352, 48.857, 12);
view(121.47, 31.23, 11);
view(139.69, 35.68, 12);
view(9.675, 50.552, 11);
view(-0.12, 51.5, 13);
