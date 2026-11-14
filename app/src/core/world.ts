export interface WorldMeta {
  name: string;
  projection: 'web-mercator';
  minZoom: number;
  maxZoom: number;
  levels: number[];
  tileSize: number;
  generated: string;
  attribution: string;
  path: string;
  mode: 'tiles' | 'image';
  width?: number;
  height?: number;
  zoom?: number;
}

export interface WorldCity {
  n: string;
  x: number;
  y: number;
  k: number;
  p: number;
}

export interface WorldRoad {
  c: number;
  p: [number, number][];
  b: [number, number, number, number];
}

export interface WorldVectors {
  generated: string;
  attribution: string;
  cities: WorldCity[];
  roads: WorldRoad[];
}

const MERC_MAX_LAT = 85.05112878;

export function clampLat(lat: number): number {
  return Math.max(-MERC_MAX_LAT, Math.min(MERC_MAX_LAT, lat));
}

export function lonToX(lon: number): number {
  return (lon + 180) / 360;
}

export function latToY(lat: number): number {
  const r = (clampLat(lat) * Math.PI) / 180;
  return (1 - Math.log(Math.tan(Math.PI / 4 + r / 2)) / Math.PI) / 2;
}

export function xToLon(x: number): number {
  return x * 360 - 180;
}

export function yToLat(y: number): number {
  const n = Math.PI - 2 * Math.PI * y;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export function pickZoom(scale: number, minZoom: number, maxZoom: number): number {
  const z = Math.ceil(Math.log2(Math.max(scale, 1) / 256));
  return Math.min(maxZoom, Math.max(minZoom, z));
}

export function maxScaleOf(src: { tileSize: number; maxZoom: number }): number {
  return src.tileSize * 2 ** src.maxZoom * 2;
}
