import { readFileSync } from 'node:fs';
import { CityDex, decodeCities } from '../app/src/data/cities.ts';
const load = (p) => decodeCities(JSON.parse(readFileSync(p, 'utf8')));
const pts = [...load('app/public/data/cities.json'), ...load('app/public/data/cities_fulda.json')];
const dex = new CityDex(pts);
for (const [name, lon, lat] of [['Berlin', 13.405, 52.52], ['Paris', 2.352, 48.857], ['Tokyo', 139.69, 35.68], ['Shanghai', 121.47, 31.23]]) {
  const n = dex.nearest(lon, lat);
  console.log(name, n, 'near count', dex.near([lon - 0.3, lat - 0.3, lon + 0.3, lat + 0.3]).length);
}
console.log('r hist', [0, 1, 2, 3].map((k) => pts.filter((p) => p.r > 0 && p.r <= [500, 1500, 5000, 30000][k]).length));
