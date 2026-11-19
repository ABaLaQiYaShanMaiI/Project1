import type { StyleSpecification } from 'maplibre-gl';
import { AERODROME_MARK_INK, BUILDING_GLOW_INK, LANDUSE, MILITARY_FILL, MILITARY_OUTLINE, URBAN_GREY, URBAN_KINDS } from './tokens';
import { restyle } from './restyle';
import type { Tier } from './types';

export function clampZoom(layer: Record<string, unknown>, tier: Tier): boolean {
  const own = typeof layer.minzoom === 'number' ? layer.minzoom : 0;
  const ownMax = typeof layer.maxzoom === 'number' ? layer.maxzoom : 24;
  const min = Math.max(own, tier.styleMin);
  const max = Math.min(ownMax, tier.styleMax);
  if (min >= max) return false;
  layer.minzoom = min;
  layer.maxzoom = max;
  return true;
}

export function tierLayers(base: StyleSpecification, tier: Tier, suffix: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const raw of base.layers as unknown as Record<string, unknown>[]) {
    if (raw.type === 'background') continue;
    if (raw.id === 'roads_rail') continue;
    if (raw.id === 'boundaries' || raw.id === 'boundaries_country') continue;
    const layer = restyle({ ...raw, id: `${String(raw.id)}${suffix}` });
    if (!clampZoom(layer, tier)) continue;
    layer.source = tier.id;
    out.push(layer);
  }
  const urbanFills: Array<Record<string, unknown>> = [
    {
      id: `landcover_urban${suffix}`,
      type: 'fill',
      source: tier.id,
      'source-layer': 'landcover',
      filter: ['==', ['get', 'kind'], 'urban_area'],
      minzoom: 3,
      maxzoom: tier.styleMax,
      paint: { 'fill-color': URBAN_GREY, 'fill-opacity': 0.9 },
    },
    {
      id: `landuse_residential${suffix}`,
      type: 'fill',
      source: tier.id,
      'source-layer': 'landuse',
      filter: ['in', ['get', 'kind'], ['literal', ['residential', 'commercial', 'retail', 'railway']]],
      minzoom: 8,
      maxzoom: tier.styleMax,
      paint: {
        'fill-color': ['match', ['get', 'kind'], 'residential', LANDUSE.residential, 'commercial', LANDUSE.commercial, 'retail', LANDUSE.retail, LANDUSE.railway],
        'fill-opacity': 0.92,
      },
    },
  ];
  const lastGround = out.reduce((idx, l, i) => {
    const sl = String(l['source-layer'] ?? '');
    return sl === 'landcover' || sl === 'landuse' ? i : idx;
  }, -1);
  out.splice(lastGround + 1, 0, ...urbanFills, {
    id: `landuse_urban_glow${suffix}`,
    type: 'line',
    source: tier.id,
    'source-layer': 'landuse',
    filter: ['in', ['get', 'kind'], ['literal', URBAN_KINDS]],
    minzoom: 10,
    maxzoom: tier.styleMax,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': URBAN_GREY,
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 13, 3.5, 16, 5],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 13, 0.62],
    },
  }, {
    id: `buildings_glow${suffix}`,
    type: 'line',
    source: tier.id,
    'source-layer': 'buildings',
    minzoom: 14,
    maxzoom: tier.styleMax,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': BUILDING_GLOW_INK,
      'line-width': ['interpolate', ['linear'], ['zoom'], 14, 2, 16, 3.2],
      'line-opacity': 0.85,
    },
  });

  out.push({
    id: `landuse_military${suffix}`,
    type: 'fill',
    source: tier.id,
    'source-layer': 'landuse',
    filter: ['==', ['get', 'kind'], 'military'],
    minzoom: 8,
    maxzoom: tier.styleMax,
    paint: {
      'fill-color': MILITARY_FILL,
      'fill-opacity': 0.55,
      'fill-outline-color': MILITARY_OUTLINE,
    },
  });
  out.push({
    id: `aerodrome_mark${suffix}`,
    type: 'line',
    source: tier.id,
    'source-layer': 'landuse',
    filter: ['in', ['get', 'kind'], ['literal', ['aerodrome', 'airfield']]],
    minzoom: 9,
    maxzoom: tier.styleMax,
    paint: {
      'line-color': AERODROME_MARK_INK,
      'line-width': 1.3,
      'line-dasharray': [2, 2],
    },
  });
  return out;
}
