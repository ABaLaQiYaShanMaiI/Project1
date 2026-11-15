import { useEffect, useRef, useState } from 'react';
import { store } from './store';
import { SIDE_COLOR, type Marker } from './core/markers';
import {
  lonToX,
  latToY,
  xToLon,
  yToLat,
  pickZoom,
  maxScaleOf,
  type WorldMeta,
  type WorldVectors,
} from './core/world';
import { loadWorld, loadWorldVectors, TileSet } from './data/worldSource';
import { localBasemap, mapTilerSources, onlineBasemaps, type BasemapSource } from './data/basemap';
import { bakeStatus, cancelBake, loadZones, startBake } from './data/bakeApi';
import { makeZoneKey, zoneTitle, type BakeStatus, type ZoneEntry } from './core/zones';
import { BakeCard, WorldHint, WorldLibraryPanel, WorldPickPanel, WorldTools } from './ui/WorldPanels';

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const R_EARTH = 6378137;
const MERC_W = 2 * Math.PI * R_EARTH;

function metersPerUnit(lat: number): number {
  return MERC_W * Math.cos((lat * Math.PI) / 180);
}

function boxInfo(b: Box) {
  const west = xToLon(Math.min(b.x0, b.x1));
  const east = xToLon(Math.max(b.x0, b.x1));
  const north = yToLat(Math.min(b.y0, b.y1));
  const south = yToLat(Math.max(b.y0, b.y1));
  const lat = (north + south) / 2;
  const lon = (west + east) / 2;
  const m = metersPerUnit(lat);
  const wKm = (Math.abs(b.x1 - b.x0) * m) / 1000;
  const hKm = (Math.abs(b.y1 - b.y0) * m) / 1000;
  return { west, east, north, south, lat, lon, wKm, hKm };
}

function boxFromKm(lat: number, lon: number, wKm: number, hKm: number): Box {
  const m = metersPerUnit(lat);
  const cu = lonToX(lon);
  const cv = latToY(lat);
  const hu = (wKm * 1000) / (2 * m);
  const hv = (hKm * 1000) / (2 * m);
  return {
    x0: Math.max(0, cu - hu),
    y0: Math.max(0, cv - hv),
    x1: Math.min(1, cu + hu),
    y1: Math.min(1, cv + hv),
  };
}

function zoneRect(z: ZoneEntry): Box | null {
  if (!z.bbox) return null;
  return {
    x0: lonToX(z.bbox.west),
    y0: latToY(z.bbox.north),
    x1: lonToX(z.bbox.east),
    y1: latToY(z.bbox.south),
  };
}


function clipName(name: string, max = 16): string {
  return name.length > max ? `${name.slice(0, max)}…` : name;
}

function drawUnitSymbol(ctx: CanvasRenderingContext2D, m: Marker, px: number, py: number): void {
  const w = 28;
  const h = 19;
  const c = SIDE_COLOR[m.side];
  ctx.save();
  ctx.translate(px, py);
  ctx.fillStyle = c.fill;
  ctx.strokeStyle = c.stroke;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.rect(-w / 2, -h / 2, w, h);
  ctx.fill();
  ctx.stroke();

  const x0 = -w / 2 + 3.5;
  const x1 = w / 2 - 3.5;
  const y0 = -h / 2 + 3.5;
  const y1 = h / 2 - 3.5;
  ctx.strokeStyle = c.stroke;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  if (m.kind === 'infantry') {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.moveTo(x1, y0);
    ctx.lineTo(x0, y1);
  } else if (m.kind === 'armor') {
    ctx.ellipse(0, 0, (x1 - x0) / 2, (y1 - y0) / 2, 0, 0, Math.PI * 2);
  } else if (m.kind === 'artillery') {
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
  } else if (m.kind === 'recon') {
    ctx.moveTo(x0, y1);
    ctx.lineTo(x1, y0);
  } else {
    ctx.moveTo(0, y0);
    ctx.lineTo(0, y1);
    ctx.moveTo(-4, y1 - 3);
    ctx.lineTo(4, y1 - 3);
  }
  ctx.stroke();

  ctx.font = '600 8.5px "Microsoft YaHei", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = 'rgba(12,16,22,0.82)';
  ctx.strokeText(m.label, 0, h / 2 + 2);
  ctx.fillStyle = c.text;
  ctx.fillText(m.label, 0, h / 2 + 2);
  ctx.restore();
}

