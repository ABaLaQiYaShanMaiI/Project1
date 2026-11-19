import json
import math
import os
import sys

import shapefile

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "app", "public", "data")
SHP = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ.get("TEMP", ""), "ne_rail", "ne_10m_railroads.shp")
OUT = os.path.join(DATA, "rails_world.json")

TOL = 0.01
MINLEN = 25000.0
MAXSEG = 80000.0


def rdp(pts, tol):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = pts[a]
        bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        norm = math.hypot(dx, dy) or 1e-12
        best, idx = 0.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / norm
            if d > best:
                best, idx = d, i
        if best > tol and idx > 0:
            keep[idx] = True
            stack.append((a, idx))
            stack.append((idx, b))
    return [p for p, k in zip(pts, keep) if k]


def length_m(pts):
    total = 0.0
    for i in range(1, len(pts)):
        (a, b), (c, d) = pts[i - 1], pts[i]
        dx = (c - a) * 111320.0 * math.cos(math.radians(b))
        dy = (d - b) * 111320.0
        total += math.hypot(dx, dy)
    return total


reader = shapefile.Reader(SHP)
lines = []
for shape in reader.shapes():
    pts = [(round(x, 5), round(y, 5)) for x, y in shape.points]
    parts = list(shape.parts) + [len(pts)]
    for i in range(len(parts) - 1):
        part = pts[parts[i]:parts[i + 1]]
        if len(part) < 2:
            continue
        simp = rdp(part, TOL)
        if len(simp) < 2:
            continue
        if length_m(simp) < MINLEN:
            continue
        longest = 0.0
        for k in range(1, len(simp)):
            (ax, ay), (bx, by) = simp[k - 1], simp[k]
            dx = (bx - ax) * 111320.0 * math.cos(math.radians(ay))
            dy = (by - ay) * 111320.0
            longest = max(longest, math.hypot(dx, dy))
        if longest > MAXSEG:
            continue
        lines.append([[a, b] for a, b in simp])

doc = {"v": 1, "source": "Natural Earth 1:10m railroads", "count": len(lines), "lines": lines}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(doc, f, separators=(",", ":"))
print(f"shapes {len(reader.shapes())} -> lines {len(lines)} / {os.path.getsize(OUT) / 1048576:.2f} MB")
