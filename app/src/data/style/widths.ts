export function zoomWidth(base: number, factor?: unknown): unknown {
  const stops: Array<[number, number]> = [
    [4, base * 0.16],
    [7, base * 0.4],
    [10, base * 0.72],
    [13, base],
    [16, base * 1.8],
    [18, base * 2.8],
  ];
  const out: unknown[] = ['interpolate', ['exponential', 1.5], ['zoom']];
  for (const [z, v] of stops) {
    out.push(z, factor ? ['*', v, factor] : v);
  }
  return out;
}

const RAIL_EXP = 1.5;

export function railWidth(w: number, factor?: unknown): unknown {
  const stops: Array<[number, number]> = [
    [1, w * 0.24],
    [3, w * 0.34],
    [6, w * 0.44],
    [9, w * 0.62],
    [11, w * 0.78],
    [13, w * 0.62],
    [15, w * 0.5],
    [17, w * 0.44],
  ];
  const out: unknown[] = ['interpolate', ['exponential', RAIL_EXP], ['zoom']];
  for (const [z, v] of stops) out.push(z, factor ? ['*', Number(v.toFixed(3)), factor] : Number(v.toFixed(3)));
  return out;
}

// line-dasharray 仅支持 step（cross-faded）分档，不支持 interpolate 连续插值；
// stop 输出的字面数组必须用 ["literal", ...] 包裹
const RAIL_DASH_STOPS: Array<[number, number, number]> = [
  [12, 1.1, 2.1],
  [14, 1.6, 2.9],
  [17, 2.4, 4.2],
];

export function railDash(): unknown {
  const out: unknown[] = ['step', ['zoom'], ['literal', [0.7, 1.4]]];
  for (const [z, dash, gap] of RAIL_DASH_STOPS) out.push(z, ['literal', [dash, gap]]);
  return out;
}

export function railNarrow(): unknown {
  return ['case', ['==', ['get', 'kind_detail'], 'narrow_gauge'], 0.6, 1];
}

const RAIL_NARROW_DASH_STOPS: Array<[number, number, number]> = [
  [14, 2.6, 2.0],
  [17, 4.0, 3.0],
];

export function railNarrowDash(): unknown {
  const out: unknown[] = ['step', ['zoom'], ['literal', [1.8, 1.4]]];
  for (const [z, dash, gap] of RAIL_NARROW_DASH_STOPS) out.push(z, ['literal', [dash, gap]]);
  return out;
}

export const WATER_WIDTH: unknown = [
  'interpolate',
  ['linear'],
  ['zoom'],
  6,
  ['case', ['==', ['get', 'kind_detail'], 'river'], 0.8, 0.4],
  10,
  ['case', ['==', ['get', 'kind_detail'], 'river'], 1.5, 0.7],
  14,
  ['case', ['==', ['get', 'kind_detail'], 'river'], 2.6, 1.2],
];

