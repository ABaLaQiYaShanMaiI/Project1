import { useStore, store } from '../hooks';
import { COVER_LABEL } from '../core/types';
import { sampleBilinear, sampleNearest } from '../core/sample';

export function StatusBar(): JSX.Element {
  useStore();
  const p = store.perf;
  const map = store.map;
  const cur = store.cursor ?? (store.selected ? { x: store.selected.x, y: store.selected.y } : null);

  let elev = '—';
  let cover = '—';
  if (map && cur) {
    const [spanX, spanY] = map.meta.spanM;
    elev = `${Math.round(sampleBilinear(map.meta.dem, spanX, spanY, cur.x, cur.y))} m`;
    cover = COVER_LABEL[sampleNearest(map.meta.landcover, spanX, spanY, cur.x, cur.y)] ?? '—';
  }

  const hover = store.hover ? `${store.hover.town.n} · ${store.hover.district.label}` : null;

  return (
    <footer className="statusbar">
      <span className="sb-item">{hover ?? (cur ? `${(cur.x / 1000).toFixed(1)}, ${(cur.y / 1000).toFixed(1)} km` : '—')}</span>
      <span className="sb-sep" />
      <span className="sb-item mono dim">{elev}</span>
      <span className="sb-item dim">{cover}</span>
      <span className="sb-spacer" />
      <span className="sb-item mono dim" title={`静态层 ${p.rebuildMs.toFixed(0)}ms · ${p.towns} 城`}>
        {p.fps.toFixed(0)} FPS
      </span>
    </footer>
  );
}
