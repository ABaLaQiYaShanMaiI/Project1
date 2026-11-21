import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const cat = JSON.parse(readFileSync('Tools/country_catalog.json', 'utf8'));
const keys = process.argv.slice(2);
for (const key of keys) {
  const e = cat.entries.find((x) => x.key === key);
  if (!e) {
    console.error('[backfill] missing catalog entry', key);
    continue;
  }
  console.log(`\n=== backfill ${e.key} (${e.name_en}) ===`);
  const r = spawnSync(
    process.execPath,
    ['Tools/add_country.mjs', `--key=${e.key}`, `--label=${e.name}`, `--label-en=${e.name_en}`, `--bbox=${e.bbox.join(',')}`],
    { stdio: 'inherit' },
  );
  if (r.status !== 0) {
    console.error('[backfill] FAIL', key, r.status);
  }
}
console.log('\nBACKFILL DONE');
