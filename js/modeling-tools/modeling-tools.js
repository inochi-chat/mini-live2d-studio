
export function createModelingTools(options = {}) {
  const {
    THREE,
    RoundedBoxGeometry,
    getSelectedObject,
    updateEditDisplay,
    refreshObjectList,
    refreshProperties,
    saveHistory,
    updateDebugPanel
  } = options;

  function bevelSelectedObject() {
    const object = getSelectedObject();

    if (!object) {
      alert("角を丸めるオブジェクトを選択してください。");
      return;
    }

    if (object.geometry.type !== "BoxGeometry") {
      alert("今のベベル機能は、立方体に対応しています。");
      return;
    }

    const amountInput = document.getElementById("bevelAmount");
    const segmentsInput = document.getElementById("bevelSegments");

    const amount = amountInput ? Number(amountInput.value) : 0.1;
    const segments = segmentsInput
      ? Math.max(1, Math.min(8, Math.floor(Number(segmentsInput.value))))
      : 3;

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("丸める幅を正しく入力してください。");
      return;
    }

    const geometry = object.geometry;
    geometry.computeBoundingBox();

    const size = new THREE.Vector3();
    geometry.boundingBox.getSize(size);

    const radius = Math.min(
      amount,
      size.x * 0.49,
      size.y * 0.49,
      size.z * 0.49
    );

    const roundedGeometry = new RoundedBoxGeometry(
      size.x,
      size.y,
      size.z,
      segments,
      radius
    );

    roundedGeometry.computeVertexNormals();
    roundedGeometry.computeBoundingBox();
    roundedGeometry.computeBoundingSphere();

    roundedGeometry.type = "BufferGeometry";

    geometry.dispose();
    object.geometry = roundedGeometry;

    updateEditDisplay();
    refreshObjectList();
    refreshProperties();
    saveHistory();

    updateDebugPanel("角を丸めました");
  }

  return {
    bevelSelectedObject
  };
}
