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
  const lines: [number, number][][] = [];
  for (const z of zones) {
    const doc = await getJson<RailsDoc>(`/data/rails_${z.key}.json`);
    if (doc?.lines?.length) lines.push(...doc.lines);
  }
  return lines.length ? ({ lines } as RailsDoc) : null;
}

export async function firstJson<T>(zones: PmtilesZone[], urlOf: (key: string) => string): Promise<T | null> {
  for (const z of zones) {
    const doc = await getJson<T>(urlOf(z.key));
    if (doc) return doc;
  }
  return null;
}
