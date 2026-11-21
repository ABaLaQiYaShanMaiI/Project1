import { HYPSOMETRIC_RAMP, HYPSOMETRIC_RAMP_COARSE, HYPSOMETRIC_RAMP_MID } from './style/tokens';
import { tierBands, type PmtilesZone } from './pmtilesBasemap';

export interface DemBand {
  key: string;
  from: number;
  bbox: [number, number, number, number];
  ramp: unknown;
}

function boxHit(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

export const DEM_BANDS: DemBand[] = [
  { key: 'world', from: 0, bbox: [-180, -85, 180, 85], ramp: HYPSOMETRIC_RAMP_COARSE },
  { key: 'world6', from: 6, bbox: [-180, -85, 180, 85], ramp: HYPSOMETRIC_RAMP_COARSE },
  { key: 'europe', from: 7, bbox: [0, 44, 24.5, 58], ramp: HYPSOMETRIC_RAMP_MID },
  { key: 'germany', from: 9, bbox: [5.8, 47.2, 15.1, 55.1], ramp: HYPSOMETRIC_RAMP },
];

export function demKeyAt(zoom: number, lon: number, lat: number): string {
  let key = 'world';
  for (const d of DEM_BANDS) {
    if (d.from > zoom) continue;
    if (boxHit(d.bbox, [lon, lat, lon, lat])) key = d.key;
  }
  return key;
}

export function viewSig(hit: PmtilesZone[], zoom: number, lon: number, lat: number): string {
  const bands = tierBands(hit);
  return `${hit.map((z) => z.key).sort().join(',')}|${bands.map((b) => b.from).join(',')}|${demKeyAt(zoom, lon, lat)}`;
}
