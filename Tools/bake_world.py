import argparse
import concurrent.futures as cf
import json
import math
import os
import time
from io import BytesIO

import numpy as np
import requests
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "app", "public", "data")
OUT = os.path.join(DATA, "world")
TILES = os.path.join(OUT, "t")
CACHE = os.path.join(HERE, ".tile-cache")
FLAT_IMAGE = os.path.join(DATA, "world_terrain.jpg")
FLAT_META = os.path.join(DATA, "world_meta.json")
UA = {"User-Agent": "TacticalMapWargame-BakeWorld/0.2 (personal project)"}

STOPS = [
    (-200, (10, 26, 48)),
    (-20, (22, 58, 92)),
    (2, (34, 78, 104)),
    (20, (74, 108, 84)),
    (200, (110, 132, 88)),
    (600, (150, 138, 96)),
    (1200, (160, 138, 110)),
    (2200, (176, 162, 150)),
    (3500, (214, 210, 206)),
    (6000, (245, 245, 248)),
]

LIGHT = np.array([-0.5, -0.5, 0.71], dtype=np.float32)


def log(*a):
    print(f"[world {time.strftime('%H:%M:%S')}]", *a, flush=True)


def colorize(e):
    rgb = np.zeros(e.shape + (3,), dtype=np.float32)
    prev_e, prev_c = STOPS[0]
    rgb[e <= prev_e] = prev_c
    for e1, c1 in STOPS[1:]:
        m = (e > prev_e) & (e <= e1)
        if np.any(m):
            t = ((e[m] - prev_e) / (e1 - prev_e))[:, None]
            rgb[m] = np.array(prev_c) * (1 - t) + np.array(c1) * t
        prev_e, prev_c = e1, c1
    rgb[e > STOPS[-1][0]] = STOPS[-1][1]
    return rgb


def tint_from_elev(e, cell_m, exag=900.0):
    dzdx = np.gradient(e, axis=1) / cell_m
    dzdy = np.gradient(e, axis=0) / cell_m
    nx = -dzdx * exag
    ny = -dzdy * exag
    nz = np.ones_like(dzdx)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    shade = np.clip((nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / ln, 0, 1)
    k = 0.7 + 0.5 * shade
    return np.clip(colorize(e) * k[:, :, None], 0, 255).astype(np.uint8)


def terrarium(data):
    a = np.asarray(Image.open(BytesIO(data)).convert("RGB")).astype(np.float32)
    return (a[:, :, 0] * 256.0 + a[:, :, 1] + a[:, :, 2] / 256.0) - 32768.0


def cache_path(z, x, y):
    return os.path.join(CACHE, f"w{z}_{x}_{y}.png")


def fetch_tile(z, x, y, tries=3):
    path = cache_path(z, x, y)
    if os.path.exists(path):
        return open(path, "rb").read()
    url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
    for k in range(tries):
        try:
            r = requests.get(url, headers=UA, timeout=60)
            if r.status_code == 200:
                os.makedirs(CACHE, exist_ok=True)
                with open(path, "wb") as f:
                    f.write(r.content)
                return r.content
        except Exception:
            pass
        time.sleep(1.5 * (k + 1))
    raise RuntimeError(f"tile failed {z}/{x}/{y}")


def download_zoom(z, workers=8):
    n = 2 ** z
    todo = [(z, x, y) for y in range(n) for x in range(n) if not os.path.exists(cache_path(z, x, y))]
    log(f"download z{z}: {len(todo)}/{n * n} tiles missing")
    if not todo:
        return
    ok = 0
    with cf.ThreadPoolExecutor(workers) as ex:
        futs = {ex.submit(fetch_tile, zz, xx, yy): (xx, yy) for zz, xx, yy in todo}
        for fut in cf.as_completed(futs):
            try:
                fut.result()
                ok += 1
            except Exception as e:
                log("  fail", futs[fut], e)
            if ok and ok % 25 == 0:
                log(f"  {ok}/{len(todo)}")
    log(f"download z{z} done: {ok}/{len(todo)}")


def y_to_lat(ny):
    return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * ny))))


def layer_mosaic(z):
    n = 2 ** z
    mosaic = np.zeros((n * 256, n * 256), dtype=np.float32)
    missing = 0
    for y in range(n):
        for x in range(n):
            p = cache_path(z, x, y)
            if not os.path.exists(p):
                missing += 1
                continue
            with open(p, "rb") as f:
                mosaic[y * 256:(y + 1) * 256, x * 256:(x + 1) * 256] = terrarium(f.read())
    return mosaic, missing


