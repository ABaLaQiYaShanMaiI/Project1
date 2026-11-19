import json
import os
import sys

from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "app", "public", "data", "dem")


def convert(key):
    base = os.path.join(DATA, key)
    man_path = os.path.join(base, "index.json")
    if not os.path.exists(man_path):
        print(f"skip {key}: 无 index.json")
        return
    before = 0
    after = 0
    count = 0
    for z in sorted(os.listdir(base)):
        zdir = os.path.join(base, z)
        if not z.isdigit() or not os.path.isdir(zdir):
            continue
        for x in os.listdir(zdir):
            xdir = os.path.join(zdir, x)
            if not os.path.isdir(xdir):
                continue
            for name in os.listdir(xdir):
                if not name.endswith(".png"):
                    continue
                src = os.path.join(xdir, name)
                dst = src[:-4] + ".webp"
                before += os.path.getsize(src)
                with Image.open(src) as im:
                    im.save(dst, "WEBP", lossless=True, quality=100, method=4)
                after += os.path.getsize(dst)
                os.remove(src)
                count += 1
    with open(man_path, encoding="utf-8") as f:
        man = json.load(f)
    man["tiles"] = man["tiles"].replace(".png", ".webp")
    man["encoding"] = man.get("encoding", "terrarium")
    with open(man_path, "w", encoding="utf-8") as f:
        json.dump(man, f, ensure_ascii=False, indent=1)
    saved = (before - after) / 1048576
    print(f"{key}: {count} 张 {before / 1048576:.1f} MB -> {after / 1048576:.1f} MB（省 {saved:.1f} MB）")


def main():
    keys = [a[2:] for a in sys.argv[1:] if a.startswith("--")] or [
        d for d in os.listdir(DATA) if os.path.isdir(os.path.join(DATA, d))
    ]
    for key in keys:
        convert(key)


main()
