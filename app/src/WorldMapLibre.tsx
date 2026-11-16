import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AttributionControl,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type Map as MLMap,
  type Marker as MLMarker,
  type StyleSpecification,
} from 'maplibre-gl';
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useStore, store } from './hooks';
import { SIDE_COLOR, type Marker } from './core/markers';
import { buildUtmGrid, ddText, gridStepFor, rangeRing, utmOf, utmText } from './core/geo';
import { DemSampler, loadDemManifest } from './data/terrain';
import {
  contourGeoJson,
  militaryStyle,
  type ContourDoc,
  type DemTier,
  type FC,
  type Tier,
} from './data/militaryStyle';
import {
  loadBaseStyle,
  loadPmtilesZones,
  pmtilesUrl,
  registerPmtiles,
  tierBands,
  zonesInBounds,
  type PmtilesZone,
} from './data/pmtilesBasemap';

setWorkerUrl(`${mapWorkerUrl}?v=1`);

const BLANK_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e9e4d8' } }],
} as unknown as StyleSpecification;

const START = { lon: 9.72, lat: 50.62, zoom: 7 };

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

function bearing(deg: number): string {
  const dirs = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  return dirs[Math.round(deg / 45) % 8];
}

function tierOf(zone: PmtilesZone, _index: number, from: number): Tier {
  const isWorld = zone.kind === 'world';
  return {
    id: isWorld ? 'world' : `detail_${zone.key}`,
    url: pmtilesUrl(zone.file),
    bounds: zone.bbox,
    minzoom: zone.minzoom,
    maxzoom: zone.maxzoom,
    styleMin: from,
    styleMax: 22,
  };
}

