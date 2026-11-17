import type { StyleSpecification } from 'maplibre-gl';

const INK = '#2f2a22';
const HALO = '#f3eee1';
const PAPER = '#e9e4d8';

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
}

const MAIN_ROADS = ['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link'];
const ARTERIAL_ROADS = ['secondary', 'secondary_link', 'tertiary', 'tertiary_link'];

const MAIN_ROAD_COLORS: Record<string, [string, string]> = {
  motorway: ['#b4553a', '#8e4530'],
  motorway_link: ['#b4553a', '#8e4530'],
  trunk: ['#bf7a45', '#9c6035'],
  trunk_link: ['#bf7a45', '#9c6035'],
  primary: ['#c49a68', '#a17c50'],
  primary_link: ['#c49a68', '#a17c50'],
};
const RAIL_INK = '#1f1f19';
const RAIL_HALO = '#f2ecdf';
const MAIN_ROAD_W = 1.2;
const MAIN_MINZOOM = 10;
const MAIN_MINZOOM_MINOR = 12;
const URBAN_GREY = '#b9b3a7';
const URBAN_KINDS = [
  'residential',
  'commercial',
  'industrial',
  'retail',
  'railway',
  'hospital',
  'school',
  'kindergarten',
  'university',
  'college',
];
const ARTERIAL_FILL = '#f0e8d8';
const ARTERIAL_CASING = '#cfc6b2';

const FAINT_ROAD = '#cfc7b4';
const FAINT_CASING = '#ded7c6';

const COVER: Record<string, string> = {
  grassland: '#d6dcc0',
  farmland: '#e9e3cf',
  forest: '#bfcdab',
  scrub: '#ccd4b2',
  barren: '#e4dcc4',
  urban_area: '#b9b3a7',
  glacier: '#f4f2ec',
  snow: '#f6f4ee',
};

const LANDUSE: Record<string, string> = {
  park: '#cfdcbd',
  urban_green: '#d2ddc0',
  hospital: '#c9c3b8',
  industrial: '#b0aaa0',
  school: '#c5bfb4',
  kindergarten: '#c5bfb4',
  university: '#c5bfb4',
  college: '#c5bfb4',
  retail: '#bdb7ac',
  beach: '#ece2c8',
  zoo: '#d7ddc3',
  aerodrome: '#d9d4e0',
  airfield: '#d9d4e0',
  runway: '#cfcadb',
  pedestrian: '#e6ddcd',
  pier: '#ded6c6',
  residential: '#c2bcb1',
  commercial: '#b9b3a8',
  railway: '#b5afa4',
  cemetery: '#d3ddc6',
  military: '#d6cdc6',
  native_reserve: '#cfdcc0',
  nature_reserve: '#cfdcc0',
  national_park: '#cfdcc0',
  wetland: '#cdd9c8',
  meadow: '#d8dfc2',
};

interface RoadSpec {
  fill: string;
  casing: string;
  w: number;
}

const ROADS: Record<string, RoadSpec> = {
  highway: { fill: '#b4553a', casing: '#8e4530', w: MAIN_ROAD_W },
  major: { fill: '#bf7a45', casing: '#9c6035', w: MAIN_ROAD_W },
  minor: { fill: '#f4eee1', casing: '#c4bba4', w: 1.3 },
  minor_service: { fill: '#e7e0d0', casing: '#c9c0a8', w: 0.9 },
  link: { fill: '#e7e0d0', casing: '#c9c0a8', w: 1.0 },
  other: { fill: '#ded6c4', casing: '#cbc1aa', w: 0.8 },
  pier: { fill: '#c0b6a2', casing: '#a89d88', w: 1.2 },
  runway: { fill: '#a9a3a0', casing: '#8e8884', w: 2.0 },
  taxiway: { fill: '#bdb7b2', casing: '#a19b96', w: 1.0 },
};

