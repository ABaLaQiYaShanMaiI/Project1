import { RAIL_HALO, RAIL_INK, RAIL_TICK } from './tokens';
import { restyle } from './restyle';
import { clampZoom } from './tier';
import { railWidth, railDash, railNarrow, railNarrowDash } from './widths';
import type { Tier } from './types';

const RAIL_MINZOOM = 11;
const RAIL_LOW_MINZOOM = 3;
const RAIL_LOW_MAXZOOM = 11;
const RAIL_HATCH_MINZOOM = 9;
const RAIL_HATCH_MAXZOOM = 16;

const RAIL_FILTER = ['==', ['get', 'kind'], 'rail'] as never;
const RAIL_MAIN_FILTER = [
  'all',
  ['==', ['get', 'kind'], 'rail'],
  ['!=', ['get', 'kind_detail'], 'narrow_gauge'],
] as never;
const RAIL_NARROW_FILTER = [
  'all',
  ['==', ['get', 'kind'], 'rail'],
  ['==', ['get', 'kind_detail'], 'narrow_gauge'],
] as never;

export function railsOf(tier: Tier, suffix: string): Record<string, unknown>[] {
  const rail = restyle({
    id: `roads_rail${suffix}`,
    type: 'line',
    source: tier.id,
    'source-layer': 'roads',
    filter: RAIL_FILTER,
    layout: { visibility: 'visible' },
    paint: {},
  });
  if (!clampZoom(rail, tier)) return [];
  const min = Math.max(tier.styleMin, RAIL_MINZOOM);

  rail.filter = RAIL_MAIN_FILTER;
  return [
    {
      id: `rail-halo${suffix}`,
      type: 'line',
      source: tier.id,
      'source-layer': 'roads',
      filter: RAIL_FILTER,
      minzoom: min,
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
      filter: RAIL_MAIN_FILTER,
      minzoom: min,
      maxzoom: Math.min(tier.styleMax, RAIL_HATCH_MAXZOOM),
      layout: { 'line-join': 'round', 'line-cap': 'butt' },
      paint: {
        'line-color': RAIL_TICK,
        'line-width': railWidth(1.05),
        'line-dasharray': railDash(),
      },
    },
    {
      id: `rail-narrow${suffix}`,
      type: 'line',
      source: tier.id,
      'source-layer': 'roads',
      filter: RAIL_NARROW_FILTER,
      minzoom: min,
      maxzoom: tier.styleMax,
      layout: { 'line-join': 'round', 'line-cap': 'butt' },
      paint: {
        'line-color': RAIL_INK,
        'line-width': railWidth(2.4),
        'line-dasharray': railNarrowDash(),
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
      paint: { 'line-color': RAIL_TICK, 'line-width': railWidth(1.05), 'line-dasharray': railDash() },
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
        'line-dasharray': railDash(),
        'line-opacity': opacity,
      },
    });
  }
  return out;
}