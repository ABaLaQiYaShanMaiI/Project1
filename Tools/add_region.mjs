import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DATA = join(ROOT, 'app', 'public', 'data');
const MANIFEST = join(HERE, 'data_manifest.json');

function arg(name, def) {
  const hit = process.argv.find((s) => s.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}
const has = (flag) => process.argv.includes(flag);

const NAME = arg('name', '') || arg('key', '');
const BBOX = arg('bbox', '');
const LABEL = arg('label', NAME);
const DRY = has('--dry-run');
const KEEP = has('--keep');
const REGISTER_ONLY = has('--register-only');
const FORCE = has('--force');
const SKIP = new Set(arg('skip', '').split(',').filter(Boolean));
const PY = arg('python', 'python');
const THREADS = arg('threads', '8');

const USAGE = '用法: node Tools/add_region.mjs --name=berlin --bbox=13.0,52.3,13.8,52.7 [--label=显示名] [--core] [--zmin=11 --zmax=12] [--dem-zmin=9 --dem-zmax=11] [--skip=dem,slope] [--register-only] [--force] [--dry-run] [--keep]';

function fail(msg) {
  console.error(`[add_region] ${msg}`);
  process.exit(2);
}

if (!NAME || !BBOX) fail(USAGE);
if (REGISTER_ONLY && DRY) fail('--register-only 与 --dry-run 不兼容');
const parts = BBOX.split(',').map(Number);
if (parts.length !== 4 || parts.some((v) => !Number.isFinite(v))) fail(`bbox 需为 west,south,east,north：${BBOX}`);
const [w, s, e, n] = parts;
if (w >= e || s >= n) fail(`bbox 顺序错误（west,south,east,north）：${BBOX}`);

const zminArg = arg('zmin', '');
const zmaxArg = arg('zmax', '');
let zmin = zminArg ? Number(zminArg) : 0;
let zmax = zmaxArg ? Number(zmaxArg) : 0;
if (!zminArg || !zmaxArg) {
  const kmWide = 111.32 * (e - w) * Math.cos((((s + n) / 2) * Math.PI) / 180);
  const areaKm2 = kmWide * 110.57 * (n - s);
  const core = has('--core') || areaKm2 < 500;
  zmin = core ? 14 : 11;
  zmax = core ? 15 : 12;
  console.log(`[zoom] bbox ≈ ${areaKm2.toFixed(0)} km² → ${core ? '核心包' : '区域包'} z${zmin}-${zmax}（--zmin/--zmax 可覆盖）`);
}
const demZminArg = arg('dem-zmin', '');
const demZmaxArg = arg('dem-zmax', '');
if (Boolean(demZminArg) !== Boolean(demZmaxArg)) fail('dem-zmin 与 dem-zmax 要么都给要么都不给');
const demZmin = Number(demZminArg || 0);
const demZmax = Number(demZmaxArg || 0);

const PRODUCTS = [
  `tiles/${NAME}.pmtiles`,
  `tiles/${NAME}.style.json`,
  `dem/${NAME}`,
  `contours_${NAME}.json`,
  `rails_${NAME}.json`,
  `rails_${NAME}_low.json`,
  `poi_${NAME}.json`,
  `slope/${NAME}`,
  `cities_${NAME}.json`,
];
const indexFile = join(DATA, 'tiles', 'index.json');
const existed = new Set(PRODUCTS.filter((rel) => existsSync(join(DATA, rel))));
if (REGISTER_ONLY && !existed.has(`tiles/${NAME}.pmtiles`)) fail(`--register-only 需要 tiles/${NAME}.pmtiles 已存在`);
if (!REGISTER_ONLY) console.log(`[info] ${NAME}.pmtiles ${existed.has(`tiles/${NAME}.pmtiles`) ? '已存在，fetch 将跳过裁剪' : '不存在，将先裁剪'}`);

function demIndexZoom() {
  const p = join(DATA, 'dem', NAME, 'index.json');
  if (!existsSync(p)) return null;
  try {
    const m = JSON.parse(readFileSync(p, 'utf8'));
    return [m.minzoom, m.maxzoom];
  } catch {
    return null;
  }
}

const steps = REGISTER_ONLY
  ? []
  : [
      {
        name: 'fetch',
        bin: process.execPath,
        args: [
          'Tools/fetch_basemap.mjs',
          `--key=${NAME}`,
          `--bbox=${BBOX}`,
          `--minzoom=${zmin}`,
          `--maxzoom=${zmax}`,
          `--name=${LABEL}`,
          `--threads=${THREADS}`,
          ...(FORCE ? ['--force=1'] : []),
        ],
      },
      {
        name: 'bake',
        bin: process.execPath,
        args: [
          'Tools/bake_region.mjs',
          `--key=${NAME}`,
          `--bbox=${BBOX}`,
          `--python=${PY}`,
          ...(demZmin ? [`--zmin=${demZmin}`, `--zmax=${demZmax}`] : []),
          ...(SKIP.size ? [`--skip=${[...SKIP].join(',')}`] : []),
          ...(DRY ? ['--dry-run'] : []),
        ],
      },
    ];

if (DRY) {
  console.log(`[dry] zoom 矢量 z${zmin}-${zmax} · dem ${demZmin ? `z${demZmin}-z${demZmax}` : '默认 z9-z11'} · skip=${[...SKIP].join(',') || '无'}`);
  for (const step of steps) console.log(`[dry] node ${step.args.join(' ')}`);
  console.log(`[dry] 产物：${PRODUCTS.map((rel) => (existed.has(rel) ? `${rel}(已存在)` : rel)).join(', ')}`);
  process.exit(0);
}

const indexBackup = existsSync(indexFile) ? readFileSync(indexFile, 'utf8') : null;

function rollback() {
  if (KEEP) {
    console.error('[rollback] --keep：保留现场供排查，index.json 未恢复');
    return;
  }
  let removed = 0;
  for (const rel of PRODUCTS) {
    if (existed.has(rel)) continue;
    const p = join(DATA, rel);
    if (!existsSync(p)) continue;
    rmSync(p, { recursive: true, force: true });
    removed += 1;
  }
  if (indexBackup === null) {
    if (existsSync(indexFile)) rmSync(indexFile, { force: true });
  } else {
    writeFileSync(indexFile, indexBackup, 'utf8');
  }
  console.log(`[rollback] 清理半成品 ${removed} 项，tiles/index.json 已恢复`);
}

let ran = 0;
for (const step of steps) {
  console.log(`\n=== ${step.name} ===`);
  const r = spawnSync(step.bin, step.args, { cwd: ROOT, stdio: 'inherit' });
  if (r.error || r.status !== 0) {
    console.error(`[fail] ${step.name}: ${r.error ? r.error.message : `exit ${r.status}`}`);
    rollback();
    process.exit(1);
  }
  ran += 1;
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

const fresh = new Set(PRODUCTS.filter((rel) => existsSync(join(DATA, rel))));
const products = [];
for (const rel of PRODUCTS) {
  if (!fresh.has(rel)) continue;
  const p = join(DATA, rel);
  const st = statSync(p);
  if (st.isDirectory()) {
    const d = walkDir(p);
    products.push({ path: rel, kind: 'dir', files: d.files, bytes: d.bytes });
  } else {
    products.push({ path: rel, kind: 'file', sha256: sha256(p), bytes: st.size });
  }
}

const demZoom = demZminArg ? [demZmin, demZmax] : REGISTER_ONLY ? demIndexZoom() : null;
const labelArg = LABEL === NAME ? '' : ` --label="${LABEL}"`;
const demArg = demZmin ? ` --dem-zmin=${demZmin} --dem-zmax=${demZmax}` : '';
const entry = {
  name: NAME,
  label: LABEL,
  bbox: [w, s, e, n],
  zoom: [zmin, zmax],
  demZoom,
  command: `node Tools/add_region.mjs --name=${NAME} --bbox=${BBOX}${labelArg} --zmin=${zmin} --zmax=${zmax}${demArg}`,
  recordedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
  products,
};

let manifest = [];
if (existsSync(MANIFEST)) {
  try {
    const parsed = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    if (Array.isArray(parsed)) manifest = parsed;
  } catch {
    console.error('[manifest] 现有 data_manifest.json 解析失败，重写');
  }
}
manifest = manifest.filter((m) => m.name !== NAME);
manifest.push(entry);
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n', 'utf8');

const totalMB = (products.reduce((sum, p) => sum + p.bytes, 0) / 1048576).toFixed(1);
console.log(`\n完成：${ran ? `${ran} 步 · ` : ''}${NAME} 矢量 z${zmin}-${zmax}，${products.length} 类产物 / ${totalMB} MB，已登记 Tools/data_manifest.json`);

