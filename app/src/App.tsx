import { useEffect } from 'react';
import { MapCanvas } from './MapCanvas';
import { WorldCanvas } from './WorldCanvas';
import { TopBar } from './ui/TopBar';
import { SidePanel } from './ui/SidePanel';
import { StatusBar } from './ui/StatusBar';
import { useStore, store } from './hooks';
import { loadMap } from './data/loadMap';
import { loadScenario } from './data/loadScenario';

export function App(): JSX.Element {
  useStore();

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await loadMap();
      const scene = await loadScenario(data);
      if (!alive) return;
      store.map = data;
      store.scenario = scene.scenario;
      store.field = scene.field;
      store.loading = false;
      document.title = `${scene.scenario.name} · 战术地图军棋`;
      store.emit();
    })().catch((err: Error) => {
      if (!alive) return;
      store.error = err.message;
      store.loading = false;
      store.emit();
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        store.togglePause();
      } else if (e.key === '1') store.setSpeed(1);
      else if (e.key === '2') store.setSpeed(2);
      else if (e.key === '3') store.setSpeed(4);
      else if (e.key === '0') store.setSpeed(0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (store.loading) {
    return (
      <div className="boot">
        <div className="boot-mark">⬡</div>
        <div className="boot-title">正在载入富尔达缺口地形…</div>
        <div className="boot-sub">离线数据 · 无需联网</div>
      </div>
    );
  }

  if (store.error || !store.map) {
    return (
      <div className="boot err">
        <div className="boot-mark">⚠</div>
        <div className="boot-title">地图数据未就绪</div>
        <div className="boot-sub mono">{store.error}</div>
        <div className="boot-sub">在项目根目录运行：python tools/bake_map.py</div>
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar />
      <div className="main">
        <SidePanel />
        {store.mode === 'world' ? <WorldCanvas /> : <MapCanvas />}
      </div>
      <StatusBar />
    </div>
  );
}
