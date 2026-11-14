import type { Pt } from '../core/types';

export interface View {
  cx: number;
  cy: number;

  scale: number;
}

export interface PaintCtx {
  ctx: CanvasRenderingContext2D;
  view: View;
  w: number;
  h: number;
  dpr: number;
  sx(wx: number): number;
  sy(wy: number): number;
  drawInWorld(ctx: CanvasRenderingContext2D, fn: () => void): void;
  withUrbanClip(ctx: CanvasRenderingContext2D, draw: (c: CanvasRenderingContext2D) => void): void;
}

export function fillPoly(
  ctx: CanvasRenderingContext2D,
  p: Pt[],
  sx: (wx: number) => number,
  sy: (wy: number) => number,
): void {
  if (p.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(sx(p[0][0]), sy(p[0][1]));
  for (let i = 1; i < p.length; i++) ctx.lineTo(sx(p[i][0]), sy(p[i][1]));
  ctx.closePath();
  ctx.fill();
}

export function strokePolyline(
  ctx: CanvasRenderingContext2D,
  p: Pt[],
  sx: (wx: number) => number,
  sy: (wy: number) => number,
  close = false,
): void {
  if (p.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(sx(p[0][0]), sy(p[0][1]));
  for (let i = 1; i < p.length; i++) ctx.lineTo(sx(p[i][0]), sy(p[i][1]));
  if (close) ctx.closePath();
  ctx.stroke();
}
