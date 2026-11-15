import type { Echelon, Posture, Unit } from './units';
import { ECHELON_CHILD, ECHELON_FANOUT, ECHELON_OFFSET_M, ECHELON_COST } from './units';
import { childSlots, districtAtPoint, platoonCap, slotPoint, type DistrictRef, type UrbanIndex } from './urban';

export type OrderType = 'hold' | 'move' | 'attack' | 'fire' | 'withdraw';

export interface Order {
  type: OrderType;
  district?: string;
  tx?: number;
  ty?: number;
  pinned: boolean;
  since: number;
}

export const ORDER_LABEL: Record<OrderType, string> = {
  hold: '守线',
  move: '移动',
  attack: '攻击',
  fire: '开火',
  withdraw: '撤离',
};

export const ORDER_HINT: Record<OrderType, string> = {
  hold: '原地守线：下级在各自位置据守，回击但不机动',
  move: '机动到指定街区：下级按各自位置跟进，到达后自动转守线',
  attack: '进攻指定街区：到达后同街区开火，按班结算伤亡',
  fire: '就地开火：只打同街区敌军，不移动',
  withdraw: '脱离接触：向本方一侧后撤，边退边挨打',
};

export const ORDER_ORDER: OrderType[] = ['hold', 'fire', 'move', 'attack', 'withdraw'];

export function defaultOrder(): Order {
  return { type: 'hold', pinned: false, since: 0 };
}

export function orderOf(u: Unit): Order {
  return u.order ?? defaultOrder();
}

const SPEED_M_PER_MIN: Record<string, number> = {
  infantry: 90,
  armor: 320,
  artillery: 70,
  recon: 480,
  hq: 260,
};

const POSTURE_SPEED: Record<Posture, number> = {
  hold: 1,
  barricade: 0,
  reserve: 1.1,
  infiltrate: 1.3,
};

const KIND_POWER: Record<string, number> = {
  infantry: 1,
  armor: 1.7,
  artillery: 1.15,
  recon: 0.6,
  hq: 0.35,
};

const POSTURE_DEF: Record<Posture, number> = {
  hold: 1,
  barricade: 1.28,
  reserve: 0.82,
  infiltrate: 0.85,
};

const POSTURE_FIRE: Record<Posture, number> = {
  hold: 0.6,
  barricade: 0.75,
  reserve: 0,
  infiltrate: 1.15,
};

const KILL_RATE = 0.12;
const ARRIVE_M = 45;

export function speedOf(u: Unit): number {
  return (SPEED_M_PER_MIN[u.kind] ?? 90) * POSTURE_SPEED[u.posture];
}

export function isMoving(u: Unit): boolean {
  const o = orderOf(u);
  return (o.type === 'move' || o.type === 'attack' || o.type === 'withdraw') && o.tx != null && o.ty != null;
}

function canFire(u: Unit): boolean {
  const o = orderOf(u);
  if (o.type === 'fire' || o.type === 'attack') return true;
  if (o.type === 'hold') return true;
  return false;
}

function fireFactor(u: Unit): number {
  const o = orderOf(u);
  if (o.type === 'fire' || o.type === 'attack') return 1;
  return POSTURE_FIRE[u.posture];
}

export interface IssueResult {
  units: Unit[];
  changed: string[];
}

function treeIds(units: Unit[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const u of units) {
      if (u.parentId && ids.has(u.parentId) && !ids.has(u.id)) {
        ids.add(u.id);
        grew = true;
      }
    }
  }
  return ids;
}

