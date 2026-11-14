import type { Raster } from '../core/types';

interface Stop {
  e: number;
  c: [number, number, number];
}

const STOPS: Stop[] = [
  { e: 120, c: [206, 218, 196] },
  { e: 220, c: [214, 219, 186] },
  { e: 320, c: [219, 211, 176] },
  { e: 420, c: [214, 195, 165] },
  { e: 520, c: [201, 178, 155] },
  { e: 650, c: [186, 170, 158] },
  { e: 800, c: [196, 190, 186] },
  { e: 950, c: [214, 212, 210] },
];

function ramp(e: number): [number, number, number] {
  if (e <= STOPS[0].e) return STOPS[0].c;
  for (let i = 1; i < STOPS.length; i++) {
    if (e <= STOPS[i].e) {
      const a = STOPS[i - 1];
      const b = STOPS[i];
      const t = (e - a.e) / (b.e - a.e);
      return [
        a.c[0] + (b.c[0] - a.c[0]) * t,
        a.c[1] + (b.c[1] - a.c[1]) * t,
        a.c[2] + (b.c[2] - a.c[2]) * t,
      ];
    }
  }
  return STOPS[STOPS.length - 1].c;
}

export function buildTerrainCanvas(dem: Raster, cellW: number, cellH: number): HTMLCanvasElement {
  const { cols, rows, values } = dem;
  const cv = document.createElement('canvas');
  cv.width = cols;
  cv.height = rows;
  const ctx = cv.getContext('2d')!;
  const img = ctx.createImageData(cols, rows);
  const data = img.data;

  const L = norm(-0.55, -0.55, 0.75);
  const exag = 1.35;

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const idx = j * cols + i;
      const v = values[idx];
      const i0 = i > 0 ? i - 1 : i;
      const i1 = i < cols - 1 ? i + 1 : i;
      const j0 = j > 0 ? j - 1 : j;
      const j1 = j < rows - 1 ? j + 1 : j;
      const dzdx = ((values[j * cols + i1] - values[j * cols + i0]) / ((i1 - i0) * cellW)) * exag;
      const dzdy = ((values[j1 * cols + i] - values[j0 * cols + i]) / ((j1 - j0) * cellH)) * exag;
      const n = norm(-dzdx * 1000, -dzdy * 1000, 1);
      const shade = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
      const k = 0.62 + 0.55 * shade;
      const c = ramp(v);
      data[idx * 4] = clamp(c[0] * k);
      data[idx * 4 + 1] = clamp(c[1] * k);
      data[idx * 4 + 2] = clamp(c[2] * k);
      data[idx * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

function norm(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
