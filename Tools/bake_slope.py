import argparse
import io
import json
import math
import os
import sys
import time
from multiprocessing import Pool

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
DATA = os.path.join(ROOT, 'app', 'public', 'data')

PALETTE_PATH = os.path.join(HERE, 'slope_palette.json')
DEFAULT_LIMITS = [3, 8, 15, 25, 35, 999]
DEFAULT_COLORS = ['#d6e4c4', '#bed6a8', '#e8d696', '#e0b074', '#ce8460', '#b05c52']


def load_palette():
    try:
        with io.open(PALETTE_PATH, encoding='utf-8') as f:
            doc = json.load(f)
        limits = [int(v) for v in doc.get('limits', DEFAULT_LIMITS)]
        colors = [str(v) for v in doc.get('colors', DEFAULT_COLORS)]
        if len(limits) == len(colors) and limits:
            return limits, colors
    except Exception as exc:
        log(f'palette fallback: {exc}')
    return DEFAULT_LIMITS, DEFAULT_COLORS


LIMITS, COLORS = load_palette()
CLASSES = list(zip(LIMITS, COLORS))
LIMITS = [c[0] for c in CLASSES]
ALPHA = 255


def log(msg):
    print(time.strftime('[slope %H:%M:%S]'), msg, flush=True)


def tile_center_lat(z, y):
    n = math.pi - 2.0 * math.pi * (y + 0.5) / (2 ** z)
    return math.degrees(math.atan(math.sinh(n)))


def hex_rgb(value):
    s = str(value).lstrip('#')
    if len(s) != 6:
        return (200, 200, 200)
    return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16))


def slope_rgba(dem_path, z, y):
    img = Image.open(dem_path).convert('RGB')
    a = np.asarray(img, dtype=np.float32)
    elev = a[:, :, 0] * 256.0 + a[:, :, 1] + a[:, :, 2] / 256.0 - 32768.0
    elev[elev < -1000] = np.nan
    mpp = 156543.03392 * math.cos(math.radians(tile_center_lat(z, y))) / (2 ** z)
    gy, gx = np.gradient(elev)
    grad = np.sqrt(gx * gx + gy * gy) / max(mpp, 1e-6)
    pct = grad * 100.0
    out = np.zeros((a.shape[0], a.shape[1], 4), dtype=np.uint8)
    rest = np.ones(pct.shape, dtype=bool)
    for limit, color in CLASSES:
        hit = rest & (pct < limit)
        if not hit.any():
            continue
        r, g, b = hex_rgb(color)
        out[hit, 0] = r
        out[hit, 1] = g
        out[hit, 2] = b
        out[hit, 3] = ALPHA
        rest &= ~hit
    out[~np.isfinite(pct), 3] = 0
    return Image.fromarray(out, mode='RGBA')

def job(args):
    key, z, x, y = args
    src = os.path.join(DATA, 'dem', key, str(z), str(x), f'{y}.png')
    if not os.path.exists(src):
        return None
    dst_dir = os.path.join(DATA, 'slope', key, str(z), str(x))
    os.makedirs(dst_dir, exist_ok=True)
    dst = os.path.join(dst_dir, f'{y}.png')
    try:
        img = slope_rgba(src, z, y)
        img.save(dst, optimize=True)
        return os.path.getsize(dst)
    except Exception as exc:
        log(f'fail {key}/{z}/{x}/{y}: {exc}')
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--key', default='fulda')
    ap.add_argument('--zmin', type=int, default=-1)
    ap.add_argument('--zmax', type=int, default=-1)
    ap.add_argument('--threads', type=int, default=8)
    args = ap.parse_args()

    man_path = os.path.join(DATA, 'dem', args.key, 'index.json')
    if not os.path.exists(man_path):
        log(f'缺少 DEM 清单：{man_path}')
        sys.exit(1)
    with io.open(man_path, encoding='utf-8') as f:
        man = json.load(f)

    zmin = man['minzoom'] if args.zmin < 0 else args.zmin
    zmax = man['maxzoom'] if args.zmax < 0 else args.zmax
    dem_dir = os.path.join(DATA, 'dem', args.key)
    tasks = []
    for z in range(zmin, zmax + 1):
        zd = os.path.join(dem_dir, str(z))
        if not os.path.isdir(zd):
            continue
        for x in sorted(os.listdir(zd)):
            xd = os.path.join(zd, x)
            if not os.path.isdir(xd):
                continue
            for name in sorted(os.listdir(xd)):
                if name.endswith('.png'):
                    tasks.append((args.key, z, int(x), int(name[:-4])))

    if not tasks:
        log('没有可处理的 DEM 瓦片')
        sys.exit(1)

    log(f'{args.key} z{zmin}-{zmax} 共 {len(tasks)} 张')
    t0 = time.time()
    total = 0
    done = 0
    with Pool(args.threads) as pool:
        for size in pool.imap_unordered(job, tasks, chunksize=8):
            done += 1
            if size:
                total += size
            if done % 200 == 0:
                log(f'{done}/{len(tasks)}')

    out = {
        'key': args.key,
        'minzoom': zmin,
        'maxzoom': zmax,
        'bbox': man['bbox'],
        'tiles': f'/data/slope/{args.key}/{{z}}/{{x}}/{{y}}.png',
        'classes': [c[0] for c in CLASSES if c[0] < 999],
        'attribution': man.get('attribution', ''),
        'sizeMB': round(total / 1048576.0, 2),
        'generated': time.strftime('%Y-%m-%d %H:%M'),
    }
    with io.open(os.path.join(DATA, 'slope', args.key, 'index.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    log(f'完成 {args.key} {total / 1048576.0:.2f} MB，用时 {time.time() - t0:.1f}s')


if __name__ == '__main__':
    main()
