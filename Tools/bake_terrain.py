import argparse
import json
import math
import os
import sys
from io import BytesIO

import numpy as np
import requests
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "app", "public", "data")
CACHE = os.path.join(HERE, ".tile-cache")
UA = {"User-Agent": "TacticalMapWargame-BakeTerrain/0.1 (personal project)"}
Z = 10

STOPS = [
    (120, (206, 218, 196)),
    (220, (214, 219, 186)),
    (320, (219, 211, 176)),
    (420, (214, 195, 165)),
    (520, (201, 178, 155)),
    (650, (186, 170, 158)),
    (800, (196, 190, 186)),
    (950, (214, 212, 210)),
]
LIGHT = np.array([-0.55, -0.55, 0.75], dtype=np.float32)
EXAG = 1.35

sys.stdout.reconfigure(encoding="utf-8")


def log(*a):
    print(f"[terrain {time_str()}]", *a, flush=True)


def time_str():
    import time

    return time.strftime("%H:%M:%S")


def ramp(e):
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


def shade(e, cell_m):
    dzdx = np.gradient(e, axis=1) / cell_m * EXAG
    dzdy = np.gradient(e, axis=0) / cell_m * EXAG
    nx = -dzdx * 1000
    ny = -dzdy * 1000
    nz = np.ones_like(dzdx)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    dot = (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / ln
    k = 0.62 + 0.55 * np.clip(dot, 0, 1)
    return k


def fetch_tile(i, j):
    path = os.path.join(CACHE, f"z{Z}_{i}_{j}.png")
    if os.path.exists(path):
        return Image.open(path).convert("RGB")
    url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{i}/{j}.png"
    for _ in range(3):
        try:
            r = requests.get(url, headers=UA, timeout=60)
            if r.status_code == 200:
                with open(path, "wb") as f:
                    f.write(r.content)
                return Image.open(BytesIO(r.content)).convert("RGB")
        except Exception:
            pass
    raise RuntimeError(f"tile failed {i},{j}")


def lonlat_to_px(lat, lon):
    n = 2 ** Z
    x = (lon + 180.0) / 360.0 * n * 256.0
    rad = math.radians(lat)
    y = (1.0 - math.asinh(math.tan(rad)) / math.pi) / 2.0 * n * 256.0
    return x, y


def build_mosaic(meta):
    pr = meta["projection"]
    lat0, lon0 = meta["center"]
    span_x, span_y = meta["spanM"]
    lat_t = lat0 + (span_y / 2) / pr["mPerDegLat"]
    lat_b = lat0 - (span_y / 2) / pr["mPerDegLat"]
    lon_l = lon0 - (span_x / 2) / pr["mPerDegLon"]
    lon_r = lon0 + (span_x / 2) / pr["mPerDegLon"]
    x0, y0 = lonlat_to_px(lat_t, lon_l)
    x1, y1 = lonlat_to_px(lat_b, lon_r)
    tx0, ty0 = int(x0 // 256) - 1, int(y0 // 256) - 1
    tx1, ty1 = int(x1 // 256) + 1, int(y1 // 256) + 1
    nx, ny = tx1 - tx0 + 1, ty1 - ty0 + 1
    log(f"mosaic {nx}x{ny} = {nx * ny} tiles (z{Z})")
    mosaic = np.zeros((ny * 256, nx * 256), dtype=np.float32)
    for j in range(ny):
        for i in range(nx):
            img = fetch_tile(tx0 + i, ty0 + j)
            a = np.asarray(img).astype(np.float32)
            e = (a[:, :, 0] * 256.0 + a[:, :, 1] + a[:, :, 2] / 256.0) - 32768.0
            mosaic[j * 256:(j + 1) * 256, i * 256:(i + 1) * 256] = e
    return mosaic, tx0 * 256, ty0 * 256, (x0, y0, x1, y1)


def crop(mosaic, ox, oy, x0, y0, x1, y1, out_w):
    u0 = max(0, int(math.floor(x0 - ox)))
    v0 = max(0, int(math.floor(y0 - oy)))
    u1 = min(mosaic.shape[1], int(math.ceil(x1 - ox)))
    v1 = min(mosaic.shape[0], int(math.ceil(y1 - oy)))
    sub = mosaic[v0:v1, u0:u1]
    h = max(1, int(round(out_w * (y1 - y0) / (x1 - x0))))
    img = Image.fromarray(sub, "F").resize((out_w, h), Image.LANCZOS)
    return np.asarray(img, dtype=np.float32)


def main():
    ap = argparse.ArgumentParser(description="为战场烘焙高分辨率晕渲图")
    ap.add_argument("--map", default="app/public/data/map_fulda.json")
    ap.add_argument("--width", type=int, default=2048)
    ap.add_argument("--quality", type=int, default=88)
    args = ap.parse_args()

    path = args.map if os.path.isabs(args.map) else os.path.join(HERE, "..", args.map)
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    meta = data["meta"]
    key = os.path.splitext(os.path.basename(path))[0]
    if key.startswith("map_"):
        key = key[4:]

    mosaic, ox, oy, box = build_mosaic(meta)
    e = crop(mosaic, ox, oy, *box, args.width)
    cell_m = meta["spanM"][0] / max(1, e.shape[1] - 1)
    rgb = np.clip(ramp(e) * shade(e, cell_m)[:, :, None], 0, 255).astype(np.uint8)
    out = os.path.join(DATA, f"terrain_{key}.jpg")
    Image.fromarray(rgb, "RGB").save(out, quality=args.quality, optimize=True)

    meta["terrain"] = {"file": f"terrain_{key}.jpg", "width": int(e.shape[1]), "height": int(e.shape[0])}
    txt = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    with open(path, "w", encoding="utf-8") as f:
        f.write(txt)
    log(
        f"wrote {os.path.basename(out)} {os.path.getsize(out) / 1024:.0f}KB ({e.shape[1]}x{e.shape[0]}), "
        f"map {len(txt) / 1024 / 1024:.2f} MB"
    )


if __name__ == "__main__":
    main()
