import type { Map as MlMap, MapMouseEvent } from 'maplibre-gl';
import type { DemSampler } from '../data/terrain';

export interface GeoPoint {
  lon: number;
  lat: number;
}

const EARTH_R = 6371008.8;

export function distanceM(a: GeoPoint, b: GeoPoint): number {
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dp = p2 - p1;
  const dl = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDeg(a: GeoPoint, b: GeoPoint): number {
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dl = ((b.lon - a.lon) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

export function toMils(deg: number): number {
  return (deg * 6400) / 360;
}

export function fmtDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  if (m < 10000) return `${(m / 1000).toFixed(2)} km`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function fmtBearing(b: number): string {
  const norm = (b + 360) % 360;
  return `${norm.toFixed(0).padStart(3, '0')}°`;
}

export function profile(
  sampler: DemSampler | null,
  a: GeoPoint,
  b: GeoPoint,
  steps = 64,
): Array<number | null> {
  if (!sampler) return [];
  const out: Array<number | null> = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const lat = a.lat + (b.lat - a.lat) * t;
    const lon = a.lon + (b.lon - a.lon) * t;
    out.push(sampler.elevation(lat, lon));
  }
  return out;
}

const PANEL_ID = 'ml-measure-panel';
const BUTTON_ID = 'ml-measure-btn';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, style: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.setAttribute('style', style);
  if (text) node.textContent = text;
  return node;
}

export interface MeasureHandle {
  dispose: () => void;
  refresh: () => void;
}

export function installMeasure(map: MlMap, getSampler: () => DemSampler | null): MeasureHandle {
  let active = false;
  let a: GeoPoint | null = null;
  let b: GeoPoint | null = null;
  let unsub: (() => void) | null = null;
  let subscribed: DemSampler | null = null;

  const button = el(
    'button',
    'position:absolute;top:64px;right:16px;z-index:5;padding:7px 12px;border-radius:8px;' +
      'border:1px solid rgba(255,255,255,.16);background:#1b1f24;color:#dfe4e8;' +
      'font:12px/1 ui-monospace,Consolas,monospace;cursor:pointer;letter-spacing:.04em',
    '测距',
  );
  button.id = BUTTON_ID;

  const panel = el(
    'div',
    'position:absolute;left:16px;bottom:88px;z-index:5;min-width:220px;padding:10px 12px;' +
      'border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(22,26,31,.94);' +
      'color:#dfe4e8;font:11px/1.7 ui-monospace,Consolas,monospace;display:none',
  );
  panel.id = PANEL_ID;

  const host = map.getContainer();
  host.appendChild(button);
  host.appendChild(panel);

  const ensureLayers = () => {
    if (!map.getStyle()) return;
    if (!map.getSource('measure-line')) {
      map.addSource('measure-line', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
    }
    if (!map.getLayer('measure-line-glow')) {
      map.addLayer({
        id: 'measure-line-glow',
        type: 'line',
        source: 'measure-line',
        paint: { 'line-color': '#0d0f12', 'line-width': 4.5, 'line-opacity': 0.5 },
      });
    }
    if (!map.getLayer('measure-line-main')) {
      map.addLayer({
        id: 'measure-line-main',
        type: 'line',
        source: 'measure-line',
        paint: { 'line-color': '#e8c169', 'line-width': 1.8, 'line-dasharray': [3, 2] },
      });
    }
    if (!map.getLayer('measure-node')) {
      map.addLayer({
        id: 'measure-node',
        type: 'circle',
        source: 'measure-line',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 4,
          'circle-color': '#e8c169',
          'circle-stroke-color': '#12151a',
          'circle-stroke-width': 1.5,
        },
      });
    }
  };

  const draw = () => {
    ensureLayers();
    const src = map.getSource('measure-line') as { setData?: (d: unknown) => void } | undefined;
    if (!src || !src.setData) return;
    const features: unknown[] = [];
    if (a && b) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[a.lon, a.lat], [b.lon, b.lat]] },
        properties: {},
      });
    }
    for (const p of [a, b]) {
      if (!p) continue;
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: {} });
    }
    src.setData({ type: 'FeatureCollection', features });
  };

  const render = () => {
    if (!a || !b) {
      panel.style.display = 'none';
      return;
    }
    const sampler = getSampler();
    if (sampler && sampler !== subscribed) {
      unsub?.();
      subscribed = sampler;
      unsub = sampler.subscribe(render);
    }
    const d = distanceM(a, b);
    const brg = (bearingDeg(a, b) + 360) % 360;
    const values = profile(sampler, a, b, 64);
    const known = values.filter((v): v is number => v !== null);
    const zA = sampler ? sampler.elevation(a.lat, a.lon) : null;
    const zB = sampler ? sampler.elevation(b.lat, b.lon) : null;
    const dz = zA !== null && zB !== null ? zB - zA : null;
    const slopeAngle = dz !== null && d > 0 ? (Math.atan2(Math.abs(dz), d) * 180) / Math.PI : null;
    const slopePct = dz !== null && d > 0 ? (Math.abs(dz) / d) * 100 : null;
    let spark = '';
    if (known.length > 1 && values.length === 65) {
      const min = Math.min(...known);
      const max = Math.max(...known);
      const span = Math.max(1, max - min);
      const pts = values
        .map((v, i) => {
          if (v === null) return null;
          const x = (i / 64) * 200;
          const y = 34 - ((v - min) / span) * 30;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .filter((p): p is string => Boolean(p));
      spark = `<svg width="200" height="38" style="display:block;margin-top:6px"><polyline fill="none" stroke="#e8c169" stroke-width="1.3" points="${pts.join(' ')}"/></svg>`;
    }
    panel.innerHTML = [
      `<div style="opacity:.6">直线距离</div><div style="font-size:15px;color:#f2f5f7">${fmtDistance(d)}</div>`,
      `<div style="opacity:.6;margin-top:6px">方位</div><div>${fmtBearing(brg)} ／ ${Math.round(toMils(brg))} mil</div>`,
      `<div style="opacity:.6;margin-top:6px">高差 / 平均坡</div><div>${
        dz === null ? '—' : `${dz > 0 ? '+' : ''}${Math.round(dz)} m　${slopePct!.toFixed(1)}% (${slopeAngle!.toFixed(1)}°)`
      }</div>`,
      `<div style="opacity:.6;margin-top:6px">高程 A / B</div><div>${
        zA === null ? '—' : Math.round(zA)
      } m ／ ${zB === null ? '—' : Math.round(zB)} m</div>`,
      '<div style="opacity:.6;margin-top:6px">地形剖面</div>',
      spark || '<div style="opacity:.5">地形数据加载中…</div>',
    ].join('');
    panel.style.display = 'block';
  };

  const onClick = (ev: MapMouseEvent) => {
    if (!active) return;
    const p: GeoPoint = { lon: ev.lngLat.lng, lat: ev.lngLat.lat };
    if (!a || (a && b)) {
      a = p;
      b = null;
    } else {
      b = p;
    }
    draw();
    render();
  };

  const onStyleData = () => {
    ensureLayers();
    draw();
  };

  button.addEventListener('click', () => {
    active = !active;
    button.style.background = active ? '#e8c169' : '#1b1f24';
    button.style.color = active ? '#1b1f24' : '#dfe4e8';
    button.textContent = active ? '点击选点（再点关闭）' : '测距';
    if (!active) {
      panel.style.display = 'none';
    }
  });

  map.on('click', onClick);
  map.on('styledata', onStyleData);

  return {
    dispose: () => {
      unsub?.();
      unsub = null;
      subscribed = null;
      map.off('click', onClick);
      map.off('styledata', onStyleData);
      button.remove();
      panel.remove();
    },
    refresh: () => {
      draw();
      render();
    },
  };
}
