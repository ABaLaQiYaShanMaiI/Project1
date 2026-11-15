export interface Raster {
  cols: number;
  rows: number;

  values: number[];
}

export interface UrbanMask {
  file: string;
  cols: number;
  rows: number;
}

export interface MapMeta {
  name: string;
  generated: string;
  center: [number, number];
  projection: { lon0: number; lat0: number; mPerDegLon: number; mPerDegLat: number };

  spanM: [number, number];
  bbox: { south: number; north: number; west: number; east: number };
  dem: Raster;

  landcover: Raster;
  urbanMask: UrbanMask;
  attribution: string;
  sources: string[];
}

export type Pt = [number, number];

export type RoadClass = 'motorway' | 'trunk' | 'primary' | 'secondary';

export interface RoadLine {
  c: string;
  p: Pt[];
}
export interface Poly {
  p: Pt[];
}

export interface City {
  n: string;
  r: 'city' | 'town' | 'village' | string;
  x: number;
  y: number;
  pop: number;

  rad: number;
}

export interface Satellite {
  n: string;
  x: number;
  y: number;
  r: number;
  d: number;
}

export interface DistrictData {
  label: string;
  shape: 'core' | 'wedge' | 'band' | 'poly';
  r0: number;
  r1: number;
  a0: number;
  a1: number;
  t0: number;
  t1: number;
  area: number;
  frontage: number;
  defense: number;
  cp?: [number, number];
  poly?: [number, number][];
  builtRatio?: number;
  roadKm?: number;
  value?: number;
}

export interface Town {
  id: string;
  n: string;
  x: number;
  y: number;
  r: number;
  coreR: number;
  kind: 'parcel' | 'radial' | 'band' | 'poly';
  axis: [number, number];
  box: [number, number, number, number];
  elong: number;
  area: number;
  pop: number;
  districts: DistrictData[];
}

export interface MapData {
  meta: MapMeta;
  roads: RoadLine[];
  rivers: Poly[];
  water: Poly[];
  cities: City[];
  towns: Town[];
}

export const COVER_LABEL: Record<number, string> = {
  0: '开阔地 / 农田',
  1: '林地',
  2: '建成区',
  3: '水域',
};
