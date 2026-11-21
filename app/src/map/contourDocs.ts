import type { Map as MLMap } from 'maplibre-gl';
import { CONTOUR_BANDS, contourBandActive, mergeContours, type ContourBand, type ContourDoc } from '../data/style/contour';
import type { FC } from '../data/style/types';
import { getJson } from './docLoaders';

const MAX_DOCS = 8;
const MAX_FC = 6;
const docCache = new Map<string, ContourDoc>();
const fcCache = new Map<string, FC | null>();

export function contourBandsIn(
  view: [number, number, number, number],
  zoom = 0,
): Array<{ b: ContourBand; i: number }> {
  return CONTOUR_BANDS.map((b, i) => ({ b, i })).filter(
    ({ b }) => contourBandActive(b, view) && b.minzoom <= zoom + 1 && b.maxzoom >= zoom - 1,
  );
}

export function contourSig(active: Array<{ i: number }>, zoom = 0): string {
  return `${Math.round(zoom)}|${active.map(({ i }) => i).join(',')}`;
}

function remember(cache: Map<string, unknown>, key: string, value: unknown, cap: number): void {
  cache.set(key, value);
  while (cache.size > cap) {
    const first = cache.keys().next().value;
    if (first === undefined) break;
    cache.delete(first);
  }
}

export async function loadContourItems(
  active: Array<{ b: ContourBand; i: number }>,
): Promise<Array<{ doc: ContourDoc; band: number }>> {
  const docs = await Promise.all(
    active.map(async ({ b }) => {
      const hit = docCache.get(b.key);
      if (hit) return hit;
      const doc = await getJson<ContourDoc>(`/data/contours_${b.key}.json`);
      if (doc?.levels?.length) remember(docCache as Map<string, unknown>, b.key, doc, MAX_DOCS);
      return doc;
    }),
  );
  return docs.flatMap((doc, k) => (doc?.levels?.length ? [{ doc, band: active[k].i }] : []));
}

export async function loadContours(active: Array<{ b: ContourBand; i: number }>, zoom = 0): Promise<FC | null> {
  if (!active.length) return null;
  const sig = contourSig(active, zoom);
  if (fcCache.has(sig)) return fcCache.get(sig) ?? null;
  const items = await loadContourItems(active);
  if (!items.length) return null;
  const fc = mergeContours(items);
  if (items.length === active.length) remember(fcCache as Map<string, unknown>, sig, fc, MAX_FC);
  return fc;
}

export function bindContourSync(map: MLMap, sigRef: { current: string }): () => void {
  let busy = false;
  const sync = async () => {
    if (busy) return;
    busy = true;
    try {
      const vb = map.getBounds();
      const view: [number, number, number, number] = [vb.getWest(), vb.getSouth(), vb.getEast(), vb.getNorth()];
      const active = contourBandsIn(view, map.getZoom());
      const sig = contourSig(active, map.getZoom());
      if (sig === sigRef.current) return;
      const items = await loadContourItems(active);
      const src = map.getSource('contours') as { setData?: (d: unknown) => void } | undefined;
      if (!src?.setData) return;
      sigRef.current = sig;
      src.setData(items.length ? mergeContours(items) : { type: 'FeatureCollection', features: [] });
    } finally {
      busy = false;
    }
  };
  map.on('moveend', sync);
  return () => {
    map.off('moveend', sync);
  };
}
