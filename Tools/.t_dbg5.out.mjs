// Tools/.t_dbg5.mjs
import { openAsBlob } from "node:fs";

// app/node_modules/.pnpm/fflate@0.8.3/node_modules/fflate/esm/index.mjs
import { createRequire } from "module";
var require2 = createRequire("/");
var _a;
var Worker;
var isMarkedAsUntransferable;
try {
  _a = require2("worker_threads"), Worker = _a.Worker, isMarkedAsUntransferable = _a.isMarkedAsUntransferable;
} catch (e) {
}
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  1,
  1,
  1,
  1,
  2,
  2,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  5,
  5,
  5,
  5,
  0,
  /* unused */
  0,
  0,
  /* impossible */
  0
]);
var fdeb = new u8([
  0,
  0,
  0,
  0,
  1,
  1,
  2,
  2,
  3,
  3,
  4,
  4,
  5,
  5,
  6,
  6,
  7,
  7,
  8,
  8,
  9,
  9,
  10,
  10,
  11,
  11,
  12,
  12,
  13,
  13,
  /* unused */
  0,
  0
]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b2 = new u16(31);
  for (var i = 0; i < 31; ++i) {
    b2[i] = start += 1 << eb[i - 1];
  }
  var r = new i32(b2[30]);
  for (var i = 1; i < 30; ++i) {
    for (var j2 = b2[i]; j2 < b2[i + 1]; ++j2) {
      r[j2] = j2 - b2[i] << 5 | i;
    }
  }
  return { b: b2, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0; i < 32768; ++i) {
  x3 = (i & 43690) >> 1 | (i & 21845) << 1;
  x3 = (x3 & 52428) >> 2 | (x3 & 13107) << 2;
  x3 = (x3 & 61680) >> 4 | (x3 & 3855) << 4;
  rev[i] = ((x3 & 65280) >> 8 | (x3 & 255) << 8) >> 1;
}
var x3;
var i;
var hMap = (function(cd, mb, r) {
  var s = cd.length;
  var i = 0;
  var l = new u16(mb);
  for (; i < s; ++i) {
    if (cd[i])
      ++l[cd[i] - 1];
  }
  var le = new u16(mb);
  for (i = 1; i < mb; ++i) {
    le[i] = le[i - 1] + l[i - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i = 0; i < s; ++i) {
      if (cd[i]) {
        var sv = i << 4 | cd[i];
        var r_1 = mb - cd[i];
        var v2 = le[cd[i] - 1]++ << r_1;
        for (var m = v2 | (1 << r_1) - 1; v2 <= m; ++v2) {
          co[rev[v2] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i = 0; i < s; ++i) {
      if (cd[i]) {
        co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
      }
    }
  }
  return co;
});
var flt = new u8(288);
for (i = 0; i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144; i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256; i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280; i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0; i < 32; ++i)
  fdt[i] = 5;
var i;
var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
var max = function(a) {
  var m = a[0];
  for (var i = 1; i < a.length; ++i) {
    if (a[i] > m)
      m = a[i];
  }
  return m;
};
var bits = function(d2, p, m) {
  var o = p / 8 | 0;
  return (d2[o] | d2[o + 1] << 8) >> (p & 7) & m;
};
var bits16 = function(d2, p) {
  var o = p / 8 | 0;
  return (d2[o] | d2[o + 1] << 8 | d2[o + 2] << 16) >> (p & 7);
};
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v2, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v2.length)
    e = v2.length;
  return new u8(v2.subarray(s, e));
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  // determined by compression function
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
  // determined by unknown compression method
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var inflt = function(dat, st, buf, dict) {
  var sl = dat.length, dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l)
    return buf || new u8(0);
  var noBuf = !buf;
  var resize = noBuf || st.i != 2;
  var noSt = st.i;
  if (noBuf)
    buf = new u8(sl * 3);
  var cbuf = function(l2) {
    var bl = buf.length;
    if (l2 > bl) {
      var nbuf = new u8(Math.max(bl * 2, l2));
      nbuf.set(buf);
      buf = nbuf;
    }
  };
  var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
  var tbts = sl * 8;
  do {
    if (!lm) {
      final = bits(dat, pos, 1);
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t2 = s + l;
        if (t2 > sl) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + l);
        buf.set(dat.subarray(s, t2), bt);
        st.b = bt += l, st.p = pos = t2 * 8, st.f = final;
        continue;
      } else if (type == 1)
        lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        var ldt = new u8(tl);
        var clt = new u8(19);
        for (var i = 0; i < hcLen; ++i) {
          clt[clim[i]] = bits(dat, pos + i * 3, 7);
        }
        pos += hcLen * 3;
        var clb = max(clt), clbmsk = (1 << clb) - 1;
        var clm = hMap(clt, clb, 1);
        for (var i = 0; i < tl; ) {
          var r = clm[bits(dat, pos, clbmsk)];
          pos += r & 15;
          var s = r >> 4;
          if (s < 16) {
            ldt[i++] = s;
          } else {
            var c = 0, n2 = 0;
            if (s == 16)
              n2 = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
            else if (s == 17)
              n2 = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18)
              n2 = 11 + bits(dat, pos, 127), pos += 7;
            while (n2--)
              ldt[i++] = c;
          }
        }
        var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        lbt = max(lt);
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else
        err(1);
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
    }
    if (resize)
      cbuf(bt + 131072);
    var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    var lpos = pos;
    for (; ; lpos = pos) {
      var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
      if (!c)
        err(2);
      if (sym < 256)
        buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add = sym - 254;
        if (sym > 264) {
          var i = sym - 257, b2 = fleb[i];
          add = bits(dat, pos, (1 << b2) - 1) + fl[i];
          pos += b2;
        }
        var d2 = dm[bits16(dat, pos) & dms], dsym = d2 >> 4;
        if (!d2)
          err(3);
        pos += d2 & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b2 = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b2) - 1, pos += b2;
        }
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + 131072);
        var end = bt + add;
        if (bt < dt) {
          var shift = dl - dt, dend = Math.min(dt, end);
          if (shift + bt < 0)
            err(3);
          for (; bt < dend; ++bt)
            buf[bt] = dict[shift + bt];
        }
        for (; bt < end; ++bt)
          buf[bt] = buf[bt - dt];
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm)
      final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
