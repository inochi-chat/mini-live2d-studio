
import * as THREE from "three";

export function createLoopCutTool(options = {}) {
  const {
    getSelectedObject,
    updateEditDisplay,
    refreshObjectList,
    refreshProperties,
    saveHistory,
    updateDebugPanel
  } = options;

  function loopCutSelectedObject() {
    const object = getSelectedObject();

    if (!object) {
      alert("ループカットする立方体を選択してください。");
      return;
    }

    if (object.geometry.type !== "BoxGeometry") {
      alert("今のループカットは、立方体に対応しています。");
      return;
    }

    const axisInput = document.getElementById("loopCutAxis");
    const axis = axisInput ? axisInput.value : "x";

    const geometry = object.geometry;
    geometry.computeBoundingBox();

    const size = new THREE.Vector3();
    geometry.boundingBox.getSize(size);

    let segmentsX = 1;
    let segmentsY = 1;
    let segmentsZ = 1;

    if (axis === "x") segmentsX = 2;
    if (axis === "y") segmentsY = 2;
    if (axis === "z") segmentsZ = 2;

    const newGeometry = new THREE.BoxGeometry(
      size.x,
      size.y,
      size.z,
      segmentsX,
      segmentsY,
      segmentsZ
    );

    geometry.dispose();
    object.geometry = newGeometry;

    updateEditDisplay();
    refreshObjectList();
    refreshProperties();
    saveHistory();

    updateDebugPanel("ループカットを追加しました");
  }

  return {
    loopCutSelectedObject
  };
}
