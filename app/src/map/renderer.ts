import type { MapData, Town } from '../core/types';
import type { District } from '../core/towns';
import { districtPath, hitDistrict } from '../core/towns';
import type { ControlField } from '../core/scenario';
import type { DetailLayer } from '../core/detail';
import { buildTerrainCanvas } from './terrain';
import { BasemapTiles } from './basemap';
import { buildCoverCanvas } from './layers/landcover';
import { drawContours } from './layers/contours';
import { drawHydro } from './layers/hydro';
import { drawRoads } from './layers/roads';
import {
  countVisibleTowns,
  drawCapturePoints,
  drawTownBlocks,
  drawTownGlow,
  drawTownLabels,
  drawTownMarks,
  drawTownOutlines,
} from './layers/towns';
import { drawCities } from './layers/cities';
import { buildDetailPaths, drawDetailLayer } from './layers/detail';
import { drawOccupancy, drawOrderLines, drawPlatoons, platoonUnderCursor } from './layers/units';
import { urbanIndex, districtCenter, type UrbanIndex } from '../core/urban';
import { visibleUnitIds, type Unit } from '../core/units';
import { buildControlCanvases, drawFrontLine } from './control';
import type { PaintCtx, View } from './paint';

export type { View };

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
  showBasemap: boolean;
  showTerrain: boolean;
  showContours: boolean;
  showHydro: boolean;
  showRoads: boolean;
  showBlocks: boolean;
  showLabels: boolean;
  showUnits: boolean;
  platoons: Unit[];
  selectedPlatoon: string | null;
  hoverPlatoon: string | null;
}

const LEVEL: Record<ZoomLevel, number> = { L0: 0, L1: 1, L2: 2 };

function detectGpu(): boolean {
  try {
    const cv = document.createElement('canvas');
    return Boolean(cv.getContext('webgl2') || cv.getContext('webgl'));
  } catch {
    return false;
  }
}

