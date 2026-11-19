import json
import os
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DEM = os.path.join(ROOT, "app", "public", "data", "dem")


def walk(base):
    for z in sorted(os.listdir(base)):
        zdir = os.path.join(base, z)
        if not z.isdigit() or not os.path.isdir(zdir):
            continue
        for x in os.listdir(zdir):
            xdir = os.path.join(zdir, x)
            if not os.path.isdir(xdir):
                continue
            for name in sorted(os.listdir(xdir)):
                yield os.path.join(xdir, name)


def finish(key):
    base = os.path.join(DEM, key)
    man_path = os.path.join(base, "index.json")
    if not os.path.exists(man_path):
        print(f"skip {key}")
        return
    png = 0
    webp = 0
    for path in list(walk(base)):
        if path.endswith(".png"):
            dst = path[:-4] + ".webp"
            if not os.path.exists(dst):
                with Image.open(path) as im:
                    im.save(dst, "WEBP", lossless=True, quality=100, method=4)
            os.remove(path)
            png += 1
        elif path.endswith(".webp"):
            webp += 1
    with open(man_path, encoding="utf-8") as f:
        man = json.load(f)
    man["tiles"] = man["tiles"].replace(".png", ".webp")
    with open(man_path, "w", encoding="utf-8") as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
    size = sum(os.path.getsize(p) for p in walk(base)) / 1048576
    print(f"{key}: converted {png} / webp {webp + png} / {size:.1f} MB")


def main():
    keys = [a[2:] for a in sys.argv[1:] if a.startswith("--")] or [
        d for d in os.listdir(DEM) if os.path.isdir(os.path.join(DEM, d))
    ]
    for key in keys:
        finish(key)


main()
