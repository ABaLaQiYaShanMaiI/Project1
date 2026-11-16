import io
p = r'E:\PersonalGame\Project1\MAPDESIGN.md'
new = io.open(r'E:\PersonalGame\Project1\Tools\.cells_section.md', encoding='utf-8').read().strip() + '\n\n'
src = io.open(p, encoding='utf-8').read()
start = src.index('## 十一、城市单元格与占领（设计契约）')
end = src.index('## 九、历史方案（已废弃）')
io.open(p, 'w', encoding='utf-8', newline='\n').write(src[:start] + new + src[end:])
print('ok', len(src), '->', len(src[:start] + new + src[end:]))
