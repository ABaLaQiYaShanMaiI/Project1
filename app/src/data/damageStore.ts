export type DamageMap = Record<string, [number, number]>;

const KEY = 'city.damage.v1';

export function loadDamage(): DamageMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const doc = JSON.parse(raw) as { v?: number; levels?: Record<string, [number, number]> };
    const out: DamageMap = {};
    for (const [k, v] of Object.entries(doc.levels ?? {})) {
      if (!Array.isArray(v) || v.length < 2) continue;
      const r = Number(v[0]);
      const lv = Number(v[1]);
      if (!Number.isFinite(r) || !Number.isFinite(lv) || lv < 1) continue;
      out[k] = [r, Math.max(1, Math.min(3, Math.round(lv)))];
    }
    return out;
  } catch {
    return {};
  }
}

export function saveDamage(map: DamageMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, levels: map }));
  } catch {
    return;
  }
}

export function cityKey(lon: number, lat: number): string {
  return `${lon.toFixed(3)},${lat.toFixed(3)}`;
}
