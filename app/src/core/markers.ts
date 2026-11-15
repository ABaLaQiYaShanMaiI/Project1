export type Side = 'nato' | 'wp';
export type UnitKind = 'infantry' | 'armor' | 'artillery' | 'recon' | 'hq';

export interface Marker {
  id: string;
  kind: UnitKind;
  side: Side;
  label: string;
  lon: number;
  lat: number;
}

export const UNIT_LABEL: Record<UnitKind, string> = {
  infantry: '步兵',
  armor: '装甲',
  artillery: '炮兵',
  recon: '侦察',
  hq: '指挥',
};

export const SIDE_LABEL: Record<Side, string> = {
  nato: '北约',
  wp: '华约',
};

export const SIDE_COLOR: Record<Side, { stroke: string; fill: string; text: string }> = {
  nato: { stroke: '#3f6fb5', fill: 'rgba(63,111,181,0.28)', text: '#cfe0ff' },
  wp: { stroke: '#b54a3a', fill: 'rgba(181,74,58,0.26)', text: '#ffd5cc' },
};

export function newMarker(kind: UnitKind, side: Side, lon: number, lat: number, label?: string): Marker {
  return {
    id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    kind,
    side,
    label: label ?? UNIT_LABEL[kind],
    lon,
    lat,
  };
}

export function clampLon(lon: number): number {
  return Math.max(-180, Math.min(180, lon));
}

export function clampLat(lat: number): number {
  return Math.max(-85, Math.min(85, lat));
}
