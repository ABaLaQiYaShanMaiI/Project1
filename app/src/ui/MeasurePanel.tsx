import { useEffect, useMemo, useState } from 'react';
import type { Map as MLMap, MapMouseEvent } from 'maplibre-gl';
import type { DemSampler } from '../data/terrain';
import {
  bearingDeg,
  distanceM,
  drawMeasureLine,
  fmtBearing,
  fmtDistance,
  profile,
  toMils,
  type GeoPoint,
} from '../map/measure';

interface Props {
  map: MLMap | null;
  sampler: DemSampler | null;
}

export function MeasurePanel({ map, sampler }: Props): JSX.Element {
  const [active, setActive] = useState(false);
  const [pts, setPts] = useState<[GeoPoint | null, GeoPoint | null]>([null, null]);
  const [tick, setTick] = useState(0);
  const [a, b] = pts;

  useEffect(() => {
    if (!map) return;
    const onClick = (ev: MapMouseEvent) => {
      if (!active) return;
      const p = { lon: ev.lngLat.lng, lat: ev.lngLat.lat };
      setPts(([prevA, prevB]) => (!prevA || prevB ? [p, null] : [prevA, p]));
    };
    map.on('click', onClick);
    return () => {
      map.off('click', onClick);
    };
  }, [map, active]);

  useEffect(() => {
    if (!map) return;
    drawMeasureLine(map, a, b);
  }, [map, a, b]);

  useEffect(() => {
    if (!sampler) return;
    return sampler.subscribe(() => setTick((t) => t + 1));
  }, [sampler]);

  const stats = useMemo(() => {
    if (!a || !b) return null;
    const d = distanceM(a, b);
    const brg = (bearingDeg(a, b) + 360) % 360;
    const values = profile(sampler, a, b, 64);
    const known = values.filter((v): v is number => v !== null);
    const zA = sampler ? sampler.elevation(a.lat, a.lon) : null;
    const zB = sampler ? sampler.elevation(b.lat, b.lon) : null;
    const dz = zA !== null && zB !== null ? zB - zA : null;
    const slopePct = dz !== null && d > 0 ? (Math.abs(dz) / d) * 100 : null;
    const slopeDeg = dz !== null && d > 0 ? (Math.atan2(Math.abs(dz), d) * 180) / Math.PI : null;
    let spark = '';
    if (known.length > 1 && values.length === 65) {
      const min = Math.min(...known);
      const max = Math.max(...known);
      const span = Math.max(1, max - min);
      spark = values
        .map((v, i) => {
          if (v === null) return null;
          const x = (i / 64) * 200;
          const y = 34 - ((v - min) / span) * 30;
          return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .filter((p): p is string => Boolean(p))
        .join(' ');
    }
    return { d, brg, zA, zB, dz, slopePct, slopeDeg, spark };
  }, [a, b, sampler, tick]);

  return (
    <>
      <button className={`btn small ml-measure-btn ${active ? 'on' : ''}`} onClick={() => setActive((v) => !v)}>
        {active ? '点击选点（再点关闭）' : '测距'}
      </button>

      {active && stats && (
        <div className="ml-measure-panel mono">
          <div className="mp-k">直线距离</div>
          <div className="mp-v">{fmtDistance(stats.d)}</div>
          <div className="mp-k">方位</div>
          <div className="mp-v">
            {fmtBearing(stats.brg)} ／ {Math.round(toMils(stats.brg))} mil
          </div>
          <div className="mp-k">高差 / 平均坡</div>
          <div className="mp-v">
            {stats.dz === null
              ? '—'
              : `${stats.dz > 0 ? '+' : ''}${Math.round(stats.dz)} m　${stats.slopePct!.toFixed(1)}% (${stats.slopeDeg!.toFixed(1)}°)`}
          </div>
          <div className="mp-k">高程 A / B</div>
          <div className="mp-v">
            {stats.zA === null ? '—' : Math.round(stats.zA)} m ／ {stats.zB === null ? '—' : Math.round(stats.zB)} m
          </div>
          <div className="mp-k">地形剖面</div>
          {stats.spark ? (
            <svg width="200" height="38" className="mp-spark">
              <polyline points={stats.spark} />
            </svg>
          ) : (
            <div className="mp-dim">地形数据加载中…</div>
          )}
        </div>
      )}
    </>
  );
}
