import type { FC } from './types';

export interface ContourDoc {
  origin: [number, number];
  spanM: [number, number];
  mPerDegLat?: number;
  mPerDegLon?: number;
  interval: number;
  bold: number;
  levels: Array<{ v: number; b: number; l: number[][] }>;
}

export function contourLayers(): Record<string, unknown>[] {
  return [
    {
      id: 'contour',
      type: 'line',
      source: 'contours',
      filter: ['==', ['get', 'b'], 0],
      minzoom: 12,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#b0916c',
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.15, 8, 0.26, 11, 0.45, 14, 0.62],
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 9, 0.65, 13, 1.0],
      },
    },
    {
      id: 'contour-bold',
      type: 'line',
      source: 'contours',
      filter: ['==', ['get', 'b'], 1],
      minzoom: 10.5,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#7a5427',
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.25, 8, 0.42, 11, 0.62, 14, 0.8],
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 9, 1.0, 13, 1.5],
      },
    },
    {
      id: 'contour-label',
      type: 'symbol',
      source: 'contours',
      filter: ['==', ['get', 'b'], 1],
      minzoom: 11,
      layout: {
        'text-field': ['to-string', ['get', 'v']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 9, 8, 12, 9.5, 15, 11],
        'symbol-placement': 'line',
        'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 9, 260, 12, 420, 15, 640],
        'text-keep-upright': true,
        'text-padding': 3,
        'text-max-angle': 35,
        'symbol-avoid-edges': false,
      },
      paint: { 'text-color': '#7a5027', 'text-halo-color': '#f0e9da', 'text-halo-width': 1.6 },
    },
    {
      id: 'contour-label-all',
      type: 'symbol',
      source: 'contours',
      minzoom: 11.5,
      layout: {
        'text-field': ['to-string', ['get', 'v']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 11.5, 8.5, 15, 10.5],
        'symbol-placement': 'line',
        'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 11.5, 300, 15, 460],
        'text-keep-upright': true,
        'text-padding': 4,
        'text-max-angle': 30,
      },
      paint: { 'text-color': '#8a6134', 'text-halo-color': '#f2ecdf', 'text-halo-width': 1.5 },
    },
  ];
}

export function contourGeoJson(doc: ContourDoc, mPerDegLon: number, mPerDegLat: number): FC {
  const features = doc.levels.map((lv) => ({
    type: 'Feature' as const,
    properties: { v: lv.v, b: lv.b },
    geometry: {
      type: 'MultiLineString' as const,
      coordinates: lv.l.map((flat) => {
        const ring: [number, number][] = [];
        for (let i = 0; i < flat.length; i += 2) {
          ring.push([doc.origin[0] + flat[i] / mPerDegLon, doc.origin[1] + flat[i + 1] / mPerDegLat]);
        }
        return ring;
      }),
    },
  }));
  return { type: 'FeatureCollection', features };
}
