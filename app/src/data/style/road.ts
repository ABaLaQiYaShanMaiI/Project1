import { MAIN_ROAD_COLORS } from './tokens';

const MAJOR_FILL = MAIN_ROAD_COLORS.trunk[0];
const MAJOR_CASING = MAIN_ROAD_COLORS.trunk[1];
const SECOND_FILL = MAIN_ROAD_COLORS.primary[0];
const SECOND_CASING = MAIN_ROAD_COLORS.primary[1];

export function roadWorldLayers(): Record<string, unknown>[] {
  return [
    {
      id: 'road-world-casing',
      type: 'line',
      source: 'roads-world',
      minzoom: 4,
      maxzoom: 7,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['case', ['==', ['get', 'c'], 1], MAJOR_CASING, SECOND_CASING],
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.7, 6, 1.1, 7, 1.3],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.45, 6, 0.7, 7, 0.5],
      },
    },
    {
      id: 'road-world',
      type: 'line',
      source: 'roads-world',
      minzoom: 4,
      maxzoom: 7,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['case', ['==', ['get', 'c'], 1], MAJOR_FILL, SECOND_FILL],
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 6, 0.75, 7, 0.95],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 6, 0.8, 7, 0.45],
      },
    },
  ];
}
