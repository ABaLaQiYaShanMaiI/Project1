import type { MapData, Town } from '../core/types';
import type { District } from '../core/towns';
import { districtPath, hitDistrict } from '../core/towns';
import type { ControlField } from '../core/scenario';
import { controlAt } from '../core/scenario';
import { buildTerrainCanvas } from './terrain';

export interface View {
  cx: number;
  cy: number;

  scale: number;
}

export type ZoomLevel = 'L0' | 'L1' | 'L2';

export interface Selection {
  kind: 'district' | 'point';
  x: number;
  y: number;
  district?: District;
  townId?: string;
}

export interface HoverInfo {
  town: Town;
  district: District;
}

export interface RenderState {
  level: ZoomLevel;
  hover: HoverInfo | null;
  selected: Selection | null;
  showControl: boolean;
  showIntel: boolean;
}

const LEVEL: Record<ZoomLevel, number> = { L0: 0, L1: 1, L2: 2 };

const ROAD_STYLE: Record<string, { color: string; width: number; minLevel: number }> = {
  motorway: { color: '#c0492a', width: 3.6, minLevel: 0 },
  trunk: { color: '#c9772a', width: 2.9, minLevel: 0 },
  primary: { color: '#b8823f', width: 2.2, minLevel: 0 },
  secondary: { color: '#9a8a6e', width: 1.5, minLevel: 1 },
};

const CITY_STYLE: Record<string, { r: number; minLevel: number; font: number }> = {
  city: { r: 5.2, minLevel: 0, font: 13 },
  town: { r: 4.0, minLevel: 0, font: 12 },
  village: { r: 2.4, minLevel: 2, font: 10.5 },
};

const RANK: Record<string, number> = { city: 0, town: 1, village: 2 };
const MIN_ZOOM: Record<string, number> = { city: 0, town: 1.0, village: 1.6 };
const PAD: Record<string, number> = { city: 2, town: 8, village: 22 };

