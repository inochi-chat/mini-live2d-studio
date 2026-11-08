import { state } from './state.js';

export function addPart(name, canvas, x, y, helpers) {
  const p = {
    id: state.nextId++,
    name,
    data: canvas.toDataURL('image/png'),
    x,
    y,
    w: canvas.width,
    h: canvas.height,
    scale: 100,
    rotation: 0,
    sway: 8,
    speed: 10,
    motion: 'none',
    visible: true,
    phase: Math.random() * 6.28,
    parentId: null
  };

  state.parts.push(p);
  state.selectedId = p.id;

  helpers.updatePartList();
  helpers.syncEditor();
  helpers.render();
}
