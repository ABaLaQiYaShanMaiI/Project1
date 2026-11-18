import { writeFileSync } from 'node:fs';
import { connect, openPage, setViewport, wait } from './dev_cdp.mjs';

const url = process.argv[2] ?? 'http://127.0.0.1:5201/';
const out = process.argv[3] ?? 'map.png';
const waitMs = Number(process.argv[4] ?? 14000);
const port = Number(process.argv[5] ?? 9222);

const cdp = await connect(port);
await cdp.send('Page.enable');
await cdp.send('Runtime.enable');
await setViewport(cdp.send);
await openPage(cdp.send, url);
await wait(waitMs);
await wait(Number(process.argv[6] ?? 9000));

const preEval = process.argv[7] ?? '';
if (preEval) {
  const r = await cdp.evaluate(preEval);
  if (r !== undefined) console.log('pre:', JSON.stringify(r).slice(0, 200));
  await wait(Number(process.argv[8] ?? 4000));
}

const dataUrl = await cdp.evaluate(`(()=>{const m=window.__ml;if(!m)return null;
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
cdp.close();
