export function createObjectSelection({
  selectObject,
  getEditMode,
  attachObject,
  detachObject,
  selectedVertexIndices,
  selectedEdgeIndices,
  selectedFaceIndices,
  updateEditDisplay,
  refreshObjectList,
  refreshProperties
}) {
  function selectMesh(mesh) {
    if (!mesh) return;

    selectObject(mesh);

    selectedVertexIndices.clear();
    selectedEdgeIndices.clear();
    selectedFaceIndices.clear();

    if (getEditMode() === "object") {
      attachObject(mesh);
    } else {
      detachObject();
    }

    updateEditDisplay();
    refreshObjectList();
    refreshProperties();
  }

  return {
    selectMesh
  };
}
