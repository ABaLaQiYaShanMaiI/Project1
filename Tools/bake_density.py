import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "app", "public", "data")

CELL = 4
LEVELS = 5
RAMP = [(217, 210, 196), (198, 191, 174), (179, 171, 152), (162, 154, 134), (143, 135, 116)]


def bake(src, key, bbox):
    doc = json.load(open(src, encoding="utf-8"))
    z = doc["z"]
    out_dir = os.path.join(DATA, "density", key)
    total = 0
    count = 0
    for tile in doc["tiles"]:
        mask = Image.new("L", (256, 256), 0)
        draw = ImageDraw.Draw(mask)
        scale = 256.0 / 4096.0
        for ring in tile["polys"]:
            pts = [(px * scale, py * scale) for px, py in ring]
            if len(pts) >= 3:
                draw.polygon(pts, fill=255)
        arr = np.asarray(mask, dtype=np.float32)
        cells = arr.reshape(256 // CELL, CELL, 256 // CELL, CELL).mean(axis=(1, 3)) / 255.0
        norm = np.sqrt(np.clip(cells / 0.35, 0, 1))
        level = np.where(norm < 0.06, LEVELS, np.clip(np.round(norm * (LEVELS - 1)), 0, LEVELS - 1).astype(np.int32))
        img = np.full((256, 256), LEVELS, dtype=np.uint8)
        for i in range(LEVELS):
            hit = level == i
            img[np.repeat(np.repeat(hit, CELL, 0), CELL, 1)] = i
        pic = Image.fromarray(img, mode="P")
        palette = []
        for color in RAMP:
            palette.extend(color)
        palette.extend((0, 0, 0))
        pic.putpalette(palette)
        pic.info['transparency'] = LEVELS
        d = os.path.join(out_dir, str(z), str(tile["x"]))
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, f"{tile['y']}.png")
        pic.save(path, optimize=True)
        total += os.path.getsize(path)
        count += 1
    man = {
        "key": key,
        "z": z,
        "minzoom": z,
        "maxzoom": z,
        "bbox": bbox,
        "tiles": f"/data/density/{key}/{{z}}/{{x}}/{{y}}.png",
        "levels": LEVELS,
        "count": count,
        "sizeMB": round(total / 1048576, 2),
        "source": doc["pack"].replace(ROOT, "").replace("\\", "/"),
    }
    with open(os.path.join(out_dir, "index.json"), "w", encoding="utf-8") as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
    print(f"{key}: {count} 张 / {total / 1048576:.2f} MB / z{z}")


def main():
    src = sys.argv[1]
    key = sys.argv[2]
    bbox = [float(v) for v in sys.argv[3].split(",")]
    bake(src, key, bbox)


main()
