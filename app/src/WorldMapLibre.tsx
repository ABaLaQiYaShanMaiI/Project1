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
import { useStore } from './hooks';
import { store, PERSONAS, ruleHits, propFits, fpsTone, type Persona } from './store';
import { markerElement } from './map/markerElement';
import { bearingLabel, buildReadout, type Readout } from './map/readout';
import { groupOf, baseIdOf } from './data/style/layerGroups';

import { getJson, mergePois, mergeRails, type DensityDoc, type PoiDoc } from './map/docLoaders';
import { clipRailsWorld } from './data/railsWorld';
import { applyForceDetail, type ZoomStore } from './map/forceDetail';
import { HYPSOMETRIC_RAMP, HYPSOMETRIC_RAMP_COARSE, HYPSOMETRIC_RAMP_MID } from './data/style/tokens';
import { buildUtmGrid, ddText, gridStepFor, rangeRing, utmOf, utmText } from './core/geo';
import { MOD_KEYS, MOD_LABEL, fmtMod } from './core/cityEffects';
import { DemSampler, loadDemManifest } from './data/terrain';
import { cityZoneAt, loadCityDex, type CityDex } from './data/cities';
import { cityKey } from './data/damageStore';
import { createCityDamage, damageDiscs, type DamageLayer } from './map/cityDamage';
import { MeasurePanel } from './ui/MeasurePanel';
import {
  CONTOUR_BANDS,
  contourBandActive,
  mergeContours,
  militaryStyle,
  type ContourBand,
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
  tierCaps,
  tierOf,
  zonesInBounds,
  type PmtilesZone,
} from './data/pmtilesBasemap';

setWorkerUrl(`${import.meta.env.DEV ? '/ml-worker.mjs' : mapWorkerUrl}?v=1`);

const BLANK_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e9e4d8' } }],
} as unknown as StyleSpecification;

const START = { lon: 9.72, lat: 50.62, zoom: 7 };

function boxHit(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

const DEM_BANDS: Array<{ key: string; from: number; bbox: [number, number, number, number]; ramp: unknown }> = [
  { key: 'world', from: 0, bbox: [-180, -85, 180, 85], ramp: HYPSOMETRIC_RAMP_COARSE },
  { key: 'world6', from: 6, bbox: [-180, -85, 180, 85], ramp: HYPSOMETRIC_RAMP_COARSE },
  { key: 'europe', from: 7, bbox: [0, 44, 20, 56], ramp: HYPSOMETRIC_RAMP_MID },
  { key: 'germany', from: 9, bbox: [5.8, 47.2, 15.1, 55.1], ramp: HYPSOMETRIC_RAMP },
];

function demKeyAt(zoom: number, lon: number, lat: number): string {
  let key = 'world';
  for (const d of DEM_BANDS) {
    if (d.from > zoom) continue;
    if (boxHit(d.bbox, [lon, lat, lon, lat])) key = d.key;
  }
  return key;
}

function viewSig(hit: PmtilesZone[], zoom: number, lon: number, lat: number): string {
  const bands = tierBands(hit);
  return `${hit.map((z) => z.key).sort().join(',')}|${bands.map((b) => b.from).join(',')}|${demKeyAt(zoom, lon, lat)}`;
}

const contourCache = new Map<string, ContourDoc | null>();
const contourFcCache = new Map<string, FC | null>();

async function loadContours(active: Array<{ b: ContourBand; i: number }>): Promise<FC | null> {
  if (!active.length) return null;
  const sig = active.map(({ i }) => i).join(',');
  if (contourFcCache.has(sig)) return contourFcCache.get(sig) ?? null;
  const docs = await Promise.all(
    active.map(async ({ b }) => {
      if (!contourCache.has(b.key)) contourCache.set(b.key, await getJson<ContourDoc>(`/data/contours_${b.key}.json`));
      return contourCache.get(b.key) ?? null;
    }),
  );
  const items = docs.flatMap((doc, k) => (doc?.levels?.length ? [{ doc, band: active[k].i }] : []));
  const fc = items.length ? mergeContours(items) : null;
  contourFcCache.set(sig, fc);
  return fc;
}

function railFc(lines: [number, number][][] | undefined, boxes: [number, number, number, number][]): FC | null {
  if (!lines?.length) return null;
  const fc = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: { type: 'MultiLineString', coordinates: lines },
      },
    ],
  } as unknown as FC;
  return clipRailsWorld(fc, boxes);
}

