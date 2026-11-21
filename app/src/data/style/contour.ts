import { CONTOUR_BOLD, CONTOUR_FINE, CONTOUR_LABEL_ALL_HALO, CONTOUR_LABEL_ALL_INK, CONTOUR_LABEL_HALO, CONTOUR_LABEL_INK } from './tokens';
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

export interface ContourBand {
  key: string;
  bbox: [number, number, number, number];
  exclude?: [number, number, number, number];
  minzoom: number;
  maxzoom: number;
  allLabels: boolean;
}

export const CONTOUR_BANDS: ContourBand[] = [
  { key: 'world', bbox: [-180, -85, 180, 85], minzoom: 4, maxzoom: 7, allLabels: false },
  { key: 'world_mid', bbox: [-180, -85, 180, 85], exclude: [0, 44, 20, 56], minzoom: 7, maxzoom: 10, allLabels: false },
  { key: 'asia_himal', bbox: [65, 20, 105, 45], minzoom: 7, maxzoom: 10, allLabels: false },
  { key: 'zagros', bbox: [35, 25, 62, 42], minzoom: 7, maxzoom: 10, allLabels: false },
  { key: 'andes', bbox: [-80, -55, -58, 12], minzoom: 7, maxzoom: 10, allLabels: false },
  { key: 'rockies', bbox: [-130, 25, -100, 55], minzoom: 7, maxzoom: 10, allLabels: false },
  { key: 'africa_rift', bbox: [28, -15, 46, 15], minzoom: 7, maxzoom: 10, allLabels: false },
  { key: 'europe', bbox: [0, 44, 20, 56], minzoom: 7, maxzoom: 10, allLabels: false },
  { key: 'carpathians', bbox: [17, 44, 27, 50], minzoom: 7, maxzoom: 10, allLabels: false },
  { key: 'scandes', bbox: [4, 58, 20, 71], minzoom: 7, maxzoom: 10, allLabels: false },
  { key: 'urals', bbox: [55, 50, 68, 68], minzoom: 7, maxzoom: 10, allLabels: false },
  { key: 'caucasus', bbox: [37, 42, 50, 45], minzoom: 7, maxzoom: 10, allLabels: false },
  { key: 'altai', bbox: [82, 47, 100, 55], minzoom: 7, maxzoom: 10, allLabels: false },
  { key: 'atlas', bbox: [-10, 29, 0, 36], minzoom: 7, maxzoom: 10, allLabels: false },
  { key: 'drakensberg', bbox: [27, -33, 32, -25], minzoom: 7, maxzoom: 10, allLabels: false },
  { key: 'japan_alps', bbox: [135, 34, 142, 38], minzoom: 7, maxzoom: 10, allLabels: false },
  { key: 'mesoamerica', bbox: [-108, 15, -96, 25], minzoom: 7, maxzoom: 10, allLabels: false },
  { key: 'pyrenees', bbox: [-10, 36, 3, 44], minzoom: 7, maxzoom: 10, allLabels: false },
  { key: 'new_guinea', bbox: [131, -11, 151, 1], minzoom: 7, maxzoom: 10, allLabels: false },
  { key: 'madagascar', bbox: [46.1, -26, 51, -12], minzoom: 7, maxzoom: 10, allLabels: false },
  { key: 'new_zealand', bbox: [166, -48, 179, -34], minzoom: 7, maxzoom: 10, allLabels: false },
  { key: 'borneo', bbox: [95, -6, 119, 7], minzoom: 7, maxzoom: 10, allLabels: false },
  { key: 'germany', bbox: [5.8, 47.2, 15.1, 55.1], minzoom: 10, maxzoom: 13, allLabels: false },
  { key: 'fulda', bbox: [8.849, 50.24, 10.591, 51], minzoom: 13, maxzoom: 22, allLabels: true },
];

export const CONTOUR_OPACITY: unknown = ['interpolate', ['linear'], ['zoom'], 5, 0.18, 8, 0.3, 11, 0.5, 14, 0.65];

