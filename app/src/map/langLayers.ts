import type { Map as MLMap, StyleSpecification } from 'maplibre-gl';
import { baseIdOf } from '../data/style/layerGroups';
import { nameField, type MapLang, type ZhNames } from '../data/style/lang';

export function applyLang(
  map: MLMap,
  lang: MapLang,
  dict: ZhNames | null,
  base: StyleSpecification | null,
): void {
  const style = map.getStyle();
  if (!style || !Array.isArray(style.layers)) return;
  const baseText = new Map<string, unknown>();
  if (base) {
    for (const layer of base.layers as unknown as Array<Record<string, unknown>>) {
      const layout = layer.layout as Record<string, unknown> | undefined;
      if (layout && layout['text-field'] !== undefined) baseText.set(String(layer.id), layout['text-field']);
    }
  }
  for (const layer of style.layers as unknown as Array<Record<string, unknown>>) {
    if (String(layer.type) !== 'symbol') continue;
    const sourceLayer = String(layer['source-layer'] ?? '');
    if (sourceLayer !== 'places' && sourceLayer !== 'water') continue;
    const expr = nameField(lang, dict, sourceLayer === 'places' ? 'places' : 'water');
    const value = expr ?? baseText.get(baseIdOf(String(layer.id))) ?? (sourceLayer === 'water' ? ['get', 'name'] : undefined);
    if (value === undefined) continue;
    try {
      map.setLayoutProperty(String(layer.id), 'text-field', value as never);
    } catch {
      continue;
    }
  }
  if (map.getLayer('sea-label')) {
    try {
      map.setLayoutProperty('sea-label', 'text-field', (lang === 'zh' ? ['get', 'z'] : ['get', 'n']) as never);
    } catch {
      return;
    }
  }
}
