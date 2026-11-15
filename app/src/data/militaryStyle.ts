import type { StyleSpecification } from 'maplibre-gl';

const INK = '#2f2a22';
const HALO = '#f3eee1';
const PAPER = '#e9e4d8';
const M_PER_DEG_LAT = 110540;

export interface FeatureLike {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
}

export interface FC {
  type: 'FeatureCollection';
  features: FeatureLike[];
}

export interface DemInfo {
  tiles: string;
  minzoom: number;
  maxzoom: number;
  bbox: [number, number, number, number];
}

export interface StyleInputs {
  base: StyleSpecification;
  dem?: DemInfo | null;
  contours?: FC | null;
  contourLabels?: FC | null;
  grid?: FC | null;
  origin: [number, number];
  mPerDegLon: number;
  bounds: [number, number, number, number];
}

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
  runway: '#cfcadb',
  pedestrian: '#e6ddcd',
  pier: '#ded6c6',
  residential: '#e2dbcb',
  commercial: '#e0d7cd',
  railway: '#d9d2c6',
  cemetery: '#d3ddc6',
  military: '#d6cdc6',
  park_p: '#cfdcbd',
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
  const cls = body.split('_')[0] === 'minor' && body.includes('minor_service') ? 'minor_service' : body;
  return { cls, casing, tunnel, bridge };
}

