import { connect, openPage, wait } from './dev_cdp.mjs';

const URL_ = process.argv[2] ?? 'http://127.0.0.1:5183/';
const SECONDS = Number(process.argv[3] ?? 8);
const PORT = Number(process.argv[4] ?? 9222);
const STRICT = process.argv.includes('--strict');

const cdp = await connect(PORT);
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await cdp.send('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await openPage(cdp.send, URL_);

let ready = false;
for (let i = 0; i < 120; i++) {
  ready = await cdp.evaluate(`Boolean(window.__ml && window.__ml.isStyleLoaded())`).catch(() => false);
  if (ready) break;
  await wait(500);
}
if (!ready) {
  console.error('地图未就绪：请先 pnpm dev 并确认 window.__ml 存在');
  process.exit(2);
}

const headless = await cdp.evaluate(`/HeadlessChrome/.test(navigator.userAgent)`);
const renderer = await cdp.evaluate(`(()=>{try{const c=document.createElement('canvas');const gl=c.getContext('webgl2')||c.getContext('webgl');const e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)}catch(err){return 'unknown'}})()`);

await cdp.evaluate(`(()=>{
  const m = window.__ml;
  window.__perf = { frames: [] };
  window.__onRender = () => window.__perf.frames.push(performance.now());
  m.on('render', window.__onRender);
  return true;
})()`);

const cx = 800;
const cy = 450;
await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cx, y: cy, button: 'left', buttons: 1, clickCount: 1 });
const steps = Math.max(10, Math.round(SECONDS * 12));
for (let i = 1; i <= steps; i++) {
  const x = cx + Math.round(180 * Math.sin((i / steps) * Math.PI * 2));
  const y = cy + Math.round(90 * Math.cos((i / steps) * Math.PI * 2));
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1 });
  await wait(Math.round((SECONDS * 1000) / steps));
}
await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: cx, y: cy, button: 'left', buttons: 0, clickCount: 1 });

const drag = JSON.parse(
  await cdp.evaluate(`(()=>{
    const m = window.__ml;
    m.off('render', window.__onRender);
    const f = window.__perf.frames;
    const d = [];
    for (let i = 1; i < f.length; i += 1) d.push(f[i] - f[i - 1]);
    d.sort((a, b) => a - b);
    const q = (p) => (d.length ? d[Math.min(d.length - 1, Math.floor(d.length * p))] : 0);
    const sum = d.reduce((s, x) => s + x, 0);
    return JSON.stringify({
      frames: d.length,
      p50: Number(q(0.5).toFixed(1)),
      p95: Number(q(0.95).toFixed(1)),
      max: Number((d[d.length - 1] ?? 0).toFixed(1)),
      fps: d.length ? Number((1000 / (sum / d.length)).toFixed(1)) : 0,
      over20: d.filter((x) => x > 20).length,
      over33: d.filter((x) => x > 33).length,
    });
  })()`),
);

const staticTimes = [];
for (let i = 0; i < 15; i += 1) {
  const t = await cdp.evaluate(`(()=>{const m=window.__ml;return new Promise(res=>{const t0=performance.now();m.once('render',()=>res(performance.now()-t0));m.triggerRepaint()})})()`);
  staticTimes.push(Number(t));
}
staticTimes.sort((a, b) => a - b);
const staticMedian = Number(staticTimes[Math.floor(staticTimes.length / 2)].toFixed(1));

console.log(`renderer   ${renderer}${headless ? '  (headless)' : ''}`);
if (headless) console.log('注意      headless 下 canvas 拖动受合成器限制（本机实测恒在 21-25 FPS，与图层内容无关），数字仅供参考');
console.log(`drag       frames=${drag.frames} fps=${drag.fps} p50=${drag.p50}ms p95=${drag.p95}ms max=${drag.max}ms`);
console.log(`stutter    >20ms ${drag.over20} 帧 / >33ms ${drag.over33} 帧`);
console.log(`static     median=${staticMedian}ms p90=${Number(staticTimes[Math.floor(staticTimes.length * 0.9)].toFixed(1))}ms`);

const failFps = drag.fps < 60;
const failRedraw = staticMedian >= 40;
if (failFps || failRedraw) {
  console.log(`预算      ${failFps ? '帧率不足 60 ' : ''}${failRedraw ? '静态重绘 ≥40ms ' : ''}`);
}
cdp.close();
process.exit(STRICT && (failFps || failRedraw) ? 1 : 0);
