
export function initStageEvents({
  stage,
  mode,
  getMode,
  setMode,
  getParts,
  getSelectedPart,
  setSelectedId,
  getPartScreenInfo,
  hitSelectedHandle,
  hitPart,
  saveUndo,
  render,
  syncEditor,
  updatePartList,
  getStagePoint,
  getSourcePoint,
  getFit,
  getViewZoom,
  setViewZoom,
  getViewPan,
  setViewPan,
  clampZoom,
  clampPan,
  getPinchRatio,
  worldToLocalPosition,
  cropRect,
  cropFree,
  brushAt,
  getDrawing,
  setDrawing,
  getStartPoint,
  setStartPoint,
  getPreviewPoint,
  setPreviewPoint,
  getFreePoints,
  setFreePoints,
  getSourceCanvas
}) {
  let viewPointers = new Map();
  let gesture = null;
  let dragAction = null;
  let lastPointer = null;

  function finishPointer(e) {
    viewPointers.delete(e.pointerId);

    const currentMode = getMode();

    if (currentMode === 'normal') {
      dragAction = null;
      gesture = null;
      return;
    }

    const p = getStagePoint(e);
    const startPoint = getStartPoint();

    if (currentMode === 'rect' && startPoint) {
      cropRect(startPoint, p);
      setStartPoint(null);
      setPreviewPoint(null);
    }

    if (currentMode === 'free' && getDrawing()) {
      cropFree(getFreePoints());
      setFreePoints([]);
    }

    setDrawing(false);
    lastPointer = null;

    render();
  }

  stage.addEventListener('pointerdown', e => {
    const p = getStagePoint(e);

    lastPointer = e;
    viewPointers.set(e.pointerId, p);

    stage.setPointerCapture(e.pointerId);

    // 続きの処理は次の段階で移す
  });

  stage.addEventListener('pointermove', e => {
    // 続きの処理は次の段階で移す
  });

  stage.addEventListener('pointerup', finishPointer);
  stage.addEventListener('pointercancel', finishPointer);
}
