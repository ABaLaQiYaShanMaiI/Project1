import type { Raster } from '../../core/types';
import type { PaintCtx } from '../paint';

export function drawContours(p: PaintCtx, dem: Raster, spanM: [number, number], interval: number): number {
  const { ctx, sx, sy } = p;
  const { cols, rows, values } = dem;
  const step = 2;
  const cellW = spanM[0] / (cols - 1);
  const cellH = spanM[1] / (rows - 1);
  const dx = cellW * step;
  const dy = cellH * step;
  ctx.beginPath();
  let segs = 0;
  for (let j = 0; j < rows - step; j += step) {
    const yTop = spanM[1] / 2 - j * cellH;
    const yBot = yTop - dy;
    for (let i = 0; i < cols - step; i += step) {
      const a = values[j * cols + i];
      const b = values[j * cols + i + step];
      const c = values[(j + step) * cols + i + step];
      const e = values[(j + step) * cols + i];
      const lo = Math.min(a, b, c, e);
      const hi = Math.max(a, b, c, e);
      let lv = Math.ceil(lo / interval) * interval;
      if (lv <= lo) lv += interval;
      const xL = -spanM[0] / 2 + i * cellW;
      const xR = xL + dx;
      for (; lv < hi; lv += interval) {
        const pts: number[] = [];
        if ((a - lv) * (b - lv) < 0) {
          const t = (lv - a) / (b - a);
          pts.push(xL + dx * t, yTop);
        }
        if ((b - lv) * (c - lv) < 0) {
          const t = (lv - b) / (c - b);
          pts.push(xR, yTop - dy * t);
        }
        if ((c - lv) * (e - lv) < 0) {
          const t = (lv - c) / (e - c);
          pts.push(xR - dx * t, yBot);
        }
        if ((e - lv) * (a - lv) < 0) {
          const t = (lv - e) / (a - e);
          pts.push(xL, yBot + dy * t);
        }
        if (pts.length >= 4) {
          ctx.moveTo(sx(pts[0]), sy(pts[1]));
          ctx.lineTo(sx(pts[2]), sy(pts[3]));
          segs++;
        }
        if (pts.length >= 8) {
          ctx.moveTo(sx(pts[4]), sy(pts[5]));
          ctx.lineTo(sx(pts[6]), sy(pts[7]));
          segs++;
        }
      }
    }
  }
  ctx.strokeStyle = 'rgba(112, 84, 52, 0.40)';
  ctx.lineWidth = 0.7;
  ctx.stroke();
  return segs;
}
