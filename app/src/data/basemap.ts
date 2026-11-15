import type { WorldMeta } from '../core/world';

export interface BasemapSource {
  id: string;
  label: string;
  attribution: string;
  minZoom: number;
  maxZoom: number;
  tileSize: number;
  maxConcurrent: number;
  local: boolean;
  url(z: number, x: number, y: number): string;
}

export function localBasemap(meta: WorldMeta): BasemapSource {
  return {
    id: 'local',
    label: '本地烘焙',
    attribution: meta.attribution,
    minZoom: meta.minZoom,
    maxZoom: meta.maxZoom,
    tileSize: meta.tileSize,
    maxConcurrent: 80,
    local: true,
    url: (z, x, y) => meta.path.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)),
  };
}

const OPENTOPO = 'https://a.tile.opentopomap.org';
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';

export function mapTilerKey(): string {
  try {
    return localStorage.getItem('maptilerKey') ?? '';
  } catch {
    return '';
  }
}

export function saveMapTilerKey(v: string): void {
  try {
    localStorage.setItem('maptilerKey', v.trim());
  } catch {
    return;
  }
}

export function mapTilerSources(): BasemapSource[] {
  const key = mapTilerKey();
  if (!key) return [];
  return [
    {
      id: 'mt-topo',
      label: 'MapTiler 地形',
      attribution: '© MapTiler · © OpenStreetMap contributors',
      minZoom: 1,
      maxZoom: 16,
      tileSize: 256,
      maxConcurrent: 4,
      local: false,
      url: (z, x, y) => `https://api.maptiler.com/maps/topo-v2/${z}/${x}/${y}.png?key=${key}`,
    },
    {
      id: 'mt-sat',
      label: 'MapTiler 卫星',
      attribution: '© MapTiler · © OpenStreetMap contributors',
      minZoom: 1,
      maxZoom: 16,
      tileSize: 256,
      maxConcurrent: 4,
      local: false,
      url: (z, x, y) => `https://api.maptiler.com/maps/satellite-v2/${z}/${x}/${y}.png?key=${key}`,
    },
  ];
}

export function onlineBasemaps(): BasemapSource[] {
  return [
    {
      id: 'esri-topo',
      label: '在线地形（Esri Topo）',
      attribution: '© Esri, HERE, Garmin, © OpenStreetMap contributors',
      minZoom: 2,
      maxZoom: 14,
      tileSize: 256,
      maxConcurrent: 4,
      local: false,
      url: (z, x, y) => `${ESRI}/World_Topo_Map/MapServer/tile/${z}/${y}/${x}`,
    },
    {
      id: 'esri-imagery',
      label: '卫星影像（Esri）',
      attribution: '© Esri, Maxar, Earthstar Geographics',
      minZoom: 2,
      maxZoom: 12,
      tileSize: 256,
      maxConcurrent: 4,
      local: false,
      url: (z, x, y) => `${ESRI}/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
    },
    {
      id: 'opentopomap',
      label: '在线地形（OpenTopoMap，第三方）',
      attribution: '© OpenTopoMap (CC-BY-SA) · © OpenStreetMap contributors',
      minZoom: 2,
      maxZoom: 12,
      tileSize: 256,
      maxConcurrent: 4,
      local: false,
      url: (z, x, y) => `${OPENTOPO}/${z}/${x}/${y}.png`,
    },
  ];
}
