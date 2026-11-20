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

const KINDS = new Set((arg('kinds', 'airport,port,station,bridge').split(',')));

const AIR = new Set(['aerodrome', 'airfield']);
const DECK = new Set(['motorway', 'trunk', 'primary', 'secondary', 'rail']);
const STATION = new Set(['railway']);
const STATION_KINDS = new Set(['railway']);

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
    if (land && KINDS.has('airport')) {
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

    const pois = layers.get('pois');
    if (pois && KINDS.has('station')) {
      for (const f of pois.features) {
        const kind = String(f.props.kind ?? '');
        const cat = STATION_KINDS.has(kind) ? 'station' : '';
        if (!cat) continue;
        const ring = f.rings[0];
        if (!ring || !ring.length) continue;
        const mid = ring[0];
        const [lon, lat] = toLonLat(x, y, mid[0], mid[1]);
        push(lon, lat, cat);
      }
    }

    const roads = layers.get('roads');
    if (roads && KINDS.has('bridge')) {
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

const DEDUP_M = { airport: 6000, port: 4000, station: 900, bridge: 250 };
const GRID = 0.25;
{
  const buckets = new Map();
  const kept = [];
  for (const p of points) {
    const gx = Math.floor(p.o / GRID);
    const gy = Math.floor(p.l / GRID);
    const r = DEDUP_M[p.k] ?? 800;
    let dup = false;
    for (let dx = -1; dx <= 1 && !dup; dx++) {
      for (let dy = -1; dy <= 1 && !dup; dy++) {
        const arr = buckets.get(`${gx + dx},${gy + dy}`);
        if (!arr) continue;
        for (const q of arr) {
          if (q.k !== p.k) continue;
          const dLatM = (p.l - q.l) * 111320;
          const dLonM = (p.o - q.o) * 111320 * Math.cos((((p.l + q.l) / 2) * Math.PI) / 180);
          if (dLatM * dLatM + dLonM * dLonM < r * r) {
            dup = true;
            break;
          }
        }
      }
    }
    if (dup) continue;
    kept.push(p);
    const key = `${gx},${gy}`;
    const arr = buckets.get(key);
    if (arr) arr.push(p);
    else buckets.set(key, [p]);
  }
  points.length = 0;
  points.push(...kept);
  doc.count = points.length;
}

writeFileSync(OUT, JSON.stringify(doc), 'utf8');
const by = points.reduce((a, p) => ((a[p.k] = (a[p.k] || 0) + 1), a), {});
console.log(`tiles ${tiles} / points ${points.length} ${JSON.stringify(by)} / ${(statSync(OUT).size / 1024).toFixed(0)} KB`);
