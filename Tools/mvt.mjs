export function readVarint(buf, pos) {
  let result = 0;
  let shift = 0;
  while (pos.i < buf.length) {
    const b = buf[pos.i++];
    result += (b & 0x7f) * 2 ** shift;
    if ((b & 0x80) === 0) return result;
    shift += 7;
  }
  return result;
}

function readFloat(buf, pos, little) {
  const dv = new DataView(buf.buffer, buf.byteOffset + pos.i, 4);
  const v = little ? dv.getFloat32(0, true) : dv.getFloat32(0, false);
  pos.i += 4;
  return v;
}

function readDouble(buf, pos) {
  const dv = new DataView(buf.buffer, buf.byteOffset + pos.i, 8);
  const v = dv.getFloat64(0, true);
  pos.i += 8;
  return v;
}

function readString(buf, pos) {
  const len = readVarint(buf, pos);
  const s = Buffer.from(buf.subarray(pos.i, pos.i + len)).toString('utf8');
  pos.i += len;
  return s;
}

function skipField(buf, pos, wire) {
  if (wire === 0) readVarint(buf, pos);
  else if (wire === 1) pos.i += 8;
  else if (wire === 5) pos.i += 4;
  else if (wire === 2) pos.i += readVarint(buf, pos);
  else throw new Error(`wire ${wire}`);
}

function readValue(buf) {
  const pos = { i: 0 };
  while (pos.i < buf.length) {
    const key = readVarint(buf, pos);
    const field = key >>> 3;
    const wire = key & 7;
    if (field === 1) return readString(buf, pos);
    if (field === 2) return readFloat(buf, pos, true);
    if (field === 3) return readDouble(buf, pos);
    if (field === 4) return readVarint(buf, pos) << 0;
    if (field === 5) return readVarint(buf, pos);
    if (field === 6) return readVarint(buf, pos);
    if (field === 7) return readVarint(buf, pos) === 1;
    skipField(buf, pos, wire);
  }
  return null;
}

function zigzag(n) {
  return (n >> 1) ^ -(n & 1);
}

function readGeometry(buf, type) {
  const pos = { i: 0 };
  const out = { points: [], rings: [], type };
  let x = 0;
  let y = 0;
  let cur = null;
  while (pos.i < buf.length) {
    const cmd = readVarint(buf, pos);
    const id = cmd & 7;
    const count = cmd >>> 3;
    if (id === 1) {
      for (let i = 0; i < count; i++) {
        x += zigzag(readVarint(buf, pos));
        y += zigzag(readVarint(buf, pos));
        out.points.push([x, y]);
        cur = [[x, y]];
        out.rings.push(cur);
      }
    } else if (id === 2) {
      if (!cur) {
        cur = [];
        out.rings.push(cur);
      }
      for (let i = 0; i < count; i++) {
        x += zigzag(readVarint(buf, pos));
        y += zigzag(readVarint(buf, pos));
        cur.push([x, y]);
      }
    } else if (id === 7) {
      cur = null;
    }
  }
  return out;
}

export function decodeTile(buf) {
  const layers = new Map();
  const pos = { i: 0 };
  while (pos.i < buf.length) {
    const key = readVarint(buf, pos);
    const field = key >>> 3;
    const wire = key & 7;
    if (field !== 3 || wire !== 2) {
      skipField(buf, pos, wire);
      continue;
    }
    const len = readVarint(buf, pos);
    const layerBuf = buf.subarray(pos.i, pos.i + len);
    pos.i += len;
    const lp = { i: 0 };
    let name = '';
    let extent = 4096;
    const keys = [];
    const values = [];
    const raw = [];
    const geom = [];
    while (lp.i < layerBuf.length) {
      const k = readVarint(layerBuf, lp);
      const f = k >>> 3;
      const w = k & 7;
      if (f === 1 && w === 2) name = readString(layerBuf, lp);
      else if (f === 2 && w === 2) {
        const flen = readVarint(layerBuf, lp);
        raw.push(layerBuf.subarray(lp.i, lp.i + flen));
        lp.i += flen;
      } else if (f === 3 && w === 2) keys.push(readString(layerBuf, lp));
      else if (f === 4 && w === 2) {
        const vlen = readVarint(layerBuf, lp);
        values.push(readValue(layerBuf.subarray(lp.i, lp.i + vlen)));
        lp.i += vlen;
      } else if (f === 5 && w === 0) extent = readVarint(layerBuf, lp);
      else skipField(layerBuf, lp, w);
    }
    for (const fb of raw) {
      const fp = { i: 0 };
      let tags = [];
      let type = 1;
      let geometry = null;
      while (fp.i < fb.length) {
        const k = readVarint(fb, fp);
        const f = k >>> 3;
        const w = k & 7;
        if (f === 2 && w === 2) {
          const tlen = readVarint(fb, fp);
          const tb = fb.subarray(fp.i, fp.i + tlen);
          fp.i += tlen;
          const tp = { i: 0 };
          tags = [];
          while (tp.i < tb.length) tags.push(readVarint(tb, tp));
        } else if (f === 3 && w === 0) type = readVarint(fb, fp);
        else if (f === 4 && w === 2) {
          const glen = readVarint(fb, fp);
          geometry = fb.subarray(fp.i, fp.i + glen);
          fp.i += glen;
        } else skipField(fb, fp, w);
      }
      const props = {};
      for (let i = 0; i + 1 < tags.length; i += 2) {
        const key = keys[tags[i]];
        if (key !== undefined) props[key] = values[tags[i + 1]];
      }
      geom.push({ type, props, ...(geometry ? readGeometry(geometry, type) : { points: [], rings: [] }) });
    }
    layers.set(name, { name, extent, features: geom });
  }
  return layers;
}


