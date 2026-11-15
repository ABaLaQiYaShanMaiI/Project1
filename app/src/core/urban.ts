import type { Town } from './types';
import { townDistricts, pointInPoly, type District } from './towns';

export const PLATOONS_PER_COMPANY = 3;
export const ADJ_GAP_M = 260;

export interface DistrictRef {
  key: string;
  index: number;
  town: Town;
  district: District;
}

export interface UrbanIndex {
  refs: DistrictRef[];
  byKey: Map<string, DistrictRef>;
  neighbours: Map<string, string[]>;
  byTown: Map<string, DistrictRef[]>;
}

const cache = new WeakMap<Town[], UrbanIndex>();

function polygonOf(d: District): Array<[number, number]> | null {
  return d.poly && d.poly.length >= 3 ? d.poly : null;
}

function vertexGap(a: Array<[number, number]>, b: Array<[number, number]>): number {
  let best = Infinity;
  for (const [ax, ay] of a) {
    for (const [bx, by] of b) {
      const d = Math.hypot(ax - bx, ay - by);
      if (d < best) best = d;
      if (best < 1) return best;
    }
  }
  return best;
}

function centroidOf(poly: Array<[number, number]>, fallback: [number, number]): [number, number] {
  if (!poly.length) return fallback;
  let x = 0;
  let y = 0;
  for (const [px, py] of poly) {
    x += px;
    y += py;
  }
  return [x / poly.length, y / poly.length];
}

export function platoonCap(d: District): number {
  return Math.max(1, Math.round(d.frontage * PLATOONS_PER_COMPANY));
}

const anchorCache = new Map<string, [number, number]>();

function polygonCentroid(poly: Array<[number, number]>, fallback: [number, number]): [number, number] {
  if (poly.length < 3) return fallback;
  let x = 0;
  let y = 0;
  for (const [px, py] of poly) {
    x += px;
    y += py;
  }
  return [x / poly.length, y / poly.length];
}

function rawCenter(t: Town, d: District): [number, number] {
  if (d.cp) return [d.cp[0], d.cp[1]];
  return polygonCentroid(polygonOf(d) ?? [], [t.x, t.y]);
}

