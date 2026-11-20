import type { StyleSpecification } from 'maplibre-gl';
import type { Tier } from './style/types';

export interface PmtilesZone {
  key: string;
  name: string;
  file: string;
  style: string;
  bbox: [number, number, number, number];
  center: [number, number];
  minzoom: number;
  maxzoom: number;
  sizeMB: number;
  source: string;
  theme: string;
  attribution: string;
  generated: string;
  kind?: 'world' | 'region';
}

let cache: PmtilesZone[] | null = null;
let protocol: Promise<void> | null = null;

export async function loadPmtilesZones(): Promise<PmtilesZone[]> {
  if (cache) return cache;
  try {
    const res = await fetch('/data/tiles/index.json', { cache: 'no-cache' });
    if (!res.ok) {
      cache = [];
      return cache;
    }
    const data = (await res.json()) as { zones?: PmtilesZone[] };
    const list = Array.isArray(data.zones)
      ? data.zones.filter((z) => Boolean(z?.key && z?.file && Array.isArray(z?.bbox)))
      : [];
    const checked = await Promise.all(
      list.map(async (z) => {
        const ok = await fetch(`/data/tiles/${z.file}`, { method: 'HEAD' })
          .then((r) => r.ok)
          .catch(() => false);
        return ok ? z : null;
      }),
    );
    cache = checked
      .filter((z): z is PmtilesZone => z !== null)
      .sort((a, b) => (a.kind === 'world' ? -1 : b.kind === 'world' ? 1 : a.maxzoom - b.maxzoom));
  } catch {
    cache = [];
  }
  return cache;
}

function inside(bbox: [number, number, number, number], lon: number, lat: number): boolean {
  const [w, s, e, n] = bbox;
  return lon >= w && lon <= e && lat >= s && lat <= n;
}

function overlaps(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

const MAX_REGION_TIERS = 5;

export function zonesAt(zones: PmtilesZone[], lon: number, lat: number): PmtilesZone[] {
  const worlds = zones.filter((z) => z.kind === 'world').sort((a, b) => a.maxzoom - b.maxzoom);
  const regions = zones
    .filter((z) => z.kind !== 'world' && inside(z.bbox, lon, lat))
    .sort((a, b) => a.maxzoom - b.maxzoom || b.minzoom - a.minzoom);
  const out = [...worlds, ...regions];
  return out.length ? out : zones.slice(0, 1);
}

export function zonesInBounds(
  zones: PmtilesZone[],
  bounds: [number, number, number, number],
): PmtilesZone[] {
  const worlds = zones.filter((z) => z.kind === 'world').sort((a, b) => a.maxzoom - b.maxzoom);
  const regions = zones
    .filter((z) => z.kind !== 'world' && overlaps(z.bbox, bounds))
    .sort((a, b) => a.maxzoom - b.maxzoom || b.minzoom - a.minzoom);
  const kept = regions.length > MAX_REGION_TIERS ? regions.slice(regions.length - MAX_REGION_TIERS) : regions;
  const out = [...worlds, ...kept];
  return out.length ? out : zones.slice(0, 1);
}

export function tierBands(zones: PmtilesZone[]): Array<{ zone: PmtilesZone; from: number }> {
  const out: Array<{ zone: PmtilesZone; from: number }> = [];
  let from = 0;
  for (const zone of zones) {
    out.push({ zone, from });
    from = zone.maxzoom + 1;
  }
  return out;
}

export function registerPmtiles(): Promise<void> {
  if (!protocol) {
    protocol = (async () => {
      const [{ Protocol }, ml] = await Promise.all([import('pmtiles'), import('maplibre-gl')]);
      const add = ml as unknown as { addProtocol?: unknown; default?: { addProtocol?: unknown } };
      const fn = (add.addProtocol ?? add.default?.addProtocol) as (name: string, handler: unknown) => void;
      fn('pmtiles', new Protocol().tile);
    })();
  }
  return protocol;
}

export function pmtilesUrl(file: string): string {
  return `pmtiles://${location.origin}/data/tiles/${file}`;
}

const baseCache = new Map<string, StyleSpecification>();

export async function loadBaseStyle(zone: PmtilesZone): Promise<StyleSpecification> {
  const hit = baseCache.get(zone.key);
  if (hit) return JSON.parse(JSON.stringify(hit)) as StyleSpecification;
  const candidates = ['base.style.json', zone.style];
  for (const name of candidates) {
    const res = await fetch(`/data/tiles/${name}`, { cache: 'no-cache' }).catch(() => null);
    if (!res || !res.ok) continue;
    let style: StyleSpecification;
    try {
      style = (await res.json()) as StyleSpecification;
    } catch {
      continue;
    }
    if (!Array.isArray(style?.layers)) continue;
    baseCache.set(zone.key, style);
    return JSON.parse(JSON.stringify(style)) as StyleSpecification;
  }
  throw new Error(`底图样式缺失：${zone.style}`);
}

export function tierOf(zone: PmtilesZone, from: number): Tier {
  return {
    id: zone.key === 'world' ? 'world' : `detail_${zone.key}`,
    url: pmtilesUrl(zone.file),
    bounds: zone.bbox,
    minzoom: zone.minzoom,
    maxzoom: zone.maxzoom,
    styleMin: from,
    styleMax: 22,
  };
}

export function tierCaps(bands: Array<{ zone: PmtilesZone; from: number }>, viewBox: [number, number, number, number]): number[] {
  const covers = (zone: PmtilesZone) =>
    zone.bbox[0] <= viewBox[0] &&
    zone.bbox[1] <= viewBox[1] &&
    zone.bbox[2] >= viewBox[2] &&
    zone.bbox[3] >= viewBox[3];
  return bands.map((band, i) => {
    const next = bands[i + 1];
    return next && next.from > band.from && covers(next.zone) ? next.from : 22;
  });
}
