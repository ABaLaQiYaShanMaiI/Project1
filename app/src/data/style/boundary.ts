import type { Tier } from './types';

const BOUNDARY_LEVELS: Array<{ id: string; filter: unknown; color: string; dash: number[]; w: number[]; minzoom: number }> = [
  {
    id: 'boundary_country',
    filter: ['<=', ['get', 'kind_detail'], 2],
    color: '#5f6670',
    dash: [6, 3],
    w: [2, 0.7, 6, 0.9, 10, 1.4, 16, 2],
    minzoom: 2,
  },
  {
    id: 'boundary_region',
    filter: ['all', ['>', ['get', 'kind_detail'], 2], ['<=', ['get', 'kind_detail'], 8]],
    color: '#6d7a88',
    dash: [4, 3],
    w: [4, 0.4, 8, 0.85, 12, 1.2],
    minzoom: 5,
  },
  {
    id: 'boundary_county',
    filter: ['all', ['>', ['get', 'kind_detail'], 8], ['<=', ['get', 'kind_detail'], 12]],
    color: '#8b96a2',
    dash: [3, 2],
    w: [8, 0.4, 10, 0.7, 14, 1.1],
    minzoom: 8,
  },
  {
    id: 'boundary_muni',
    filter: ['>', ['get', 'kind_detail'], 12],
    color: '#aeb5bd',
    dash: [1, 2],
    w: [11, 0.4, 13, 0.7, 16, 1],
    minzoom: 11,
  },
];

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
        'line-opacity': 0.8,
      },
    });
  }
  return out;
}