function zoomWidth(base: number): unknown {
  return [
    'interpolate',
    ['exponential', 1.5],
    ['zoom'],
    4,
    base * 0.16,
    7,
    base * 0.4,
    10,
    base * 0.72,
    13,
    base,
    16,
    base * 1.8,
    18,
    base * 2.8,
  ];
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
    for (const [k, v] of Object.entries(COVER)) {
      match.push(k, v);
    }
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
    paint['line-width'] = country ? ['interpolate', ['linear'], ['zoom'], 4, 0.7, 10, 1.4] : ['interpolate', ['linear'], ['zoom'], 6, 0.4, 12, 0.9];
    paint['line-dasharray'] = country ? [3, 2] : [4, 3];
  } else if (sourceLayer === 'roads' && layer.type === 'line') {
    const rc = roadClass(id);
    if (rc && rc.cls === 'rail') {
      paint['line-color'] = '#3f3f38';
      paint['line-width'] = zoomWidth(1.7);
      delete paint['line-dasharray'];
    } else if (rc) {
      const spec = ROADS[rc.cls] ?? ROADS.other;
      paint['line-color'] = rc.casing ? spec.casing : spec.fill;
      paint['line-width'] = zoomWidth(spec.w + (rc.casing ? 1.1 : 0));
      if (rc.tunnel) paint['line-opacity'] = 0.45;
    }
  } else if (sourceLayer === 'places') {
    const size =
      id === 'places_country'
        ? 13
        : id === 'places_region'
          ? 11.5
          : id === 'places_locality'
            ? 11.5
            : 10.5;
    paint['text-color'] = INK;
    paint['text-halo-color'] = HALO;
    paint['text-halo-width'] = 1.5;
    layout['text-size'] = ['interpolate', ['linear'], ['zoom'], 4, size * 0.82, 10, size * 1.1];
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

function insertBefore(layers: Record<string, unknown>[], id: string, add: Record<string, unknown>[]): void {
  const at = layers.findIndex((l) => String(l.id) === id);
  if (at < 0) layers.push(...add);
  else layers.splice(at, 0, ...add);
}

function insertAfter(layers: Record<string, unknown>[], id: string, add: Record<string, unknown>[]): void {
  let at = -1;
  for (let i = layers.length - 1; i >= 0; i--) {
    if (String(layers[i].id) === id) {
      at = i;
      break;
    }
  }
  if (at < 0) layers.push(...add);
  else layers.splice(at + 1, 0, ...add);
}

export function militaryStyle(inp: StyleInputs): StyleSpecification {
  const style = JSON.parse(JSON.stringify(inp.base)) as StyleSpecification;
  const layers = style.layers as unknown as Record<string, unknown>[];
  const sources = style.sources as Record<string, unknown>;

  style.layers = layers.map(restyle) as unknown as StyleSpecification['layers'];

  const vec = sources.protomaps as Record<string, unknown> | undefined;
  if (vec) {
    vec.bounds = inp.bounds;
    vec.minzoom = 0;
    vec.maxzoom = 14;
  }

  if (inp.dem) {
    sources.dem = {
      type: 'raster-dem',
      tiles: [inp.dem.tiles],
      encoding: 'terrarium',
      tileSize: 256,
      minzoom: inp.dem.minzoom,
      maxzoom: inp.dem.maxzoom,
      bounds: inp.dem.bbox,
      attribution: 'AWS Terrain Tiles（SRTM）',
    };
    insertBefore(style.layers as unknown as Record<string, unknown>[], 'landcover', [
      {
        id: 'relief',
        type: 'hillshade',
        source: 'dem',
        layout: { visibility: 'visible' },
        paint: {
          'hillshade-exaggeration': 0.55,
          'hillshade-illumination-direction': 315,
          'hillshade-shadow-color': '#6b5738',
          'hillshade-highlight-color': '#fffdf6',
          'hillshade-accent-color': '#b09a76',
        },
      },
    ]);
  }

  if (inp.contours) {
    sources.contours = { type: 'geojson', data: inp.contours };
    insertBefore(style.layers as unknown as Record<string, unknown>[], 'roads_runway', [
      {
        id: 'contour',
        type: 'line',
        source: 'contours',
        filter: ['==', ['get', 'b'], 0],
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
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#84552a',
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.35, 8, 0.6, 11, 0.85, 14, 0.95],
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 9, 1.0, 13, 1.5],
        },
      },
    ]);
  }

  if (inp.contourLabels) {
    sources['contour-labels'] = { type: 'geojson', data: inp.contourLabels };
    insertAfter(style.layers as unknown as Record<string, unknown>[], 'contour-bold', [
      {
        id: 'contour-label',
        type: 'symbol',
        source: 'contour-labels',
        minzoom: 8,
        layout: {
          'text-field': ['to-string', ['get', 'v']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 8, 13, 10.5],
          'text-rotate': ['get', 'rot'],
          'text-rotation-alignment': 'map',
          'text-padding': 2,
          'symbol-placement': 'point',
        },
        paint: {
          'text-color': '#7a5027',
          'text-halo-color': '#f0e9da',
          'text-halo-width': 1.6,
        },
      },
    ]);
  }

  insertAfter(style.layers as unknown as Record<string, unknown>[], 'roads_rail', [
    {
      id: 'rail-hatch',
      type: 'line',
      source: 'protomaps',
      'source-layer': 'roads',
      filter: ['==', ['get', 'kind'], 'rail'],
      layout: { visibility: 'visible' },
      paint: {
        'line-color': '#f7f4ea',
        'line-width': zoomWidth(0.95),
        'line-dasharray': [1.6, 2.4],
      },
    },
  ]);

  if (inp.grid) {
    sources.grid = { type: 'geojson', data: inp.grid };
    sources.rings = { type: 'geojson', data: { type: 'FeatureCollection', features: [] } };
    insertBefore(style.layers as unknown as Record<string, unknown>[], 'boundaries_country', [
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
    ]);
  }

  return style;
}

export interface ContourDoc {
  origin: [number, number];
  spanM: [number, number];
  interval: number;
  bold: number;
  levels: Array<{ v: number; b: number; l: number[][] }>;
  labels: number[][];
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

export function labelGeoJson(
  labels: number[][],
  origin: [number, number],
  mPerDegLon: number,
  mPerDegLat: number,
): FC {
  const features = labels.map(([x, y, ang, v]) => {
    let a = ang;
    if (a > 90) a -= 180;
    if (a < -90) a += 180;
    return {
      type: 'Feature' as const,
      properties: { v, rot: -a },
      geometry: { type: 'Point' as const, coordinates: [origin[0] + x / mPerDegLon, origin[1] + y / mPerDegLat] },
    };
  });
  return { type: 'FeatureCollection', features };
}
