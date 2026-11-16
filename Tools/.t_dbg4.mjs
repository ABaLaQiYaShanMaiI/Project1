import { openAsBlob } from 'node:fs';
import { PMTiles, FileSource } from '../app/node_modules/pmtiles/dist/esm/index.js';
import { decodeTile } from './mvt.mjs';
const pack = 'app/public/data/tiles/fulda.pmtiles';
const z = 13;
const arc = new PMTiles(new FileSource(await openAsBlob(pack)));
const f = (lat, lon) => {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n);
  return [x, y];
};
const [x0, y0] = f(50.55, 9.675);
for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]]) {
  const t = await arc.getZxy(z, x0 + dx, y0 + dy);
  if (!t) continue;
  const layers = decodeTile(Buffer.from(t.data));
  const places = layers.get('places');
  if (!places) continue;
  for (const p of places.features) {
    const name = String(p.props.name ?? '');
    if (!/Fulda|Bern|Paris|Tokio|Tokyo/i.test(name)) continue;
    const [px, py] = p.points[0];
    const lon = ((x0 + dx + px / 4096) / 2 ** z) * 360 - 180;
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * ((y0 + dy + py / 4096) / 2 ** z)))) * 180) / Math.PI;
    console.log(`${dx},${dy}`, name, p.props.kind_detail, p.props.population, lon.toFixed(5), lat.toFixed(5), 'wikidata', p.props.wikidata);
  }
}
