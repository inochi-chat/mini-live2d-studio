
export function createEditDisplay({
  getEditMode,
  getSelectedObject,
  attachObject,
  detachObject,
  clearVertexHelper,
  clearEdgeHelper,
  clearFaceHelper,
  selectedVertexIndices,
  selectedEdgeIndices,
  selectedFaceIndices,
  showVerticesTool,
  showEdgesTool,
  showFacesTool,
  updateDebugPanel
}) {
  function updateEditDisplay() {
    const mode = getEditMode();
    const selected = getSelectedObject();

    clearVertexHelper();
    clearEdgeHelper();
    clearFaceHelper();

    selectedVertexIndices.clear();
    selectedEdgeIndices.clear();
    selectedFaceIndices.clear();

    if (mode === "object") {
      if (selected) {
        attachObject(selected);
      }
    } else {
      detachObject();

      if (mode === "vertex" && selected) {
        showVerticesTool.showVertices(selected);
      }

      if (mode === "edge" && selected) {
        showEdgesTool.showEdges(selected);
      }

      if (mode === "face" && selected) {
        showFacesTool.showFaces(selected);
      }
    }

    updateDebugPanel("編集モード切り替え済み");
  }

  window.addEventListener("edit-mode-changed", updateEditDisplay);

  return {
    updateEditDisplay,
    dispose() {
      window.removeEventListener("edit-mode-changed", updateEditDisplay);
    }
  };
}
