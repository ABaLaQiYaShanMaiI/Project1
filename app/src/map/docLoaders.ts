import type { PmtilesZone } from '../data/pmtilesBasemap';
import type { FC } from '../data/style/types';

const jsonCache = new Map<string, unknown>();

export async function getJson<T>(url: string): Promise<T | null> {
  if (jsonCache.has(url)) return (jsonCache.get(url) as T | null) ?? null;
  try {
    let res = await fetch(url, { cache: 'force-cache' });
    if (res.ok && !(res.headers.get('content-type') ?? '').includes('json')) {
      res = await fetch(url, { cache: 'no-store' });
    }
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null;
    const doc = (await res.json()) as T;
    jsonCache.set(url, doc);
    return doc;
  } catch {
    return null;
  }
}

export interface RailsDoc {
  lines?: [number, number][][];
}

export interface MergedRails {
  lines: [number, number][][];
  boxes: [number, number, number, number][];
}

export interface DensityDoc {
  key?: string;
  tiles?: string;
  minzoom?: number;
  maxzoom?: number;
  bbox?: [number, number, number, number];
}

export interface PoiDoc {
  points?: Array<{ o: number; l: number; k: string }>;
}

export interface SeaDoc {
  points?: Array<[number, number, string, number]>;
}

export interface RoadsWorldDoc {
  lines?: [number, number][][];
  cls?: number[];
}

export interface RiversWorldDoc {
  lines?: [number, number][][];
  rank?: number[];
}

export function poiFc(points: Array<{ o: number; l: number; k: string }>): FC | null {
  if (!points.length) return null;
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      properties: { k: p.k },
      geometry: { type: 'Point', coordinates: [p.o, p.l] },
    })),
  } as unknown as FC;
}

export function roadsWorldFc(doc: RoadsWorldDoc | null): FC | null {
  if (!doc?.lines?.length) return null;
  return {
    type: 'FeatureCollection',
    features: doc.lines.map((line, i) => ({
      type: 'Feature',
      properties: { c: doc.cls?.[i] ?? 2 },
      geometry: { type: 'LineString', coordinates: line },
    })),
  } as unknown as FC;
}

export function riversWorldFc(doc: RiversWorldDoc | null): FC | null {
  if (!doc?.lines?.length) return null;
  return {
    type: 'FeatureCollection',
    features: doc.lines.map((line, i) => ({
      type: 'Feature',
      properties: { r: doc.rank?.[i] ?? 7 },
      geometry: { type: 'LineString', coordinates: line },
    })),
  } as unknown as FC;
}

export function seaLabelFc(doc: SeaDoc | null): FC | null {
  if (!doc?.points?.length) return null;
  return {
    type: 'FeatureCollection',
    features: doc.points.map(([o, l, n, s]) => ({
      type: 'Feature',
      properties: { n, s },
      geometry: { type: 'Point', coordinates: [o, l] },
    })),
  } as unknown as FC;
}

const POI_DEDUP_M: Record<string, number> = { airport: 6000, port: 4000, station: 900, bridge: 250 };

const POI_GRID_DEG = 0.25;

function dedupePoiPoints<T extends { o: number; l: number; k: string }>(points: T[]): T[] {
  const buckets = new Map<string, T[]>();
  const kept: T[] = [];
  for (const p of points) {
    const gx = Math.floor(p.o / POI_GRID_DEG);
    const gy = Math.floor(p.l / POI_GRID_DEG);
    const r = POI_DEDUP_M[p.k] ?? 800;
    let dup = false;
    for (let dx = -1; dx <= 1 && !dup; dx += 1) {
      for (let dy = -1; dy <= 1 && !dup; dy += 1) {
        const arr = buckets.get(`${gx + dx},${gy + dy}`);
        if (!arr) continue;
        for (const q of arr) {
          if (q.k !== p.k) continue;
          const dLatM = (p.l - q.l) * 111320;
          const dLonM = (p.o - q.o) * 111320 * Math.cos((((p.l + q.l) / 2) * Math.PI) / 180);
          if (dLatM * dLatM + dLonM * dLonM < r * r) {
            dup = true;
            break;
          }
        }
      }
    }
    if (dup) continue;
    kept.push(p);
    const key = `${gx},${gy}`;
    const arr = buckets.get(key);
    if (arr) arr.push(p);
    else buckets.set(key, [p]);
  }
  return kept;
}

export function mergePois(docs: Array<PoiDoc | null>): Array<{ o: number; l: number; k: string }> {
  const all: Array<{ o: number; l: number; k: string }> = [];
  for (const doc of docs) {
    if (!doc?.points?.length) continue;
    all.push(...doc.points);
  }
  return dedupePoiPoints(all);
}

export async function mergeRails(zones: PmtilesZone[]): Promise<MergedRails | null> {
  const ordered = [...zones].sort((a, b) => b.maxzoom - a.maxzoom);
  const docs = await Promise.all(ordered.map((z) => getJson<RailsDoc>(`/data/rails_${z.key}.json`)));
  const lines: [number, number][][] = [];
  const guards: PmtilesZone[] = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const doc = docs[i];
    if (!doc?.lines?.length) continue;
    for (const line of doc.lines) {
      if (guards.some((g) => lineInside(line, g.bbox))) continue;
      lines.push(line);
    }
    guards.push(ordered[i]);
  }
  return lines.length ? { lines, boxes: guards.map((g) => g.bbox) } : null;
}

function lineInside(line: [number, number][], box: [number, number, number, number]): boolean {
  for (const p of line) {
    if (p[0] < box[0] || p[0] > box[2] || p[1] < box[1] || p[1] > box[3]) return false;
  }
  return true;
}
