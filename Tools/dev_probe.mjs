import { connect, openPage, wait } from './dev_cdp.mjs';

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

const logs = [];
const cdp = await connect();
cdp.onEvent((msg) => {
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

await cdp.send('Runtime.enable');
await cdp.send('Log.enable');
await openPage(cdp.send, url);
await wait(3500);

const res = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
console.log('EVAL:', JSON.stringify(res.result?.result?.value ?? res.result, null, 2));
console.log('--- logs ---');
for (const l of logs.slice(-25)) console.log(l);
cdp.close();
