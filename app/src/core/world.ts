export interface WorldMeta {
  name: string;
  projection: 'web-mercator';
  zoom: number;
  width: number;
  height: number;
  generated: string;
  attribution: string;
}

const SIZE = 2048;

export function lonToX(lon: number): number {
  return ((lon + 180) / 360) * SIZE;
}
export function latToY(lat: number): number {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(Math.PI / 4 + r / 2)) / Math.PI) / 2) * SIZE;
}
export function xToLon(x: number): number {
  return (x / SIZE) * 360 - 180;
}
export function yToLat(y: number): number {
  const n = Math.PI - (2 * Math.PI * y) / SIZE;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export async function loadWorld(): Promise<{ img: HTMLImageElement; meta: WorldMeta }> {
  const metaRes = await fetch('/data/world_meta.json', { cache: 'no-cache' });
  if (!metaRes.ok) throw new Error('世界底图元数据缺失：先运行 python tools/bake_world.py');
  const meta = (await metaRes.json()) as WorldMeta;
  const img = new Image();
  img.src = `/data/world_terrain.jpg?v=${encodeURIComponent(meta.generated)}`;
  await img.decode();
  return { img, meta };
}
