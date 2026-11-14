import type { Raster } from '../../core/types';

const COLORS: Record<number, [number, number, number, number]> = {
  0: [0, 0, 0, 0],
  1: [52, 84, 52, 120],
  2: [116, 104, 98, 70],
  3: [56, 104, 150, 190],
};

export function buildCoverCanvas(lc: Raster): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = lc.cols;
  cv.height = lc.rows;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(lc.cols, lc.rows);
  const d = img.data;
  for (let i = 0; i < lc.values.length; i++) {
    const c = COLORS[lc.values[i]] ?? COLORS[0];
    d[i * 4] = c[0];
    d[i * 4 + 1] = c[1];
    d[i * 4 + 2] = c[2];
    d[i * 4 + 3] = c[3];
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
