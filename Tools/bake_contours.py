import argparse
import json
import math
import os
import sys
import time

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "app", "public", "data")
SOURCE = "AWS Terrain Tiles（Terrarium / SRTM）· 本地 DEM 生成"
M_PER_DEG_LAT = 110540.0
M_PER_DEG_LON = 111320.0

sys.stdout.reconfigure(encoding="utf-8")

EDGES = [(3, 0), (0, 1), (3, 1), (1, 2), (3, 0, 1, 2), (0, 2), (3, 2), (2, 3), (0, 2), (0, 1, 2, 3), (1, 2), (1, 3), (0, 1), (3, 0)]

CASE_PAIRS = {
    1: [(3, 0)],
    2: [(0, 1)],
    3: [(3, 1)],
    4: [(1, 2)],
    5: [(3, 0), (1, 2)],
    6: [(0, 2)],
    7: [(3, 2)],
    8: [(2, 3)],
    9: [(0, 2)],
    10: [(0, 1), (2, 3)],
    11: [(1, 2)],
    12: [(1, 3)],
    13: [(0, 1)],
    14: [(3, 0)],
}


def log(*a):
    print(f"[contour {time.strftime('%H:%M:%S')}]", *a, flush=True)


def deg2tile(lat, lon, z):
    n = 2 ** z
    return (
        (lon + 180.0) / 360.0 * n,
        (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n,
    )


def tile2deg(x, y, z):
    n = 2 ** z
    lon = x / n * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lon, lat


def load_mosaic(key, zmin, zmax, bbox=None):
    root = os.path.join(DATA, "dem", key)
    with open(os.path.join(root, "index.json"), encoding="utf-8") as f:
        man = json.load(f)
    z = min(man["maxzoom"], zmax)
    z = max(man["minzoom"], z)
    w, s, e, n = man["bbox"]
    x0, y0 = deg2tile(n, w, z)
    x1, y1 = deg2tile(s, e, z)
    if bbox:
        bx0, by0 = deg2tile(bbox[3], bbox[0], z)
        bx1, by1 = deg2tile(bbox[1], bbox[2], z)
        x0 = max(x0, bx0)
        y0 = max(y0, by0)
        x1 = min(x1, bx1)
        y1 = min(y1, by1)
    tx0, ty0 = int(x0), int(y0)
    tx1, ty1 = int(x1), int(y1)
    nx, ny = tx1 - tx0 + 1, ty1 - ty0 + 1
    log(f"mosaic z{z} {nx}x{ny} tiles")
    mosaic = np.zeros((ny * 256, nx * 256), dtype=np.float32)
    for j in range(ny):
        for i in range(nx):
            p = os.path.join(root, str(z), str(tx0 + i), f"{ty0 + j}.png")
            if not os.path.exists(p):
                continue
            a = np.asarray(Image.open(p).convert("RGB")).astype(np.float32)
            el = (a[:, :, 0] * 256.0 + a[:, :, 1] + a[:, :, 2] / 256.0) - 32768.0
            mosaic[j * 256:(j + 1) * 256, i * 256:(i + 1) * 256] = el
    lon_l, lat_t = tile2deg(tx0, ty0, z)
    lon_r, lat_b = tile2deg(tx0 + nx, ty0 + ny, z)
    return mosaic, (lon_l, lat_t, lon_r, lat_b), z


def merc(lat):
    return math.asinh(math.tan(math.radians(lat)))


def crop_bbox(mosaic, bounds, bbox, nx_out):
    lon_l, lat_t, lon_r, lat_b = bounds
    w, s, e, n = bbox
    px = mosaic.shape[1] / (lon_r - lon_l)
    my_t, my_b = merc(lat_t), merc(lat_b)
    py = mosaic.shape[0] / (my_t - my_b)
    u0 = int(round((w - lon_l) * px))
    u1 = int(round((e - lon_l) * px))
    v0 = int(round((my_t - merc(n)) * py))
    v1 = int(round((my_t - merc(s)) * py))
    u0, v0 = max(0, u0), max(0, v0)
    u1, v1 = min(mosaic.shape[1], u1), min(mosaic.shape[0], v1)
    sub = mosaic[v0:v1, u0:u1]
    h = max(2, int(round(nx_out * sub.shape[0] / max(1, sub.shape[1]))))
    return np.asarray(Image.fromarray(sub, "F").resize((nx_out, h), Image.LANCZOS), dtype=np.float32)


def crop_linear(mosaic, bounds, bbox, nx_out):
    lon_l, lat_t, lon_r, lat_b = bounds
    w, s, e, n = bbox
    px = mosaic.shape[1] / (lon_r - lon_l)
    u0 = max(0, int(round((w - lon_l) * px)))
    u1 = min(mosaic.shape[1], int(round((e - lon_l) * px)))
    if u1 - u0 < 2:
        return crop_bbox(mosaic, bounds, bbox, nx_out)
    band = np.asarray(
        Image.fromarray(mosaic[:, u0:u1], "F").resize((nx_out, mosaic.shape[0]), Image.LANCZOS),
        dtype=np.float32,
    )
    my_t, my_b = merc(lat_t), merc(lat_b)
    py = mosaic.shape[0] / (my_t - my_b)
    lat0 = (s + n) / 2.0
    span_x = (e - w) * M_PER_DEG_LON * math.cos(math.radians(lat0))
    span_y = (n - s) * M_PER_DEG_LAT
    h_out = max(2, int(round(nx_out * span_y / max(1.0, span_x))))
    lats = np.linspace(n, s, h_out)
    src = np.clip((my_t - np.array([merc(v) for v in lats])) * py, 0.0, mosaic.shape[0] - 1.001)
    r0 = np.floor(src).astype(np.int32)
    fr = (src - r0).astype(np.float32)
    r1 = np.minimum(r0 + 1, mosaic.shape[0] - 1)
    return band[r0, :] * (1.0 - fr)[:, None] + band[r1, :] * fr[:, None]


def mask_box(grid, bbox, pr, lon0, lat0, excl):
    span_x = (bbox[2] - bbox[0]) * pr["mPerDegLon"]
    span_y = (bbox[3] - bbox[1]) * pr["mPerDegLat"]
    rows, cols = grid.shape
    cw = span_x / max(1, cols - 1)
    ch = span_y / max(1, rows - 1)
    u0 = int(round((excl[0] - lon0) * pr["mPerDegLon"] / cw + (cols - 1) / 2.0))
    u1 = int(round((excl[2] - lon0) * pr["mPerDegLon"] / cw + (cols - 1) / 2.0))
    v0 = int(round((lat0 - excl[3]) * pr["mPerDegLat"] / ch + (rows - 1) / 2.0))
    v1 = int(round((lat0 - excl[1]) * pr["mPerDegLat"] / ch + (rows - 1) / 2.0))
    u0, u1 = max(0, u0), min(cols, u1)
    v0, v1 = max(0, v0), min(rows, v1)
    if u1 <= u0 or v1 <= v0:
        return grid
    out = grid.copy()
    out[v0:v1, u0:u1] = np.nan
    return out


def level_segments(e, x0, y0, cell_w, cell_h, lv):
    a = e[:-1, :-1]
    b = e[:-1, 1:]
    c = e[1:, 1:]
    d = e[1:, :-1]
    lo = np.minimum(np.minimum(a, b), np.minimum(c, d))
    hi = np.maximum(np.maximum(a, b), np.maximum(c, d))
    band = (lo < lv) & (hi >= lv)
    if not band.any():
        return []
    idx = ((a > lv).astype(np.uint8) | ((b > lv).astype(np.uint8) << 1) |
           ((c > lv).astype(np.uint8) << 2) | ((d > lv).astype(np.uint8) << 3))
    jj, ii = np.nonzero(band)
    cases = idx[jj, ii]
    ax, bx, cx, dx = a[jj, ii], b[jj, ii], c[jj, ii], d[jj, ii]
    xl = x0 + ii * cell_w
    yt = y0 - jj * cell_h
    pts = {}
    m = cases != 0
    ms = (bx - ax)
    pts[0] = (xl + np.divide(lv - ax, ms, out=np.zeros_like(ax), where=np.abs(ms) > 1e-9) * cell_w, yt)
    ms = (cx - bx)
    pts[1] = (xl + cell_w, yt - np.divide(lv - bx, ms, out=np.zeros_like(bx), where=np.abs(ms) > 1e-9) * cell_h)
    ms = (dx - cx)
    pts[2] = (xl + cell_w - np.divide(lv - cx, ms, out=np.zeros_like(cx), where=np.abs(ms) > 1e-9) * cell_w, yt - cell_h)
    ms = (ax - dx)
    pts[3] = (xl, yt - cell_h + np.divide(lv - dx, ms, out=np.zeros_like(dx), where=np.abs(ms) > 1e-9) * cell_h)
    out = []
    for case, pairs in CASE_PAIRS.items():
        sel = cases == case
        if not sel.any():
            continue
        for e1, e2 in pairs:
            p1x, p1y = pts[e1][0][sel], pts[e1][1][sel]
            p2x, p2y = pts[e2][0][sel], pts[e2][1][sel]
            out.append(np.stack([p1x, p1y, p2x, p2y], axis=1))
    return out


def stitch(segments, tol_key=1000.0):
    nodes = {}
    for seg in segments:
        for k in range(0, len(seg), 2):
            key = (round(seg[k] * tol_key), round(seg[k + 1] * tol_key))
            if key not in nodes:
                nodes[key] = [seg[k], seg[k + 1], []]
    for si, seg in enumerate(segments):
        k0 = (round(seg[0] * tol_key), round(seg[1] * tol_key))
        k1 = (round(seg[2] * tol_key), round(seg[3] * tol_key))
        if k0 == k1:
            continue
        nodes[k0][2].append((k1, si))
        nodes[k1][2].append((k0, si))
    used = [False] * len(segments)
    lines = []
    order = [k for k, v in nodes.items() if len(v[2]) != 2] + list(nodes.keys())
    for start in order:
        cur = start
        chain = [start]
        while True:
            nxt = None
            for nb, si in nodes[cur][2]:
                if not used[si]:
                    used[si] = True
                    nxt = nb
                    break
            if nxt is None:
                break
            chain.append(nxt)
            cur = nxt
            if cur == start:
                break
        if len(chain) >= 2:
            lines.append([(nodes[k][0], nodes[k][1]) for k in chain])
    return lines


def simplify(pts, tol):
    if len(pts) < 3:
        return pts
    p = np.asarray(pts, dtype=np.float64)
    keep = np.zeros(len(p), dtype=bool)
    keep[0] = keep[-1] = True
    stack = [(0, len(p) - 1)]
    while stack:
        i0, i1 = stack.pop()
        if i1 <= i0 + 1:
            continue
        a = p[i0]
        b = p[i1]
        ab = b - a
        ln = math.hypot(ab[0], ab[1])
        seg = p[i0 + 1:i1]
        if ln < 1e-9:
            dist = np.hypot(seg[:, 0] - a[0], seg[:, 1] - a[1])
        else:
            dist = np.abs(ab[0] * (a[1] - seg[:, 1]) - ab[1] * (a[0] - seg[:, 0])) / ln
        k = int(np.argmax(dist))
        if dist[k] > tol:
            mid = i0 + 1 + k
            keep[mid] = True
            stack.append((i0, mid))
            stack.append((mid, i1))
    return [tuple(v) for v in p[keep]]


def label_points(lines, spacing, max_per_line):
    out = []
    for pts in lines:
        if len(pts) < 8:
            continue
        acc = 0.0
        nxt = spacing * 0.5
        placed = 0
        for i in range(1, len(pts)):
            x0, y0 = pts[i - 1]
            x1, y1 = pts[i]
            d = math.hypot(x1 - x0, y1 - y0)
            while acc + d >= nxt and placed < max_per_line:
                t = (nxt - acc) / max(d, 1e-9)
                out.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, math.degrees(math.atan2(y1 - y0, x1 - x0))))
                placed += 1
                nxt += spacing
            acc += d
            if placed >= max_per_line:
                break
    return out


