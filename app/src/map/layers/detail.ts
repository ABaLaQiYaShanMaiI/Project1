import type { DetailLayer } from '../../core/detail';
import type { PaintCtx } from '../paint';

export function buildDetailPaths(d: DetailLayer): { buildings: Path2D; streets: Path2D } {
  const sp = new Path2D();
  for (const st of d.streets) {
    if (st.p.length < 2) continue;
    sp.moveTo(st.p[0][0], st.p[0][1]);
    for (let i = 1; i < st.p.length; i++) sp.lineTo(st.p[i][0], st.p[i][1]);
  }
  const bp = new Path2D();
  for (const b of d.buildings) {
    const [bx, by, bw, bh, ang] = b;
    const cs = Math.cos(ang);
    const sn = Math.sin(ang);
    const hw = bw / 2;
    const hh = bh / 2;
    bp.moveTo(bx - hw * cs + hh * sn, by - hw * sn - hh * cs);
    bp.lineTo(bx + hw * cs + hh * sn, by + hw * sn - hh * cs);
    bp.lineTo(bx + hw * cs - hh * sn, by + hw * sn + hh * cs);
    bp.lineTo(bx - hw * cs - hh * sn, by - hw * sn + hh * cs);
    bp.closePath();
  }
  return { buildings: bp, streets: sp };
}

export function drawDetailLayer(p: PaintCtx, paths: { buildings: Path2D; streets: Path2D }): void {
  p.drawInWorld(p.ctx, () => {
    const ctx = p.ctx;
    const px = 1 / p.view.scale;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(246, 242, 232, 0.7)';
    ctx.lineWidth = 3.0 * px;
    ctx.stroke(paths.streets);
    ctx.strokeStyle = 'rgba(198, 190, 178, 0.85)';
    ctx.lineWidth = 1.4 * px;
    ctx.stroke(paths.streets);
    ctx.fillStyle = 'rgba(86, 78, 72, 0.58)';
    ctx.fill(paths.buildings);
    ctx.lineWidth = 0.45 * px;
    ctx.strokeStyle = 'rgba(40, 34, 30, 0.45)';
    ctx.stroke(paths.buildings);
  });
}