function roadClass(id: string): { cls: string; casing: boolean; tunnel: boolean; bridge: boolean } | null {
  if (!id.startsWith('roads_')) return null;
  const rest = id.slice(6);
  if (rest.startsWith('labels_')) return null;
  const casing = rest.includes('_casing');
  const tunnel = rest.includes('tunnels_');
  const bridge = rest.includes('bridges_');
  const body = rest
    .replace('bridges_', '')
    .replace('tunnels_', '')
    .replace('_casing_late', '')
    .replace('_casing_early', '')
    .replace('_casing', '');
  const cls = body.includes('minor_service') ? 'minor_service' : body;
  return { cls, casing, tunnel, bridge };
}

function zoomWidth(base: number, factor?: unknown): unknown {
  const stops: Array<[number, number]> = [
    [4, base * 0.16],
    [7, base * 0.4],
    [10, base * 0.72],
    [13, base],
    [16, base * 1.8],
    [18, base * 2.8],
  ];
  const out: unknown[] = ['interpolate', ['exponential', 1.5], ['zoom']];
  for (const [z, v] of stops) {
    out.push(z, factor ? ['*', v, factor] : v);
  }
  return out;
}

function restyle(layer: Record<string, unknown>): Record<string, unknown> {
  const rawId = String(layer.id);
  const id = rawId.includes('__') ? rawId.slice(0, rawId.indexOf('__')) : rawId;
  const next = { ...layer } as Record<string, unknown>;
  const paint = { ...(layer.paint as Record<string, unknown> | undefined) } as Record<string, unknown>;
  const layout = { ...(layer.layout as Record<string, unknown> | undefined) } as Record<string, unknown>;
  const sourceLayer = String(layer['source-layer'] ?? '');

  if (id === 'background') {
    paint['background-color'] = PAPER;
  } else if (id === 'earth') {
    paint['fill-color'] = '#e8e2d4';
  } else if (id === 'landcover') {
    const match: unknown[] = ['match', ['get', 'kind']];
    for (const [k, v] of Object.entries(COVER)) match.push(k, v);
    match.push('#dde0cd');
    paint['fill-color'] = match;
    paint['fill-opacity'] = 0.95;
  } else if (sourceLayer === 'landuse') {
    const kind = id.replace('landuse_', '');
    paint['fill-color'] = LANDUSE[kind] ?? '#e2dbcb';
    paint['fill-opacity'] = ['interpolate', ['linear'], ['zoom'], 6, 0.6, 10, 0.9, 13, 0.96];
  } else if (sourceLayer === 'water' && layer.type === 'fill') {
    paint['fill-color'] = '#9cc0d2';
    paint['fill-outline-color'] = '#7fa6bb';
  } else if (sourceLayer === 'water') {
    paint['line-color'] = '#7fa8bd';
    paint['line-width'] = [
      'interpolate',
      ['linear'],
      ['zoom'],
      6,
      ['case', ['==', ['get', 'kind_detail'], 'river'], 0.8, 0.4],
      10,
      ['case', ['==', ['get', 'kind_detail'], 'river'], 1.5, 0.7],
      14,
      ['case', ['==', ['get', 'kind_detail'], 'river'], 2.6, 1.2],
    ];
    paint['line-opacity'] = 0.9;
  } else if (id === 'buildings') {
    paint['fill-color'] = '#9f998f';
    paint['fill-outline-color'] = ['interpolate', ['linear'], ['zoom'], 13, 'rgba(0,0,0,0)', 15, 'rgba(120,110,95,0.4)'];
  } else if (sourceLayer === 'boundaries') {
    const country = id === 'boundaries_country';
    paint['line-color'] = country ? '#7c6c55' : '#a2957f';
    paint['line-width'] = country
      ? ['interpolate', ['linear'], ['zoom'], 2, 0.6, 4, 0.8, 10, 1.4]
      : ['interpolate', ['linear'], ['zoom'], 6, 0.4, 12, 0.9];
    paint['line-dasharray'] = country ? [3, 2] : [4, 3];
  } else if (sourceLayer === 'roads' && layer.type === 'line') {
    const rc = roadClass(id);
    layout['line-join'] = 'round';
    layout['line-cap'] = 'round';
    if (rc && rc.cls === 'rail') {
      paint['line-color'] = RAIL_INK;
      paint['line-width'] = railWidth(3.4, railNarrow());
      paint['line-opacity'] = 1;
      delete paint['line-dasharray'];
      next.minzoom = 11;
    } else if (rc) {
      const key: unknown = ['coalesce', ['get', 'kind_detail'], ['get', 'kind']];
      const isMain: unknown = ['in', key, ['literal', MAIN_ROADS]];
      const isArterial: unknown = ['in', key, ['literal', ARTERIAL_ROADS]];
      const spec = ROADS[rc.cls] ?? ROADS.other;
      const isStrip = rc.cls === 'runway' || rc.cls === 'taxiway' || rc.cls === 'pier';
      const widthFactor: unknown = isStrip
        ? 1
        : rc.cls === 'link'
          ? 0.62
          : ['case', isMain, 1, isArterial, 0.62, 0.4];
      if (isStrip) {
        paint['line-color'] = spec.fill;
        paint['line-width'] = zoomWidth(spec.w);
        paint['line-opacity'] = 0.8;
        if (rc.cls !== 'pier') next.minzoom = 13;
      } else {
        const cmatch: unknown[] = ['match', key];
        const fmatch: unknown[] = ['match', key];
        for (const [kind, [fill, casing]] of Object.entries(MAIN_ROAD_COLORS)) {
          fmatch.push(kind, fill);
          cmatch.push(kind, casing);
        }
        fmatch.push(FAINT_ROAD);
        cmatch.push(FAINT_CASING);
        if (rc.casing) {
          paint['line-color'] = rc.bridge
            ? PAPER
            : ['case', isMain, cmatch, isArterial, ARTERIAL_CASING, FAINT_CASING];
          paint['line-width'] = zoomWidth(rc.bridge ? 2 : 1.7, widthFactor);
          paint['line-opacity'] = ['case', isMain, 0.9, isArterial, 0.5, 0.38];
        } else {
          paint['line-color'] = ['case', isMain, fmatch, isArterial, ARTERIAL_FILL, FAINT_ROAD];
          paint['line-width'] = zoomWidth(MAIN_ROAD_W, widthFactor);
          paint['line-opacity'] = ['case', isMain, 0.9, isArterial, 0.8, 0.55];
        }
      }
      if (rc.tunnel) paint['line-opacity'] = ['case', isMain, 0.4, 0.22];
      if (rc.cls === 'minor' && !isStrip) next.minzoom = MAIN_MINZOOM_MINOR;
      else if (!isStrip && rc.cls !== 'minor_service' && rc.cls !== 'other') next.minzoom = MAIN_MINZOOM;
      if (rc.cls === 'minor_service' || rc.cls === 'other') next.minzoom = 13;
    }
  } else if (sourceLayer === 'places') {
    const size = id === 'places_country' ? 13 : id === 'places_region' ? 11.5 : id === 'places_locality' ? 11.5 : 10.5;
    paint['text-color'] = INK;
    paint['text-halo-color'] = HALO;
    paint['text-halo-width'] = 1.5;
    layout['text-size'] = ['interpolate', ['linear'], ['zoom'], 3, size * 0.8, 10, size * 1.1];
  } else if (sourceLayer === 'roads' && layer.type === 'symbol') {
    paint['text-color'] = '#6b6252';
    paint['text-halo-color'] = '#f6f2e6';
    paint['text-halo-width'] = 1.3;
  } else if (id.startsWith('water_label') || id.startsWith('water_waterway_label')) {
    paint['text-color'] = '#6f8fa0';
    paint['text-halo-color'] = '#eef2f2';
  } else if (id === 'address_label') {
    paint['text-color'] = '#7a7164';
    paint['text-halo-color'] = HALO;
  }

  next.paint = paint;
  if (Object.keys(layout).length) next.layout = layout;
  return next;
}

