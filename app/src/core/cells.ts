import { utmIn, utmOf, utmToLonLat } from './geo';

export interface CityDisc {
  lon: number;
  lat: number;
  r: number;
}

export interface Cell {
  zone: number;
  band: string;
  e: number;
  n: number;
  step: number;
  cov: number;
  ring: [number, number][];
}

export interface CellInfo {
  id: string;
  label: string;
  step: number;
  cov: number;
  urban: boolean;
}

export interface CellView {
  cells: Cell[];
  ms: number;
  truncated: boolean;
}

export const BASE_STEP = 8000;
export const MIN_STEP = 1000;
export const MIN_URBAN_R = 1200;
export const SPLIT_COVER = 0.16;
export const CELL_BUDGET = 420;
export const CELL_MINZOOM = 11.5;
const SAMPLES = 5;
const METERS_PER_DEG = 111320;

export function cellId(c: { zone: number; band: string; e: number; n: number; step: number }): string {
  return `${c.zone}${c.band}/${c.step}/${c.e}/${c.n}`;
}

export function cellLabel(c: { zone: number; band: string; e: number; n: number }): string {
  return `${c.zone}${c.band} ${Math.round(c.e / 1000)} ${Math.round(c.n / 1000)}`;
}

export function cellAreaKm2(step: number): number {
  return (step / 1000) ** 2;
}

export function cellRing(zone: number, e: number, n: number, step: number, south: boolean): [number, number][] {
  const sw = utmToLonLat(zone, e, n, south);
  const se = utmToLonLat(zone, e + step, n, south);
  const ne = utmToLonLat(zone, e + step, n + step, south);
  const nw = utmToLonLat(zone, e, n + step, south);
  return [sw, se, ne, nw, sw];
}

export function cellAt(lon: number, lat: number, step: number): { zone: number; band: string; e: number; n: number; step: number } {
  const u = utmOf(lat, lon);
  return {
    zone: u.zone,
    band: u.band,
    e: Math.floor(u.easting / step) * step,
    n: Math.floor(u.northing / step) * step,
    step,
  };
}

export function infoOf(c: Cell): CellInfo {
  return {
    id: cellId(c),
    label: cellLabel(c),
    step: c.step,
    cov: c.cov,
    urban: c.step < BASE_STEP,
  };
}

export function cellsInView(
  bounds: [number, number, number, number],
  near: (b: [number, number, number, number]) => CityDisc[],
  budget = CELL_BUDGET,
): CellView {
  const t0 = performance.now();
  const [w, s, e, n] = bounds;
  const midLat = (s + n) / 2;
  const midLon = (w + e) / 2;
  const base = utmOf(midLat, midLon);
  const zone = base.zone;
  const south = base.band < 'N';

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
      [n, w + (e - w) * t],
    ]) {
      const u = utmIn(zone, Math.max(-84, Math.min(84, lat)), lon);
      eMin = Math.min(eMin, u.easting);
      eMax = Math.max(eMax, u.easting);
      nMin = Math.min(nMin, u.northing);
      nMax = Math.max(nMax, u.northing);
    }
  }

  const make = (e0: number, n0: number, step: number): Cell => {
    const ring = cellRing(zone, e0, n0, step, south);
    return { zone, band: base.band, e: e0, n: n0, step, cov: coverage(ring, near), ring };
  };

  const nodes: Cell[] = [];
  for (let e0 = Math.floor(eMin / BASE_STEP) * BASE_STEP; e0 <= eMax; e0 += BASE_STEP) {
    for (let n0 = Math.floor(nMin / BASE_STEP) * BASE_STEP; n0 <= nMax; n0 += BASE_STEP) {
      nodes.push(make(e0, n0, BASE_STEP));
    }
  }

  while (nodes.length < budget) {
    let pick = -1;
    let best = 0;
    for (let i = 0; i < nodes.length; i++) {
      const c = nodes[i];
      if (c.step <= MIN_STEP || c.cov < SPLIT_COVER) continue;
      const score = c.cov * c.step * c.step;
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
      make(c.e + half, c.n + half, half),
    );
  }

  return { cells: nodes, ms: performance.now() - t0, truncated: nodes.length >= budget };
}

function coverage(ring: [number, number][], near: (b: [number, number, number, number]) => CityDisc[]): number {
  const [p0, p1, p2, p3] = ring;
  const w = Math.min(p0[0], p1[0], p2[0], p3[0]);
  const e = Math.max(p0[0], p1[0], p2[0], p3[0]);
  const s = Math.min(p0[1], p1[1], p2[1], p3[1]);
  const n = Math.max(p0[1], p1[1], p2[1], p3[1]);
  const cities = near([w, s, e, n]).filter((c) => c.r >= MIN_URBAN_R);
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
      const cos = Math.cos((lat * Math.PI) / 180);
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
