import { openAsBlob } from 'node:fs';
import { PMTiles, FileSource } from '../app/node_modules/pmtiles/dist/esm/index.js';
import { decodeTile } from './mvt.mjs';

const pack = process.argv[2] ?? 'app/public/data/tiles/world.pmtiles';
const z = Number(process.argv[3] ?? 6);
const x = Number(process.argv[4] ?? 33);
const y = Number(process.argv[5] ?? 21);

const src = new FileSource(await openAsBlob(pack));
const p = new PMTiles(src);
const head = await p.getHeader();
console.log('header', { minzoom: head.minzoom, maxzoom: head.maxzoom, bounds: head.bounds });
const t = await p.getZxy(z, x, y);
if (!t) throw new Error('no tile');
console.log('bytes', t.data.byteLength);
const layers = decodeTile(Buffer.from(t.data));
for (const [name, layer] of layers) {
  console.log(name, layer.features.length, 'features');
  if (name === 'places') {
    for (const f of layer.features.slice(0, 12)) console.log('  ', f.type, f.points[0], JSON.stringify(f.props));
    const withPop = layer.features.filter((f) => f.props.population !== undefined).length;
    console.log('  with population:', withPop, '/', layer.features.length);
    console.log('  kinds:', JSON.stringify([...new Set(layer.features.map((f) => f.props.kind_detail))]));
  }
}
