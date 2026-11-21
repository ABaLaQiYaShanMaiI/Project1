import type { MapLang } from './data/style/lang';
import type { LayerKey } from './store';
import type { Side, UnitKind } from './core/markers';

export type UiLang = 'zh' | 'en';
export type ModKey = 'move' | 'defend' | 'recon' | 'arty' | 'supply';

export interface UiStrings {
  brand: string;
  brandSub: string;
  worldMap: string;
  loading: string;
  localPmtiles: string;
  layers: (n: number) => string;
  offline: (max: number, mb: number) => string;
  markers: (n: number) => string;
  ariaLang: string;
  ariaStatus: string;
  mapType: string;
  persona: Record<string, { label: string; sub: string }>;
  forceDetail: string;
  forceHint: string;
  liteHint: string;
  customHint: string;
  advanced: string;
  markersPanel: string;
  placing: (side: string, unit: string) => string;
  placeHint: string;
  clearMarkers: (n: number) => string;
  basemap: string;
  basemapMeta: (mb: number) => string;
  reading: string;
  units: Record<UnitKind, string>;
  sides: Record<Side, string>;
  groups: Record<string, string>;
  items: Record<LayerKey, string>;
  mods: Record<ModKey, string>;
  measure: string;
  measuring: string;
  distance: string;
  bearing: string;
  slopePair: string;
  elevationPair: string;
  profile: string;
  terrainLoading: string;
  failure: string;
  damage: string;
  damageLevel: (n: number) => string;
  loadingMap: string;
  ring: string;
  ringSpacing: (km: number, outer: number) => string;
  cityPanel: (name: string) => string;
  intensity: (pct: number, km: string) => string;
  elevationAt: (v: number | null) => string;
  slopeAt: (v: number) => string;
  aspectAt: (v: string) => string;
  readoutHint: string;
  placingMarker: string;
  damageHint: string;
  panHint: string;
  global: string;
  markerHint: string;
  dirs: string[];
}

const ZH: UiStrings = {
  brand: '战术地图军棋',
  brandSub: 'TACTICAL MAP WARGAME',
  worldMap: '世界地图',
  loading: '载入中',
  localPmtiles: '本地 PMTiles',
  layers: (n) => `${n} 层底图`,
  offline: (max, mb) => `z0–z${max} · ${mb} MB · 离线`,
  markers: (n) => `${n} 兵牌`,
  ariaLang: '地名语言',
  ariaStatus: '状态',
  mapType: '图种',
  persona: {
    terrain: { label: '地势·交通图', sub: '分层设色 · 坡度 · 等高线 · 铁路与主干公路' },
    city: { label: '用地·政区图', sub: '用地 · 行政 · 全级路网' },
  },
  forceDetail: '跨级显示细节',
  forceHint: '开启后：主干/次级道路、跑道与设施气泡不再受各自起始缩放限制（铁路与等高线本就分档连续）',
  liteHint: '低配模式：晕渲、坡度与等高线默认关闭',
  customHint: '手动改「高级图层」会退出当前图种',
  advanced: '高级图层',
  markersPanel: '兵牌',
  placing: (side, unit) => `点击地图放置${side}${unit}；右键删除`,
  placeHint: '选兵种后点击地图放置；拖动移动，右键删除',
  clearMarkers: (n) => `清空全部兵牌（${n}）`,
  basemap: '底图',
  basemapMeta: (mb) => `体积 ${mb} MB · 全程离线 · 数据 © OpenStreetMap contributors (ODbL) · Wikidata (CC0)`,
  reading: '正在读取 data/tiles/index.json …',
  units: { infantry: '步兵', armor: '装甲', artillery: '炮兵', recon: '侦察', hq: '指挥' },
  sides: { nato: '北约', wp: '华约' },
  groups: {
    terrain: '地形图',
    water: '水系',
    transport: '交通',
    settle: '居民地',
    admin: '行政',
    land: '地表',
    military: '军事',
    tools: '判读',
  },
  items: {
    relief: '晕渲',
    contour: '等高线',
    slope: '坡度通行',
    water: '水域 · 河流',
    rail: '铁路',
    road: '主干公路',
    minor: '次要道路',
    airport: '机场 · 跑道',
    urban: '城区灰块',
    building: '建筑物',
    label: '地名标注',
    boundary: '行政边界',
    landcover: '林地 · 农田 · 绿地',
    military: '军事用地',
    damage: '城区战损',
    grid: '军用格网',
    rings: '射程圈',
    poi: '设施气泡',
  },
  mods: { move: '机动', defend: '防御', recon: '侦察', arty: '炮兵', supply: '补给' },
  measure: '测距',
  measuring: '点击选点（再点关闭）',
  distance: '直线距离',
  bearing: '方位',
  slopePair: '高差 / 平均坡',
  elevationPair: '高程 A / B',
  profile: '地形剖面',
  terrainLoading: '地形数据加载中…',
  failure: '还没有底图包，请先运行 Tools/fetch_basemap.mjs',
  damage: '战损',
  damageLevel: (n) => `战损 ${n} 级`,
  loadingMap: '正在载入底图…',
  ring: '射程圈',
  ringSpacing: (km, outer) => `圈间距 ${km} km · 最外 ${outer} km`,
  cityPanel: (name) => `城区影响 · ${name || '城区'}`,
  intensity: (pct, km) => `强度 ${pct}% · 半径 ${km} km`,
  elevationAt: (v) => (v == null ? '高程 …' : `高程 ${v} m`),
  slopeAt: (v) => `坡度 ${v}%`,
  aspectAt: (v) => `坡向 ${v}`,
  readoutHint: '移动鼠标读取坐标 · 高程 · 坡度',
  placingMarker: '单击地图放置兵牌；右键兵牌删除',
  damageHint: '单击城区标记战损（+1，最高 3 级）· Shift+单击清除',
  panHint: '拖动平移 · 滚轮缩放 · 双击放大',
  global: '全球',
  markerHint: '拖动移动 · 右键删除',
  dirs: ['北', '东北', '东', '东南', '南', '西南', '西', '西北'],
};

