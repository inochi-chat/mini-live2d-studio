export function createHistoryConnection({
  createHistoryManager,
  getObjects,
  addObject,
  selectMesh,
  clearAllObjects,
  updateEditDisplay,
  refreshObjectList,
  refreshProperties,
  updateDebugPanel
}) {
  const historyManager = createHistoryManager({
    getObjects,
    addObject,
    selectMesh,
    clearAllObjects,
    updateEditDisplay,
    refreshObjectList,
    refreshProperties,
    updateDebugPanel
  });

  return historyManager;
}
