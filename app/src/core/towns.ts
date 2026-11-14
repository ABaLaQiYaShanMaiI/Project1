import type { DistrictData, Town } from './types';

export type District = DistrictData & { townId: string; townName: string; key: string };

const DEG = Math.PI / 180;

export function townDistricts(t: Town): District[] {
  return t.districts.map((d, i) => ({
    ...d,
    townId: t.id,
    townName: t.n,
    key: `${t.id}-${i}`,
  }));
}

export function townFrontage(t: Town): number {
  return t.districts.reduce((s, d) => s + d.frontage, 0);
}

export function districtAt(t: Town, x: number, y: number): District | null {
  const ds = townDistricts(t);
  const dx = x - t.x;
  const dy = y - t.y;
  const d = Math.hypot(dx, dy);
  if (d > t.r * 1.05) return null;
  if (t.kind === 'parcel') return ds[0] ?? null;
  if (t.kind === 'band') {
    const [ux, uy] = t.axis;
    const tt = dx * ux + dy * uy;
    for (const x2 of ds) if (tt >= x2.t0 && tt <= x2.t1) return x2;
    return ds[0] ?? null;
  }
  if (d <= t.coreR) return ds.find((k) => k.shape === 'core') ?? null;
  const ang = ((Math.atan2(dy, dx) / DEG) + 360) % 360;
  const idx = Math.floor(((ang + 45) % 360) / 90);
  const wedges = ds.filter((k) => k.shape === 'wedge');
  return wedges[idx] ?? null;
}

export function hitDistrict(
  towns: Town[],
  x: number,
  y: number,
): { town: Town; district: District } | null {
  let best: { town: Town; district: District } | null = null;
  let bestR = Infinity;
  for (const t of towns) {
    if (Math.abs(x - t.x) > t.r || Math.abs(y - t.y) > t.r) continue;
    if (t.r >= bestR) continue;
    const d = districtAt(t, x, y);
    if (d) {
      best = { town: t, district: d };
      bestR = t.r;
    }
  }
  return best;
}

export function districtPath(t: Town, d: District): Path2D {
  const p = new Path2D();
  if (d.shape === 'band') {
    const [ux, uy] = t.axis;
    const [, , smin, smax] = t.box;
    const pad = (smax - smin) * 0.1 + 200;
    const corners: Array<[number, number]> = [
      [d.t0, smin - pad],
      [d.t1, smin - pad],
      [d.t1, smax + pad],
      [d.t0, smax + pad],
    ];
    corners.forEach(([tt, ss], i) => {
      const x = t.x + ux * tt - uy * ss;
      const y = t.y + uy * tt + ux * ss;
      if (i === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    });
    p.closePath();
    return p;
  }
  if (d.shape === 'core') {
    p.arc(t.x, t.y, d.r1, 0, Math.PI * 2);
    return p;
  }
  const steps = 28;
  for (let i = 0; i <= steps; i++) {
    const a = d.a0 + ((d.a1 - d.a0) * i) / steps;
    const x = t.x + Math.cos(a) * d.r1;
    const y = t.y + Math.sin(a) * d.r1;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  if (d.r0 > 1) {
    for (let i = steps; i >= 0; i--) {
      const a = d.a0 + ((d.a1 - d.a0) * i) / steps;
      p.lineTo(t.x + Math.cos(a) * d.r0, t.y + Math.sin(a) * d.r0);
    }
  } else {
    p.lineTo(t.x, t.y);
  }
  p.closePath();
  return p;
}
