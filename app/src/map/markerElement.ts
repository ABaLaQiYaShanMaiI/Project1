import type { Marker } from '../core/markers';
import { SIDE_COLOR } from '../core/markers';

export function markerElement(m: Marker, onDelete: (id: string) => void): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'ml-unit';
  const c = SIDE_COLOR[m.side];
  el.style.borderColor = c.stroke;
  el.style.background = c.fill;
  el.style.color = c.text;
  el.textContent = m.label;
  el.title = `${m.label}（拖动移动 · 右键删除）`;
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(m.id);
  });
  return el;
}