export class MapRenderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private statCv: HTMLCanvasElement;
  private statCtx: CanvasRenderingContext2D;
  private terrainCv: HTMLCanvasElement;
  private coverCv: HTMLCanvasElement;
  private urbanImg: HTMLImageElement | null = null;
  private overlayCv: HTMLCanvasElement = document.createElement('canvas');
  private overlayCtx: CanvasRenderingContext2D = this.overlayCv.getContext('2d')!;
  private controlCv: HTMLCanvasElement | null = null;
  private intelCv: HTMLCanvasElement | null = null;
  private field: ControlField | null = null;
  private showControl = true;
  private showIntel = true;

  view: View = { cx: 0, cy: 0, scale: 0.01 };
  private baseScale = 0.01;
  private level: ZoomLevel = 'L0';
  private dirty = true;

  private static readonly OVERSCAN = 220;
  private statView: View = { cx: 0, cy: 0, scale: 0.01 };

  w = 0;
  h = 0;
  dpr = 1;

  lastRebuildMs = 0;
  lastDrawMs = 0;
  segmentCount = 0;
  visibleTowns = 0;

  constructor(canvas: HTMLCanvasElement, private data: MapData) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.statCv = document.createElement('canvas');
    this.statCtx = this.statCv.getContext('2d')!;

    const m = data.meta;
    const [spanX, spanY] = m.spanM;
    const cellW = spanX / (m.dem.cols - 1);
    const cellH = spanY / (m.dem.rows - 1);
    this.terrainCv = buildTerrainCanvas(m.dem, cellW, cellH);
    this.coverCv = this.buildCoverCanvas();
    const img = new Image();
    img.onload = () => {
      this.urbanImg = img;
      this.dirty = true;
    };
    img.src = '/data/' + data.meta.urbanMask.file;

  }

  private buildCoverCanvas(): HTMLCanvasElement {
    const lc = this.data.meta.landcover;
    const cv = document.createElement('canvas');
    cv.width = lc.cols;
    cv.height = lc.rows;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(lc.cols, lc.rows);
    const d = img.data;
    const COLORS: Record<number, [number, number, number, number]> = {
      0: [0, 0, 0, 0],
      1: [52, 84, 52, 120],
      2: [116, 104, 98, 70],
      3: [56, 104, 150, 190],
    };
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

  setControl(field: ControlField | null): void {
    this.field = field;
    if (!field) {
      this.controlCv = null;
      this.intelCv = null;
      this.dirty = true;
      return;
    }
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

    this.controlCv = mk((k) => {
      const o = field.owner[k];
      if (o === 0) return [58, 110, 190, 58];
      if (o === 1) return [186, 76, 58, 52];
      return [176, 148, 64, 66];
    });

    this.intelCv = mk((k) => {
      if (field.owner[k] !== 1) return [0, 0, 0, 0];
      const a = Math.round((1 - field.conf[k]) * 95);
      return [90, 36, 52, a];
    });

    this.dirty = true;
  }

  resize(w: number, h: number, dpr: number): void {
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    const ov = MapRenderer.OVERSCAN;
    this.overlayCv.width = Math.round(w * dpr);
    this.overlayCv.height = Math.round(h * dpr);
    this.statCv.width = Math.round((w + ov * 2) * dpr);
    this.statCv.height = Math.round((h + ov * 2) * dpr);
    this.dirty = true;
  }

  fit(): void {
    const [spanX, spanY] = this.data.meta.spanM;
    const s = Math.min(this.w / spanX, this.h / spanY) * 0.94;
    this.baseScale = s;
    this.view = { cx: 0, cy: 0, scale: s };
    this.dirty = true;
  }

  get fitScale(): number {
    return this.baseScale;
  }

  private get zoomFactor(): number {
    return Math.max(0.7, Math.min(2.6, this.view.scale / this.baseScale));
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: this.view.cx + (sx - this.w / 2) / this.view.scale,
      y: this.view.cy - (sy - this.h / 2) / this.view.scale,
    };
  }

  districtAtScreen(sx: number, sy: number): { town: Town; district: District } | null {
    const { x, y } = this.screenToWorld(sx, sy);
    return hitDistrict(this.data.towns, x, y);
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    const before = this.screenToWorld(sx, sy);
    const next = Math.max(this.baseScale * 0.55, Math.min(this.baseScale * 12, this.view.scale * factor));
    this.view.scale = next;
    const after = this.screenToWorld(sx, sy);
    this.view.cx += before.x - after.x;
    this.view.cy += before.y - after.y;
    this.clampView();
    this.dirty = true;
  }

  panBy(dxPx: number, dyPx: number): void {
    this.view.cx -= dxPx / this.view.scale;
    this.view.cy += dyPx / this.view.scale;
    this.clampView();
    this.dirty = true;
  }

  private clampView(): void {
    const [spanX, spanY] = this.data.meta.spanM;
    const halfW = this.w / (2 * this.view.scale);
    const halfH = this.h / (2 * this.view.scale);
    const limX = Math.max(0, spanX / 2 - halfW + 60 / this.view.scale);
    const limY = Math.max(0, spanY / 2 - halfH + 60 / this.view.scale);
    this.view.cx = Math.max(-limX, Math.min(limX, this.view.cx));
    this.view.cy = Math.max(-limY, Math.min(limY, this.view.cy));
  }

  setLevel(level: ZoomLevel): void {
    if (level === this.level) return;
    this.level = level;
    this.dirty = true;
  }

  private sx(wx: number): number {
    return (wx - this.view.cx) * this.view.scale + this.w / 2;
  }
  private sy(wy: number): number {
    return -(wy - this.view.cy) * this.view.scale + this.h / 2;
  }

  private rebuildStatic(): void {
    const t0 = performance.now();
    const ctx = this.statCtx;
    const [spanX, spanY] = this.data.meta.spanM;
    const lv = LEVEL[this.level];
    const zf = this.zoomFactor;
    const ov = MapRenderer.OVERSCAN;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, ov * this.dpr, ov * this.dpr);
    ctx.fillStyle = '#12161c';
    ctx.fillRect(-ov, -ov, this.w + ov * 2, this.h + ov * 2);

    const x0 = this.sx(-spanX / 2);
    const y0 = this.sy(spanY / 2);
    const dx = spanX * this.view.scale;
    const dy = spanY * this.view.scale;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.terrainCv, x0, y0, dx, dy);
    ctx.drawImage(this.coverCv, x0, y0, dx, dy);
    if (this.urbanImg) {
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 0.75;
      ctx.drawImage(this.urbanImg, x0, y0, dx, dy);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = true;
    }

    const ctlAlpha = lv === 0 ? 1 : lv === 1 ? 0.82 : 0.62;
    if (this.showControl && this.controlCv) {
      ctx.globalAlpha = ctlAlpha;
      ctx.drawImage(this.controlCv, x0, y0, dx, dy);
      ctx.globalAlpha = 1;
    }
    if (this.showIntel && this.intelCv) {
      ctx.globalAlpha = ctlAlpha;
      ctx.drawImage(this.intelCv, x0, y0, dx, dy);
      ctx.globalAlpha = 1;
    }

    this.drawContours(ctx, lv === 2 ? 25 : 50);

    ctx.fillStyle = 'rgba(74, 126, 172, 0.62)';
    for (const w of this.data.water) this.fillPoly(ctx, w.p);
    ctx.strokeStyle = 'rgba(62, 112, 160, 0.78)';
    ctx.lineWidth = Math.max(0.7, 1.0 * zf);
    ctx.lineJoin = 'round';
    for (const r of this.data.rivers) this.strokeLine(ctx, r.p, false);

    this.segmentCount = 0;
    const visible = this.data.roads.filter((r) => (ROAD_STYLE[r.c]?.minLevel ?? 2) <= lv);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const pass of [0, 1]) {
      for (const road of visible) {
        const st = ROAD_STYLE[road.c] ?? ROAD_STYLE.secondary;
        const width = st.width * zf;
        ctx.strokeStyle = pass === 0 ? 'rgba(255,252,244,0.5)' : st.color;
        ctx.lineWidth = pass === 0 ? width + 1.6 : width;
        this.strokeLine(ctx, road.p, false);
        this.segmentCount += Math.max(0, road.p.length - 1);
      }
    }

    if (this.showControl && this.field) {
      const f = this.field;
      this.drawInWorld(ctx, () => {
        const px = 1 / this.view.scale;
        ctx.beginPath();
        ctx.moveTo(f.front[0][0], f.front[0][1]);
        for (let i = 1; i < f.front.length; i++) ctx.lineTo(f.front[i][0], f.front[i][1]);
        ctx.setLineDash([10 * px, 7 * px]);
        ctx.lineWidth = 2.8 * px;
        ctx.strokeStyle = 'rgba(26, 24, 28, 0.75)';
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }

    this.drawTowns(ctx, lv);

    this.drawCities(ctx, lv, zf);

    this.lastRebuildMs = performance.now() - t0;
    this.statView = { ...this.view };
    this.dirty = false;
  }

  private drawTowns(ctx: CanvasRenderingContext2D, lv: number): void {
    let count = 0;
    for (const t of this.data.towns) {
      const px = this.sx(t.x);
      const py = this.sy(t.y);
      const rr = t.r * this.view.scale;
      if (px < -rr - 80 || py < -rr - 80 || px > this.w + rr + 80 || py > this.h + rr + 80) continue;
      if (rr < 4) continue;
      count++;
    }

    this.withUrbanClip(ctx, (c) => {
      this.drawInWorld(c, () => {
        const pxPerM = 1 / this.view.scale;
        for (const t of this.data.towns) {
          if (t.kind === 'parcel') continue;
          const px = this.sx(t.x);
          const py = this.sy(t.y);
          const rr = t.r * this.view.scale;
          if (px < -rr - 80 || py < -rr - 80 || px > this.w + rr + 80 || py > this.h + rr + 80) continue;
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

    for (const t of this.data.towns) {
      const px = this.sx(t.x);
      const py = this.sy(t.y);
      const rr = t.r * this.view.scale;
      if (px < -rr - 80 || py < -rr - 80 || px > this.w + rr + 80 || py > this.h + rr + 80) continue;
      if (rr < 10) continue;
      const fs = Math.round((t.pop > 40000 ? 13 : t.pop > 15000 ? 12 : 11) * Math.min(1.25, Math.max(0.95, this.zoomFactor)));
      ctx.font = `700 ${fs}px "Microsoft YaHei", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,253,247,0.92)';
      ctx.strokeText(t.n, px, py - rr * 0.55);
      ctx.fillStyle = 'rgba(38, 30, 24, 0.95)';
      ctx.fillText(t.n, px, py - rr * 0.55);
    }

    if (this.showControl && this.field && this.view.scale > 0.018) {
      for (const t of this.data.towns) {
        if (t.r * this.view.scale < 34) continue;
        for (const d of t.districts) {
          if (d.r1 * this.view.scale < 16) continue;
          const midT = d.shape === 'band' ? (d.t0 + d.t1) / 2 : 0;
          const ang = d.shape === 'wedge' ? (d.a0 + d.a1) / 2 : 0;
          const rad = d.shape === 'wedge' ? (d.r0 + d.r1) / 2 : 0;
          const [aux, auy] = t.axis;
          const wx = d.shape === 'band' ? t.x + aux * midT : d.shape === 'core' ? t.x : t.x + Math.cos(ang) * rad;
          const wy = d.shape === 'band' ? t.y + auy * midT : d.shape === 'core' ? t.y : t.y + Math.sin(ang) * rad;
          const c = controlAt(this.field, wx, wy);
          const px = this.sx(wx);
          const py = this.sy(wy);
          ctx.beginPath();
          ctx.arc(px, py, 3.2, 0, Math.PI * 2);
          ctx.fillStyle =
            c.control === 'ally'
              ? 'rgba(88, 148, 218, 0.95)'
              : c.control === 'enemy'
                ? 'rgba(202, 92, 72, 0.95)'
                : 'rgba(210, 176, 70, 0.95)';
          ctx.fill();
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = 'rgba(255,255,255,0.85)';
          ctx.stroke();
        }
      }
    }

    this.visibleTowns = count;
  }

  private drawInWorld(ctx: CanvasRenderingContext2D, fn: () => void): void {
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(this.view.scale, -this.view.scale);
    ctx.translate(-this.view.cx, -this.view.cy);
    fn();
    ctx.restore();
  }

  private drawContours(ctx: CanvasRenderingContext2D, interval: number): void {
    const { dem, spanM } = this.data.meta;
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
            ctx.moveTo(this.sx(pts[0]), this.sy(pts[1]));
            ctx.lineTo(this.sx(pts[2]), this.sy(pts[3]));
            segs++;
          }
          if (pts.length >= 8) {
            ctx.moveTo(this.sx(pts[4]), this.sy(pts[5]));
            ctx.lineTo(this.sx(pts[6]), this.sy(pts[7]));
            segs++;
          }
        }
      }
    }
    ctx.strokeStyle = 'rgba(112, 84, 52, 0.40)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    this.segmentCount += segs;
  }

  private fillPoly(ctx: CanvasRenderingContext2D, p: Array<[number, number]>): void {
    if (p.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(this.sx(p[0][0]), this.sy(p[0][1]));
    for (let i = 1; i < p.length; i++) ctx.lineTo(this.sx(p[i][0]), this.sy(p[i][1]));
    ctx.closePath();
    ctx.fill();
  }

  private strokeLine(ctx: CanvasRenderingContext2D, p: Array<[number, number]>, close = false): void {
    if (p.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(this.sx(p[0][0]), this.sy(p[0][1]));
    for (let i = 1; i < p.length; i++) ctx.lineTo(this.sx(p[i][0]), this.sy(p[i][1]));
    if (close) ctx.closePath();
    ctx.stroke();
  }

  private drawCities(ctx: CanvasRenderingContext2D, lv: number, zf: number): void {
    const townNames = new Set(this.data.towns.map((t) => t.n));
    const placed: number[][] = [];
    for (const t of this.data.towns) {
      const px = this.sx(t.x);
      const py = this.sy(t.y);
      const rr = Math.max(8, t.r * this.view.scale);
      placed.push([px - rr - 20, py - rr - 22, px + rr + 20, py + rr + 4]);
    }
    const cands = this.data.cities
      .filter((c) => !townNames.has(c.n))
      .filter((c) => (CITY_STYLE[c.r]?.minLevel ?? 2) <= lv)
      .filter((c) => (MIN_ZOOM[c.r] ?? 9) <= zf)
      .sort((a, b) => (RANK[a.r] ?? 3) - (RANK[b.r] ?? 3));

    for (const city of cands) {
      const st = CITY_STYLE[city.r] ?? CITY_STYLE.village;
      const px = this.sx(city.x);
      const py = this.sy(city.y);
      if (px < -60 || py < -40 || px > this.w + 60 || py > this.h + 40) continue;
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

  private withUrbanClip(ctx: CanvasRenderingContext2D, draw: (c: CanvasRenderingContext2D) => void): void {
    const o = this.overlayCtx;
    const dpr = this.dpr;
    o.setTransform(dpr, 0, 0, dpr, 0, 0);
    o.clearRect(0, 0, this.w, this.h);
    draw(o);
    if (this.urbanImg) {
      const [spanX, spanY] = this.data.meta.spanM;
      o.globalCompositeOperation = 'destination-in';
      o.setTransform(dpr, 0, 0, dpr, 0, 0);
      o.drawImage(
        this.urbanImg,
        this.sx(-spanX / 2),
        this.sy(spanY / 2),
        spanX * this.view.scale,
        spanY * this.view.scale,
      );
      o.globalCompositeOperation = 'source-over';
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.overlayCv, 0, 0);
    ctx.restore();
  }

  private highlightDistrict(ctx: CanvasRenderingContext2D, t: Town, d: District, selected: boolean): void {
    const path = districtPath(t, d);
    this.withUrbanClip(ctx, (c) => {
      this.drawInWorld(c, () => {
        c.fillStyle = selected ? 'rgba(255, 176, 32, 0.42)' : 'rgba(255, 255, 255, 0.18)';
        c.fill(path);
        c.lineWidth = (selected ? 2.0 : 1.3) / this.view.scale;
        c.strokeStyle = selected ? '#ffb020' : 'rgba(255,255,255,0.8)';
        c.stroke(path);
      });
    });
  }

  render(state: RenderState): void {
    const t0 = performance.now();
    if (state.level !== this.level) this.setLevel(state.level);
    if (state.showControl !== this.showControl || state.showIntel !== this.showIntel) {
      this.showControl = state.showControl;
      this.showIntel = state.showIntel;
      this.dirty = true;
    }

    const ov = MapRenderer.OVERSCAN;
    const zoomChanged = Math.abs(this.view.scale - this.statView.scale) > 1e-12;
    if (this.dirty || zoomChanged || this.statCv.width === 0) this.rebuildStatic();

    let dx = (this.statView.cx - this.view.cx) * this.view.scale;
    let dy = (this.view.cy - this.statView.cy) * this.view.scale;
    if (Math.abs(dx) > ov * 0.92 || Math.abs(dy) > ov * 0.92) {
      this.rebuildStatic();
      dx = 0;
      dy = 0;
    }

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#12161c';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.drawImage(this.statCv, -ov + dx, -ov + dy, this.statCv.width / this.dpr, this.statCv.height / this.dpr);

    if (state.hover && state.hover.district.key !== state.selected?.district?.key) {
      this.highlightDistrict(ctx, state.hover.town, state.hover.district, false);
    }
    if (state.selected?.kind === 'district' && state.selected.district) {
      const t = this.data.towns.find((x) => x.id === state.selected!.townId);
      if (t) this.highlightDistrict(ctx, t, state.selected.district, true);
    } else if (state.selected) {
      const px = this.sx(state.selected.x);
      const py = this.sy(state.selected.y);
      ctx.strokeStyle = '#ffb020';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(px - 7, py);
      ctx.lineTo(px + 7, py);
      ctx.moveTo(px, py - 7);
      ctx.lineTo(px, py + 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    this.drawScaleBar(ctx);
    ctx.font = '10px "Microsoft YaHei", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    const attr = this.data.meta.attribution;
    const tw = ctx.measureText(attr).width;
    ctx.fillStyle = 'rgba(20,24,30,0.5)';
    ctx.fillRect(this.w - tw - 10, this.h - 16, tw + 8, 14);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillText(attr, this.w - 6, this.h - 4);

    this.lastDrawMs = performance.now() - t0;
  }

  private drawScaleBar(ctx: CanvasRenderingContext2D): void {
    const targetPx = 130;
    const metersPerPx = 1 / this.view.scale;
    const raw = targetPx * metersPerPx;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const nice = [1, 2, 5, 10].map((k) => k * pow).find((v) => v >= raw) ?? 10 * pow;
    const px = nice / metersPerPx;
    const x = 16;
    const y = this.h - 26;
    ctx.strokeStyle = 'rgba(20,24,30,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 6);
    ctx.lineTo(x + px, y - 6);
    ctx.lineTo(x + px, y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(20,24,30,0.85)';
    ctx.font = '600 11px "Microsoft YaHei", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(nice >= 1000 ? `${(nice / 1000).toFixed(nice % 1000 ? 1 : 0)} km` : `${nice} m`, x + px / 2, y - 8);
  }
}
