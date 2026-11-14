import type { WorldMeta, WorldVectors } from '../core/world';

export interface WorldSource {
  meta: WorldMeta;
  img: HTMLImageElement | null;
  tiles: TileSet | null;
}

export class TileSet {
  readonly meta: WorldMeta;
  onLoad: (() => void) | null = null;
  private cache = new Map<string, HTMLImageElement>();
  private pending = new Set<string>();
  private failed = new Set<string>();
  private limit = 220;

  constructor(meta: WorldMeta) {
    this.meta = meta;
  }

  get size(): number {
    return this.cache.size;
  }

  get loading(): number {
    return this.pending.size;
  }

  url(z: number, x: number, y: number): string {
    return this.meta.path.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y));
  }

  get(z: number, x: number, y: number): HTMLImageElement | null {
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

  ensure(z: number, x: number, y: number): void {
    const n = 2 ** z;
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    const key = `${z}/${x}/${y}`;
    if (this.cache.has(key) || this.pending.has(key) || this.failed.has(key)) return;
    if (this.pending.size > 80) return;
    this.pending.add(key);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      this.pending.delete(key);
      this.cache.set(key, img);
      this.prune();
      this.onLoad?.();
    };
    img.onerror = () => {
      this.pending.delete(key);
      this.failed.add(key);
    };
    img.src = this.url(z, x, y);
  }

  private prune(): void {
    while (this.cache.size > this.limit) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (!oldest) break;
      this.cache.delete(oldest);
    }
  }
}

export async function loadWorld(): Promise<WorldSource> {
  try {
    const res = await fetch('/data/world/meta.json', { cache: 'no-cache' });
    if (res.ok) {
      const meta = (await res.json()) as WorldMeta;
      meta.mode = 'tiles';
      return { meta, img: null, tiles: new TileSet(meta) };
    }
  } catch {
    return loadFlatWorld();
  }
  return loadFlatWorld();
}

async function loadFlatWorld(): Promise<WorldSource> {
  const metaRes = await fetch('/data/world_meta.json', { cache: 'no-cache' });
  if (!metaRes.ok) throw new Error('世界底图缺失：先运行 python Tools/bake_world.py --from-image');
  const old = (await metaRes.json()) as WorldMeta;
  old.mode = 'image';
  old.minZoom = old.zoom ?? 3;
  old.maxZoom = old.minZoom;
  old.levels = [old.minZoom];
  old.tileSize = 256;
  old.path = '';
  const img = new Image();
  img.src = `/data/world_terrain.jpg?v=${encodeURIComponent(old.generated)}`;
  await img.decode();
  return { meta: old, img, tiles: null };
}

export async function loadWorldVectors(): Promise<WorldVectors | null> {
  try {
    const res = await fetch('/data/world/vectors.json', { cache: 'no-cache' });
    if (!res.ok) return null;
    const data = (await res.json()) as WorldVectors;
    if (!Array.isArray(data.cities) || !Array.isArray(data.roads)) return null;
    return data;
  } catch {
    return null;
  }
}
