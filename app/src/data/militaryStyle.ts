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
  grid?: FC | null;
}

const MAIN_ROADS = ['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link'];

const MAIN_FILL: Record<string, string> = {
  motorway: '#c9552f',
  motorway_link: '#c9552f',
  trunk: '#d0803c',
  trunk_link: '#d0803c',
  primary: '#d3a15c',
  primary_link: '#d3a15c',
};

const LINK_ROADS = ['motorway_link', 'trunk_link', 'primary_link'];

const MAIN_CASING: Record<string, string> = {
  motorway: '#8d3a21',
  motorway_link: '#8d3a21',
  trunk: '#a8763c',
  trunk_link: '#a8763c',
  primary: '#b08a4a',
  primary_link: '#b08a4a',
};

const FAINT_ROAD = '#cfc7b4';
const FAINT_CASING = '#ded7c6';

const COVER: Record<string, string> = {
  grassland: '#d6dcc0',
  farmland: '#e9e3cf',
  forest: '#bfcdab',
  scrub: '#ccd4b2',
  barren: '#e4dcc4',
  urban_area: '#ded6c6',
  glacier: '#f4f2ec',
  snow: '#f6f4ee',
};

const LANDUSE: Record<string, string> = {
  park: '#cfdcbd',
  urban_green: '#d2ddc0',
  hospital: '#e6dcd6',
  industrial: '#dcd5da',
  school: '#e5dbd2',
  beach: '#ece2c8',
  zoo: '#d7ddc3',
  aerodrome: '#d9d4e0',
  airfield: '#d9d4e0',
  runway: '#cfcadb',
  pedestrian: '#e6ddcd',
  pier: '#ded6c6',
  residential: '#e2dbcb',
  commercial: '#e0d7cd',
  railway: '#d9d2c6',
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
  highway: { fill: '#c9552f', casing: '#8d3a21', w: 3.1 },
  major: { fill: '#cf9a5e', casing: '#a8763c', w: 1.9 },
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
  const id = String(layer.id);
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
    paint['fill-opacity'] = 0.92;
  } else if (sourceLayer === 'landuse') {
    const kind = id.replace('landuse_', '');
    paint['fill-color'] = LANDUSE[kind] ?? '#e2dbcb';
    paint['fill-opacity'] = ['interpolate', ['linear'], ['zoom'], 6, 0.55, 10, 0.85];
  } else if (sourceLayer === 'water' && layer.type === 'fill') {
    paint['fill-color'] = '#a3bccb';
    paint['fill-outline-color'] = '#8aa7b8';
  } else if (sourceLayer === 'water') {
    paint['line-color'] = '#8fb2c4';
  } else if (id === 'buildings') {
    paint['fill-color'] = '#cbc2b1';
    paint['fill-outline-color'] = ['interpolate', ['linear'], ['zoom'], 13, 'rgba(0,0,0,0)', 15, 'rgba(120,108,88,0.55)'];
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
      paint['line-color'] = '#26261f';
      paint['line-width'] = zoomWidth(2.3);
      paint['line-opacity'] = 1;
      delete paint['line-dasharray'];
      next.minzoom = 7;
    } else if (rc) {
      const key: unknown = ['coalesce', ['get', 'kind_detail'], ['get', 'kind']];
      const isMain: unknown = ['in', key, ['literal', MAIN_ROADS]];
      const isLink: unknown = ['in', key, ['literal', LINK_ROADS]];
      const slighten: unknown = ['case', isMain, ['case', isLink, 0.82, 1], 0.45];
      const spec = ROADS[rc.cls] ?? ROADS.other;
      const linkWidth =
        rc.cls === 'link'
          ? ROADS.highway.w
          : spec.w;
      const widthFactor: unknown =
        rc.cls === 'link'
          ? ['match', key, 'motorway_link', 0.86, 'trunk_link', 0.78, 'primary_link', 0.7, 0.34]
          : slighten;
      if (rc.casing) {
        const cmatch: unknown[] = ['match', key];
        for (const [k, v] of Object.entries(MAIN_CASING)) cmatch.push(k, v);
        cmatch.push(FAINT_CASING);
        paint['line-color'] = rc.bridge ? PAPER : ['case', isMain, cmatch, FAINT_CASING];
        paint['line-width'] = zoomWidth(linkWidth + (rc.bridge ? 2.1 : 1.1), widthFactor);
        paint['line-opacity'] = ['case', isMain, 1, 0.42];
      } else {
        const match: unknown[] = ['match', key];
        for (const [k, v] of Object.entries(MAIN_FILL)) match.push(k, v);
        match.push(FAINT_ROAD);
        paint['line-color'] = ['case', isMain, match, FAINT_ROAD];
        paint['line-width'] = zoomWidth(linkWidth, widthFactor);
        paint['line-opacity'] = ['case', isMain, 1, 0.62];
      }
      if (rc.tunnel) paint['line-opacity'] = ['case', isMain, 0.45, 0.26];
      if (rc.cls === 'minor_service' || rc.cls === 'other') {
        next.minzoom = 13;
      }
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
    const layer = restyle({ ...raw, id: `${String(raw.id)}${suffix}` });
    if (!clampZoom(layer, tier)) continue;
    layer.source = tier.id;
    out.push(layer);
  }
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
    rail,
    {
      id: `rail-hatch${suffix}`,
      type: 'line',
      source: tier.id,
      'source-layer': 'roads',
      filter: ['==', ['get', 'kind'], 'rail'],
      minzoom: tier.styleMin,
      maxzoom: tier.styleMax,
      paint: {
        'line-color': '#f7f4ea',
        'line-width': zoomWidth(2.3, ['case', ['==', ['get', 'kind_detail'], 'narrow_gauge'], 0.5, 1]),
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
        'hillshade-exaggeration': 0.55,
        'hillshade-illumination-direction': 315,
        'hillshade-shadow-color': '#6b5738',
        'hillshade-highlight-color': '#fffdf6',
        'hillshade-accent-color': '#b09a76',
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
        minzoom: 8,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#9a6b3c',
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.2, 8, 0.38, 11, 0.55, 14, 0.64],
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 9, 0.65, 13, 1.0],
        },
      },
      {
        id: 'contour-bold',
        type: 'line',
        source: 'contours',
        filter: ['==', ['get', 'b'], 1],
        minzoom: 8,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#84552a',
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.35, 8, 0.6, 11, 0.85, 14, 0.95],
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 9, 1.0, 13, 1.5],
        },
      },
      {
        id: 'contour-label',
        type: 'symbol',
        source: 'contours',
        filter: ['==', ['get', 'b'], 1],
        minzoom: 9,
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
  inp.tiers.forEach((tier, i) => {
    const suffix = i === 0 ? '' : `__${tier.id}`;
    let inserted = false;
    for (const layer of tierLayers(inp.base, tier, suffix)) {
      out.push(layer);
      if (!reliefPlaced && String(layer['source-layer']) === 'landcover') {
        out.push(...reliefLayers);
        reliefPlaced = true;
      }
      if (!inserted && contourLayers.length && String(layer['source-layer']) === 'roads') {
        out.push(...contourLayers);
        inserted = true;
      }
    }
    if (!inserted && contourLayers.length && i === inp.tiers.length - 1) out.push(...contourLayers);
    out.push(...railsOf(tier, suffix));
  });

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
