import { writeFileSync } from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:5183/';
const out = process.argv[3] ?? 'page.png';
const waitMs = Number(process.argv[4] ?? 12000);
const pre = process.argv[5] ?? '';
const after = Number(process.argv[6] ?? 4000);

const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const target = list.find((t) => t.type === 'page');
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
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await new Promise((r) => setTimeout(r, waitMs));
if (pre) {
  const res = await send('Runtime.evaluate', { expression: pre, awaitPromise: true, returnByValue: true });
  console.log('pre:', JSON.stringify(res.result?.result?.value));
  await new Promise((r) => setTimeout(r, after));
}
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log('wrote', out);
ws.close();
