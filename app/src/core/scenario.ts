import type { MapMeta, Pt } from './types';

export interface Scenario {
  name: string;
  note?: string;

  front: [number, number][];
  contestedWidthM: number;
  sides: { nato: { name: string; short: string; color: string }; wp: { name: string; short: string; color: string } };
  intel: {
    ownConfidence: number;
    enemyConfidenceAtFront: number;
    enemyConfidenceAtDepth: number;
    depthM: number;
  };
  ally: 'nato' | 'wp';
}

export type Control = 'ally' | 'enemy' | 'contested';

export interface ControlField {

  owner: Uint8Array;

  conf: Float32Array;

  signed: Float32Array;
  cols: number;
  rows: number;
  spanX: number;
  spanY: number;

  front: Pt[];
}

export function frontInMeters(sc: Scenario, meta: MapMeta): Pt[] {
  const [lat0, lon0] = meta.center;
  return sc.front.map(([lat, lon]) => [
    (lon - lon0) * meta.projection.mPerDegLon,
    (lat - lat0) * meta.projection.mPerDegLat,
  ]);
}

interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  len2: number;
  cross: number;
}

export function nearestOnFront(front: Pt[], x: number, y: number): { dist: number; side: number } {
  let bestD = Infinity;
  let bestSide = 1;
  for (let i = 0; i < front.length - 1; i++) {
    const [ax, ay] = front[i];
    const [bx, by] = front[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((x - ax) * dx + (y - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = ax + dx * t;
    const py = ay + dy * t;
    const d = Math.hypot(x - px, y - py);
    if (d < bestD) {
      bestD = d;

      bestSide = dx * (y - ay) - dy * (x - ax) >= 0 ? 1 : -1;
    }
  }
  return { dist: bestD, side: bestSide };
}

export function buildControlField(
  front: Pt[],
  spanX: number,
  spanY: number,
  contestedM: number,
  intel: Scenario['intel'],
  cols = 288,
  rows = 216,
): ControlField {
  const owner = new Uint8Array(cols * rows);
  const conf = new Float32Array(cols * rows);
  const signed = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    const y = (0.5 - j / (rows - 1)) * spanY;
    for (let i = 0; i < cols; i++) {
      const x = (i / (cols - 1) - 0.5) * spanX;
      const { dist, side } = nearestOnFront(front, x, y);
      const sg = dist * side;
      const k = j * cols + i;
      signed[k] = sg;
      if (dist <= contestedM) {
        owner[k] = 2;
        conf[k] = 0.5;
      } else if (sg < 0) {
        owner[k] = 0;
        conf[k] = intel.ownConfidence;
      } else {
        owner[k] = 1;
        const t = Math.min(1, dist / Math.max(1, intel.depthM));
        conf[k] = intel.enemyConfidenceAtFront + (intel.enemyConfidenceAtDepth - intel.enemyConfidenceAtFront) * t;
      }
    }
  }
  return { owner, conf, signed, cols, rows, spanX, spanY, front };
}

export function controlAt(f: ControlField, x: number, y: number): { control: Control; conf: number } {
  const i = Math.round((x / f.spanX + 0.5) * (f.cols - 1));
  const j = Math.round((0.5 - y / f.spanY) * (f.rows - 1));
  const ci = Math.min(Math.max(i, 0), f.cols - 1);
  const cj = Math.min(Math.max(j, 0), f.rows - 1);
  const k = cj * f.cols + ci;
  const o = f.owner[k];
  return { control: o === 0 ? 'ally' : o === 1 ? 'enemy' : 'contested', conf: f.conf[k] };
}

export const CONTROL_LABEL: Record<Control, string> = {
  ally: '我方控制',
  enemy: '敌方控制',
  contested: '争夺带（灰色地带）',
};
