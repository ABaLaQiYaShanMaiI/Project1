import json
import math
import os
import sys

import shapefile

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "app", "public", "data")
SHP = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ.get("TEMP", ""), "ne_riv", "ne_10m_rivers_lake_centerlines.shp")

TOL_M = 300.0
KEEP = {"River", "Lake Centerline"}


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


if not os.path.exists(SHP):
    sys.exit(f"缺少 shapefile：{SHP}（先下载 ne_10m_rivers_lake_centerlines.zip 并解压到 Tools/.tile-cache/ne_rivers）")
reader = shapefile.Reader(SHP)
fields = [f[0] for f in reader.fields[1:]]
i_cls = fields.index("featurecla")
i_rank = fields.index("scalerank")

lines = []
ranks = []
skipped = 0
for shape, rec in zip(reader.shapes(), reader.records()):
    if rec[i_cls] not in KEEP:
        skipped += 1
        continue
    rank = max(1, min(9, int(rec[i_rank] or 9)))
    pts = [(round(x, 5), round(y, 5)) for x, y in shape.points]
    ends = list(shape.parts) + [len(pts)]
    for i in range(len(ends) - 1):
        part = pts[ends[i]:ends[i + 1]]
        if len(part) < 2:
            continue
        simp = rdp(part, TOL_M)
        if len(simp) < 2 or (len(simp) == 2 and simp[0] == simp[-1]):
            continue
        lines.append([[a, b] for a, b in simp])
        ranks.append(rank)

out = os.path.join(DATA, "rivers_world.json")
doc = {"v": 1, "source": "Natural Earth 1:10m rivers + lake centerlines", "count": len(lines), "lines": lines, "rank": ranks}
with open(out, "w", encoding="utf-8") as f:
    json.dump(doc, f, separators=(",", ":"))
print(f"rivers {len(lines)} lines / {os.path.getsize(out) / 1048576:.2f} MB / skipped {skipped}")
