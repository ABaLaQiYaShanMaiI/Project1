import { useEffect, useRef } from 'react';
import { MapRenderer } from './map/renderer';
import { store } from './store';
import { useStore } from './hooks';
import { nearestDetailKeys, type DetailEntry } from './core/detail';
import { detailIndex, loadDetail } from './data/loadDetail';

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

    let idx: Record<string, DetailEntry> = {};
    let detailKey: string | null = null;
    detailIndex().then((i) => {
      idx = i;
    });

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
        const unit = r.platoonAtScreen(p.x, p.y);
        store.hoverPlatoon = unit ? unit.id : null;
        const hit = unit ? null : r.districtNearScreen(p.x, p.y);
        store.setHover(hit ? { town: hit.town, district: hit.district, sx: p.x, sy: p.y } : null);
        store.setCursor(r.screenToWorld(p.x, p.y));
        canvas.style.cursor = unit ? 'pointer' : store.placing ? 'cell' : 'crosshair';
      }
    };

    const onUp = (e: PointerEvent) => {
      const p = local(e);
      if (dragging && moved <= 4) {
        const unit = r.platoonAtScreen(p.x, p.y);
        if (unit) {
          store.selectPlatoon(unit.id);
          store.setHover(null);
          dragging = false;
          return;
        }
        const hit = r.districtNearScreen(p.x, p.y);
        const w = r.screenToWorld(p.x, p.y);
        if (hit && store.orderMode) {
          const ref = r.urbanRefs().byKey.get(hit.district.key);
          if (ref) store.issueOrder(store.orderMode, ref);
        } else if (hit && store.placing) {
          const ref = r.urbanRefs().byKey.get(hit.district.key);
          if (ref) store.addPlatoonTo(ref);
        } else if (hit) {
          store.select({ kind: 'district', townId: hit.town.id, district: hit.district, x: w.x, y: w.y });
        } else if (store.placing) {
          store.cancelPlacing();
        } else {
          store.select({ kind: 'point', x: w.x, y: w.y });
        }
      }
      dragging = false;
      canvas.style.cursor = 'crosshair';
    };

    const onContext = (e: MouseEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const unit = r.platoonAtScreen(e.clientX - rect.left, e.clientY - rect.top);
      if (unit) store.removePlatoon(unit.id);
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
    canvas.addEventListener('contextmenu', onContext);

    let raf = 0;
    let last = performance.now();
    let frames = 0;
    let acc = 0;
    let lastEmit = 0;
    let lastDetailCheck = 0;

    const loop = (now: number) => {
      const raw = (now - last) / 1000;
      last = now;
      const stalled = raw > 0.5;
      const dt = stalled ? 0 : raw;
      if (stalled) {
        frames = 0;
        acc = 0;
      }

      const minutesBefore = store.clock.minutes;
      store.clock.update(dt);
      const dm = store.clock.minutes - minutesBefore;
      if (dm > 0) store.stepOrders(dm);

      try {
        r.render({
          level: store.zoom,
          hover: store.hover,
          selected: store.selected,
          showControl: store.showControl,
          showIntel: store.showIntel,
          showBasemap: store.onlineBasemap,
          showTerrain: store.showTerrain,
          showContours: store.showContours,
          showHydro: store.showHydro,
          showRoads: store.showRoads,
          showBlocks: store.showBlocks,
          showLabels: store.showLabels,
          showUnits: store.showUnits,
          platoons: store.units,
          selectedPlatoon: store.selectedPlatoon,
          hoverPlatoon: store.hoverPlatoon,
        });
        if (store.onlineBasemap && r.basemapFailed) store.setBasemap(false);
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

      if (now - lastDetailCheck > 700) {
        lastDetailCheck = now;
        if (r.view.scale > 0.035) {
          const keys = nearestDetailKeys(idx, r.view.cx, r.view.cy, 6000, 2);
          const key = keys[0] ?? null;
          if (key && key !== detailKey) {
            detailKey = key;
            loadDetail(key).then((layer) => {
              if (layer) r.setDetail(layer);
            });
          }
          for (let i = 1; i < keys.length; i++) loadDetail(keys[i]);
        } else if (detailKey) {
          detailKey = null;
          r.setDetail(null);
        }
      }

      frames++;
      acc += dt;
      if (now - lastEmit > 100) {
        store.perf = {
          fps: acc > 0.05 ? frames / acc : store.perf.fps,
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
      canvas.removeEventListener('contextmenu', onContext);
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
  const above = h.sy > 72;
  return (
    <div
      className="hover-card"
      style={{
        left: h.sx,
        top: above ? h.sy - 14 : h.sy + 20,
        transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
      }}
    >
      <div className="hc-title">
        {h.town.n} · {d.label}
      </div>
      <div className="hc-row">
        {d.frontage} 连 · 防御 +{d.defense}
      </div>
      <div className="hc-row dim">
        {d.area.toFixed(1)} km²
        {d.builtRatio != null ? ` · 建筑 ${Math.round(d.builtRatio * 100)}%` : ''}
        {d.roadKm != null ? ` · 路 ${d.roadKm.toFixed(1)} km` : ''}
      </div>
    </div>
  );
}