export function issueOrder(
  units: Unit[],
  rootId: string,
  type: OrderType,
  opts: { ref?: DistrictRef; now: number; pinned?: boolean } ,
): IssueResult {
  const root = units.find((u) => u.id === rootId);
  if (!root) return { units, changed: [] };
  const pinned = opts.pinned ?? true;
  const ids = treeIds(units, rootId);

  const targets = new Map<string, { x: number; y: number }>();
  if (type === 'withdraw' && !opts.ref) {
    const foes = units.filter((u) => u.side !== root.side);
    for (const u of units) {
      if (!ids.has(u.id)) continue;
      let best: Unit | null = null;
      let bestD = Infinity;
      for (const f of foes) {
        const d = Math.hypot(f.x - u.x, f.y - u.y);
        if (d < bestD) {
          bestD = d;
          best = f;
        }
      }
      const ax = best ? u.x - best.x : -u.x;
      const ay = best ? u.y - best.y : -u.y;
      const len = Math.hypot(ax, ay) || 1;
      targets.set(u.id, { x: u.x + (ax / len) * 1500, y: u.y + (ay / len) * 1500 });
    }
  }
  if ((type === 'move' || type === 'attack' || type === 'withdraw') && opts.ref) {
    const before = units.filter((u) => u.districtKey === opts.ref!.key && !u.parentId);
    const cost = before.reduce((s, u) => s + ECHELON_COST[u.echelon], 0);
    const [x, y] = slotPoint(opts.ref.town, opts.ref.district, Math.round(cost));
    targets.set(rootId, { x, y });
    const walk = (id: string, px: number, py: number): void => {
      const node = units.find((u) => u.id === id);
      if (!node) return;
      const child = ECHELON_CHILD[node.echelon];
      if (!child) return;
      const kids = units.filter((u) => u.parentId === id);
      const slots = childSlots(
        opts.ref!.town,
        opts.ref!.district,
        px,
        py,
        ECHELON_FANOUT[node.echelon],
        ECHELON_OFFSET_M[node.echelon],
      );
      kids.forEach((kid, i) => {
        const [cx, cy] = slots[i] ?? [px, py];
        targets.set(kid.id, { x: cx, y: cy });
        walk(kid.id, cx, cy);
      });
    };
    walk(rootId, x, y);
  }

  const now = opts.now;
  const next = units.map((u) => {
    if (!ids.has(u.id)) return u;
    const own = orderOf(u);
    if (u.id !== rootId && own.pinned) return u;
    const t = targets.get(u.id);
    return {
      ...u,
      order: {
        type,
        district: opts.ref?.key,
        tx: t?.x,
        ty: t?.y,
        pinned: u.id === rootId ? pinned : false,
        since: now,
      },
    };
  });
  return { units: next, changed: [...ids] };
}

export function releasePinned(units: Unit[], rootId: string): Unit[] {
  const ids = treeIds(units, rootId);
  return units.map((u) => (ids.has(u.id) && u.parentId ? { ...u, order: { ...orderOf(u), pinned: false } } : u));
}

export interface StepResult {
  units: Unit[];
  killed: string[];
  firing: number;
  arrived: number;
}

interface LeafInfo {
  unit: Unit;
  districtKey: string;
}

