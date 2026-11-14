const url = process.argv[2] ?? 'http://127.0.0.1:5183/';
const expr =
  process.argv[3] ??
  `JSON.stringify({
     canvas: (()=>{const c=document.querySelector('canvas'); return c?{w:c.width,h:c.height,cw:c.clientWidth,ch:c.clientHeight}:null})(),
     renderer: window.__renderer ? {
        w: __renderer.w, h: __renderer.h, dpr: __renderer.dpr,
        scale: __renderer.view.scale, cx: __renderer.view.cx, cy: __renderer.view.cy,
        rebuildMs: __renderer.lastRebuildMs, drawMs: __renderer.lastDrawMs,
        segments: __renderer.segmentCount
     } : null
   })`;

const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
let target = list.find((t) => t.type === 'page');
if (!target) {
  console.error('no page target');
  process.exit(1);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const logs = [];

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
    return;
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    logs.push(`[console.${msg.params.type}] ` + msg.params.args.map((a) => a.value ?? a.description ?? a.type).join(' '));
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    logs.push(`[exception] ${d.text} ${d.exception?.description ?? ''}`);
  }
  if (msg.method === 'Log.entryAdded') {
    logs.push(`[log.${msg.params.entry.level}] ${msg.params.entry.text}`);
  }
});

await new Promise((r) => ws.addEventListener('open', r));
await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Page.navigate', { url });
await new Promise((r) => setTimeout(r, 3500));

const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
console.log('EVAL:', JSON.stringify(res.result?.result?.value ?? res.result, null, 2));
console.log('--- logs ---');
for (const l of logs.slice(-25)) console.log(l);
ws.close();
