import io
import re

p = 'Tools/fetch_basemap.mjs'
s = io.open(p, encoding='utf-8').read()

if 'GLYPH_RANGES' not in s:
    s = s.replace(
        "const FONT = 'Noto Sans Regular';",
        "const FONT = 'Noto Sans Regular';\nconst GLYPH_RANGES = ['0-255', '256-511', '512-767'];",
        1,
    )
    s = re.sub(r"for \(const r of \[[^\]]*\]\)", 'for (const r of GLYPH_RANGES)', s, count=1)

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('GLYPH_RANGES in file:', 'GLYPH_RANGES' in s)
print('loop patched:', 'for (const r of GLYPH_RANGES)' in s)
