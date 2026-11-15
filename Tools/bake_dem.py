import argparse
import json
import math
import os
import shutil
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import requests

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "app", "public", "data")
CACHE = os.path.join(HERE, ".tile-cache", "terrarium")
UA = {"User-Agent": "TacticalMapWargame-BakeDem/0.1 (personal project)"}
URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
SOURCE = "AWS Terrain Tiles (Terrarium / SRTM, 公有领域)"

sys.stdout.reconfigure(encoding="utf-8")


def log(*a):
    print(f"[dem {time.strftime('%H:%M:%S')}]", *a, flush=True)


def deg2tile(lat, lon, z):
    n = 2 ** z
    x = (lon + 180.0) / 360.0 * n
    y = (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n
    return x, y


def tile_range(bbox, z, pad=0):
    w, s, e, n = bbox
    x0, y0 = deg2tile(n, w, z)
    x1, y1 = deg2tile(s, e, z)
    lim = 2 ** z - 1
    return (
        max(0, int(x0) - pad),
        max(0, int(y0) - pad),
        min(lim, int(x1) + pad),
        min(lim, int(y1) + pad),
    )


def fetch(z, x, y):
    path = os.path.join(CACHE, str(z), str(x), f"{y}.png")
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for attempt in range(4):
        try:
            r = requests.get(URL.format(z=z, x=x, y=y), headers=UA, timeout=60)
            if r.status_code == 200 and r.content:
                tmp = path + ".part"
                with open(tmp, "wb") as f:
                    f.write(r.content)
                os.replace(tmp, path)
                return path
        except Exception as e:
            log("重试", z, x, y, type(e).__name__)
            time.sleep(1.0 + attempt)
    raise RuntimeError(f"terrarium tile failed {z}/{x}/{y}")


def main():
    ap = argparse.ArgumentParser(description="烘焙本地 DEM 瓦片（MapLibre raster-dem / 晕渲 / 高程采样）")
    ap.add_argument("--map", default="app/public/data/map_fulda.json")
    ap.add_argument("--key", default="")
    ap.add_argument("--bbox", default="")
    ap.add_argument("--zmin", type=int, default=9)
    ap.add_argument("--zmax", type=int, default=11)
    ap.add_argument("--threads", type=int, default=8)
    args = ap.parse_args()

    if args.bbox:
        bbox = [float(v) for v in args.bbox.split(",")]
        key = args.key or "custom"
    else:
        path = args.map if os.path.isabs(args.map) else os.path.join(HERE, "..", args.map)
        with open(path, encoding="utf-8") as f:
            meta = json.load(f)["meta"]
        b = meta["bbox"]
        bbox = [b["west"], b["south"], b["east"], b["north"]]
        key = args.key
        if not key:
            key = os.path.splitext(os.path.basename(path))[0]
            if key.startswith("map_"):
                key = key[4:]

    out = os.path.join(DATA, "dem", key)
    jobs = []
    counts = {}
    for z in range(args.zmin, args.zmax + 1):
        x0, y0, x1, y1 = tile_range(bbox, z)
        counts[z] = (x1 - x0 + 1) * (y1 - y0 + 1)
        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                jobs.append((z, x, y))
    log("瓦片", " + ".join(f"z{z}:{counts[z]}" for z in sorted(counts)), f"= {len(jobs)}")

    done = 0

    def work(job):
        nonlocal done
        z, x, y = job
        src = fetch(z, x, y)
        dst = os.path.join(out, str(z), str(x), f"{y}.png")
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(src, dst)
        done += 1
        if done % 25 == 0 or done == len(jobs):
            log(f"{done}/{len(jobs)}")

    with ThreadPoolExecutor(max_workers=max(1, args.threads)) as pool:
        list(pool.map(work, jobs))

    total = 0
    for root, _dirs, files in os.walk(out):
        for f in files:
            total += os.path.getsize(os.path.join(root, f))

    manifest = {
        "key": key,
        "encoding": "terrarium",
        "tileSize": 256,
        "minzoom": args.zmin,
        "maxzoom": args.zmax,
        "bbox": [round(v, 6) for v in bbox],
        "tiles": f"/data/dem/{key}/{{z}}/{{x}}/{{y}}.png",
        "attribution": SOURCE,
        "generated": time.strftime("%Y-%m-%d %H:%M"),
        "sizeMB": round(total / 1048576, 2),
    }
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, "index.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    log("完成", f"{os.path.relpath(out, os.path.join(HERE, '..'))}", f"{manifest['sizeMB']} MB")


if __name__ == "__main__":
    main()
