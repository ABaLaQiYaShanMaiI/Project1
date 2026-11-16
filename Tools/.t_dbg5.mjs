import { openAsBlob } from 'node:fs';
import { PMTiles, FileSource } from '../app/node_modules/pmtiles/dist/esm/index.js';
import { VectorTile } from '../app/node_modules/.pnpm/@mapbox+vector-tile@3.0.0/node_modules/@mapbox/vector-tile/index.js';
import * as PbfMod from '../app/node_modules/.pnpm/pbf@5.1.2/node_modules/pbf/index.js';
const pack = 'app/public/data/tiles/fulda.pmtiles';
const z = 13;
const arc = new PMTiles(new FileSource(await openAsBlob(pack)));
const n = 2 ** z;
const x = Math.floor(((9.675 + 180) / 360) * n);
const y = Math.floor(((1 - Math.log(Math.tan((50.55 * Math.PI) / 180) + 1 / Math.cos((50.55 * Math.PI) / 180)) / Math.PI) / 2) * n);
const t = await arc.getZxy(z, x, y);
const vt = new VectorTile(new (PbfMod.default ?? PbfMod.Pbf)(Buffer.from(t.data)));
console.log('layers', Object.keys(vt.layers));
const layer = vt.layers.places;
if (!layer) process.exit(0);
for (let i = 0; i < layer.length; i++) {
  const fe = layer.feature(i);
  const props = fe.properties;
  const name = String(props.name ?? '');
  if (!/Fulda|Marbach/i.test(name)) continue;
  const g = fe.loadGeometry();
  const p = g[0][0];
  const lon = ((x + p.x / layer.extent) / n) * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * ((y + p.y / layer.extent) / n)))) * 180) / Math.PI;
  console.log(name, props.kind_detail, props.population, p.x, p.y, 'extent', layer.extent, lon.toFixed(5), lat.toFixed(5));
}