export function stepOrders(units: Unit[], idx: UrbanIndex, dtMin: number, now: number): StepResult {
  if (dtMin <= 0 || !units.length) return { units, killed: [], firing: 0, arrived: 0 };

  let arrived = 0;
  const moved = units.map((u) => {
    const o = orderOf(u);
    const speed = speedOf(u);
    if (speed <= 0 || o.tx == null || o.ty == null) return u;
    if (o.type !== 'move' && o.type !== 'attack' && o.type !== 'withdraw') return u;
    const dx = o.tx - u.x;
    const dy = o.ty - u.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= ARRIVE_M) {
      arrived++;
      const nextType: OrderType = o.type === 'attack' ? 'fire' : 'hold';
      const destKey = o.type === 'withdraw' ? u.districtKey : o.district && idx.byKey.has(o.district) ? o.district : u.districtKey;
      return { ...u, districtKey: destKey, order: { ...o, type: nextType, tx: undefined, ty: undefined } };
    }
    const stepLen = Math.min(dist, speed * dtMin);
    const k = stepLen / dist;
    const nx = u.x + dx * k;
    const ny = u.y + dy * k;
    let key = u.districtKey;
    if (stepLen > 1 && o.type !== 'withdraw') {
      const here = districtAtPoint(idx, u.townId, nx, ny);
      if (here) key = here.key;
      else if (o.district && idx.byKey.has(o.district) && stepLen > 300) key = o.district;
    }
    return { ...u, x: nx, y: ny, districtKey: key };
  });

  const childrenOf = new Map<string, Unit[]>();
  for (const u of moved) {
    if (!u.parentId) continue;
    const list = childrenOf.get(u.parentId) ?? [];
    list.push(u);
    childrenOf.set(u.parentId, list);
  }
  const leaves: LeafInfo[] = moved
    .filter((u) => !childrenOf.has(u.id))
    .map((u) => ({ unit: u, districtKey: u.districtKey }));

  const lossById = new Map<string, number>();
  let firing = 0;

  const byDistrict = new Map<string, LeafInfo[]>();
  for (const leaf of leaves) {
    const list = byDistrict.get(leaf.districtKey) ?? [];
    list.push(leaf);
    byDistrict.set(leaf.districtKey, list);
  }

  for (const [key, group] of byDistrict) {
    const ref = idx.byKey.get(key);
    if (!ref) continue;
    const sides = { nato: [] as LeafInfo[], wp: [] as LeafInfo[] };
    for (const leaf of group) sides[leaf.unit.side].push(leaf);
    if (!sides.nato.length || !sides.wp.length) continue;

    const power = { nato: 0, wp: 0 };
    for (const side of ['nato', 'wp'] as const) {
      for (const leaf of sides[side]) {
        if (!canFire(leaf.unit)) continue;
        power[side] +=
          (KIND_POWER[leaf.unit.kind] ?? 1) * ECHELON_COST[leaf.unit.echelon] * leaf.unit.strength * fireFactor(leaf.unit);
      }
    }
    for (const side of ['nato', 'wp'] as const) {
      const foe = side === 'nato' ? 'wp' : 'nato';
      if (power[foe] <= 0) continue;
      firing += 1;
      const own = sides[side];
      for (const leaf of own) {
        const def =
          (1 + 0.2 * (ref.district.defense - 1) + 0.6 * (ref.district.builtRatio ?? 0)) * POSTURE_DEF[leaf.unit.posture];
        const share = power[foe] / Math.max(1, own.length);
        const loss = (share * KILL_RATE * dtMin) / Math.max(0.4, def);
        lossById.set(leaf.unit.id, (lossById.get(leaf.unit.id) ?? 0) + loss);
      }
    }
  }

  const damaged = moved.map((u) => {
    const loss = lossById.get(u.id);
    if (!loss) return u;
    return { ...u, strength: Math.max(0, u.strength - loss) };
  });

  const byId = new Map(damaged.map((u) => [u.id, u]));

  const recomputeParents = (): void => {
    const depth: Record<string, number> = { squad: 0, platoon: 1, company: 2 };
    const ordered = [...byId.values()].sort((a, b) => depth[a.echelon] - depth[b.echelon]);
    for (const u of ordered) {
      const kids = [...byId.values()].filter((c) => c.parentId === u.id);
      if (!kids.length) continue;
      const avg = kids.reduce((s, c) => s + c.strength, 0) / kids.length;
      byId.set(u.id, { ...u, strength: avg });
    }
  };
  recomputeParents();

  const killed: string[] = [];
  const alive: Unit[] = [];
  for (const u of byId.values()) {
    if (u.strength <= 0.001 && ![...byId.values()].some((c) => c.parentId === u.id)) {
      killed.push(u.id);
      continue;
    }
    alive.push(u);
  }
  const goneIds = new Set(killed);
  const finalUnits = alive.map((u) =>
    u.parentId && goneIds.has(u.parentId) ? { ...u, parentId: null, order: { ...orderOf(u), type: 'hold' as OrderType } } : u,
  );

  void now;
  return { units: finalUnits, killed, firing, arrived };
}

export function capacityOf(units: Unit[], key: string): number {
  return units.filter((u) => u.districtKey === key && !u.parentId).reduce((s, u) => s + ECHELON_COST[u.echelon], 0);
}

export function capOf(ref: DistrictRef): number {
  return platoonCap(ref.district);
}

export function childEchelon(e: Echelon): Echelon | null {
  return ECHELON_CHILD[e];
}
