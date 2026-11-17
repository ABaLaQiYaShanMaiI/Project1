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
import { MOD_KEYS, MOD_LABEL, cityMods, fmtMod, urbanWeight, type CityZone } from './core/cityEffects';
import { DemSampler, loadDemManifest } from './data/terrain';
import { loadCityDex, type CityDex } from './data/cities';
import { cityKey } from './data/damageStore';
import { createCityDamage, type DamageDisc, type DamageLayer } from './map/cityDamage';
import { installMeasure } from './map/measureTool';
import {
  contourGeoJson,
  militaryStyle,
  type ContourDoc,
  type DemTier,
  type SlopeTier,
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


function cityZoneAt(dex: CityDex | null, lon: number, lat: number): CityZone | null {
  if (!dex) return null;
  const hit = dex.nearest(lon, lat);
  if (!hit) return null;
  const weight = urbanWeight(hit.distM, hit.city.r);
  if (weight <= 0.02) return null;
  return {
    name: hit.city.name,
    lon: hit.city.lon,
    lat: hit.city.lat,
    r: hit.city.r,
    weight,
    mods: cityMods(weight, hit.city.r),
  };
}

function damageDiscs(map: Record<string, [number, number]>): DamageDisc[] {
  const out: DamageDisc[] = [];
  for (const [key, [r, lv]] of Object.entries(map)) {
    const [lon, lat] = key.split(',').map(Number);
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || !r || !lv) continue;
    out.push({ lon, lat, r, lv });
  }
  return out;
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
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [viewEpoch, setViewEpoch] = useState(0);
  const mountedRef = useRef("");
  const zonesRef = useRef<PmtilesZone[]>([]);
  const ringsRef = useRef(false);
  const dexRef = useRef<CityDex | null>(null);
  const damageRef = useRef<DamageLayer | null>(null);
  const damageModeRef = useRef(false);
  const [damageMode, setDamageMode] = useState(false);

  const ringsOn = Boolean(store.layers.rings);
  useEffect(() => {
    ringsRef.current = ringsOn;
    if (!ringsOn) setRing(null);
  }, [ringsOn]);

  useEffect(() => {
    damageModeRef.current = damageMode;
  }, [damageMode]);

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
      renderWorldCopies: false,
      fadeDuration: 0,
      maxTileCacheSize: 96,
      refreshExpiredTiles: false,
      collectResourceTiming: false,
    });
    mapRef.current = map;
    (window as unknown as Record<string, unknown>).__ml = map;
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
    installMeasure(map, () => samplerRef.current);
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
      const zone = cityZoneAt(dexRef.current, e.lngLat.lng, e.lngLat.lat);
      store.setCityZone(zone);
    });

    map.on('click', (e) => {
      if (store.placing) {
        store.addMarker(e.lngLat.lng, e.lngLat.lat);
        store.cancelPlacing();
        return;
      }
      if (damageModeRef.current && dexRef.current) {
        const hit = dexRef.current.nearest(e.lngLat.lng, e.lngLat.lat, 0.15);
        if (hit) {
          const key = cityKey(hit.city.lon, hit.city.lat);
          const cur = store.damage[key]?.[1] ?? 0;
          const shift = Boolean((e.originalEvent as MouseEvent | undefined)?.shiftKey);
          store.setDamage(key, hit.city.r, shift ? 0 : Math.min(3, cur + 1));
          return;
        }
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

      const slopeTiers: SlopeTier[] = [];
      const addSlope = async (key: string, styleMin: number) => {
        const res = await fetch(`/data/slope/${key}/index.json`, { cache: 'no-cache' }).catch(() => null);
        if (!res || !res.ok) return;
        const m = (await res.json()) as { tiles: string; minzoom: number; maxzoom: number; bbox: [number, number, number, number] };
        slopeTiers.push({
          id: key,
          tiles: m.tiles,
          minzoom: m.minzoom,
          maxzoom: m.maxzoom,
          bounds: m.bbox,
          styleMin,
        });
      };
      await addSlope('world', 0);
      for (const band of bands) {
        if (band.zone.key !== 'world') await addSlope(band.zone.key, band.from);
      }

      const regions = tiersZones.filter((z) => z.kind !== 'world').sort((a, b) => b.maxzoom - a.maxzoom);
      let contours: FC | null = null;
      for (const r of regions) {
        const res = await fetch(`/data/contours_${r.key}.json`, { cache: 'no-cache' }).catch(() => null);
        if (!res || !res.ok) continue;
        const doc = (await res.json()) as ContourDoc;
        const mPerDegLat = doc.mPerDegLat ?? 110540;
        const mPerDegLon = doc.mPerDegLon ?? 111320 * Math.cos((doc.origin[1] * Math.PI) / 180);
        contours = contourGeoJson(doc, mPerDegLon, mPerDegLat);
        break;
      }

      let railsLow: FC | null = null;
      for (const r of regions) {
        const res = await fetch(`/data/rails_${r.key}.json`, { cache: 'no-cache' }).catch(() => null);
        if (!res || !res.ok) continue;
        const doc = (await res.json()) as { lines?: [number, number][][] };
        if (!Array.isArray(doc.lines) || !doc.lines.length) continue;
        railsLow = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: { type: 'MultiLineString', coordinates: doc.lines },
            },
          ],
        } as unknown as FC;
        break;
      }

      const focus = regions[0] ?? tiersZones[tiersZones.length - 1];
      const grid = buildUtmGrid(focus.bbox, gridStepFor(Math.round(START.zoom)));
      const dex = await loadCityDex(tiersZones.filter((z) => z.kind !== 'world').map((z) => z.key));
      if (!alive) return;
      dexRef.current = dex;
      const style = militaryStyle({
        base,
        tiers,
        demTiers,
        slopeTiers,
        contours,
        railsLow,
        grid: { type: 'FeatureCollection', features: grid.lines } as unknown as FC,
      });
      if (!alive) return;
      gridStepRef.current = gridStepFor(Math.round(START.zoom));
      map.setStyle(style);
      map.on('sourcedata', () => map.triggerRepaint());

      damageRef.current?.destroy();
      damageRef.current = createCityDamage(map, () => [tiers[tiers.length - 1].id]);
      damageRef.current.refresh(damageDiscs(store.damage));
      damageRef.current.setVisible(Boolean(store.layers.damage));

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
    damageRef.current?.refresh(damageDiscs(store.damage));
  }, [store.damage]);

  useEffect(() => {
    damageRef.current?.setVisible(Boolean(store.layers.damage));
  }, [store.layers.damage]);

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
        <button className={`btn small ${damageMode ? 'on' : ''}`} onClick={() => setDamageMode((v) => !v)}>
          战损
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

      {store.cityZone && (
        <div className="ml-city">
          <div className="lp-title">城区影响 · {store.cityZone.name || '城区'}</div>
          <div className="city-sub mono">
            强度 {Math.round(store.cityZone.weight * 100)}% · 半径 {(store.cityZone.r / 1000).toFixed(1)} km
          </div>
          {store.damage[cityKey(store.cityZone.lon, store.cityZone.lat)]?.[1] ? (
            <div className="city-dmg mono">战损 {store.damage[cityKey(store.cityZone.lon, store.cityZone.lat)][1]} 级</div>
          ) : null}
          <div className="city-mods">
            {MOD_KEYS.map((k) => (
              <div key={k} className={`city-mod ${store.cityZone && store.cityZone.mods[k] > 0 ? 'up' : 'down'}`}>
                <span>{MOD_LABEL[k]}</span>
                <b>{fmtMod(store.cityZone ? store.cityZone.mods[k] : 0)}</b>
              </div>
            ))}
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
        {store.placing
          ? '单击地图放置兵牌；右键兵牌删除'
          : damageMode
            ? '单击城区标记战损（+1，最高 3 级）· Shift+单击清除'
            : '拖动平移 · 滚轮缩放 · 双击放大'}
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
  if (base === 'roads_rail' || base.startsWith('rail-')) return 'rail';
  if (base.startsWith('roads_labels') || base === 'address_label') return 'label';
  if (base.startsWith('roads_runway') || base.startsWith('roads_taxiway')) return 'airport';
  if (base.startsWith('roads_minor') || base.startsWith('roads_other')) return 'minor';
  if (base.startsWith('roads_')) return 'road';
  if (base.startsWith('water')) return base.includes('label') ? 'label' : 'water';
  if (base.startsWith('slope')) return 'slope';
  if (base === 'buildings' || base === 'address_label' || base.startsWith('buildings_glow')) return 'building';
  if (base.startsWith('places')) return 'label';
  if (base.startsWith('boundary')) return 'boundary';
  if (base === 'landcover_urban') return 'urban';
  if (base === 'landcover') return 'landcover';
  if (base === 'landuse_urban_glow' || base === 'landuse_residential') return 'urban';
  if (base === 'landuse_military') return 'military';
  if (base === 'landuse_aerodrome' || base === 'landuse_runway' || base === 'aerodrome_mark') return 'airport';
  if (base === 'landuse_hospital' || base === 'landuse_school' || base === 'landuse_industrial') return 'urban';
  if (base.startsWith('landuse_')) return 'landcover';
  return null;
}

function buildBounds(map: MLMap): [number, number, number, number] {
  const b = map.getBounds();
  return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
}
