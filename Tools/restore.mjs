import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DATA = join(ROOT, 'app', 'public', 'data');
const MANIFEST = join(HERE, 'data_manifest.json');
const FIX = process.argv.includes('--fix');
const nameArg = process.argv.find((s) => s.startsWith('--name='));

function fail(msg) {
  console.error(`[restore] ${msg}`);
  process.exit(2);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
} catch {
  fail('读不到或解析失败：Tools/data_manifest.json（先用 add_region.mjs 登记区域）');
}
if (!Array.isArray(manifest) || !manifest.length) fail('manifest 为空，先用 add_region.mjs 登记区域');

const rows = nameArg ? manifest.filter((m) => m.name === nameArg.slice(7)) : manifest;
if (!rows.length) fail(`manifest 中没有 name=${nameArg ? nameArg.slice(7) : ''} 的条目`);

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

function check(prod) {
  const p = join(DATA, prod.path);
  if (!existsSync(p)) return '缺失';
  const st = statSync(p);
  if (prod.kind === 'dir') {
    const d = walkDir(p);
    if (d.files !== prod.files || d.bytes !== prod.bytes) {
      return `规模不符（现 ${d.files} 文件/${d.bytes} B，记 ${prod.files}/${prod.bytes}）`;
    }
    return null;
  }
  if (st.size !== prod.bytes) return `字节不符（现 ${st.size}，记 ${prod.bytes}）`;
  const h = `sha256:${createHash('sha256').update(readFileSync(p)).digest('hex')}`;
  return h === prod.sha256 ? null : 'sha256 不符';
}

let bad = 0;
for (const row of rows) {
  const problems = row.products
    .map((p) => ({ path: p.path, why: check(p) }))
    .filter((x) => x.why);
  if (!problems.length) {
    console.log(`[ok]   ${row.name}  ${row.products.length} 类产物一致`);
    continue;
  }
  bad += 1;
  for (const pr of problems) console.log(`[bad]  ${row.name} · ${pr.path}：${pr.why}`);
  const args = [
    'Tools/add_region.mjs',
    `--name=${row.name}`,
    `--bbox=${row.bbox.join(',')}`,
    `--zmin=${row.zoom[0]}`,
    `--zmax=${row.zoom[1]}`,
  ];
  if (row.demZoom) args.push(`--dem-zmin=${row.demZoom[0]}`, `--dem-zmax=${row.demZoom[1]}`);
  if (row.label && row.label !== row.name) args.push(`--label=${row.label}`);
  args.push('--force');
  if (FIX) {
    console.log(`[fix]  重跑 node ${args.join(' ')}`);
    const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
    if (r.error || r.status !== 0) {
      console.error(`[fail] ${row.name} 重建失败`);
      process.exit(1);
    }
  } else {
    console.log(`[hint] 重建命令：node ${args.join(' ')}`);
  }
}

console.log('');
if (bad === 0) {
  console.log(`全部一致：${rows.length} 条记录`);
} else if (FIX) {
  console.log(`重建完成：曾异常 ${bad}/${rows.length} 条`);
} else {
  console.log(`异常 ${bad}/${rows.length} 条（加 --fix 重跑重建命令）`);
  process.exit(1);
}
