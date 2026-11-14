import { useStore, store } from '../hooks';
import { COVER_LABEL } from '../core/types';
import { sampleBilinear, sampleNearest } from '../core/sample';

const LEVEL_TEXT: Record<string, string> = {
  L0: 'L0 战略视图 · 全局路网 / 主城',
  L1: 'L1 战役视图 · 二级路网 / 乡镇',
  L2: 'L2 战术视图 · 村名 / 25m 等高线',
};

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

  const hoverTown = store.hover ? `${store.hover.town.n} · ${store.hover.district.label}` : null;

  return (
    <footer className="statusbar">
      <span className="sb-item">{hoverTown ?? LEVEL_TEXT[store.zoom]}</span>
      <span className="sb-sep" />
      <span className="sb-item mono dim">{elev}</span>
      <span className="sb-item dim">{cover}</span>
      <span className="sb-spacer" />
      <span className="sb-item mono dim">
        {p.towns} 城 · {(p.segments / 1000).toFixed(1)}k 线段
      </span>
      <span className="sb-sep" />
      <span className="sb-item mono dim" title="静态层只在缩放或平移越界时重建">
        静态层 {p.rebuildMs.toFixed(1)}ms
      </span>
      <span className="sb-sep" />
      <span className="sb-item mono">
        {p.fps.toFixed(0)} FPS · 绘制 {p.drawMs.toFixed(2)}ms
      </span>
    </footer>
  );
}
