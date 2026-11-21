import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

function arg(name, def) {
  const hit = process.argv.find((s) => s.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
}

const GB = 1024 ** 3;
const catalog = JSON.parse(readFileSync('Tools/country_catalog.json', 'utf8'));
const indexFile = 'app/public/data/tiles/index.json';
const index = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : { zones: [] };
const have = new Set(index.zones.map((z) => z.key));
for (const name of readdirSync('app/public/data/tiles')) {
  if (!name.endsWith('.pmtiles')) continue;
  const key = name.slice(0, -'.pmtiles'.length);
  if (catalog.entries.some((e) => e.key === key) && !have.has(key)) {
    rmSync(join('app/public/data/tiles', name), { force: true });
    console.log(`[clean] 未登记的半成品 ${key}`);
  }
}
const LIMIT = Number(arg('limit-gb', '100')) * GB;
const RESERVE = Number(arg('reserve-gb', '3')) * GB;
const ONLY = arg('only', '').split(',').filter(Boolean);
const START = Number(arg('start', '0'));
const COUNT = Number(arg('count', '0'));
const FULL = process.argv.includes('--full');

function totalBytes() {
  let sum = 0;
  for (const name of readdirSync('app/public/data/tiles')) {
    if (!name.endsWith('.pmtiles')) continue;
    sum += statSync(join('app/public/data/tiles', name)).size;
  }
  return sum;
}

let total = totalBytes();
let done = 0;
for (let i = START; i < catalog.entries.length; i += 1) {
  const e = catalog.entries[i];
  if (ONLY.length && !ONLY.includes(e.continent)) continue;
  if (have.has(e.key) || existsSync(`app/public/data/tiles/${e.key}.pmtiles`)) continue;
  if (COUNT && done >= COUNT) break;
  if (total + RESERVE > LIMIT) {
    console.log(`[stop] 预算守卫：已用 ${(total / GB).toFixed(1)} GB，保留 ${(RESERVE / GB).toFixed(1)} GB`);
    break;
  }
  console.log(`\n=== [${i + 1}/${catalog.entries.length}] ${e.key} · ${e.name_en} · ${e.continent} ===`);
  const r = spawnSync(
    process.execPath,
    [
      'Tools/add_country.mjs',
      `--key=${e.key}`,
      `--label=${e.name}`,
      `--label-en=${e.name_en}`,
      `--bbox=${e.bbox.join(',')}`,
      ...(FULL ? [] : ['--fast']),
    ],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) {
    console.error(`[fail] ${e.key} status=${r.status}`);
    continue;
  }
  done += 1;
  total = totalBytes();
  console.log(`[progress] 本轮 ${done} 国 · 累计 ${(total / GB).toFixed(2)} GB`);
}
console.log(`\n完成本批：${done} 个国家包，底图总量 ${(totalBytes() / GB).toFixed(2)} GB`);