var et = /* @__PURE__ */ new u8(0);
var gzs = function(d2) {
  if (d2[0] != 31 || d2[1] != 139 || d2[2] != 8)
    err(6, "invalid gzip data");
  var flg = d2[3];
  var st = 10;
  if (flg & 4)
    st += (d2[10] | d2[11] << 8) + 2;
  for (var zs = (flg >> 3 & 1) + (flg >> 4 & 1); zs > 0; zs -= !d2[st++])
    ;
  return st + (flg & 2);
};
var gzl = function(d2) {
  var l = d2.length;
  return (d2[l - 4] | d2[l - 3] << 8 | d2[l - 2] << 16 | d2[l - 1] << 24) >>> 0;
};
var zls = function(d2, dict) {
  if ((d2[0] & 15) != 8 || d2[0] >> 4 > 7 || (d2[0] << 8 | d2[1]) % 31)
    err(6, "invalid zlib data");
  if ((d2[1] >> 5 & 1) == +!dict)
    err(6, "invalid zlib data: " + (d2[1] & 32 ? "need" : "unexpected") + " dictionary");
  return (d2[1] >> 3 & 4) + 2;
};
function inflateSync(data, opts) {
  return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
function gunzipSync(data, opts) {
  var st = gzs(data);
  if (st + 8 > data.length)
    err(6, "invalid gzip data");
  return inflt(data.subarray(st, -8), { i: 2 }, opts && opts.out || new u8(gzl(data)), opts && opts.dictionary);
}
function unzlibSync(data, opts) {
  return inflt(data.subarray(zls(data, opts && opts.dictionary), -4), { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
function decompressSync(data, opts) {
  return data[0] == 31 && data[1] == 139 && data[2] == 8 ? gunzipSync(data, opts) : (data[0] & 15) != 8 || data[0] >> 4 > 7 || (data[0] << 8 | data[1]) % 31 ? inflateSync(data, opts) : unzlibSync(data, opts);
}
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {
}

// app/node_modules/.pnpm/pmtiles@4.5.0/node_modules/pmtiles/dist/esm/index.js
var j = Object.defineProperty;
var S = Math.pow;
var d = (o, t2) => j(o, "name", { value: t2, configurable: true });
var h = (o, t2, e) => new Promise((r, n2) => {
  var s = (c) => {
    try {
      a(e.next(c));
    } catch (l) {
      n2(l);
    }
  }, i = (c) => {
    try {
      a(e.throw(c));
    } catch (l) {
      n2(l);
    }
  }, a = (c) => c.done ? r(c.value) : Promise.resolve(c.value).then(s, i);
  a((e = e.apply(o, t2)).next());
});
var re = d((o, t2) => {
  let e = false, r = "", n2 = L.GridLayer.extend({ createTile: d((s, i) => {
    let a = document.createElement("img"), c = new AbortController(), l = c.signal;
    return a.cancel = () => {
      c.abort();
    }, e || (o.getHeader().then((u) => {
      u.tileType === 1 || u.tileType === 6 ? console.error("Error: archive contains vector tiles, but leafletRasterLayer is for displaying raster tiles. See https://github.com/protomaps/PMTiles/tree/main/js for details.") : u.tileType === 2 ? r = "image/png" : u.tileType === 3 ? r = "image/jpeg" : u.tileType === 4 ? r = "image/webp" : u.tileType === 5 && (r = "image/avif");
    }), e = true), o.getZxy(s.z, s.x, s.y, l).then((u) => {
      if (u) {
        let m = new Blob([u.data], { type: r }), g = window.URL.createObjectURL(m);
        a.src = g;
      } else a.style.display = "none";
      a.cancel = void 0, i(void 0, a);
    }).catch((u) => {
      if (u.name !== "AbortError") throw u;
    }), a;
  }, "createTile"), _removeTile: d(function(s) {
    let i = this._tiles[s];
    i && (i.el.cancel && i.el.cancel(), i.el.src && window.URL.revokeObjectURL(i.el.src), i.el.width = 0, i.el.height = 0, i.el.deleted = true, L.DomUtil.remove(i.el), delete this._tiles[s], this.fire("tileunload", { tile: i.el, coords: this._keyToTileCoords(s) }));
  }, "_removeTile") });
  return new n2(t2);
}, "leafletRasterLayer");
var z = d((o) => (t2, e) => {
  if (e instanceof AbortController) return o(t2, e);
  let r = new AbortController();
  return o(t2, r).then((n2) => e(void 0, n2.data, n2.cacheControl || "", n2.expires || ""), (n2) => e(n2)).catch((n2) => e(n2)), { cancel: d(() => r.abort(), "cancel") };
}, "v3compat");
var A = class A2 {
  constructor(t2) {
    this.tilev4 = d((t3, e) => h(this, null, function* () {
      if (t3.type === "json") {
        let g = t3.url.substr(10), p = this.tiles.get(g);
        if (p || (p = new w(g), this.tiles.set(g, p)), this.metadata) {
          let K = yield p.getTileJson(t3.url);
          return e.signal.throwIfAborted(), { data: K };
        }
        let f = yield p.getHeader();
        return e.signal.throwIfAborted(), (f.minLon >= f.maxLon || f.minLat >= f.maxLat) && console.error(`Bounds of PMTiles archive ${f.minLon},${f.minLat},${f.maxLon},${f.maxLat} are not valid.`), { data: { tiles: [`${t3.url}/{z}/{x}/{y}`], minzoom: f.minZoom, maxzoom: f.maxZoom, bounds: [f.minLon, f.minLat, f.maxLon, f.maxLat] } };
      }
      let r = new RegExp(/pmtiles:\/\/(.+)\/(\d+)\/(\d+)\/(\d+)/), n2 = t3.url.match(r);
      if (!n2) throw new Error("Invalid PMTiles protocol URL");
      let s = n2[1], i = this.tiles.get(s);
      i || (i = new w(s), this.tiles.set(s, i));
      let a = n2[2], c = n2[3], l = n2[4], u = yield i == null ? void 0 : i.getZxy(+a, +c, +l, e.signal);
      if (e.signal.throwIfAborted(), u) return { data: new Uint8Array(u.data), cacheControl: u.cacheControl, expires: u.expires };
      let m = yield i.getHeader();
      if (m.tileType === 1 || m.tileType === 6) {
        if (this.errorOnMissingTile) throw new Error("Tile not found.");
        return { data: new Uint8Array() };
      }
      return { data: null };
    }), "tilev4");
    this.tile = z(this.tilev4);
    this.tiles = /* @__PURE__ */ new Map(), this.metadata = (t2 == null ? void 0 : t2.metadata) || false, this.errorOnMissingTile = (t2 == null ? void 0 : t2.errorOnMissingTile) || false;
  }
  add(t2) {
    this.tiles.set(t2.source.getKey(), t2);
  }
  get(t2) {
    return this.tiles.get(t2);
  }
};
d(A, "Protocol");
function b(o, t2) {
  return (t2 >>> 0) * 4294967296 + (o >>> 0);
}
d(b, "toNum");
function N(o, t2) {
  let e = t2.buf, r = e[t2.pos++], n2 = (r & 112) >> 4;
  if (r < 128 || (r = e[t2.pos++], n2 |= (r & 127) << 3, r < 128) || (r = e[t2.pos++], n2 |= (r & 127) << 10, r < 128) || (r = e[t2.pos++], n2 |= (r & 127) << 17, r < 128) || (r = e[t2.pos++], n2 |= (r & 127) << 24, r < 128) || (r = e[t2.pos++], n2 |= (r & 1) << 31, r < 128)) return b(o, n2);
  throw new Error("Expected varint not more than 10 bytes");
}
d(N, "readVarintRemainder");
function x(o) {
  let t2 = o.buf, e = t2[o.pos++], r = e & 127;
  return e < 128 || (e = t2[o.pos++], r |= (e & 127) << 7, e < 128) || (e = t2[o.pos++], r |= (e & 127) << 14, e < 128) || (e = t2[o.pos++], r |= (e & 127) << 21, e < 128) ? r : (e = t2[o.pos], r |= (e & 15) << 28, N(r, o));
}
d(x, "readVarint");
function I(o, t2, e, r, n2) {
  return n2 === 0 ? r !== 0 ? [o - 1 - e, o - 1 - t2] : [e, t2] : [t2, e];
}
d(I, "rotate");
function q(o, t2, e) {
  if (o > 26) throw new Error("Tile zoom level exceeds max safe number limit (26)");
  if (t2 >= 1 << o || e >= 1 << o) throw new Error("tile x/y outside zoom level bounds");
  let r = ((1 << o) * (1 << o) - 1) / 3, n2 = o - 1, [s, i] = [t2, e];
  for (let a = 1 << n2; a > 0; a >>= 1) {
    let c = s & a, l = i & a;
    r += (3 * c ^ l) * (1 << n2), [s, i] = I(a, s, i, c, l), n2--;
  }
  return r;
}
d(q, "zxyToTileId");
function G(o) {
  let t2 = 3 * o + 1;
  return t2 < 4294967296 ? 31 - Math.clz32(t2) : 63 - Math.clz32(t2 / 4294967296);
}
d(G, "tileIdToZ");
function ie(o) {
  let t2 = G(o) >> 1;
  if (t2 > 26) throw new Error("Tile zoom level exceeds max safe number limit (26)");
  let e = ((1 << t2) * (1 << t2) - 1) / 3, r = o - e, n2 = 0, s = 0, i = 1 << t2;
  for (let a = 1; a < i; a <<= 1) {
    let c = a & r / 2, l = a & (r ^ c);
    [n2, s] = I(a, n2, s, c, l), r = r / 2, n2 += c, s += l;
  }
  return [t2, n2, s];
}
d(ie, "tileIdToZxy");
var J = ((s) => (s[s.Unknown = 0] = "Unknown", s[s.None = 1] = "None", s[s.Gzip = 2] = "Gzip", s[s.Brotli = 3] = "Brotli", s[s.Zstd = 4] = "Zstd", s))(J || {});
function P(o, t2) {
  return h(this, null, function* () {
    if (t2 === 1 || t2 === 0) return o;
    if (t2 === 2) {
      if (typeof globalThis.DecompressionStream == "undefined") return decompressSync(new Uint8Array(o));
      let e = new Response(o).body;
      if (!e) throw new Error("Failed to read response stream");
      let r = e.pipeThrough(new globalThis.DecompressionStream("gzip"));
      return new Response(r).arrayBuffer();
    }
    throw new Error("Compression method not supported");
  });
}
d(P, "defaultDecompress");
var O = ((a) => (a[a.Unknown = 0] = "Unknown", a[a.Mvt = 1] = "Mvt", a[a.Png = 2] = "Png", a[a.Jpeg = 3] = "Jpeg", a[a.Webp = 4] = "Webp", a[a.Avif = 5] = "Avif", a[a.Mlt = 6] = "Mlt", a))(O || {});
function _(o) {
  return o === 1 ? ".mvt" : o === 2 ? ".png" : o === 3 ? ".jpg" : o === 4 ? ".webp" : o === 5 ? ".avif" : o === 6 ? ".mlt" : "";
}
d(_, "tileTypeExt");
var Y = 127;
function Q(o, t2) {
  let e = 0, r = o.length - 1;
  for (; e <= r; ) {
    let n2 = r + e >> 1, s = t2 - o[n2].tileId;
    if (s > 0) e = n2 + 1;
    else if (s < 0) r = n2 - 1;
    else return o[n2];
  }
  return r >= 0 && (o[r].runLength === 0 || t2 - o[r].tileId < o[r].runLength) ? o[r] : null;
}
d(Q, "findTile");
var T = class T2 {
  constructor(t2) {
    this.file = t2;
  }
  getKey() {
    return this.file.name;
  }
  getBytes(t2, e) {
    return h(this, null, function* () {
      return { data: yield this.file.slice(t2, t2 + e).arrayBuffer() };
    });
  }
};
d(T, "FileSource");
var k = T;
var D = class D2 {
  constructor(t2, e = new Headers(), r = void 0) {
    var a, c;
    this.url = t2, this.customHeaders = e, this.credentials = r, this.mustReload = false;
    let n2 = "";
    "navigator" in globalThis && (n2 = (c = (a = globalThis.navigator) == null ? void 0 : a.userAgent) != null ? c : "");
    let s = n2.indexOf("Windows") > -1, i = /Chrome|Chromium|Edg|OPR|Brave/.test(n2);
    this.chromeWindowsNoCache = false, s && i && (this.chromeWindowsNoCache = true);
  }
  getKey() {
    return this.url;
  }
  setHeaders(t2) {
    this.customHeaders = t2;
  }
  getBytes(t2, e, r, n2) {
    return h(this, null, function* () {
      let s, i;
      r ? i = r : (s = new AbortController(), i = s.signal);
      let a = new Headers(this.customHeaders);
      a.set("range", `bytes=${t2}-${t2 + e - 1}`);
      let c;
      this.mustReload ? c = "reload" : this.chromeWindowsNoCache && (c = "no-store");
      let l = yield fetch(this.url, { signal: i, cache: c, headers: a, credentials: this.credentials });
      if (t2 === 0 && l.status === 416) {
        let p = l.headers.get("Content-Range");
        if (!p || !p.startsWith("bytes */")) throw new Error("Missing content-length on 416 response");
        let f = +p.substr(8);
        a.set("range", `bytes=0-${f - 1}`), l = yield fetch(this.url, { signal: i, cache: "reload", headers: a, credentials: this.credentials });
      }
      let u = l.headers.get("Etag");
      if (u != null && u.startsWith("W/") && (u = null), l.status === 416 || n2 && u && u !== n2) throw this.mustReload = true, new v(`Server returned non-matching ETag ${n2} after one retry. Check browser extensions and servers for issues that may affect correct ETag headers.`);
      if (l.status >= 300) throw new Error(`Bad response code: ${l.status}`);
      let m = l.headers.get("Content-Length");
      if (l.status === 200 && (!m || +m > e)) throw s && s.abort(), new Error("Server returned no content-length header or content-length exceeding request. Check that your storage backend supports HTTP Byte Serving.");
      return { data: yield l.arrayBuffer(), etag: u || void 0, cacheControl: l.headers.get("Cache-Control") || void 0, expires: l.headers.get("Expires") || void 0 };
    });
  }
};
d(D, "FetchSource");
var E = D;
function y(o, t2) {
  let e = o.getUint32(t2 + 4, true), r = o.getUint32(t2 + 0, true);
  return e * S(2, 32) + r;
}
d(y, "getUint64");
function X(o, t2) {
  let e = new DataView(o), r = e.getUint8(7);
  if (r > 3) throw new Error(`Archive is spec version ${r} but this library supports up to spec version 3`);
  return { specVersion: r, rootDirectoryOffset: y(e, 8), rootDirectoryLength: y(e, 16), jsonMetadataOffset: y(e, 24), jsonMetadataLength: y(e, 32), leafDirectoryOffset: y(e, 40), leafDirectoryLength: y(e, 48), tileDataOffset: y(e, 56), tileDataLength: y(e, 64), numAddressedTiles: y(e, 72), numTileEntries: y(e, 80), numTileContents: y(e, 88), clustered: e.getUint8(96) === 1, internalCompression: e.getUint8(97), tileCompression: e.getUint8(98), tileType: e.getUint8(99), minZoom: e.getUint8(100), maxZoom: e.getUint8(101), minLon: e.getInt32(102, true) / 1e7, minLat: e.getInt32(106, true) / 1e7, maxLon: e.getInt32(110, true) / 1e7, maxLat: e.getInt32(114, true) / 1e7, centerZoom: e.getUint8(118), centerLon: e.getInt32(119, true) / 1e7, centerLat: e.getInt32(123, true) / 1e7, etag: t2 };
}
d(X, "bytesToHeader");
function Z(o) {
  let t2 = { buf: new Uint8Array(o), pos: 0 }, e = x(t2), r = [], n2 = 0;
  for (let s = 0; s < e; s++) {
    let i = x(t2);
    r.push({ tileId: n2 + i, offset: 0, length: 0, runLength: 1 }), n2 += i;
  }
  for (let s = 0; s < e; s++) r[s].runLength = x(t2);
  for (let s = 0; s < e; s++) r[s].length = x(t2);
  for (let s = 0; s < e; s++) {
    let i = x(t2);
    i === 0 && s > 0 ? r[s].offset = r[s - 1].offset + r[s - 1].length : r[s].offset = i - 1;
  }
  return r;
}
d(Z, "deserializeIndex");
var R = class R2 extends Error {
};
d(R, "EtagMismatch");
var v = R;
function V(o, t2) {
  return h(this, null, function* () {
    let e = yield o.getBytes(0, 16384);
    if (new DataView(e.data).getUint16(0, true) !== 19792) throw new Error("Wrong magic number for PMTiles archive");
    let n2 = e.data.slice(0, Y), s = X(n2, e.etag), i = e.data.slice(s.rootDirectoryOffset, s.rootDirectoryOffset + s.rootDirectoryLength), a = `${o.getKey()}|${s.etag || ""}|${s.rootDirectoryOffset}|${s.rootDirectoryLength}`, c = Z(yield t2(i, s.internalCompression));
    return [s, [a, c.length, c]];
  });
}
d(V, "getHeaderAndRoot");
function F(o, t2, e, r, n2, s) {
  return h(this, null, function* () {
    let i = yield o.getBytes(e, r, s, n2.etag), a = yield t2(i.data, n2.internalCompression), c = Z(a);
    if (c.length === 0) throw new Error("Empty directory is invalid");
    return c;
  });
}
d(F, "getDirectory");
var U = class U2 {
  constructor(t2 = 100, e = true, r = P) {
    this.cache = /* @__PURE__ */ new Map(), this.maxCacheEntries = t2, this.counter = 1, this.decompress = r;
  }
  getHeader(t2) {
    return h(this, null, function* () {
      let e = t2.getKey(), r = this.cache.get(e);
      if (r) return r.lastUsed = this.counter++, r.data;
      let n2 = yield V(t2, this.decompress);
      return n2[1] && this.cache.set(n2[1][0], { lastUsed: this.counter++, data: n2[1][2] }), this.cache.set(e, { lastUsed: this.counter++, data: n2[0] }), this.prune(), n2[0];
    });
  }
  getDirectory(t2, e, r, n2, s) {
    return h(this, null, function* () {
      let i = `${t2.getKey()}|${n2.etag || ""}|${e}|${r}`, a = this.cache.get(i);
      if (a) return a.lastUsed = this.counter++, a.data;
      let c = yield F(t2, this.decompress, e, r, n2, s);
      return this.cache.set(i, { lastUsed: this.counter++, data: c }), this.prune(), c;
    });
  }
  prune() {
    if (this.cache.size > this.maxCacheEntries) {
      let t2 = 1 / 0, e;
      this.cache.forEach((r, n2) => {
        r.lastUsed < t2 && (t2 = r.lastUsed, e = n2);
      }), e && this.cache.delete(e);
    }
  }
  invalidate(t2) {
    return h(this, null, function* () {
      this.cache.delete(t2.getKey());
    });
  }
};
d(U, "ResolvedValueCache");
var M = class M2 {
  constructor(t2 = 100, e = true, r = P) {
    this.cache = /* @__PURE__ */ new Map(), this.invalidations = /* @__PURE__ */ new Map(), this.pendingFetches = /* @__PURE__ */ new Map(), this.maxCacheEntries = t2, this.counter = 1, this.decompress = r;
  }
  getHeader(t2) {
    return h(this, null, function* () {
      let e = t2.getKey(), r = this.cache.get(e);
      if (r) return r.lastUsed = this.counter++, yield r.data;
      let n2 = new Promise((s, i) => {
        V(t2, this.decompress).then((a) => {
          a[1] && this.cache.set(a[1][0], { lastUsed: this.counter++, data: Promise.resolve(a[1][2]) }), s(a[0]), this.prune();
        }).catch((a) => {
          i(a);
        });
      });
      return this.cache.set(e, { lastUsed: this.counter++, data: n2 }), n2;
    });
  }
  trackSignal(t2, e, r) {
    e.refs++, r.addEventListener("abort", () => {
      --e.refs <= 0 && this.pendingFetches.get(t2) === e && (e.controller.abort(), this.cache.delete(t2), this.pendingFetches.delete(t2));
    }, { once: true });
  }
  getDirectory(t2, e, r, n2, s) {
    return h(this, null, function* () {
      let i = `${t2.getKey()}|${n2.etag || ""}|${e}|${r}`, a = this.cache.get(i);
      if (a) {
        a.lastUsed = this.counter++;
        let m = this.pendingFetches.get(i);
        return m && this.trackSignal(i, m, s != null ? s : new AbortController().signal), yield a.data;
      }
      let c = new AbortController(), l = { controller: c, refs: 0 };
      this.trackSignal(i, l, s != null ? s : new AbortController().signal), this.pendingFetches.set(i, l);
      let u = new Promise((m, g) => {
        F(t2, this.decompress, e, r, n2, c.signal).then((p) => {
          this.pendingFetches.delete(i), m(p), this.prune();
        }).catch((p) => {
          g(p);
        });
      });
      return this.cache.set(i, { lastUsed: this.counter++, data: u }), u;
    });
  }
  prune() {
    if (this.cache.size >= this.maxCacheEntries) {
      let t2 = 1 / 0, e;
      this.cache.forEach((r, n2) => {
        r.lastUsed < t2 && (t2 = r.lastUsed, e = n2);
      }), e && this.cache.delete(e);
    }
  }
  invalidate(t2) {
    return h(this, null, function* () {
      let e = t2.getKey();
      if (this.invalidations.get(e)) return yield this.invalidations.get(e);
      this.cache.delete(t2.getKey());
      let r = new Promise((n2, s) => {
        this.getHeader(t2).then((i) => {
          n2(), this.invalidations.delete(e);
        }).catch((i) => {
          s(i);
        });
      });
      this.invalidations.set(e, r);
    });
  }
};
d(M, "SharedPromiseCache");
var C = M;
var H = class H2 {
  constructor(t2, e, r) {
    typeof t2 == "string" ? this.source = new E(t2) : this.source = t2, r ? this.decompress = r : this.decompress = P, e ? this.cache = e : this.cache = new C();
  }
  getHeader() {
    return h(this, null, function* () {
      return yield this.cache.getHeader(this.source);
    });
  }
  getZxyAttempt(t2, e, r, n2) {
    return h(this, null, function* () {
      let s = q(t2, e, r), i = yield this.cache.getHeader(this.source);
      if (n2 == null || n2.throwIfAborted(), t2 < i.minZoom || t2 > i.maxZoom) return;
      let a = i.rootDirectoryOffset, c = i.rootDirectoryLength;
      for (let l = 0; l <= 3; l++) {
        let u = yield this.cache.getDirectory(this.source, a, c, i, n2);
        n2 == null || n2.throwIfAborted();
        let m = Q(u, s);
        if (m) {
          if (m.runLength > 0) {
            let g = yield this.source.getBytes(i.tileDataOffset + m.offset, m.length, n2, i.etag);
            return { data: yield this.decompress(g.data, i.tileCompression), cacheControl: g.cacheControl, expires: g.expires };
          }
          a = i.leafDirectoryOffset + m.offset, c = m.length;
        } else return;
      }
      throw new Error("Maximum directory depth exceeded");
    });
  }
  getZxy(t2, e, r, n2) {
    return h(this, null, function* () {
      try {
        return yield this.getZxyAttempt(t2, e, r, n2);
      } catch (s) {
        if (s instanceof v) return this.cache.invalidate(this.source), yield this.getZxyAttempt(t2, e, r, n2);
        throw s;
      }
    });
  }
  getMetadataAttempt() {
    return h(this, null, function* () {
      let t2 = yield this.cache.getHeader(this.source), e = yield this.source.getBytes(t2.jsonMetadataOffset, t2.jsonMetadataLength, void 0, t2.etag), r = yield this.decompress(e.data, t2.internalCompression), n2 = new TextDecoder("utf-8");
      return JSON.parse(n2.decode(r));
    });
  }
  getMetadata() {
    return h(this, null, function* () {
      try {
        return yield this.getMetadataAttempt();
      } catch (t2) {
        if (t2 instanceof v) return this.cache.invalidate(this.source), yield this.getMetadataAttempt();
        throw t2;
      }
    });
  }
  getTileJson(t2) {
    return h(this, null, function* () {
      let e = yield this.getHeader(), r = yield this.getMetadata(), n2 = _(e.tileType);
      return { tilejson: "3.0.0", scheme: "xyz", tiles: [`${t2}/{z}/{x}/{y}${n2}`], vector_layers: r.vector_layers, attribution: r.attribution, description: r.description, name: r.name, version: r.version, bounds: [e.minLon, e.minLat, e.maxLon, e.maxLat], center: [e.centerLon, e.centerLat, e.centerZoom], minzoom: e.minZoom, maxzoom: e.maxZoom };
    });
  }
};
d(H, "PMTiles");
var w = H;

// app/node_modules/.pnpm/@mapbox+point-geometry@1.1.0/node_modules/@mapbox/point-geometry/index.js
function Point(x3, y3) {
  this.x = x3;
  this.y = y3;
}
Point.prototype = {
  /**
   * Clone this point, returning a new point that can be modified
   * without affecting the old one.
   * @return {Point} the clone
   */
  clone() {
    return new Point(this.x, this.y);
  },
  /**
   * Add this point's x & y coordinates to another point,
   * yielding a new point.
   * @param {Point} p the other point
   * @return {Point} output point
   */
  add(p) {
    return this.clone()._add(p);
  },
  /**
   * Subtract this point's x & y coordinates to from point,
   * yielding a new point.
   * @param {Point} p the other point
   * @return {Point} output point
   */
  sub(p) {
    return this.clone()._sub(p);
  },
  /**
   * Multiply this point's x & y coordinates by point,
   * yielding a new point.
   * @param {Point} p the other point
   * @return {Point} output point
   */
  multByPoint(p) {
    return this.clone()._multByPoint(p);
  },
  /**
   * Divide this point's x & y coordinates by point,
   * yielding a new point.
   * @param {Point} p the other point
   * @return {Point} output point
   */
  divByPoint(p) {
    return this.clone()._divByPoint(p);
  },
  /**
   * Multiply this point's x & y coordinates by a factor,
   * yielding a new point.
   * @param {number} k factor
   * @return {Point} output point
   */
  mult(k2) {
    return this.clone()._mult(k2);
  },
  /**
   * Divide this point's x & y coordinates by a factor,
   * yielding a new point.
   * @param {number} k factor
   * @return {Point} output point
   */
  div(k2) {
    return this.clone()._div(k2);
  },
  /**
   * Rotate this point around the 0, 0 origin by an angle a,
   * given in radians
   * @param {number} a angle to rotate around, in radians
   * @return {Point} output point
   */
  rotate(a) {
    return this.clone()._rotate(a);
  },
  /**
   * Rotate this point around p point by an angle a,
   * given in radians
   * @param {number} a angle to rotate around, in radians
   * @param {Point} p Point to rotate around
   * @return {Point} output point
   */
  rotateAround(a, p) {
    return this.clone()._rotateAround(a, p);
  },
  /**
   * Multiply this point by a 4x1 transformation matrix
   * @param {[number, number, number, number]} m transformation matrix
   * @return {Point} output point
   */
  matMult(m) {
    return this.clone()._matMult(m);
  },
  /**
   * Calculate this point but as a unit vector from 0, 0, meaning
   * that the distance from the resulting point to the 0, 0
   * coordinate will be equal to 1 and the angle from the resulting
   * point to the 0, 0 coordinate will be the same as before.
   * @return {Point} unit vector point
   */
  unit() {
    return this.clone()._unit();
  },
  /**
   * Compute a perpendicular point, where the new y coordinate
   * is the old x coordinate and the new x coordinate is the old y
   * coordinate multiplied by -1
   * @return {Point} perpendicular point
   */
  perp() {
    return this.clone()._perp();
  },
  /**
   * Return a version of this point with the x & y coordinates
   * rounded to integers.
   * @return {Point} rounded point
   */
  round() {
    return this.clone()._round();
  },
  /**
   * Return the magnitude of this point: this is the Euclidean
   * distance from the 0, 0 coordinate to this point's x and y
   * coordinates.
   * @return {number} magnitude
   */
  mag() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  },
  /**
   * Judge whether this point is equal to another point, returning
   * true or false.
   * @param {Point} other the other point
   * @return {boolean} whether the points are equal
   */
  equals(other) {
    return this.x === other.x && this.y === other.y;
  },
  /**
   * Calculate the distance from this point to another point
   * @param {Point} p the other point
   * @return {number} distance
   */
  dist(p) {
    return Math.sqrt(this.distSqr(p));
  },
  /**
   * Calculate the distance from this point to another point,
   * without the square root step. Useful if you're comparing
   * relative distances.
   * @param {Point} p the other point
   * @return {number} distance
   */
  distSqr(p) {
    const dx = p.x - this.x, dy = p.y - this.y;
    return dx * dx + dy * dy;
  },
  /**
   * Get the angle from the 0, 0 coordinate to this point, in radians
   * coordinates.
   * @return {number} angle
   */
  angle() {
    return Math.atan2(this.y, this.x);
  },
  /**
   * Get the angle from this point to another point, in radians
   * @param {Point} b the other point
   * @return {number} angle
   */
  angleTo(b2) {
    return Math.atan2(this.y - b2.y, this.x - b2.x);
  },
  /**
   * Get the angle between this point and another point, in radians
   * @param {Point} b the other point
   * @return {number} angle
   */
  angleWith(b2) {
    return this.angleWithSep(b2.x, b2.y);
  },
  /**
   * Find the angle of the two vectors, solving the formula for
   * the cross product a x b = |a||b|sin(θ) for θ.
   * @param {number} x the x-coordinate
   * @param {number} y the y-coordinate
   * @return {number} the angle in radians
   */
  angleWithSep(x3, y3) {
    return Math.atan2(
      this.x * y3 - this.y * x3,
      this.x * x3 + this.y * y3
    );
  },
  /** @param {[number, number, number, number]} m */
  _matMult(m) {
    const x3 = m[0] * this.x + m[1] * this.y, y3 = m[2] * this.x + m[3] * this.y;
    this.x = x3;
    this.y = y3;
    return this;
  },
  /** @param {Point} p */
  _add(p) {
    this.x += p.x;
    this.y += p.y;
    return this;
  },
  /** @param {Point} p */
  _sub(p) {
    this.x -= p.x;
    this.y -= p.y;
    return this;
  },
  /** @param {number} k */
  _mult(k2) {
    this.x *= k2;
    this.y *= k2;
    return this;
  },
  /** @param {number} k */
  _div(k2) {
    this.x /= k2;
    this.y /= k2;
    return this;
  },
  /** @param {Point} p */
  _multByPoint(p) {
    this.x *= p.x;
    this.y *= p.y;
    return this;
  },
  /** @param {Point} p */
  _divByPoint(p) {
    this.x /= p.x;
    this.y /= p.y;
    return this;
  },
  _unit() {
    this._div(this.mag());
    return this;
  },
  _perp() {
    const y3 = this.y;
    this.y = this.x;
    this.x = -y3;
    return this;
  },
  /** @param {number} angle */
  _rotate(angle) {
    const cos = Math.cos(angle), sin = Math.sin(angle), x3 = cos * this.x - sin * this.y, y3 = sin * this.x + cos * this.y;
    this.x = x3;
    this.y = y3;
    return this;
  },
  /**
   * @param {number} angle
   * @param {Point} p
   */
  _rotateAround(angle, p) {
    const cos = Math.cos(angle), sin = Math.sin(angle), x3 = p.x + cos * (this.x - p.x) - sin * (this.y - p.y), y3 = p.y + sin * (this.x - p.x) + cos * (this.y - p.y);
    this.x = x3;
    this.y = y3;
    return this;
  },
  _round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    return this;
  },
  constructor: Point
};
Point.convert = function(p) {
  if (p instanceof Point) {
    return (
      /** @type {Point} */
      p
    );
  }
  if (Array.isArray(p)) {
    return new Point(+p[0], +p[1]);
  }
  if (p.x !== void 0 && p.y !== void 0) {
    return new Point(+p.x, +p.y);
  }
  throw new Error("Expected [x, y] or {x, y} point format");
};

// app/node_modules/.pnpm/@mapbox+vector-tile@3.0.0/node_modules/@mapbox/vector-tile/index.js
var VectorTileFeature = class {
  /**
   * @param {PbfReader} pbf
   * @param {number} end
   * @param {number} extent
   * @param {string[]} keys
   * @param {(number | string | boolean)[]} values
   */
  constructor(pbf, end, extent, keys, values) {
    this.properties = /* @__PURE__ */ Object.create(null);
    this.extent = extent;
    this.type = 0;
    this.id = void 0;
    this._pbf = pbf;
    this._geometry = -1;
    this._keys = keys;
    this._values = values;
    while (pbf.pos < end) {
      const tag = pbf.readVarint();
      if (tag === 8) this.id = pbf.readVarint();
      else if (tag === 18) {
        const tagsEnd = pbf.readVarint() + pbf.pos;
        while (pbf.pos < tagsEnd) {
          const key = keys[pbf.readVarint()];
          const value = values[pbf.readVarint()];
          this.properties[key] = value;
        }
      } else if (tag === 24) this.type = /** @type {0 | 1 | 2 | 3} */
      pbf.readVarint();
      else if (tag === 34) {
        this._geometry = pbf.pos;
        pbf.skip(tag);
      } else pbf.skip(tag);
    }
  }
  loadGeometry() {
    if (this._geometry < 0) throw new Error("feature has no geometry");
    const pbf = this._pbf;
    pbf.pos = this._geometry;
    const end = pbf.readVarint() + pbf.pos;
    const lines = [];
    let line;
    let cmd = 1;
    let length = 0;
    let x3 = 0;
    let y3 = 0;
    while (pbf.pos < end) {
      if (length <= 0) {
        const cmdLen = pbf.readVarint();
        cmd = cmdLen & 7;
        length = cmdLen >> 3;
        if (length === 0) continue;
      }
      length--;
      if (cmd === 1) {
        x3 += pbf.readSVarint();
        y3 += pbf.readSVarint();
        if (line) lines.push(line);
        line = [new Point(x3, y3)];
      } else if (cmd === 2) {
        x3 += pbf.readSVarint();
        y3 += pbf.readSVarint();
        if (line) line.push(new Point(x3, y3));
      } else if (cmd === 7) {
        if (line) {
          line.push(line[0].clone());
        }
      } else {
        throw new Error(`unknown command ${cmd}`);
      }
    }
    if (line) lines.push(line);
    return lines;
  }
  bbox() {
    if (this._geometry < 0) throw new Error("feature has no geometry");
    const pbf = this._pbf;
    pbf.pos = this._geometry;
    const end = pbf.readVarint() + pbf.pos;
    let cmd = 1, length = 0, x3 = 0, y3 = 0, x1 = Infinity, x22 = -Infinity, y1 = Infinity, y22 = -Infinity;
    while (pbf.pos < end) {
      if (length <= 0) {
        const cmdLen = pbf.readVarint();
        cmd = cmdLen & 7;
        length = cmdLen >> 3;
        if (length === 0) continue;
      }
      length--;
      if (cmd === 1 || cmd === 2) {
        x3 += pbf.readSVarint();
        y3 += pbf.readSVarint();
        if (x3 < x1) x1 = x3;
        if (x3 > x22) x22 = x3;
        if (y3 < y1) y1 = y3;
        if (y3 > y22) y22 = y3;
      } else if (cmd !== 7) {
        throw new Error(`unknown command ${cmd}`);
      }
    }
    return [x1, y1, x22, y22];
  }
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} z
   * @return {Feature}
   */
  toGeoJSON(x3, y3, z3) {
    const size = this.extent * Math.pow(2, z3), x0 = this.extent * x3, y0 = this.extent * y3, vtCoords = this.loadGeometry();
    function projectPoint(p) {
      return [
        (p.x + x0) * 360 / size - 180,
        360 / Math.PI * Math.atan(Math.exp((1 - (p.y + y0) * 2 / size) * Math.PI)) - 90
      ];
    }
    function projectLine(line) {
      return line.map(projectPoint);
    }
    let geometry;
    if (this.type === 1) {
      const points = [];
      for (const line of vtCoords) {
        points.push(line[0]);
      }
      const coordinates = projectLine(points);
      geometry = points.length === 1 ? { type: "Point", coordinates: coordinates[0] } : { type: "MultiPoint", coordinates };
    } else if (this.type === 2) {
      const coordinates = vtCoords.map(projectLine);
      geometry = coordinates.length === 1 ? { type: "LineString", coordinates: coordinates[0] } : { type: "MultiLineString", coordinates };
    } else if (this.type === 3) {
      const polygons = classifyRings(vtCoords);
      const coordinates = [];
      for (const polygon of polygons) {
        coordinates.push(polygon.map(projectLine));
      }
      geometry = coordinates.length === 1 ? { type: "Polygon", coordinates: coordinates[0] } : { type: "MultiPolygon", coordinates };
    } else {
      throw new Error("unknown feature type");
    }
    const result = {
      type: "Feature",
      geometry,
      properties: this.properties
    };
    if (this.id != null) {
      result.id = this.id;
    }
    return result;
  }
};
VectorTileFeature.types = ["Unknown", "Point", "LineString", "Polygon"];
function classifyRings(rings) {
  const len = rings.length;
  if (len <= 1) return [rings];
  const polygons = [];
  let polygon, ccw;
  for (let i = 0; i < len; i++) {
    const area = signedArea(rings[i]);
    if (area === 0) continue;
    if (ccw === void 0) ccw = area < 0;
    if (ccw === area < 0) {
      if (polygon) polygons.push(polygon);
      polygon = [rings[i]];
    } else if (polygon) {
      polygon.push(rings[i]);
    }
  }
  if (polygon) polygons.push(polygon);
  return polygons;
}
function signedArea(ring) {
  let sum = 0;
  for (let i = 0, len = ring.length, j2 = len - 1, p1, p2; i < len; j2 = i++) {
    p1 = ring[i];
    p2 = ring[j2];
    sum += (p2.x - p1.x) * (p1.y + p2.y);
  }
  return sum;
}
var VectorTileLayer = class {
  /**
   * @param {PbfReader} pbf
   * @param {number} [end]
   */
  constructor(pbf, end) {
    this.version = 1;
    this.name = "";
    this.extent = 4096;
    this.length = 0;
    this._pbf = pbf;
    this._keys = [];
    this._values = [];
    this._features = [];
    if (end === void 0) end = pbf.length;
    while (pbf.pos < end) {
      const tag = pbf.readVarint();
      if (tag === 10) this.name = pbf.readString();
      else if (tag === 18) {
        this._features.push(pbf.pos);
        pbf.skip(tag);
      } else if (tag === 26) this._keys.push(pbf.readString());
      else if (tag === 34) this._values.push(readValueMessage(pbf));
      else if (tag === 40) this.extent = pbf.readVarint();
      else if (tag === 120) this.version = pbf.readVarint();
      else pbf.skip(tag);
    }
    this.length = this._features.length;
  }
  /** return feature `i` from this layer as a `VectorTileFeature`
   * @param {number} i
   */
  feature(i) {
    if (i < 0 || i >= this._features.length) throw new Error("feature index out of bounds");
    this._pbf.pos = this._features[i];
    const end = this._pbf.readVarint() + this._pbf.pos;
    return new VectorTileFeature(this._pbf, end, this.extent, this._keys, this._values);
  }
};
function readValueMessage(pbf) {
  let value = null;
  const end = pbf.readVarint() + pbf.pos;
  while (pbf.pos < end) {
    const tag = pbf.readVarint();
    value = tag === 10 ? pbf.readString() : tag === 21 ? pbf.readFloat() : tag === 25 ? pbf.readDouble() : tag === 32 ? pbf.readVarint(true) : tag === 40 ? pbf.readVarint() : tag === 48 ? pbf.readSVarint() : tag === 56 ? pbf.readBoolean() : (pbf.skip(tag), null);
  }
  if (value == null) {
    throw new Error("unknown feature value");
  }
  return value;
}
var VectorTile = class {
  /**
   * @param {PbfReader} pbf
   * @param {number} [end]
   */
  constructor(pbf, end = pbf.length) {
    const layers = /* @__PURE__ */ Object.create(null);
    while (pbf.pos < end) {
      const tag = pbf.readVarint();
      if (tag === 26) {
        const layer2 = new VectorTileLayer(pbf, pbf.readVarint() + pbf.pos);
        if (layer2.length) layers[layer2.name] = layer2;
      } else pbf.skip(tag);
    }
    this.layers = layers;
  }
};

// app/node_modules/.pnpm/pbf@5.1.2/node_modules/pbf/index.js
var SHIFT_LEFT_32 = (1 << 16) * (1 << 16);
var SHIFT_RIGHT_32 = 1 / SHIFT_LEFT_32;
var utf8TextDecoder = typeof TextDecoder === "undefined" ? null : new TextDecoder("utf-8");

// Tools/.t_dbg5.mjs
var pack = "app/public/data/tiles/fulda.pmtiles";
var z2 = 13;
var arc = new w(new k(await openAsBlob(pack)));
var n = 2 ** z2;
var x2 = Math.floor((9.675 + 180) / 360 * n);
var y2 = Math.floor((1 - Math.log(Math.tan(50.55 * Math.PI / 180) + 1 / Math.cos(50.55 * Math.PI / 180)) / Math.PI) / 2 * n);
var t = await arc.getZxy(z2, x2, y2);
var vt = new VectorTile(new (void 0 ?? void 0)(Buffer.from(t.data)));
console.log("layers", Object.keys(vt.layers));
var layer = vt.layers.places;
if (!layer) process.exit(0);
for (let i = 0; i < layer.length; i++) {
  const fe = layer.feature(i);
  const props = fe.properties;
  const name = String(props.name ?? "");
  if (!/Fulda|Marbach/i.test(name)) continue;
  const g = fe.loadGeometry();
  const p = g[0][0];
  const lon = (x2 + p.x / layer.extent) / n * 360 - 180;
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * ((y2 + p.y / layer.extent) / n)))) * 180 / Math.PI;
  console.log(name, props.kind_detail, props.population, p.x, p.y, "extent", layer.extent, lon.toFixed(5), lat.toFixed(5));
}
