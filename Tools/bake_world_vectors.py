import argparse
import json
import os
import time

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "app", "public", "data")
OUT = os.path.join(DATA, "world", "vectors.json")
CACHE = os.path.join(HERE, ".tile-cache")
UA = {"User-Agent": "TacticalMapWargame-BakeVectors/0.1 (personal project)"}

BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
SOURCES = {
    "places": BASE + "ne_10m_populated_places.geojson",
    "roads": BASE + "ne_10m_roads.geojson",
}

ROAD_KEEP = {"Major Highway": 1, "Secondary Highway": 2}
ROAD_TOL = {1: 0.03, 2: 0.06}
CITY_MAX_RANK = 8


def log(*a):
    print(f"[vectors {time.strftime('%H:%M:%S')}]", *a, flush=True)


def download(key):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f"ne_{key}.geojson")
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        log(f"{key}: cache hit")
        return json.load(open(path, encoding="utf-8"))
    url = SOURCES[key]
    log(f"{key}: GET {url}")
    r = requests.get(url, headers=UA, timeout=600)
    if r.status_code != 200:
        raise SystemExit(f"{key}: HTTP {r.status_code}")
    open(path, "wb").write(r.content)
    log(f"{key}: {len(r.content) / 1024 / 1024:.1f} MB")
    return r.json()


def simplify(points, tol):
    if len(points) < 3:
        return points
    keep = [points[0]]
    for p in points[1:-1]:
        q = keep[-1]
        if abs(p[0] - q[0]) + abs(p[1] - q[1]) >= tol:
            keep.append(p)
    keep.append(points[-1])
    return keep


def line_parts(geom):
    if not geom:
        return []
    if geom["type"] == "LineString":
        return [geom["coordinates"]]
    if geom["type"] == "MultiLineString":
        return geom["coordinates"]
    return []


def build_roads(gj):
    roads = []
    for f in gj.get("features", []):
        props = f.get("properties") or {}
        cls = ROAD_KEEP.get(props.get("type"))
        if not cls:
            continue
        for coords in line_parts(f.get("geometry")):
            pts = [[round(c[0], 3), round(c[1], 3)] for c in coords if len(c) >= 2]
            if len(pts) < 2:
                continue
            pts = simplify(pts, ROAD_TOL[cls])
            lon = [p[0] for p in pts]
            lat = [p[1] for p in pts]
            roads.append({"c": cls, "p": pts, "b": [min(lon), min(lat), max(lon), max(lat)]})
    roads.sort(key=lambda r: r["c"])
    return roads


def build_cities(gj):
    cities = []
    for f in gj.get("features", []):
        props = f.get("properties") or {}
        geom = f.get("geometry") or {}
        if geom.get("type") != "Point":
            continue
        rank = props.get("SCALERANK")
        if rank is None:
            rank = 10
        if rank > CITY_MAX_RANK:
            continue
        coords = geom["coordinates"]
        cities.append({
            "n": props.get("NAME") or props.get("NAMEASCII") or "?",
            "x": round(coords[0], 3),
            "y": round(coords[1], 3),
            "k": int(rank),
            "p": int(props.get("POP_MAX") or 0),
        })
    cities.sort(key=lambda c: (c["k"], -c["p"]))
    return cities


def main():
    ap = argparse.ArgumentParser(description="生成世界层矢量（Natural Earth → world/vectors.json）")
    ap.add_argument("--skip-roads", action="store_true")
    ap.add_argument("--skip-cities", action="store_true")
    args = ap.parse_args()

    cities = [] if args.skip_cities else build_cities(download("places"))
    roads = [] if args.skip_roads else build_roads(download("roads"))
    if not cities and not roads:
        raise SystemExit("没有可用数据")

    payload = {
        "generated": time.strftime("%Y-%m-%d %H:%M"),
        "attribution": "© Natural Earth (public domain)",
        "cities": cities,
        "roads": roads,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    txt = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(txt)
    log(f"cities {len(cities)}, roads {len(roads)}, {len(txt) / 1024 / 1024:.2f} MB -> {OUT}")


if __name__ == "__main__":
    main()
