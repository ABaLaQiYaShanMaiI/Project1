#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOTS = ['app/src', 'Tools'];
const EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.css']);
const CHECK = process.argv.includes('--check');

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
    else if (EXTS.has(extname(p)) && !p.endsWith('strip_comments.mjs')) out.push(p);
  }
  return out;
}

function regexAllowed(out) {
  const prev = out.replace(/\s+$/, '').slice(-1);
  if (!prev) return true;
  return '([{=,:;!&|?+-*%^~<>'.includes(prev);
}

function strip(src, isCss) {
  let out = '';
  let i = 0;
  const n = src.length;
  let mode = 'code';
  let inClass = false;
  while (i < n) {
    const c = src[i];
    const c2 = src[i + 1];
    if (mode === 'code') {
      if (!isCss && c === '/' && c2 === '/') {
        mode = 'line';
        i += 2;
        continue;
      }
      if (c === '/' && c2 === '*') {
        mode = 'block';
        i += 2;
        continue;
      }
      if (!isCss && c === '/' && regexAllowed(out)) {
        mode = 're';
        inClass = false;
        out += c;
        i++;
        continue;
      }
      if (c === "'") mode = 'sq';
      else if (c === '"') mode = 'dq';
      else if (c === '`') mode = 'tpl';
      out += c;
      i++;
      continue;
    }
    if (mode === 'line') {
      if (c === '\n') {
        mode = 'code';
        out += c;
      }
      i++;
      continue;
    }
    if (mode === 'block') {
      if (c === '*' && c2 === '/') {
        mode = 'code';
        i += 2;
      } else i++;
      continue;
    }
    if (mode === 're') {
      if (c === '\\') {
        out += c;
        if (i + 1 < n) out += src[i + 1];
        i += 2;
        continue;
      }
      if (c === '\n') {
        mode = 'code';
        out += c;
        i++;
        continue;
      }
      if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) {
        mode = 'code';
        out += c;
        i++;
        continue;
      }
      out += c;
      i++;
      continue;
    }
    out += c;
    if (c === '\\') {
      out += src[i + 1] ?? '';
      i += 2;
      continue;
    }
    if ((mode === 'sq' && c === "'") || (mode === 'dq' && c === '"') || (mode === 'tpl' && c === '`')) mode = 'code';
    i++;
  }
  return out;
}

function tidy(s) {
  return s
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '\n');
}

function hasComments(src, isCss) {
  const stripped = strip(src, isCss);
  return stripped !== src;
}

let dirty = 0;
let files = 0;
for (const root of ROOTS) {
  for (const f of walk(root)) {
    files++;
    const src = readFileSync(f, 'utf8');
    const isCss = extname(f) === '.css';
    if (!hasComments(src, isCss)) continue;
    dirty++;
    if (CHECK) {
      console.log('comment: ' + f);
    } else {
      writeFileSync(f, tidy(strip(src, isCss)), 'utf8');
      console.log('stripped: ' + f);
    }
  }
}

if (CHECK) {
  console.log(dirty === 0 ? `clean (${files} files)` : `dirty: ${dirty}/${files} files`);
  process.exit(dirty === 0 ? 0 : 1);
} else {
  console.log(`done: ${dirty}/${files} files changed`);
}
