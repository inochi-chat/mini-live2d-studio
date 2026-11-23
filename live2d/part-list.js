
export function createPartList({
  parts,
  getSelectedId,
  setSelectedId,
  collapsedParts,
  saveUndo,
  syncEditor,
  render,
  movePart
}) {
  function updatePartList() {
    const box = document.getElementById('parts');
    box.replaceChildren();

    if (!parts().length) {
      const empty = document.createElement('div');
      empty.className = 'tree-empty';
      empty.textContent = 'まだパーツがありません。';
      box.append(empty);
      return;
    }

    const childrenOf = id =>
      parts().filter(p => p.parentId === id);

    const roots = parts().filter(p =>
      p.parentId == null ||
      !parts().some(q => q.id === p.parentId)
    );

    const visited = new Set();

    function createNode(p) {
      if (visited.has(p.id)) return null;
      visited.add(p.id);

      const wrapper = document.createElement('div');
      wrapper.className = 'tree-node';

      const children = childrenOf(p.id);
      const hasChildren = children.length > 0;

      const row = document.createElement('div');
      row.className = 'tree-row' +
        (p.id === getSelectedId() ? ' selected' : '');

      const toggle = document.createElement('button');
      toggle.className = 'tree-toggle';
      toggle.textContent = hasChildren
        ? (collapsedParts.has(p.id) ? '▶' : '▼')
        : '・';
      toggle.disabled = !hasChildren;

      toggle.onclick = e => {
        e.stopPropagation();

        if (collapsedParts.has(p.id)) {
          collapsedParts.delete(p.id);
        } else {
          collapsedParts.add(p.id);
        }

        updatePartList();
      };

      const name = document.createElement('div');
      name.className = 'tree-indent';
      name.textContent =
        (hasChildren ? '📁 ' : '🧩 ') +
        (p.name || '名前なし');

      const selectPart = () => {
        setSelectedId(p.id);
        updatePartList();
        syncEditor();
        render();
      };

      name.onclick = selectPart;

      const visibility = document.createElement('button');
      visibility.textContent = p.visible ? '表示' : '非表示';

      visibility.onclick = e => {
        e.stopPropagation();
        saveUndo();

        p.visible = !p.visible;
        updatePartList();
        render();
      };

      const front = document.createElement('button');
      front.textContent = '▲';
      front.title = '前面へ';
      front.onclick = e => {
        e.stopPropagation();
        movePart(p.id, 1);
      };

      const back = document.createElement('button');
      back.textContent = '▼';
      back.title = '背面へ';
      back.onclick = e => {
        e.stopPropagation();
        movePart(p.id, -1);
      };

      row.append(toggle, name, visibility, front, back);
      row.onclick = selectPart;
      wrapper.append(row);

      if (hasChildren && !collapsedParts.has(p.id)) {
        const group = document.createElement('div');
        group.className = 'tree-children';

        children.forEach(child => {
          const node = createNode(child);
          if (node) group.append(node);
        });

        wrapper.append(group);
      }

      return wrapper;
    }

    roots.forEach(p => {
      const node = createNode(p);
      if (node) box.append(node);
    });

    parts().forEach(p => {
      if (!visited.has(p.id)) {
        const node = createNode(p);
        if (node) box.append(node);
      }
    });
  }

  return { updatePartList };
}
