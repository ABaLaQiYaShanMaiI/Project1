import argparse
import hashlib
import json
import math
import os
import sys
import time

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "app", "public", "data")
CACHE = os.path.join(HERE, ".tile-cache")
UA = {"User-Agent": "TacticalMapWargame-AddRoads/0.1 (personal project)"}
OVERPASS = "https://overpass-api.de/api/interpreter"
TOL = {"motorway": 20.0, "trunk": 20.0, "primary": 25.0, "secondary": 35.0}

sys.stdout.reconfigure(encoding="utf-8")


def log(*a):
    print(f"[roads {time.strftime('%H:%M:%S')}]", *a, flush=True)


def ll2m(meta, lat, lon):
    pr = meta["projection"]
    return (lon - pr["lon0"]) * pr["mPerDegLon"], (lat - pr["lat0"]) * pr["mPerDegLat"]


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


def split_bbox(bbox, n):
    lats = [bbox["south"] + (bbox["north"] - bbox["south"]) * i / n for i in range(n + 1)]
    lons = [bbox["west"] + (bbox["east"] - bbox["west"]) * i / n for i in range(n + 1)]
    out = []
    for j in range(n):
        for i in range(n):
            out.append(f"{lats[j]:.5f},{lons[i]:.5f},{lats[j+1]:.5f},{lons[i+1]:.5f}")
    return out


def query_for(classes, bb):
    pattern = "|".join(classes)
    return f"""[out:json][timeout:180];
(
  way["highway"~"^({pattern})$"]({bb});
);
out geom;"""


def parse_roads(elements, meta, classes):
    out = []
    keep = set(classes)
    for el in elements:
        tags = el.get("tags") or {}
        cls = tags.get("highway")
        if cls not in keep:
            continue
        geo = el.get("geometry") or []
        pts = [ll2m(meta, g["lat"], g["lon"]) for g in geo if "lat" in g]
        if len(pts) < 2:
            continue
        pts = simplify(pts, TOL.get(cls, 30.0))
        if len(pts) < 2:
            continue
        out.append({"c": cls, "p": pts})
    return out


def road_key(rd):
    p = rd["p"]
    raw = f"{rd['c']}|{round(p[0][0])},{round(p[0][1])}|{round(p[-1][0])},{round(p[-1][1])}|{len(p)}"
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def main():
    ap = argparse.ArgumentParser(description="给已烘焙地图补路网等级（如 secondary）")
    ap.add_argument("--map", default="app/public/data/map_fulda.json")
    ap.add_argument("--classes", default="secondary")
    ap.add_argument("--block", type=int, default=3)
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()

    path = args.map if os.path.isabs(args.map) else os.path.join(HERE, "..", args.map)
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    meta = data["meta"]
    classes = [c.strip() for c in args.classes.split(",") if c.strip()]
    parts = split_bbox(meta["bbox"], args.block)
    log(f"{os.path.basename(path)}: {len(data['roads'])} roads, query {classes} in {len(parts)} blocks")

    existing = {road_key(rd) for rd in data.get("roads", [])}
    added = 0
    for i, bb in enumerate(parts):
        log(f"block {i + 1}/{len(parts)}")
        packed = fetch(query_for(classes, bb), classes)
        roads = parse_roads(packed.get("elements") or [], meta, classes)
        for rd in roads:
            k = road_key(rd)
            if k in existing:
                continue
            existing.add(k)
            data["roads"].append(rd)
            added += 1
        log(f"  +{len(roads)} parsed, total +{added}")
        if i + 1 < len(parts):
            time.sleep(1.0)

    data["roads"].sort(key=lambda r: r["c"])
    log(f"added {added}, roads now {len(data['roads'])}")
    if args.dry:
        return
    txt = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    with open(path, "w", encoding="utf-8") as f:
        f.write(txt)
    log(f"wrote {path} ({len(txt) / 1024 / 1024:.2f} MB)")


def cache_path(classes, query):
    h = hashlib.md5(query.encode("utf-8")).hexdigest()[:8]
    tag = "-".join(sorted(classes))
    return os.path.join(CACHE, f"addroads_{tag}_{h}.json")


def fetch(query, classes, tries=3):
    path = cache_path(classes, query)
    if os.path.exists(path):
        log("  cache hit")
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    session = requests.Session()
    session.trust_env = False
    for i in range(tries):
        t0 = time.time()
        try:
            r = session.post(OVERPASS, data={"data": query}, headers=UA, timeout=120)
            if r.status_code == 200:
                log(f"  overpass 200 {len(r.content)/1024:.0f}KB in {time.time()-t0:.1f}s")
                data = r.json()
                os.makedirs(CACHE, exist_ok=True)
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(data, f, ensure_ascii=False)
                return data
            log(f"  overpass HTTP {r.status_code} in {time.time()-t0:.1f}s")
        except Exception as e:
            log(f"  overpass err: {e}")
        time.sleep(3 * (i + 1))
    return {"elements": []}


if __name__ == "__main__":
    main()

