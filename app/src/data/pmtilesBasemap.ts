import type { StyleSpecification } from 'maplibre-gl';

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
    const list = Array.isArray(data.zones) ? data.zones.filter((z) => Boolean(z?.key && z?.file)) : [];
    const checked = await Promise.all(
      list.map(async (z) => {
        const ok = await fetch(`/data/tiles/${z.file}`, { method: 'HEAD' })
          .then((r) => r.ok)
          .catch(() => false);
        return ok ? z : null;
      }),
    );
    cache = checked.filter((z): z is PmtilesZone => z !== null);
  } catch {
    cache = [];
  }
  return cache;
}

export function pickZone(zones: PmtilesZone[], lon: number, lat: number): PmtilesZone | null {
  for (const z of zones) {
    const [w, s, e, n] = z.bbox;
    if (lon >= w && lon <= e && lat >= s && lat <= n) return z;
  }
  return zones[0] ?? null;
}

export function registerPmtiles(): Promise<void> {
  if (!protocol) {
    protocol = (async () => {
      const [{ Protocol }, ml] = await Promise.all([import('pmtiles'), import('maplibre-gl')]);
      const add = (ml as unknown as { addProtocol?: unknown; default?: { addProtocol?: unknown } });
      const fn = (add.addProtocol ?? add.default?.addProtocol) as (name: string, handler: unknown) => void;
      fn('pmtiles', new Protocol().tile);
    })();
  }
  return protocol;
}

export async function loadLocalStyle(zone: PmtilesZone): Promise<StyleSpecification> {
  const res = await fetch(`/data/tiles/${zone.style}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`底图样式缺失：${zone.style}`);
  const style = (await res.json()) as StyleSpecification;
  const src = (style.sources as Record<string, { url?: string }>).protomaps;
  if (src) src.url = `pmtiles://${location.origin}/data/tiles/${zone.file}`;
  return style;
}