function insideAnchor(t: Town, d: District): [number, number] {
  const hit = anchorCache.get(d.key);
  if (hit) return hit;
  const poly = polygonOf(d);
  const want = rawCenter(t, d);
  if (!poly) {
    anchorCache.set(d.key, want);
    return want;
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [px, py] of poly) {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  const steps = 18;
  let best: [number, number] | null = null;
  let bestD = Infinity;
  for (let i = 1; i < steps; i++) {
    for (let j = 1; j < steps; j++) {
      const px = minX + ((maxX - minX) * i) / steps;
      const py = minY + ((maxY - minY) * j) / steps;
      if (!pointInPoly(poly, px, py)) continue;
      const dist = Math.hypot(px - want[0], py - want[1]);
      if (dist < bestD) {
        bestD = dist;
        best = [px, py];
      }
    }
  }
  const out = best ?? want;
  anchorCache.set(d.key, out);
  return out;
}

export function districtCenter(t: Town, d: District): [number, number] {
  return insideAnchor(t, d);
}

export function slotPoint(t: Town, d: District, slot: number): [number, number] {
  const poly = polygonOf(d);
  const anchor = insideAnchor(t, d);
  if (!poly) return anchor;
  const areaM2 = Math.max(1, d.area) * 1e6;
  const r0 = Math.sqrt(areaM2 / Math.PI);
  const n = platoonCap(d);
  const step = Math.min(0.62, 0.28 + slot / Math.max(4, n));
  const radius = r0 * step;
  const ang = slot * 2.399963 + 0.7;
  const px = anchor[0] + Math.cos(ang) * radius;
  const py = anchor[1] + Math.sin(ang) * radius;
  if (pointInPoly(poly, px, py)) return [px, py];
  return anchor;
}

export function districtContains(d: District, t: Town, x: number, y: number): boolean {
  const poly = polygonOf(d);
  if (!poly) return Math.hypot(x - t.x, y - t.y) <= t.r;
  return pointInPoly(poly, x, y);
}

export function childSlots(
  t: Town,
  d: District,
  parentX: number,
  parentY: number,
  fanout: number,
  radius: number,
): Array<[number, number]> {
  const poly = polygonOf(d);
  const out: Array<[number, number]> = [];
  for (let i = 0; i < fanout; i++) {
    const a = (i / Math.max(1, fanout)) * Math.PI * 2 + 0.5;
    const px = parentX + Math.cos(a) * radius;
    const py = parentY + Math.sin(a) * radius;
    if (!poly || pointInPoly(poly, px, py)) {
      out.push([px, py]);
    } else {
      out.push([parentX, parentY]);
    }
  }
  return out;
}

function specialNeighbours(list: DistrictRef[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const t = list[0]?.town;
  if (!t) return out;
  const key = (i: number): string => list[i].key;
  const link = (a: number, b: number): void => {
    const ka = key(a);
    const kb = key(b);
    if (!out.has(ka)) out.set(ka, []);
    if (!out.has(kb)) out.set(kb, []);
    out.get(ka)!.push(kb);
    out.get(kb)!.push(ka);
  };
  if (t.kind === 'radial') {
    const core = list.findIndex((r) => r.district.shape === 'core');
    const wedges = list.filter((r) => r.district.shape !== 'core');
    if (core >= 0) for (const w of wedges) link(core, list.indexOf(w));
    for (let i = 0; i < wedges.length; i++) {
      link(list.indexOf(wedges[i]), list.indexOf(wedges[(i + 1) % wedges.length]));
    }
  } else if (t.kind === 'band') {
    const ordered = [...list].sort((a, b) => a.district.t0 - b.district.t0);
    for (let i = 0; i + 1 < ordered.length; i++) {
      link(list.indexOf(ordered[i]), list.indexOf(ordered[i + 1]));
    }
  }
  return out;
}

export function urbanIndex(towns: Town[]): UrbanIndex {
  const hit = cache.get(towns);
  if (hit) return hit;

  const refs: DistrictRef[] = [];
  const byTown = new Map<string, DistrictRef[]>();
  for (const t of towns) {
    if (t.area < 0.02) continue;
    const list: DistrictRef[] = [];
    townDistricts(t).forEach((d, i) => {
      const ref: DistrictRef = { key: d.key, index: i, town: t, district: d };
      refs.push(ref);
      list.push(ref);
    });
    if (list.length) byTown.set(t.id, list);
  }

  const neighbours = new Map<string, string[]>();
  for (const [, list] of byTown) {
    if (list.length < 2) continue;
    const special = specialNeighbours(list);
    for (const [k, v] of special) neighbours.set(k, v);
    if (list[0].town.kind !== 'poly') continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const pa = polygonOf(a.district);
        const pb = polygonOf(b.district);
        let close = false;
        if (pa && pb) {
          close = vertexGap(pa, pb) <= ADJ_GAP_M;
          if (!close) {
            const ca = districtCenter(a.town, a.district);
            const cb = districtCenter(b.town, b.district);
            close = Math.hypot(ca[0] - cb[0], ca[1] - cb[1]) <= 1500;
          }
        } else {
          const ca = districtCenter(a.town, a.district);
          const cb = districtCenter(b.town, b.district);
          close = Math.hypot(ca[0] - cb[0], ca[1] - cb[1]) <= 1500;
        }
        if (!close) continue;
        if (!neighbours.has(a.key)) neighbours.set(a.key, []);
        if (!neighbours.has(b.key)) neighbours.set(b.key, []);
        neighbours.get(a.key)!.push(b.key);
        neighbours.get(b.key)!.push(a.key);
      }
    }
  }

  const byKey = new Map<string, DistrictRef>();
  for (const r of refs) byKey.set(r.key, r);

  const idx: UrbanIndex = { refs, byKey, neighbours, byTown };
  cache.set(towns, idx);
  return idx;
}

export function districtAtPoint(idx: UrbanIndex, townId: string, x: number, y: number): DistrictRef | null {
  const list = idx.byTown.get(townId);
  if (!list) return null;
  for (const ref of list) {
    if (districtContains(ref.district, ref.town, x, y)) return ref;
  }
  let best: DistrictRef | null = null;
  let bestD = Infinity;
  for (const ref of list) {
    const c = districtCenter(ref.town, ref.district);
    const d = Math.hypot(c[0] - x, c[1] - y);
    if (d < bestD) {
      bestD = d;
      best = ref;
    }
  }
  return best;
}

export function neighbourRefs(idx: UrbanIndex, key: string): DistrictRef[] {
  return (idx.neighbours.get(key) ?? []).map((k) => idx.byKey.get(k)).filter((r): r is DistrictRef => Boolean(r));
}