function clampZoom(layer: Record<string, unknown>, tier: Tier): boolean {
  const own = typeof layer.minzoom === 'number' ? layer.minzoom : 0;
  const ownMax = typeof layer.maxzoom === 'number' ? layer.maxzoom : 24;
  const min = Math.max(own, tier.styleMin);
  const max = Math.min(ownMax, tier.styleMax);
  if (min >= max) return false;
  layer.minzoom = min;
  layer.maxzoom = max;
  return true;
}

function tierLayers(base: StyleSpecification, tier: Tier, suffix: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const raw of base.layers as unknown as Record<string, unknown>[]) {
    if (raw.type === 'background') continue;
    if (raw.id === 'roads_rail') continue;
    if (raw.id === 'boundaries' || raw.id === 'boundaries_country') continue;
    const layer = restyle({ ...raw, id: `${String(raw.id)}${suffix}` });
    if (!clampZoom(layer, tier)) continue;
    layer.source = tier.id;
    out.push(layer);
  }
  const urbanFills: Array<Record<string, unknown>> = [
    {
      id: `landcover_urban${suffix}`,
      type: 'fill',
      source: tier.id,
      'source-layer': 'landcover',
      filter: ['==', ['get', 'kind'], 'urban_area'],
      minzoom: 3,
      maxzoom: tier.styleMax,
      paint: { 'fill-color': URBAN_GREY, 'fill-opacity': 0.9 },
    },
    {
      id: `landuse_residential${suffix}`,
      type: 'fill',
      source: tier.id,
      'source-layer': 'landuse',
      filter: ['in', ['get', 'kind'], ['literal', ['residential', 'commercial', 'retail', 'railway']]],
      minzoom: 8,
      maxzoom: tier.styleMax,
      paint: {
        'fill-color': ['match', ['get', 'kind'], 'residential', '#c2bcb1', 'commercial', '#b9b3a8', 'retail', '#bdb7ac', '#b5afa4'],
        'fill-opacity': 0.92,
      },
    },
  ];
  const lastGround = out.reduce((idx, l, i) => {
    const sl = String(l['source-layer'] ?? '');
    return sl === 'landcover' || sl === 'landuse' ? i : idx;
  }, -1);
  out.splice(lastGround + 1, 0, ...urbanFills);

  out.push({
    id: `buildings_glow${suffix}`,
    type: 'line',
    source: tier.id,
    'source-layer': 'buildings',
    minzoom: 14,
    maxzoom: tier.styleMax,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': '#b6b0a4',
      'line-width': ['interpolate', ['linear'], ['zoom'], 14, 2, 16, 3.2],
      'line-opacity': 0.85,
    },
  });
  out.push({
    id: `landuse_urban_glow${suffix}`,
    type: 'line',
    source: tier.id,
    'source-layer': 'landuse',
    filter: ['in', ['get', 'kind'], ['literal', URBAN_KINDS]],
    minzoom: 10,
    maxzoom: tier.styleMax,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': URBAN_GREY,
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 13, 3.5, 16, 5],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 13, 0.62],
    },
  });
  out.push({
    id: `landuse_military${suffix}`,
    type: 'fill',
    source: tier.id,
    'source-layer': 'landuse',
    filter: ['==', ['get', 'kind'], 'military'],
    minzoom: 8,
    maxzoom: tier.styleMax,
    paint: {
      'fill-color': '#c8b39c',
      'fill-opacity': 0.55,
      'fill-outline-color': '#8a705a',
    },
  });
  out.push({
    id: `aerodrome_mark${suffix}`,
    type: 'line',
    source: tier.id,
    'source-layer': 'landuse',
    filter: ['in', ['get', 'kind'], ['literal', ['aerodrome', 'airfield']]],
    minzoom: 9,
    maxzoom: tier.styleMax,
    paint: {
      'line-color': '#6f6a86',
      'line-width': 1.3,
      'line-dasharray': [2, 2],
    },
  });
  return out;
}


