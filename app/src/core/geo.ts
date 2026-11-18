const A = 6378137;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);
const EP2 = E2 / (1 - E2);
const K0 = 0.9996;

const BANDS = 'CDEFGHJKLMNPQRSTUVWX';

export interface Utm {
  zone: number;
  band: string;
  easting: number;
  northing: number;
  hemisphere: 'N' | 'S';
}

export function utmOf(lat: number, lon: number): Utm {
  const zone = Math.floor((lon + 180) / 6) + 1;
  return utmIn(zone, lat, lon);
}

export function utmIn(zone: number, lat: number, lon: number): Utm {
  const lam0 = (((zone - 1) * 6 - 180 + 3) * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const lam = (lon * Math.PI) / 180;
  const sinP = Math.sin(phi);
  const cosP = Math.cos(phi);
  const tanP = Math.tan(phi);
  const n = A / Math.sqrt(1 - E2 * sinP * sinP);
  const t = tanP * tanP;
  const c = EP2 * cosP * cosP;
  const a = cosP * (lam - lam0);
  const m =
    A *
    ((1 - E2 / 4 - (3 * E2 * E2) / 64 - (5 * E2 * E2 * E2) / 256) * phi -
      ((3 * E2) / 8 + (3 * E2 * E2) / 32 + (45 * E2 * E2 * E2) / 1024) * Math.sin(2 * phi) +
      ((15 * E2 * E2) / 256 + (45 * E2 * E2 * E2) / 1024) * Math.sin(4 * phi) -
      ((35 * E2 * E2 * E2) / 3072) * Math.sin(6 * phi));
  const easting =
    K0 * n * (a + ((1 - t + c) * a ** 3) / 6 + ((5 - 18 * t + t * t + 72 * c - 58 * EP2) * a ** 5) / 120) +
    500000;
  let northing =
    K0 *
    (m +
      n *
        tanP *
        (a * a / 2 +
          ((5 - t + 9 * c + 4 * c * c) * a ** 4) / 24 +
          ((61 - 58 * t + t * t + 600 * c - 330 * EP2) * a ** 6) / 720));
  const south = lat < 0;
  if (south) northing += 10000000;
  const band = BANDS[Math.max(0, Math.min(BANDS.length - 1, Math.floor((lat + 80) / 8)))];
  return { zone, band, easting, northing, hemisphere: south ? 'S' : 'N' };
}

export function utmText(u: Utm, digits = 0): string {
  const e = Math.round(u.easting).toString().padStart(6, '0');
  const n = Math.round(u.northing).toString().padStart(7, '0');
  if (digits <= 0) return `${u.zone}${u.band} ${e} ${n}`;
  const k = 10 ** digits;
  return `${u.zone}${u.band} ${Math.floor(u.easting / k)} ${Math.floor(u.northing / k)}`;
}

export function ddText(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

export interface GridFeature {
  type: 'Feature';
  properties: { v: number; axis: 'e' | 'n'; major: boolean; label: string };
  geometry: { type: 'LineString'; coordinates: [number, number][] };
}

export interface GridSpec {
  stepM: number;
  majorEvery: number;
  lines: GridFeature[];
}

const STEPS = [1000, 2000, 5000, 10000, 25000, 50000, 100000];

export function gridStepFor(zoom: number): number {
  const px20 = 2 ** zoom;
  const mPerPx = (156543.03392 * Math.cos((50 * Math.PI) / 180)) / px20;
  const want = mPerPx * 130;
  return STEPS.find((s) => s >= want) ?? STEPS[STEPS.length - 1];
}

export function buildUtmGrid(bounds: [number, number, number, number], stepM: number, samples = 24): GridSpec {
  const [w, s, e, n] = bounds;
  const corners = [utmOf(s, w), utmOf(s, e), utmOf(n, w), utmOf(n, e)];
  const e0 = Math.min(...corners.map((c) => c.easting));
  const e1 = Math.max(...corners.map((c) => c.easting));
  const n0 = Math.min(...corners.map((c) => c.northing));
  const n1 = Math.max(...corners.map((c) => c.northing));
  const majorEvery = stepM <= 5000 ? 5 : 4;
  const lines: GridFeature[] = [];

  const solveLon = (lat: number, easting: number): number => {
    let lo = w;
    let hi = e;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (utmOf(lat, mid).easting < easting) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };

  const solveLat = (lon: number, northing: number): number => {
    let lo = s;
    let hi = n;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (utmOf(mid, lon).northing < northing) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };

  for (let ev = Math.ceil(e0 / stepM) * stepM; ev <= e1; ev += stepM) {
    const coords: [number, number][] = [];
    for (let i = 0; i <= samples; i++) {
      const lat = s + ((n - s) * i) / samples;
      coords.push([solveLon(lat, ev), lat]);
    }
    lines.push({
      type: 'Feature',
      properties: { v: ev, axis: 'e', major: Math.round(ev / stepM) % majorEvery === 0, label: String(Math.round(ev / 1000)) },
      geometry: { type: 'LineString', coordinates: coords },
    });
  }
  for (let nv = Math.ceil(n0 / stepM) * stepM; nv <= n1; nv += stepM) {
    const coords: [number, number][] = [];
    for (let i = 0; i <= samples; i++) {
      const lon = w + ((e - w) * i) / samples;
      coords.push([lon, solveLat(lon, nv)]);
    }
    lines.push({
      type: 'Feature',
      properties: { v: nv, axis: 'n', major: Math.round(nv / stepM) % majorEvery === 0, label: String(Math.round(nv / 1000)) },
      geometry: { type: 'LineString', coordinates: coords },
    });
  }
  return { stepM, majorEvery, lines };
}

export function rangeRing(center: [number, number], radiusKm: number, segments = 96): [number, number][] {
  const [lon, lat] = center;
  const mPerDegLat = 110540;
  const mPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const pts: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push([lon + (Math.cos(a) * radiusKm * 1000) / mPerDegLon, lat + (Math.sin(a) * radiusKm * 1000) / mPerDegLat]);
  }
  return pts;
}
