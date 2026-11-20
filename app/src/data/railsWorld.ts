import type { FC } from './style/types';

type Box = [number, number, number, number];
type Pt = [number, number];

function spanIn(a: Pt, b: Pt, box: Box): [number, number] | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;
  const edges: Array<[number, number]> = [
    [-dx, a[0] - box[0]],
    [dx, box[2] - a[0]],
    [-dy, a[1] - box[1]],
    [dy, box[3] - a[1]],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return null;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return null;
      if (t < t1) t1 = t;
    }
  }
  return t0 <= t1 ? [t0, t1] : null;
}

function lerp(a: Pt, b: Pt, t: number): Pt {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function outsideParts(a: Pt, b: Pt, boxes: Box[]): Pt[][] {
  const spans: Array<[number, number]> = [];
  for (const box of boxes) {
    const s = spanIn(a, b, box);
    if (s) spans.push(s);
  }
  if (!spans.length) return [[a, b]];
  spans.sort((x, y) => x[0] - y[0]);
  const merged: Array<[number, number]> = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else merged.push([s[0], s[1]]);
  }
  const out: Pt[][] = [];
  let cursor = 0;
  for (const [s0, s1] of merged) {
    if (s0 > cursor) out.push([lerp(a, b, cursor), lerp(a, b, s0)]);
    cursor = Math.max(cursor, s1);
  }
  if (cursor < 1) out.push([lerp(a, b, cursor), lerp(a, b, 1)]);
  return out;
}

function clipLine(line: Pt[], boxes: Box[]): Pt[][] {
  const out: Pt[][] = [];
  let run: Pt[] = [];
  const flush = (): void => {
    if (run.length >= 2) out.push(run);
    run = [];
  };
  for (let i = 0; i + 1 < line.length; i += 1) {
    const parts = outsideParts(line[i], line[i + 1], boxes);
    if (!parts.length) {
      flush();
      continue;
    }
    for (let k = 0; k < parts.length; k += 1) {
      const [p, q] = parts[k];
      if (k > 0) flush();
      if (!run.length) run.push(p);
      run.push(q);
    }
  }
  flush();
  return out;
}

export function clipRailsWorld(fc: FC, boxes: Box[]): FC {
  if (!boxes.length) return fc;
  const features: FC['features'] = [];
  for (const f of fc.features) {
    const g = f.geometry as { type: string; coordinates: unknown };
    if (g.type !== 'MultiLineString') continue;
    const lines: Pt[][] = [];
    for (const line of g.coordinates as Pt[][]) {
      lines.push(...clipLine(line, boxes));
    }
    if (lines.length) {
      features.push({
        type: 'Feature',
        properties: f.properties,
        geometry: { type: 'MultiLineString', coordinates: lines },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}
