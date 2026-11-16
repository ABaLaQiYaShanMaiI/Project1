import io
p = r'E:\PersonalGame\Project1\DEVLOG.md'
new = io.open(r'E:\PersonalGame\Project1\Tools\.devlog_entry.md', encoding='utf-8').read().rstrip() + '\n\n'
src = io.open(p, encoding='utf-8').read()
i = src.index('## 技术决策与原因')
io.open(p, 'w', encoding='utf-8', newline='\n').write(src[:i].rstrip() + '\n\n' + new + src[i:])
print('ok')
