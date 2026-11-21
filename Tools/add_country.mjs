import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DATA = join(ROOT, 'app', 'public', 'data');
const BIN = join(HERE, 'bin', process.platform === 'win32' ? 'pmtiles.exe' : 'pmtiles');
const MANIFEST = join(HERE, 'data_manifest.json');
const ATTRIBUTION = '© OpenStreetMap contributors · Protomaps (ODbL) · Wikidata (CC0)';

function arg(name, def) {
  const hit = process.argv.find((s) => s.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}

const KEY = arg('key', '');
const LABEL = arg('label', KEY);
const LABEL_EN = arg('label-en', LABEL);
const BBOX = arg('bbox', '');
const SOURCE = arg('source', 'E:/PersonalGame/v4.pmtiles');
const PY = arg('python', 'python');
const FORCE = process.argv.includes('--force') || arg('force', '') === '1';
const FAST = process.argv.includes('--fast');
const USAGE =
  '用法: node Tools/add_country.mjs --key=austria --label=奥地利 --label-en=Austria --bbox=9.5,46.3,17.2,49.1 [--source=E:/PersonalGame/v4.pmtiles] [--python=python] [--force]';

function fail(msg) {
  console.error(`[add_country] ${msg}`);
  process.exit(2);
}

if (!KEY || !BBOX) fail(USAGE);
const bbox = BBOX.split(',').map(Number);
if (bbox.length !== 4 || bbox.some((v) => !Number.isFinite(v))) fail(`bbox 需为 west,south,east,north：${BBOX}`);
if (bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) fail(`bbox 顺序错误：${BBOX}`);

const PACK = join(DATA, 'tiles', `${KEY}.pmtiles`);
const RAILS = join(DATA, `rails_${KEY}.json`);
const RAILS_LOW = join(DATA, `rails_${KEY}_low.json`);
const POI = join(DATA, `poi_${KEY}.json`);
const CITIES = join(DATA, `cities_${KEY}.json`);
const indexFile = join(DATA, 'tiles', 'index.json');
const indexBackup = existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : null;
const products = [
  join(DATA, 'tiles', `${KEY}.pmtiles`),
  RAILS,
  RAILS_LOW,
  POI,
  CITIES,
];
const had = products.map((p) => existsSync(p));

function run(bin, args) {
  const r = spawnSync(bin, args, { cwd: ROOT, stdio: 'inherit' });
  if (r.error || r.status !== 0) throw new Error(`${bin} ${r.error ? r.error.message : `exit ${r.status}`}`);
}

function sha256(file) {
  return `sha256:${createHash('sha256').update(readFileSync(file)).digest('hex')}`;
}

function rollback() {
  products.forEach((p, i) => {
    if (!had[i] && existsSync(p)) rmSync(p, { force: true });
  });
  if (indexBackup === null) {
    if (existsSync(indexFile)) rmSync(indexFile, { force: true });
  } else {
    writeFileSync(indexFile, indexBackup, 'utf8');
  }
}

try {
  if (!had[0] || FORCE) {
    console.log(`\n=== extract z11-12 ${KEY} ===`);
    run(BIN, ['extract', SOURCE, PACK, `--bbox=${BBOX}`, '--minzoom=11', '--maxzoom=12']);
  }
  if (!FAST) {
    console.log(`\n=== rail / poi ${KEY} ===`);
    run(process.execPath, [
      'Tools/bake_region.mjs',
      `--key=${KEY}`,
      `--bbox=${BBOX}`,
      '--zmax=12',
      '--skip=dem,contours,slope,cities',
      `--python=${PY}`,
    ]);
    console.log(`\n=== cities ${KEY} ===`);
    run(process.execPath, ['Tools/bake_cities.mjs', `--pack=${PACK}`, '--zoom=12', '--kinds=city,town,village', `--out=${CITIES}`]);
    const RAIL_MAX = 12 * 1048576;
  const ladder = [
    [0.00006, 800],
    [0.0001, 1000],
    [0.00015, 1200],
  ];
  for (const [tol, minlen] of ladder) {
    if (statSync(RAILS).size <= RAIL_MAX) break;
    console.log(`\n=== rail simplify ${KEY} (${(statSync(RAILS).size / 1048576).toFixed(1)} MB, tol=${tol}) ===`);
    run(process.execPath, [
      'Tools/bake_rail.mjs',
      `--pack=${PACK}`,
      '--zoom=12',
      `--tol=${tol}`,
      `--minlen=${minlen}`,
      `--out=${RAILS}`,
    ]);
  }
  {
    const doc = JSON.parse(readFileSync(RAILS, 'utf8'));
    const q = (v) => Math.round(v * 1e5) / 1e5;
    if (Array.isArray(doc.lines)) {
      doc.lines = doc.lines.map((line) => line.map(([x, y]) => [q(x), q(y)]));
      writeFileSync(RAILS, JSON.stringify(doc), 'utf8');
    }
  }
  }
} catch (e) {
  rollback();
  fail(`${e.message}（已回滚本次新增产物）`);
}

const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const sizeMB = Number((statSync(PACK).size / 1048576).toFixed(2));
const index = JSON.parse(readFileSync(indexFile, 'utf8'));
index.zones = index.zones.filter((z) => z.key !== KEY);
index.zones.push({
  key: KEY,
  name: LABEL,
  name_en: LABEL_EN,
  file: `${KEY}.pmtiles`,
  style: 'base.style.json',
  bbox,
  center: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
  minzoom: 11,
  maxzoom: 12,
  sizeMB,
  source: SOURCE.replace(/\\/g, '/'),
  theme: 'light',
  attribution: ATTRIBUTION,
  generated: stamp,
  kind: 'region',
});
index.generated = stamp;
writeFileSync(indexFile, JSON.stringify(index, null, 1), 'utf8');

let manifest = [];
if (existsSync(MANIFEST)) {
  try {
    const parsed = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    if (Array.isArray(parsed)) manifest = parsed;
  } catch {
    console.error('[manifest] 现有 data_manifest.json 解析失败，重写');
  }
}
const entries = [
  { path: `tiles/${KEY}.pmtiles`, file: PACK },
  { path: `rails_${KEY}.json`, file: RAILS },
  { path: `rails_${KEY}_low.json`, file: RAILS_LOW },
  { path: `poi_${KEY}.json`, file: POI },
  { path: `cities_${KEY}.json`, file: CITIES },
].filter((e) => existsSync(e.file));
manifest = manifest.filter((m) => m.name !== KEY);
manifest.push({
  name: KEY,
  label: LABEL,
  bbox,
  zoom: [11, 12],
  demZoom: null,
  command: `node Tools/add_country.mjs --key=${KEY} --label="${LABEL}" --label-en="${LABEL_EN}" --bbox=${BBOX}`,
  recordedAt: stamp,
  products: entries.map((e) => ({ path: e.path, kind: 'file', sha256: sha256(e.file), bytes: statSync(e.file).size })),
});
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n', 'utf8');

console.log(`\n完成：${KEY}（${LABEL}）z11-12 · ${sizeMB} MB · 已登记 index.json / data_manifest.json`);
