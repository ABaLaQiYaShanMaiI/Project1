import io
p = r'E:\PersonalGame\Project1\Readme.md'
s = io.open(p, encoding='utf-8').read()
s = s.replace("""node Tools/bake_cities.mjs --pack=app/public/data/tiles/fulda.pmtiles --zoom=13 ^
  --kinds=city,town,village --out=app/public/data/cities_fulda.json""",
"""node Tools/bake_cities.mjs --pack=app/public/data/tiles/fulda.pmtiles --zoom=13 --kinds=city,town,village --out=app/public/data/cities_fulda.json""")
old = """## 下一步

1. 补齐 L1 大区包（欧洲各走廊），验证多层叠加的实际观感。
2. 国名 / 海洋名标签（`places` 的 country / region 档位）。
3. 全球晕渲只到 z5，z8 以上偏糊；按区域补 z9–z11。"""
new = """## 下一步

1. 地块期 2：兵牌进出驱动归属，邻接由 `cellAt` 探点现算（不存邻接表）。
2. 补齐 L1 大区包（欧洲各走廊），验证多层叠加的实际观感。
3. 国名 / 海洋名标签（`places` 的 country / region 档位）。
4. 全球晕渲只到 z5，z8 以上偏糊；按区域补 z9–z11。"""
assert old in s
s = s.replace(old, new)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('ok')
