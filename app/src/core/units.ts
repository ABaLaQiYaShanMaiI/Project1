import type { Side, UnitKind } from './markers';

export type Posture = 'hold' | 'barricade' | 'reserve' | 'infiltrate';
export type Echelon = 'company' | 'platoon' | 'squad';

export interface Order {
  type: OrderType;
  district?: string;
  tx?: number;
  ty?: number;
  pinned: boolean;
  since: number;
}

export type OrderType = 'hold' | 'move' | 'attack' | 'fire' | 'withdraw';

export interface Unit {
  id: string;
  side: Side;
  kind: UnitKind;
  echelon: Echelon;
  parentId: string | null;
  townId: string;
  districtKey: string;
  x: number;
  y: number;
  posture: Posture;
  strength: number;
  label: string;
  order: Order;
}

export const ECHELON_ORDER: Echelon[] = ['company', 'platoon', 'squad'];

export const ECHELON_LABEL: Record<Echelon, string> = {
  company: '连',
  platoon: '排',
  squad: '班',
};

export const ECHELON_CHILD: Record<Echelon, Echelon | null> = {
  company: 'platoon',
  platoon: 'squad',
  squad: null,
};

export const ECHELON_FANOUT: Record<Echelon, number> = {
  company: 3,
  platoon: 3,
  squad: 0,
};

export const ECHELON_COST: Record<Echelon, number> = {
  company: 3,
  platoon: 1,
  squad: 1 / 3,
};

export const ECHELON_MIN_SCALE: Record<Echelon, number> = {
  company: 0,
  platoon: 0.028,
  squad: 0.058,
};

export const ECHELON_OFFSET_M: Record<Echelon, number> = {
  company: 340,
  platoon: 105,
  squad: 0,
};

export const POSTURE_LABEL: Record<Posture, string> = {
  hold: '据守',
  barricade: '街垒',
  reserve: '预备',
  infiltrate: '渗透',
};

export const POSTURE_HINT: Record<Posture, string> = {
  hold: '依托建筑据守：防御 ×1.0，机动 0',
  barricade: '街道封锁：正面防御 +25%，但被侧射时伤亡翻倍',
  reserve: '留作预备：不参与火力，可增援相邻街区',
  infiltrate: '沿街渗透：可越过一条街进入相邻街区，暴露度高',
};

export const POSTURE_ORDER: Posture[] = ['hold', 'barricade', 'reserve', 'infiltrate'];

const KIND_LABEL: Record<UnitKind, string> = {
  infantry: '步兵',
  armor: '装甲',
  artillery: '炮兵',
  recon: '侦察',
  hq: '指挥',
};

export function unitLabel(kind: UnitKind, echelon: Echelon): string {
  return `${KIND_LABEL[kind]}${ECHELON_LABEL[echelon]}`;
}

function uid(): string {
  return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function newUnit(
  kind: UnitKind,
  side: Side,
  echelon: Echelon,
  townId: string,
  districtKey: string,
  x: number,
  y: number,
  parentId: string | null = null,
  posture: Posture = 'hold',
): Unit {
  return {
    id: uid(),
    side,
    kind,
    echelon,
    parentId,
    townId,
    districtKey,
    x,
    y,
    posture,
    strength: 1,
    label: unitLabel(kind, echelon),
    order: { type: 'hold', pinned: false, since: 0 },
  };
}

export function isUnit(v: unknown): v is Unit {
  const u = v as Unit;
  return Boolean(
    u &&
      typeof u.id === 'string' &&
      typeof u.x === 'number' &&
      typeof u.y === 'number' &&
      typeof u.districtKey === 'string' &&
      (u.side === 'nato' || u.side === 'wp') &&
      (u.echelon === 'company' || u.echelon === 'platoon' || u.echelon === 'squad') &&
      typeof u.posture === 'string',
  );
}

export interface TreeCount {
  company: number;
  platoon: number;
  squad: number;
}

export function countTree(units: Unit[], rootId: string): TreeCount {
  const out: TreeCount = { company: 0, platoon: 0, squad: 0 };
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    const u = units.find((x) => x.id === id);
    if (!u) continue;
    out[u.echelon] += 1;
    for (const c of units) if (c.parentId === id) stack.push(c.id);
  }
  return out;
}

export function descendantsOf(units: Unit[], rootId: string): Unit[] {
  const out: Unit[] = [];
  const stack = [rootId];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const c of units) {
      if (c.parentId === id) {
        out.push(c);
        stack.push(c.id);
      }
    }
  }
  return out;
}

export function rootCost(units: Unit[]): number {
  return units.filter((u) => !u.parentId).reduce((s, u) => s + ECHELON_COST[u.echelon], 0);
}

export function visibleUnitIds(units: Unit[], scale: number): Set<string> {
  const shown = new Set<string>();
  const order = [...ECHELON_ORDER].reverse();
  for (const echelon of order) {
    if (scale < ECHELON_MIN_SCALE[echelon]) continue;
    for (const u of units) {
      if (u.echelon !== echelon) continue;
      const broken = units.some((c) => c.parentId === u.id && shown.has(c.id));
      if (!broken) shown.add(u.id);
    }
  }
  return shown;
}
