import { lazy, Suspense } from 'react';
import { TopBar } from './ui/TopBar';
import { SidePanel } from './ui/SidePanel';
import { useStore } from './hooks';

const WorldMapLibre = lazy(() => import('./WorldMapLibre').then((m) => ({ default: m.WorldMapLibre })));

export function App(): JSX.Element {
  useStore();
  return (
    <div className="app world-only">
      <TopBar />
      <div className="main">
        <SidePanel />
        <Suspense fallback={<div className="ml-wrap" />}>
          <WorldMapLibre />
        </Suspense>
      </div>
    </div>
  );
}
