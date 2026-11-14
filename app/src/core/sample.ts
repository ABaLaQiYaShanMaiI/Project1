import type { Raster } from './types';

function toGrid(r: Raster, spanX: number, spanY: number, x: number, y: number) {
  const u = (x / spanX + 0.5) * (r.cols - 1);
  const v = (0.5 - y / spanY) * (r.rows - 1);
  return { u, v };
}

export function sampleBilinear(
  r: Raster,
  spanX: number,
  spanY: number,
  x: number,
  y: number,
): number {
  const { u, v } = toGrid(r, spanX, spanY, x, y);
  const cu = Math.min(Math.max(u, 0), r.cols - 1.001);
  const cv = Math.min(Math.max(v, 0), r.rows - 1.001);
  const i0 = Math.floor(cu);
  const j0 = Math.floor(cv);
  const fu = cu - i0;
  const fv = cv - j0;
  const at = (i: number, j: number) => r.values[j * r.cols + i] ?? 0;
  const a = at(i0, j0) * (1 - fu) + at(i0 + 1, j0) * fu;
  const b = at(i0, j0 + 1) * (1 - fu) + at(i0 + 1, j0 + 1) * fu;
  return a * (1 - fv) + b * fv;
}

export function sampleNearest(
  r: Raster,
  spanX: number,
  spanY: number,
  x: number,
  y: number,
): number {
  const { u, v } = toGrid(r, spanX, spanY, x, y);
  const i = Math.min(Math.max(Math.round(u), 0), r.cols - 1);
  const j = Math.min(Math.max(Math.round(v), 0), r.rows - 1);
  return r.values[j * r.cols + i] ?? 0;
}
