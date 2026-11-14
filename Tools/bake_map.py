import json
import math
import os
import time

import numpy as np
import requests
from PIL import Image
from io import BytesIO

CENTER_LAT = 50.62
CENTER_LON = 9.72
COLS = 20
ROWS = 15
HEX_SIZE = 3200.0
Z = 10
WORKERS = 10
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".tile-cache")
CACHE_KEY = "fulda"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "..", "app", "public", "data", "map_fulda.json")

M_PER_DEG_LAT = 110540.0
M_PER_DEG_LON = 111320.0 * math.cos(math.radians(CENTER_LAT))

UA = {"User-Agent": "HexWargame-BakeTool/0.1 (offline map baking for personal project)"}

SPAN_X = HEX_SIZE * math.sqrt(3) * (COLS + 0.5)
SPAN_Y = HEX_SIZE * 1.5 * ROWS
PAD = 6000.0

def m2ll(x, y):
    return CENTER_LAT + y / M_PER_DEG_LAT, CENTER_LON + x / M_PER_DEG_LON

def ll2m(lat, lon):
    return (lon - CENTER_LON) * M_PER_DEG_LON, (lat - CENTER_LAT) * M_PER_DEG_LAT

BBOX = {
    "south": CENTER_LAT - (SPAN_Y / 2 + PAD) / M_PER_DEG_LAT,
    "north": CENTER_LAT + (SPAN_Y / 2 + PAD) / M_PER_DEG_LAT,
    "west": CENTER_LON - (SPAN_X / 2 + PAD) / M_PER_DEG_LON,
    "east": CENTER_LON + (SPAN_X / 2 + PAD) / M_PER_DEG_LON,
}

def log(*a):
    print(f"[bake {time.strftime('%H:%M:%S')}]", *a, flush=True)

NAME = "富尔达缺口 Fulda Gap"

def configure(lat, lon, span_x, span_y, name, title=""):
    global CENTER_LAT, CENTER_LON, SPAN_X, SPAN_Y, M_PER_DEG_LON, BBOX, OUT, NAME, CACHE_KEY
    CENTER_LAT, CENTER_LON = lat, lon
    SPAN_X, SPAN_Y = span_x, span_y
    M_PER_DEG_LON = 111320.0 * math.cos(math.radians(lat))
    CACHE_KEY = name
    NAME = "富尔达缺口 Fulda Gap" if name == "fulda" else name
    if title:
        NAME = title
    BBOX = {
        "south": CENTER_LAT - (SPAN_Y / 2 + PAD) / M_PER_DEG_LAT,
        "north": CENTER_LAT + (SPAN_Y / 2 + PAD) / M_PER_DEG_LAT,
        "west": CENTER_LON - (SPAN_X / 2 + PAD) / M_PER_DEG_LON,
        "east": CENTER_LON + (SPAN_X / 2 + PAD) / M_PER_DEG_LON,
    }
    OUT = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "..", "app", "public", "data", f"map_{name}.json",
    )
    log(f"region: {NAME} center=({lat},{lon}) span={span_x/1000:.0f}x{span_y/1000:.0f}km")

def lonlat_to_global_px(lat, lon, z):
    n = 2 ** z
    px = (lon + 180.0) / 360.0 * n * 256.0
    lat_r = math.radians(lat)
    py = (1.0 - math.asinh(math.tan(lat_r)) / math.pi) / 2.0 * n * 256.0
    return px, py

def fetch(url, tries=4):
    last = None
    for i in range(tries):
        try:
            r = requests.get(url, headers=UA, timeout=120)
            if r.status_code == 200:
                return r.content
            last = f"HTTP {r.status_code}"
        except Exception as e:
            last = str(e)
        time.sleep(1.5 * (i + 1))
    raise RuntimeError(f"fetch failed {url}: {last}")

