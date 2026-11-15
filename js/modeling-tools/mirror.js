
export function createMirrorTool(options = {}) {
  const {
    getSelectedObject,
    duplicateSelectedObject,
    refreshObjectList,
    refreshProperties,
    saveHistory,
    updateDebugPanel
  } = options;

  function mirrorSelectedObject() {
    const original = getSelectedObject();

    if (!original) {
      alert("ミラー複製するオブジェクトを選択してください。");
      return;
    }

    const axisInput = document.getElementById("mirrorAxis");
    const axis = axisInput ? axisInput.value : "x";

    const originalPosition = original.position.clone();
    const originalScale = original.scale.clone();

    const mirrored = duplicateSelectedObject();

    if (!mirrored) return;

    mirrored.position[axis] = -originalPosition[axis];
    mirrored.scale.copy(originalScale);
    mirrored.scale[axis] *= -1;

    mirrored.name = original.name + "_mirror";

    refreshObjectList();
    refreshProperties();
    saveHistory();

    updateDebugPanel("ミラー複製しました");
  }

  return {
    mirrorSelectedObject
  };
}
