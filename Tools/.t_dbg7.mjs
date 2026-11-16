import { openAsBlob } from 'node:fs';
import { PMTiles, FileSource } from '../app/node_modules/pmtiles/dist/esm/index.js';
import { decodeTile } from './mvt.mjs';
const pack = 'app/public/data/tiles/fulda.pmtiles';
const arc = new PMTiles(new FileSource(await openAsBlob(pack)));
for (const z of [8, 10, 11, 12, 13]) {
  const n = 2 ** z;
  const tx = Math.floor(((9.68 + 180) / 360) * n);
  const ty = Math.floor(((1 - Math.log(Math.tan((50.54 * Math.PI) / 180) + 1 / Math.cos((50.54 * Math.PI) / 180)) / Math.PI) / 2) * n);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const t = await arc.getZxy(z, tx + dx, ty + dy);
    if (!t) continue;
    const places = decodeTile(Buffer.from(t.data)).get('places');
    if (!places) continue;
    for (const p of places.features) {
      if (p.props.name !== 'Fulda' || !p.points.length) continue;
      const [px, py] = p.points[0];
      const lon = ((tx + dx + px / 4096) / n) * 360 - 180;
      const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * ((ty + dy + py / 4096) / n)))) * 180) / Math.PI;
      console.log(`z${z}`, lon.toFixed(5), lat.toFixed(5), 'min_zoom', p.props.min_zoom, 'pop', p.props.population, 'rank', p.props.population_rank, 'kind', p.props.kind_detail);
    }
  }
}
