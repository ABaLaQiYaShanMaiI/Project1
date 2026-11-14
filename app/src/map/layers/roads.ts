import type { RoadLine } from '../../core/types';
import { strokePolyline, type PaintCtx } from '../paint';

export const ROAD_STYLE: Record<string, { color: string; width: number; minLevel: number }> = {
  motorway: { color: '#c0492a', width: 3.6, minLevel: 0 },
  trunk: { color: '#c9772a', width: 2.9, minLevel: 0 },
  primary: { color: '#b8823f', width: 2.2, minLevel: 0 },
  secondary: { color: '#9a8a6e', width: 1.5, minLevel: 1 },
};

export function visibleRoads(roads: RoadLine[], lv: number): RoadLine[] {
  return roads.filter((r) => (ROAD_STYLE[r.c]?.minLevel ?? 2) <= lv);
}

export function drawRoads(p: PaintCtx, roads: RoadLine[], lv: number, zf: number): number {
  const { ctx } = p;
  const visible = visibleRoads(roads, lv);
  let segments = 0;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const pass of [0, 1]) {
    for (const road of visible) {
      const st = ROAD_STYLE[road.c] ?? ROAD_STYLE.secondary;
      const width = st.width * zf;
      ctx.strokeStyle = pass === 0 ? 'rgba(255,252,244,0.5)' : st.color;
      ctx.lineWidth = pass === 0 ? width + 1.6 : width;
      strokePolyline(ctx, road.p, p.sx, p.sy, false);
      if (pass === 0) segments += Math.max(0, road.p.length - 1);
    }
  }
  return segments;
}
