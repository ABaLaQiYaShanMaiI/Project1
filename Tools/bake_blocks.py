import argparse
import json
import math
import os
import sys
import time
from collections import deque

import numpy as np
from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "app", "public", "data")

MAIN_ROADS = {"motorway", "trunk", "primary"}
DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1)]


def log(*a):
    print(f"[blocks {time.strftime('%H:%M:%S')}]", *a, flush=True)


def load_map(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def grid_of(meta):
    cols = meta["urbanMask"]["cols"]
    rows = meta["urbanMask"]["rows"]
    span_x, span_y = meta["spanM"]
    return cols, rows, span_x, span_y, span_x / max(cols - 1, 1)


def read_urban(path, cols, rows):
    img = Image.open(path).convert("RGBA")
    if img.size != (cols, rows):
        img = img.resize((cols, rows), Image.NEAREST)
    a = np.asarray(img)[:, :, 3]
    return a > 0


def to_px(x, y, cols, rows, span_x, span_y):
    i = int(round((x / span_x + 0.5) * (cols - 1)))
    j = int(round((0.5 - y / span_y) * (rows - 1)))
    return i, j


def rasterize_roads(roads, cols, rows, span_x, span_y):
    wall = np.zeros((rows, cols), dtype=bool)
    for rd in roads:
        if rd.get("c") not in MAIN_ROADS:
            continue
        pts = rd.get("p") or []
        for k in range(len(pts) - 1):
            x0, y0 = pts[k]
            x1, y1 = pts[k + 1]
            i0, j0 = to_px(x0, y0, cols, rows, span_x, span_y)
            i1, j1 = to_px(x1, y1, cols, rows, span_x, span_y)
            steps = max(abs(i1 - i0), abs(j1 - j0), 1)
            for s in range(steps + 1):
                t = s / steps
                i = int(round(i0 + (i1 - i0) * t))
                j = int(round(j0 + (j1 - j0) * t))
                if 0 <= j < rows and 0 <= i < cols:
                    wall[j, i] = True
    return wall


def components(mask):
    rows, cols = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    out = []
    ys, xs = np.nonzero(mask)
    for y0, x0 in zip(ys, xs):
        if seen[y0, x0]:
            continue
        q = deque([(y0, x0)])
        seen[y0, x0] = True
        comp = []
        while q:
            y, x = q.popleft()
            comp.append((y, x))
            for dx, dy in DIRS:
                ny, nx = y + dy, x + dx
                if 0 <= ny < rows and 0 <= nx < cols and mask[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
        out.append(comp)
    return out


def simplify(pts, tol):
    if len(pts) < 3:
        return pts
    ax, ay = pts[0]
    bx, by = pts[-1]
    dx, dy = bx - ax, by - ay
    norm = math.hypot(dx, dy)
    idx, best = -1, 0.0
    for k in range(1, len(pts) - 1):
        px, py = pts[k]
        if norm < 1e-9:
            d = math.hypot(px - ax, py - ay)
        else:
            d = abs(dy * (px - ax) - dx * (py - ay)) / norm
        if d > best:
            best, idx = d, k
    if best <= tol:
        return [pts[0], pts[-1]]
    return simplify(pts[: idx + 1], tol)[:-1] + simplify(pts[idx:], tol)


def poly_area_perimeter(pts):
    a = 0.0
    p = 0.0
    n = len(pts)
    for k in range(n):
        x1, y1 = pts[k]
        x2, y2 = pts[(k + 1) % n]
        a += x1 * y2 - x2 * y1
        p += math.hypot(x2 - x1, y2 - y1)
    return abs(a) / 2.0, p


def east_facing(pts):
    total = 0.0
    n = len(pts)
    for k in range(n):
        x1, y1 = pts[k]
        x2, y2 = pts[(k + 1) % n]
        if x2 - x1 > 0:
            total += math.hypot(x2 - x1, y2 - y1)
    return total


def trace_boundary(sub):
    rows, cols = sub.shape
    ys, xs = np.nonzero(sub)
    if len(ys) == 0:
        return []
    sy = int(ys.min())
    sx = int(xs[ys == sy].min())
    dirs = [(0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1), (-1, 0), (-1, 1)]
    b = (sy, sx)
    d0 = 6
    path = [b]
    limit = len(ys) * 8 + 32
    for _ in range(limit):
        found = False
        for k in range(8):
            d = (d0 + k) % 8
            ny = b[0] + dirs[d][0]
            nx = b[1] + dirs[d][1]
            if 0 <= ny < rows and 0 <= nx < cols and sub[ny, nx]:
                b = (ny, nx)
                d0 = (d + 5) % 8
                path.append(b)
                found = True
                break
        if not found:
            break
        if b == (sy, sx) and len(path) > 4:
            break
    return path


def fill_region(ids, pts, idx, cols, rows, span_x, span_y):
    ys = [p[1] for p in pts]
    j0 = max(0, int((0.5 - max(ys) / span_y) * (rows - 1)) - 1)
    j1 = min(rows - 1, int((0.5 - min(ys) / span_y) * (rows - 1)) + 1)
    n = len(pts)
    for j in range(j0, j1 + 1):
        y = (0.5 - j / (rows - 1)) * span_y
        nodes = []
        for k in range(n):
            x1, y1 = pts[k]
            x2, y2 = pts[(k + 1) % n]
            if (y1 > y) != (y2 > y):
                nodes.append(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
        nodes.sort()
        for a in range(0, len(nodes) - 1, 2):
            i0 = max(0, int((nodes[a] / span_x + 0.5) * (cols - 1)))
            i1 = min(cols - 1, int((nodes[a + 1] / span_x + 0.5) * (cols - 1)))
            if i1 >= i0:
                ids[j, i0:i1 + 1] = idx


def rasterize_regions(regions, cols, rows, span_x, span_y):
    ids = np.full((rows, cols), -1, dtype=np.int32)
    order = sorted(range(len(regions)), key=lambda i: -regions[i].get("l", 10))
    for idx in order:
        pts = regions[idx].get("p") or []
        if len(pts) < 4:
            continue
        fill_region(ids, pts, idx, cols, rows, span_x, span_y)
    return ids


def label_for(dx, dy):
    ang = (math.degrees(math.atan2(dy, dx)) + 360) % 360
    names = ["东区", "东北区", "北区", "西北区", "西区", "西南区", "南区", "东南区"]
    return names[int(((ang + 22.5) % 360) // 45)]


def label_land(land, grid_m, min_area_km2=0.35):
    comps = components(land)
    labels = np.full(land.shape, -1, dtype=np.int32)
    sizes = np.zeros(len(comps), dtype=np.int64)
    pix = []
    for k, comp in enumerate(comps):
        ys = np.fromiter((p[0] for p in comp), dtype=np.int32, count=len(comp))
        xs = np.fromiter((p[1] for p in comp), dtype=np.int32, count=len(comp))
        labels[ys, xs] = k
        sizes[k] = len(comp)
        pix.append((ys, xs))

    min_px = int(min_area_km2 * 1e6 / (grid_m ** 2))
    for _ in range(4):
        small = [i for i in range(len(comps)) if 0 < sizes[i] < min_px]
        if not small:
            break
        for i in small:
            ys, xs = pix[i]
            parts = []
            for dy, dx in DIRS:
                ny = ys + dy
                nx = xs + dx
                ok = (ny >= 0) & (ny < labels.shape[0]) & (nx >= 0) & (nx < labels.shape[1])
                parts.append(labels[ny[ok], nx[ok]])
            allv = np.concatenate(parts) if parts else np.array([], dtype=np.int32)
            allv = allv[(allv >= 0) & (allv != i)]
            if len(allv) == 0:
                continue
            uniq, cnt = np.unique(allv, return_counts=True)
            target = int(uniq[int(np.argmax(cnt))])
            labels[ys, xs] = target
            pix[target] = (np.concatenate([pix[target][0], ys]), np.concatenate([pix[target][1], xs]))
            sizes[target] += sizes[i]
            sizes[i] = 0
    return labels, sizes

    ang = (math.degrees(math.atan2(dy, dx)) + 360) % 360
    names = ["东区", "东北区", "北区", "西北区", "西区", "西南区", "南区", "东南区"]
    return names[int(((ang + 22.5) % 360) // 45)]


def build_blocks(data, min_area_km2=0.35, max_blocks=30, regions=None):
    meta = data["meta"]
    cols, rows, span_x, span_y, grid_m = grid_of(meta)
    urban_path = os.path.join(DATA, meta["urbanMask"]["file"])
    urban = read_urban(urban_path, cols, rows)
    wall = rasterize_roads(data.get("roads", []), cols, rows, span_x, span_y)
    land = urban & ~wall

    labels, sizes = label_land(land, grid_m, min_area_km2)
    regions = regions or data.get("regions") or []
    rids = rasterize_regions(regions, cols, rows, span_x, span_y) if regions else None
    if rids is not None:
        log(f"regions: {len(regions)}")
    by_label = {}
    ys_all, xs_all = np.nonzero(labels >= 0)
    for y, x in zip(ys_all.tolist(), xs_all.tolist()):
        by_label.setdefault(int(labels[y, x]), []).append((y, x))
    comps = list(by_label.values())
    log(f"land px {int(land.sum())}, wall px {int(wall.sum())}, blocks {len(comps)}")

    towns = data.get("towns", [])
    by_town = {}
    for comp in comps:
        if len(comp) < 8:
            continue
        ys = [p[0] for p in comp]
        xs = [p[1] for p in comp]
        cy = sum(ys) / len(ys)
        cx = sum(xs) / len(xs)
        mx = (cx / max(cols - 1, 1) - 0.5) * span_x
        my = (0.5 - cy / max(rows - 1, 1)) * span_y
        best = None
        best_d = 1e18
        for t in towns:
            d = math.hypot(t["x"] - mx, t["y"] - my)
            if d < best_d and d <= max(t["r"] * 0.9, 1200):
                best_d = d
                best = t
        if best is None:
            continue
        by_town.setdefault(best["id"], []).append((len(comp), comp, (mx, my)))

    updated = 0
    total_blocks = 0
    for t in towns:
        parts = by_town.get(t["id"], [])
        if not parts:
            continue
        parts.sort(key=lambda p: -p[0])
        keep = [p for p in parts if p[0] * grid_m * grid_m / 1e6 >= min_area_km2]
        if not keep:
            keep = [parts[0]]
        parts = keep

        if rids is not None:
            grouped = {}
            for npx, comp, c in parts:
                mid = comp[len(comp) // 2]
                rid = int(rids[mid[0], mid[1]])
                key = f"R{rid}" if rid >= 0 else f"F{len(grouped)}"
                grouped.setdefault(key, []).append((npx, comp, c))
            merged_parts = []
            for lst in grouped.values():
                total = sum(p[0] for p in lst)
                allpx = [p for _, comp, _ in lst for p in comp]
                cy = sum(p[0] for p in allpx) / len(allpx)
                cx = sum(p[1] for p in allpx) / len(allpx)
                mx = (cx / max(cols - 1, 1) - 0.5) * span_x
                my = (0.5 - cy / max(rows - 1, 1)) * span_y
                merged_parts.append((total, allpx, (mx, my)))
            parts = merged_parts
            parts.sort(key=lambda p: -p[0])

        total_km2 = sum(p[0] for p in parts) * grid_m * grid_m / 1e6
        target = max(1, min(max_blocks, int(round(total_km2 / 3.0))))
        if len(parts) > target:
            head = parts[:target]
            for npx, comp, c in parts[target:]:
                best_i = 0
                best_d = 1e18
                for i, k in enumerate(head):
                    d = (k[2][0] - c[0]) ** 2 + (k[2][1] - c[1]) ** 2
                    if d < best_d:
                        best_d = d
                        best_i = i
                k = head[best_i]
                head[best_i] = (k[0] + npx, k[1] + comp, k[2])
            parts = head

        districts = []
        used_labels = set()
        for npx, comp, c in parts:
            ys = [p[0] for p in comp]
            xs = [p[1] for p in comp]
            j0, j1 = min(ys), max(ys)
            i0, i1 = min(xs), max(xs)
            sub = np.zeros((j1 - j0 + 3, i1 - i0 + 3), dtype=bool)
            for y, x in comp:
                sub[y - j0 + 1, x - i0 + 1] = True
            loop = trace_boundary(sub)
            if len(loop) < 8:
                continue
            pts = []
            for py, px in loop:
                gx = px - 1 + i0
                gy = py - 1 + j0
                mx = (gx / max(cols - 1, 1) - 0.5) * span_x
                my = (0.5 - gy / max(rows - 1, 1)) * span_y
                pts.append((mx, my))
            pts = simplify(pts + [pts[0]], 25.0)
            if len(pts) > 1:
                pts = pts[:-1]
            if len(pts) < 4:
                continue
            area_m2, perim_m = poly_area_perimeter(pts)
            east = east_facing(pts)
            area_km2 = npx * grid_m * grid_m / 1e6
            bbox_px = (j1 - j0 + 1) * (i1 - i0 + 1)
            cy = sum(ys) / len(ys)
            cx = sum(xs) / len(xs)
            mx = (cx / max(cols - 1, 1) - 0.5) * span_x
            my = (0.5 - cy / max(rows - 1, 1)) * span_y
            built_ratio = min(1.0, npx / max(bbox_px, 1))
            road_px = int(wall[j0:j1 + 1, i0:i1 + 1].sum())
            road_km = road_px * grid_m / 1000.0
            frontage = max(1, min(6, int(round(east / 2000.0))))
            defense = max(1, min(6, int(round(1 + built_ratio * 4))))
            label = label_for(mx - t["x"], my - t["y"]) if len(parts) > 1 else "全域"
            if label in used_labels:
                suffix = 2
                while f"{label}{suffix}" in used_labels:
                    suffix += 1
                label = f"{label}{suffix}"
            used_labels.add(label)
            districts.append({
                "label": label,
                "shape": "poly",
                "r0": 0.0,
                "r1": round(math.sqrt(area_m2 / math.pi), 1),
                "a0": 0.0,
                "a1": 6.2832,
                "t0": 0.0,
                "t1": 0.0,
                "area": round(area_km2, 2),
                "frontage": frontage,
                "defense": defense,
                "cp": [round(mx, 1), round(my, 1)],
                "poly": [[round(x, 1), round(y, 1)] for x, y in pts],
                "builtRatio": round(built_ratio, 2),
                "roadKm": round(road_km, 1),
                "value": max(1, int(round(t.get("pop", 0) / 10000.0 + 1))),
            })

        if not districts:
            continue
        t["districts"] = districts
        t["kind"] = "poly"
        t["area"] = round(sum(d["area"] for d in districts), 2)
        updated += 1
        total_blocks += len(districts)

    log(f"towns updated: {updated}, total blocks: {total_blocks}")
    return data


def main():
    ap = argparse.ArgumentParser(description="把城镇分区改写成区划型地块（poly）")
    ap.add_argument("--map", default="app/public/data/map_fulda.json")
    ap.add_argument("--out", default="")
    ap.add_argument("--min-area", type=float, default=0.35)
    ap.add_argument("--max-blocks", type=int, default=30)
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()
    path = args.map if os.path.isabs(args.map) else os.path.join(HERE, "..", args.map)
    data = load_map(path)
    key = os.path.splitext(os.path.basename(path))[0]
    if key.startswith("map_"):
        key = key[4:]
    regions = data.get("regions") or []
    if not regions:
        rpath = os.path.join(DATA, f"regions_{key}.json")
        if os.path.exists(rpath):
            with open(rpath, encoding="utf-8") as f:
                regions = json.load(f).get("regions") or []
    data = build_blocks(data, args.min_area, args.max_blocks, regions)
    if args.dry:
        rows = [t for t in data["towns"] if t.get("kind") == "poly"]
        rows.sort(key=lambda x: -len(x["districts"]))
        for t in rows[:10]:
            log(f"  {t['n']}: {len(t['districts'])} blocks, {t['area']} km2")
        return
    out = args.out or path
    txt = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    with open(out, "w", encoding="utf-8") as f:
        f.write(txt)
    log(f"wrote {out} ({len(txt) / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    main()

