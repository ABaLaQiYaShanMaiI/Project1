import type { DemSampler } from '../data/terrain';

export interface Readout {
  lat: number;
  lon: number;
  elevation: number | null;
  slope: number | null;
  aspect: number | null;
}

export function bearingLabel(
  deg: number,
  dirs: string[] = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'],
): string {
  return dirs[Math.round(deg / 45) % 8];
}

export function buildReadout(sampler: DemSampler | null, lat: number, lon: number): Readout {
  const sp = sampler ? sampler.sample(lat, lon) : null;
  return {
    lat,
    lon,
    elevation: sp ? Math.round(sp.elevation) : null,
    slope: sp ? sp.slope : null,
    aspect: sp ? sp.aspect : null,
  };
}
