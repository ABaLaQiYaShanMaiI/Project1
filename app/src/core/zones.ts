export interface ZoneEntry {
  key: string;
  name: string;
  file: string;
  center: [number, number] | null;
  spanKm: [number, number] | null;
  bbox: { south: number; north: number; west: number; east: number } | null;
  generated: string | null;
  sizeMB: number;
}

export interface BakeEstimate {
  tiles: number;
  cached: number;
  fresh: number;
  seconds: number;
}

export type BakeState = 'idle' | 'running' | 'done' | 'error';

export interface BakeStatus {
  id: number;
  state: BakeState;
  key: string;
  title: string;
  stage: string;
  progress: number;
  elapsed: number;
  estimate: BakeEstimate | null;
  result: (ZoneEntry & { url: string; seconds: number }) | null;
  error: string | null;
  log: string[];
}

export interface BakeRequest {
  center: [number, number];
  spanKm: [number, number];
  key: string;
  title: string;
}

export function makeZoneKey(lat: number, lon: number): string {
  const enc = (n: number) => String(Math.round(n * 100)).replace('-', 'm');
  return `z${enc(lat)}_${enc(lon)}`;
}

export function zoneTitle(lat: number, lon: number, wKm: number, hKm: number): string {
  const ns = `${Math.abs(lat).toFixed(2)}${lat >= 0 ? 'N' : 'S'}`;
  const ew = `${Math.abs(lon).toFixed(2)}${lon >= 0 ? 'E' : 'W'}`;
  return `自定义战场 ${ns} ${ew} · ${Math.round(wKm)}×${Math.round(hKm)} km`;
}
