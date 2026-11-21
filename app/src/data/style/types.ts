import type { StyleSpecification } from 'maplibre-gl';
import type { MapLang, ZhNames } from './lang';

export interface FeatureLike {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
}

export interface FC {
  type: 'FeatureCollection';
  features: FeatureLike[];
}

export interface Tier {
  id: string;
  url: string;
  bounds: [number, number, number, number];
  minzoom: number;
  maxzoom: number;
  styleMin: number;
  styleMax: number;
}

export interface SlopeTier {
  styleMax?: number;
  id: string;
  tiles: string;
  minzoom: number;
  maxzoom: number;
  bounds: [number, number, number, number];
  styleMin: number;
}

export interface DemTier {
  ramp?: unknown;
  id: string;
  tiles: string;
  minzoom: number;
  maxzoom: number;
  bounds: [number, number, number, number];
  styleMin: number;
  styleMax: number;
}

export interface StyleInputs {
  base: StyleSpecification;
  tiers: Tier[];
  demTiers?: DemTier[];
  slopeTiers?: SlopeTier[];
  densityTiers?: DensityTier[];
  contours?: FC | null;
  railsLow?: FC | null;
  railsWorldFine?: FC | null;
  railsWorldCoarse?: FC | null;
  urbanWorld?: FC | null;
  seaLabels?: FC | null;
  roadsWorld?: FC | null;
  riversWorld?: FC | null;
  grid?: FC | null;
  poi?: FC | null;
  lang?: MapLang;
  zhNames?: ZhNames | null;
  waterSource?: string;
}

export interface DensityTier {
  id: string;
  tiles: string;
  minzoom: number;
  maxzoom: number;
  bbox: [number, number, number, number];
}
