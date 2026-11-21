import { newMarker, type Marker, type Side, type UnitKind } from './core/markers';
import type { CityZone } from './core/cityEffects';
import { loadDamage, saveDamage, type DamageMap } from './data/damageStore';
import { loadMarkers, saveMarkers } from './data/markerStore';
import { CONTOUR_BOLD_OPACITY, CONTOUR_BOLD_WIDTH, CONTOUR_OPACITY, CONTOUR_WIDTH } from './data/style/contour';
import { BOUNDARY_OPACITY, HILLSHADE_EXAGGERATION, LANDCOVER_FILL_OPACITY, LANDUSE_FILL_OPACITY } from './data/style/tokens';
import { WATER_WIDTH } from './data/style/widths';
import { loadLang, saveLang } from './data/langStore';
import type { MapLang } from './data/style/lang';
import { strings } from './i18n';

export const LAYER_DEFAULT = {
  relief: true,
  contour: true,
  slope: false,
  water: true,
  rail: true,
  road: true,
  minor: true,
  airport: true,
  urban: true,
  building: true,
  label: true,
  boundary: true,
  landcover: true,
  military: false,
  damage: true,
  grid: true,
  rings: false,
  poi: true,
};

export type LayerKey = keyof typeof LAYER_DEFAULT;

const query = typeof location === 'undefined' ? '' : location.search;
const liteFlag = new URLSearchParams(query).get('lite');
const cores = typeof navigator === 'undefined' ? 8 : (navigator.hardwareConcurrency ?? 8);

export const LITE_MODE = liteFlag === '1' || (liteFlag !== '0' && cores <= 4);

export const BASE_LAYERS: Record<LayerKey, boolean> = {
  ...LAYER_DEFAULT,
  ...(LITE_MODE ? { relief: false, contour: false } : {}),
};

function personaLayers(p: Persona): Record<LayerKey, boolean> {
  const base: Record<LayerKey, boolean> = { ...BASE_LAYERS, ...p.layers };
  if (LITE_MODE) {
    base.relief = false;
    base.contour = false;
    base.slope = false;
  }
  return base;
}

export interface PersonaPaint {
  id: string;
  prop: string;
  value: unknown;
}

export interface Persona {
  key: string;
  label: string;
  sub: string;
  layers: Partial<Record<LayerKey, boolean>>;
  paint: PersonaPaint[];
}

export const PERSONAS: Persona[] = [
  {
    key: 'terrain',
    label: '地势·交通图',
    sub: '分层设色 · 坡度 · 等高线 · 铁路与主干公路',
    layers: {
      relief: true,
      contour: true,
      slope: true,
      water: true,
      rail: true,
      road: true,
      minor: false,
      airport: false,
      urban: false,
      building: false,
      label: true,
      boundary: true,
      landcover: false,
      military: false,
      damage: false,
      grid: true,
      rings: false,
      poi: false,
    },
    paint: [
      { id: 'relief-tint', prop: 'color-relief-opacity', value: 0.88 },
      { id: 'contour', prop: 'line-opacity', value: ['interpolate', ['linear'], ['zoom'], 5, 0.35, 8, 0.55, 11, 0.75, 14, 0.9] },
      { id: 'contour', prop: 'line-width', value: ['interpolate', ['linear'], ['zoom'], 5, 0.55, 9, 0.9, 13, 1.25] },
      { id: 'contour-bold', prop: 'line-opacity', value: ['interpolate', ['linear'], ['zoom'], 5, 0.5, 8, 0.75, 11, 0.95, 14, 1] },
      { id: 'contour-bold', prop: 'line-width', value: ['interpolate', ['linear'], ['zoom'], 5, 0.9, 9, 1.3, 13, 1.8] },
      {
        id: 'water',
        prop: 'line-width',
        value: [
          'interpolate',
          ['linear'],
          ['zoom'],
          6,
          ['case', ['==', ['get', 'kind_detail'], 'river'], 1.1, 0.55],
          10,
          ['case', ['==', ['get', 'kind_detail'], 'river'], 2.0, 0.95],
          14,
          ['case', ['==', ['get', 'kind_detail'], 'river'], 3.4, 1.6],
        ],
      },
      { id: 'landcover', prop: 'fill-opacity', value: 0.35 },
      { id: 'landuse', prop: 'fill-opacity', value: 0.35 },
      { id: 'boundary_country', prop: 'line-opacity', value: 0.55 },
      { id: 'boundary_region', prop: 'line-opacity', value: 0.12 },
      { id: 'boundary_county', prop: 'line-opacity', value: 0.12 },
      { id: 'boundary_muni', prop: 'line-opacity', value: 0.12 },
      {
        id: '*',
        prop: 'hillshade-exaggeration',
        value: ['interpolate', ['linear'], ['zoom'], 4, 1.2, 8, 0.98, 12, 0.7, 16, 0.6],
      },
    ],
  },
  {
    key: 'city',
    label: '用地·政区图',
    sub: '用地 · 行政 · 全级路网',
    layers: {
      relief: false,
      contour: false,
      slope: false,
      water: true,
      rail: true,
      road: true,
      minor: true,
      airport: true,
      urban: true,
      building: true,
      label: true,
      boundary: true,
      landcover: true,
      military: false,
      damage: true,
      grid: true,
      rings: false,
      poi: true,
    },
    paint: [
      { id: 'contour', prop: 'line-opacity', value: CONTOUR_OPACITY },
      { id: 'contour', prop: 'line-width', value: CONTOUR_WIDTH },
      { id: 'contour-bold', prop: 'line-opacity', value: CONTOUR_BOLD_OPACITY },
      { id: 'contour-bold', prop: 'line-width', value: CONTOUR_BOLD_WIDTH },
      { id: 'water', prop: 'line-width', value: WATER_WIDTH },
      { id: 'landcover', prop: 'fill-opacity', value: LANDCOVER_FILL_OPACITY },
      { id: 'landuse', prop: 'fill-opacity', value: LANDUSE_FILL_OPACITY },
      { id: 'boundary_country', prop: 'line-opacity', value: BOUNDARY_OPACITY },
      { id: 'boundary_region', prop: 'line-opacity', value: BOUNDARY_OPACITY },
      { id: 'boundary_county', prop: 'line-opacity', value: BOUNDARY_OPACITY },
      { id: 'boundary_muni', prop: 'line-opacity', value: BOUNDARY_OPACITY },
      { id: '*', prop: 'hillshade-exaggeration', value: HILLSHADE_EXAGGERATION },
    ],
  },
];

