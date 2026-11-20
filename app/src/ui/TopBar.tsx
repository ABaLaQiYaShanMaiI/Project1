import { useStore, store } from '../hooks';
import { fpsTone } from '../store';

export function TopBar(): JSX.Element {
  useStore();
  const base = store.basemap;

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">⬡</span>
        <div className="brand-text">
          <span className="brand-name">战术地图军棋</span>
          <span className="brand-sub">TACTICAL MAP WARGAME</span>
        </div>
        <span className="scenario">{base ? base.name : '世界地图'} · 1985</span>
      </div>

      <div className="clock">
        <div className="clock-main">{base ? `${base.tiers.length} 层底图` : '载入中'}</div>
        <div className="clock-sub">{base ? `z0–z${base.maxzoom} · ${base.sizeMB} MB · 离线` : '本地 PMTiles'}</div>
      </div>

      <div className="group">
        <div className="seg" role="group" aria-label="状态">
          <span className={`seg-btn ${store.markers.length ? 'active' : ''}`}>
            <i className="dot dot-blue" />
            {store.markers.length} 兵牌
          </span>
          <span className={`seg-btn fps fps-${fpsTone(store.perf.fps)}`}>
            <i className="dot dot-amber" />
            {store.perf.fps} FPS
          </span>
        </div>
      </div>
    </header>
  );
}
