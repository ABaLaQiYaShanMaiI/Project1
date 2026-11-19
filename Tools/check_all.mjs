#!/usr/bin/env node
import { styleExpressionErrors } from './style_lint.mjs';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MAX_LINES = 700;
const MAX_DATA_MB = 4;
const MAX_FIRST_JS_KB = 120;

const results = [];

function record(name, ok, note) {
  results.push({ name, ok, note });
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${note ? `  ${note}` : ''}`);
}

function walk(dir, out = []) {
  let ents;
  try {
    ents = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of ents) {
    if (e === 'node_modules' || e === 'dist' || e.startsWith('.')) continue;
    const p = join(dir, e);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8' });
  return { code: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim(), error: r.error };
}

function tail(text, lines = 12) {
  const parts = text.split('\n').filter(Boolean);
  return parts.slice(-lines).join('\n');
}

function checkJsComments() {
  const r = run(process.execPath, [join(ROOT, 'Tools/strip_comments.mjs'), '--check'], ROOT);
  const ok = r.code === 0;
  record('无注释 · TS/TSX/JS/MJS/CSS', ok, ok ? r.out.split('\n').pop() : tail(r.out));
  return ok;
}

function findPython() {
  for (const cmd of ['python', 'python3', 'py']) {
    const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
    if (r.status === 0) return cmd;
  }
  return null;
}

function checkPyComments() {
  const py = findPython();
  if (!py) {
    record('无注释 · Python', false, '找不到 python，无法自检');
    return false;
  }
  const r = run(py, [join(ROOT, 'Tools/strip_comments.py'), '--check'], ROOT);
  const ok = r.code === 0;
  record('无注释 · Python', ok, ok ? 'clean' : tail(r.out));
  return ok;
}

function countLines(file) {
  const src = readFileSync(file, 'utf8');
  const n = src.split('\n').length;
  return src.endsWith('\n') ? n - 1 : n;
}

function checkLineBudget() {
  const files = walk(join(ROOT, 'app/src')).filter((f) => ['.ts', '.tsx', '.css'].includes(extname(f)));
  const over = files
    .map((f) => ({ f, n: countLines(f) }))
    .filter((x) => x.n > MAX_LINES)
    .sort((a, b) => b.n - a.n);
  if (over.length) {
    record('单文件行数 ≤ 700', false, over.map((x) => `${x.f.slice(ROOT.length)}:${x.n}`).join(' '));
    return false;
  }
  const max = files.reduce((m, f) => Math.max(m, countLines(f)), 0);
  record('单文件行数 ≤ 700', true, `最大 ${max} 行 / ${files.length} 个文件`);
  return true;
}

function checkDataBudget() {
  const roots = [join(ROOT, 'app/public/data')];
  const files = roots.flatMap((d) => walk(d)).filter((f) => extname(f) === '.json');
  let max = 0;
  const over = [];
  for (const f of files) {
    const mb = statSync(f).size / 1048576;
    max = Math.max(max, mb);
    if (mb > MAX_DATA_MB) over.push(`${f.slice(ROOT.length)} ${mb.toFixed(1)} MB`);
  }
  if (over.length) {
    record('单数据文件 ≤ 4 MB', false, over.join(' '));
    return false;
  }
  record('单数据文件 ≤ 4 MB', true, `最大 ${max.toFixed(2)} MB / ${files.length} 个 JSON`);
  return true;
}

function checkTypes() {
  const r = run(process.execPath, [join(ROOT, 'app/node_modules/typescript/bin/tsc'), '--noEmit', '-p', 'app'], ROOT);
  const ok = r.code === 0;
  record('tsc --noEmit', ok, ok ? '0 error' : tail(r.out));
  return ok;
}

function checkBuild() {
  const r = run(process.execPath, [join(ROOT, 'app/node_modules/vite/bin/vite.js'), 'build', '--logLevel', 'warn'], join(ROOT, 'app'));
  const ok = r.code === 0;
  record('vite build', ok, ok ? 'done' : tail(r.out));
  return ok;
}

function checkFirstJs() {
  const assets = join(ROOT, 'app/dist/assets');
  let files;
  try {
    files = readdirSync(assets).filter((f) => f.startsWith('index') && f.endsWith('.js'));
  } catch {
    record('首屏 JS ≤ 120 KB gzip', false, '缺少 app/dist/assets');
    return false;
  }
  if (!files.length) {
    record('首屏 JS ≤ 120 KB gzip', false, '找不到 index-*.js');
    return false;
  }
  let total = 0;
  const detail = [];
  for (const f of files) {
    const kb = gzipSync(readFileSync(join(assets, f)), { level: 9 }).length / 1024;
    total += kb;
    detail.push(`${f} ${kb.toFixed(1)} KB`);
  }
  const ok = total <= MAX_FIRST_JS_KB;
  record('首屏 JS ≤ 120 KB gzip', ok, `${total.toFixed(1)} KB（${detail.join(' + ')}）`);
  return ok;
}

function checkStyleExpressions() {
  const bad = styleExpressionErrors();
  const ok = bad.length === 0;
  record('样式表达式合法', ok, ok ? 'zoom 仅在顶层 interpolate/step' : bad.slice(0, 3).join(' | '));
  return ok;
}
const steps = [
  checkJsComments,
  checkPyComments,
  checkLineBudget,
  checkDataBudget,
  checkTypes,
  checkBuild,
  checkFirstJs,
  checkStyleExpressions,
];

for (const step of steps) {
  try {
    step();
  } catch (e) {
    record(step.name, false, String(e && e.message ? e.message : e));
  }
}

const failed = results.filter((r) => !r.ok);
console.log('');
console.log(failed.length ? `未通过：${failed.length}/${results.length}` : `全部通过：${results.length} 项`);
process.exit(failed.length ? 1 : 0);