function railWidth(w: number, factor?: unknown): unknown {
  const stops: Array<[number, number]> = [
    [7, w * 0.42],
    [10, w * 0.7],
    [13, w],
    [16, w * 1.25],
    [18, w * 1.45],
  ];
  const out: unknown[] = ['interpolate', ['linear'], ['zoom']];
  for (const [z, v] of stops) out.push(z, factor ? ['*', Number(v.toFixed(3)), factor] : Number(v.toFixed(3)));
  return out;
}

function railNarrow(): unknown {
  return ['case', ['==', ['get', 'kind_detail'], 'narrow_gauge'], 0.6, 1];
}

const BOUNDARY_LEVELS: Array<{ id: string; filter: unknown; color: string; dash: number[]; w: number[]; minzoom: number }> = [
  {
    id: 'boundary_country',
    filter: ['<=', ['get', 'kind_detail'], 2],
    color: '#5f6670',
    dash: [6, 3],
    w: [2, 0.7, 6, 0.9, 10, 1.4, 16, 2],
    minzoom: 2,
  },
  {
    id: 'boundary_region',
    filter: ['all', ['>', ['get', 'kind_detail'], 2], ['<=', ['get', 'kind_detail'], 8]],
    color: '#6d7a88',
    dash: [4, 3],
    w: [4, 0.4, 8, 0.85, 12, 1.2],
    minzoom: 5,
  },
  {
    id: 'boundary_county',
    filter: ['all', ['>', ['get', 'kind_detail'], 8], ['<=', ['get', 'kind_detail'], 12]],
    color: '#8b96a2',
    dash: [3, 2],
    w: [8, 0.4, 10, 0.7, 14, 1.1],
    minzoom: 8,
  },
  {
    id: 'boundary_muni',
    filter: ['>', ['get', 'kind_detail'], 12],
    color: '#aeb5bd',
    dash: [1, 2],
    w: [11, 0.4, 13, 0.7, 16, 1],
    minzoom: 11,
  },
];

