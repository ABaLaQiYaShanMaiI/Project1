import json
import math
import os
import sys

import shapefile

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "app", "public", "data")
SHP = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "Tools", ".tile-cache", "ne_rail", "ne_10m_railroads.shp")

FINE_SCALES = {"1:10m", "1:5m", "1:3m"}
SKIP_PARTS = {"ne_1d4_north_america_dup"}
NODE_KEY = 1e-4
BRIDGE_M = 400.0
FINE_TOL = 120.0
COARSE_TOL = 300.0
MAX_MB = 3.9


def project(pts):
    lat0 = (pts[0][1] + pts[-1][1]) / 2.0
    kx = 111320.0 * math.cos(math.radians(lat0))
    return [(x * kx, y * 111320.0) for x, y in pts]


def rdp(pts, tol):
    if len(pts) < 3:
        return pts
    q = project(pts)
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = q[a]
        bx, by = q[b]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy) or 1e-12
        best, idx = 0.0, -1
        for i in range(a + 1, b):
            px, py = q[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / norm
            if d > best:
                best, idx = d, i
        if best > tol and idx > 0:
            keep[idx] = True
            stack.append((a, idx))
            stack.append((idx, b))
    return [p for p, k in zip(pts, keep) if k]


def node(p):
    return (round(p[0] / NODE_KEY), round(p[1] / NODE_KEY))


def chain(segs):
    ends = {}
    for i, s in enumerate(segs):
        for side in (0, 1):
            ends.setdefault(node(s[0] if side == 0 else s[-1]), []).append((i, side))
    used = [False] * len(segs)
    out = []
    for i, s in enumerate(segs):
        if used[i]:
            continue
        used[i] = True
        cur = list(s)
        while True:
            hit = next(((j, side) for j, side in ends.get(node(cur[-1]), ()) if not used[j]), None)
            if not hit:
                break
            j, side = hit
            used[j] = True
            seg = segs[j]
            cur.extend(seg[1:] if side == 0 else list(reversed(seg))[1:])
        while True:
            hit = next(((j, side) for j, side in ends.get(node(cur[0]), ()) if not used[j]), None)
            if not hit:
                break
            j, side = hit
            used[j] = True
            seg = segs[j]
            cur = (seg[:-1] if side == 1 else list(reversed(seg))[1:]) + cur
        out.append(cur)
    return out


def metres(a, b):
    dx = (a[0] - b[0]) * 111320.0 * math.cos(math.radians((a[1] + b[1]) / 2.0))
    dy = (a[1] - b[1]) * 110540.0
    return math.hypot(dx, dy)


def bridge(chains, gap_m=BRIDGE_M):
    pts = []
    for ci, c in enumerate(chains):
        pts.append((c[0], ci, 0))
        pts.append((c[-1], ci, 1))
    cell = 0.02
    grid = {}
    for k, (p, ci, side) in enumerate(pts):
        grid.setdefault((math.floor(p[0] / cell), math.floor(p[1] / cell)), []).append(k)
    parent = list(range(len(chains)))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    pairs = []
    for k, (p, ci, side) in enumerate(pts):
        best = None
        gx, gy = math.floor(p[0] / cell), math.floor(p[1] / cell)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for m in grid.get((gx + dx, gy + dy), ()):
                    q, cj, _ = pts[m]
                    if cj == ci or find(ci) == find(cj):
                        continue
                    d = metres(p, q)
                    if d <= gap_m and (best is None or d < best[0]):
                        best = (d, m)
        if best:
            pairs.append((best[0], k, best[1]))
    pairs.sort()
    for _, k1, k2 in pairs:
        _, c1, s1 = pts[k1]
        _, c2, s2 = pts[k2]
        r1, r2 = find(c1), find(c2)
        if r1 == r2:
            continue
        a = chains[r1]
        b = chains[r2]
        if s1 == 1 and s2 == 0:
            merged = a + b
        elif s1 == 0 and s2 == 1:
            merged = b + a
        elif s1 == 0 and s2 == 0:
            merged = list(reversed(a)) + b
        else:
            merged = a + list(reversed(b))
        chains[r1] = merged
        chains[r2] = []
        parent[r2] = r1
    return [c for c in chains if c]


def build(bands, tol_map):
    docs = {}
    for band, segs in bands.items():
        merged = bridge(chain(segs))
        lines = []
        for c in merged:
            simp = rdp(c, tol_map[band])
            if len(simp) < 2 or (len(simp) == 2 and simp[0] == simp[-1]):
                continue
            lines.append([[round(x, 5), round(y, 5)] for x, y in simp])
        docs[band] = lines
    return docs


if not os.path.exists(SHP):
    sys.exit(f"缺少 shapefile：{SHP}（下载 ne_10m_railroads.zip 并解压到 Tools/.tile-cache/ne_rail）")

reader = shapefile.Reader(SHP)
fields = [f[0] for f in reader.fields[1:]]
i_cls = fields.index("featurecla")
i_part = fields.index("part")
i_scale = fields.index("disp_scale")

bands = {"fine": [], "coarse": []}
skipped_ferry = 0
skipped_dup = 0
for shape, rec in zip(reader.shapes(), reader.records()):
    if rec[i_cls] != "Railroad":
        skipped_ferry += 1
        continue
    if rec[i_part] in SKIP_PARTS:
        skipped_dup += 1
        continue
    pts = [(round(x, 5), round(y, 5)) for x, y in shape.points]
    ends = list(shape.parts) + [len(pts)]
    band = "fine" if rec[i_scale] in FINE_SCALES else "coarse"
    for i in range(len(ends) - 1):
        part = pts[ends[i]:ends[i + 1]]
        if len(part) >= 2:
            bands[band].append(part)

tol_map = {"fine": FINE_TOL, "coarse": COARSE_TOL}
for _ in range(4):
    docs = build(bands, tol_map)
    sizes = {b: len(json.dumps({"v": 1, "lines": l}, separators=(",", ":")).encode()) / 1048576 for b, l in docs.items()}
    if max(sizes.values()) <= MAX_MB:
        break
    tol_map = {b: t * 1.6 for b, t in tol_map.items()}
    print("over budget, retry tol", {b: round(t) for b, t in tol_map.items()}, flush=True)

for band, lines in docs.items():
    out = os.path.join(DATA, f"rails_world_{band}.json")
    doc = {"v": 1, "source": "Natural Earth 1:10m railroads", "count": len(lines), "lines": lines}
    with open(out, "w", encoding="utf-8") as f:
        json.dump(doc, f, separators=(",", ":"))
    pts_n = sum(len(l) for l in lines)
    print(f"{band}: {len(lines)} lines / {pts_n} pts / {os.path.getsize(out) / 1048576:.2f} MB / tol {tol_map[band]:.0f} m")

print(f"skipped ferry {skipped_ferry} / north-america dup {skipped_dup}")

