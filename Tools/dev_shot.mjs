import { writeFileSync } from 'node:fs';
import { connect, openPage, screenshot, setViewport, wait } from './dev_cdp.mjs';

const url = process.argv[2] ?? 'http://127.0.0.1:5183/';
const out = process.argv[3] ?? 'shot.png';
const waitMs = Number(process.argv[4] ?? 2500);
const preEval = process.argv[5] ?? '';

const cdp = await connect();
await cdp.send('Page.enable');
await setViewport(cdp.send);
await openPage(cdp.send, url);
await wait(waitMs);
if (preEval) {
  await cdp.send('Runtime.evaluate', { expression: preEval, awaitPromise: true, returnByValue: true });
  await wait(400);
}
const png = await screenshot(cdp.send);
if (!png) {
  console.error('capture failed');
  process.exit(1);
}
writeFileSync(out, png);
console.log('wrote', out);
cdp.close();
