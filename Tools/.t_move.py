import io
p = r'E:\PersonalGame\Project1\MAPDESIGN.md'
src = io.open(p, encoding='utf-8').read()
i = src.index('## 十一、地块系统')
j = src.index('## 九、历史方案')
head, cells, tail = src[:i].rstrip() + '\n', src[i:j].strip() + '\n', src[j:].strip() + '\n'
io.open(p, 'w', encoding='utf-8', newline='\n').write(head + '\n' + tail + '\n' + cells)
print('ok')
