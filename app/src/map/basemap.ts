import type { MapMeta } from '../core/types';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile';
const MERC_M = 156543.03392;

export interface BaseView {
  cx: number;
  cy: number;
  scale: number;
}

export class BasemapTiles {
  enabled = false;
  onLoad: (() => void) | null = null;
  onFail: (() => void) | null = null;
  failedHard = false;
  private meta: MapMeta;
  private cache = new Map<string, HTMLImageElement>();
  private pending = new Set<string>();
  private failed = new Set<string>();
  private errors = 0;
  private loaded = 0;

  constructor(meta: MapMeta) {
    this.meta = meta;
  }

  url(z: number, x: number, y: number): string {
    return `${ESRI}/${z}/${y}/${x}`;
  }

  private zoomFor(scale: number, dpr: number): number {
    const lat0 = this.meta.center[0];
    const z = Math.ceil(Math.log2(MERC_M * Math.cos((lat0 * Math.PI) / 180) * scale * dpr));
    return Math.max(2, Math.min(17, z));
  }

  private get(z: number, x: number, y: number): HTMLImageElement | null {
    const key = `${z}/${x}/${y}`;
    const hit = this.cache.get(key);
    if (hit) {
      this.cache.delete(key);
      this.cache.set(key, hit);
      return hit;
    }
    this.ensure(z, x, y);
    return null;
  }

  private ensure(z: number, x: number, y: number): void {
    const n = 2 ** z;
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    const key = `${z}/${x}/${y}`;
    if (this.cache.has(key) || this.pending.has(key) || this.failed.has(key)) return;
    if (this.pending.size >= 6) return;
    this.pending.add(key);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      this.pending.delete(key);
      this.cache.set(key, img);
      this.loaded += 1;
      this.prune();
      this.onLoad?.();
    };
    img.onerror = () => {
      this.pending.delete(key);
      this.failed.add(key);
      this.errors += 1;
      if (this.loaded === 0 && this.errors >= 6) {
        this.failedHard = true;
        this.onFail?.();
      }
    };
    img.src = this.url(z, x, y);
  }

  private prune(): void {
    while (this.cache.size > 160) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (!oldest) break;
      this.cache.delete(oldest);
    }
  }

  draw(ctx: CanvasRenderingContext2D, view: BaseView, w: number, h: number, dpr = 1): boolean {
    const meta = this.meta;
    const pr = meta.projection;
    const [lat0, lon0] = meta.center;
    const z = this.zoomFor(view.scale, dpr);
    const n = 2 ** z;
    const mppMerc = (MERC_M * Math.cos((lat0 * Math.PI) / 180)) / n;
    const tileScreen = 256 * mppMerc * view.scale;

    const halfW = w / (2 * view.scale);
    const halfH = h / (2 * view.scale);
    const lonOf = (x: number) => lon0 + x / pr.mPerDegLon;
    const latOf = (y: number) => lat0 + y / pr.mPerDegLat;
    const mercX = (lon: number) => ((lon + 180) / 360) * n * 256;
    const mercY = (lat: number) => {
      const r = (lat * Math.PI) / 180;
      return ((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * n * 256;
    };

    const px0 = mercX(lonOf(view.cx - halfW));
    const px1 = mercX(lonOf(view.cx + halfW));
    const py0 = mercY(latOf(view.cy + halfH));
    const py1 = mercY(latOf(view.cy - halfH));
    const tx0 = Math.floor(px0 / 256);
    const tx1 = Math.floor(px1 / 256);
    const ty0 = Math.floor(py0 / 256);
    const ty1 = Math.floor(py1 / 256);

    let drawn = 0;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const img = this.get(z, tx, ty);
        if (!img) continue;
        const lonL = ((tx * 256) / (n * 256)) * 360 - 180;
        const latT = Math.atan(Math.sinh(Math.PI * (1 - (2 * ty * 256) / (n * 256)))) * (180 / Math.PI);
        const xmL = (lonL - lon0) * pr.mPerDegLon;
        const ymT = (latT - lat0) * pr.mPerDegLat;
        const sx = (xmL - view.cx) * view.scale + w / 2;
        const sy = -(ymT - view.cy) * view.scale + h / 2;
        ctx.drawImage(img, sx, sy, tileScreen + 0.5, tileScreen + 0.5);
        drawn++;
      }
    }
    return drawn > 0;
  }
}
