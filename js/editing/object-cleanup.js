export function createObjectCleanup({
  detachObject,
  clearVertexHelper,
  clearEdgeHelper,
  clearFaceHelper,
  selectedVertexIndices,
  selectedEdgeIndices,
  selectedFaceIndices,
  getObjects,
  selectObject,
  deleteSelectedObject
}) {
  function clearAllObjects() {
    detachObject();

    clearVertexHelper();
    clearEdgeHelper();
    clearFaceHelper();

    selectedVertexIndices.clear();
    selectedEdgeIndices.clear();
    selectedFaceIndices.clear();

    const objects = [...getObjects()];

    objects.forEach((object) => {
      selectObject(object);
      deleteSelectedObject();
    });
  }

  return {
    clearAllObjects
  };
}
