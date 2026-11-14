import type { MapData } from '../core/types';
import type { Scenario, ControlField } from '../core/scenario';
import { buildControlField, frontInMeters, nearestOnFront } from '../core/scenario';

export interface SceneBundle {
  scenario: Scenario;
  field: ControlField;
}

const SCENARIO_URL = '/data/scenario_fulda.json';

export async function loadScenario(map: MapData): Promise<SceneBundle> {
  const res = await fetch(SCENARIO_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`剧本加载失败：HTTP ${res.status}（${SCENARIO_URL}）`);
  const scenario = (await res.json()) as Scenario;

  const meta = map.meta;
  const front = frontInMeters(scenario, meta);

  const ally = map.towns.find((t) => t.n === 'Fulda') ?? { x: 0, y: 0 };
  const { side } = nearestOnFront(front, ally.x, ally.y);

  const calibrated = side > 0 ? [...front].reverse() : front;

  const field = buildControlField(
    calibrated,
    meta.spanM[0],
    meta.spanM[1],
    scenario.contestedWidthM,
    scenario.intel,
  );

  return { scenario, field };
}
