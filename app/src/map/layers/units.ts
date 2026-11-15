import type { Echelon, Unit } from '../../core/units';
import { SIDE_COLOR } from '../../core/markers';
import { platoonCap, type UrbanIndex } from '../../core/urban';
import { districtPath } from '../../core/towns';
import type { PaintCtx } from '../paint';

const W: Record<Echelon, number> = { company: 36, platoon: 28, squad: 20 };
const H: Record<Echelon, number> = { company: 23, platoon: 18, squad: 13 };
const HIT = 18;

function icon(ctx: CanvasRenderingContext2D, u: Unit, w: number, h: number): void {
  const hw = w / 2;
  const hh = h / 2;
  ctx.beginPath();
  switch (u.kind) {
    case 'infantry':
      ctx.moveTo(-hw, -hh);
      ctx.lineTo(hw, hh);
      ctx.moveTo(hw, -hh);
      ctx.lineTo(-hw, hh);
      break;
    case 'armor':
      ctx.ellipse(0, 0, hw * 0.62, hh * 0.55, 0, 0, Math.PI * 2);
      break;
    case 'artillery':
      ctx.arc(0, 0, hh * 0.42, 0, Math.PI * 2);
      break;
    case 'recon':
      ctx.moveTo(-hw, hh);
      ctx.lineTo(hw, -hh);
      ctx.moveTo(-hw * 0.2, hh);
      ctx.lineTo(hw, -hh * 0.2);
      break;
    case 'hq':
      ctx.moveTo(-hw * 0.6, hh);
      ctx.lineTo(-hw * 0.6, -hh);
      ctx.moveTo(-hw * 0.6, -hh);
      ctx.lineTo(hw * 0.7, -hh * 0.1);
      ctx.lineTo(-hw * 0.6, hh * 0.55);
      break;
  }
  ctx.stroke();
}

function echelonMark(ctx: CanvasRenderingContext2D, echelon: Echelon, color: string, h: number): void {
  const y = -h / 2 - 6;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  if (echelon === 'squad') {
    ctx.beginPath();
    ctx.arc(0, y, 2.1, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (echelon === 'platoon') {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(-5 + i * 5, y, 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  ctx.beginPath();
  ctx.moveTo(0, y - 4.5);
  ctx.lineTo(0, y + 4.5);
  ctx.stroke();
}

export function drawPlatoons(
  p: PaintCtx,
  units: Unit[],
  selectedId: string | null,
  hoverId: string | null,
  shown: Set<string>,
): void {
  const { ctx } = p;
  ctx.save();
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'miter';
  for (const u of units) {
    if (!shown.has(u.id)) continue;
    const px = p.sx(u.x);
    const py = p.sy(u.y);
    if (px < -50 || py < -50 || px > p.w + 50 || py > p.h + 50) continue;
    const c = SIDE_COLOR[u.side];
    const sel = u.id === selectedId;
    const hov = u.id === hoverId;
    const scale = sel ? 1.16 : hov ? 1.08 : 1;
    const w = W[u.echelon] * scale;
    const h = H[u.echelon] * scale;

    ctx.save();
    ctx.translate(px, py);

    if (u.posture === 'reserve') ctx.setLineDash([4, 3]);
    else if (u.posture === 'infiltrate') ctx.setLineDash([2, 4]);

    ctx.fillStyle = u.strength < 0.34 ? 'rgba(20,20,24,0.86)' : c.fill;
    ctx.strokeStyle = sel ? '#ffd27a' : c.stroke;
    ctx.lineWidth = sel ? 2.3 : 1.5;
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = c.text;
    ctx.lineWidth = 1.25;
    icon(ctx, u, w * 0.6, h * 0.42);

    if (u.posture === 'barricade') {
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 2, h / 2 + 2.5);
      ctx.lineTo(w / 2 - 2, h / 2 + 2.5);
      ctx.moveTo(-w / 2 + 2, h / 2 + 5);
      ctx.lineTo(w / 2 - 2, h / 2 + 5);
      ctx.strokeStyle = '#c9a15a';
      ctx.lineWidth = 1.3;
      ctx.stroke();
    }

    echelonMark(ctx, u.echelon, u.strength < 0.34 ? '#e08a7a' : c.text, h);

    if (u.strength < 0.34) {
      ctx.beginPath();
      ctx.moveTo(w / 2 - 5, -h / 2 + 1);
      ctx.lineTo(w / 2 - 1, -h / 2 + 1);
      ctx.moveTo(w / 2 - 3, -h / 2 - 1);
      ctx.lineTo(w / 2 - 3, -h / 2 + 3);
      ctx.strokeStyle = '#e08a7a';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    ctx.restore();
  }
  ctx.restore();
}

export function platoonUnderCursor(
  p: PaintCtx,
  units: Unit[],
  shown: Set<string>,
  sx: number,
  sy: number,
): Unit | null {
  let best: Unit | null = null;
  let bestD = HIT;
  for (const u of units) {
    if (!shown.has(u.id)) continue;
    const d = Math.hypot(p.sx(u.x) - sx, p.sy(u.y) - sy);
    if (d <= bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

export function drawOrderLines(p: PaintCtx, units: Unit[], selectedId: string | null): void {
  if (!selectedId) return;
  const root = units.find((u) => u.id === selectedId);
  if (!root) return;
  const o = root.order;
  if ((o.type !== 'move' && o.type !== 'attack') || o.tx == null || o.ty == null) return;
  const { ctx } = p;
  const x0 = p.sx(root.x);
  const y0 = p.sy(root.y);
  const x1 = p.sx(o.tx);
  const y1 = p.sy(o.ty);
  const color = o.type === 'attack' ? 'rgba(214,84,60,0.9)' : 'rgba(120,180,235,0.9)';
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(x1, y1, 6, 0, Math.PI * 2);
  ctx.moveTo(x1 - 9, y1);
  ctx.lineTo(x1 + 9, y1);
  ctx.moveTo(x1, y1 - 9);
  ctx.lineTo(x1, y1 + 9);
  ctx.stroke();
  ctx.restore();
}

export function drawOccupancy(
  p: PaintCtx,
  counts: Map<string, number>,
  idx: UrbanIndex,
  selectedKey: string | null,
): void {
  if (!counts.size) return;
  const { ctx } = p;
  ctx.save();
  p.drawInWorld(ctx, () => {
    const px = 1 / p.view.scale;
    for (const [key, n] of counts) {
      const ref = idx.byKey.get(key);
      if (!ref) continue;
      const cap = platoonCap(ref.district);
      const over = n > cap + 1e-6;
      const full = Math.abs(n - cap) < 1e-6;
      ctx.strokeStyle = over ? 'rgba(214,74,54,0.95)' : full ? 'rgba(214,164,72,0.9)' : 'rgba(120,196,140,0.85)';
      ctx.lineWidth = (key === selectedKey ? 3.4 : 2.2) * px;
      ctx.setLineDash(over ? [7 * px, 4 * px] : []);
      ctx.stroke(districtPath(ref.town, ref.district));
    }
    ctx.setLineDash([]);
  });
  ctx.restore();
}
