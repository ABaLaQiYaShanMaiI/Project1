import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AttributionControl,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type Map as MLMap,
  type MapMouseEvent,
  type Marker as MLMarker,
  type StyleSpecification,
} from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { store } from './store';
import { SIDE_COLOR, type Marker } from './core/markers';
import { makeZoneKey, zoneTitle, type BakeStatus, type ZoneEntry } from './core/zones';
import { buildUtmGrid, ddText, dmsOf, gridStepFor, rangeRing, utmOf, utmText } from './core/geo';
import { loadZones, startBake } from './data/bakeApi';
import { DemSampler, loadDemManifest } from './data/terrain';
import {
  contourGeoJson,
  labelGeoJson,
  militaryStyle,
  type ContourDoc,
  type FC,
} from './data/militaryStyle';
import {
  loadLocalStyle,
  loadPmtilesZones,
  pickZone,
  registerPmtiles,
  type PmtilesZone,
} from './data/pmtilesBasemap';

setWorkerUrl(`${mapWorkerUrl}?v=1`);

const BLANK_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0b1017' } }],
} as unknown as StyleSpecification;

type GroupKey = 'relief' | 'contour' | 'road' | 'rail' | 'water' | 'building' | 'label' | 'grid';

const GROUP_LABEL: Record<GroupKey, string> = {
  relief: '地形晕渲',
  contour: '等高线',
  road: '交通线',
  rail: '铁路',
  water: '水系',
  building: '建筑物',
  label: '地名标注',
  grid: '军用格网',
};

const GROUP_DEFAULT: Record<GroupKey, boolean> = {
  relief: true,
  contour: true,
  road: true,
  rail: true,
  water: true,
  building: true,
  label: true,
  grid: true,
};

const NEW_IDS: Record<string, GroupKey> = {
  relief: 'relief',
  contour: 'contour',
  'contour-bold': 'contour',
  'contour-label': 'contour',
  'rail-hatch': 'rail',
  'grid-minor': 'grid',
  'grid-major': 'grid',
};

function groupOf(id: string, sourceLayer: string): GroupKey | null {
  const fixed = NEW_IDS[id];
  if (fixed) return fixed;
  if (id === 'roads_rail') return 'rail';
  if (sourceLayer === 'roads') return id.startsWith('roads_labels') ? 'label' : 'road';
  if (sourceLayer === 'water') return id.includes('label') ? 'label' : 'water';
  if (sourceLayer === 'buildings') return id === 'buildings' ? 'building' : 'label';
  if (sourceLayer === 'places' || sourceLayer === 'pois') return 'label';
  if (sourceLayer === 'boundaries') return null;
  return null;
}

interface SelInfo {
  w: number;
  h: number;
  lat: number;
  lon: number;
}

interface RingState {
  center: [number, number];
  km: number;
}

interface Readout {
  lat: number;
  lon: number;
  elevation: number | null;
  slope: number | null;
  aspect: number | null;
}

function markerEl(m: Marker, onDelete: (id: string) => void): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'ml-unit';
  const c = SIDE_COLOR[m.side];
  el.style.borderColor = c.stroke;
  el.style.background = c.fill;
  el.style.color = c.text;
  el.textContent = m.label;
  el.title = `${m.label}（拖动移动 · 右键删除）`;
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(m.id);
  });
  return el;
}

function kmSize(a: [number, number], b: [number, number]): SelInfo {
  const lat0 = (a[1] + b[1]) / 2;
  const mPerDegLat = 110540;
  const mPerDegLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
  return {
    w: (Math.abs(b[0] - a[0]) * mPerDegLon) / 1000,
    h: (Math.abs(b[1] - a[1]) * mPerDegLat) / 1000,
    lat: lat0,
    lon: (a[0] + b[0]) / 2,
  };
}

function bearing(deg: number): string {
  const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  return dirs[Math.round(deg / 45) % 8];
}

