import { useStore, store } from '../hooks';
import type { Speed } from '../core/time';
import type { ZoomLevel } from '../store';

const SPEEDS: Array<{ v: Speed; label: string; hint: string }> = [
  { v: 0, label: '暂停', hint: '空格' },
  { v: 1, label: '1x', hint: '1' },
  { v: 2, label: '2x', hint: '2' },
  { v: 4, label: '4x', hint: '3' },
];

const ZOOMS: Array<{ v: ZoomLevel; label: string; hint: string }> = [
  { v: 'L0', label: 'L0 战略', hint: '全局路网 + 主城环' },
  { v: 'L1', label: 'L1 战役', hint: '二级路网 + 乡镇' },
  { v: 'L2', label: 'L2 战术', hint: '村名 + 25m 等高线' },
];

export function TopBar(): JSX.Element {
  useStore();
  const clock = store.clock;
  const running = clock.speed > 0;

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">⬡</span>
        <span className="brand-name">战术地图军棋</span>
        <span className="brand-sep" />
        <span className="scenario">富尔达缺口 · 1985</span>
      </div>

      <div className="clock">
        <div className="clock-main">{clock.label}</div>
        <div className="clock-sub">
          {clock.stamp} · {running ? `${clock.speed}x` : '已暂停'}
        </div>
      </div>

      <div className="group">
        <div className="seg" role="group" aria-label="视图">
          <button
            className={`seg-btn ${store.mode === 'world' ? 'active' : ''}`}
            onClick={() => store.setMode('world')}
            title="世界视图：任意地点都可以成为战场"
          >
            世界
          </button>
          <button
            className={`seg-btn ${store.mode === 'theatre' ? 'active' : ''}`}
            onClick={() => store.setMode('theatre')}
            title="战场视图：当前剧本区域"
          >
            战场
          </button>
        </div>

        <div className="seg" role="group" aria-label="时间倍速">
          {SPEEDS.map((s) => (
            <button
              key={s.v}
              className={`seg-btn ${clock.speed === s.v ? 'active' : ''} ${s.v === 0 ? 'pause' : ''}`}
              title={`${s.label}（快捷键 ${s.hint}）`}
              onClick={() => store.setSpeed(s.v)}
            >
              {s.v === 0 ? '⏸ 暂停' : s.label}
            </button>
          ))}
        </div>

        <div className="seg" role="group" aria-label="缩放层级">
          {ZOOMS.map((z) => (
            <button
              key={z.v}
              className={`seg-btn ${store.zoom === z.v ? 'active' : ''}`}
              title={z.hint}
              onClick={() => store.setZoom(z.v)}
            >
              {z.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