const EN: UiStrings = {
  brand: 'Tactical Map Wargame',
  brandSub: 'TACTICAL MAP WARGAME',
  worldMap: 'World map',
  loading: 'Loading',
  localPmtiles: 'Local PMTiles',
  layers: (n) => `${n} basemap layers`,
  offline: (max, mb) => `z0–z${max} · ${mb} MB · offline`,
  markers: (n) => `${n} markers`,
  ariaLang: 'Map language',
  ariaStatus: 'Status',
  mapType: 'Map type',
  persona: {
    terrain: { label: 'Terrain · transport', sub: 'Hypsometric tint · slope · contours · rail and main roads' },
    city: { label: 'Land use · admin', sub: 'Land use · boundaries · full road network' },
  },
  forceDetail: 'Force detail at all zooms',
  forceHint: 'When on: main/secondary roads, runways and facility dots ignore their min-zoom (rail and contours are already continuous by band)',
  liteHint: 'Lite mode: hillshade, slope and contours start off',
  customHint: 'Changing Advanced layers leaves the current map type',
  advanced: 'Advanced layers',
  markersPanel: 'Markers',
  placing: (side, unit) => `Click the map to place ${side} ${unit}; right-click to remove`,
  placeHint: 'Pick a unit, then click the map to place; drag to move, right-click to remove',
  clearMarkers: (n) => `Clear all markers (${n})`,
  basemap: 'Basemap',
  basemapMeta: (mb) => `Size ${mb} MB · fully offline · data © OpenStreetMap contributors (ODbL) · Wikidata (CC0)`,
  reading: 'Reading data/tiles/index.json …',
  units: { infantry: 'infantry', armor: 'armor', artillery: 'artillery', recon: 'recon', hq: 'HQ' },
  sides: { nato: 'NATO', wp: 'Warsaw Pact' },
  groups: {
    terrain: 'Terrain',
    water: 'Water',
    transport: 'Transport',
    settle: 'Settlements',
    admin: 'Admin',
    land: 'Land cover',
    military: 'Military',
    tools: 'Recon',
  },
  items: {
    relief: 'Hillshade',
    contour: 'Contours',
    slope: 'Slope',
    water: 'Water · rivers',
    rail: 'Railways',
    road: 'Main roads',
    minor: 'Minor roads',
    airport: 'Airfields · runways',
    urban: 'Urban areas',
    building: 'Buildings',
    label: 'Place labels',
    boundary: 'Boundaries',
    landcover: 'Forest · farmland · green',
    military: 'Military land',
    damage: 'Urban damage',
    grid: 'Grid',
    rings: 'Range rings',
    poi: 'Facility dots',
  },
  mods: { move: 'Move', defend: 'Defense', recon: 'Recon', arty: 'Artillery', supply: 'Supply' },
  measure: 'Measure',
  measuring: 'Click two points (click again to close)',
  distance: 'Distance',
  bearing: 'Bearing',
  slopePair: 'Δ elevation / avg slope',
  elevationPair: 'Elevation A / B',
  profile: 'Terrain profile',
  terrainLoading: 'Loading terrain…',
  failure: 'No basemap package yet — run Tools/fetch_basemap.mjs first',
  damage: 'Damage',
  damageLevel: (n) => `damage level ${n}`,
  loadingMap: 'Loading basemap…',
  ring: 'Range rings',
  ringSpacing: (km, outer) => `spacing ${km} km · outer ${outer} km`,
  cityPanel: (name) => `Urban effect · ${name || 'urban area'}`,
  intensity: (pct, km) => `intensity ${pct}% · radius ${km} km`,
  elevationAt: (v) => (v == null ? 'elev …' : `elev ${v} m`),
  slopeAt: (v) => `slope ${v}%`,
  aspectAt: (v) => `aspect ${v}`,
  readoutHint: 'Move the cursor to read coordinates · elevation · slope',
  placingMarker: 'Click the map to place a marker; right-click a marker to remove',
  damageHint: 'Click an urban area to mark damage (+1, max 3) · Shift+click to clear',
  panHint: 'Drag to pan · scroll to zoom · double-click to zoom in',
  global: 'Global',
  markerHint: 'drag to move · right-click to remove',
  dirs: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
};

const TABLES: Record<UiLang, UiStrings> = { zh: ZH, en: EN };

export function uiLang(lang: MapLang): UiLang {
  return lang === 'en' ? 'en' : 'zh';
}

export function strings(lang: MapLang): UiStrings {
  return TABLES[uiLang(lang)];
}


