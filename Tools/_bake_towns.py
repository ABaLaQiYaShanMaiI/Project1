import pathlib
import re

p = pathlib.Path(r"E:\PersonalGame\Project1\Tools\bake_map.py")
s = p.read_text(encoding="utf-8")

start = s.find("    MIN_TOWN_R = 600")
end = s.find("    log(\"towns\", len(towns),")
assert start > 0 and end > start, (start, end)

new_block = '''    GRID = 80.0
    gw = int(SPAN_X / GRID) + 1
    gh = int(SPAN_Y / GRID) + 1
    urban = np.zeros((gh, gw), dtype=bool)

    def cell_ij(x, y):
        i = int((x / SPAN_X + 0.5) * (gw - 1))
        j = int((0.5 - y / SPAN_Y) * (gh - 1))
        return i, j

    def raster_poly(pts):
        ys = [p[1] for p in pts]
        j0 = max(0, int((0.5 - max(ys) / SPAN_Y) * (gh - 1)))
        j1 = min(gh - 1, int((0.5 - min(ys) / SPAN_Y) * (gh - 1)) + 1)
        n = len(pts)
        for j in range(j0, j1 + 1):
            cy = (0.5 - j / (gh - 1)) * SPAN_Y
            xs = []
            for k in range(n):
                x1, y1 = pts[k]
                x2, y2 = pts[(k + 1) % n]
                if (y1 > cy) != (y2 > cy):
                    xs.append(x1 + (cy - y1) * (x2 - x1) / (y2 - y1))
            if len(xs) < 2:
                continue
            xs.sort()
            for a in range(0, len(xs) - 1, 2):
                i0 = max(0, int((xs[a] / SPAN_X + 0.5) * (gw - 1)) + 1)
                i1 = min(gw - 1, int((xs[a + 1] / SPAN_X + 0.5) * (gw - 1)))
                if i1 >= i0:
                    urban[j, i0:i1 + 1] = True

    for pts in builtup_polys:
        if poly_area_centroid(pts)[0] >= 1500:
            raster_poly(pts)

    def shift(m, dj, di):
        out = np.zeros_like(m)
        js = slice(max(0, dj), gh + min(0, dj))
        jd = slice(max(0, -dj), gh + min(0, -dj))
        is_ = slice(max(0, di), gw + min(0, di))
        id_ = slice(max(0, -di), gw + min(0, -di))
        out[jd, id_] = m[js, is_]
        return out

    for _ in range(2):
        d = urban | shift(urban, 1, 0) | shift(urban, -1, 0) | shift(urban, 0, 1) | shift(urban, 0, -1)
        urban = d
    for _ in range(2):
        e = urban & shift(urban, 1, 0) & shift(urban, -1, 0) & shift(urban, 0, 1) & shift(urban, 0, -1)
        urban = e

    cell_area_km2 = (GRID * GRID) / 1e6

    def component(si, sj):
        if not urban[sj, si]:
            found = None
            for r in range(1, 12):
                for dj in range(-r, r + 1):
                    for di in range(-r, r + 1):
                        j, i = sj + dj, si + di
                        if 0 <= i < gw and 0 <= j < gh and urban[j, i]:
                            found = (i, j)
                            break
                    if found:
                        break
                if found:
                    break
            if not found:
                return None
            si, sj = found
        seen = np.zeros_like(urban)
        stack = [(si, sj)]
        seen[sj, si] = True
        cells = []
        while stack:
            i, j = stack.pop()
            cells.append((i, j))
            for dj, di in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                jj, ii = j + dj, i + di
                if 0 <= ii < gw and 0 <= jj < gh and urban[jj, ii] and not seen[jj, ii]:
                    seen[jj, ii] = True
                    stack.append((ii, jj))
        return cells

    def cell_xy(i, j):
        x = (i / (gw - 1) - 0.5) * SPAN_X
        y = (0.5 - j / (gh - 1)) * SPAN_Y
        return x, y

    towns = []
    for c in cities:
        if c["radius"] < 600:
            continue
        si, sj = cell_ij(c["x"], c["y"])
        cells = component(si, sj)
        if not cells or len(cells) < 12:
            continue
        pts = [cell_xy(i, j) for i, j in cells]
        cx, cy = c["x"], c["y"]
        sxx = syy = sxy = 0.0
        for x, y in pts:
            dx, dy = x - cx, y - cy
            sxx += dx * dx
            syy += dy * dy
            sxy += dx * dy
        theta = 0.5 * math.atan2(2 * sxy, sxx - syy)
        ux, uy = math.cos(theta), math.sin(theta)
        ts = [(x - cx) * ux + (y - cy) * uy for x, y in pts]
        ss = [-(x - cx) * uy + (y - cy) * ux for x, y in pts]
        tmin, tmax = min(ts), max(ts)
        smin, smax = min(ss), max(ss)
        length = tmax - tmin
        width = max(1.0, smax - smin)
        elong = length / width
        r = max(math.hypot(x - cx, y - cy) for x, y in pts)
        area_km2 = len(cells) * cell_area_km2

        if r < 1000:
            kind = "parcel"
            districts = [{
                "label": "城区（单地块）",
                "shape": "core",
                "r0": 0.0, "r1": round(r, 1), "a0": 0.0, "a1": round(2 * math.pi, 4),
                "t0": round(tmin, 1), "t1": round(tmax, 1),
                "area": round(area_km2, 2),
                "frontage": round(max(1.0, min(8.0, area_km2 * 0.55)) * 2) / 2,
                "defense": 2,
            }]
            coreR = 0.0
        elif elong < 1.55:
            kind = "radial"
            coreR = r * 0.42
            districts = []
            core_cells = 0
            for (x, y) in pts:
                if math.hypot(x - cx, y - cy) <= coreR:
                    core_cells += 1
            a_core = core_cells * cell_area_km2
            districts.append({
                "label": "核心区",
                "shape": "core",
                "r0": 0.0, "r1": round(coreR, 1), "a0": 0.0, "a1": round(2 * math.pi, 4),
                "t0": round(tmin, 1), "t1": round(tmax, 1),
                "area": round(a_core, 2),
                "frontage": round(max(1.0, min(8.0, a_core * 0.55)) * 2) / 2,
                "defense": 4,
            })
            names = ["东扇区", "北扇区", "西扇区", "南扇区"]
            sector_areas = [[], [], [], []]
            sector_r = [0.0, 0.0, 0.0, 0.0]
            for (x, y) in pts:
                dx, dy = x - cx, y - cy
                d = math.hypot(dx, dy)
                if d <= coreR:
                    continue
                ang = (math.degrees(math.atan2(dy, dx)) + 360.0) % 360.0
                k = int(((ang + 45.0) % 360.0) // 90.0)
                sector_areas[k].append(1)
                if d > sector_r[k]:
                    sector_r[k] = d
            for k in range(4):
                a = len(sector_areas[k]) * cell_area_km2
                districts.append({
                    "label": names[k],
                    "shape": "wedge",
                    "r0": round(coreR, 1), "r1": round(max(sector_r[k], coreR + 50), 1),
                    "a0": round((-45 + k * 90) * math.pi / 180, 4),
                    "a1": round((45 + k * 90) * math.pi / 180, 4),
                    "t0": round(tmin, 1), "t1": round(tmax, 1),
                    "area": round(a, 2),
                    "frontage": round(max(1.0, min(8.0, a * 0.55)) * 2) / 2,
                    "defense": 3,
                })
        else:
            kind = "band"
            coreR = 0.0
            n = max(2, min(5, int(math.ceil(length / 1800.0))))
            step = length / n
            districts = []
            for b in range(n):
                t0 = tmin + step * b
                t1 = t0 + step
                cnt = 0
                for (x, y) in pts:
                    tt = (x - cx) * ux + (y - cy) * uy
                    if t0 <= tt < t1:
                        cnt += 1
                a = cnt * cell_area_km2
                districts.append({
                    "label": "第 %d 段" % (b + 1),
                    "shape": "band",
                    "r0": 0.0, "r1": round(r, 1), "a0": 0.0, "a1": 0.0,
                    "t0": round(t0, 1), "t1": round(t1, 1),
                    "area": round(a, 2),
                    "frontage": round(max(1.0, min(8.0, a * 0.55)) * 2) / 2,
                    "defense": 3,
                })

        towns.append({
            "id": "T%03d" % len(towns),
            "n": c["n"],
            "x": round(cx, 1),
            "y": round(cy, 1),
            "kind": kind,
            "r": round(r, 1),
            "coreR": round(coreR, 1),
            "axis": [round(ux, 4), round(uy, 4)],
            "box": [round(tmin, 1), round(tmax, 1), round(smin, 1), round(smax, 1)],
            "elong": round(elong, 2),
            "area": round(area_km2, 2),
            "pop": c["pop"],
            "districts": districts,
        })

'''

s = s[:start] + new_block + s[end:]

s = s.replace(
    '    log("towns", len(towns),\n        "kind", {k: sum(1 for t in towns if t["kind"] == k) for k in ("parcel", "town")})',
    '    log("towns", len(towns),\n        "kind", {k: sum(1 for t in towns if t["kind"] == k) for k in ("parcel", "radial", "band")})',
)

p.write_text(s, encoding="utf-8")
print("town block replaced")
