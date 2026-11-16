import type { Side } from '../core/markers';

export type CellOwners = Record<string, Side>;

const KEY = 'cells.owner.v1';

export function loadCellOwners(): CellOwners {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const doc = JSON.parse(raw) as { owners?: Record<string, string> };
    const out: CellOwners = {};
    for (const [id, side] of Object.entries(doc.owners ?? {})) {
      if (side === 'nato' || side === 'wp') out[id] = side;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveCellOwners(owners: CellOwners): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, owners }));
  } catch {
    return;
  }
}
