import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

function walk(node, path, hit) {
  if (!Array.isArray(node)) return;
  if (node[0] === 'zoom') hit(path);
  node.forEach((child, i) => walk(child, [...path, i], hit));
}

export function styleExpressionErrors() {
  const r = spawnSync(process.execPath, [join(HERE, 'style_snapshot.mjs'), '--json'], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) return [`style_snapshot 失败：${(r.stdout ?? '') + (r.stderr ?? '')}`.slice(0, 400)];
  const spec = JSON.parse(r.stdout);
  const bad = [];
  for (const layer of spec.layers ?? []) {
    for (const key of ['paint', 'layout']) {
      const props = layer[key];
      if (!props) continue;
      for (const [name, value] of Object.entries(props)) {
        if (!Array.isArray(value)) continue;
        const op = value[0];
        const zoomIndex = op === 'interpolate' ? 2 : op === 'step' ? 1 : -1;
        const rootInput = zoomIndex >= 0 ? value[zoomIndex] : null;
        const rootOk = Array.isArray(rootInput) && rootInput[0] === 'zoom';
        walk(value, [], (path) => {
          const top = rootOk && path.length === 1 && path[0] === zoomIndex;
          if (!top) bad.push(`${layer.id}.${key}.${name}`);
        });
      }
    }
  }
  return [...new Set(bad)];
}
