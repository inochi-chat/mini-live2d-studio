export function createPartActions({
  getParts,
  setParts,
  getSelectedId,
  setSelectedId,
  getNextId,
  setNextId,
  createPart,
  saveUndo,
  updatePartList,
  syncEditor,
  render,
  status,
  getWorldTransform,
  getImages,
  getImageLoading
}) {
  function addPart(name, canvas, x, y) {
    saveUndo();

    const parts = getParts();
    const part = createPart(
      getNextId(),
      name,
      canvas,
      x,
      y
    );

    setNextId(getNextId() + 1);
    parts.push(part);
    setSelectedId(part.id);

    updatePartList();
    syncEditor();
    render();

    return part;
  }

  function movePart(id, direction) {
    const parts = getParts();
    const index = parts.findIndex(p => p.id === id);
    if (index < 0) return;

    const next = index + direction;
    if (next < 0 || next >= parts.length) return;

    saveUndo();

    [parts[index], parts[next]] =
      [parts[next], parts[index]];

    updatePartList();
    render();
  }

  function duplicateSelectedPart() {
    const parts = getParts();
    const p = parts.find(p => p.id === getSelectedId());
    if (!p) return;

    saveUndo();

    const copy = {
      ...p,
      id: getNextId(),
      name: (p.name || 'パーツ') + ' のコピー',
      x: p.x + 20,
      y: p.y + 20,
      phase: Math.random() * 6.28,
      img: null
    };

    setNextId(getNextId() + 1);
    parts.push(copy);
    setSelectedId(copy.id);

    updatePartList();
    syncEditor();
    render();

    status('パーツを複製したよ！');
  }

  function deleteSelectedPart() {
    const parts = getParts();
    const p = parts.find(p => p.id === getSelectedId());
    if (!p) return;

    saveUndo();

    const removedId = p.id;

    parts.forEach(child => {
      if (child.parentId === removedId) {
        const wt = getWorldTransform(child);

        child.x = wt.x;
        child.y = wt.y;
        child.scale = wt.scale;
        child.rotation = wt.rotation;
        child.parentId = null;
      }
    });

    setParts(parts.filter(q => q.id !== removedId));

    getImages().delete(removedId);
    getImageLoading().delete(removedId);

    const remaining = getParts();

    setSelectedId(
      remaining.length
        ? remaining[remaining.length - 1].id
        : null
    );

    updatePartList();
    syncEditor();
    render();

    status('パーツを削除したよ。子パーツはその場に残したよ。');
  }

  return {
    addPart,
    movePart,
    duplicateSelectedPart,
    deleteSelectedPart
  };
}