export function WorldCanvas(): JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ scale: 0.3, ox: 0, oy: 0, w: 0, h: 0, dpr: 1, fit: 0.3, min: 0.3 });
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [tiles, setTiles] = useState<TileSet | null>(null);
  const [localTiles, setLocalTiles] = useState<TileSet | null>(null);
  const [meta, setMeta] = useState<WorldMeta | null>(null);
  const [source, setSource] = useState<BasemapSource | null>(null);
  const drawRef = useRef<(() => void) | null>(null);
  const [zoomHint, setZoomHint] = useState(false);
  const [markers, setMarkers] = useState<Marker[]>(store.markers);
  const hintTimer = useRef<number | null>(null);
  const [pick, setPick] = useState<{ lat: number; lon: number } | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [selecting, setSelecting] = useState(true);
  const [copied, setCopied] = useState(false);
  const [zones, setZones] = useState<ZoneEntry[]>([]);
  const [vectors, setVectors] = useState<WorldVectors | null>(null);
  const [job, setJob] = useState<BakeStatus | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [apiReady, setApiReady] = useState(true);
  const zonesRef = useRef<ZoneEntry[]>([]);

  useEffect(() => {
    let alive = true;
    loadWorld()
      .then((r) => {
        if (!alive) return;
        setImg(r.img);
        setMeta(r.meta);
        setLocalTiles(r.tiles);
        setSource(r.tiles ? onlineBasemaps()[0] : null);
      })
      .catch((e: Error) => {
        store.error = e.message;
        store.emit();
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const unsub = store.subscribe(() => setMarkers(store.markers));
    return unsub;
  }, []);

  useEffect(() => {
    if (!source) {
      setTiles(null);
      return;
    }
    if (source.local) {
      setTiles(localTiles);
      return;
    }
    const ts = new TileSet(source);
    ts.onLoad = () => drawRef.current?.();
    ts.onFail = () => {
      if (meta) setSource(localBasemap(meta));
    };
    setTiles(ts);
  }, [source, meta, localTiles]);

  useEffect(() => {
    let alive = true;
    loadZones()
      .then((zs) => {
        if (!alive) return;
        zonesRef.current = zs;
        setZones(zs);
      })
      .catch(() => {
        if (!alive) return;
        setApiReady(false);
      });
    bakeStatus()
      .then((st) => {
        if (!alive || !st) return;
        if (st.state === 'running' || st.state === 'done') setJob(st);
      })
      .catch(() => {
        if (alive) setApiReady(false);
      });
    loadWorldVectors()
      .then((v) => {
        if (alive && v) setVectors(v);
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!job || job.state !== 'running') return;
    let alive = true;
    const tick = async () => {
      const st = await bakeStatus();
      if (!alive || !st) return;
      setJob(st);
      if (st.state === 'done') {
        const zs = await loadZones().catch(() => []);
        if (!alive) return;
        zonesRef.current = zs;
        setZones(zs);
      }
    };
    const timer = setInterval(tick, 800);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [job?.state]);

  useEffect(() => {
    if (!meta || (!img && !tiles)) return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d')!;
    const S = stateRef.current;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      S.w = rect.width;
      S.h = rect.height;
      S.dpr = dpr;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      S.fit = Math.min(rect.width, rect.height) * 0.96;
      S.min = S.fit * 0.8;
      if (!S.ox && !S.oy) {
        S.scale = S.fit;
        S.ox = (rect.width - S.scale) / 2;
        S.oy = (rect.height - S.scale) / 2;
      }
      draw();
    };

    const draw = () => {
      ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      ctx.fillStyle = '#0b1017';
      ctx.fillRect(0, 0, S.w, S.h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (img) {
        ctx.drawImage(img, S.ox, S.oy, S.scale, S.scale);
      }
      const drawTileSet = (ts: TileSet) => {
        const tz = pickZoom(S.scale * S.dpr, ts.source.minZoom, ts.source.maxZoom);
        const tn = 2 ** tz;
        const tilePx = S.scale / tn;
        if (tz > ts.source.minZoom) {
          const base = ts.get(ts.source.minZoom, 0, 0);
          if (base) ctx.drawImage(base, S.ox, S.oy, S.scale, S.scale);
        }
        const tx0 = Math.max(0, Math.floor((0 - S.ox) / tilePx));
        const ty0 = Math.max(0, Math.floor((0 - S.oy) / tilePx));
        const tx1 = Math.min(tn - 1, Math.ceil((S.w - S.ox) / tilePx));
        const ty1 = Math.min(tn - 1, Math.ceil((S.h - S.oy) / tilePx));
        for (let ty = ty0; ty <= ty1; ty++) {
          for (let tx = tx0; tx <= tx1; tx++) {
            const tile = ts.get(tz, tx, ty);
            if (!tile) continue;
            ctx.drawImage(tile, S.ox + tx * tilePx, S.oy + ty * tilePx, tilePx + 0.5, tilePx + 0.5);
          }
        }
      };
      if (localTiles) drawTileSet(localTiles);
      if (tiles && source && !source.local) drawTileSet(tiles);

      if (vectors && source?.local) {
        const vz = pickZoom(S.scale, meta.minZoom, meta.maxZoom);
        const west = xToLon((0 - S.ox) / S.scale);
        const east = xToLon((S.w - S.ox) / S.scale);
        const north = yToLat((0 - S.oy) / S.scale);
        const south = yToLat((S.h - S.oy) / S.scale);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const road of vectors.roads) {
          if (road.c > 1 && vz < 4) continue;
          const b = road.b;
          if (b[2] < west || b[0] > east || b[3] < south || b[1] > north) continue;
          ctx.beginPath();
          for (let i = 0; i < road.p.length; i++) {
            const px = lonToX(road.p[i][0]) * S.scale + S.ox;
            const py = latToY(road.p[i][1]) * S.scale + S.oy;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.strokeStyle = road.c === 1 ? 'rgba(255, 209, 138, 0.62)' : 'rgba(226, 206, 168, 0.38)';
          ctx.lineWidth = road.c === 1 ? 1.1 : 0.6;
          ctx.stroke();
        }
        for (const city of vectors.cities) {
          if (city.k > 6 && vz < 4) continue;
          const px = lonToX(city.x) * S.scale + S.ox;
          const py = latToY(city.y) * S.scale + S.oy;
          if (px < -20 || py < -20 || px > S.w + 20 || py > S.h + 20) continue;
          const r = city.k <= 2 ? 2.6 : city.k <= 4 ? 2.0 : 1.5;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255, 246, 226, 0.92)';
          ctx.fill();
          ctx.lineWidth = 0.9;
          ctx.strokeStyle = 'rgba(30, 26, 22, 0.85)';
          ctx.stroke();
          if (vz >= 4 && city.k <= 3) {
            ctx.font = '600 9.5px "Microsoft YaHei", system-ui, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = 2.4;
            ctx.strokeStyle = 'rgba(16, 20, 26, 0.75)';
            ctx.strokeText(city.n, px + r + 2, py);
            ctx.fillStyle = 'rgba(246, 240, 228, 0.92)';
            ctx.fillText(city.n, px + r + 2, py);
          }
        }
      }

      for (const zone of zones) {
        const r = zoneRect(zone);
        if (!r) continue;
        const x = r.x0 * S.scale + S.ox;
        const y = r.y0 * S.scale + S.oy;
        const w = Math.max(4, (r.x1 - r.x0) * S.scale);
        const h = Math.max(4, (r.y1 - r.y0) * S.scale);
        ctx.fillStyle = 'rgba(111, 214, 160, 0.10)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(111, 214, 160, 0.85)';
        ctx.lineWidth = 1.3;
        ctx.strokeRect(x, y, w, h);
        ctx.font = '600 10px "Microsoft YaHei", system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(24, 40, 34, 0.72)';
        const label = clipName(zone.name || zone.key);
        const tw = ctx.measureText(label).width;
        ctx.fillRect(x + 2, y + 2, tw + 6, 13);
        ctx.fillStyle = 'rgba(176, 244, 208, 0.96)';
        ctx.fillText(label, x + 5, y + 4);
      }

      const bbox = store.map?.meta.bbox;
      if (bbox) {
        const x0 = lonToX(bbox.west) * S.scale + S.ox;
        const x1 = lonToX(bbox.east) * S.scale + S.ox;
        const y0 = latToY(bbox.north) * S.scale + S.oy;
        const y1 = latToY(bbox.south) * S.scale + S.oy;
        ctx.strokeStyle = '#ffb020';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(x0, y0, Math.max(6, x1 - x0), Math.max(6, y1 - y0));
        ctx.fillStyle = 'rgba(255,176,32,0.12)';
        ctx.fillRect(x0, y0, Math.max(6, x1 - x0), Math.max(6, y1 - y0));
        ctx.font = '600 11px "Microsoft YaHei", system-ui, sans-serif';
        ctx.fillStyle = '#ffcf7a';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('当前战场', x0 + 4, y0 - 3);
      }

      if (box) {
        const x = Math.min(box.x0, box.x1) * S.scale + S.ox;
        const y = Math.min(box.y0, box.y1) * S.scale + S.oy;
        const w = Math.abs(box.x1 - box.x0) * S.scale;
        const h = Math.abs(box.y1 - box.y0) * S.scale;
        ctx.fillStyle = 'rgba(120, 200, 255, 0.14)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#7cc6ff';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
      }

      if (pick) {
        const px = lonToX(pick.lon) * S.scale + S.ox;
        const py = latToY(pick.lat) * S.scale + S.oy;
        ctx.strokeStyle = '#6fd6a0';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.moveTo(px - 9, py);
        ctx.lineTo(px + 9, py);
        ctx.moveTo(px, py - 9);
        ctx.lineTo(px, py + 9);
        ctx.stroke();
      }

      for (const m of markers) {
        const px = lonToX(m.lon) * S.scale + S.ox;
        const py = latToY(m.lat) * S.scale + S.oy;
        if (px < -40 || py < -40 || px > S.w + 40 || py > S.h + 40) continue;
        drawUnitSymbol(ctx, m, px, py);
      }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    drawRef.current = draw;
    resize();

    let dragging = false;
    let moved = 0;
    let lx = 0;
    let ly = 0;
    let anchor: { x: number; y: number } | null = null;
    let dragMarker: Marker | null = null;

    const markerAt = (sx: number, sy: number): Marker | null => {
      for (const m of markers) {
        const px = lonToX(m.lon) * S.scale + S.ox;
        const py = latToY(m.lat) * S.scale + S.oy;
        if (Math.abs(sx - px) <= 16 && Math.abs(sy - py) <= 12) return m;
      }
      return null;
    };

    const toImg = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left - S.ox) / S.scale,
        y: (e.clientY - rect.top - S.oy) / S.scale,
      };
    };

    const zoneAt = (p: { x: number; y: number }): ZoneEntry | null => {
      for (const z of zonesRef.current) {
        const r = zoneRect(z);
        if (!r) continue;
        if (p.x >= r.x0 && p.x <= r.x1 && p.y >= r.y0 && p.y <= r.y1) return z;
      }
      return null;
    };

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      const rect = canvas.getBoundingClientRect();
      if (!selecting && !store.placing) {
        const hit = markerAt(e.clientX - rect.left, e.clientY - rect.top);
        if (hit) {
          dragMarker = hit;
          dragging = true;
          moved = 0;
          lx = e.clientX;
          ly = e.clientY;
          return;
        }
      }
      dragging = true;
      moved = 0;
      lx = e.clientX;
      ly = e.clientY;
      if (selecting) {
        const p = toImg(e);
        anchor = { x: Math.max(0, Math.min(1, p.x)), y: Math.max(0, Math.min(1, p.y)) };
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      moved += Math.abs(dx) + Math.abs(dy);
      lx = e.clientX;
      ly = e.clientY;
      if (dragMarker) {
        const p = toImg(e);
        const u = Math.max(0, Math.min(1, p.x));
        const v = Math.max(0, Math.min(1, p.y));
        store.moveMarker(dragMarker.id, xToLon(u), yToLat(v));
        return;
      }
      if (selecting && anchor) {
        const p = toImg(e);
        setBox({
          x0: anchor.x,
          y0: anchor.y,
          x1: Math.max(0, Math.min(1, p.x)),
          y1: Math.max(0, Math.min(1, p.y)),
        });
        return;
      }
      S.ox += dx;
      S.oy += dy;
      draw();
    };

    const onUp = (e: PointerEvent) => {
      if (dragMarker) {
        dragMarker = null;
        dragging = false;
        return;
      }
      const p = toImg(e);
      if (dragging && moved <= 4 && store.placing) {
        if (p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) {
          store.addMarker(xToLon(p.x), yToLat(p.y));
          store.cancelPlacing();
        }
        dragging = false;
        return;
      }
      if (dragging && moved <= 4) {
        if (selecting) {
          const z = zoneAt(p);
          if (z) {
            dragging = false;
            anchor = null;
            location.search = `?map=${encodeURIComponent('/data/' + z.file)}`;
            return;
          }
        } else if (p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) {
          setPick({ lat: yToLat(p.y), lon: xToLon(p.x) });
        }
      }
      if (selecting) anchor = null;
      dragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const f = Math.pow(1.0016, -e.deltaY);
      const cap = maxScaleOf(source ?? meta);
      const want = S.scale * f;
      if (want > cap * 1.001) {
        setZoomHint(true);
        if (hintTimer.current) window.clearTimeout(hintTimer.current);
        hintTimer.current = window.setTimeout(() => setZoomHint(false), 2000);
      }
      const next = Math.max(S.min, Math.min(cap, want));
      S.ox = mx - ((mx - S.ox) / S.scale) * next;
      S.oy = my - ((my - S.oy) / S.scale) * next;
      S.scale = next;
      draw();
    };

    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const hit = markerAt(e.clientX - rect.left, e.clientY - rect.top);
      if (hit) store.removeMarker(hit.id);
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContext);

    return () => {
      ro.disconnect();
      drawRef.current = null;
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContext);
    };
  }, [img, meta, tiles, source, vectors, pick, box, selecting, zones, markers]);

  const applyPreset = (wKm: number, hKm: number) => {
    if (!meta) return;
    const c = box
      ? boxInfo(box)
      : {
          lat: yToLat((-stateRef.current.oy + stateRef.current.h / 2) / stateRef.current.scale),
          lon: xToLon((-stateRef.current.ox + stateRef.current.w / 2) / stateRef.current.scale),
        };
    setBox(boxFromKm(c.lat, c.lon, wKm, hKm));
  };

  const info = meta && box ? boxInfo(box) : null;
  const cmd = info
    ? `python Tools/bake_map.py --center ${info.lat.toFixed(3)},${info.lon.toFixed(3)} --span-km ${Math.round(info.wKm)},${Math.round(info.hKm)} --name ${makeZoneKey(info.lat, info.lon)}`
    : '';

  const copyCmd = () => {
    if (!cmd) return;
    navigator.clipboard?.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const enterZone = (url: string) => {
    location.search = `?map=${encodeURIComponent(url)}`;
  };

  const cycleBasemap = () => {
    if (!meta) return;
    const list = [localBasemap(meta), ...mapTilerSources(), ...onlineBasemaps()];
    const i = list.findIndex((s) => s.id === source?.id);
    setSource(list[(i + 1) % list.length]);
  };

  const basemapLabel =
    ({
      local: '本地底图',
      'mt-topo': 'MT 地形',
      'mt-sat': 'MT 卫星',
      'esri-topo': '地形底图',
      'esri-imagery': '卫星影像',
      opentopomap: 'OpenTopoMap',
    } as Record<string, string>)[source?.id ?? 'local'] ?? '底图';

  const onBake = async () => {
    if (!info) return;
    setFailure(null);
    try {
      const st = await startBake({
        center: [Number(info.lat.toFixed(3)), Number(info.lon.toFixed(3))],
        spanKm: [Math.round(info.wKm), Math.round(info.hKm)],
        key: makeZoneKey(info.lat, info.lon),
        title: zoneTitle(info.lat, info.lon, info.wKm, info.hKm),
      });
      setJob(st);
    } catch (e) {
      setFailure((e as Error).message);
    }
  };

  const onCancel = async () => {
    try {
      await cancelBake();
    } catch {
      setFailure('当前服务不支持取消');
    }
    const st = await bakeStatus();
    if (st) setJob(st);
  };

  const jobKey = info ? makeZoneKey(info.lat, info.lon) : '';
  const finished = job?.state === 'done' && job.result && job.key === jobKey ? job.result : null;

  return (
    <div className="map-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} />
      <WorldTools
        selecting={selecting}
        zoneCount={zones.length}
        basemapLabel={basemapLabel}
        onToggleSelect={() => setSelecting((v) => !v)}
        onCycleBasemap={cycleBasemap}
        onPreset={applyPreset}
      />
      {info ? (
        <WorldPickPanel
          info={info}
          cmd={cmd}
          copied={copied}
          apiReady={apiReady}
          failure={failure}
          running={job?.state === 'running'}
          tileCount={job?.estimate?.tiles ?? null}
          finished={finished}
          onBake={onBake}
          onCopy={copyCmd}
          onEnter={enterZone}
        />
      ) : zones.length > 0 ? (
        <WorldLibraryPanel zones={zones} onEnter={enterZone} />
      ) : null}
      {job?.state === 'running' && <BakeCard job={job} onCancel={onCancel} />}
      <WorldHint zoomHint={zoomHint} maxZoom={meta?.maxZoom ?? 3} selecting={selecting} />
      <div className="world-attr">{source?.attribution ?? meta?.attribution ?? ''}</div>
    </div>
  );
}
