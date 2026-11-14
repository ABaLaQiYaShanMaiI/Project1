import { useEffect, useRef, useState } from 'react';
import { store } from './store';
import { loadWorld, lonToX, latToY, xToLon, yToLat, type WorldMeta } from './core/world';

export function WorldCanvas(): JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ scale: 0.3, ox: 0, oy: 0, w: 0, h: 0, dpr: 1, fit: 0.3 });
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [meta, setMeta] = useState<WorldMeta | null>(null);
  const [pick, setPick] = useState<{ lat: number; lon: number } | null>(null);

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

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      dragging = true;
      moved = 0;
      lx = e.clientX;
      ly = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      moved += Math.abs(dx) + Math.abs(dy);
      lx = e.clientX;
      ly = e.clientY;
      S.ox += dx;
      S.oy += dy;
      draw();
    };
    const onUp = (e: PointerEvent) => {
      if (dragging && moved <= 4) {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - S.ox) / S.scale;
        const y = (e.clientY - rect.top - S.oy) / S.scale;
        if (x >= 0 && x <= meta.width && y >= 0 && y <= meta.height) {
          setPick({ lat: yToLat(y), lon: xToLon(x) });
        }
      }
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
  }, [img, meta, pick]);

  return (
    <div className="map-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} />
      {pick && (
        <div className="world-pick">
          <div className="wp-title">选定位置</div>
          <div className="wp-row mono">
            {pick.lat.toFixed(3)}, {pick.lon.toFixed(3)}
          </div>
          <div className="wp-hint">在这块地方开战场，运行：</div>
          <div className="wp-cmd mono">
            python tools/bake_map.py --center {pick.lat.toFixed(2)},{pick.lon.toFixed(2)}
          </div>
        </div>
      )}
      <div className="map-hint">拖动平移 · 滚轮缩放 · 单击任意地点取经纬度</div>
    </div>
  );
}
