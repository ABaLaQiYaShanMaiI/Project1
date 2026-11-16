import type { ExpressionSpecification, GeoJSONSource, LayerSpecification, Map as MlMap } from 'maplibre-gl';
import {
  BASE_STEP,
  CELL_BUDGET,
  CELL_MINZOOM,
  cellId,
  cellLabel,
  cellsInView,
  type CellInfo,
  type CityDisc,
} from '../core/cells';
import type { CellOwners } from '../data/cellStore';

export interface CellStats {
  total: number;
  urban: number;
  finest: number;
  ms: number;
  truncated: boolean;
}

export interface CellDeps {
  near: (b: [number, number, number, number]) => CityDisc[];
  owners: () => CellOwners;
  onStats: (s: CellStats) => void;
}

export interface CellLayer {
  refresh: () => void;
  applyOwners: () => void;
  setEnabled: (on: boolean) => void;
  pick: (x: number, y: number) => CellInfo | null;
  hover: (x: number, y: number) => void;
  destroy: () => void;
}

const EMPTY = { type: 'FeatureCollection', features: [] } as const;

const SIDE_FILL = [
  'match',
  ['coalesce', ['feature-state', 'side'], 'none'],
  'nato',
  '#3f6fb5',
  'wp',
  '#b54a3a',
  'rgba(0,0,0,0)',
] as unknown as ExpressionSpecification;

const SIDE_LINE = [
  'match',
  ['coalesce', ['feature-state', 'side'], 'none'],
  'nato',
  '#3f6fb5',
  'wp',
  '#b54a3a',
  'rgba(0,0,0,0)',
] as unknown as ExpressionSpecification;

const HAS_SIDE = ['!=', ['coalesce', ['feature-state', 'side'], 'none'], 'none'] as unknown as ExpressionSpecification;

const LAYER_IDS = ['cell-fill', 'cell-line', 'cell-edge', 'cell-hover'];

export function createCellLayer(map: MlMap, deps: CellDeps): CellLayer {
  let enabled = true;
  let hoverId: string | null = null;
  let timer = 0;

  const source = () => map.getSource('cells') as GeoJSONSource | undefined;

  const ensure = () => {
    const style = map.getStyle();
    if (!style || !Array.isArray(style.layers)) return false;
    if (!source()) {
      map.addSource('cells', { type: 'geojson', data: EMPTY, promoteId: 'id' });
    }
    const specs: LayerSpecification[] = [
      {
        id: 'cell-fill',
        type: 'fill',
        source: 'cells',
        minzoom: CELL_MINZOOM,
        paint: {
          'fill-color': SIDE_FILL,
          'fill-opacity': ['*', 0.15, ['case', HAS_SIDE, 1, 0]] as unknown as number,
        },
      },
      {
        id: 'cell-line',
        type: 'line',
        source: 'cells',
        minzoom: CELL_MINZOOM,
        paint: {
          'line-color': '#7d7566',
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.9, 16, 1.5] as unknown as number,
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 11.5, 0.2, 15, 0.13] as unknown as number,
        },
      },
      {
        id: 'cell-edge',
        type: 'line',
        source: 'cells',
        minzoom: CELL_MINZOOM,
        paint: {
          'line-color': SIDE_LINE,
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 16, 1.6] as unknown as number,
          'line-opacity': ['case', HAS_SIDE, 0.55, 0] as unknown as number,
        },
      },
      {
        id: 'cell-hover',
        type: 'line',
        source: 'cells',
        minzoom: CELL_MINZOOM,
        paint: {
          'line-color': '#f7f2e6',
          'line-width': 2.2,
          'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.85, 0] as unknown as number,
        },
      },
    ];
    for (const spec of specs) {
      if (map.getLayer(spec.id)) continue;
      map.addLayer(spec);
    }
    return true;
  };

  const setState = (id: string, key: string, value: unknown) => {
    try {
      map.setFeatureState({ source: 'cells', id }, { [key]: value });
    } catch {
      return;
    }
  };

  const applyOwners = () => {
    const owners = deps.owners();
    for (const [id, side] of Object.entries(owners)) setState(id, 'side', side);
  };

  const clearHover = () => {
    if (hoverId) setState(hoverId, 'hover', false);
    hoverId = null;
  };

  const clear = () => {
    clearHover();
    source()?.setData(EMPTY as never);
    deps.onStats({ total: 0, urban: 0, finest: BASE_STEP, ms: 0, truncated: false });
  };

  const refresh = () => {
    if (!enabled) {
      clear();
      return;
    }
    if (!ensure()) return;
    if (map.getZoom() < CELL_MINZOOM) {
      clear();
      return;
    }
    const b = map.getBounds();
    const view = cellsInView([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], deps.near, CELL_BUDGET);
    const features = view.cells.map((c) => ({
      type: 'Feature' as const,
      id: cellId(c),
      properties: {
        id: cellId(c),
        label: cellLabel(c),
        step: c.step,
        cov: Number(c.cov.toFixed(3)),
        urban: c.step < BASE_STEP,
      },
      geometry: { type: 'Polygon' as const, coordinates: [c.ring] },
    }));
    const src = source();
    if (!src) return;
    src.setData({ type: 'FeatureCollection', features } as never);
    applyOwners();
    clearHover();
    deps.onStats({
      total: view.cells.length,
      urban: view.cells.filter((c) => c.step < BASE_STEP).length,
      finest: view.cells.reduce((m, c) => Math.min(m, c.step), BASE_STEP),
      ms: view.ms,
      truncated: view.truncated,
    });
  };

  const queue = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(refresh, 240);
  };

  const pick = (x: number, y: number): CellInfo | null => {
    if (!enabled || map.getZoom() < CELL_MINZOOM) return null;
    if (!map.getLayer('cell-fill')) return null;
    const hits = map.queryRenderedFeatures([x, y], { layers: ['cell-fill'] });
    if (!hits.length) return null;
    const p = hits[0].properties ?? {};
    const id = String((hits[0].id ?? p.id) ?? '');
    if (!id) return null;
    return {
      id,
      label: String(p.label ?? ''),
      step: Number(p.step ?? 0),
      cov: Number(p.cov ?? 0),
      urban: Boolean(p.urban),
    };
  };

  const hover = (x: number, y: number) => {
    const hit = pick(x, y);
    if (hit?.id === hoverId) return;
    clearHover();
    if (!hit) return;
    hoverId = hit.id;
    setState(hit.id, 'hover', true);
  };

  const setEnabled = (on: boolean) => {
    enabled = on;
    for (const id of LAYER_IDS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    }
    if (on) refresh();
    else clear();
  };

  const onStyleData = () => {
    if (enabled) refresh();
  };
  map.on('styledata', onStyleData);
  map.on('moveend', queue);

  const destroy = () => {
    window.clearTimeout(timer);
    map.off('styledata', onStyleData);
    map.off('moveend', queue);
    for (const id of LAYER_IDS) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.getSource('cells')) map.removeSource('cells');
  };

  return { refresh, applyOwners, setEnabled, pick, hover, destroy };
}



