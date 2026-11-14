import { useEffect, useRef, useState } from 'react';
import { store } from './store';
import { loadWorld, lonToX, latToY, xToLon, yToLat, type WorldMeta } from './core/world';

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const R_EARTH = 6378137;
const MERC_W = 2 * Math.PI * R_EARTH;
const SIZE = 2048;

function mpp(lat: number): number {
  return (MERC_W / SIZE) * Math.cos((lat * Math.PI) / 180);
}

function boxInfo(meta: WorldMeta, b: Box) {
  const west = xToLon(Math.min(b.x0, b.x1));
  const east = xToLon(Math.max(b.x0, b.x1));
  const north = yToLat(Math.min(b.y0, b.y1));
  const south = yToLat(Math.max(b.y0, b.y1));
  const lat = (north + south) / 2;
  const lon = (west + east) / 2;
  const m = mpp(lat);
  const wKm = (Math.abs(b.x1 - b.x0) * m) / 1000;
  const hKm = (Math.abs(b.y1 - b.y0) * m) / 1000;
  return { west, east, north, south, lat, lon, wKm, hKm };
}

function boxFromKm(_meta: WorldMeta, lat: number, lon: number, wKm: number, hKm: number): Box {
  const m = mpp(lat);
  const cx = lonToX(lon);
  const cy = latToY(lat);
  const hw = (wKm * 1000) / (2 * m);
  const hh = (hKm * 1000) / (2 * m);
  return {
    x0: Math.max(0, cx - hw),
    y0: Math.max(0, cy - hh),
    x1: Math.min(SIZE, cx + hw),
    y1: Math.min(SIZE, cy + hh),
  };
}

export function WorldCanvas(): JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ scale: 0.3, ox: 0, oy: 0, w: 0, h: 0, dpr: 1, fit: 0.3 });
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [meta, setMeta] = useState<WorldMeta | null>(null);
  const [pick, setPick] = useState<{ lat: number; lon: number } | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [selecting, setSelecting] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    loadWorld()
      .then((r) => {
        if (!alive) return;
        setImg(r.img);
        setMeta(r.meta);
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
    if (!img || !meta) return;
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
      S.fit = Math.max(rect.width, rect.height) / meta.width;
      if (!S.ox && !S.oy) {
        S.scale = S.fit;
        S.ox = (rect.width - meta.width * S.scale) / 2;
        S.oy = (rect.height - meta.height * S.scale) / 2;
      }
      draw();
    };

    const draw = () => {
      ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      ctx.fillStyle = '#0b1017';
      ctx.fillRect(0, 0, S.w, S.h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, S.ox, S.oy, meta.width * S.scale, meta.height * S.scale);

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
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    let dragging = false;
    let moved = 0;
    let lx = 0;
    let ly = 0;
    let anchor: { x: number; y: number } | null = null;

    const toImg = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left - S.ox) / S.scale,
        y: (e.clientY - rect.top - S.oy) / S.scale,
      };
    };

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      dragging = true;
      moved = 0;
      lx = e.clientX;
      ly = e.clientY;
      if (selecting) {
        const p = toImg(e);
        anchor = { x: Math.max(0, Math.min(meta.width, p.x)), y: Math.max(0, Math.min(meta.height, p.y)) };
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      moved += Math.abs(dx) + Math.abs(dy);
      lx = e.clientX;
      ly = e.clientY;
      if (selecting && anchor) {
        const p = toImg(e);
        setBox({
          x0: anchor.x,
          y0: anchor.y,
          x1: Math.max(0, Math.min(meta.width, p.x)),
          y1: Math.max(0, Math.min(meta.height, p.y)),
        });
        return;
      }
      S.ox += dx;
      S.oy += dy;
      draw();
    };

    const onUp = (e: PointerEvent) => {
      if (dragging && moved <= 4 && !selecting) {
        const p = toImg(e);
        if (p.x >= 0 && p.x <= meta.width && p.y >= 0 && p.y <= meta.height) {
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
      const next = Math.max(S.fit * 0.9, Math.min(S.fit * 80, S.scale * f));
      S.ox = mx - ((mx - S.ox) / S.scale) * next;
      S.oy = my - ((my - S.oy) / S.scale) * next;
      S.scale = next;
      draw();
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [img, meta, pick, box, selecting]);

  const applyPreset = (wKm: number, hKm: number) => {
    if (!meta) return;
    const c = box
      ? boxInfo(meta, box)
      : {
          lat: yToLat((-stateRef.current.oy + stateRef.current.h / 2) / stateRef.current.scale),
          lon: xToLon((-stateRef.current.ox + stateRef.current.w / 2) / stateRef.current.scale),
        };
    setBox(boxFromKm(meta, c.lat, c.lon, wKm, hKm));
  };

  const info = meta && box ? boxInfo(meta, box) : null;

  return (
    <div className="map-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} />
      <div className="world-tools">
        <button
          className={`btn toggle ${selecting ? 'on' : ''}`}
          onClick={() => setSelecting((v) => !v)}
          title={selecting ? '拖动框选战场；点此切回平移' : '当前为平移；点此切到框选'}
        >
          {selecting ? '◉ 框选战场' : '○ 平移'}
        </button>
        {[['100 × 72', 100, 72], ['60 × 40', 60, 40], ['24 × 16', 24, 16]].map((p) => (
          <button key={String(p[0])} className="btn small" onClick={() => applyPreset(Number(p[1]), Number(p[2]))}>
            {p[0]} km
          </button>
        ))}
      </div>
      {info && (
        <div className="world-pick">
          <div className="wp-title">选定战场</div>
          <div className="wp-row mono">
            {info.lat.toFixed(3)}, {info.lon.toFixed(3)}
          </div>
          <div className="wp-row mono">
            {info.wKm.toFixed(0)} × {info.hKm.toFixed(0)} km
          </div>
          <div className="wp-hint">生成这张战场：</div>
          <div className="wp-cmd mono">python Tools/bake_map.py --center {info.lat.toFixed(3)},{info.lon.toFixed(3)} --span-km {info.wKm.toFixed(0)},{info.hKm.toFixed(0)} --name newzone</div>
          <button
            className="btn small"
            onClick={() => {
              const cmd = `python Tools/bake_map.py --center ${info.lat.toFixed(3)},${info.lon.toFixed(3)} --span-km ${info.wKm.toFixed(0)},${info.hKm.toFixed(0)} --name newzone`;
              navigator.clipboard?.writeText(cmd);
              setCopied(true);
              setTimeout(() => setCopied(false), 1400);
            }}
          >
            {copied ? '已复制' : '复制命令'}
          </button>
          <div className="wp-hint">需联网 + 本机 Python，烘焙约 1–3 分钟</div>
        </div>
      )}
      <div className="map-hint">
        {selecting ? '拖动框选战场区域 · 滚轮缩放 · 点按钮切平移' : '拖动平移 · 滚轮缩放 · 单击取经纬度'}
      </div>
    </div>
  );
}
