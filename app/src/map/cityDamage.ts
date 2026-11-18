import type { GeoJSONSource, Map as MlMap } from 'maplibre-gl';

export interface DamageDisc {
  lon: number;
  lat: number;
  r: number;
  lv: number;
}

export interface DamageLayer {
  refresh: (discs: DamageDisc[]) => void;
  setVisible: (on: boolean) => void;
  destroy: () => void;
}

const LAYER_IDS = ['damage-fill', 'damage-edge'];
const URBAN_KINDS = new Set([
  'residential',
  'commercial',
  'industrial',
  'retail',
  'railway',
  'hospital',
  'school',
  'university',
  'college',
]);
const SRC = 'damage';
const METERS_PER_DEG = 111320;

function rubbleImage(dense: boolean): ImageData {
  const size = 12;
  const data = new Uint8ClampedArray(size * size * 4);
  const step = dense ? 4 : 6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const stroke = (x + y) % step === 0;
      const dot = (x * 7 + y * 13) % 17 === 0;
      if (stroke || dot) {
        data[i] = 70;
        data[i + 1] = 60;
        data[i + 2] = 52;
        data[i + 3] = dense ? 190 : 120;
      }
    }
  }
  return new ImageData(data, size, size);
}

function ringCentroid(ring: [number, number][]): [number, number] {
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p[0];
    y += p[1];
  }
  return [x / Math.max(1, ring.length), y / Math.max(1, ring.length)];
}

function inside(discs: DamageDisc[], lon: number, lat: number, pad = 1): DamageDisc | null {
  const cos = Math.cos((lat * Math.PI) / 180);
  for (const d of discs) {
    const dx = (lon - d.lon) * METERS_PER_DEG * cos;
    const dy = (lat - d.lat) * METERS_PER_DEG;
    if (dx * dx + dy * dy <= (d.r * pad) ** 2) return d;
  }
  return null;
}

export function createCityDamage(map: MlMap, tiers: () => string[]): DamageLayer {
  let last: DamageDisc[] = [];
  let visible = true;

  const ensure = () => {
    const style = map.getStyle();
    if (!style || !Array.isArray(style.layers)) return false;
    if (!map.getSource(SRC)) {
      map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }
    if (!map.hasImage('rubble')) map.addImage('rubble', rubbleImage(false), { pixelRatio: 2 });
    if (!map.hasImage('rubble-heavy')) map.addImage('rubble-heavy', rubbleImage(true), { pixelRatio: 2 });
    if (!map.getLayer('damage-fill')) {
      map.addLayer({
        id: 'damage-fill',
        type: 'fill',
        source: SRC,
        paint: {
          'fill-pattern': ['match', ['get', 'lv'], 3, 'rubble-heavy', 'rubble'] as never,
          'fill-opacity': ['match', ['get', 'lv'], 3, 0.8, 2, 0.6, 0.4] as never,
        },
      });
    }
    if (!map.getLayer('damage-edge')) {
      map.addLayer({
        id: 'damage-edge',
        type: 'line',
        source: SRC,
        paint: {
          'line-color': '#8a3a2b',
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 15, 1.6] as never,
          'line-opacity': ['match', ['get', 'lv'], 3, 0.8, 2, 0.55, 0.35] as never,
          'line-dasharray': [2, 2],
        },
      });
    }
    return true;
  };

  const refresh = (discs: DamageDisc[]) => {
    last = discs;
    ensure();
    if (!visible) return;
    const src = map.getSource(SRC) as GeoJSONSource | undefined;
    if (!src) return;
    if (!discs.length) {
      src.setData({ type: 'FeatureCollection', features: [] } as never);
      return;
    }
    const features: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();
    for (const sourceId of tiers()) {
      if (!map.getSource(sourceId)) continue;
      for (const sourceLayer of ['landuse', 'landcover']) {
        let feats: Array<Record<string, unknown>> = [];
        try {
          feats = map.querySourceFeatures(sourceId, { sourceLayer }) as unknown as Array<Record<string, unknown>>;
        } catch {
          continue;
        }
        for (const f of feats) {
          const props = (f.properties ?? {}) as Record<string, unknown>;
          const kind = String(props.kind ?? '');
          if (sourceLayer === 'landuse' ? !URBAN_KINDS.has(kind) : kind !== 'urban_area') continue;
          const g = f.geometry as { type?: string; coordinates?: unknown } | undefined;
          if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) continue;
          const rings = g.type === 'Polygon' ? [g.coordinates as [number, number][][]] : (g.coordinates as [number, number][][][]);
          for (const poly of rings) {
            const outer = poly[0];
            if (!outer || outer.length < 3) continue;
            const [clon, clat] = ringCentroid(outer.slice(0, -1) as [number, number][]);
            const hit = inside(discs, clon, clat, 1.15);
            if (!hit) continue;
            let wMin = Infinity;
            let wMax = -Infinity;
            let hMin = Infinity;
            let hMax = -Infinity;
            for (const p of outer) {
              wMin = Math.min(wMin, p[0]);
              wMax = Math.max(wMax, p[0]);
              hMin = Math.min(hMin, p[1]);
              hMax = Math.max(hMax, p[1]);
            }
            const spanM = Math.max(wMax - wMin, hMax - hMin) * METERS_PER_DEG * Math.cos((clat * Math.PI) / 180);
            if (spanM > hit.r * 2.6) continue;
            const key = `${clon.toFixed(3)},${clat.toFixed(3)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const hash = Math.abs(Math.round(clon * 1e5) * 31 + Math.round(clat * 1e5) * 17) % 100;
            const share = hit.lv >= 3 ? 92 : hit.lv === 2 ? 62 : 34;
            if (hash >= share) continue;
            features.push({
              type: 'Feature',
              properties: { lv: hit.lv },
              geometry: { type: 'Polygon', coordinates: poly },
            });
          }
        }
      }
    }
    src.setData({ type: 'FeatureCollection', features } as never);
  };

  let dirty = false;
  const setVisible = (on: boolean) => {
    visible = on;
    for (const id of LAYER_IDS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    }
    if (on && last.length) refresh(last);
  };

  const onMoveEnd = () => {
    dirty = true;
  };
  const onIdle = () => {
    if (!dirty) return;
    dirty = false;
    if (last.length) refresh(last);
  };
  map.on('moveend', onMoveEnd);
  map.on('idle', onIdle);

  const destroy = () => {
    map.off('moveend', onMoveEnd);
    map.off('idle', onIdle);
    for (const id of LAYER_IDS) if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(SRC)) map.removeSource(SRC);
  };

  return { refresh, setVisible, destroy };
}
export function damageDiscs(map: Record<string, [number, number]>): DamageDisc[] {
  const out: DamageDisc[] = [];
  for (const [key, [r, lv]] of Object.entries(map)) {
    const [lon, lat] = key.split(',').map(Number);
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || !r || !lv) continue;
    out.push({ lon, lat, r, lv });
  }
  return out;
}