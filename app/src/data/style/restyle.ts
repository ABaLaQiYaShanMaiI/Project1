import { PAPER, RAIL_INK, MAIN_MINZOOM } from './tokens';
import { zoomWidth, railWidth, railNarrow } from './widths';

const INK = '#2f2a22';
const HALO = '#f3eee1';

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

const MAIN_ROAD_W = 1.2;
const MAIN_MINZOOM_MINOR = 12;

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

export function restyle(layer: Record<string, unknown>): Record<string, unknown> {
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
