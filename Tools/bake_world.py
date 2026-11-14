import concurrent.futures as cf
import json
import math
import os
import time

import numpy as np
import requests
from PIL import Image
from io import BytesIO

Z = 3
N = 2 ** Z
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app", "public", "data")
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".tile-cache")
UA = {"User-Agent": "HexWargame-BakeWorld/0.1 (personal project)"}

def log(*a):
    print(f"[world {time.strftime('%H:%M:%S')}]", *a, flush=True)

def fetch(i, j):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f"w{Z}_{i}_{j}.png")
    if os.path.exists(path):
        return open(path, "rb").read()
    url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{i}/{j}.png"
    for k in range(4):
        try:
            r = requests.get(url, headers=UA, timeout=120)
            if r.status_code == 200:
                open(path, "wb").write(r.content)
                return r.content
        except Exception:
            pass
        time.sleep(1.5 * (k + 1))
    raise RuntimeError(f"tile failed {i},{j}")

def decode(data):
    a = np.asarray(Image.open(BytesIO(data)).convert("RGB")).astype(np.float32)
    return (a[:, :, 0] * 256.0 + a[:, :, 1] + a[:, :, 2] / 256.0) - 32768.0

def main():
    t0 = time.time()
    mosaic = np.zeros((N * 256, N * 256), dtype=np.float32)
    ok = 0
    with cf.ThreadPoolExecutor(10) as ex:
        futs = {(i, j): ex.submit(fetch, i, j) for j in range(N) for i in range(N)}
        for (i, j), fut in futs.items():
            try:
                mosaic[j * 256:(j + 1) * 256, i * 256:(i + 1) * 256] = decode(fut.result())
                ok += 1
            except Exception as e:
                log("fail", i, j, e)
    log(f"tiles {ok}/{N*N}")

    h, w = mosaic.shape

    e = np.clip(mosaic, -200, 6000)
    stops = [
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
    rgb = np.zeros((h, w, 3), dtype=np.float32)
    for k in range(len(stops) - 1):
        e0, c0 = stops[k]
        e1, c1 = stops[k + 1]
        m = (e >= e0) & (e < e1)
        t = ((e[m] - e0) / (e1 - e0))[:, None]
        rgb[m] = np.array(c0) * (1 - t) + np.array(c1) * t
    rgb[e >= stops[-1][0]] = stops[-1][1]

    px = 360.0 / (w) * 111320.0 * np.cos(np.radians(30))
    cell = (360.0 / w) * 111320.0
    dzdx = np.gradient(mosaic, axis=1) / cell
    dzdy = np.gradient(mosaic, axis=0) / cell
    nx, ny, nz = -dzdx * 900, -dzdy * 900, np.ones_like(dzdx)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    L = (-0.5, -0.5, 0.71)
    shade = np.clip((nx * L[0] + ny * L[1] + nz * L[2]) / ln, 0, 1)
    k = 0.7 + 0.5 * shade
    out = np.clip(rgb * k[:, :, None], 0, 255).astype(np.uint8)

    img = Image.fromarray(out, "RGB")
    os.makedirs(OUT_DIR, exist_ok=True)
    jpg = os.path.join(OUT_DIR, "world_terrain.jpg")
    img.save(jpg, quality=82, optimize=True)

    meta = {
        "name": "世界",
        "projection": "web-mercator",
        "zoom": Z,
        "width": w,
        "height": h,
        "generated": time.strftime("%Y-%m-%d %H:%M"),
        "attribution": "高程: SRTM/AWS Terrain Tiles",
    }
    with open(os.path.join(OUT_DIR, "world_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    log(f"wrote {jpg} ({os.path.getsize(jpg)/1024/1024:.2f} MB) in {time.time()-t0:.0f}s")

if __name__ == "__main__":
    main()
