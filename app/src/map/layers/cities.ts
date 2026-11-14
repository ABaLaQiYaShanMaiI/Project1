import type { City, Town } from '../../core/types';
import type { PaintCtx } from '../paint';

const CITY_STYLE: Record<string, { r: number; minLevel: number; font: number }> = {
  city: { r: 5.2, minLevel: 0, font: 13 },
  town: { r: 4.0, minLevel: 0, font: 12 },
  village: { r: 2.4, minLevel: 2, font: 10.5 },
};

const RANK: Record<string, number> = { city: 0, town: 1, village: 2 };
const MIN_ZOOM: Record<string, number> = { city: 0, town: 1.0, village: 1.6 };
const PAD: Record<string, number> = { city: 2, town: 8, village: 22 };

export function drawCities(p: PaintCtx, cities: City[], towns: Town[], lv: number, zf: number): void {
  const { ctx } = p;
  const townNames = new Set(towns.map((t) => t.n));
  const placed: number[][] = [];
  for (const t of towns) {
    const px = p.sx(t.x);
    const py = p.sy(t.y);
    const rr = Math.max(8, t.r * p.view.scale);
    placed.push([px - rr - 20, py - rr - 22, px + rr + 20, py + rr + 4]);
  }
  const cands = cities
    .filter((c) => !townNames.has(c.n))
    .filter((c) => (CITY_STYLE[c.r]?.minLevel ?? 2) <= lv)
    .filter((c) => (MIN_ZOOM[c.r] ?? 9) <= zf)
    .sort((a, b) => (RANK[a.r] ?? 3) - (RANK[b.r] ?? 3));

  for (const city of cands) {
    const st = CITY_STYLE[city.r] ?? CITY_STYLE.village;
    const px = p.sx(city.x);
    const py = p.sy(city.y);
    if (px < -60 || py < -40 || px > p.w + 60 || py > p.h + 40) continue;
    const fs = Math.round(st.font * Math.min(1.25, Math.max(0.9, zf)));
    ctx.font = `600 ${fs}px "Microsoft YaHei", system-ui, sans-serif`;
    const tw = ctx.measureText(city.n).width;
    const pad = PAD[city.r] ?? 10;
    const box = [px - st.r - 4 - pad, py - fs * 0.7 - pad * 0.4, px + st.r + 6 + tw + pad, py + fs * 0.7 + pad * 0.4];
    let clash = false;
    for (const b of placed) {
      if (!(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3])) {
        clash = true;
        break;
      }
    }
    if (clash) continue;
    placed.push(box);
    ctx.beginPath();
    ctx.arc(px, py, st.r * Math.min(1.4, zf), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(38, 33, 30, 0.8)';
    ctx.fill();
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = 'rgba(255,250,240,0.8)';
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = 'rgba(255,253,247,0.85)';
    ctx.strokeText(city.n, px + st.r + 3, py);
    ctx.fillStyle = 'rgba(28, 26, 24, 0.92)';
    ctx.fillText(city.n, px + st.r + 3, py);
  }
}
