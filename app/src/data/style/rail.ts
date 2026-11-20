import { RAIL_HALO, RAIL_INK, RAIL_TICK } from './tokens';
import { restyle } from './restyle';
import { clampZoom } from './tier';
import { railWidth, railNarrow } from './widths';
import type { Tier } from './types';

const RAIL_MINZOOM = 11;
const RAIL_LOW_MINZOOM = 3;
const RAIL_LOW_MAXZOOM = 11;
const RAIL_HATCH_MINZOOM = 9;
const RAIL_HATCH_MAXZOOM = 16;

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
  if (!clampZoom(rail, tier)) return [];
  return [
    {
      id: `rail-halo${suffix}`,
      type: 'line',
      source: tier.id,
      'source-layer': 'roads',
      filter: ['==', ['get', 'kind'], 'rail'],
      minzoom: Math.max(tier.styleMin, RAIL_MINZOOM),
      maxzoom: tier.styleMax,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': RAIL_HALO,
        'line-width': railWidth(5.2, railNarrow()),
      },
    },
    rail,
    {
      id: `rail-hatch${suffix}`,
      type: 'line',
      source: tier.id,
      'source-layer': 'roads',
      filter: ['==', ['get', 'kind'], 'rail'],
      minzoom: Math.max(tier.styleMin, RAIL_MINZOOM),
      maxzoom: Math.min(tier.styleMax, RAIL_HATCH_MAXZOOM),
      layout: { 'line-join': 'round', 'line-cap': 'butt' },
      paint: {
        'line-color': RAIL_TICK,
        'line-width': railWidth(1.05, railNarrow()),
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
      minzoom: RAIL_LOW_MINZOOM,
      maxzoom: RAIL_LOW_MAXZOOM,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': RAIL_HALO, 'line-width': railWidth(5.2) },
    },
    {
      id: 'rail-low',
      type: 'line',
      source: 'rails-low',
      minzoom: RAIL_LOW_MINZOOM,
      maxzoom: RAIL_LOW_MAXZOOM,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': RAIL_INK, 'line-width': railWidth(3.4), 'line-opacity': 1 },
    },
    {
      id: 'rail-low-hatch',
      type: 'line',
      source: 'rails-low',
      minzoom: Math.max(RAIL_LOW_MINZOOM, RAIL_HATCH_MINZOOM),
      maxzoom: Math.min(RAIL_LOW_MAXZOOM, RAIL_HATCH_MAXZOOM),
      layout: { 'line-join': 'round', 'line-cap': 'butt' },
      paint: { 'line-color': RAIL_TICK, 'line-width': railWidth(1.05), 'line-dasharray': [1.1, 2.1] },
    },
  ];
}
export interface WorldRailSpec {
  source: string;
  minzoom: number;
  maxzoom: number;
  suffix: string;
  haloMin?: number;
  opacity?: unknown;
  hatch?: boolean;
}

export function railWorldLayers(s: WorldRailSpec): Record<string, unknown>[] {
  const opacity = s.opacity ?? 1;
  const haloMin = s.haloMin ?? s.minzoom;
  const out: Record<string, unknown>[] = [];
  if (haloMin < s.maxzoom) {
    out.push({
      id: `rail-world-halo${s.suffix}`,
      type: 'line',
      source: s.source,
      minzoom: haloMin,
      maxzoom: s.maxzoom,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': RAIL_HALO, 'line-width': railWidth(5.2), 'line-opacity': opacity },
    });
  }
  out.push({
    id: `rail-world${s.suffix}`,
    type: 'line',
    source: s.source,
    minzoom: s.minzoom,
    maxzoom: s.maxzoom,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': RAIL_INK, 'line-width': railWidth(3.4), 'line-opacity': opacity },
  });
  const hatchMin = Math.max(s.minzoom, RAIL_HATCH_MINZOOM);
  const hatchMax = Math.min(s.maxzoom, RAIL_HATCH_MAXZOOM);
  if (s.hatch && hatchMin < hatchMax) {
    out.push({
      id: `rail-world-hatch${s.suffix}`,
      type: 'line',
      source: s.source,
      minzoom: hatchMin,
      maxzoom: hatchMax,
      layout: { 'line-join': 'round', 'line-cap': 'butt' },
      paint: {
        'line-color': RAIL_TICK,
        'line-width': railWidth(1.05),
        'line-dasharray': [1.1, 2.1],
        'line-opacity': opacity,
      },
    });
  }
  return out;
}