import { newMarker, type Marker, type Side, type UnitKind } from './core/markers';
import { loadMarkers, saveMarkers } from './data/markerStore';

export type WorldLayerKey = 'relief' | 'contour' | 'road' | 'rail' | 'water' | 'building' | 'label' | 'grid';

export const WORLD_LAYER_ORDER: WorldLayerKey[] = [
  'relief',
  'contour',
  'road',
  'rail',
  'water',
  'building',
  'label',
  'grid',
];

export const WORLD_LAYER_LABEL: Record<WorldLayerKey, string> = {
  relief: '地形晕渲',
  contour: '等高线',
  road: '交通线',
  rail: '铁路',
  water: '水系',
  building: '建筑物',
  label: '地名标注',
  grid: '军用格网',
};

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

  layers: Record<WorldLayerKey, boolean> = {
    relief: true,
    contour: true,
    road: true,
    rail: true,
    water: true,
    building: true,
    label: true,
    grid: true,
  };

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

  setLayer(key: WorldLayerKey, on: boolean): void {
    if (this.layers[key] === on) return;
    this.layers[key] = on;
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