def build_dem():
    x0, y0 = lonlat_to_global_px(BBOX["north"], BBOX["west"], Z)
    x1, y1 = lonlat_to_global_px(BBOX["south"], BBOX["east"], Z)
    tx0, tx1 = int(x0 // 256), int(x1 // 256)
    ty0, ty1 = int(y0 // 256), int(y1 // 256)
    nx, ny = tx1 - tx0 + 1, ty1 - ty0 + 1
    total = nx * ny
    log(f"DEM tiles z{Z}: {nx}x{ny} = {total} tiles (并发 {WORKERS})")

    import concurrent.futures as cf

    os.makedirs(CACHE, exist_ok=True)
    mosaic = np.zeros((ny * 256, nx * 256), dtype=np.float32)
    done = [0]
    ok = [0]
    bad = np.zeros((ny, nx), dtype=bool)

    def load(i, j):
        key = f"z{Z}_{tx0+i}_{ty0+j}.png"
        path = os.path.join(CACHE, key)
        if os.path.exists(path):
            return i, j, open(path, "rb").read(), True
        url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{tx0+i}/{ty0+j}.png"
        data = fetch(url)
        with open(path, "wb") as f:
            f.write(data)
        return i, j, data, False

    def decode(data):
        a = np.asarray(Image.open(BytesIO(data)).convert("RGB")).astype(np.float32)
        return (a[:, :, 0] * 256.0 + a[:, :, 1] + a[:, :, 2] / 256.0) - 32768.0

    with cf.ThreadPoolExecutor(WORKERS) as ex:
        futs = [ex.submit(load, i, j) for j in range(ny) for i in range(nx)]
        for fut in cf.as_completed(futs):
            try:
                i, j, data, cached = fut.result()
                mosaic[j * 256:(j + 1) * 256, i * 256:(i + 1) * 256] = decode(data)
                ok[0] += 1
            except Exception as e:
                log(f"  tile failed: {e}")
                try:
                    bad[j, i] = True
                except Exception:
                    pass
            done[0] += 1
            if done[0] % 3 == 0 or done[0] == total:
                log(f"  {done[0]}/{total} tiles ok={ok[0]}")
    if ok[0] == 0:
        raise RuntimeError("所有 DEM 瓦片都下载失败")

    if bad.any():
        mask = np.ones(mosaic.shape, dtype=bool)
        for j in range(ny):
            for i in range(nx):
                if bad[j, i]:
                    mask[j * 256:(j + 1) * 256, i * 256:(i + 1) * 256] = False
        if mask.any():
            mosaic[~mask] = float(mosaic[mask].mean())
            log(f"  filled {int(bad.sum())} failed tile(s) with mean elevation")
    log(f"DEM ok: {ok[0]}/{total} tiles, range {float(mosaic.min()):.0f}-{float(mosaic.max()):.0f}")
    return mosaic, tx0 * 256, ty0 * 256

def sample_dem(mosaic, ox, oy, lat, lon):
    px, py = lonlat_to_global_px(lat, lon, Z)
    u, v = px - ox, py - oy
    h, w = mosaic.shape
    u = min(max(u, 1), w - 2)
    v = min(max(v, 1), h - 2)
    x0, y0 = int(u), int(v)
    fu, fv = u - x0, v - y0
    a = mosaic[y0, x0] * (1 - fu) + mosaic[y0, x0 + 1] * fu
    b = mosaic[y0 + 1, x0] * (1 - fu) + mosaic[y0 + 1, x0 + 1] * fu
    return float(a * (1 - fv) + b * fv)

def hex_center_m(col, row):
    x = HEX_SIZE * math.sqrt(3) * (col + 0.5 * (row & 1))
    y = HEX_SIZE * 1.5 * row
    return x - SPAN_X / 2, -(y - SPAN_Y / 2)

def offset_to_axial(col, row):
    return col - (row - (row & 1)) // 2, row

def point_to_hex(x, y):
    yy = (-y) + SPAN_Y / 2
    xx = x + SPAN_X / 2
    row = int(round(yy / (HEX_SIZE * 1.5)))
    row = max(0, min(ROWS - 1, row))
    colf = (xx - 0.5 * (row & 1) * HEX_SIZE * math.sqrt(3)) / (HEX_SIZE * math.sqrt(3))
    col = int(round(colf))
    col = max(0, min(COLS - 1, col))
    return col, row

def hex_corners_m(col, row):
    cx, cy = hex_center_m(col, row)
    pts = []
    for k in range(6):
        ang = math.radians(60 * k - 30)
        pts.append((cx + HEX_SIZE * math.cos(ang), cy + HEX_SIZE * math.sin(ang)))
    return pts

def point_in_poly(x, y, poly):
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi):
            inside = not inside
        j = i
    return inside

OVERPASS = "https://overpass-api.de/api/interpreter"
OVERPASS_MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

def overpass_cached(tag, query, tries=2):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f"osm_{CACHE_KEY}_{tag}.json")
    if os.path.exists(path):
        try:
            log(f"  {tag}: cache hit")
            return json.load(open(path, encoding="utf-8"))
        except Exception:
            pass
    data = overpass(query, tries)
    if data.get("elements"):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
    return data

