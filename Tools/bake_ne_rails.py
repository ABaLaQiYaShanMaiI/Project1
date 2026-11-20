import json
import math
import os
import sys

import shapefile

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "app", "public", "data")
SHP = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ.get("TEMP", ""), "ne_rail", "ne_10m_railroads.shp")

TOL_M = 300.0
FINE_SCALES = {"1:10m", "1:5m", "1:3m"}
SKIP_PARTS = {"ne_1d4_north_america_dup"}


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
        if len(part) < 2:
            continue
        simp = rdp(part, TOL_M)
        if len(simp) < 2 or (len(simp) == 2 and simp[0] == simp[-1]):
            continue
        bands[band].append([[a, b] for a, b in simp])

for band, lines in bands.items():
    out = os.path.join(DATA, f"rails_world_{band}.json")
    doc = {"v": 1, "source": "Natural Earth 1:10m railroads", "count": len(lines), "lines": lines}
    with open(out, "w", encoding="utf-8") as f:
        json.dump(doc, f, separators=(",", ":"))
    print(f"{band}: {len(lines)} lines / {os.path.getsize(out) / 1048576:.2f} MB")
print(f"skipped ferry {skipped_ferry} / north-america dup {skipped_dup}")
