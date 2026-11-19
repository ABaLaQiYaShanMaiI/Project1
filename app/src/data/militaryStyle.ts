import type { StyleSpecification } from 'maplibre-gl';
import { BUILDING_TIER_MINZOOM, HILLSHADE_ACCENT, HILLSHADE_HIGHLIGHT, HILLSHADE_SHADOW, PAPER } from './style/tokens';
import { tierLayers } from './style/tier';
import { boundaryLayers } from './style/boundary';
import { railsOf, railLowLayers, railLowCoarseLayers, railWorldLayers } from './style/rail';
import { contourLayers } from './style/contour';
import { gridLayers, ringLayers, poiLayers, urbanWorldLayers } from './style/overlay';
import type { StyleInputs } from './style/types';

export type { ContourDoc } from './style/contour';
export { contourGeoJson } from './style/contour';
export type { DemTier, FC, SlopeTier, StyleInputs, Tier } from './style/types';

export function militaryStyle(inp: StyleInputs): StyleSpecification {
  const style = JSON.parse(JSON.stringify(inp.base)) as StyleSpecification;
  const base = style.sources as Record<string, unknown>;
  for (const key of Object.keys(base)) delete base[key];
  const sources = base;
  const out: Record<string, unknown>[] = [
    { id: 'background', type: 'background', paint: { 'background-color': PAPER } },
  ];

  const slopeLayers: Record<string, unknown>[] = [];
  for (const sl of inp.slopeTiers ?? []) {
    sources[`${sl.id}-slope`] = {
      type: 'raster',
      tiles: [sl.tiles],
      tileSize: 256,
      minzoom: sl.minzoom,
      maxzoom: sl.maxzoom,
      bounds: sl.bounds,
    };
    slopeLayers.push({
      id: `slope-${sl.id}`,
      type: 'raster',
      source: `${sl.id}-slope`,
      minzoom: Math.max(sl.styleMin, sl.minzoom),
      maxzoom: 22,
      paint: { 'raster-opacity': 0.85, 'raster-resampling': 'linear' },
    });
  }

  const reliefLayers: Record<string, unknown>[] = [];
  for (const dem of inp.demTiers ?? []) {
    sources[dem.id] = {
      type: 'raster-dem',
      tiles: [dem.tiles],
      encoding: 'terrarium',
      tileSize: 256,
      minzoom: dem.minzoom,
      maxzoom: dem.maxzoom,
      bounds: dem.bounds,
      attribution: 'AWS Terrain Tiles（SRTM）',
    };
    reliefLayers.push({
      id: `${dem.id}-relief`,
      type: 'hillshade',
      source: dem.id,
      minzoom: dem.styleMin,
      maxzoom: dem.styleMax,
      paint: {
        'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 4, 1.05, 8, 0.85, 12, 0.6, 16, 0.52],
        'hillshade-illumination-direction': 315,
        'hillshade-shadow-color': HILLSHADE_SHADOW,
        'hillshade-highlight-color': HILLSHADE_HIGHLIGHT,
        'hillshade-accent-color': HILLSHADE_ACCENT,
      },
    });
  }

  for (const tier of inp.tiers) {
    sources[tier.id] = {
      type: 'vector',
      url: tier.url,
      bounds: tier.bounds,
      minzoom: tier.minzoom,
      maxzoom: tier.maxzoom,
      attribution: '© OpenStreetMap contributors · Protomaps (ODbL)',
    };
  }

  if (inp.railsLow) {
    sources['rails-low'] = { type: 'geojson', data: inp.railsLow };
  }
  if (inp.railsLow2) {
    sources['rails-low2'] = { type: 'geojson', data: inp.railsLow2 };
  }
  if (inp.urbanWorld) {
    sources['urban-world'] = { type: 'geojson', data: inp.urbanWorld };
  }
  if (inp.railsWorld) {
    sources['rails-world'] = { type: 'geojson', data: inp.railsWorld };
  }

  if (inp.contours) {
    sources.contours = { type: 'geojson', data: inp.contours };
  }
  sources.grid = { type: 'geojson', data: inp.grid ?? { type: 'FeatureCollection', features: [] } };
  sources.rings = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } };
  sources.poi = { type: 'geojson', data: inp.poi ?? { type: 'FeatureCollection', features: [] } };

  const contours = inp.contours ? contourLayers() : [];

  let reliefPlaced = false;
  let slopePlaced = false;
  const last = inp.tiers.length - 1;
  inp.tiers.forEach((tier, i) => {
    const suffix = i === 0 ? '' : `__${tier.id}`;
    let inserted = false;
    for (const layer of tierLayers(inp.base, tier, suffix)) {
      const sl = String(layer['source-layer']);
      if (contours.length && i === last && !inserted && sl === 'roads') {
        out.push(...contours);
        inserted = true;
      }
      out.push(layer);
      if (!reliefPlaced && sl === 'landcover') {
        out.push(...reliefLayers);
        reliefPlaced = true;
      }
      if (!slopePlaced && slopeLayers.length && sl === 'landcover') {
        out.push(...slopeLayers);
        slopePlaced = true;
      }
    }
    if (contours.length && i === last && !inserted) out.push(...contours);
    out.push(...boundaryLayers(tier, suffix));
    if (tier.minzoom < BUILDING_TIER_MINZOOM) out.push(...railsOf(tier, suffix));
  });

  if (inp.urbanWorld) out.push(...urbanWorldLayers());
  if (inp.railsWorld) out.push(...railWorldLayers());
  if (inp.railsLow2) out.push(...railLowCoarseLayers());
  if (inp.railsLow) out.push(...railLowLayers());

  if (!reliefPlaced && reliefLayers.length) out.push(...reliefLayers);
  if (!slopePlaced && slopeLayers.length) out.push(...slopeLayers);

  out.push(...gridLayers(), ...ringLayers(), ...poiLayers());

  const seen = new Set<string>();
  const deduped = out.filter((layer) => {
    const id = String(layer.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  style.layers = deduped as unknown as StyleSpecification['layers'];
  return style;
}
