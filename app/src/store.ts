import { GameClock, type Speed } from './core/time';
import type { District } from './core/towns';
import type { Scenario, ControlField } from './core/scenario';
import type { MapData, Town } from './core/types';
import { newMarker, type Marker, type Side, type UnitKind } from './core/markers';
import {
  countTree,
  descendantsOf,
  ECHELON_CHILD,
  ECHELON_COST,
  ECHELON_FANOUT,
  ECHELON_LABEL,
  ECHELON_OFFSET_M,
  newUnit,
  rootCost,
  type Echelon,
  type Posture,
  type Unit,
} from './core/units';
import { childSlots, platoonCap, slotPoint, urbanIndex, type DistrictRef } from './core/urban';
import { issueOrder, releasePinned, stepOrders, ORDER_LABEL, type OrderType } from './core/orders';
import { loadMarkers, saveMarkers } from './data/markerStore';
import { loadUnits, saveUnits } from './data/unitStore';

export type ZoomLevel = 'L0' | 'L1' | 'L2';
export type ViewMode = 'world' | 'theatre';
export type LayerKey =
  | 'showTerrain'
  | 'showContours'
  | 'showHydro'
  | 'showRoads'
  | 'showBlocks'
  | 'showLabels'
  | 'showUnits';

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
  onlineBasemap = false;
  showTerrain = true;
  showContours = true;
  showHydro = true;
  showRoads = true;
  showBlocks = true;
  showLabels = true;

  perf: Perf = { fps: 60, drawMs: 0, rebuildMs: 0, towns: 0, segments: 0 };

  markers: Marker[] = loadMarkers();
  markerSide: Side = 'nato';
  markerKind: UnitKind = 'infantry';
  markerEchelon: Echelon = 'platoon';
  placing = false;

  units: Unit[] = loadUnits();
  selectedPlatoon: string | null = null;
  hoverPlatoon: string | null = null;
  posture: Posture = 'hold';
  showUnits = true;
  orderMode: OrderType | null = null;
  battleLog: string[] = [];
  lastPlacement: { key: string; over: boolean; count: number; cap: number } | null = null;
  private saveClock = 0;

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

  toggleBasemap(): void {
    this.onlineBasemap = !this.onlineBasemap;
    this.emit();
  }

  setBasemap(v: boolean): void {
    if (this.onlineBasemap === v) return;
    this.onlineBasemap = v;
    this.emit();
  }

  setLayer(key: LayerKey, v: boolean): void {
    if (this[key] === v) return;
    this[key] = v;
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
    this.selectedPlatoon = null;
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

  renameMarker(id: string, label: string): void {
    this.markers = this.markers.map((m) => (m.id === id ? { ...m, label } : m));
    saveMarkers(this.markers);
    this.emit();
  }

  select(sel: Selection | null): void {
    this.selected = sel;
    if (sel) this.selectedPlatoon = null;
    this.emit();
  }

  setPosture(p: Posture): void {
    this.posture = p;
    if (this.selectedPlatoon) {
      const id = this.selectedPlatoon;
      const sub = new Set([id, ...descendantsOf(this.units, id).map((u) => u.id)]);
      this.units = this.units.map((u) => (sub.has(u.id) ? { ...u, posture: p } : u));
      saveUnits(this.units);
    }
    this.emit();
  }

  setEchelon(e: Echelon): void {
    this.markerEchelon = e;
    this.placing = true;
    this.selectedPlatoon = null;
    this.emit();
  }

  selectPlatoon(id: string | null): void {
    this.selectedPlatoon = id;
    if (id) {
      this.selected = null;
      const u = this.units.find((x) => x.id === id);
      if (u) this.posture = u.posture;
    }
    this.emit();
  }

  districtOccupancy(key: string): number {
    return rootCost(this.units.filter((u) => u.districtKey === key));
  }

  placementAt(districtKey: string): { over: boolean; count: number; cap: number } | null {
    const map = this.map;
    if (!map) return null;
    const ref = urbanIndex(map.towns).byKey.get(districtKey);
    if (!ref) return null;
    const cap = platoonCap(ref.district);
    const count = this.districtOccupancy(districtKey);
    return { over: count > cap, count, cap };
  }

  private spawnTree(ref: DistrictRef, parent: Unit | null, echelon: Echelon, x: number, y: number): Unit[] {
    const node = newUnit(
      this.markerKind,
      this.markerSide,
      echelon,
      ref.town.id,
      ref.key,
      x,
      y,
      parent ? parent.id : null,
      this.posture,
    );
    const out: Unit[] = [node];
    const child = ECHELON_CHILD[echelon];
    if (!child) return out;
    const slots = childSlots(ref.town, ref.district, x, y, ECHELON_FANOUT[echelon], ECHELON_OFFSET_M[echelon]);
    for (const [cx, cy] of slots) {
      out.push(...this.spawnTree(ref, node, child, cx, cy));
    }
    return out;
  }

  addPlatoonTo(ref: DistrictRef): Unit | null {
    const cap = platoonCap(ref.district);
    const before = this.districtOccupancy(ref.key);
    const slot = Math.round(before / Math.max(0.34, ECHELON_COST[this.markerEchelon]));
    const [x, y] = slotPoint(ref.town, ref.district, slot);
    const tree = this.spawnTree(ref, null, this.markerEchelon, x, y);
    this.units = [...this.units, ...tree];
    saveUnits(this.units);
    this.selectedPlatoon = tree[0].id;
    this.selected = null;
    this.placing = false;
    const after = before + ECHELON_COST[this.markerEchelon];
    this.lastPlacement = { key: ref.key, over: after > cap, count: after, cap };
    this.emit();
    return tree[0];
  }

  moveUnit(id: string, ref: DistrictRef): void {
    const root = this.units.find((u) => u.id === id);
    if (!root) return;
    const cap = platoonCap(ref.district);
    const before = this.districtOccupancy(ref.key);
    const [x, y] = slotPoint(ref.town, ref.district, Math.round(before));
    const moved = new Set([id, ...descendantsOf(this.units, id).map((u) => u.id)]);
    const placed = new Map<string, [number, number]>();
    placed.set(id, [x, y]);
    const walk = (nodeId: string, nx: number, ny: number): void => {
      const node = this.units.find((u) => u.id === nodeId);
      if (!node) return;
      const child = ECHELON_CHILD[node.echelon];
      if (!child) return;
      const kids = this.units.filter((u) => u.parentId === nodeId);
      kids.forEach((kid, i) => {
        const slots = childSlots(ref.town, ref.district, nx, ny, ECHELON_FANOUT[node.echelon], ECHELON_OFFSET_M[node.echelon]);
        const [cx, cy] = slots[i] ?? [nx, ny];
        placed.set(kid.id, [cx, cy]);
        walk(kid.id, cx, cy);
      });
    };
    walk(id, x, y);
    this.units = this.units.map((u) => {
      if (!moved.has(u.id)) return u;
      const pos = placed.get(u.id) ?? [x, y];
      return { ...u, townId: ref.town.id, districtKey: ref.key, x: pos[0], y: pos[1] };
    });
    saveUnits(this.units);
    const after = before + (root.echelon === 'company' ? 0 : ECHELON_COST[root.echelon]);
    this.lastPlacement = { key: ref.key, over: after > cap, count: after, cap };
    this.emit();
  }

  movePlatoon(id: string, ref: DistrictRef): void {
    this.moveUnit(id, ref);
  }

  countsOf(id: string): { company: number; platoon: number; squad: number } {
    return countTree(this.units, id);
  }

  removePlatoon(id: string): void {
    const gone = new Set([id, ...descendantsOf(this.units, id).map((u) => u.id)]);
    const next = this.units.filter((u) => !gone.has(u.id));
    if (next.length === this.units.length) return;
    this.units = next;
    if (this.selectedPlatoon && gone.has(this.selectedPlatoon)) this.selectedPlatoon = null;
    saveUnits(this.units);
    this.emit();
  }

  clearPlatoons(): void {
    if (!this.units.length) return;
    this.units = [];
    this.selectedPlatoon = null;
    saveUnits(this.units);
    this.emit();
  }

  toggleUnits(): void {
    this.showUnits = !this.showUnits;
    this.emit();
  }

  echelonLabel(e: Echelon): string {
    return ECHELON_LABEL[e];
  }

  setOrderMode(t: OrderType | null): void {
    this.orderMode = this.orderMode === t ? null : t;
    this.emit();
  }

  private log(line: string): void {
    this.battleLog = [line, ...this.battleLog].slice(0, 6);
  }

  issueOrder(type: OrderType, ref?: DistrictRef): void {
    const id = this.selectedPlatoon;
    if (!id) return;
    const res = issueOrder(this.units, id, type, { ref, now: this.clock.minutes, pinned: true });
    this.units = res.units;
    saveUnits(this.units);
    const u = this.units.find((x) => x.id === id);
    const where = ref ? ` → ${ref.town.n}·${ref.district.label}` : '';
    this.log(`${this.clock.label}　${u ? u.label : id} 下达「${ORDER_LABEL[type]}」${where}（含下级）`);
    this.orderMode = null;
    this.emit();
  }

  releasePinnedOrders(): void {
    const id = this.selectedPlatoon;
    if (!id) return;
    this.units = releasePinned(this.units, id);
    saveUnits(this.units);
    this.log(`${this.clock.label}　下级解除单独指令，回归上级编成`);
    this.emit();
  }

  stepOrders(dtMin: number): void {
    if (!this.map || !dtMin) return;
    const idx = urbanIndex(this.map.towns);
    const res = stepOrders(this.units, idx, dtMin, this.clock.minutes);
    if (!res.units.length && !this.units.length) return;
    const changed =
      res.killed.length > 0 ||
      res.arrived > 0 ||
      res.units.some((u) => {
        const old = this.units.find((o) => o.id === u.id);
        return !old || old.x !== u.x || old.y !== u.y || old.strength !== u.strength || old.order !== u.order;
      });
    if (!changed) return;
    if (res.killed.length) {
      this.log(`${this.clock.label}　${res.killed.length} 个兵牌被歼灭`);
      if (this.selectedPlatoon && res.killed.includes(this.selectedPlatoon)) this.selectedPlatoon = null;
    }
    this.units = res.units;
    this.saveClock += dtMin;
    if (this.saveClock > 3) {
      this.saveClock = 0;
      saveUnits(this.units);
    }
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
