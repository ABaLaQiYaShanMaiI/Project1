import type { MapData } from '../core/types';
import type { Scenario, ControlField } from '../core/scenario';
import { buildControlField, frontInMeters, nearestOnFront } from '../core/scenario';

export interface SceneBundle {
  scenario: Scenario;
  field: ControlField;
}

function defaultScenario(map: MapData): Scenario {
  const [lat0, lon0] = map.meta.center;
  const half = map.meta.spanM[1] / 2 / map.meta.projection.mPerDegLat;
  return {
    name: `${map.meta.name} · 未命名剧本`,
    note: '运行时默认剧本：接触线为地图中线，可在 app/public/data/scenario_<区域>.json 中改写。',
    front: [
      [lat0 + half, lon0],
      [lat0, lon0],
      [lat0 - half, lon0],
    ],
    contestedWidthM: 3000,
    sides: {
      nato: { name: '北约', short: 'NATO', color: '#3f6fb5' },
      wp: { name: '华约', short: 'WP', color: '#b54a3a' },
    },
    intel: {
      ownConfidence: 1.0,
      enemyConfidenceAtFront: 0.85,
      enemyConfidenceAtDepth: 0.12,
      depthM: 45000,
    },
    ally: 'nato',
  };
}

async function loadScenarioFile(key: string): Promise<Scenario | null> {
  try {
    const res = await fetch(`/data/scenario_${key}.json`, { cache: 'no-cache' });
    if (!res.ok) return null;
    return (await res.json()) as Scenario;
  } catch {
    return null;
  }
}

export async function loadScenario(map: MapData, key = 'fulda'): Promise<SceneBundle> {
  const scenario = (await loadScenarioFile(key)) ?? defaultScenario(map);
  const meta = map.meta;
  const front = frontInMeters(scenario, meta);

  const west = { x: -meta.spanM[0] / 4, y: 0 };
  const { side: westSide } = nearestOnFront(front, west.x, west.y);
  const calibrated = westSide < 0 ? front : [...front].reverse();

  const field = buildControlField(
    calibrated,
    meta.spanM[0],
    meta.spanM[1],
    scenario.contestedWidthM,
    scenario.intel,
  );

  return { scenario, field };
}
