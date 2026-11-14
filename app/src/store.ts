import { GameClock, type Speed } from './core/time';
import type { District } from './core/towns';
import type { Scenario, ControlField } from './core/scenario';
import type { MapData, Town } from './core/types';

export type ZoomLevel = 'L0' | 'L1' | 'L2';
export type ViewMode = 'world' | 'theatre';

export type Selection =
  | { kind: 'district'; townId: string; district: District; x: number; y: number }
  | { kind: 'point'; x: number; y: number };

export interface Hover {
  town: Town;
  district: District;
  sx: number;
  sy: number;
}

export interface Perf {
  fps: number;
  drawMs: number;
  rebuildMs: number;
  towns: number;
  segments: number;
}

class Store {
  clock = new GameClock();
  map: MapData | null = null;
  loading = true;
  error: string | null = null;

  mode: ViewMode = 'theatre';
  zoom: ZoomLevel = 'L0';
  hover: Hover | null = null;
  selected: Selection | null = null;

  cursor: { x: number; y: number } | null = null;

  scenario: Scenario | null = null;
  field: ControlField | null = null;
  showControl = true;
  showIntel = true;

  perf: Perf = { fps: 60, drawMs: 0, rebuildMs: 0, towns: 0, segments: 0 };

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

  setSpeed(s: Speed): void {
    this.clock.setSpeed(s);
    this.emit();
  }

  togglePause(): void {
    this.clock.togglePause();
    this.emit();
  }

  setZoom(z: ZoomLevel): void {
    this.zoom = z;
    this.emit();
  }

  setMode(m: ViewMode): void {
    this.mode = m;
    this.emit();
  }

  toggleControl(): void {
    this.showControl = !this.showControl;
    this.emit();
  }

  toggleIntel(): void {
    this.showIntel = !this.showIntel;
    this.emit();
  }

  select(sel: Selection | null): void {
    this.selected = sel;
    this.emit();
  }

  private lastHoverEmit = 0;

  setHover(h: Hover | null): void {
    if (!h) {
      if (this.hover) {
        this.hover = null;
        this.emit();
      }
      return;
    }
    const same = this.hover?.district.key === h.district.key;
    this.hover = h;
    const now = performance.now();
    if (!same || now - this.lastHoverEmit > 60) {
      this.lastHoverEmit = now;
      this.emit();
    }
  }

  setCursor(p: { x: number; y: number } | null): void {
    this.cursor = p;
  }
}

export const store = new Store();
