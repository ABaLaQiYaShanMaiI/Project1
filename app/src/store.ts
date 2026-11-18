import { newMarker, type Marker, type Side, type UnitKind } from './core/markers';
import type { CityZone } from './core/cityEffects';
import { loadDamage, saveDamage, type DamageMap } from './data/damageStore';
import { loadMarkers, saveMarkers } from './data/markerStore';

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

export interface StylePreset {
  key: string;
  label: string;
  layers: Partial<Record<LayerKey, boolean>>;
}

export const STYLE_PRESETS: StylePreset[] = [
  { key: 'city', label: '城区图', layers: {} },
  {
    key: 'terrain',
    label: '地形图',
    layers: {
      relief: false,
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
  },
];

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
  tiers: string[];
  minzoom: number;
  maxzoom: number;
  sizeMB: number;
}

export interface Perf {
  fps: number;
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

  layers: Record<LayerKey, boolean> = { ...BASE_LAYERS };
  preset = 'city';

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
    this.perf = { fps };
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
    this.emit();
  }

  applyPreset(key: string): void {
    const p = STYLE_PRESETS.find((x) => x.key === key);
    if (!p) return;
    this.layers = { ...BASE_LAYERS, ...p.layers };
    this.preset = p.key;
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
    this.markers = [...this.markers, newMarker(this.markerKind, this.markerSide, lon, lat)];
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