function boundaryLayers(tier: Tier, suffix: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const lv of BOUNDARY_LEVELS) {
    const stops: unknown[] = ['interpolate', ['linear'], ['zoom']];
    for (let i = 0; i < lv.w.length; i += 2) stops.push(lv.w[i], lv.w[i + 1]);
    out.push({
      id: `${lv.id}${suffix}`,
      type: 'line',
      source: tier.id,
      'source-layer': 'boundaries',
      filter: lv.filter as never,
      minzoom: Math.max(lv.minzoom, tier.styleMin),
      maxzoom: tier.styleMax,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': lv.color,
        'line-width': stops,
        'line-dasharray': lv.dash,
        'line-opacity': 0.8,
      },
    });
  }
  return out;
}

function railsOf(tier: Tier, suffix: string): Record<string, unknown>[] {
  const rail = restyle({
    id: `roads_rail${suffix}`,
    type: 'line',
    source: tier.id,
    'source-layer': 'roads',
    filter: ['==', ['get', 'kind'], 'rail'],
    layout: { visibility: 'visible' },
    paint: {},
  });
  clampZoom(rail, tier);
  return [
    {
      id: `rail-halo${suffix}`,
      type: 'line',
      source: tier.id,
      'source-layer': 'roads',
      filter: ['==', ['get', 'kind'], 'rail'],
      minzoom: Math.max(tier.styleMin, MAIN_MINZOOM),
      maxzoom: tier.styleMax,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': RAIL_HALO,
        'line-width': railWidth(4.9, railNarrow()),
      },
    },
    rail,
    {
      id: `rail-hatch${suffix}`,
      type: 'line',
      source: tier.id,
      'source-layer': 'roads',
      filter: ['==', ['get', 'kind'], 'rail'],
      minzoom: Math.max(tier.styleMin, MAIN_MINZOOM),
      maxzoom: tier.styleMax,
      layout: { 'line-join': 'round', 'line-cap': 'butt' },
      paint: {
        'line-color': '#f7f4ea',
        'line-width': railWidth(1.0, railNarrow()),
        'line-dasharray': [1.1, 2.1],
      },
    },
  ];
}

