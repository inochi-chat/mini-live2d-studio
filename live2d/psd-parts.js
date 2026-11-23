export function createPartsFromPSD(psd, startId = 1) {
  const parts = [];
  let nextId = startId;

  function walk(layers, parent = '') {
    (layers || []).forEach(layer => {
      if (layer.hidden) return;

      if (layer.children?.length) {
        walk(layer.children, layer.name || parent);
        return;
      }

      const canvas = layer.canvas;

      if (!canvas || !canvas.width || !canvas.height) {
        return;
      }

      const left = Number.isFinite(layer.left)
        ? layer.left
        : 0;

      const top = Number.isFinite(layer.top)
        ? layer.top
        : 0;

      const name =
        (parent ? parent + ' / ' : '') +
        (layer.name || 'レイヤー ' + (parts.length + 1));

      parts.push({
        id: nextId++,
        name,
        category: 'other',
        data: canvas.toDataURL('image/png'),
        x: left + canvas.width / 2,
        y: top + canvas.height / 2,
        w: canvas.width,
        h: canvas.height,
        scale: 100,
        rotation: 0,
        sway: 4,
        speed: 10,
        motion: 'none',
        visible: true,
        phase: Math.random() * 6.28,
        parentId: null
      });
    });
  }

  walk(psd.children || []);

  return {
    parts,
    nextId
  };
}
