import { writeFileSync } from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:5201/';
const out = process.argv[3] ?? 'map.png';
const waitMs = Number(process.argv[4] ?? 14000);
const port = Number(process.argv[5] ?? 9222);

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
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

const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  return res.result?.result?.value;
};

await new Promise((r) => ws.addEventListener('open', r));
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', { url });
await new Promise((r) => setTimeout(r, waitMs));


await new Promise((r) => setTimeout(r, Number(process.argv[6] ?? 9000)));

const preEval = process.argv[7] ?? '';
if (preEval) {
  const r = await evaluate(preEval);
  if (r !== undefined) console.log('pre:', JSON.stringify(r).slice(0, 200));
  await new Promise((r) => setTimeout(r, Number(process.argv[8] ?? 4000)));
}

const dataUrl = await evaluate(`(()=>{const m=window.__ml;if(!m)return null;
  return new Promise(res=>{
    m.once('render', ()=>{
      try { res(m.getCanvas().toDataURL('image/png')); } catch(e) { res(null); }
    });
    m.triggerRepaint();
  });
})()`);

if (!dataUrl) {
  console.error('no map canvas');
  process.exit(1);
}
writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'));
console.log('wrote', out);
ws.close();
