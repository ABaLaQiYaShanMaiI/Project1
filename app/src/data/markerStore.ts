import type { Marker, Side, UnitKind } from '../core/markers';

const KEY = 'wargame.markers.v1';

export interface MarkerDraft {
  markers: Marker[];
  side: Side;
  kind: UnitKind;
}

export function loadMarkers(): Marker[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Marker[];
    if (!Array.isArray(list)) return [];
    return list.filter(
      (m) =>
        m &&
        typeof m.id === 'string' &&
        typeof m.lon === 'number' &&
        typeof m.lat === 'number' &&
        typeof m.kind === 'string' &&
        (m.side === 'nato' || m.side === 'wp'),
    );
  } catch {
    return [];
  }
}

export function saveMarkers(list: Marker[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    return;
  }
}
