export const PAPER = '#e9e4d8';

export const INK = '#2f2a22';

export const HALO = '#f3eee1';

export const URBAN_GREY = '#b9b3a7';

export const URBAN_KINDS = [
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

export const MAIN_MINZOOM = 7;

export const MAIN_FULL_MINZOOM = 10;

export const ARTERIAL_MINZOOM = 12;

export const BUILDING_TIER_MINZOOM = 14;

export const RAIL_INK = '#1f1f19';

export const RAIL_HALO = '#f2ecdf';

export const RAIL_TICK = '#f7f4ea';

export const MAIN_ROADS = ['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link'];

export const ARTERIAL_ROADS = ['secondary', 'secondary_link', 'tertiary', 'tertiary_link'];

export const MAIN_ROAD_W = 1.2;

export const MAIN_ROAD_COLORS: Record<string, [string, string]> = {
  motorway: ['#b4553a', '#8e4530'],
  motorway_link: ['#b4553a', '#8e4530'],
  trunk: ['#bf7a45', '#9c6035'],
  trunk_link: ['#bf7a45', '#9c6035'],
  primary: ['#c49a68', '#a17c50'],
  primary_link: ['#c49a68', '#a17c50'],
};

export const ARTERIAL_FILL = '#f0e8d8';

export const ARTERIAL_CASING = '#cfc6b2';

export const FAINT_ROAD = '#cfc7b4';

export const FAINT_CASING = '#ded7c6';

export interface RoadSpec {
  fill: string;
  casing: string;
  w: number;
}

export const ROADS: Record<string, RoadSpec> = {
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

export const LANDCOVER: Record<string, string> = {
  grassland: '#d6dcc0',
  farmland: '#e9e3cf',
  forest: '#bfcdab',
  scrub: '#ccd4b2',
  barren: '#e4dcc4',
  urban_area: '#b9b3a7',
  glacier: '#f4f2ec',
  snow: '#f6f4ee',
};

export const LANDCOVER_DEFAULT = '#dde0cd';

export const LANDUSE: Record<string, string> = {
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

export const LANDUSE_DEFAULT = '#e2dbcb';

export const EARTH = '#e8e2d4';

export const WATER_FILL = '#a3bccb';

export const WATER_OUTLINE = '#7fa6bb';

export const WATER_LINE = '#7fa8bd';

export const BUILDING_FILL = '#9f998f';

export const BUILDING_OUTLINE_FADE = ['interpolate', ['linear'], ['zoom'], 13, 'rgba(0,0,0,0)', 15, 'rgba(120,110,95,0.4)'];

export const BASE_BOUNDARY_COUNTRY = '#7c6c55';

export const BASE_BOUNDARY_REGION = '#a2957f';

export const ROAD_LABEL_INK = '#6b6252';

export const ROAD_LABEL_HALO = '#f6f2e6';

export const WATER_LABEL_INK = '#6f8fa0';

export const WATER_LABEL_HALO = '#eef2f2';

export const ADDRESS_LABEL_INK = '#7a7164';

export const BOUNDARY_LEVELS: Array<{ id: string; filter: unknown; color: string; dash: number[]; w: number[]; minzoom: number }> = [
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

export const CONTOUR_FINE = '#9a6b3c';

export const CONTOUR_BOLD = '#7a5427';

export const CONTOUR_LABEL_INK = '#7a5027';

export const CONTOUR_LABEL_HALO = '#f0e9da';

export const CONTOUR_LABEL_ALL_INK = '#8a6134';

export const CONTOUR_LABEL_ALL_HALO = '#f2ecdf';

export const HILLSHADE_SHADOW = '#7a6444';

export const HILLSHADE_HIGHLIGHT = '#fffdf6';

export const HILLSHADE_ACCENT = '#a88f6b';

export const GRID_MINOR = '#4a6b8a';

export const GRID_MAJOR = '#3f5f7d';

export const POI_AIRPORT = '#3f5570';

export const POI_PORT = '#1f6f8b';

export const POI_BRIDGE = '#8a5a3c';

export const POI_STROKE = '#f3eee1';

export const POI_PORT_STROKE = '#eaf2f5';

export const RING_INK = '#c04227';

export const RING_LABEL_INK = '#8f2f1f';

export const RING_LABEL_HALO = '#f6f0e4';

export const BUILDING_GLOW_INK = '#b6b0a4';

export const LANDCOVER_FILL_OPACITY = 0.95;

export const LANDUSE_FILL_OPACITY: unknown = ['interpolate', ['linear'], ['zoom'], 6, 0.6, 10, 0.9, 13, 0.96];

export const BOUNDARY_OPACITY = 0.8;

export const HILLSHADE_EXAGGERATION: unknown = ['interpolate', ['linear'], ['zoom'], 4, 1.1, 8, 0.92, 12, 0.72, 16, 0.62];

const HYPSO_LADDER: Array<[number, string]> = [
  [0, '#9ac98f'],
  [100, '#aed795'],
  [200, '#c2e09a'],
  [300, '#d4e79d'],
  [400, '#e5eaa2'],
  [500, '#f1e8a1'],
  [700, '#f7df97'],
  [900, '#f5d184'],
  [1100, '#f0c173'],
  [1400, '#e8ae65'],
  [1700, '#df9d5f'],
  [2000, '#d58c5b'],
  [2500, '#c77a58'],
  [3000, '#b86d55'],
  [3500, '#a89890'],
  [4000, '#e8e6e2'],
];

function hypsoRamp(stops: number[]): unknown {
  const out: unknown[] = ['step', ['elevation'], HYPSO_LADDER[0][1]];
  for (const s of stops) {
    let color = HYPSO_LADDER[0][1];
    for (const [e, c] of HYPSO_LADDER) if (e <= s) color = c;
    out.push(s, color);
  }
  return out;
}

export const HYPSOMETRIC_RAMP = hypsoRamp([100, 200, 300, 400, 500, 700, 900, 1100, 1400, 1700, 2000, 2500, 3000, 3500, 4000]);

export const HYPSOMETRIC_RAMP_MID = hypsoRamp([250, 500, 750, 1000, 1300, 1600, 2000, 2500, 3000, 3500, 4000]);

export const HYPSOMETRIC_RAMP_COARSE = hypsoRamp([200, 500, 1000, 1500, 2000, 3000, 3500, 4000]);

export const HYPSOMETRIC_OPACITY = 0.8;

export const MILITARY_FILL = '#c8b39c';

export const MILITARY_OUTLINE = '#8a705a';

export const AERODROME_MARK_INK = '#6f6a86';
export const STATION_FILL = '#b05340';
export const STATION_EDGE = '#8d3a2c';
