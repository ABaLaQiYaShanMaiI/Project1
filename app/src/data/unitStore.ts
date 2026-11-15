import { isUnit, type Unit } from '../core/units';

const KEY = 'wargame.units.v1';
const LEGACY = 'wargame.platoons.v1';

export function loadUnits(): Unit[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.removeItem(LEGACY);
      return [];
    }
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    return list.filter(isUnit).map((u) => ({
      ...u,
      order: u.order && typeof u.order.type === 'string' ? u.order : { type: 'hold', pinned: false, since: 0 },
      strength: typeof u.strength === 'number' ? u.strength : 1,
    }));
  } catch {
    return [];
  }
}

export function saveUnits(list: Unit[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    return;
  }
}
