import type { Map as MLMap } from 'maplibre-gl';
import { groupOf } from '../data/style/layerGroups';

const FORCE_GROUPS = new Set<string>(['road', 'minor', 'airport', 'poi']);

export interface ZoomStore {
  epoch: number;
  map: Record<string, [number, number]>;
}

export function applyForceDetail(map: MLMap, force: boolean, epoch: number, store: ZoomStore): void {
  const style = map.getStyle();
  if (!style || !Array.isArray(style.layers) || style.layers.length <= 1) return;
  if (store.epoch !== epoch) {
    store.epoch = epoch;
    store.map = {};
  }
  for (const layer of style.layers) {
    const id = String(layer.id);
    const g = groupOf(id);
    if (!g || !FORCE_GROUPS.has(g)) continue;
    if (!map.getLayer(id)) continue;
    const spec = layer as { minzoom?: number; maxzoom?: number };
    if (!store.map[id]) store.map[id] = [spec.minzoom ?? 0, spec.maxzoom ?? 24];
    const [min, max] = store.map[id];
    try {
      map.setLayerZoomRange(id, force ? 0 : min, max);
    } catch {
      continue;
    }
  }
}
