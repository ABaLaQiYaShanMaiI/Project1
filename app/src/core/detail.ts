import type { Pt } from './types';

export interface DetailStreet {
  c: string;
  p: Pt[];
}

export interface DetailLayer {
  name: string;
  center: Pt;
  radius: number;
  buildings: number[][];
  streets: DetailStreet[];
}

export interface DetailEntry {
  file: string;
  x: number;
  y: number;
  r: number;
  n: number;
}

export function nearestDetailKeys(
  idx: Record<string, DetailEntry>,
  x: number,
  y: number,
  maxR = 4500,
  limit = 2,
): string[] {
  const hits: Array<{ k: string; d: number }> = [];
  for (const k of Object.keys(idx)) {
    const e = idx[k];
    const d = Math.hypot(e.x - x, e.y - y);
    if (d <= maxR) hits.push({ k, d });
  }
  hits.sort((a, b) => a.d - b.d);
  return hits.slice(0, limit).map((h) => h.k);
}