def main():
    ap = argparse.ArgumentParser(description="从本地 DEM 生成等高线矢量（计曲线 + 高程标注锚点）")
    ap.add_argument("--key", default="fulda")
    ap.add_argument("--dem", default="")
    ap.add_argument("--bbox", default="8.849,50.240,10.591,51.000")
    ap.add_argument("--exclude", default="")
    ap.add_argument("--warp", default="linear")
    ap.add_argument("--grid", type=int, default=1200)
    ap.add_argument("--interval", type=float, default=25.0)
    ap.add_argument("--bold", type=float, default=0.0)
    ap.add_argument("--tol", type=float, default=45.0)
    ap.add_argument("--min-km", type=float, default=0.6)
    ap.add_argument("--min-elev", type=float, default=0.0)
    ap.add_argument("--label-km", type=float, default=3.5)
    args = ap.parse_args()

    bbox = tuple(float(v) for v in args.bbox.split(","))
    lat0 = (bbox[1] + bbox[3]) / 2.0
    lon0 = (bbox[0] + bbox[2]) / 2.0
    pr = {"mPerDegLat": M_PER_DEG_LAT, "mPerDegLon": M_PER_DEG_LON * math.cos(math.radians(lat0))}

    mosaic, bounds, z = load_mosaic(args.dem or args.key, 9, 11, bbox)
    grid = crop_linear(mosaic, bounds, bbox, args.grid) if args.warp == "linear" else crop_bbox(mosaic, bounds, bbox, args.grid)
    if args.exclude:
        for part in args.exclude.split(";"):
            if not part.strip():
                continue
            excl = tuple(float(v) for v in part.split(","))
            grid = mask_box(grid, bbox, pr, lon0, lat0, excl)
    grid_min = float(np.nanmin(grid))
    grid_max = float(np.nanmax(grid))
    rows, cols = grid.shape
    m_per_px = (bbox[2] - bbox[0]) * pr["mPerDegLon"] / cols
    log(f"网格 {cols}x{rows} ≈ {m_per_px:.0f} m/px，高程 {grid_min:.0f}–{grid_max:.0f} m")

    interval = args.interval
    if interval <= 0:
        span = grid_max - grid_min
        interval = 25.0 if span < 1200 else 50.0
    bold = args.bold if args.bold > 0 else interval * 5
    levels = np.arange(math.floor(grid_min / interval) * interval, grid_max + interval, interval)
    levels = [float(v) for v in levels if v > grid_min and v < grid_max and v >= args.min_elev]
    log(f"等高距 {interval:.0f} m，计曲线 {bold:.0f} m，层数 {len(levels)}")

    x0 = -((bbox[2] - bbox[0]) * pr["mPerDegLon"]) / 2.0
    y0 = ((bbox[3] - bbox[1]) * pr["mPerDegLat"]) / 2.0
    cell_w = (bbox[2] - bbox[0]) * pr["mPerDegLon"] / (cols - 1)
    cell_h = (bbox[3] - bbox[1]) * pr["mPerDegLat"] / (rows - 1)

    out_levels = []
    total_v = 0
    for lv in levels:
        segs = level_segments(grid, x0, y0, cell_w, cell_h, lv)
        if not segs:
            continue
        flat = np.concatenate(segs, axis=0)
        keep = np.hypot(flat[:, 2] - flat[:, 0], flat[:, 3] - flat[:, 1]) >= 1.0
        flat = flat[keep]
        if len(flat) == 0:
            continue
        lines = stitch(flat)
        polys = []
        for ln in lines:
            if len(ln) < 2:
                continue
            p = simplify(ln, args.tol)
            length = sum(math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]) for i in range(1, len(p)))
            if length < args.min_km * 1000 or len(p) < 2:
                continue
            arr = []
            for (px, py) in p:
                arr.append(int(round(px)))
                arr.append(int(round(py)))
            polys.append(arr)
            total_v += len(p)
        if not polys:
            continue
        bold_flag = 1 if abs(lv / bold - round(lv / bold)) < 1e-6 else 0
        out_levels.append({"v": lv, "b": bold_flag, "l": polys})

    out_levels = [o for o in out_levels if o]
    span_x = (bbox[2] - bbox[0]) * pr["mPerDegLon"]
    span_y = (bbox[3] - bbox[1]) * pr["mPerDegLat"]
    doc = {
        "key": args.key,
        "origin": [round(lon0, 6), round(lat0, 6)],
        "spanM": [round(span_x, 1), round(span_y, 1)],
        "mPerDegLat": round(pr["mPerDegLat"], 4),
        "mPerDegLon": round(pr["mPerDegLon"], 4),
        "interval": interval,
        "bold": bold,
        "vertices": total_v,
        "levels": out_levels,
        "attribution": SOURCE,
        "generated": time.strftime("%Y-%m-%d %H:%M"),
    }
    out = os.path.join(DATA, f"contours_{args.key}.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    size = os.path.getsize(out)
    log(f"完成 {os.path.basename(out)} {size / 1048576:.2f} MB，{len(out_levels)} 层，{total_v} 顶点，0 标注")


if __name__ == "__main__":
    main()
