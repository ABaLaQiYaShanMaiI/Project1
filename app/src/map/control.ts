import type { ControlField } from '../core/scenario';
import type { PaintCtx } from './paint';

export interface ControlCanvases {
  control: HTMLCanvasElement;
  intel: HTMLCanvasElement;
}

export function buildControlCanvases(field: ControlField): ControlCanvases {
  const cols = field.cols;
  const rows = field.rows;

  const mk = (paint: (k: number) => [number, number, number, number]) => {
    const cv = document.createElement('canvas');
    cv.width = cols;
    cv.height = rows;
    const c = cv.getContext('2d')!;
    const img = c.createImageData(cols, rows);
    for (let k = 0; k < cols * rows; k++) {
      const [r, g, b, a] = paint(k);
      img.data[k * 4] = r;
      img.data[k * 4 + 1] = g;
      img.data[k * 4 + 2] = b;
      img.data[k * 4 + 3] = a;
    }
    c.putImageData(img, 0, 0);
    return cv;
  };

  const control = mk((k) => {
    const o = field.owner[k];
    if (o === 0) return [58, 110, 190, 58];
    if (o === 1) return [186, 76, 58, 52];
    return [176, 148, 64, 66];
  });

  const intel = mk((k) => {
    if (field.owner[k] !== 1) return [0, 0, 0, 0];
    const a = Math.round((1 - field.conf[k]) * 95);
    return [90, 36, 52, a];
  });

  return { control, intel };
}

export function drawFrontLine(p: PaintCtx, field: ControlField | null, show: boolean): void {
  if (!show || !field) return;
  const ctx = p.ctx;
  p.drawInWorld(ctx, () => {
    const px = 1 / p.view.scale;
    ctx.beginPath();
    ctx.moveTo(field.front[0][0], field.front[0][1]);
    for (let i = 1; i < field.front.length; i++) ctx.lineTo(field.front[i][0], field.front[i][1]);
    ctx.setLineDash([10 * px, 7 * px]);
    ctx.lineWidth = 2.8 * px;
    ctx.strokeStyle = 'rgba(26, 24, 28, 0.75)';
    ctx.stroke();
    ctx.setLineDash([]);
  });
}
