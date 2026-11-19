import json
import math
import os
import sys

import shapefile

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "app", "public", "data")
SHP = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.environ.get("TEMP", ""), "ne_urban", "ne_10m_urban_areas.shp")
OUT = os.path.join(DATA, "urban_world.json")

TOL = 0.0015
MINAREA = 0.0008


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


def area(ring):
    total = 0.0
    for i in range(len(ring)):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % len(ring)]
        total += x1 * y2 - x2 * y1
    return abs(total) / 2.0


reader = shapefile.Reader(SHP)
polys = []
for shape in reader.shapes():
    pts = [(round(x, 4), round(y, 4)) for x, y in shape.points]
    parts = list(shape.parts) + [len(pts)]
    for i in range(len(parts) - 1):
        ring = pts[parts[i]:parts[i + 1]]
        if len(ring) < 4:
            continue
        closed = ring[0] == ring[-1]
        open_ring = ring[:-1] if closed else ring
        simp = rdp(open_ring, TOL)
        if simp:
            simp = simp + [simp[0]]
        if len(simp) < 4:
            continue
        if area(simp) < MINAREA:
            continue
        signed = 0.0
        for i in range(len(simp) - 1):
            x1, y1 = simp[i]
            x2, y2 = simp[i + 1]
            signed += x1 * y2 - x2 * y1
        ring_out = list(reversed(simp)) if signed < 0 else list(simp)
        polys.append([[a, b] for a, b in ring_out])

doc = {"v": 1, "source": "Natural Earth 1:10m urban areas", "count": len(polys), "polys": polys}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(doc, f, separators=(",", ":"))
print(f"rings {len(polys)} / {os.path.getsize(OUT) / 1048576:.2f} MB")
