
export function initEditorEvents({
  $,
  selected,
  partCategory,
  parts,
  setParent,
  syncEditor,
  updatePartList,
  updateValues,
  render,
  saveUndo,
  status
}) {
  // パーツ名
  $('partName').oninput = e => {
    const p = selected();
    if (!p) return;

    p.name = e.target.value;

    updatePartList();

    const current = $('parentPart').value;
    syncEditor();
    $('parentPart').value = current;
  };

  // パーツ分類
  partCategory.onchange = e => {
    const p = selected();
    if (!p) return;

    p.category = e.target.value;

    updatePartList();
    render();

    status('パーツの分類を変更したよ。');
  };

  // 動きの種類
  $('motionType').onchange = e => {
    const p = selected();
    if (!p) return;

    p.motion = e.target.value;
    render();

    status(
      p.name +
      'の動きを設定したよ。アニメーションをONにして確認してね。'
    );
  };

  // 親パーツ
  $('parentPart').onchange = e => {
    const p = selected();
    if (!p) return;

    setParent(p, e.target.value);

    syncEditor();
    updatePartList();
    render();

    status('親パーツを設定したよ。');
  };

  // パーツ数値調整
  ['posX', 'posY', 'scale', 'rotation', 'sway', 'speed']
    .forEach(id => {
      $(id).oninput = e => {
        const p = selected();
        if (!p) return;

        const v = Number(e.target.value);

        if (id === 'posX') {
          p.x = v - 300;
        } else if (id === 'posY') {
          p.y = v - 300;
        } else {
          p[id] = v;
        }

        updateValues();
        render();
      };
    });

  // 表示切り替え
  $('togglePart').onclick = () => {
    const p = selected();
    if (!p) return;

    saveUndo();

    p.visible = !p.visible;
    updatePartList();
    render();
  };
}
