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
import { markerElement } from './map/markerElement';
import { bearingLabel, buildReadout, type Readout } from './map/readout';
import { groupOf } from './data/style/layerGroups';
import { buildUtmGrid, ddText, gridStepFor, rangeRing, utmOf, utmText } from './core/geo';
import { MOD_KEYS, MOD_LABEL, fmtMod } from './core/cityEffects';
import { DemSampler, loadDemManifest } from './data/terrain';
import { cityZoneAt, loadCityDex, type CityDex } from './data/cities';
import { cityKey } from './data/damageStore';
import { createCityDamage, damageDiscs, type DamageLayer } from './map/cityDamage';
import { MeasurePanel } from './ui/MeasurePanel';
import {
  contourGeoJson,
  militaryStyle,
  type ContourDoc,
  type DemTier,
  type SlopeTier,
  type FC,
} from './data/militaryStyle';
import {
  loadBaseStyle,
  loadPmtilesZones,
  registerPmtiles,
  tierBands,
  tierOf,
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

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { cache: 'no-cache' }).catch(() => null);
  if (!res || !res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface SlopeManifest {
  tiles: string;
  minzoom: number;
  maxzoom: number;
  bbox: [number, number, number, number];
}

interface RailsDoc {
  lines?: [number, number][][];
}

interface PoiDoc {
  points?: Array<{ o: number; l: number; k: string }>;
}

async function firstJson<T>(zones: PmtilesZone[], urlOf: (key: string) => string): Promise<T | null> {
  for (const z of zones) {
    const doc = await getJson<T>(urlOf(z.key));
    if (doc) return doc;
  }
  return null;
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

  const [mapObj, setMapObj] = useState<MLMap | null>(null);
  const [sampler, setSampler] = useState<DemSampler | null>(null);
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
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__ml = map;
    }
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
    setMapObj(map);
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
          element: markerElement(m, (id) => store.removeMarker(id)),
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
      setReadout(buildReadout(samplerRef.current, p.lat, p.lon));
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
      setMapObj(null);
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
      const bands = tierBands(tiersZones);
      const regionBands = bands.filter((b) => b.zone.key !== 'world');
      const [base, worldMan, regionMans] = await Promise.all([
        loadBaseStyle(tiersZones[tiersZones.length - 1]),
        loadDemManifest('world'),
        Promise.all(regionBands.map((b) => loadDemManifest(b.zone.key))),
      ]);
      const tiers = bands.map(({ zone, from }, i) => {
        const tier = tierOf(zone, from);
        const next = bands[i + 1];
        if (zone.kind === 'world' && next && next.zone.kind === 'world') return { ...tier, styleMax: next.from };
        return tier;
      });

      const demTiers: DemTier[] = [];
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
      regionBands.forEach((band, i) => {
        const man = regionMans[i];
        if (!man) return;
        demTiers.push({
          id: `${band.zone.key}-dem`,
          tiles: man.tiles,
          minzoom: man.minzoom,
          maxzoom: man.maxzoom,
          bounds: man.bbox,
          styleMin: band.from,
          styleMax: 22,
        });
      });

      const regions = tiersZones.filter((z) => z.kind !== 'world').sort((a, b) => b.maxzoom - a.maxzoom);
      const slopeKeys = ['world', ...regionBands.map((b) => b.zone.key)];
      const [slopeMans, contoursDoc, railsDoc, poiDoc, dex] = await Promise.all([
        Promise.all(slopeKeys.map((k) => getJson<SlopeManifest>(`/data/slope/${k}/index.json`))),
        firstJson<ContourDoc>(regions, (k) => `/data/contours_${k}.json`),
        firstJson<RailsDoc>(regions, (k) => `/data/rails_${k}.json`),
        firstJson<PoiDoc>(regions, (k) => `/data/poi_${k}.json`),
        loadCityDex(regions.map((z) => z.key)),
      ]);

      const slopeTiers: SlopeTier[] = [];
      slopeMans.forEach((man, i) => {
        if (!man?.tiles) return;
        const key = slopeKeys[i];
        const band = regionBands.find((b) => b.zone.key === key);
        slopeTiers.push({
          id: key,
          tiles: man.tiles,
          minzoom: man.minzoom,
          maxzoom: man.maxzoom,
          bounds: man.bbox,
          styleMin: band ? band.from : 0,
        });
      });

      const contours = contoursDoc?.levels
        ? contourGeoJson(
            contoursDoc,
            contoursDoc.mPerDegLon ?? 111320 * Math.cos((contoursDoc.origin[1] * Math.PI) / 180),
            contoursDoc.mPerDegLat ?? 110540,
          )
        : null;

      const railsLow = railsDoc?.lines?.length
        ? ({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {},
                geometry: { type: 'MultiLineString', coordinates: railsDoc.lines },
              },
            ],
          } as unknown as FC)
        : null;

      const poiBase = await getJson<PoiDoc>('/data/poi_world.json');
      const poiPoints = [...(poiBase?.points ?? []), ...(poiDoc?.points ?? [])];
      const poi = poiPoints.length
        ? ({
            type: 'FeatureCollection',
            features: poiPoints.map((p) => ({
              type: 'Feature',
              properties: { k: p.k },
              geometry: { type: 'Point', coordinates: [p.o, p.l] },
            })),
          } as unknown as FC)
        : null;
      const urbanDoc = await getJson<{ polys?: [number, number][][] }>('/data/urban_world.json');
      const urbanWorld = urbanDoc?.polys?.length
        ? ({
            type: 'FeatureCollection',
            features: urbanDoc.polys.map((ring) => ({
              type: 'Feature',
              properties: {},
              geometry: { type: 'Polygon', coordinates: [ring] },
            })),
          } as unknown as FC)
        : null;
      const worldDoc = await getJson<{ lines?: [number, number][][] }>('/data/rails_world.json');
      const railsWorld = worldDoc?.lines?.length
        ? ({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {},
                geometry: { type: 'MultiLineString', coordinates: worldDoc.lines },
              },
            ],
          } as unknown as FC)
        : null;
      let railsLow2: FC | null = null;
      for (const r of regions) {
        const doc = await getJson<{ lines?: [number, number][][] }>(`/data/rails_${r.key}_low.json`);
        if (!Array.isArray(doc?.lines) || !doc.lines.length) continue;
        railsLow2 = {
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
      const grid = buildUtmGrid(buildBounds(map), gridStepFor(Math.round(map.getZoom())));
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
        poi,
        railsLow2,
        railsWorld,
        urbanWorld,
      });
      if (!alive) return;
      gridStepRef.current = gridStepFor(Math.round(START.zoom));
      map.setStyle(style);
      map.on('sourcedata', () => map.triggerRepaint());

      damageRef.current?.destroy();
      damageRef.current = createCityDamage(map, () => [tiers[tiers.length - 1].id]);
      damageRef.current.refresh(damageDiscs(store.damage));
      damageRef.current.setVisible(Boolean(store.layers.damage));

      samplerRef.current = demTiers.length
        ? new DemSampler(
            demTiers.map((d) => ({
              tiles: d.tiles,
              minzoom: d.minzoom,
              maxzoom: d.maxzoom,
              bbox: d.bounds,
            })),
          )
        : null;
      if (samplerRef.current) samplerRef.current.subscribe(() => resampleRef.current());
      setSampler(samplerRef.current);

      store.setBasemap({
        name: focus.name,
        tiers: tiersZones.map((z) => `${z.kind === 'world' ? '全球' : z.name} z${z.minzoom}–${z.maxzoom}`),
        minzoom: 0,
        maxzoom: Math.max(...tiersZones.map((z) => z.maxzoom)),
        sizeMB: Number(tiersZones.reduce((s, z) => s + z.sizeMB, 0).toFixed(1)),
      });
      const hideLoading = () => {
        if (!alive) return;
        setLoading(false);
      };
      map.once('styledata', hideLoading);
      window.setTimeout(hideLoading, 8000);
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
      wanted.set(layer.id, store.layers[g]);
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
    const style = map ? map.getStyle() : null;
    if (!map || !style || !Array.isArray(style.layers)) return;
    const from = store.preset === 'terrain' ? 10 : 5;
    for (const layer of style.layers) {
      if (!String(layer.id).startsWith('rail-low')) continue;
      try {
        map.setLayerZoomRange(String(layer.id), from, 12);
      } catch {
        continue;
      }
    }
  }, [store.preset, viewEpoch]);

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

      <MeasurePanel map={mapObj} sampler={sampler} />

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
                <span>坡向 {bearingLabel(readout.aspect ?? 0)}</span>
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

function buildBounds(map: MLMap): [number, number, number, number] {
  const b = map.getBounds();
  return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
}
