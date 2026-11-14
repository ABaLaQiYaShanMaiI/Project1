import type { Poly } from '../../core/types';
import { fillPoly, strokePolyline, type PaintCtx } from '../paint';

export function drawHydro(p: PaintCtx, water: Poly[], rivers: Poly[], zf: number): void {
  const { ctx } = p;
  ctx.fillStyle = 'rgba(74, 126, 172, 0.62)';
  for (const w of water) fillPoly(ctx, w.p, p.sx, p.sy);
  ctx.strokeStyle = 'rgba(62, 112, 160, 0.78)';
  ctx.lineWidth = Math.max(0.7, 1.0 * zf);
  ctx.lineJoin = 'round';
  for (const r of rivers) strokePolyline(ctx, r.p, p.sx, p.sy, false);
}
