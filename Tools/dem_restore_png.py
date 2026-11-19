import io
import json
import os
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DEM = os.path.join(ROOT, "app", "public", "data", "dem")


def tiles(base):
    for z in sorted(os.listdir(base)):
        zd = os.path.join(base, z)
        if not z.isdigit() or not os.path.isdir(zd):
            continue
        for x in sorted(os.listdir(zd)):
            xd = os.path.join(zd, x)
            if not os.path.isdir(xd):
                continue
            for name in sorted(os.listdir(xd)):
                yield os.path.join(xd, name)


def restore(key):
    base = os.path.join(DEM, key)
    man_path = os.path.join(base, "index.json")
    if not os.path.exists(man_path):
        return
    back = 0
    for path in list(tiles(base)):
        if not path.endswith(".webp"):
            continue
        dst = path[:-5] + ".png"
        if not os.path.exists(dst):
            with Image.open(path) as im:
                im.convert("RGB").save(dst, optimize=True)
            back += 1
        os.remove(path)
    with io.open(man_path, encoding="utf-8") as f:
        man = json.load(f)
    man["tiles"] = man["tiles"].replace(".webp", ".png")
    with io.open(man_path, "w", encoding="utf-8", newline="") as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
    print(f"{key}: 还原 {back} 张")


def main():
    keys = [a[2:] for a in sys.argv[1:] if a.startswith("--")] or [
        d for d in os.listdir(DEM) if os.path.isdir(os.path.join(DEM, d))
    ]
    for key in keys:
        restore(key)


main()
