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

let index: Record<string, DetailEntry> | null = null;
const cache = new Map<string, DetailLayer>();

export async function detailIndex(): Promise<Record<string, DetailEntry>> {
  if (index) return index;
  const res = await fetch('/data/detail_index.json', { cache: 'no-cache' });
  index = res.ok ? ((await res.json()) as Record<string, DetailEntry>) : {};
  return index;
}

export async function loadDetail(key: string): Promise<DetailLayer | null> {
  const hit = cache.get(key);
  if (hit) return hit;
  const idx = await detailIndex();
  const e = idx[key];
  if (!e) return null;
  const res = await fetch('/data/' + e.file, { cache: 'no-cache' });
  if (!res.ok) return null;
  const layer = (await res.json()) as DetailLayer;
  cache.set(key, layer);
  return layer;
}

export function nearestDetailKey(
  idx: Record<string, DetailEntry>,
  x: number,
  y: number,
  maxR = 4500,
): string | null {
  let best: string | null = null;
  let bestD = maxR;
  for (const k of Object.keys(idx)) {
    const e = idx[k];
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}
