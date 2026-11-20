import { BOUNDARY_LEVELS, BOUNDARY_OPACITY } from './tokens';
import type { Tier } from './types';

export function boundaryLayers(tier: Tier, suffix: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const lv of BOUNDARY_LEVELS) {
    const stops: unknown[] = ['interpolate', ['linear'], ['zoom']];
    for (let i = 0; i < lv.w.length; i += 2) stops.push(lv.w[i], lv.w[i + 1]);
    out.push({
      id: `${lv.id}${suffix}`,
      type: 'line',
      source: tier.id,
      'source-layer': 'boundaries',
      filter: lv.filter as never,
      minzoom: Math.max(lv.minzoom, tier.styleMin),
      maxzoom: tier.styleMax,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': lv.color,
        'line-width': stops,
        'line-dasharray': lv.dash,
        'line-opacity': BOUNDARY_OPACITY,
      },
    });
  }
  return out;
}