export function militaryStyle(inp: StyleInputs): StyleSpecification {
  const style = JSON.parse(JSON.stringify(inp.base)) as StyleSpecification;
  const sources = style.sources as Record<string, unknown>;
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
      paint: { 'raster-opacity': 0.42, 'raster-resampling': 'linear' },
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
        'hillshade-shadow-color': '#7a6444',
        'hillshade-highlight-color': '#fffdf6',
        'hillshade-accent-color': '#a88f6b',
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

  if (inp.contours) {
    sources.contours = { type: 'geojson', data: inp.contours };
    sources.grid = { type: 'geojson', data: inp.grid ?? { type: 'FeatureCollection', features: [] } };
    sources.rings = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } };
  }

  const contourLayers: Record<string, unknown>[] = [];
  if (inp.contours) {
    contourLayers.push(
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
    );
  }

  let reliefPlaced = false;
  const last = inp.tiers.length - 1;
  inp.tiers.forEach((tier, i) => {
    const suffix = i === 0 ? '' : `__${tier.id}`;
    let inserted = false;
    for (const layer of tierLayers(inp.base, tier, suffix)) {
      const sl = String(layer['source-layer']);
      if (contourLayers.length && i === last && !inserted && sl === 'roads') {
        out.push(...contourLayers);
        inserted = true;
      }
      out.push(layer);
      if (!reliefPlaced && sl === 'landcover') {
        out.push(...reliefLayers);
        reliefPlaced = true;
      }
    }
    if (contourLayers.length && i === last && !inserted) out.push(...contourLayers);
    out.push(...boundaryLayers(tier, suffix));
    out.push(...railsOf(tier, suffix));
  });

  if (inp.railsLow) {
    out.push(
      {
        id: 'rail-low-halo',
        type: 'line',
        source: 'rails-low',
        minzoom: 5,
        maxzoom: 11,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': RAIL_HALO, 'line-width': railWidth(5.2) },
      },
      {
        id: 'rail-low',
        type: 'line',
        source: 'rails-low',
        minzoom: 5,
        maxzoom: 11,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': RAIL_INK, 'line-width': railWidth(3.4), 'line-opacity': 1 },
      },
      {
        id: 'rail-low-hatch',
        type: 'line',
        source: 'rails-low',
        minzoom: 5,
        maxzoom: 11,
        layout: { 'line-join': 'round', 'line-cap': 'butt' },
        paint: { 'line-color': '#f7f4ea', 'line-width': railWidth(1.05), 'line-dasharray': [1.1, 2.1] },
      },
    );
  }

  if (!reliefPlaced && reliefLayers.length) out.push(...reliefLayers);
  if (slopeLayers.length) out.push(...slopeLayers);

  if (inp.contours) {
    out.push(
      {
        id: 'grid-minor',
        type: 'line',
        source: 'grid',
        filter: ['==', ['get', 'major'], false],
        paint: { 'line-color': '#4a6b8a', 'line-opacity': 0.34, 'line-width': 0.8 },
      },
      {
        id: 'grid-major',
        type: 'line',
        source: 'grid',
        filter: ['==', ['get', 'major'], true],
        paint: { 'line-color': '#3f5f7d', 'line-opacity': 0.42, 'line-width': 1.1 },
      },
      {
        id: 'ring-line',
        type: 'line',
        source: 'rings',
        paint: {
          'line-color': '#c04227',
          'line-opacity': 0.88,
          'line-width': ['case', ['==', ['%', ['get', 'km'], 50], 0], 1.8, 1.1],
          'line-dasharray': [3, 2],
        },
      },
      {
        id: 'ring-label',
        type: 'symbol',
        source: 'rings',
        layout: {
          'text-field': ['concat', ['to-string', ['get', 'km']], ' km'],
          'text-font': ['Noto Sans Regular'],
          'text-size': 10,
          'symbol-placement': 'line-center',
        },
        paint: { 'text-color': '#8f2f1f', 'text-halo-color': '#f6f0e4', 'text-halo-width': 1.4 },
      },
    );
  }

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

export interface ContourDoc {
  origin: [number, number];
  spanM: [number, number];
  mPerDegLat?: number;
  mPerDegLon?: number;
  interval: number;
  bold: number;
  levels: Array<{ v: number; b: number; l: number[][] }>;
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
