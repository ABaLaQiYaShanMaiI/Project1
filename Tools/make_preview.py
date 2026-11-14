import argparse
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from bake_world import tint_from_elev


def make(map_path, out_path, width=512):
    with open(map_path, encoding="utf-8") as f:
        data = json.load(f)
    meta = data["meta"]
    dem = meta["dem"]
    cols, rows, values = dem["cols"], dem["rows"], dem["values"]
    grid = np.asarray(values, dtype=np.float32).reshape(rows, cols)
    span = meta["spanM"]
    cell = max(span[0] / max(cols - 1, 1), 1.0)
    rgb = tint_from_elev(grid, cell, exag=900.0)
    img = Image.fromarray(rgb, "RGB")
    height = max(1, int(round(width * rows / cols)))
    img = img.resize((width, height), Image.LANCZOS)
    img.save(out_path, quality=78, optimize=True)
    return out_path


def preview_path(map_path):
    base = os.path.splitext(os.path.basename(map_path))[0]
    name = base[4:] if base.startswith("map_") else base
    return os.path.join(os.path.dirname(map_path), f"preview_{name}.jpg")


def main():
    ap = argparse.ArgumentParser(description="为已烘焙的战场生成低分辨率预览图")
    ap.add_argument("--map", default="app/public/data/map_fulda.json")
    ap.add_argument("--out", default="")
    ap.add_argument("--width", type=int, default=512)
    args = ap.parse_args()
    if not os.path.exists(args.map):
        raise SystemExit(f"找不到 {args.map}")
    out = args.out or preview_path(args.map)
    path = make(args.map, out, args.width)
    print(f"{path}  {os.path.getsize(path) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
