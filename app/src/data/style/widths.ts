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

export function railWidth(w: number, factor?: unknown): unknown {
  const stops: Array<[number, number]> = [
    [7, w * 0.42],
    [10, w * 0.7],
    [13, w * 0.55],
    [15, w * 0.38],
    [17, w * 0.32],
  ];
  const out: unknown[] = ['interpolate', ['linear'], ['zoom']];
  for (const [z, v] of stops) out.push(z, factor ? ['*', Number(v.toFixed(3)), factor] : Number(v.toFixed(3)));
  return out;
}

export function railNarrow(): unknown {
  return ['case', ['==', ['get', 'kind_detail'], 'narrow_gauge'], 0.6, 1];
}
