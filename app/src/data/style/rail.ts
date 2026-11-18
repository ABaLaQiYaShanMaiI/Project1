import { MAIN_MINZOOM, RAIL_HALO, RAIL_INK } from './tokens';
import { restyle } from './restyle';
import { clampZoom } from './tier';
import { railWidth, railNarrow } from './widths';
import type { Tier } from './types';

export function railsOf(tier: Tier, suffix: string): Record<string, unknown>[] {
  const rail = restyle({
    id: `roads_rail${suffix}`,
    type: 'line',
    source: tier.id,
    'source-layer': 'roads',
    filter: ['==', ['get', 'kind'], 'rail'],
    layout: { visibility: 'visible' },
    paint: {},
  });
  clampZoom(rail, tier);
  return [
    {
      id: `rail-halo${suffix}`,
      type: 'line',
      source: tier.id,
      'source-layer': 'roads',
      filter: ['==', ['get', 'kind'], 'rail'],
      minzoom: Math.max(tier.styleMin, MAIN_MINZOOM),
      maxzoom: tier.styleMax,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': RAIL_HALO,
        'line-width': railWidth(4.9, railNarrow()),
      },
    },
    rail,
    {
      id: `rail-hatch${suffix}`,
      type: 'line',
      source: tier.id,
      'source-layer': 'roads',
      filter: ['==', ['get', 'kind'], 'rail'],
      minzoom: Math.max(tier.styleMin, MAIN_MINZOOM),
      maxzoom: tier.styleMax,
      layout: { 'line-join': 'round', 'line-cap': 'butt' },
      paint: {
        'line-color': '#f7f4ea',
        'line-width': railWidth(1.0, railNarrow()),
        'line-dasharray': [1.1, 2.1],
      },
    },
  ];
}

export function railLowLayers(): Record<string, unknown>[] {
  return [
    {
      id: 'rail-low-halo',
      type: 'line',
      source: 'rails-low',
      minzoom: 5,
      maxzoom: 11,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': RAIL_HALO, 'line-width': railWidth(5.2) },
    },
    {
      id: 'rail-low',
      type: 'line',
      source: 'rails-low',
      minzoom: 5,
      maxzoom: 11,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': RAIL_INK, 'line-width': railWidth(3.4), 'line-opacity': 1 },
    },
    {
      id: 'rail-low-hatch',
      type: 'line',
      source: 'rails-low',
      minzoom: 5,
      maxzoom: 11,
      layout: { 'line-join': 'round', 'line-cap': 'butt' },
      paint: { 'line-color': '#f7f4ea', 'line-width': railWidth(1.05), 'line-dasharray': [1.1, 2.1] },
    },
  ];
}
