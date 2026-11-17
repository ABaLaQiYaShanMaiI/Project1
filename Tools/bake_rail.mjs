import { openAsBlob, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PMTiles, FileSource } from '../app/node_modules/pmtiles/dist/esm/index.js';
import { decodeTile } from './mvt.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

function arg(name, def) {
  const hit = process.argv.find((s) => s.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}

const PACK = arg('pack', join(ROOT, 'app', 'public', 'data', 'tiles', 'fulda.pmtiles'));
const ZOOM = Number(arg('zoom', '11'));
const OUT = arg('out', join(ROOT, 'app', 'public', 'data', 'rails_fulda.json'));
const TOL = Number(arg('tol', '0.00004'));

function rdp(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0;
    let idx = -1;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const archive = new PMTiles(new FileSource(await openAsBlob(PACK)));
const head = await archive.getHeader();
const z = ZOOM;
const n = 2 ** z;
const tx0 = Math.max(0, Math.floor(((head.minLon + 180) / 360) * n));
const tx1 = Math.min(n - 1, Math.floor(((head.maxLon + 180) / 360) * n));
const ty0 = Math.max(0, Math.floor(((1 - Math.log(Math.tan((head.maxLat * Math.PI) / 180) + 1 / Math.cos((head.maxLat * Math.PI) / 180)) / Math.PI) / 2) * n));
const ty1 = Math.min(n - 1, Math.floor(((1 - Math.log(Math.tan((head.minLat * Math.PI) / 180) + 1 / Math.cos((head.minLat * Math.PI) / 180)) / Math.PI) / 2) * n));

const seen = new Set();
const lines = [];
let tiles = 0;

for (let x = tx0; x <= tx1; x++) {
  for (let y = ty0; y <= ty1; y++) {
    tiles++;
    const tile = await archive.getZxy(z, x, y);
    if (!tile) continue;
    const roads = decodeTile(Buffer.from(tile.data)).get('roads');
    if (!roads) continue;
    for (const f of roads.features) {
      if (f.props.kind !== 'rail') continue;
      for (const ring of f.rings) {
        if (ring.length < 2) continue;
        const pts = ring.map(([px, py]) => [
          ((x + px / 4096) / n) * 360 - 180,
          (Math.atan(Math.sinh(Math.PI * (1 - 2 * ((y + py / 4096) / n)))) * 180) / Math.PI,
        ]);
        const simp = rdp(pts, TOL);
        if (simp.length < 2) continue;
        const fwd = simp.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(';');
        const rev = [...simp].reverse().map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(';');
        const key = fwd.length <= rev.length ? fwd : rev;
        if (seen.has(key)) continue;
        seen.add(key);
        lines.push(simp);
      }
    }
  }
}

const doc = {
  v: 1,
  source: PACK.replace(ROOT, '').replace(/\\/g, '/'),
  zoom: z,
  count: lines.length,
  lines,
};
writeFileSync(OUT, JSON.stringify(doc), 'utf8');
const pts = lines.reduce((s, l) => s + l.length, 0);
console.log(`tiles ${tiles} / rail lines ${lines.length} / pts ${pts} / ${(statSync(OUT).size / 1024).toFixed(0)} KB`);
