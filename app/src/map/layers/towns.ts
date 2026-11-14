import type { ControlField } from '../../core/scenario';
import { controlAt } from '../../core/scenario';
import type { Town } from '../../core/types';
import type { PaintCtx } from '../paint';

export function countVisibleTowns(p: PaintCtx, towns: Town[]): number {
  let count = 0;
  for (const t of towns) {
    const px = p.sx(t.x);
    const py = p.sy(t.y);
    const rr = t.r * p.view.scale;
    if (px < -rr - 80 || py < -rr - 80 || px > p.w + rr + 80 || py > p.h + rr + 80) continue;
    if (rr < 4) continue;
    count++;
  }
  return count;
}

export function drawTownOutlines(p: PaintCtx, towns: Town[]): void {
  p.withUrbanClip(p.ctx, (c) => {
    p.drawInWorld(c, () => {
      const pxPerM = 1 / p.view.scale;
      for (const t of towns) {
        if (t.kind === 'parcel') continue;
        const px = p.sx(t.x);
        const py = p.sy(t.y);
        const rr = t.r * p.view.scale;
        if (px < -rr - 80 || py < -rr - 80 || px > p.w + rr + 80 || py > p.h + rr + 80) continue;
        if (rr < 4) continue;

        c.setLineDash([6 * pxPerM, 5 * pxPerM]);
        c.beginPath();
        const [ux, uy] = t.axis;
        const [, , smin, smax] = t.box;
        if (t.kind === 'band') {
          const bands = t.districts.filter((d) => d.shape === 'band');
          for (let i = 1; i < bands.length; i++) {
            const tt = bands[i].t0;
            const pad = 350;
            c.moveTo(t.x + ux * tt - uy * (smin - pad), t.y + uy * tt + ux * (smin - pad));
            c.lineTo(t.x + ux * tt - uy * (smax + pad), t.y + uy * tt + ux * (smax + pad));
          }
        } else {
          c.arc(t.x, t.y, t.coreR, 0, Math.PI * 2);
          for (const d of t.districts) {
            if (d.shape !== 'wedge') continue;
            const edge = d.a1;
            c.moveTo(t.x + Math.cos(edge) * t.coreR, t.y + Math.sin(edge) * t.coreR);
            c.lineTo(t.x + Math.cos(edge) * d.r1, t.y + Math.sin(edge) * d.r1);
          }
        }
        c.lineWidth = 1.3 * pxPerM;
        c.strokeStyle = 'rgba(18, 22, 30, 0.75)';
        c.stroke();
      }
    });
  });
}

export function drawTownLabels(p: PaintCtx, towns: Town[], zf: number): void {
  const { ctx } = p;
  for (const t of towns) {
    const px = p.sx(t.x);
    const py = p.sy(t.y);
    const rr = t.r * p.view.scale;
    if (px < -rr - 80 || py < -rr - 80 || px > p.w + rr + 80 || py > p.h + rr + 80) continue;
    if (rr < 10) continue;
    const fs = Math.round((t.pop > 40000 ? 13 : t.pop > 15000 ? 12 : 11) * Math.min(1.25, Math.max(0.95, zf)));
    ctx.font = `700 ${fs}px "Microsoft YaHei", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,253,247,0.92)';
    ctx.strokeText(t.n, px, py - rr * 0.55);
    ctx.fillStyle = 'rgba(38, 30, 24, 0.95)';
    ctx.fillText(t.n, px, py - rr * 0.55);
  }
}

export function drawCapturePoints(p: PaintCtx, towns: Town[], field: ControlField | null, show: boolean): void {
  const { ctx } = p;
  if (!show || !field || p.view.scale <= 0.018) return;
  for (const t of towns) {
    if (t.r * p.view.scale < 34) continue;
    for (const d of t.districts) {
      if (d.r1 * p.view.scale < 16) continue;
      const midT = d.shape === 'band' ? (d.t0 + d.t1) / 2 : 0;
      const ang = d.shape === 'wedge' ? (d.a0 + d.a1) / 2 : 0;
      const rad = d.shape === 'wedge' ? (d.r0 + d.r1) / 2 : 0;
      const [aux, auy] = t.axis;
      const gx = d.shape === 'band' ? t.x + aux * midT : d.shape === 'core' ? t.x : t.x + Math.cos(ang) * rad;
      const gy = d.shape === 'band' ? t.y + auy * midT : d.shape === 'core' ? t.y : t.y + Math.sin(ang) * rad;
      const wx = d.cp ? d.cp[0] : gx;
      const wy = d.cp ? d.cp[1] : gy;
      const c = controlAt(field, wx, wy);
      const px = p.sx(wx);
      const py = p.sy(wy);
      const col =
        c.control === 'ally'
          ? 'rgba(88, 148, 218, 0.98)'
          : c.control === 'enemy'
            ? 'rgba(202, 92, 72, 0.98)'
            : 'rgba(210, 176, 70, 0.98)';
      const size = d.shape === 'core' ? 8.5 : 7.2;
      ctx.beginPath();
      ctx.moveTo(px, py - size);
      ctx.lineTo(px + size * 0.82, py - size * 0.1);
      ctx.lineTo(px, py + size * 0.72);
      ctx.lineTo(px - size * 0.82, py - size * 0.1);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py - size - 3, 1.9, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(20,18,16,0.7)';
      ctx.stroke();
    }
  }
}
