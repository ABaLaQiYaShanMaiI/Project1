import { readFileSync } from 'node:fs';
import { cellsInView, cellLabel, BASE_STEP } from '../app/src/core/cells.ts';
import { CityDex, decodeCities } from '../app/src/data/cities.ts';

const load = (p) => decodeCities(JSON.parse(readFileSync(p, 'utf8')));
const points = [...load('app/public/data/cities.json'), ...load('app/public/data/cities_fulda.json')];
const dex = new CityDex(points);
console.log('cities', points.length, 'dex', dex.size);

const near = (b) => dex.near(b);
const mPerPx = (z, lat) => (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;

function view(lon, lat, z, w = 1332, h = 852) {
  const mx = (mPerPx(z, lat) * Math.cos((lat * Math.PI) / 180)) / 111320;
  const my = mPerPx(z, lat) / 111320;
  const dx = (mx * w) / 2;
  const dy = (my * h) / 2;
  const b = [lon - dx, lat - dy, lon + dx, lat + dy];
  const t = performance.now();
  const r = cellsInView(b, near, 420);
  const sizes = {};
  for (const c of r.cells) sizes[c.step] = (sizes[c.step] ?? 0) + 1;
  console.log(`\n${lon},${lat} z${z} -> ${r.cells.length} cells ${r.ms.toFixed(1)}ms`, JSON.stringify(sizes));
  return r;
}

const f = view(9.675, 50.552, 14);
console.log('fulda cells:', f.cells.slice(0, 8).map((c) => `${cellLabel(c)}(${c.step}m cov=${c.cov.toFixed(2)})`).join(' '));
console.log('root?', BASE_STEP);

view(9.675, 50.552, 12);
view(9.675, 50.552, 16);
view(13.405, 52.52, 12);
view(2.352, 48.857, 12);
view(121.47, 31.23, 11);
view(139.69, 35.68, 12);
view(9.675, 50.552, 11);
view(-0.12, 51.5, 13);
