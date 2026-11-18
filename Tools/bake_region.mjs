import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

function arg(name, def) {
  const hit = process.argv.find((s) => s.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}

const KEY = arg('key', '');
const BBOX = arg('bbox', '');
const ZMIN = arg('zmin', '9');
const ZMAX = arg('zmax', '11');
const PACK = arg('pack', join(ROOT, 'app', 'public', 'data', 'tiles', `${KEY}.pmtiles`));
const DRY = process.argv.includes('--dry-run');
const SKIP = new Set(arg('skip', '').split(',').filter(Boolean));
const PY = arg('python', 'python');

if (!KEY) {
  console.error('用法: node Tools/bake_region.mjs --key=fulda --bbox=8.849,50.240,10.591,51.000 [--zmin=9 --zmax=11] [--skip=dem,slope] [--dry-run]');
  process.exit(2);
}
if (!existsSync(PACK)) {
  console.error(`找不到底图包：${PACK}`);
  console.error(`先跑：node Tools/fetch_basemap.mjs --key=${KEY} --bbox=<bbox> --name=<名称>`);
  process.exit(1);
}

const steps = [
  { name: 'dem', bin: PY, args: ['Tools/bake_dem.py', `--bbox=${BBOX}`, `--key=${KEY}`, `--zmin=${ZMIN}`, `--zmax=${ZMAX}`] },
  { name: 'contours', bin: PY, args: ['Tools/bake_contours.py', `--key=${KEY}`, `--bbox=${BBOX}`] },
  { name: 'rail', bin: process.execPath, args: ['Tools/bake_rail.mjs', `--pack=${PACK}`, `--zoom=${ZMAX}`, `--out=app/public/data/rails_${KEY}.json`] },
  { name: 'poi', bin: process.execPath, args: ['Tools/bake_poi.mjs', `--pack=${PACK}`, `--zoom=${ZMAX}`, `--out=app/public/data/poi_${KEY}.json`] },
  { name: 'slope', bin: PY, args: ['Tools/bake_slope.py', `--key=${KEY}`] },
  { name: 'cities', bin: process.execPath, args: ['Tools/bake_cities.mjs', `--pack=${PACK}`, '--zoom=13', '--kinds=city,town,village', `--out=app/public/data/cities_${KEY}.json`] },
];

if (!BBOX) {
  const needs = steps.filter((s) => s.name === 'dem' || s.name === 'contours');
  if (needs.length) {
    console.error('缺少 --bbox（dem 与 contours 必需）');
    process.exit(2);
  }
}

let ran = 0;
for (const step of steps) {
  if (SKIP.has(step.name)) {
    console.log(`[skip] ${step.name}`);
    continue;
  }
  const line = `${step.bin} ${step.args.join(' ')}`;
  if (DRY) {
    console.log(`[dry ] ${line}`);
    ran += 1;
    continue;
  }
  console.log(`\n=== ${step.name} ===`);
  const r = spawnSync(step.bin, step.args, { cwd: ROOT, stdio: 'inherit' });
  if (r.error) {
    console.error(`[fail] ${step.name}: ${r.error.message}`);
    process.exit(1);
  }
  if (r.status !== 0) {
    console.error(`[fail] ${step.name}: exit ${r.status}`);
    process.exit(1);
  }
  ran += 1;
}
console.log(`\n完成：${ran} 步（key=${KEY}）`);