def render_from_mosaic(mosaic, z, quality=82):
    n = 2 ** z
    size = mosaic.shape[0]
    out_dir = os.path.join(TILES, str(z))
    os.makedirs(out_dir, exist_ok=True)
    bytes_written = 0
    for y in range(n):
        lat = y_to_lat((y + 0.5) / n)
        cell = 156543.03392 * math.cos(math.radians(lat)) / (2 ** z)
        for x in range(n):
            y0 = max(0, y * 256 - 1)
            y1 = min(size, (y + 1) * 256 + 1)
            x0 = max(0, x * 256 - 1)
            x1 = min(size, (x + 1) * 256 + 1)
            sub = mosaic[y0:y1, x0:x1]
            rgb = tint_from_elev(sub, max(cell, 1.0))
            oy = y * 256 - y0
            ox = x * 256 - x0
            tile = rgb[oy:oy + 256, ox:ox + 256]
            out = os.path.join(out_dir, f"{x}_{y}.jpg")
            Image.fromarray(tile, "RGB").save(out, quality=quality, optimize=True)
            bytes_written += os.path.getsize(out)
    return bytes_written


def render_from_flat(max_zoom=3, quality=82):
    img = Image.open(FLAT_IMAGE).convert("RGB")
    w, _ = img.size
    base_zoom = int(round(math.log2(w / 256)))
    levels = []
    top = min(max_zoom, base_zoom)
    total = 0
    for z in range(0, top + 1):
        n = 2 ** z
        src = w // n
        out_dir = os.path.join(TILES, str(z))
        os.makedirs(out_dir, exist_ok=True)
        for y in range(n):
            for x in range(n):
                tile = img.crop((x * src, y * src, (x + 1) * src, (y + 1) * src))
                if tile.size != (256, 256):
                    tile = tile.resize((256, 256), Image.LANCZOS)
                out = os.path.join(out_dir, f"{x}_{y}.jpg")
                tile.save(out, quality=quality, optimize=True)
                total += os.path.getsize(out)
        levels.append(z)
        log(f"z{z}: {n * n} tiles from flat image")
    log(f"from-image done: levels {levels}, {total / 1024 / 1024:.2f} MB")
    return levels


def write_meta(levels, quality, source):
    levels = sorted(set(levels))
    meta = {
        "name": "世界",
        "projection": "web-mercator",
        "tileSize": 256,
        "minZoom": levels[0],
        "maxZoom": levels[-1],
        "levels": levels,
        "quality": quality,
        "generated": time.strftime("%Y-%m-%d %H:%M"),
        "attribution": "高程: SRTM/AWS Terrain Tiles",
        "source": source,
        "path": "/data/world/t/{z}/{x}_{y}.jpg",
    }
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    log("meta written", json.dumps(meta, ensure_ascii=False))


def main():
    ap = argparse.ArgumentParser(description="世界底图瓦片金字塔（z0..z6）")
    ap.add_argument("--download", type=int, default=-1, help="只下载该 zoom 的 DEM 瓦片到 Tools/.tile-cache")
    ap.add_argument("--from-cache", action="store_true", help="用缓存的 DEM 瓦片生成瓦片金字塔")
    ap.add_argument("--from-image", action="store_true", help="用现有 world_terrain.jpg 生成 z0..z3（零联网）")
    ap.add_argument("--min-zoom", type=int, default=0)
    ap.add_argument("--max-zoom", type=int, default=6)
    ap.add_argument("--allow-missing", action="store_true", help="缓存不完整时仍生成（空洞按 0 高程处理）")
    ap.add_argument("--quality", type=int, default=82)
    args = ap.parse_args()

    if args.download >= 0:
        download_zoom(args.download)
        return

    if args.from_image:
        levels = render_from_flat(min(args.max_zoom, 3), args.quality)
        write_meta(levels, args.quality, "flat-image")
        return

    if args.from_cache:
        levels = []
        for z in range(args.max_zoom, args.min_zoom - 1, -1):
            mosaic, missing = layer_mosaic(z)
            if missing and not args.allow_missing:
                log(f"z{z}: {missing} tiles missing, skipped（先 --download {z}，或用 --allow-missing）")
                continue
            written = render_from_mosaic(mosaic, z, args.quality)
            levels.append(z)
            log(f"z{z}: {2 ** (2 * z)} tiles, {written / 1024 / 1024:.2f} MB")
        if not levels:
            raise SystemExit("没有完整可用的 DEM 层，先运行 --download <zoom>")
        write_meta(levels, args.quality, "dem-cache")
        return

    ap.print_help()


if __name__ == "__main__":
    main()
