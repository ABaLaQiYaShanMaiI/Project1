import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const DATA = 'app/public/data';
const TEMP = 'Tools/.core_buildings.json';

function run(bin, args) {
  const r = spawnSync(bin, args, { stdio: 'inherit' });
  if (r.error || r.status !== 0) throw new Error(`${bin} exit ${r.status ?? r.error?.message}`);
}

const slopes = readdirSync(join(DATA, 'slope'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

for (const key of slopes) {
  console.log(`\n=== slope ${key} ===`);
  run('python', ['Tools/bake_slope.py', `--key=${key}`]);
}

if (!existsSync(join(DATA, 'density'))) {
  console.log('no density dir');
  process.exit(0);
}

const cores = readdirSync(join(DATA, 'density'), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

for (const key of cores) {
  const manPath = join(DATA, 'density', key, 'index.json');
  if (!existsSync(manPath)) continue;
  const man = JSON.parse(readFileSync(manPath, 'utf8'));
  const pack = man.source.startsWith('app') ? man.source : join(DATA, man.source.replace(/^\/?data\//, ''));
  if (!existsSync(pack)) {
    console.log(`[skip] ${key}: pack missing ${pack}`);
    continue;
  }
  console.log(`\n=== density ${key} ===`);
  run(process.execPath, [
    'Tools/dump_buildings.mjs',
    `--pack=${pack}`,
    `--bbox=${man.bbox.join(',')}`,
    `--zoom=${man.z}`,
    `--out=${TEMP}`,
  ]);
  run('python', ['Tools/bake_density.py', TEMP, key, man.bbox.join(',')]);
  if (existsSync(TEMP)) rmSync(TEMP);
}
console.log('\n美术派生资源重建完成（slope + density），未触碰任何 pmtiles。');
