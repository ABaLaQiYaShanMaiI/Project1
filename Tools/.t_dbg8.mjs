import { openAsBlob } from 'node:fs';
import { PMTiles, FileSource } from '../app/node_modules/pmtiles/dist/esm/index.js';
import { decodeTile } from './mvt.mjs';
const arc = new PMTiles(new FileSource(await openAsBlob('app/public/data/tiles/world.pmtiles')));
const t = await arc.getZxy(6, 33, 21);
const places = decodeTile(Buffer.from(t.data)).get('places');
const byType = {};
for (const f of places.features) byType[f.type] = (byType[f.type] ?? 0) + 1;
console.log('world z6 places by type', byType);
for (const f of places.features.filter((x) => /Fulda|Berlin|Frankfurt/.test(String(x.props.name)))) {
  console.log(String(f.props.name), 'type', f.type, 'pts', f.points.length, 'rings', f.rings.length, 'pop', f.props.population);
}
const arc2 = new PMTiles(new FileSource(await openAsBlob('app/public/data/tiles/fulda.pmtiles')));
const t2 = await arc2.getZxy(13, 4314, 2680);
const p2 = decodeTile(Buffer.from(t2.data)).get('places');
const by2 = {};
for (const f of p2.features) by2[f.type] = (by2[f.type] ?? 0) + 1;
console.log('fulda z13 places by type', by2);
