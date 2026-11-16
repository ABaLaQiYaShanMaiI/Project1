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

const PACK = arg('pack', join(ROOT, 'app', 'public', 'data', 'tiles', 'world.pmtiles'));
const ZOOM = Number(arg('zoom', '6'));
const OUT = arg('out', join(ROOT, 'app', 'public', 'data', 'cities.json'));
const KINDS = arg('kinds', 'city,town').split(',');
const MINPOP = Number(arg('minpop', '0'));
const RSCALE = 200;
const CLUSTER = 0.01;

function lonLat(z, x, y, px, py, extent) {
  const n = 2 ** z;
  const fx = (x + px / extent) / n;
  const fy = (y + py / extent) / n;
  const lon = fx * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * fy))) * 180) / Math.PI;
  return [lon, lat];
}

function radiusM(pop, kind) {
  if (pop > 0) return Math.min(40000, Math.max(400, 8 * Math.sqrt(pop)));
  return kind === 'city' ? 2500 : 1200;
}

const blob = await openAsBlob(PACK);
const archive = new PMTiles(new FileSource(blob));
const head = await archive.getHeader();
const w = head.minLon;
const e = head.maxLon;
const s = head.minLat;
const n = head.maxLat;
const maxTile = 2 ** ZOOM - 1;
const tx0 = Math.max(0, Math.floor(((w + 180) / 360) * 2 ** ZOOM));
const tx1 = Math.min(maxTile, Math.floor(((e + 180) / 360) * 2 ** ZOOM));
const ty0 = Math.floor(((1 - Math.log(Math.tan((n * Math.PI) / 180) + 1 / Math.cos((n * Math.PI) / 180)) / Math.PI) / 2) * 2 ** ZOOM);
const ty1 = Math.floor(((1 - Math.log(Math.tan((s * Math.PI) / 180) + 1 / Math.cos((s * Math.PI) / 180)) / Math.PI) / 2) * 2 ** ZOOM);

const found = new Map();
let tiles = 0;
let read = 0;
const t0 = Date.now();

for (let x = tx0; x <= tx1; x++) {
  for (let y = ty0; y <= ty1; y++) {
    tiles++;
    const tile = await archive.getZxy(ZOOM, x, y);
    if (!tile) continue;
    read += tile.data.byteLength;
    const layers = decodeTile(Buffer.from(tile.data));
    const places = layers.get('places');
    if (!places) continue;
    for (const f of places.features) {
      const kind = f.props.kind_detail;
      if (!KINDS.includes(kind)) continue;
      if (f.type !== 1) continue;
      const pop = Number(f.props.population ?? 0);
      if (pop < MINPOP) continue;
      if (!f.points.length) continue;
      const [lon, lat] = lonLat(ZOOM, x, y, f.points[0][0], f.points[0][1], 4096);
      const key = f.props.wikidata ?? `${Math.round(lon / CLUSTER)}:${Math.round(lat / CLUSTER)}`;
      const prev = found.get(key);
      if (prev && prev.pop >= pop) continue;
      found.set(key, { lon, lat, pop, kind, name: String(f.props.name ?? f.props['name:en'] ?? '') });
    }
  }
}

const list = [...found.values()].filter((c) => c.lat > -84 && c.lat < 84).sort((a, b) => b.pop - a.pop);
const buf = Buffer.alloc(list.length * 10);
list.forEach((c, i) => {
  buf.writeFloatLE(c.lon, i * 10);
  buf.writeFloatLE(c.lat, i * 10 + 4);
  buf.writeUInt8(Math.min(255, Math.round(radiusM(c.pop, c.kind) / RSCALE)), i * 10 + 8);
  buf.writeUInt8(c.kind === 'city' ? 1 : 2, i * 10 + 9);
});

const doc = {
  v: 1,
  source: PACK.replace(ROOT, '').replace(/\\/g, '/'),
  zoom: ZOOM,
  count: list.length,
  radiusScaleM: RSCALE,
  stride: 10,
  b64: buf.toString('base64'),
};
writeFileSync(OUT, JSON.stringify(doc), 'utf8');
const secs = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`tiles ${tiles} / read ${(read / 1048576).toFixed(1)} MB / cities ${list.length} / ${secs}s`);
console.log(`out ${OUT} ${(statSync(OUT).size / 1024).toFixed(0)} KB (bin ${(buf.length / 1024).toFixed(0)} KB)`);
console.log(`pop: max ${list[0]?.pop} p50 ${list[Math.floor(list.length / 2)]?.pop} min ${list[list.length - 1]?.pop}`);
console.log('top:', list.slice(0, 5).map((c) => `${c.name} ${c.pop}`).join(' | '));

