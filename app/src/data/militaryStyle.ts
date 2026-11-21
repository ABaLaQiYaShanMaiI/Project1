import type { StyleSpecification } from 'maplibre-gl';
import { BUILDING_TIER_MINZOOM, HILLSHADE_ACCENT, HILLSHADE_EXAGGERATION, HILLSHADE_HIGHLIGHT, HILLSHADE_SHADOW, PAPER } from './style/tokens';
import { tierLayers } from './style/tier';
import { boundaryLayers } from './style/boundary';
import { railsOf, railLowLayers, railWorldLayers } from './style/rail';
import { contourLayers } from './style/contour';
import { reliefTintLayer } from './style/relief';
import { gridLayers, ringLayers, poiLayers, seaLabelLayers, urbanWorldLayers, waterLabelLayers } from './style/overlay';
import { roadWorldLayers } from './style/road';
import { riverWorldLayers } from './style/water';
import type { StyleInputs } from './style/types';
import { nameField, type MapLang, type ZhNames } from './style/lang';

export type { ContourBand, ContourDoc } from './style/contour';
export { CONTOUR_BANDS, contourBandActive, mergeContours } from './style/contour';
export type { DemTier, FC, SlopeTier, StyleInputs, Tier } from './style/types';

function localizeSymbols(layers: Record<string, unknown>[], lang: MapLang, dict: ZhNames | null): void {
  for (const layer of layers) {
    if (String(layer.type) !== 'symbol') continue;
    const sourceLayer = String(layer['source-layer'] ?? '');
    if (sourceLayer !== 'places' && sourceLayer !== 'water') continue;
    const field = nameField(lang, dict, sourceLayer === 'places' ? 'places' : 'water');
    if (!field) continue;
    layer.layout = { ...(layer.layout as Record<string, unknown> | undefined), 'text-field': field };
  }
}

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
      maxzoom: sl.styleMax ?? 22,
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
    reliefLayers.push(reliefTintLayer(dem));
    reliefLayers.push({
      id: `${dem.id}-relief`,
      type: 'hillshade',
      source: dem.id,
      minzoom: dem.styleMin,
      maxzoom: dem.styleMax,
      paint: {
        'hillshade-exaggeration': HILLSHADE_EXAGGERATION,
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
      attribution: '© OpenStreetMap contributors · Protomaps (ODbL) · Wikidata (CC0)',
    };
  }

  if (inp.railsLow) {
    sources['rails-low'] = { type: 'geojson', data: inp.railsLow };
  }
  if (inp.urbanWorld) {
    sources['urban-world'] = { type: 'geojson', data: inp.urbanWorld };
  }
  if (inp.seaLabels) {
    sources['sea-labels'] = { type: 'geojson', data: inp.seaLabels };
  }
  if (inp.roadsWorld) {
    sources['roads-world'] = { type: 'geojson', data: inp.roadsWorld };
  }
  if (inp.riversWorld) {
    sources['rivers-world'] = { type: 'geojson', data: inp.riversWorld };
  }
  if (inp.railsWorldFine) {
    sources['rails-world-fine'] = { type: 'geojson', data: inp.railsWorldFine };
  }
  if (inp.railsWorldCoarse) {
    sources['rails-world-coarse'] = { type: 'geojson', data: inp.railsWorldCoarse };
  }

  const densityLayers: Record<string, unknown>[] = [];
  for (const dt of inp.densityTiers ?? []) {
    sources[`density-${dt.id}`] = {
      type: 'raster',
      tiles: [dt.tiles],
      tileSize: 256,
      minzoom: dt.minzoom,
      maxzoom: dt.maxzoom,
      bounds: dt.bbox,
    };
    densityLayers.push({
      id: `density-${dt.id}`,
      type: 'raster',
      source: `density-${dt.id}`,
      minzoom: dt.minzoom,
      maxzoom: 17,
      paint: { 'raster-opacity': 0.85, 'raster-resampling': 'linear' },
    });
  }
  if (inp.contours) {
    sources.contours = { type: 'geojson', data: inp.contours };
  }
  sources.grid = { type: 'geojson', data: inp.grid ?? { type: 'FeatureCollection', features: [] } };
  sources.rings = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } };
  sources.poi = { type: 'geojson', data: inp.poi ?? { type: 'FeatureCollection', features: [] } };

  const contours = inp.contours ? contourLayers(inp.contourBandIds) : [];

  let reliefPlaced = false;
  let slopePlaced = false;
  let urbanPlaced = false;
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
      if (!urbanPlaced && inp.urbanWorld && sl === 'landcover') {
        out.push(...urbanWorldLayers());
        urbanPlaced = true;
      }
    }
    if (contours.length && i === last && !inserted) out.push(...contours);
    out.push(...boundaryLayers(tier, suffix));
    out.push(...railsOf(tier, suffix, tier.minzoom >= BUILDING_TIER_MINZOOM ? tier.minzoom + 1 : 0));
  });

  if (inp.railsWorldCoarse) {
    out.push(
      ...railWorldLayers({
        source: 'rails-world-coarse',
        minzoom: 1,
        maxzoom: 3,
        suffix: '__coarse',
        haloMin: 3,
        opacity: ['interpolate', ['linear'], ['zoom'], 1, 0.6, 2.5, 1],
      }),
    );
  }
  if (inp.railsWorldFine) {
    out.push(
      ...railWorldLayers({
        source: 'rails-world-fine',
        minzoom: 3,
        maxzoom: 17,
        suffix: '',
        opacity: 1,
        hatch: true,
      }),
    );
  }
  if (inp.railsLow) out.push(...railLowLayers());

  if (!reliefPlaced && reliefLayers.length) out.push(...reliefLayers);
  if (!urbanPlaced && inp.urbanWorld) out.push(...urbanWorldLayers());
  if (!slopePlaced && slopeLayers.length) out.push(...slopeLayers);
  if (densityLayers.length) out.push(...densityLayers);

  if (inp.seaLabels) out.push(...seaLabelLayers(inp.lang));
  const finest = inp.waterSource ?? inp.tiers[inp.tiers.length - 1]?.id;
  if (finest) out.push(...waterLabelLayers(finest, inp.lang ?? 'local', inp.zhNames ?? null));
  if (inp.roadsWorld) out.push(...roadWorldLayers());
  if (inp.riversWorld) out.push(...riverWorldLayers());
  out.push(...gridLayers(), ...ringLayers(), ...poiLayers());

  const seen = new Set<string>();
  if (inp.lang && inp.lang !== 'local') localizeSymbols(out, inp.lang, inp.zhNames ?? null);
  const deduped = out.filter((layer) => {
    const id = String(layer.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const rankOf = (layer: Record<string, unknown>): number => {
    const type = String(layer.type);
    const id = String(layer.id);
    if (id === 'background') return 0;
    if (type === 'fill' || type === 'raster' || type === 'hillshade' || type === 'color-relief') return 1;
    if (type === 'line') {
      if (id.includes('rail')) return 7.2;
      if (id.startsWith('boundaries')) return 3;
      if (id.startsWith('river')) return 3.5;
      if (id.startsWith('grid')) return 8;
      if (id.startsWith('ring')) return 9;
      if (id.startsWith('contour')) return 7;
      return 4;
    }
    if (type === 'symbol') return id.startsWith('ring') ? 9.5 : 7.5;
    if (type === 'circle') return 10;
    return 11;
  };
  const ordered = deduped
    .map((layer, index) => ({ layer, index, rank: rankOf(layer) }))
    .sort((a, b) => (a.rank === b.rank ? a.index - b.index : a.rank - b.rank))
    .map((entry) => entry.layer);

  style.layers = ordered.filter((layer) => {
    const min = (layer as { minzoom?: number }).minzoom;
    const max = (layer as { maxzoom?: number }).maxzoom;
    return min === undefined || max === undefined || min < max;
  }) as unknown as StyleSpecification['layers'];
  return style;
}