export function ruleHits(base: string, id: string): boolean {
  if (id === '*') return true;
  return base === id || base.startsWith(`${id}-`) || base.startsWith(`${id}_`);
}

export function propFits(type: string, prop: string): boolean {
  if (prop.startsWith('line-')) return type === 'line';
  if (prop.startsWith('fill-')) return type === 'fill';
  if (prop.startsWith('hillshade-')) return type === 'hillshade';
  if (prop.startsWith('text-')) return type === 'symbol';
  if (prop.startsWith('circle-')) return type === 'circle';
  return true;
}

export interface LayerItem {
  key: LayerKey;
  label: string;
}

export interface LayerGroup {
  key: string;
  label: string;
  items: LayerItem[];
}

export const LAYER_TREE: LayerGroup[] = [
  {
    key: 'terrain',
    label: '地形图',
    items: [
      { key: 'relief', label: '晕渲' },
      { key: 'contour', label: '等高线' },
      { key: 'slope', label: '坡度通行' },
    ],
  },
  {
    key: 'water',
    label: '水系',
    items: [{ key: 'water', label: '水域 · 河流' }],
  },
  {
    key: 'transport',
    label: '交通',
    items: [
      { key: 'rail', label: '铁路' },
      { key: 'road', label: '主干公路' },
      { key: 'minor', label: '次要道路' },
      { key: 'airport', label: '机场 · 跑道' },
    ],
  },
  {
    key: 'settle',
    label: '居民地',
    items: [
      { key: 'urban', label: '城区灰块' },
      { key: 'building', label: '建筑物' },
      { key: 'label', label: '地名标注' },
    ],
  },
  {
    key: 'admin',
    label: '行政',
    items: [{ key: 'boundary', label: '行政边界' }],
  },
  {
    key: 'land',
    label: '地表',
    items: [{ key: 'landcover', label: '林地 · 农田 · 绿地' }],
  },
  {
    key: 'military',
    label: '军事',
    items: [
      { key: 'military', label: '军事用地' },
      { key: 'damage', label: '城区战损' },
    ],
  },
  {
    key: 'tools',
    label: '判读',
    items: [
      { key: 'grid', label: '军用格网' },
      { key: 'rings', label: '射程圈' },
      { key: 'poi', label: '设施气泡' },
    ],
  },
];

export interface BasemapInfo {
  name: string;
  nameEn: string;
  tiers: string[];
  tiersEn: string[];
  minzoom: number;
  maxzoom: number;
  sizeMB: number;
}