interface SlopeManifest {
  tiles: string;
  minzoom: number;
  maxzoom: number;
  bbox: [number, number, number, number];
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
      mountedRef.current = viewSig(tiersZones, map.getZoom(), map.getCenter().lng, map.getCenter().lat);
      const bands = tierBands(tiersZones);
      const regionBands = bands.filter((b) => b.zone.key !== 'world');
      const densityMans = await Promise.all(regionBands.map((b) => getJson<DensityDoc>(`/data/density/${b.zone.key}/index.json`)));
      const densityTiers = densityMans.flatMap((d) => (d && d.tiles ? [{ id: String(d.key ?? ''), tiles: d.tiles, minzoom: d.minzoom ?? 14, maxzoom: d.maxzoom ?? 15, bbox: d.bbox ?? [-180, -85, 180, 85] }] : []));
      const [base, demMans] = await Promise.all([
        loadBaseStyle(tiersZones[tiersZones.length - 1]),
        Promise.all(DEM_BANDS.map((d) => loadDemManifest(d.key))),
      ]);
      const viewBox: [number, number, number, number] = [vb.getWest(), vb.getSouth(), vb.getEast(), vb.getNorth()];
      const caps = tierCaps(bands, viewBox);
      capsRef.current = { bands, caps };
      const tiers = bands.map(({ zone, from }, i) => {
        const tier = tierOf(zone, from);
        return caps[i] === tier.styleMax ? tier : { ...tier, styleMax: caps[i] };
      });

      const zoomNow = map.getZoom();
      const center = map.getCenter();
      const bestDem = demKeyAt(zoomNow, center.lng, center.lat);
      const bestFrom = DEM_BANDS.find((d) => d.key === bestDem)?.from ?? 0;
      const demTiers: DemTier[] = [];
      DEM_BANDS.forEach((d, i) => {
        const man = demMans[i];
        if (!man?.tiles) return;
        demTiers.push({
          id: `${d.key}-dem`,
          tiles: man.tiles,
          minzoom: man.minzoom,
          maxzoom: man.maxzoom,
          bounds: man.bbox,
          styleMin: d.from,
          ramp: d.ramp,
          styleMax: d.from >= bestFrom ? 22 : bestFrom,
        });
      });

      const regions = tiersZones.filter((z) => z.kind !== 'world').sort((a, b) => b.maxzoom - a.maxzoom);
      const slopeBands = DEM_BANDS.map(({ key, from }) => ({ key, from }));
      const activeBands = CONTOUR_BANDS.map((b, i) => ({ b, i })).filter(({ b }) => contourBandActive(b, viewBox));
      const [slopeMans, contours, mergedRails, dex] = await Promise.all([
        Promise.all(slopeBands.map((s) => getJson<SlopeManifest>(`/data/slope/${s.key}/index.json`))),
        loadContours(activeBands),
        mergeRails(regions),
        loadCityDex(regions.map((z) => z.key)),
      ]);

      const slopeTiers: SlopeTier[] = [];
      slopeMans.forEach((man, i) => {
        if (!man?.tiles) return;
        const s = slopeBands[i];
        slopeTiers.push({
          id: s.key,
          tiles: man.tiles,
          minzoom: man.minzoom,
          maxzoom: man.maxzoom,
          bounds: man.bbox,
          styleMin: s.from,
          styleMax: s.from >= bestFrom ? 22 : bestFrom,
        });
      });

