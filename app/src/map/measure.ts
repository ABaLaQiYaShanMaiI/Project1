import type { Map as MlMap } from 'maplibre-gl';
import type { DemSampler } from '../data/terrain';

export interface GeoPoint {
  lon: number;
  lat: number;
}

const EARTH_R = 6371008.8;
const SRC = 'measure-line';

export function distanceM(a: GeoPoint, b: GeoPoint): number {
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDeg(a: GeoPoint, b: GeoPoint): number {
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dl = ((b.lon - a.lon) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function toMils(deg: number): number {
  return (deg * 6400) / 360;
}

export function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  if (m < 10000) return `${(m / 1000).toFixed(2)} km`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function fmtBearing(b: number): string {
  const norm = (b + 360) % 360;
  return `${norm.toFixed(0).padStart(3, '0')}°`;
}

export function profile(sampler: DemSampler | null, a: GeoPoint, b: GeoPoint, steps = 64): Array<number | null> {
  if (!sampler) return [];
  const out: Array<number | null> = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    out.push(sampler.elevation(a.lat + (b.lat - a.lat) * t, a.lon + (b.lon - a.lon) * t));
  }
  return out;
}

export function drawMeasureLine(map: MlMap, a: GeoPoint | null, b: GeoPoint | null): void {
  if (!map.getStyle()) return;
  if (!map.getSource(SRC)) {
    map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  }
  if (!map.getLayer('measure-line-glow')) {
    map.addLayer({
      id: 'measure-line-glow',
      type: 'line',
      source: SRC,
      paint: { 'line-color': '#0d0f12', 'line-width': 4.5, 'line-opacity': 0.5 },
    });
  }
  if (!map.getLayer('measure-line-main')) {
    map.addLayer({
      id: 'measure-line-main',
      type: 'line',
      source: SRC,
      paint: { 'line-color': '#e8c169', 'line-width': 1.8, 'line-dasharray': [3, 2] },
    });
  }
  if (!map.getLayer('measure-node')) {
    map.addLayer({
      id: 'measure-node',
      type: 'circle',
      source: SRC,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 4,
        'circle-color': '#e8c169',
        'circle-stroke-color': '#12151a',
        'circle-stroke-width': 1.5,
      },
    });
  }
  const src = map.getSource(SRC) as { setData?: (d: unknown) => void } | undefined;
  if (!src?.setData) return;
  const features: unknown[] = [];
  if (a && b) {
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[a.lon, a.lat], [b.lon, b.lat]] },
      properties: {},
    });
  }
  for (const p of [a, b]) {
    if (!p) continue;
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: {} });
  }
  src.setData({ type: 'FeatureCollection', features });
}
