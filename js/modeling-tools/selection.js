
export function createSelectionTool(options = {}) {
  const {
    selectedVertexIndices,
    selectedEdgeIndices,
    selectedFaceIndices,
    updateVertexColors,
    updateEdgeColors,
    updateFaceColors
  } = options;

  function toggleVertexSelection(index) {
    if (selectedVertexIndices.has(index)) {
      selectedVertexIndices.delete(index);
    } else {
      selectedVertexIndices.add(index);
    }

    updateVertexColors();
  }

  function toggleEdgeSelection(index) {
    if (selectedEdgeIndices.has(index)) {
      selectedEdgeIndices.delete(index);
    } else {
      selectedEdgeIndices.add(index);
    }

    updateEdgeColors();
  }

  function toggleFaceSelection(index) {
    if (selectedFaceIndices.has(index)) {
      selectedFaceIndices.delete(index);
    } else {
      selectedFaceIndices.add(index);
    }

    updateFaceColors();
  }

  return {
    toggleVertexSelection,
    toggleEdgeSelection,
    toggleFaceSelection
  };
}