export function WorldMapLibre(): JSX.Element {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Map<string, MLMarker>>(new Map());
  const samplerRef = useRef<DemSampler | null>(null);
  const posRef = useRef<{ lat: number; lon: number } | null>(null);
  const resampleRef = useRef<() => void>(() => undefined);
  const boxingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const curRef = useRef<{ x: number; y: number } | null>(null);
  const gridRef = useRef<{ step: number }>({ step: 0 });
  const readyRef = useRef(false);

  const [mode, setMode] = useState<'local' | null>(null);
  const [zone, setZone] = useState<PmtilesZone | null>(null);
  const [groups, setGroups] = useState<Record<GroupKey, boolean>>(GROUP_DEFAULT);
  const [selInfo, setSelInfo] = useState<SelInfo | null>(null);
  const [selBox, setSelBox] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [pick, setPick] = useState<{ lat: number; lon: number } | null>(null);
  const [zones, setZones] = useState<ZoneEntry[]>([]);
  const [job, setJob] = useState<BakeStatus | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [boxing, setBoxing] = useState(false);
  const [readout, setReadout] = useState<Readout | null>(null);
  const [ring, setRing] = useState<RingState | null>(null);
  const [ringsOn, setRingsOn] = useState(false);
  const [styleReady, setStyleReady] = useState(0);
  const ringsRef = useRef(false);

  useEffect(() => {
    loadZones().then(setZones).catch(() => setZones([]));
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await loadPmtilesZones();
      if (!alive) return;
      const center = store.map?.meta.center;
      const hit = list.length ? pickZone(list, center ? center[1] : 9.72, center ? center[0] : 50.62) : null;
      if (hit) {
        setZone(hit);
        setMode('local');
      }
    })().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const map = new MapLibreMap({
      container: el,
      style: BLANK_STYLE,
      center: [9.72, 50.62],
      zoom: 4,
      minZoom: 1,
      maxZoom: 17,
      attributionControl: false,
    });
    mapRef.current = map;
    (window as unknown as Record<string, unknown>).__ml = map;
    map.on('error', (e) => {
      const err = (e as unknown as { error?: { message?: string } }).error;
      setFailure(err?.message ?? 'map error');
    });
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.addControl(new AttributionControl({ compact: true }));

    const sync = () => {
      const want = new Set(store.markers.map((m) => m.id));
      for (const [id, mk] of markersRef.current) {
        if (!want.has(id)) {
          mk.remove();
          markersRef.current.delete(id);
        }
      }
      for (const m of store.markers) {
        const exist = markersRef.current.get(m.id);
        if (exist) {
          exist.setLngLat([m.lon, m.lat]);
          continue;
        }
        const mk = new MapLibreMarker({
          element: markerEl(m, (id) => store.removeMarker(id)),
          draggable: true,
          anchor: 'center',
        })
          .setLngLat([m.lon, m.lat])
          .addTo(map);
        mk.on('dragend', () => {
          const p = mk.getLngLat();
          store.moveMarker(m.id, p.lng, p.lat);
        });
        markersRef.current.set(m.id, mk);
      }
    };
    sync();
    const unsub = store.subscribe(sync);

    let raf = 0;
    const resample = () => {
      raf = 0;
      const p = posRef.current;
      if (!p) return;
      const s = samplerRef.current;
      const sp = s ? s.sample(p.lat, p.lon) : null;
      setReadout({
        lat: p.lat,
        lon: p.lon,
        elevation: sp ? Math.round(sp.elevation) : null,
        slope: sp ? sp.slope : null,
        aspect: sp ? sp.aspect : null,
      });
    };
    resampleRef.current = resample;
    map.on('mousemove', (e) => {
      posRef.current = { lat: e.lngLat.lat, lon: e.lngLat.lng };
      if (!raf) raf = requestAnimationFrame(resample);
    });

    map.on('click', (e) => {
      if (store.placing) {
        store.addMarker(e.lngLat.lng, e.lngLat.lat);
        store.cancelPlacing();
        return;
      }
      if (boxingRef.current) return;
      setPick({ lat: e.lngLat.lat, lon: e.lngLat.lng });
      if (ringsRef.current) setRing({ center: [e.lngLat.lng, e.lngLat.lat], km: 10 });
    });

    const down = (e: MapMouseEvent) => {
      if (!boxingRef.current) return;
      startRef.current = { x: e.point.x, y: e.point.y };
      curRef.current = { x: e.point.x, y: e.point.y };
      setSelBox({ x0: e.point.x, y0: e.point.y, x1: e.point.x, y1: e.point.y });
    };
    const move = (e: MapMouseEvent) => {
      const s = startRef.current;
      if (!s || !boxingRef.current) return;
      curRef.current = { x: e.point.x, y: e.point.y };
      setSelBox({ x0: s.x, y0: s.y, x1: e.point.x, y1: e.point.y });
    };
    const up = () => {
      const s = startRef.current;
      const c = curRef.current;
      startRef.current = null;
      curRef.current = null;
      setSelBox(null);
      if (!s || !c) return;
      if (Math.abs(c.x - s.x) < 10 || Math.abs(c.y - s.y) < 10) return;
      const a = map.unproject([Math.min(s.x, c.x), Math.max(s.y, c.y)]);
      const b = map.unproject([Math.max(s.x, c.x), Math.min(s.y, c.y)]);
      const km = kmSize([a.lng, a.lat], [b.lng, b.lat]);
      setSelInfo(km);
      setPick({ lat: km.lat, lon: km.lon });
    };
    map.on('mousedown', down);
    map.on('mousemove', move);
    map.on('mouseup', up);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      unsub();
      for (const mk of markersRef.current.values()) mk.remove();
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    ringsRef.current = ringsOn;
    if (!ringsOn) setRing(null);
  }, [ringsOn]);

  useEffect(() => {
    boxingRef.current = boxing;
    const map = mapRef.current;
    if (!map) return;
    if (boxing) map.dragPan.disable();
    else map.dragPan.enable();
    const cv = map.getCanvas();
    if (cv) cv.style.cursor = boxing ? 'crosshair' : '';
  }, [boxing]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mode || !zone) return;
    let alive = true;
    (async () => {
      await registerPmtiles();
      const base = await loadLocalStyle(zone);
      const dem = await loadDemManifest(zone.key);
      let contours: FC | null = null;
      let labels: FC | null = null;
      const meta = store.map?.meta;
      if (meta) {
        const res = await fetch(`/data/contours_${zone.key}.json`, { cache: 'no-cache' }).catch(() => null);
        if (res && res.ok) {
          const doc = (await res.json()) as ContourDoc;
          contours = contourGeoJson(doc, meta.projection.mPerDegLon, meta.projection.mPerDegLat);
          labels = labelGeoJson(doc.labels, doc.origin, meta.projection.mPerDegLon, meta.projection.mPerDegLat);
        }
      }
      const grid = buildUtmGrid(zone.bbox, gridStepFor(4));
      const style = militaryStyle({
        base,
        dem: dem ? { tiles: dem.tiles, minzoom: dem.minzoom, maxzoom: dem.maxzoom, bbox: dem.bbox } : null,
        contours,
        contourLabels: labels,
        grid: { type: 'FeatureCollection', features: grid.lines } as unknown as FC,
        origin: meta?.center ?? [0, 0],
        mPerDegLon: meta?.projection.mPerDegLon ?? 1,
        bounds: zone.bbox,
      });
      if (!alive) return;
      map.on('sourcedata', () => map.triggerRepaint());
      map.setStyle(style);
      samplerRef.current = dem ? new DemSampler(dem) : null;
      if (samplerRef.current) samplerRef.current.subscribe(() => resampleRef.current());
      const [w, s, e, n] = zone.bbox;
      map.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: 24, duration: 0 },
      );
      map.once('idle', () => {
        if (!alive) return;
        readyRef.current = true;
        setStyleReady((v) => v + 1);
      });
    })().catch((err: Error) => {
      if (alive) setFailure(err.message);
    });
    return () => {
      alive = false;
    };
  }, [mode, zone]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    for (const [key, on] of Object.entries(groups) as Array<[GroupKey, boolean]>) {
      for (const layer of map.getStyle().layers ?? []) {
        const g = groupOf(layer.id, String((layer as { 'source-layer'?: string })['source-layer'] ?? ''));
        if (g !== key) continue;
        map.setLayoutProperty(layer.id, 'visibility', on ? 'visible' : 'none');
      }
    }
  }, [groups, styleReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !zone) return;
    const rebuild = () => {
      const z = map.getZoom();
      const step = gridStepFor(Math.round(z));
      if (step === gridRef.current.step) return;
      gridRef.current.step = step;
      const spec = buildUtmGrid(zone.bbox, step);
      const src = map.getSource('grid') as { setData?: (d: unknown) => void } | undefined;
      src?.setData?.({ type: 'FeatureCollection', features: spec.lines });
    };
    map.on('moveend', rebuild);
    map.on('zoomend', rebuild);
    return () => {
      map.off('moveend', rebuild);
      map.off('zoomend', rebuild);
    };
  }, [zone]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const draw = () => {
      const src = map.getSource('rings') as { setData?: (d: unknown) => void } | undefined;
      if (!src?.setData) return;
      if (!ring || !ringsOn) {
        src.setData({ type: 'FeatureCollection', features: [] });
        return;
      }
      const features = [];
      for (let k = 1; k <= 5; k++) {
        const km = ring.km * k;
        features.push({
          type: 'Feature',
          properties: { km },
          geometry: { type: 'LineString', coordinates: rangeRing(ring.center, km) },
        });
      }
      src.setData({ type: 'FeatureCollection', features });
    };
    if (readyRef.current) draw();
    else map.once('styledata', draw);
  }, [ring, ringsOn]);

  const cycleRing = () => {
    setRingsOn((v) => !v);
  };

  const cmd = selInfo
    ? `python Tools/bake_map.py --center ${selInfo.lat.toFixed(3)},${selInfo.lon.toFixed(3)} --span-km ${Math.round(selInfo.w)},${Math.round(selInfo.h)} --name ${makeZoneKey(selInfo.lat, selInfo.lon)}`
    : '';

  const onBake = async () => {
    if (!selInfo) return;
    setFailure(null);
    try {
      const st = await startBake({
        center: [Number(selInfo.lat.toFixed(3)), Number(selInfo.lon.toFixed(3))],
        spanKm: [Math.round(selInfo.w), Math.round(selInfo.h)],
        key: makeZoneKey(selInfo.lat, selInfo.lon),
        title: zoneTitle(selInfo.lat, selInfo.lon, selInfo.w, selInfo.h),
      });
      setJob(st);
      const zs = await loadZones().catch(() => []);
      setZones(zs);
    } catch (e) {
      setFailure((e as Error).message);
    }
  };

  const utm = useMemo(() => (readout ? utmOf(readout.lat, readout.lon) : null), [readout]);
  const active = Object.values(groups).filter(Boolean).length;

  return (
    <div className="ml-wrap">
      <div className="ml-map" ref={boxRef} />

      <div className="world-tools">
        <button className={`btn toggle ${boxing ? 'on' : ''}`} onClick={() => setBoxing((v) => !v)}>
          {boxing ? '◉ 框选战场' : '○ 平移'}
        </button>
        <button
          className={`btn small ${groups.grid ? 'on' : ''}`}
          onClick={() => setGroups((g) => ({ ...g, grid: !g.grid }))}
          title="UTM 军用格网：随缩放自动切换 1/2/5/10/25/50 km"
        >
          格网
        </button>
        <button
          className={`btn small ${ringsOn ? 'on' : ''}`}
          onClick={cycleRing}
          title="射程圈：单击地图放置中心，5 级同心圆"
        >
          射程圈
        </button>
        {zone && (
          <span className="zone-count">
            {zone.name} · z0–{zone.maxzoom} · {zone.sizeMB} MB
          </span>
        )}
        {zones.length > 0 && <span className="zone-count">已记录 {zones.length}</span>}
      </div>

      <div className="ml-layers">
        <div className="lp-title">图层 · {active}/{Object.keys(GROUP_LABEL).length}</div>        {(Object.keys(GROUP_LABEL) as GroupKey[]).map((k) => (
          <label key={k} className="lp-item">
            <input
              type="checkbox"
              checked={groups[k]}
              onChange={(e) => setGroups((g) => ({ ...g, [k]: e.target.checked }))}
            />
            <span>{GROUP_LABEL[k]}</span>
          </label>
        ))}
        {failure && <div className="wp-error mono">{failure}</div>}
        {ring && ringsOn && (
          <div className="lp-key">
            <input
              type="range"
              min={2}
              max={40}
              step={1}
              value={ring.km}
              onChange={(e) => setRing({ ...ring, km: Number(e.target.value) })}
            />
            <div className="lp-hint">圈间距 {ring.km} km · 最外 {ring.km * 5} km</div>
          </div>
        )}
      </div>

      {selInfo ? (
        <div className="world-pick">
          <div className="wp-title">选定战场</div>
          <div className="wp-row mono">
            {selInfo.lat.toFixed(3)}, {selInfo.lon.toFixed(3)}
          </div>
          <div className="wp-row mono">
            {selInfo.w.toFixed(0)} × {selInfo.h.toFixed(0)} km
          </div>
          <div className="wp-hint">首次约 3–10 分钟，结果永久离线可用</div>
          <div className="bake-row">
            <button className="btn small primary" onClick={onBake}>
              生成战场
            </button>
            <button className="btn small" onClick={() => navigator.clipboard?.writeText(cmd)}>
              复制命令
            </button>
            <button className="btn small" onClick={() => setSelInfo(null)}>
              清除
            </button>
          </div>
          {failure && <div className="wp-error">{failure}</div>}
          {job && <div className="wp-hint">{job.stage}</div>}
          <div className="wp-cmd mono">{cmd}</div>
        </div>
      ) : zones.length > 0 ? (
        <div className="world-pick">
          <div className="wp-title">地图库 · {zones.length}</div>
          {zones.slice(0, 6).map((z) => (
            <button
              key={z.key}
              className="zone-item"
              onClick={() => {
                location.search = `?map=${encodeURIComponent('/data/' + z.file)}`;
              }}
            >
              <span className="zone-name">{z.name || z.key}</span>
              <span className="mono zone-meta">
                {z.spanKm ? `${z.spanKm[0]}×${z.spanKm[1]} km` : `${z.sizeMB} MB`}
              </span>
            </button>
          ))}
          <div className="wp-hint">拖动框选新区域即可生成新战场</div>
        </div>
      ) : null}

      <div className="ml-readout mono">
        {readout ? (
          <>
            <span>{ddText(readout.lat, readout.lon)}</span>
            <span className="ro-sep" />
            <span>{utm ? utmText(utm) : '-'}</span>
            <span className="ro-sep" />
            <span className={readout.elevation == null ? 'dim' : ''}>
              {readout.elevation == null ? '高程 …' : `高程 ${readout.elevation} m`}
            </span>
            {readout.slope != null && (
              <>
                <span className="ro-sep" />
                <span>坡度 {readout.slope.toFixed(0)}%</span>
                <span className="ro-sep" />
                <span>坡向 {bearing(readout.aspect ?? 0)}</span>
              </>
            )}
          </>
        ) : (
          <span className="dim">移动鼠标读取坐标 · 高程 · 坡度</span>
        )}
      </div>

      <div className="map-hint">
        {store.placing
          ? '在地图上单击放置兵牌；右键兵牌删除'
          : ringsOn
            ? '单击放置射程圈中心 · 左侧滑块调整圈距'
            : boxing
              ? '拖动框选战场 · 释放后显示尺寸与烘焙命令'
              : '拖动平移 · 滚轮缩放 · 单击取坐标'}
      </div>

      {pick && !readout && (
        <div className="ml-cursor mono">
          {dmsOf(pick.lat, pick.lon)}
        </div>
      )}

      {selBox && (
        <div
          className="ml-box"
          style={{
            left: Math.min(selBox.x0, selBox.x1),
            top: Math.min(selBox.y0, selBox.y1),
            width: Math.abs(selBox.x1 - selBox.x0),
            height: Math.abs(selBox.y1 - selBox.y0),
          }}
        />
      )}
    </div>
  );
}
