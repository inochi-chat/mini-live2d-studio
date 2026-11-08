export function createPart(id, name, canvas, x, y) {
  return {
    id,
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
}
