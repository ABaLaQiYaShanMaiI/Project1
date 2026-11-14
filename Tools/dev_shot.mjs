import { writeFileSync } from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:5183/';
const out = process.argv[3] ?? 'shot.png';
const waitMs = Number(process.argv[4] ?? 2500);
const preEval = process.argv[5] ?? '';

const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const target = list.find((t) => t.type === 'page');
if (!target) throw new Error('no page target');

const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

await new Promise((r) => ws.addEventListener('open', r));
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', { url });
await new Promise((r) => setTimeout(r, waitMs));
if (preEval) {
  await send('Runtime.evaluate', { expression: preEval, awaitPromise: true, returnByValue: true });
  await new Promise((r) => setTimeout(r, 400));
}
const res = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
if (!res.result?.data) {
  console.error('capture failed', JSON.stringify(res).slice(0, 300));
  process.exit(1);
}
writeFileSync(out, Buffer.from(res.result.data, 'base64'));
console.log('wrote', out);
ws.close();
