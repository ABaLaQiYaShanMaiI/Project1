import type { StyleSpecification } from 'maplibre-gl';

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
  id: string;
  tiles: string;
  minzoom: number;
  maxzoom: number;
  bounds: [number, number, number, number];
  styleMin: number;
}

export interface DemTier {
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
  contours?: FC | null;
  railsLow?: FC | null;
  grid?: FC | null;
  poi?: FC | null;
}