      const railsLow = mergedRails?.lines?.length
        ? ({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: {},
                geometry: { type: 'MultiLineString', coordinates: mergedRails.lines },
              },
            ],
          } as unknown as FC)
        : null;

      const [poiBase, poiRegional, urbanDoc, fineDoc, coarseDoc] = await Promise.all([
        getJson<PoiDoc>('/data/poi_world.json'),
        Promise.all(regions.map((r) => getJson<PoiDoc>(`/data/poi_${r.key}.json`))),
        getJson<{ polys?: [number, number][][] }>('/data/urban_world.json'),
        getJson<{ lines?: [number, number][][] }>('/data/rails_world_fine.json'),
        getJson<{ lines?: [number, number][][] }>('/data/rails_world_coarse.json'),
      ]);
      const poiPoints = (() => {
        const regionDocs = new Map(regions.map((r, i) => [r.key, poiRegional[i]] as const));

        const ordered = [...regions]
          .sort((a, b) => b.maxzoom - a.maxzoom)
          .map((r) => regionDocs.get(r.key) ?? null);
        return mergePois([...ordered, poiBase]);
      })();
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
      const railBoxes = mergedRails?.boxes ?? [];
      const railsWorldFine = railFc(fineDoc?.lines, railBoxes);
      const railsWorldCoarse = railFc(coarseDoc?.lines, []);
      const focus = regions[0] ?? tiersZones[tiersZones.length - 1];
      const grid = buildUtmGrid(buildBounds(map), gridStepFor(Math.round(map.getZoom())));
      if (!alive) return;
      dexRef.current = dex;
      const style = militaryStyle({
        base,
        tiers,
        demTiers,
        slopeTiers,
        densityTiers,
        contours,
        railsLow,
        grid: { type: 'FeatureCollection', features: grid.lines } as unknown as FC,
        poi,
        railsWorldFine,
        railsWorldCoarse,
        urbanWorld,
      });
      if (!alive) return;
      gridStepRef.current = gridStepFor(Math.round(START.zoom));
      map.setStyle(style);
      appliedRef.current = { epoch: viewEpoch, map: {}, paintSig: '' };

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
      const box: [number, number, number, number] = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
      const hit = zonesInBounds(zones, box);
      const c = map.getCenter();
      const signature = viewSig(hit, map.getZoom(), c.lng, c.lat);
      if (signature === mountedRef.current) return;
      mountedRef.current = signature;
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

  const appliedRef = useRef<{ epoch: number; map: Record<string, boolean>; paintSig: string }>({ epoch: -1, map: {}, paintSig: '' });
  const personaRef = useRef<Persona | null>(null);
  const capsRef = useRef<{ bands: Array<{ zone: PmtilesZone; from: number }>; caps: number[] } | null>(null);
  const epochRef = useRef(0);
  epochRef.current = viewEpoch;

  useEffect(() => {
    const map = mapRef.current;
    const style = map ? map.getStyle() : null;
    if (!map || !style || !Array.isArray(style.layers) || style.layers.length <= 1) return;
    if (appliedRef.current.epoch !== viewEpoch) appliedRef.current = { epoch: viewEpoch, map: {}, paintSig: '' };
    const applied = appliedRef.current.map;
    for (const layer of style.layers) {
      const g = groupOf(layer.id);
      if (!g) continue;
      const on = store.layers[g];
      if (applied[layer.id] === on) continue;
      try {
        map.setLayoutProperty(layer.id, 'visibility', on ? 'visible' : 'none');
        applied[layer.id] = on;
      } catch {
        continue;
      }
    }
    const found = PERSONAS.find((p) => p.key === store.preset);
    if (found) personaRef.current = found;
    const persona = personaRef.current ?? PERSONAS[0];
    const sig = `${persona.key}|${viewEpoch}`;
    if (appliedRef.current.paintSig === sig) return;
    appliedRef.current.paintSig = sig;
    for (const layer of style.layers) {
      const base = baseIdOf(String(layer.id));
      for (const rule of persona.paint) {
        if (!ruleHits(base, rule.id)) continue;
        if (!propFits(String(layer.type), rule.prop)) continue;
        try {
          map.setPaintProperty(String(layer.id), rule.prop as never, rule.value as never);
        } catch {
          continue;
        }
      }
    }
  }, [store.version, viewEpoch]);

  const zoomRef = useRef<ZoomStore>({ epoch: -1, map: {}, on: false });

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyForceDetail(map, store.forceDetail, viewEpoch, zoomRef.current);
  }, [store.version, viewEpoch]);

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
        <span className={`mono world-fps fps fps-${fpsTone(store.perf.fps)}`}>{store.perf.fps} FPS</span>
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
