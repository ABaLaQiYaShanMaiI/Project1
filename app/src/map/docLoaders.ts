import type { PmtilesZone } from '../data/pmtilesBasemap';

export async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface RailsDoc {
  lines?: [number, number][][];
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

export async function mergeRails(zones: PmtilesZone[]): Promise<RailsDoc | null> {
  const ordered = [...zones].sort((a, b) => b.maxzoom - a.maxzoom);
  const lines: [number, number][][] = [];
  const guards: PmtilesZone[] = [];
  for (const z of ordered) {
    const doc = await getJson<RailsDoc>(`/data/rails_${z.key}.json`);
    if (!doc?.lines?.length) continue;
    for (const line of doc.lines) {
      if (guards.some((g) => lineInside(line, g.bbox))) continue;
      lines.push(line);
    }
    guards.push(z);
  }
  return lines.length ? ({ lines } as RailsDoc) : null;
}

function lineInside(line: [number, number][], box: [number, number, number, number]): boolean {
  for (const p of line) {
    if (p[0] < box[0] || p[0] > box[2] || p[1] < box[1] || p[1] > box[3]) return false;
  }
  return true;
}