export function WorldMapLibre(): JSX.Element {
  useStore();
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Map<string, MLMarker>>(new Map());
  const samplerRef = useRef<DemSampler | null>(null);
  const posRef = useRef<{ lat: number; lon: number } | null>(null);
  const resampleRef = useRef<() => void>(() => undefined);
  const gridStepRef = useRef(0);

  const [readout, setReadout] = useState<Readout | null>(null);
  const [ring, setRing] = useState<{ center: [number, number]; km: number } | null>(null);
  const [ringsOn, setRingsOn] = useState(false);
  const [gridOn, setGridOn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [viewEpoch, setViewEpoch] = useState(0);
  const mountedRef = useRef("");
  const zonesRef = useRef<PmtilesZone[]>([]);
  const ringsRef = useRef(false);

  useEffect(() => {
    ringsRef.current = ringsOn;
    if (!ringsOn) setRing(null);
  }, [ringsOn]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const map = new MapLibreMap({
      container: el,
      style: BLANK_STYLE,
      center: [START.lon, START.lat],
      zoom: START.zoom,
      minZoom: 1,
      maxZoom: 17,
      attributionControl: false,
    });
    mapRef.current = map;
    (window as unknown as Record<string, unknown>).__ml = map;
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
      if (ringsRef.current) setRing({ center: [e.lngLat.lng, e.lngLat.lat], km: 10 });
    });

    let lastFps = 0;
    let frames = 0;
    const tick = () => {
      const now = performance.now();
      frames++;
      if (now - lastFps > 800) {
        store.setFps(Math.round((frames * 1000) / Math.max(1, now - lastFps)));
        frames = 0;
        lastFps = now;
      }
    };
    map.on('render', tick);

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
    const map = mapRef.current;
    if (!map) return;
    let alive = true;
    (async () => {
      await registerPmtiles();
      const zones = await loadPmtilesZones();
      if (!alive) return;
      if (!zones.length) {
        setFailure('还没有底图包，请先运行 Tools/fetch_basemap.mjs');
        setLoading(false);
        return;
      }
      zonesRef.current = zones;
      const vb = map.getBounds();
      const tiersZones = zonesInBounds(zones, [vb.getWest(), vb.getSouth(), vb.getEast(), vb.getNorth()]);
      mountedRef.current = tiersZones.map((z) => z.key).sort().join(',');
      const base = await loadBaseStyle(tiersZones[tiersZones.length - 1]);
      const bands = tierBands(tiersZones);
      const tiers = bands.map(({ zone, from }, i) => tierOf(zone, i, from));

      const demTiers: DemTier[] = [];
      const worldMan = await loadDemManifest('world');
      if (worldMan) {
        demTiers.push({
          id: 'world-dem',
          tiles: worldMan.tiles,
          minzoom: worldMan.minzoom,
          maxzoom: worldMan.maxzoom,
          bounds: worldMan.bbox,
          styleMin: 0,
          styleMax: 22,
        });
      }
      for (const { zone, from } of bands) {
        if (zone.key === 'world') continue;
        const man = await loadDemManifest(zone.key);
        if (!man) continue;
        demTiers.push({
          id: `${zone.key}-dem`,
          tiles: man.tiles,
          minzoom: man.minzoom,
          maxzoom: man.maxzoom,
          bounds: man.bbox,
          styleMin: from,
          styleMax: 22,
        });
      }

      const region = tiersZones.find((z) => z.kind !== 'world');
      let contours: FC | null = null;
      if (region) {
        const res = await fetch(`/data/contours_${region.key}.json`, { cache: 'no-cache' }).catch(() => null);
        if (res && res.ok) {
          const doc = (await res.json()) as ContourDoc;
          const mPerDegLat = doc.mPerDegLat ?? 110540;
          const mPerDegLon = doc.mPerDegLon ?? 111320 * Math.cos((doc.origin[1] * Math.PI) / 180);
          contours = contourGeoJson(doc, mPerDegLon, mPerDegLat);
        }
      }

      const focus = region ?? tiersZones[tiersZones.length - 1];
      const grid = buildUtmGrid(focus.bbox, gridStepFor(Math.round(START.zoom)));
      const style = militaryStyle({
        base,
        tiers,
        demTiers,
        contours,
        grid: { type: 'FeatureCollection', features: grid.lines } as unknown as FC,
      });
      if (!alive) return;
      gridStepRef.current = gridStepFor(Math.round(START.zoom));
      map.setStyle(style);
      map.on('sourcedata', () => map.triggerRepaint());

      const regionDem = demTiers.find((d) => !d.id.startsWith('world'));
      const pickDem = regionDem ?? demTiers.find((d) => d.id.startsWith('world'));
      samplerRef.current = pickDem
        ? new DemSampler({
            tiles: pickDem.tiles,
            minzoom: pickDem.minzoom,
            maxzoom: pickDem.maxzoom,
            bbox: pickDem.bounds,
          })
        : null;
      if (samplerRef.current) samplerRef.current.subscribe(() => resampleRef.current());

      store.setBasemap({
        name: focus.name,
        tiers: tiersZones.map((z) => `${z.kind === 'world' ? '全球' : z.name} z${z.minzoom}–${z.maxzoom}`),
        minzoom: 0,
        maxzoom: Math.max(...tiersZones.map((z) => z.maxzoom)),
        sizeMB: Number(tiersZones.reduce((s, z) => s + z.sizeMB, 0).toFixed(1)),
      });
      map.once('idle', () => {
        if (!alive) return;
        setLoading(false);
      });
    })().catch((err: Error) => {
      if (alive) {
        setFailure(err.message);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [viewEpoch]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let timer = 0;
    const check = () => {
      const zones = zonesRef.current;
      if (!zones.length) return;
      const b = map.getBounds();
      const next = zonesInBounds(zones, [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()])
        .map((z) => z.key)
        .sort()
        .join(',');
      if (next === mountedRef.current) return;
      mountedRef.current = next;
      setViewEpoch((v) => v + 1);
    };
    const onMoveEnd = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(check, 350);
    };
    map.on('moveend', onMoveEnd);
    return () => {
      window.clearTimeout(timer);
      map.off('moveend', onMoveEnd);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const style = map ? map.getStyle() : null;
    if (!map || !style || !Array.isArray(style.layers) || style.layers.length <= 1) return;
    const wanted = new Map<string, boolean>();
    for (const layer of style.layers) {
      const g = groupOf(layer.id);
      if (!g) continue;
      wanted.set(layer.id, store.layers[g as keyof typeof store.layers]);
    }
    for (const [id, on] of wanted) {
      try {
        map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
      } catch {
        continue;
      }
    }
  }, [store.version]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const rebuild = () => {
      const step = gridStepFor(Math.round(map.getZoom()));
      if (step === gridStepRef.current) return;
      gridStepRef.current = step;
      const src = map.getSource('grid') as { setData?: (d: unknown) => void } | undefined;
      src?.setData?.({
        type: 'FeatureCollection',
        features: buildUtmGrid(buildBounds(map), step).lines,
      });
    };
    map.on('moveend', rebuild);
    return () => {
      map.off('moveend', rebuild);
    };
  }, []);

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
        features.push({
          type: 'Feature',
          properties: { km: ring.km * k },
          geometry: { type: 'LineString', coordinates: rangeRing(ring.center, ring.km * k) },
        });
      }
      src.setData({ type: 'FeatureCollection', features });
    };
    map.once('styledata', draw);
    draw();
  }, [ring, ringsOn]);

  const utm = useMemo(() => (readout ? utmOf(readout.lat, readout.lon) : null), [readout]);

  return (
    <div className="ml-wrap">
      <div className="ml-map" ref={boxRef} />

      <div className="world-tools">
        <button className={`btn small ${gridOn ? 'on' : ''}`} onClick={() => setGridOn((v) => !v)}>
          格网
        </button>
        <button className={`btn small ${ringsOn ? 'on' : ''}`} onClick={() => setRingsOn((v) => !v)}>
          射程圈
        </button>
        {store.basemap && (
          <span className="zone-count">
            {store.basemap.tiers.join(' + ')} · {store.basemap.sizeMB} MB
          </span>
        )}
        <span className="zone-count mono">{store.perf.fps} FPS</span>
      </div>

      {loading && <div className="ml-loading">正在载入底图…</div>}
      {failure && <div className="ml-fail mono">{failure}</div>}

      {ring && ringsOn && (
        <div className="ml-layers">
          <div className="lp-title">射程圈</div>
          <input
            type="range"
            min={2}
            max={40}
            step={1}
            value={ring.km}
            onChange={(e) => setRing({ ...ring, km: Number(e.target.value) })}
          />
          <div className="lp-hint">
            圈间距 {ring.km} km · 最外 {ring.km * 5} km
          </div>
        </div>
      )}

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
        {store.placing ? '单击地图放置兵牌；右键兵牌删除' : '拖动平移 · 滚轮缩放 · 双击放大'}
      </div>
    </div>
  );
}

const NEW_IDS: Record<string, string> = {
  relief: 'relief',
  contour: 'contour',
  'contour-bold': 'contour',
  'contour-label': 'contour',
  'rail-hatch': 'rail',
  'grid-minor': 'grid',
  'grid-major': 'grid',
};

function groupOf(id: string): string | null {
  const base = id.includes('__') ? id.slice(0, id.indexOf('__')) : id;
  const fixed = NEW_IDS[base];
  if (fixed) return fixed;
  if (base.includes('-relief') || base === 'relief') return 'relief';
  if (base === 'roads_rail') return 'rail';
  if (base.startsWith('roads_labels')) return 'label';
  if (base.startsWith('roads_')) return 'road';
  if (base.startsWith('water')) return base.includes('label') ? 'label' : null;
  if (base === 'buildings' || base === 'address_label') return 'building';
  if (base.startsWith('places')) return 'label';
  return null;
}

function buildBounds(map: MLMap): [number, number, number, number] {
  const b = map.getBounds();
  return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
}
