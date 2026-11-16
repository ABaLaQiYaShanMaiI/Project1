import { readFileSync } from 'node:fs';
const doc = JSON.parse(readFileSync('app/public/data/cities_fulda.json', 'utf8'));
console.log(doc.v, doc.zoom, doc.count, doc.stride, doc.radiusScaleM, 'b64 len', doc.b64.length);
const bin = Buffer.from(doc.b64, 'base64');
console.log('bytes', bin.length, 'recs', bin.length / 10);
for (let i = 0; i < 5; i++) {
  console.log(i, bin.readFloatLE(i * 10).toFixed(3), bin.readFloatLE(i * 10 + 4).toFixed(3), bin.readUInt8(i * 10 + 8), bin.readUInt8(i * 10 + 9));
}
