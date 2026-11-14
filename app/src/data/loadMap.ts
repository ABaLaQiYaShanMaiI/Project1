import type { MapData } from '../core/types';

function mapUrl(): string {
  const q = new URLSearchParams(location.search).get('map');
  return q || '/data/map_fulda.json';
}

export async function loadMap(): Promise<MapData> {
  const url = mapUrl();
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`地图数据加载失败：HTTP ${res.status}（${url}，先运行 tools/bake_map.py）`);
  const data = (await res.json()) as MapData;
  if (!data.meta?.dem?.values?.length) throw new Error('地图数据缺少 DEM 网格，请重新烘焙');
  return data;
}