export function contourBandActive(b: ContourBand, view: [number, number, number, number]): boolean {
  if (!(b.bbox[0] <= view[2] && b.bbox[2] >= view[0] && b.bbox[1] <= view[3] && b.bbox[3] >= view[1])) return false;
  const ex = b.exclude;
  return !(ex && view[0] >= ex[0] && view[1] >= ex[1] && view[2] <= ex[2] && view[3] <= ex[3]);
}

export const CONTOUR_WIDTH: unknown = ['interpolate', ['linear'], ['zoom'], 5, 0.4, 9, 0.65, 13, 1.0];

export const CONTOUR_BOLD_OPACITY: unknown = ['interpolate', ['linear'], ['zoom'], 5, 0.28, 8, 0.45, 11, 0.65, 14, 0.82];

export const CONTOUR_BOLD_WIDTH: unknown = ['interpolate', ['linear'], ['zoom'], 5, 0.7, 9, 1.0, 13, 1.5];

function bandFilter(band: number, bold: number | null): unknown {
  const f: unknown[] = ['all', ['==', ['get', 'band'], band]];
  if (bold !== null) f.push(['==', ['get', 'b'], bold]);
  return f;
}

export function contourLayers(): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  CONTOUR_BANDS.forEach((b, i) => {
    out.push({
      id: `contour-${b.key}`,
      type: 'line',
      source: 'contours',
      filter: bandFilter(i, 0),
      minzoom: b.minzoom,
      maxzoom: b.maxzoom,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': CONTOUR_FINE,
        'line-opacity': CONTOUR_OPACITY,
        'line-width': CONTOUR_WIDTH,
      },
    });
    out.push({
      id: `contour-bold-${b.key}`,
      type: 'line',
      source: 'contours',
      filter: bandFilter(i, 1),
      minzoom: b.minzoom,
      maxzoom: b.maxzoom,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': CONTOUR_BOLD,
        'line-opacity': CONTOUR_BOLD_OPACITY,
        'line-width': CONTOUR_BOLD_WIDTH,
      },
    });
    out.push({
      id: `contour-label-${b.key}`,
      type: 'symbol',
      source: 'contours',
      filter: bandFilter(i, 1),
      minzoom: b.minzoom + 0.5,
      maxzoom: b.maxzoom,
      layout: {
        'text-field': ['to-string', ['get', 'v']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 8, 12, 9.5, 15, 11],
        'symbol-placement': 'line',
        'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 8, 260, 12, 420, 15, 640],
        'text-keep-upright': true,
        'text-padding': 3,
        'text-max-angle': 35,
        'symbol-avoid-edges': false,
      },
      paint: { 'text-color': CONTOUR_LABEL_INK, 'text-halo-color': CONTOUR_LABEL_HALO, 'text-halo-width': 1.6 },
    });
    if (b.allLabels) {
      out.push({
        id: `contour-label-all-${b.key}`,
        type: 'symbol',
        source: 'contours',
        filter: bandFilter(i, null),
        minzoom: b.minzoom + 1,
        maxzoom: b.maxzoom,
        layout: {
          'text-field': ['to-string', ['get', 'v']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 13, 8.5, 15, 10.5],
          'symbol-placement': 'line',
          'symbol-spacing': ['interpolate', ['linear'], ['zoom'], 13, 300, 15, 460],
          'text-keep-upright': true,
          'text-padding': 4,
          'text-max-angle': 30,
        },
        paint: { 'text-color': CONTOUR_LABEL_ALL_INK, 'text-halo-color': CONTOUR_LABEL_ALL_HALO, 'text-halo-width': 1.5 },
      });
    }
  });
  return out;
}

export function contourGeoJson(doc: ContourDoc, band: number): FC {
  const mPerDegLon = doc.mPerDegLon ?? 111320 * Math.cos((doc.origin[1] * Math.PI) / 180);
  const mPerDegLat = doc.mPerDegLat ?? 110540;
  const features = doc.levels.map((lv) => ({
    type: 'Feature' as const,
    properties: { v: lv.v, b: lv.b, band },
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

export function mergeContours(items: Array<{ doc: ContourDoc; band: number }>): FC {
  const features: FC['features'] = [];
  for (const { doc, band } of items) features.push(...contourGeoJson(doc, band).features);
  return { type: 'FeatureCollection', features };
}
