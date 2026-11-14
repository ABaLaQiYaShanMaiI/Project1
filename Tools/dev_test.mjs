import { writeFileSync } from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:5183/';
const outDir = process.argv[3] ?? 'E:/PersonalGame/Project1/Docx';

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
await send('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.navigate', { url });
await sleep(3000);

const results = {};

const evalJs = async (expression) => {
  const res = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.result?.exceptionDetails) {
    return { error: res.result.exceptionDetails.exception?.description ?? res.result.exceptionDetails.text };
  }
  return res.result?.result?.value;
};

const t0 = await evalJs('__store.clock.minutes');
await evalJs('__store.setSpeed(1)');
await sleep(1000);
const t1 = await evalJs('__store.clock.minutes');
await evalJs('__store.setSpeed(2)');
await sleep(1000);
const t2 = await evalJs('__store.clock.minutes');
await evalJs('__store.setSpeed(0)');
await sleep(600);
const t3 = await evalJs('__store.clock.minutes');
results.time = {
  at1x: +(t1 - t0).toFixed(2),
  at2x: +(t2 - t1).toFixed(2),
  paused: +(t3 - t2).toFixed(3),
  label: await evalJs('__store.clock.label'),
  stamp: await evalJs('__store.clock.stamp'),
};

const f0 = await evalJs('(__store.setSpeed(4), __store.clock.minutes)');
await sleep(1000);
const f1 = await evalJs('(__store.setSpeed(0), __store.clock.minutes)');
results.time.at4x = +(f1 - f0).toFixed(2);

results.select = await evalJs(`(() => {
  __store.select(__store.hexAt(10, 7));
  return new Promise(r => setTimeout(() => {
    const rows = [...document.querySelectorAll('.side .sec')].map(s => s.textContent).join('|');
    r({ hasTerrain: rows.includes('地形'), hasElev: rows.includes('平均高程'), text: rows.slice(0, 160) });
  }, 300));
})()`);

const shots = {};
for (const lv of ['L0', 'L1', 'L2']) {
  await evalJs(`__store.setZoom('${lv}')`);
  await sleep(700);
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const file = `${outDir}/_shot_${lv}.png`;
  writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
  shots[lv] = file;
}
results.shots = shots;
results.perf = await evalJs('JSON.stringify(__store.perf)');

console.log(JSON.stringify(results, null, 2));
ws.close();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
