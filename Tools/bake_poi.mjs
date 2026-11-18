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
const ZOOM = Number(arg('zoom', '12'));
const OUT = arg('out', join(ROOT, 'app', 'public', 'data', 'poi_fulda.json'));

const AIR = new Set(['aerodrome', 'airfield']);
const DECK = new Set(['motorway', 'trunk', 'primary', 'secondary', 'rail']);

const archive = new PMTiles(new FileSource(await openAsBlob(PACK)));
const head = await archive.getHeader();
const z = ZOOM;
const n = 2 ** z;
const tx0 = Math.max(0, Math.floor(((head.minLon + 180) / 360) * n));
const tx1 = Math.min(n - 1, Math.floor(((head.maxLon + 180) / 360) * n));
const ty0 = Math.max(0, Math.floor(((1 - Math.log(Math.tan((head.maxLat * Math.PI) / 180) + 1 / Math.cos((head.maxLat * Math.PI) / 180)) / Math.PI) / 2) * n));
const ty1 = Math.min(n - 1, Math.floor(((1 - Math.log(Math.tan((head.minLat * Math.PI) / 180) + 1 / Math.cos((head.minLat * Math.PI) / 180)) / Math.PI) / 2) * n));

function toLonLat(x, y, px, py) {
  return [
    ((x + px / 4096) / n) * 360 - 180,
    (Math.atan(Math.sinh(Math.PI * (1 - 2 * ((y + py / 4096) / n)))) * 180) / Math.PI,
  ];
}

const seen = new Set();
const points = [];
let tiles = 0;

function push(lon, lat, kind) {
  const key = `${kind}:${lon.toFixed(4)},${lat.toFixed(4)}`;
  if (seen.has(key)) return;
  seen.add(key);
  points.push({ o: Number(lon.toFixed(5)), l: Number(lat.toFixed(5)), k: kind });
}

for (let x = tx0; x <= tx1; x++) {
  for (let y = ty0; y <= ty1; y++) {
    tiles++;
    const tile = await archive.getZxy(z, x, y);
    if (!tile) continue;
    const layers = decodeTile(Buffer.from(tile.data));

    const land = layers.get('landuse');
    if (land) {
      for (const f of land.features) {
        const kind = String(f.props.kind ?? '');
        if (!AIR.has(kind)) continue;
        const ring = f.rings[0];
        if (!ring || ring.length < 3) continue;
        let sx = 0;
        let sy = 0;
        for (const [px, py] of ring) {
          sx += px;
          sy += py;
        }
        const [lon, lat] = toLonLat(x, y, sx / ring.length, sy / ring.length);
        push(lon, lat, 'airport');
      }
    }

    const roads = layers.get('roads');
    if (roads) {
      for (const f of roads.features) {
        if (f.props.is_bridge !== true) continue;
        const kind = String(f.props.kind ?? '');
        if (!DECK.has(kind)) continue;
        const ring = f.rings[0];
        if (!ring || ring.length < 2) continue;
        const mid = ring[Math.floor(ring.length / 2)];
        const [lon, lat] = toLonLat(x, y, mid[0], mid[1]);
        push(lon, lat, 'bridge');
      }
    }
  }
}

const doc = {
  v: 1,
  source: PACK.replace(ROOT, '').replace(/\\/g, '/'),
  zoom: z,
  count: points.length,
  points,
};
writeFileSync(OUT, JSON.stringify(doc), 'utf8');
const by = points.reduce((a, p) => ((a[p.k] = (a[p.k] || 0) + 1), a), {});
console.log(`tiles ${tiles} / points ${points.length} ${JSON.stringify(by)} / ${(statSync(OUT).size / 1024).toFixed(0)} KB`);
