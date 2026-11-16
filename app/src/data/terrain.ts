const MERC = 156543.03392;

export interface DemManifest {
  key: string;
  encoding: string;
  tileSize: number;
  minzoom: number;
  maxzoom: number;
  bbox: [number, number, number, number];
  tiles: string;
  attribution: string;
  sizeMB: number;
}

export interface DemTiles {
  tiles: string;
  minzoom: number;
  maxzoom: number;
  bbox: [number, number, number, number];
  tileSize?: number;
}

interface Loaded {
  data: Uint8ClampedArray;
  size: number;
}

export class DemSampler {
  private cache = new Map<string, Loaded>();
  private pending = new Set<string>();
  private failed = new Set<string>();
  private order: string[] = [];
  private listeners = new Set<() => void>();
  readonly zoom: number;

  constructor(readonly man: DemTiles) {
    this.zoom = man.maxzoom;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  private tileUrl(z: number, x: number, y: number): string {
    return this.man.tiles.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
  }

  private tileOf(lat: number, lon: number, z: number): { x: number; y: number; fx: number; fy: number } {
    const n = 2 ** z;
    const wx = ((lon + 180) / 360) * n;
    const r = (lat * Math.PI) / 180;
    const wy = ((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * n;
    return { x: Math.floor(wx), y: Math.floor(wy), fx: wx - Math.floor(wx), fy: wy - Math.floor(wy) };
  }

  private load(z: number, x: number, y: number): Loaded | null {
    const key = `${z}/${x}/${y}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    if (this.pending.has(key) || this.failed.has(key)) return null;
    this.pending.add(key);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = img.width;
      cv.height = img.height;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        this.pending.delete(key);
        this.failed.add(key);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, img.width, img.height).data;
      this.cache.set(key, { data, size: img.width });
      this.order.push(key);
      this.pending.delete(key);
      while (this.order.length > 48) {
        const old = this.order.shift();
        if (old) this.cache.delete(old);
      }
      this.emit();
    };
    img.onerror = () => {
      this.pending.delete(key);
      this.failed.add(key);
    };
    img.src = this.tileUrl(z, x, y);
    return null;
  }

  private pixel(lat: number, lon: number): number | null {
    const t = this.tileOf(lat, lon, this.zoom);
    const tile = this.load(this.zoom, t.x, t.y);
    if (!tile) return null;
    const px = Math.min(tile.size - 1, Math.max(0, Math.floor(t.fx * tile.size)));
    const py = Math.min(tile.size - 1, Math.max(0, Math.floor(t.fy * tile.size)));
    const i = (py * tile.size + px) * 4;
    const d = tile.data;
    return d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768;
  }

  elevation(lat: number, lon: number): number | null {
    return this.pixel(lat, lon);
  }

  groundResolution(lat: number): number {
    return (MERC * Math.cos((lat * Math.PI) / 180)) / 2 ** this.zoom;
  }

  sample(lat: number, lon: number): { elevation: number; slope: number; aspect: number } | null {
    const d = this.groundResolution(lat);
    const dLat = (4 * d) / 111320;
    const dLon = dLat / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    const z0 = this.elevation(lat, lon);
    const zx = this.elevation(lat, lon + dLon);
    const zy = this.elevation(lat + dLat, lon);
    if (z0 == null || zx == null || zy == null) return null;
    const dzdx = (zx - z0) / (4 * d);
    const dzdy = (zy - z0) / (4 * d);
    const slope = Math.hypot(dzdx, dzdy) * 100;
    const aspect = ((Math.atan2(-dzdx, -dzdy) * 180) / Math.PI + 360) % 360;
    return { elevation: z0, slope, aspect };
  }
}

export async function loadDemManifest(key: string): Promise<DemManifest | null> {
  try {
    const res = await fetch(`/data/dem/${key}/index.json`, { cache: 'no-cache' });
    if (!res.ok) return null;
    const man = (await res.json()) as DemManifest;
    if (!man?.tiles) return null;
    return man;
  } catch {
    return null;
  }
}
