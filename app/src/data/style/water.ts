import { WATER_LINE } from './tokens';

const BIG = ['<=', ['get', 'r'], 2] as never;
const MID = ['<=', ['get', 'r'], 5] as never;

export function riverWorldLayers(): Record<string, unknown>[] {
  return [
    {
      id: 'river-world',
      type: 'line',
      source: 'rivers-world',
      minzoom: 3,
      maxzoom: 9,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': WATER_LINE,
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          3,
          ['case', BIG, 1.0, MID, 0.75, 0.55],
          6,
          ['case', BIG, 1.35, MID, 1.0, 0.75],
          8,
          ['case', BIG, 1.65, MID, 1.25, 0.95],
        ],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.55, 6, 0.75, 8, 0.85],
      },
    },
  ];
}