export class MapRenderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private statCv: HTMLCanvasElement;
  private statCtx: CanvasRenderingContext2D;
  private terrainCv: HTMLCanvasElement;
  private terrainImg: HTMLImageElement | null = null;
  private coverCv: HTMLCanvasElement;
  private urbanImg: HTMLImageElement | null = null;
  private detail: DetailLayer | null = null;
  private detailPaths: { buildings: Path2D; streets: Path2D } | null = null;
  private overlayCv: HTMLCanvasElement = document.createElement('canvas');
  private overlayCtx: CanvasRenderingContext2D = this.overlayCv.getContext('2d')!;
  private controlCv: HTMLCanvasElement | null = null;
  private intelCv: HTMLCanvasElement | null = null;
  private field: ControlField | null = null;
  private showControl = true;
  private showIntel = true;
  private basemap: BasemapTiles | null = null;
  private showBasemap = false;
  private showTerrain = true;
  private showContours = true;
  private showHydro = true;
  private showRoads = true;
  private showBlocks = true;
  private showLabels = true;
  private basemapDirtyTimer = 0;

  view: View = { cx: 0, cy: 0, scale: 0.01 };
  private baseScale = 0.01;
  private level: ZoomLevel = 'L0';
  private dirty = true;

  private static readonly OVERSCAN = 320;
  private statView: View = { cx: 0, cy: 0, scale: 0.01 };

  w = 0;
  h = 0;
  dpr = 1;

  lastRebuildMs = 0;
  lastDrawMs = 0;
  segmentCount = 0;
  visibleTowns = 0;
  private platoons: Unit[] = [];
  private urban: UrbanIndex | null = null;

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
    if (m.terrain) {
      const t = new Image();
      t.onload = () => {
        this.terrainImg = t;
        this.dirty = true;
      };
      t.src = '/data/' + m.terrain.file;
    }
    this.coverCv = buildCoverCanvas(m.landcover);
    const img = new Image();
    img.onload = () => {
      this.urbanImg = img;
      this.dirty = true;
    };
    img.src = '/data/' + data.meta.urbanMask.file;

    this.gpu = detectGpu();

    this.basemap = new BasemapTiles(data.meta);
    this.basemap.onLoad = () => {
      if (this.basemapDirtyTimer) return;
      this.basemapDirtyTimer = window.setTimeout(() => {
        this.basemapDirtyTimer = 0;
        this.dirty = true;
      }, 60);
    };
  }

  get basemapFailed(): boolean {
    return this.basemap?.failedHard ?? false;
  }

  setDetail(layer: DetailLayer | null): void {
    this.detail = layer;
    this.detailPaths = null;
    this.dirty = true;
  }

  get detailLevel(): number {
    return this.detail ? this.detail.buildings.length : 0;
  }

  setControl(field: ControlField | null): void {
    this.field = field;
    if (!field) {
      this.controlCv = null;
      this.intelCv = null;
      this.dirty = true;
      return;
    }
    const cv = buildControlCanvases(field);
    this.controlCv = cv.control;
    this.intelCv = cv.intel;
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

  platoonAtScreen(sx: number, sy: number): Unit | null {
    if (!this.platoons.length) return null;
    const shown = visibleUnitIds(this.platoons, this.view.scale);
    return platoonUnderCursor(this.paint(this.ctx), this.platoons, shown, sx, sy);
  }

  visibleUnitCount(): number {
    if (!this.platoons.length) return 0;
    return visibleUnitIds(this.platoons, this.view.scale).size;
  }

  districtNearScreen(sx: number, sy: number, padPx = 18): { town: Town; district: District } | null {
    const direct = this.districtAtScreen(sx, sy);
    if (direct) return direct;
    const { x, y } = this.screenToWorld(sx, sy);
    const limit = padPx / this.view.scale;
    let best: { town: Town; district: District } | null = null;
    let bestD = Infinity;
    for (const ref of this.urbanRefs().refs) {
      const c = districtCenter(ref.town, ref.district);
      const d = Math.hypot(c[0] - x, c[1] - y);
      if (d < bestD) {
        bestD = d;
        best = { town: ref.town, district: ref.district };
      }
    }
    if (!best) return null;
    const radius = Math.sqrt(Math.max(1e4, best.district.area * 1e6) / Math.PI);
    return bestD <= radius + limit ? best : null;
  }

  urbanRefs(): UrbanIndex {
    if (!this.urban) this.urban = urbanIndex(this.data.towns);
    return this.urban;
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
    this.lastZoomAt = performance.now();
  }

  private lastZoomAt = 0;
  private gpu = true;

  panBy(dxPx: number, dyPx: number): void {
    this.view.cx -= dxPx / this.view.scale;
    this.view.cy += dyPx / this.view.scale;
    this.clampView();
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

  private paint(ctx: CanvasRenderingContext2D): PaintCtx {
    return {
      ctx,
      view: this.view,
      w: this.w,
      h: this.h,
      dpr: this.dpr,
      sx: (wx) => this.sx(wx),
      sy: (wy) => this.sy(wy),
      drawInWorld: (c, fn) => this.drawInWorld(c, fn),
      withUrbanClip: (c, fn) => this.withUrbanClip(c, fn),
    };
  }

  private rebuildStatic(): void {
    const t0 = performance.now();
    const ctx = this.statCtx;
    const p = this.paint(ctx);
    const meta = this.data.meta;
    const [spanX, spanY] = meta.spanM;
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
    const baseDrawn =
      this.showBasemap && this.basemap
        ? this.basemap.draw(ctx, this.view, this.w, this.h, this.dpr)
        : false;
    if (!baseDrawn && this.showTerrain) {
      if (this.terrainImg) {
        ctx.drawImage(this.terrainImg, x0, y0, dx, dy);
      } else {
        ctx.drawImage(this.terrainCv, x0, y0, dx, dy);
      }
      ctx.drawImage(this.coverCv, x0, y0, dx, dy);
      if (this.urbanImg) {
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = lv === 0 ? 0.92 : lv === 1 ? 0.84 : 0.72;
        ctx.drawImage(this.urbanImg, x0, y0, dx, dy);
        ctx.globalAlpha = 1;
        ctx.imageSmoothingEnabled = true;
      }
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

    const contourSegs = baseDrawn || !this.showContours ? 0 : drawContours(p, meta.dem, meta.spanM, lv === 2 ? 25 : 50);

    if (!baseDrawn && this.showHydro) drawHydro(p, this.data.water, this.data.rivers, zf);

    drawTownBlocks(p, this.data.towns, this.field, this.showControl);

    if (this.detail && this.view.scale > 0.035) {
      if (!this.detailPaths) this.detailPaths = buildDetailPaths(this.detail);
      drawDetailLayer(p, this.detailPaths);
    }

    this.segmentCount = contourSegs + (this.showRoads ? drawRoads(p, this.data.roads, lv, zf) : 0);

    drawFrontLine(p, this.field, this.showControl);

    if (this.showBlocks) {
      drawTownGlow(p, this.data.towns);
      drawTownMarks(p, this.data.towns);
      drawTownOutlines(p, this.data.towns);
    }
    if (this.showLabels) {
      drawTownLabels(p, this.data.towns, zf);
    }
    if (this.showBlocks) {
      drawCapturePoints(p, this.data.towns, this.field, this.showControl);
    }
    if (this.showLabels) {
      drawCities(p, this.data.cities, this.data.towns, lv, zf);
    }

    this.visibleTowns = countVisibleTowns(p, this.data.towns);

    this.lastRebuildMs = performance.now() - t0;
    this.statView = { ...this.view };
    this.dirty = false;
  }

  private drawInWorld(ctx: CanvasRenderingContext2D, fn: () => void): void {
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(this.view.scale, -this.view.scale);
    ctx.translate(-this.view.cx, -this.view.cy);
    fn();
    ctx.restore();
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
    const changed =
      state.showControl !== this.showControl ||
      state.showIntel !== this.showIntel ||
      state.showBasemap !== this.showBasemap ||
      state.showTerrain !== this.showTerrain ||
      state.showContours !== this.showContours ||
      state.showHydro !== this.showHydro ||
      state.showRoads !== this.showRoads ||
      state.showBlocks !== this.showBlocks ||
      state.showLabels !== this.showLabels;
    if (changed) {
      this.showControl = state.showControl;
      this.showIntel = state.showIntel;
      this.showBasemap = state.showBasemap;
      this.showTerrain = state.showTerrain;
      this.showContours = state.showContours;
      this.showHydro = state.showHydro;
      this.showRoads = state.showRoads;
      this.showBlocks = state.showBlocks;
      this.showLabels = state.showLabels;
      this.dirty = true;
    }

    const ov = MapRenderer.OVERSCAN;
    const now = performance.now();
    const zoomChanged = Math.abs(this.view.scale - this.statView.scale) > 1e-12;
    const zoomActive = this.gpu && now - this.lastZoomAt < 180;
    const rebuilt = this.dirty || this.statCv.width === 0 || (zoomChanged && !zoomActive);
    if (rebuilt) this.rebuildStatic();

    let dx = (this.statView.cx - this.view.cx) * this.view.scale;
    let dy = (this.view.cy - this.statView.cy) * this.view.scale;
    if (!rebuilt && (Math.abs(dx) > ov * 0.92 || Math.abs(dy) > ov * 0.92)) {
      this.rebuildStatic();
      dx = 0;
      dy = 0;
    }

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#12161c';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (zoomChanged && !this.dirty) {
      const r = this.view.scale / this.statView.scale;
      const cxOld = (this.statView.cx - this.view.cx) * this.view.scale + this.w / 2;
      const cyOld = -(this.statView.cy - this.view.cy) * this.view.scale + this.h / 2;
      const smooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        this.statCv,
        cxOld - (this.w / 2 + ov) * r,
        cyOld - (this.h / 2 + ov) * r,
        (this.w + ov * 2) * r,
        (this.h + ov * 2) * r,
      );
      ctx.imageSmoothingEnabled = smooth;
    } else {
      ctx.drawImage(this.statCv, -ov + dx, -ov + dy, this.statCv.width / this.dpr, this.statCv.height / this.dpr);
    }

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

    this.drawUnits(ctx, state);

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

  private drawUnits(ctx: CanvasRenderingContext2D, state: RenderState): void {
    this.platoons = state.platoons;
    if (!state.showUnits || !this.platoons.length) return;
    const p = this.paint(ctx);
    const idx = this.urbanRefs();
    const counts = new Map<string, number>();
    for (const u of this.platoons) counts.set(u.districtKey, (counts.get(u.districtKey) ?? 0) + 1);
    const selKey = this.platoons.find((u) => u.id === state.selectedPlatoon)?.districtKey ?? null;
    drawOccupancy(p, counts, idx, selKey);
    const shown = visibleUnitIds(this.platoons, this.view.scale);
    drawOrderLines(p, this.platoons, state.selectedPlatoon);
    drawPlatoons(p, this.platoons, state.selectedPlatoon, state.hoverPlatoon, shown);
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