def overpass(query, tries=2):
    for i in range(tries):
        url = OVERPASS_MIRRORS[i % len(OVERPASS_MIRRORS)]
        t0 = time.time()
        try:
            r = requests.post(url, data={"data": query}, headers=UA, timeout=240)
            if r.status_code == 200:
                log(f"    overpass {r.status_code} {len(r.content)/1024:.0f}KB in {time.time()-t0:.1f}s")
                return r.json()
            log(f"    overpass HTTP {r.status_code} from {url.split('/')[2]} in {time.time()-t0:.1f}s")
        except Exception as e:
            log(f"    overpass err: {e}")
        time.sleep(2 * (i + 1))
    return {"elements": []}

def bbox_str():
    return f'{BBOX["south"]:.5f},{BBOX["west"]:.5f},{BBOX["north"]:.5f},{BBOX["east"]:.5f}'

def q_roads():
    return f"""[out:json][timeout:180];
(
  way["highway"~"^(motorway|trunk|primary)$"]({bbox_str()});
);
out geom;"""

def q_rivers():
    return f"""[out:json][timeout:180];
(
  way["waterway"~"^(river|canal)$"]({bbox_str()});
);
out geom;"""

def q_places():
    return f"""[out:json][timeout:120];
(
  node["place"~"^(city|town|village)$"]({bbox_str()});
);
out;"""

def q_water():
    return f"""[out:json][timeout:180];
(
  wr["natural"="water"]({bbox_str()});
);
out geom;"""

def q_forest(bb=None):
    b = bb or bbox_str()
    return f"""[out:json][timeout:240];
(
  wr["landuse"="forest"]({b});
);
out geom;"""

def q_minor():
    return f"""[out:json][timeout:300];
(
  way["highway"~"^(residential|service|unclassified|living_street|pedestrian)$"]({bbox_str()});
);
out geom;"""

def q_builtup(bb=None):
    b = bb or bbox_str()
    return f"""[out:json][timeout:240];
(
  wr["landuse"~"^(residential|commercial|industrial)$"]({b});
);
out geom;"""

def split_bbox(nx=2, ny=2):
    lats = [BBOX["south"] + (BBOX["north"] - BBOX["south"]) * i / ny for i in range(ny + 1)]
    lons = [BBOX["west"] + (BBOX["east"] - BBOX["west"]) * i / nx for i in range(nx + 1)]
    out = []
    for j in range(ny):
        for i in range(nx):
            out.append(f"{lats[j]:.5f},{lons[i]:.5f},{lats[j+1]:.5f},{lons[i+1]:.5f}")
    return out

def polygons_of(el):
    out = []
    if el.get("type") == "relation":
        for m in el.get("members", []):
            if m.get("role") not in ("outer", "", None):
                continue
            g = m.get("geometry") or []
            pts = [ll2m(p["lat"], p["lon"]) for p in g if "lat" in p]
            if len(pts) >= 4:
                out.append(pts)
    else:
        pts = way_to_m(el)
        if len(pts) >= 4:
            out.append(pts)
    return out

def simplify(pts, tol):
    if len(pts) < 3:
        return pts
    ax, ay = pts[0]
    bx, by = pts[-1]
    dx, dy = bx - ax, by - ay
    norm = math.hypot(dx, dy)
    idx, best = -1, 0.0
    for i in range(1, len(pts) - 1):
        px, py = pts[i]
        if norm < 1e-9:
            d = math.hypot(px - ax, py - ay)
        else:
            d = abs(dy * (px - ax) - dx * (py - ay)) / norm
        if d > best:
            best, idx = d, i
    if best <= tol:
        return [pts[0], pts[-1]]
    return simplify(pts[: idx + 1], tol)[:-1] + simplify(pts[idx:], tol)

