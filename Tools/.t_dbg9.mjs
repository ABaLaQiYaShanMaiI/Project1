import { openAsBlob } from 'node:fs';
import { PMTiles, FileSource } from '../app/node_modules/pmtiles/dist/esm/index.js';
import { decodeTile } from './mvt.mjs';
const arc = new PMTiles(new FileSource(await openAsBlob('app/public/data/tiles/world.pmtiles')));
const z = 6, n = 64;
for (const [x, y] of [[34, 20], [34, 21], [33, 20], [35, 20], [34, 19]]) {
  const t = await arc.getZxy(z, x, y);
  if (!t) continue;
  const places = decodeTile(Buffer.from(t.data)).get('places');
  if (!places) continue;
  for (const f of places.features) {
    const name = String(f.props.name ?? '');
    if (!/Berlin|Tokyo|Tokio|Paris|London/.test(name)) continue;
    const [px, py] = f.points[0] ?? [0, 0];
    const lon = ((x + px / 4096) / n) * 360 - 180;
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * ((y + py / 4096) / n)))) * 180) / Math.PI;
    console.log(`${x}/${y}`, name, 'type', f.type, lon.toFixed(4), lat.toFixed(4), 'pop', f.props.population, 'min_zoom', f.props.min_zoom, 'kind', f.props.kind_detail);
  }
}
