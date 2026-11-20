import type { PmtilesZone } from '../data/pmtilesBasemap';

// 静态数据（构建产物）运行期不变：内存缓存避免缩放跨级重建时重复下载/解析大 JSON
const jsonCache = new Map<string, unknown>();

export async function getJson<T>(url: string): Promise<T | null> {
  if (jsonCache.has(url)) return (jsonCache.get(url) as T | null) ?? null;
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) {
      jsonCache.set(url, null);
      return null;
    }
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
  return lines.length ? ({ lines } as RailsDoc) : null;
}

function lineInside(line: [number, number][], box: [number, number, number, number]): boolean {
  for (const p of line) {
    if (p[0] < box[0] || p[0] > box[2] || p[1] < box[1] || p[1] > box[3]) return false;
  }
  return true;
}
