import argparse
import json
import math
import os
import time

import requests

API = "https://overpass-api.de/api/interpreter"
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "app", "public", "data")
CACHE = os.path.join(HERE, ".tile-cache")
UA = {"User-Agent": "TacticalMapWargame-DetailBaker/0.1 (personal project)"}

def log(*a):
    print(f"[detail {time.strftime('%H:%M:%S')}]", *a, flush=True)

def overpass(query, tag, tries=3):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f"detail_{tag}.json")
    if os.path.exists(path):
        log(f"  {tag}: cache hit")
        return json.load(open(path, encoding="utf-8"))
    for i in range(tries):
        t0 = time.time()
        try:
            r = requests.post(API, data={"data": query}, headers=UA, timeout=300)
            if r.status_code == 200:
                data = r.json()
                json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False)
                log(f"  {tag}: {len(r.content)/1024/1024:.1f}MB in {time.time()-t0:.0f}s")
                return data
            log(f"  {tag}: HTTP {r.status_code}")
        except Exception as e:
            log(f"  {tag}: {e}")
        time.sleep(3 * (i + 1))
    return {"elements": []}

def poly_rect(pts):
    n = len(pts)
    if n < 3:
        return None
    cx = sum(p[0] for p in pts) / n
    cy = sum(p[1] for p in pts) / n
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
    w = max(ts) - min(ts)
    h = max(ss) - min(ss)
    if w * h < 25:
        return None
    tmid = (max(ts) + min(ts)) / 2
    smid = (max(ss) + min(ss)) / 2
    px = cx + ux * tmid - uy * smid
    py = cy + uy * tmid + ux * smid
    return [round(px, 1), round(py, 1), round(w, 1), round(h, 1), round(theta, 3)]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--name", required=True)
    ap.add_argument("--center", required=True)
    ap.add_argument("--radius", type=float, default=3000)
    ap.add_argument("--map", default="map_fulda.json")
    args = ap.parse_args()

    lat, lon = [float(x) for x in args.center.split(",")]
    meta = json.load(open(os.path.join(DATA, args.map), encoding="utf-8"))["meta"]
    lat0, lon0 = meta["center"]
    m_lat = meta["projection"]["mPerDegLat"]
    m_lon = meta["projection"]["mPerDegLon"]

    def to_m(la, lo):
        return (lo - lon0) * m_lon, (la - lat0) * m_lat

    r = args.radius
    bld_q = f"""[out:json][timeout:300];
(
  way["building"](around:{r},{lat},{lon});
);
out geom;"""
    street_q = f"""[out:json][timeout:300];
(
  way["highway"~"^(residential|service|unclassified|living_street|pedestrian|footway)$"](around:{r},{lat},{lon});
);
out geom;"""

    log(f"bake {args.name} r={r}m")
    bld = overpass(bld_q, f"{args.name.lower()}_bld")
    streets = overpass(street_q, f"{args.name.lower()}_str")

    rects = []
    for el in bld.get("elements", []):
        geo = el.get("geometry") or []
        pts = [to_m(g["lat"], g["lon"]) for g in geo if "lat" in g]
        if len(pts) < 3:
            continue
        rr = poly_rect(pts)
        if rr:
            rects.append(rr)

    lines = []
    for el in streets.get("elements", []):
        geo = el.get("geometry") or []
        pts = [to_m(g["lat"], g["lon"]) for g in geo if "lat" in g]
        if len(pts) >= 2:
            lines.append({"c": el.get("tags", {}).get("highway", "residential"),
                          "p": [[round(x, 1), round(y, 1)] for x, y in pts]})

    out = {
        "name": args.name,
        "center": list(to_m(lat, lon)),
        "radius": r,
        "buildings": rects,
        "streets": lines,
        "generated": time.strftime("%Y-%m-%d %H:%M"),
    }
    path = os.path.join(DATA, f"detail_{args.name.lower()}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    log(f"wrote {os.path.basename(path)}  buildings={len(rects)} streets={len(lines)}  "
        f"{os.path.getsize(path)/1024/1024:.2f} MB")

    if not rects and not lines:
        log("FAILED: 0 buildings / 0 streets, nothing written")
        return

    idx_path = os.path.join(DATA, "detail_index.json")
    idx = {}
    if os.path.exists(idx_path):
        idx = json.load(open(idx_path, encoding="utf-8"))
    idx[args.name.lower()] = {
        "file": f"detail_{args.name.lower()}.json",
        "x": round(out["center"][0], 1),
        "y": round(out["center"][1], 1),
        "r": r,
        "n": len(rects),
    }
    json.dump(idx, open(idx_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    log(f"index updated: {len(idx)} town(s)")

if __name__ == "__main__":
    main()