export interface Perf {
  fps: number;
}

export function fpsTone(fps: number): 'ok' | 'warn' | 'bad' {
  if (fps >= 48) return 'ok';
  if (fps >= 28) return 'warn';
  return 'bad';
}

class Store {
  loading = true;
  error: string | null = null;

  markers: Marker[] = loadMarkers();
  markerSide: Side = 'nato';
  markerKind: UnitKind = 'infantry';
  placing = false;

  cityZone: CityZone | null = null;
  damage: DamageMap = loadDamage();

  layers: Record<LayerKey, boolean> = personaLayers(PERSONAS[0]);
  preset = PERSONAS[0].key;
  forceDetail = false;
  lang: MapLang = loadLang();
  layerRev = 0;

  basemap: BasemapInfo | null = null;
  perf: Perf = { fps: 60 };

  version = 0;
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = (): number => this.version;

  emit(): void {
    this.version++;
    for (const fn of this.listeners) fn();
  }

  setBasemap(info: BasemapInfo | null): void {
    this.basemap = info;
    this.emit();
  }

  setFps(fps: number): void {
    if (this.perf.fps === fps) return;
    this.perf = { fps };

    this.emit();
  }

  setCityZone(zone: CityZone | null): void {
    const a = this.cityZone;
    if (!a && !zone) return;
    if (a && zone && a.name === zone.name && Math.round(a.weight * 20) === Math.round(zone.weight * 20)) return;
    this.cityZone = zone;
    this.emit();
  }

  setDamage(key: string, r: number, lv: number): void {
    const next: DamageMap = { ...this.damage };
    if (lv <= 0) delete next[key];
    else next[key] = [r, Math.min(3, lv)];
    this.damage = next;
    saveDamage(next);
    this.emit();
  }

  setLayer(key: LayerKey, on: boolean): void {
    if (this.layers[key] === on) return;
    this.layers = { ...this.layers, [key]: on };
    this.preset = 'custom';
    this.layerRev += 1;
    this.emit();
  }

  applyPreset(key: string): void {
    const p = PERSONAS.find((x) => x.key === key);
    if (!p) return;
    this.layers = personaLayers(p);
    this.preset = p.key;
    this.layerRev += 1;
    this.emit();
  }

  setForceDetail(on: boolean): void {
    if (this.forceDetail === on) return;
    this.forceDetail = on;
    this.emit();
  }

  setLang(lang: MapLang): void {
    if (this.lang === lang) return;
    this.lang = lang;
    saveLang(lang);
    this.emit();
  }

  groupOn(group: string): boolean {
    const g = LAYER_TREE.find((x) => x.key === group);
    if (!g) return false;
    return g.items.every((i) => this.layers[i.key]);
  }

  setGroup(group: string, on: boolean): void {
    const g = LAYER_TREE.find((x) => x.key === group);
    if (!g) return;
    const next: Record<LayerKey, boolean> = { ...this.layers };
    for (const i of g.items) next[i.key] = on;
    this.layers = next;
    this.layerRev += 1;
    this.emit();
  }

  setMarkerSide(side: Side): void {
    if (this.markerSide === side) return;
    this.markerSide = side;
    this.emit();
  }

  setMarkerKind(kind: UnitKind): void {
    this.markerKind = kind;
    this.placing = true;
    this.emit();
  }

  cancelPlacing(): void {
    if (!this.placing) return;
    this.placing = false;
    this.emit();
  }

  addMarker(lon: number, lat: number): void {
    this.markers = [
      ...this.markers,
      newMarker(this.markerKind, this.markerSide, lon, lat, strings(this.lang).units[this.markerKind]),
    ];
    saveMarkers(this.markers);
    this.emit();
  }

  moveMarker(id: string, lon: number, lat: number): void {
    let hit = false;
    this.markers = this.markers.map((m) => {
      if (m.id !== id) return m;
      hit = true;
      return { ...m, lon, lat };
    });
    if (!hit) return;
    saveMarkers(this.markers);
    this.emit();
  }

  removeMarker(id: string): void {
    const next = this.markers.filter((m) => m.id !== id);
    if (next.length === this.markers.length) return;
    this.markers = next;
    saveMarkers(this.markers);
    this.emit();
  }

  clearMarkers(): void {
    if (!this.markers.length) return;
    this.markers = [];
    saveMarkers(this.markers);
    this.emit();
  }
}

export const store = new Store();
