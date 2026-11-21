import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
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
const BBOX = arg('bbox', '');
const SOURCE = arg('source', 'E:/PersonalGame/v4.pmtiles');
const PY = arg('python', 'python');
const FORCE = process.argv.includes('--force') || arg('force', '') === '1';
const USAGE =
  '用法: node Tools/add_core.mjs --key=berlin_core --label=柏林 --bbox=13.345,52.46,13.465,52.58 [--source=E:/PersonalGame/v4.pmtiles] [--python=python] [--force]';

function fail(msg) {
  console.error(`[add_core] ${msg}`);
  process.exit(2);
}

if (!KEY || !BBOX) fail(USAGE);
const bbox = BBOX.split(',').map(Number);
if (bbox.length !== 4 || bbox.some((v) => !Number.isFinite(v))) fail(`bbox 需为 west,south,east,north：${BBOX}`);
if (bbox[0] >= bbox[2] || bbox[1] >= bbox[3]) fail(`bbox 顺序错误：${BBOX}`);

const PACK = join(DATA, 'tiles', `${KEY}.pmtiles`);
const POI = join(DATA, `poi_${KEY}.json`);
const DENSITY = join(DATA, 'density', KEY);
const DUMP = join(HERE, '.core_buildings.json');
const indexFile = join(DATA, 'tiles', 'index.json');
const indexBackup = existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : null;
const had = { pack: existsSync(PACK), poi: existsSync(POI), density: existsSync(DENSITY) };

function run(bin, args) {
  const r = spawnSync(bin, args, { cwd: ROOT, stdio: 'inherit' });
  if (r.error || r.status !== 0) throw new Error(`${bin} ${r.error ? r.error.message : `exit ${r.status}`}`);
}

function walkDir(dir) {
  let files = 0;
  let bytes = 0;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      const sub = walkDir(p);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files += 1;
      bytes += statSync(p).size;
    }
  }
  return { files, bytes };
}

function sha256(file) {
  return `sha256:${createHash('sha256').update(readFileSync(file)).digest('hex')}`;
}

function rollback() {
  if (!had.pack && existsSync(PACK)) rmSync(PACK, { force: true });
  if (!had.poi && existsSync(POI)) rmSync(POI, { force: true });
  if (!had.density && existsSync(DENSITY)) rmSync(DENSITY, { recursive: true, force: true });
  if (indexBackup === null) {
    if (existsSync(indexFile)) rmSync(indexFile, { force: true });
  } else {
    writeFileSync(indexFile, indexBackup, 'utf8');
  }
}

try {
  if (!had.pack || FORCE) {
    console.log(`\n=== extract z14-15 ${KEY} ===`);
    run(BIN, ['extract', SOURCE, PACK, `--bbox=${BBOX}`, '--minzoom=14', '--maxzoom=15']);
  }
  console.log(`\n=== buildings ${KEY} ===`);
  run(process.execPath, ['Tools/dump_buildings.mjs', `--pack=${PACK}`, `--bbox=${BBOX}`, '--zoom=15', `--out=${DUMP}`]);
  console.log(`\n=== density ${KEY} ===`);
  run(PY, ['Tools/bake_density.py', DUMP, KEY, BBOX]);
  console.log(`\n=== poi ${KEY} ===`);
  run(process.execPath, ['Tools/bake_poi.mjs', `--pack=${PACK}`, '--zoom=15', `--out=${POI}`]);
} catch (e) {
  rollback();
  fail(`${e.message}（已回滚本次新增产物）`);
} finally {
  if (existsSync(DUMP)) unlinkSync(DUMP);
}

const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const sizeMB = Number((statSync(PACK).size / 1048576).toFixed(2));
const index = JSON.parse(readFileSync(indexFile, 'utf8'));
index.zones = index.zones.filter((z) => z.key !== KEY);
index.zones.push({
  key: KEY,
  name: LABEL,
  file: `${KEY}.pmtiles`,
  style: 'base.style.json',
  bbox,
  center: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
  minzoom: 14,
  maxzoom: 15,
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
const dir = walkDir(DENSITY);
const labelArg = LABEL === KEY ? '' : ` --label="${LABEL}"`;
manifest = manifest.filter((m) => m.name !== KEY);
manifest.push({
  name: KEY,
  label: LABEL,
  bbox,
  zoom: [14, 15],
  demZoom: null,
  command: `node Tools/add_core.mjs --key=${KEY} --bbox=${BBOX}${labelArg}`,
  recordedAt: stamp,
  products: [
    { path: `tiles/${KEY}.pmtiles`, kind: 'file', sha256: sha256(PACK), bytes: statSync(PACK).size },
    { path: `poi_${KEY}.json`, kind: 'file', sha256: sha256(POI), bytes: statSync(POI).size },
    { path: `density/${KEY}`, kind: 'dir', files: dir.files, bytes: dir.bytes },
  ],
});
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n', 'utf8');

console.log(`\n完成：${KEY}（${LABEL}）z14-15 · ${sizeMB} MB · 密度 ${dir.files} 张 · 已登记 index.json / data_manifest.json`);
