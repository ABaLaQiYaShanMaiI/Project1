import { cityMods, urbanWeight, type CityZone } from '../core/cityEffects';

export interface CityDisc {
  lon: number;
  lat: number;
  r: number;
  name: string;
}

export interface CitiesDoc {
  v: number;
  count: number;
  radiusScaleM: number;
  stride: number;
  b64: string;
  names?: string[];
}

const BUCKET = 0.5;

export class CityDex {
  private buckets = new Map<string, CityDisc[]>();
  readonly size: number;

  constructor(points: CityDisc[]) {
    this.size = points.length;
    for (const p of points) {
      const key = `${Math.floor(p.lon / BUCKET)},${Math.floor(p.lat / BUCKET)}`;
      const arr = this.buckets.get(key);
      if (arr) arr.push(p);
      else this.buckets.set(key, [p]);
    }
  }

  near(b: [number, number, number, number]): CityDisc[] {
    const [w, s, e, n] = b;
    const out: CityDisc[] = [];
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

  nearest(lon: number, lat: number, maxDeg = 0.8): { city: CityDisc; distM: number } | null {
    const cities = this.near([lon - maxDeg, lat - maxDeg, lon + maxDeg, lat + maxDeg]);
    let best: CityDisc | null = null;
    let bestD = Infinity;
    for (const c of cities) {
      const dx = (lon - c.lon) * 111320 * Math.cos((lat * Math.PI) / 180);
      const dy = (lat - c.lat) * 111320;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best ? { city: best, distM: bestD } : null;
  }
}

export function decodeCities(doc: CitiesDoc): CityDisc[] {
  const bin = Uint8Array.from(atob(doc.b64), (ch) => ch.charCodeAt(0));
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const stride = doc.stride || 10;
  const names = doc.names ?? [];
  const out: CityDisc[] = [];
  let i = 0;
  for (let o = 0; o + stride <= bin.length; o += stride, i++) {
    out.push({
      lon: dv.getFloat32(o, true),
      lat: dv.getFloat32(o + 4, true),
      r: dv.getUint8(o + 8) * doc.radiusScaleM,
      name: names[i] ?? '',
    });
  }
  return out;
}

export async function loadCityDex(regionKeys: string[]): Promise<CityDex> {
  const names = ['cities.json', ...regionKeys.map((k) => `cities_${k}.json`)];
  const points: CityDisc[] = [];
  for (const name of names) {
    const res = await fetch(`/data/${name}`, { cache: 'no-cache' }).catch(() => null);
    if (!res || !res.ok) continue;
    const doc = (await res.json().catch(() => null)) as CitiesDoc | null;
    if (!doc || typeof doc.b64 !== 'string') continue;
    points.push(...decodeCities(doc));
  }
  return new CityDex(points);
}
export function cityZoneAt(dex: CityDex | null, lon: number, lat: number): CityZone | null {
  if (!dex) return null;
  const hit = dex.nearest(lon, lat);
  if (!hit) return null;
  const weight = urbanWeight(hit.distM, hit.city.r);
  if (weight <= 0.02) return null;
  return {
    name: hit.city.name,
    lon: hit.city.lon,
    lat: hit.city.lat,
    r: hit.city.r,
    weight,
    mods: cityMods(weight, hit.city.r),
  };
}