def way_to_m(elem):
    geo = elem.get("geometry") or []
    out = []
    for g in geo:
        if g and "lat" in g:
            out.append(ll2m(g["lat"], g["lon"]))
    return out

def path_length(pts):
    return sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1))

def poly_area_centroid(pts):
    a = cx = cy = 0.0
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        cross = x1 * y2 - x2 * y1
        a += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    a *= 0.5
    if abs(a) < 1e-9:
        return 0.0, pts[0]
    return abs(a), (cx / (6 * a), cy / (6 * a))

def main():
    import argparse

    ap = argparse.ArgumentParser(description="烘焙任意区域的战场地图")
    ap.add_argument("--center", default="50.62,9.72", help="中心经纬度, 例 50.62,9.72")
    ap.add_argument("--span-km", default="111,72", help="东西,南北 跨度(km), 例 111,72")
    ap.add_argument("--name", default="fulda", help="区域名（输出 map_<name>.json）")
    ap.add_argument("--title", default="", help="显示名称，默认同 --name")
    args = ap.parse_args()
    lat, lon = [float(x) for x in args.center.split(",")]
    sx, sy = [float(x) * 1000.0 for x in args.span_km.split(",")]
    configure(lat, lon, sx, sy, args.name, args.title)

    t0 = time.time()
    log("bbox", {k: round(v, 4) for k, v in BBOX.items()})

    dem, ox, oy = build_dem()
    log("DEM ok, range", round(float(dem.min())), "-", round(float(dem.max())))

    log("query roads ...")
    KEEP_ROADS = {"motorway", "trunk", "primary", "secondary"}
    TOL = {"motorway": 20.0, "trunk": 20.0, "primary": 25.0, "secondary": 35.0}
    roads = []
    for el in overpass_cached("roads", q_roads()).get("elements", []):
        cls = el.get("tags", {}).get("highway", "road")
        if cls not in KEEP_ROADS:
            continue
        pts = way_to_m(el)
        if len(pts) < 2:
            continue

        pts = simplify(pts, TOL.get(cls, 30.0))
        if len(pts) < 2:
            continue
        roads.append({"c": cls, "p": pts})
    log("  roads", len(roads))

    log("query rivers ...")
    rivers = []
    for el in overpass_cached("rivers", q_rivers()).get("elements", []):
        pts = way_to_m(el)
        if len(pts) < 2:
            continue
        if path_length(pts) < 600:
            continue
        rivers.append({"p": simplify(pts, 90.0)})
    log("  rivers", len(rivers))

    log("query water ...")
    water = []
    for el in overpass_cached("water2", q_water()).get("elements", []):
        for pts in polygons_of(el):
            area, _ = poly_area_centroid(pts)
            if area < 400e3:
                continue
            water.append({"p": simplify(pts, 60.0)})
    log("  water polys", len(water))

    log("query forest ...")
    forest = []

    for idx, bb in enumerate(split_bbox(2, 2)):
        part = overpass_cached(f"forest_{idx}", q_forest(bb), tries=3)
        n0 = len(forest)
        for el in part.get("elements", []):
            for pts in polygons_of(el):
                area, _ = poly_area_centroid(pts)
                if area < 1.0e6:
                    continue
                forest.append({"p": simplify(pts, 120.0)})
        log(f"  forest part {idx}: +{len(forest)-n0}")
    log("  forest polys", len(forest))

    log("query places ...")
    cities = []
    for el in overpass_cached("places", q_places(), tries=3).get("elements", []):
        tags = el.get("tags", {})
        pop = 0
        try:
            pop = int(str(tags.get("population", "0")).replace(",", "").strip() or 0)
        except Exception:
            pop = 0
        cities.append({
            "n": tags.get("name", "?"),
            "r": tags.get("place", "village"),
            "lat": el["lat"],
            "lon": el["lon"],
            "x": round(ll2m(el["lat"], el["lon"])[0], 1),
            "y": round(ll2m(el["lat"], el["lon"])[1], 1),
            "pop": pop,
        })
    cities.sort(key=lambda c: {"city": 0, "town": 1, "village": 2}.get(c["r"], 3))
    log("  places", len(cities))

    log("sampling hexes ...")
    hexes = []
    road_pts = []
    CLASS_W = {"motorway": 3.0, "motorway_link": 2.0, "trunk": 2.4,
               "primary": 1.7, "secondary": 1.0}
    for rd in roads:
        w = CLASS_W.get(rd["c"], 1.0)
        pts = rd["p"]
        for i in range(len(pts) - 1):
            (ax, ay), (bx, by) = pts[i], pts[i + 1]
            seg = math.hypot(bx - ax, by - ay)
            steps = max(1, int(seg // 300))
            for s in range(steps):
                t = (s + 0.5) / steps
                road_pts.append((ax + (bx - ax) * t, ay + (by - ay) * t, seg / steps / 1000.0, rd["c"]))

    wbb = []
    for poly in water:
        ys = [p[1] for p in poly["p"]]
        xs = [p[0] for p in poly["p"]]
        wbb.append((min(xs), min(ys), max(xs), max(ys), poly["p"]))
    fbb = []
    for poly in forest:
        ys = [p[1] for p in poly["p"]]
        xs = [p[0] for p in poly["p"]]
        fbb.append((min(xs), min(ys), max(xs), max(ys), poly["p"]))

    def frac_cover(bb, cx, cy, r):
        hit = 0
        total = 0

        for k in range(6):
            ang = math.radians(60 * k)
            for rr in (0.55, 0.85):
                total += 1
                px, py = cx + rr * r * math.cos(ang), cy + rr * r * math.sin(ang)
                for (x0, y0, x1, y1, poly) in bb:
                    if x0 <= px <= x1 and y0 <= py <= y1 and point_in_poly(px, py, poly):
                        hit += 1
                        break
        total += 1
        for (x0, y0, x1, y1, poly) in bb:
            if x0 <= cx <= x1 and y0 <= cy <= y1 and point_in_poly(cx, cy, poly):
                hit += 1
                break
        return hit / total

    log("query minor streets ...")
    minor = []
    for el in overpass_cached("minor", q_minor(), tries=3).get("elements", []):
        pts = way_to_m(el)
        if len(pts) >= 2:
            minor.append(pts)
    log("  minor streets", len(minor))

    log("query built-up ...")
    builtup_polys = []
    for idx, bb in enumerate(split_bbox(2, 2)):
        part = overpass_cached(f"builtup_{idx}", q_builtup(bb), tries=3)
        n0 = len(builtup_polys)
        for el in part.get("elements", []):
            for pts in polygons_of(el):
                area, _ = poly_area_centroid(pts)
                if area < 20e3:
                    continue
                builtup_polys.append(pts)
        log(f"  builtup part {idx}: +{len(builtup_polys)-n0}")
    log("  builtup polys", len(builtup_polys))

    RANK_SCORE = {"city": 3, "town": 2, "village": 1}
    built_area = {}
    built_polys = {}
    for pts in builtup_polys:
        area, (pcx, pcy) = poly_area_centroid(pts)
        best, bestscore = None, -1
        for c in cities:
            d = math.hypot(c["x"] - pcx, c["y"] - pcy)
            if d > 4000:
                continue
            score = RANK_SCORE.get(c["r"], 0) * 10 - d / 1000.0
            if score > bestscore:
                best, bestscore = c, score
        if best is None:
            continue
        built_area[best["n"]] = built_area.get(best["n"], 0.0) + area

        if area >= 9000:
            built_polys.setdefault(best["n"], []).append((area, pts))

    RANK_FLOOR = {"city": 1500.0, "town": 950.0}
    for c in cities:
        a = built_area.get(c["n"], 0.0)
        r = math.sqrt(a / math.pi) if a > 0 else 0.0
        c["radius"] = int(round(max(r, RANK_FLOOR.get(c["r"], 0.0))))
        c["pop"] = int(c.get("pop") or 0)

    gc, gr = 256, 192
    cover = bytearray(gc * gr)

    def rasterize(polys, code):
        for pts in polys:
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            x0, x1 = min(xs), max(xs)
            y0, y1 = min(ys), max(ys)
            if x1 < -SPAN_X / 2 or x0 > SPAN_X / 2 or y1 < -SPAN_Y / 2 or y0 > SPAN_Y / 2:
                continue
            i0 = max(0, int((x0 / SPAN_X + 0.5) * (gc - 1)) - 1)
            i1 = min(gc - 1, int((x1 / SPAN_X + 0.5) * (gc - 1)) + 1)
            j0 = max(0, int((0.5 - y1 / SPAN_Y) * (gr - 1)) - 1)
            j1 = min(gr - 1, int((0.5 - y0 / SPAN_Y) * (gr - 1)) + 1)
            for j in range(j0, j1 + 1):
                cy = (0.5 - j / (gr - 1)) * SPAN_Y
                for i in range(i0, i1 + 1):
                    cx = (i / (gc - 1) - 0.5) * SPAN_X
                    if point_in_poly(cx, cy, pts):
                        cover[j * gc + i] = code

    rasterize([f["p"] for f in forest], 1)
    rasterize(builtup_polys, 2)
    rasterize([w["p"] for w in water], 3)
    log("landcover raster", gc, "x", gr,
        {k: sum(1 for v in cover if v == k) for k in range(4)})

    GRID = 80.0
    gw = int(SPAN_X / GRID) + 1
    gh = int(SPAN_Y / GRID) + 1
    urban = np.zeros((gh, gw), dtype=bool)
    hits = np.zeros((gh, gw), dtype=np.int16)

    def cell_ij(x, y):
        i = int((x / SPAN_X + 0.5) * (gw - 1))
        j = int((0.5 - y / SPAN_Y) * (gh - 1))
        return min(max(i, 0), gw - 1), min(max(j, 0), gh - 1)

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

    def raster_line(pts):
        for k in range(len(pts) - 1):
            x1, y1 = pts[k]
            x2, y2 = pts[k + 1]
            seg = math.hypot(x2 - x1, y2 - y1)
            steps = max(1, int(seg // (GRID * 0.5)))
            for t in range(steps + 1):
                f = t / steps
                x = x1 + (x2 - x1) * f
                y = y1 + (y2 - y1) * f
                i = int((x / SPAN_X + 0.5) * (gw - 1))
                j = int((0.5 - y / SPAN_Y) * (gh - 1))
                if 0 <= i < gw and 0 <= j < gh:
                    hits[j, i] += 1

    for pts in minor:
        raster_line(pts)
    urban = hits >= 4
    for pts in builtup_polys:
        a = poly_area_centroid(pts)[0]
        if 1500 <= a <= 2.0e6:
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

    from PIL import Image as _Img

    _mask = _Img.new("RGBA", (gw, gh), (0, 0, 0, 0))
    _px = _mask.load()
    for _j in range(gh):
        for _i in range(gw):
            if urban[_j, _i]:
                _px[_i, _j] = (126, 112, 100, 120)
    _out = os.path.join(os.path.dirname(OUT), f"urban_mask_{CACHE_KEY}.png")
    _mask.save(_out, optimize=True)
    log("urban mask", gw, "x", gh, os.path.getsize(_out) // 1024, "KB")

    def component(si, sj, cx, cy, rmax=4800.0):
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
            x, y = cell_xy(i, j)
            if math.hypot(x - cx, y - cy) > rmax:
                continue
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
        cells = component(si, sj, c["x"], c["y"])
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
        dists = sorted(math.hypot(x - cx, y - cy) for x, y in pts)
        r = float(np.percentile(dists, 95))
        area_km2 = len(cells) * cell_area_km2

        if r < 1000:
            kind = "parcel"
            districts = [{
                "label": "城区（单地块）",
                "shape": "core",
                "r0": 0.0, "r1": round(r, 1), "a0": 0.0, "a1": round(2 * math.pi, 4),
                "t0": round(tmin, 1), "t1": round(tmax, 1),
                "area": round(area_km2, 2),
                "frontage": round(max(1.0, min(8.0, area_km2 * 0.8)) * 2) / 2,
                "defense": 2,
            }]
            coreR = 0.0
        elif elong < 1.55:
            kind = "radial"
            coreR = float(np.percentile(dists, 42))
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
                "frontage": round(max(1.0, min(8.0, a_core * 0.8)) * 2) / 2,
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
                    "frontage": round(max(1.0, min(8.0, a * 0.8)) * 2) / 2,
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
                    "frontage": round(max(1.0, min(8.0, a * 0.8)) * 2) / 2,
                    "defense": 3,
                })

        sums = [[0.0, 0.0, 0] for _ in districts]
        for (x, y) in pts:
            dxs, dys = x - cx, y - cy
            for k, d in enumerate(districts):
                ok = False
                if d["shape"] == "core":
                    ok = math.hypot(dxs, dys) <= d["r1"]
                elif d["shape"] == "wedge":
                    dd = math.hypot(dxs, dys)
                    ang = (math.degrees(math.atan2(dys, dxs)) + 360.0) % 360.0
                    a0 = (math.degrees(d["a0"]) + 360.0) % 360.0
                    a1 = (math.degrees(d["a1"]) + 360.0) % 360.0
                    inside = (a0 <= ang <= a1) if a0 <= a1 else (ang >= a0 or ang <= a1)
                    ok = inside and d["r0"] <= dd <= d["r1"]
                elif d["shape"] == "band":
                    tt = dxs * ux + dys * uy
                    ok = d["t0"] <= tt <= d["t1"]
                else:
                    ok = True
                if ok:
                    sums[k][0] += x
                    sums[k][1] += y
                    sums[k][2] += 1
        for k, d in enumerate(districts):
            if sums[k][2] > 0:
                d["cp"] = [round(sums[k][0] / sums[k][2], 1), round(sums[k][1] / sums[k][2], 1)]
            else:
                d["cp"] = [round(cx, 1), round(cy, 1)]

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

    log("towns", len(towns),
        "kind", {k: sum(1 for t in towns if t["kind"] == k) for k in ("parcel", "radial", "band")})

    dem_grid = []
    for j in range(gr):
        for i in range(gc):
            x = (i / (gc - 1) - 0.5) * SPAN_X
            y = (0.5 - j / (gr - 1)) * SPAN_Y
            lat, lon = m2ll(x, y)
            dem_grid.append(int(round(sample_dem(dem, ox, oy, lat, lon))))
    log("dem grid", gc, "x", gr)

    def pack_line(pts_m, prec=5):
        return [[round(m2ll(x, y)[1], prec), round(m2ll(x, y)[0], prec)] for (x, y) in pts_m]

    payload = {
        "meta": {
            "name": NAME,
            "generated": time.strftime("%Y-%m-%d %H:%M"),
            "center": [CENTER_LAT, CENTER_LON],
            "projection": {"lon0": CENTER_LON, "lat0": CENTER_LAT,
                           "mPerDegLon": round(M_PER_DEG_LON, 3),
                           "mPerDegLat": round(M_PER_DEG_LAT, 3)},
            "spanM": [round(SPAN_X, 1), round(SPAN_Y, 1)],
            "bbox": {k: round(v, 5) for k, v in BBOX.items()},
            "dem": {"cols": gc, "rows": gr, "values": dem_grid},

            "landcover": {"cols": gc, "rows": gr, "values": list(cover)},
            "urbanMask": {"file": f"urban_mask_{CACHE_KEY}.png", "cols": gw, "rows": gh},
            "attribution": "高程: SRTM/AWS Terrain Tiles · 路网与城镇: © OpenStreetMap contributors (ODbL)",
            "sources": ["https://registry.opendata.aws/terrain-tiles/", "https://www.openstreetmap.org/copyright"],
        },
        "roads": [{"c": rd["c"], "p": [[round(x), round(y)] for x, y in rd["p"]]} for rd in roads],
        "rivers": [{"p": [[round(x), round(y)] for x, y in rv["p"]]} for rv in rivers],
        "water": [{"p": [[round(x), round(y)] for x, y in w["p"]]} for w in water],
        "cities": [{"n": c["n"], "r": c["r"], "x": round(c["x"], 1), "y": round(c["y"], 1),
                    "pop": c.get("pop", 0), "rad": c.get("radius", 0)} for c in cities],
        "towns": towns,
    }

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    txt = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(txt)
    log(f"wrote {OUT}  ({len(txt)/1024/1024:.2f} MB)  in {time.time()-t0:.1f}s")
    log("roads", len(roads), "rivers", len(rivers), "towns", len(towns))

    try:
        from make_preview import make as _make_preview, preview_path as _preview_path
        _pv = _make_preview(OUT, _preview_path(OUT))
        log("preview", os.path.getsize(_pv) // 1024, "KB")
    except Exception as _e:
        log("preview skipped:", _e)

if __name__ == "__main__":
    main()
