
export function createBoxSelectionTool(options = {}) {
  const {
    THREE,
    canvas,
    camera,
    getEditMode,
    getVertexHelper,
    selectedVertexIndices,
    updateVertexColors,
    updateDebugPanel
  } = options;

  let selecting = false;
  let startX = 0;
  let startY = 0;
  let pointerId = null;

  const box = document.createElement("div");

  Object.assign(box.style, {
    position: "fixed",
    display: "none",
    border: "1px solid #a58cff",
    background: "rgba(165, 140, 255, 0.18)",
    pointerEvents: "none",
    zIndex: "99999",
    boxSizing: "border-box"
  });

  document.body.appendChild(box);

  function updateBox(x, y) {
    const left = Math.min(startX, x);
    const top = Math.min(startY, y);
    const width = Math.abs(x - startX);
    const height = Math.abs(y - startY);

    Object.assign(box.style, {
      left: left + "px",
      top: top + "px",
      width: width + "px",
      height: height + "px"
    });
  }

  function finishSelection(event) {
    if (!selecting) return;

    selecting = false;

    const endX = event.clientX;
    const endY = event.clientY;

    box.style.display = "none";

    const left = Math.min(startX, endX);
    const right = Math.max(startX, endX);
    const top = Math.min(startY, endY);
    const bottom = Math.max(startY, endY);

    if (
      Math.abs(endX - startX) < 5 ||
      Math.abs(endY - startY) < 5
    ) {
      return;
    }

    const helper = getVertexHelper();

    if (!helper) return;

    const positions = helper.geometry.attributes.position;

    if (!positions) return;

    const rect = canvas.getBoundingClientRect();

    camera.updateMatrixWorld(true);
    helper.updateWorldMatrix(true, false);

    selectedVertexIndices.clear();

    for (let i = 0; i < positions.count; i++) {
      const point = new THREE.Vector3()
        .fromBufferAttribute(positions, i);

      helper.localToWorld(point);
      point.project(camera);

      if (point.z < -1 || point.z > 1) continue;

      const screenX =
        rect.left + (point.x + 1) * rect.width / 2;

      const screenY =
        rect.top + (1 - point.y) * rect.height / 2;

      if (
        screenX >= left &&
        screenX <= right &&
        screenY >= top &&
        screenY <= bottom
      ) {
        selectedVertexIndices.add(i);
      }
    }

    updateVertexColors();

    if (updateDebugPanel) {
      updateDebugPanel(
        "ボックス選択: " +
        selectedVertexIndices.size +
        "個の頂点"
      );
    }
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (getEditMode() !== "vertex") return;
    if (event.button !== 0) return;

    // 頂点を直接押した場合は既存の処理に任せる
    const helper = getVertexHelper();

    if (helper) {
      const rect = canvas.getBoundingClientRect();

      const pointer = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.params.Points.threshold = 0.8;
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObject(helper, true);

      if (hits.length > 0) return;
    }

    selecting = true;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;

    box.style.display = "block";
    updateBox(startX, startY);

    event.preventDefault();
    event.stopImmediatePropagation();

    try {
      canvas.setPointerCapture(event.pointerId);
    } catch (error) {
      // ポインターキャプチャに失敗しても選択処理は継続
    }
  }, true);

  canvas.addEventListener("pointermove", (event) => {
    if (!selecting || event.pointerId !== pointerId) return;

    updateBox(event.clientX, event.clientY);

    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  canvas.addEventListener("pointerup", (event) => {
    if (!selecting || event.pointerId !== pointerId) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    finishSelection(event);
    pointerId = null;
  }, true);

  canvas.addEventListener("pointercancel", (event) => {
    if (!selecting) return;

    selecting = false;
    pointerId = null;
    box.style.display = "none";

    event.stopImmediatePropagation();
  }, true);

  return {
    cancel() {
      selecting = false;
      pointerId = null;
      box.style.display = "none";
    }
  };
}
