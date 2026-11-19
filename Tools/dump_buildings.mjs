import { openAsBlob } from 'node:fs';
import { createWriteStream, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { PMTiles, FileSource } from '../app/node_modules/pmtiles/dist/esm/index.js';
import { decodeTile } from './mvt.mjs';

function arg(name, def) {
  const hit = process.argv.find((s) => s.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}

const PACK = arg('pack', 'app/public/data/tiles/fulda.pmtiles');
const BBOX = arg('bbox', '8.849,50.240,10.591,51.000').split(',').map(Number);
const Z = Number(arg('zoom', '14'));
const OUT = arg('out', 'density_src.json');

const archive = new PMTiles(new FileSource(await openAsBlob(PACK)));
const head = await archive.getHeader();
const n = 2 ** Z;
const [w, s, e, nn] = [BBOX[0], BBOX[1], BBOX[2], BBOX[3]];

function tileX(lon) {
  return Math.floor(((lon + 180) / 360) * n);
}
function tileY(lat) {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * n);
}

const x0 = Math.max(0, tileX(w));
const x1 = Math.min(n - 1, tileX(e));
const y0 = Math.max(0, tileY(nn));
const y1 = Math.min(n - 1, tileY(s));

const tiles = [];
let empty = 0;
for (let x = x0; x <= x1; x += 1) {
  for (let y = y0; y <= y1; y += 1) {
    const t = await archive.getZxy(Z, x, y);
    if (!t) {
      empty += 1;
      continue;
    }
    const b = decodeTile(Buffer.from(t.data)).get('buildings');
    if (!b || !b.features.length) {
      empty += 1;
      continue;
    }
    const polys = [];
    for (const f of b.features) {
      for (const ring of f.rings) {
        if (ring.length < 3) continue;
        polys.push(ring.map((p) => p));
      }
    }
    tiles.push({ x, y, polys });
  }
}

writeFileSync(OUT, JSON.stringify({ z: Z, pack: PACK, bbox: BBOX, head, tiles }), 'utf8');
console.log(`zoom ${Z} tiles ${tiles.length} (empty ${empty}) -> ${OUT}`);
