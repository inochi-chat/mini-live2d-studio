
export function createPointerEvents({
  canvas,
  getEditMode,
  updatePointer,
  getVertexHit,
  getEdgeHit,
  getFaceHit,
  raycaster,
  getObjects,
  addVertexTool,
  selectMesh,
  selectedVertexIndices,
  selectedEdgeIndices,
  selectedFaceIndices,
  updateVertexColors,
  dragTools,
  getIsAddingVertex,
  getIsDragging,
  saveHistory,
  refreshProperties,
  selectionTool,
  updateDebugPanel
}) {
  let pointerDownPosition = null;

  let pendingVertex = null;
  let pendingEdge = null;
  let pendingFace = null;

  // =========================
  // タッチ開始
  // =========================

  function onPointerDown(event) {
    pointerDownPosition = {
      x: event.clientX,
      y: event.clientY
    };

    const mode = getEditMode();

    if (mode === "vertex") {
      const index = getVertexHit(event);

      pendingVertex = index === null
        ? null
        : {
            index,
            x: event.clientX,
            y: event.clientY
          };
    }

    if (mode === "edge") {
      const index = getEdgeHit(event);

      pendingEdge = index === null
        ? null
        : {
            index,
            x: event.clientX,
            y: event.clientY
          };
    }

    if (mode === "face") {
      const index = getFaceHit(event);

      pendingFace = index === null
        ? null
        : {
            index,
            x: event.clientX,
            y: event.clientY
          };
    }
  }

  // =========================
  // タッチ移動
  // =========================

  function onPointerMove(event) {
    if (dragTools.hasVertexDrag()) {
      dragTools.moveVertices(event);
      return;
    }

    if (dragTools.hasEdgeDrag()) {
      dragTools.moveEdges(event);
      return;
    }

    if (dragTools.hasFaceDrag()) {
      dragTools.moveFaces(event);
      return;
    }

    if (pendingVertex) {
      const dx = event.clientX - pendingVertex.x;
      const dy = event.clientY - pendingVertex.y;

      if (
        Math.hypot(dx, dy) >= 6 &&
        selectedVertexIndices.has(pendingVertex.index)
      ) {
        dragTools.beginVertexDrag(event, pendingVertex);

        if (dragTools.hasVertexDrag()) {
          dragTools.moveVertices(event);
        }
      }
    }

    if (pendingEdge) {
      const dx = event.clientX - pendingEdge.x;
      const dy = event.clientY - pendingEdge.y;

      if (
        Math.hypot(dx, dy) >= 6 &&
        selectedEdgeIndices.has(pendingEdge.index)
      ) {
        dragTools.beginEdgeDrag(event, pendingEdge);

        if (dragTools.hasEdgeDrag()) {
          dragTools.moveEdges(event);
        }
      }
    }

    if (pendingFace) {
      const dx = event.clientX - pendingFace.x;
      const dy = event.clientY - pendingFace.y;

      if (
        Math.hypot(dx, dy) >= 6 &&
        selectedFaceIndices.has(pendingFace.index)
      ) {
        dragTools.beginFaceDrag(event, pendingFace);

        if (dragTools.hasFaceDrag()) {
          dragTools.moveFaces(event);
        }
      }
    }
  }

  // =========================
  // タッチ終了
  // =========================

  function clearPending() {
    pendingVertex = null;
    pendingEdge = null;
    pendingFace = null;
    pointerDownPosition = null;
  }

  function onPointerUp(event) {
    // 頂点配置モード
    if (getIsAddingVertex()) {
      updatePointer(event);

      const hits = raycaster.intersectObjects(
        getObjects(),
        false
      );

      if (hits.length > 0) {
        const hit = hits[0];

        const newIndex = addVertexTool.addVertex(
          hit.object,
          hit.point
        );

        if (newIndex >= 0) {
          selectMesh(hit.object);

          if (getEditMode() === "vertex") {
            selectedVertexIndices.add(newIndex);
            updateVertexColors();
          }

          saveHistory();
          refreshProperties();

          updateDebugPanel(
            "新しい頂点を追加しました: " + newIndex
          );
        }
      }

      clearPending();
      return;
    }

    if (dragTools.hasVertexDrag()) {
      dragTools.finishVertexDrag();
      clearPending();
      return;
    }

    if (dragTools.hasEdgeDrag()) {
      dragTools.finishEdgeDrag();
      clearPending();
      return;
    }

    if (dragTools.hasFaceDrag()) {
      dragTools.finishFaceDrag();
      clearPending();
      return;
    }

    if (pendingVertex) {
      const dx = event.clientX - pendingVertex.x;
      const dy = event.clientY - pendingVertex.y;

      if (Math.hypot(dx, dy) < 6) {
        selectionTool.toggleVertexSelection(
          pendingVertex.index
        );
      }

      clearPending();
      return;
    }

    if (pendingEdge) {
      const dx = event.clientX - pendingEdge.x;
      const dy = event.clientY - pendingEdge.y;

      if (Math.hypot(dx, dy) < 6) {
        selectionTool.toggleEdgeSelection(
          pendingEdge.index
        );
      }

      clearPending();
      return;
    }

    if (pendingFace) {
      const dx = event.clientX - pendingFace.x;
      const dy = event.clientY - pendingFace.y;

      if (Math.hypot(dx, dy) < 6) {
        selectionTool.toggleFaceSelection(
          pendingFace.index
        );
      }

      clearPending();
      return;
    }

    if (getIsDragging() || !pointerDownPosition) {
      clearPending();
      return;
    }

    const dx = event.clientX - pointerDownPosition.x;
    const dy = event.clientY - pointerDownPosition.y;

    pointerDownPosition = null;

    if (Math.hypot(dx, dy) > 5) return;

    updatePointer(event);

    const hits = raycaster.intersectObjects(
      getObjects(),
      false
    );

    if (hits.length > 0) {
      selectMesh(hits[0].object);
    }
  }

  // =========================
  // タッチキャンセル
  // =========================

  function onPointerCancel() {
    if (dragTools.hasVertexDrag()) {
      dragTools.finishVertexDrag();
    }

    if (dragTools.hasEdgeDrag()) {
      dragTools.finishEdgeDrag();
    }

    if (dragTools.hasFaceDrag()) {
      dragTools.finishFaceDrag();
    }

    clearPending();
  }

  // =========================
  // イベント登録
  // =========================

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);

  return {
    dispose() {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
    }
  };
}
