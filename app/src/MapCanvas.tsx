import { useEffect, useRef } from 'react';
import { MapRenderer } from './map/renderer';
import { store } from './store';
import { useStore } from './hooks';

export function MapCanvas(): JSX.Element {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const data = store.map;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!data || !canvas || !wrap) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = new MapRenderer(canvas, data);
    if (store.field) r.setControl(store.field);
    (window as unknown as { __renderer: MapRenderer }).__renderer = r;

    const applySize = (fit: boolean) => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      r.resize(rect.width, rect.height, dpr);
      if (fit) r.fit();
    };
    applySize(true);

    const ro = new ResizeObserver(() => applySize(false));
    ro.observe(wrap);

    let dragging = false;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;

    const local = (e: PointerEvent | WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      canvas.setPointerCapture(e.pointerId);
      dragging = true;
      moved = 0;
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const onMove = (e: PointerEvent) => {
      const p = local(e);
      if (dragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 4) {
          r.panBy(dx, dy);
          lastX = e.clientX;
          lastY = e.clientY;
          canvas.style.cursor = 'grabbing';
        }
      } else {
        const hit = r.districtAtScreen(p.x, p.y);
        store.setHover(hit ? { town: hit.town, district: hit.district, sx: p.x, sy: p.y } : null);
        store.setCursor(r.screenToWorld(p.x, p.y));
      }
    };

    const onUp = (e: PointerEvent) => {
      const p = local(e);
      if (dragging && moved <= 4) {
        const hit = r.districtAtScreen(p.x, p.y);
        const w = r.screenToWorld(p.x, p.y);
        if (hit) {
          store.select({ kind: 'district', townId: hit.town.id, district: hit.district, x: w.x, y: w.y });
        } else {
          store.select({ kind: 'point', x: w.x, y: w.y });
        }
      }
      dragging = false;
      canvas.style.cursor = 'crosshair';
    };

    const onLeave = () => {
      store.setHover(null);
      store.setCursor(null);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      r.zoomAt(p.x, p.y, Math.pow(1.0016, -e.deltaY));
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    let raf = 0;
    let last = performance.now();
    let frames = 0;
    let acc = 0;
    let lastEmit = 0;

    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;

      store.clock.update(dt);

      try {
        r.render({
          level: store.zoom,
          hover: store.hover,
          selected: store.selected,
          showControl: store.showControl,
          showIntel: store.showIntel,
        });
      } catch (err) {
        const ctx = canvas.getContext('2d')!;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#2a0d0d';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ff9c9c';
        ctx.font = '13px monospace';
        const msg = `${(err as Error).message}\n${(err as Error).stack ?? ''}`;
        msg.split('\n').slice(0, 12).forEach((line, i) => ctx.fillText(line.slice(0, 150), 16, 28 + i * 18));
        console.error(err);
        return;
      }

      frames++;
      acc += dt;
      if (now - lastEmit > 100) {
        store.perf = {
          fps: acc > 0 ? frames / acc : 0,
          drawMs: r.lastDrawMs,
          rebuildMs: r.lastRebuildMs,
          towns: r.visibleTowns,
          segments: r.segmentCount,
        };
        store.emit();
        frames = 0;
        acc = 0;
        lastEmit = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  return (
    <div className="map-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} />
      <HoverCard />
      <div className="map-hint">左键拖动平移 · 滚轮缩放 · 单击城区扇区 / 任意点</div>
    </div>
  );
}

function HoverCard(): JSX.Element | null {
  useStore();
  const h = store.hover;
  if (!h) return null;
  const d = h.district;
  return (
    <div className="hover-card" style={{ left: h.sx + 16, top: h.sy + 16 }}>
      <div className="hc-title">
        {h.town.n} · {d.label}
      </div>
      <div className="hc-row">
        {d.frontage} 连当量 · 防御 +{d.defense}
      </div>
      <div className="hc-row dim">
        {d.area.toFixed(1)} km² · 防御 +{d.defense}
      </div>
    </div>
  );
}
