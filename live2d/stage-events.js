
export function initStageEvents({
  stage,
  getMode,
  getParts,
  getSelected,
  setSelectedId,
  partScreenInfo,
  hitSelectedHandle,
  hitPart,
  saveUndo,
  updatePartList,
  syncEditor,
  render,
  stagePoint,
  sourcePoint,
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
  setPreviewPoint,
  getFreePoints,
  setFreePoints,
  getSourceCanvas
}) {
  const viewPointers = new Map();

  let gesture = null;
  let dragAction = null;
  let lastPointer = null;

  stage.addEventListener('pointerdown', e => {
    const p = stagePoint(e);

    lastPointer = e;
    viewPointers.set(e.pointerId, p);

    stage.setPointerCapture(e.pointerId);

    const mode = getMode();

    if (mode === 'normal') {
      if (viewPointers.size >= 2) {
        dragAction = null;

        const pts = [...viewPointers.values()];

        gesture = {
          distance: Math.hypot(
            pts[1].x - pts[0].x,
            pts[1].y - pts[0].y
          ),
          zoom: getViewZoom(),
          mid: {
            x: (pts[0].x + pts[1].x) / 2,
            y: (pts[0].y + pts[1].y) / 2
          },
          panX: getViewPan().x,
          panY: getViewPan().y
        };

        return;
      }

      const current = getSelected();
      const handle = hitSelectedHandle(
        current,
        p,
        partScreenInfo
      );

      if (current && handle) {
        saveUndo();

        const info = partScreenInfo(current);

        dragAction = {
          type: handle,
          id: current.id,
          start: p,
          center: { x: info.cx, y: info.cy },
          startDistance: Math.max(
            1,
            Math.hypot(p.x - info.cx, p.y - info.cy)
          ),
          startAngle: Math.atan2(
            p.y - info.cy,
            p.x - info.cx
          ),
          startScale: current.scale,
          startRotation: current.rotation
        };

        return;
      }

      const hit = hitPart(p, getParts(), partScreenInfo);

      if (hit) {
        saveUndo();
        setSelectedId(hit.id);

        updatePartList();
        syncEditor();

        const info = partScreenInfo(hit);

        dragAction = {
          type: 'move',
          id: hit.id,
          start: p,
          startWorld: {
            x: info.wt.x,
            y: info.wt.y
          }
        };

        render();
        return;
      }

      dragAction = {
        type: 'pan',
        last: p
      };

      gesture = { last: p };
      return;
    }

    if (viewPointers.size >= 2) return;

    const sourceCanvas = getSourceCanvas();

    if (
      !sourceCanvas.width &&
      ['rect', 'free', 'erase', 'restore'].includes(mode)
    ) {
      return;
    }

    if (mode === 'rect') {
      setStartPoint(p);
      setPreviewPoint(p);
      render();
      return;
    }

    if (mode === 'free') {
      setFreePoints([p]);
      setDrawing(true);
      render();
      return;
    }

    if (mode === 'erase' || mode === 'restore') {
      saveUndo();
      setDrawing(true);
      brushAt(p);
    }
  });

  stage.addEventListener('pointermove', e => {
    if (viewPointers.has(e.pointerId)) {
      viewPointers.set(e.pointerId, stagePoint(e));
    }

    const mode = getMode();

    if (mode === 'normal' && viewPointers.size) {
      const pts = [...viewPointers.values()];

      if (pts.length >= 2) {
        dragAction = null;

        const mid = {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2
        };

        if (!gesture || !gesture.distance) {
          gesture = {
            distance: Math.hypot(
              pts[1].x - pts[0].x,
              pts[1].y - pts[0].y
            ),
            zoom: getViewZoom(),
            mid,
            panX: getViewPan().x,
            panY: getViewPan().y
          };
        }

        const dist = Math.max(
          1,
          Math.hypot(
            pts[1].x - pts[0].x,
            pts[1].y - pts[0].y
          )
        );

        const ratio = getPinchRatio(
          dist,
          gesture.distance
        );

        setViewZoom(
          clampZoom(gesture.zoom * ratio)
        );

        setViewPan(
          clampPan(gesture.panX + mid.x - gesture.mid.x),
          clampPan(gesture.panY + mid.y - gesture.mid.y)
        );

        render();

      } else if (dragAction) {
        const p = pts[0];
        const parts = getParts();
        const part = parts.find(
          q => q.id === dragAction.id
        );

        if (dragAction.type === 'pan') {
          const pan = getViewPan();

          setViewPan(
            clampPan(pan.x + p.x - dragAction.last.x),
            clampPan(pan.y + p.y - dragAction.last.y)
          );

          dragAction.last = p;
          render();

        } else if (part && dragAction.type === 'move') {
          const fit = getFit();

          const dx = (p.x - dragAction.start.x) / fit.scale;
          const dy = (p.y - dragAction.start.y) / fit.scale;

          worldToLocalPosition(
            part,
            dragAction.startWorld.x + dx,
            dragAction.startWorld.y + dy
          );

          syncEditor();
          render();

        } else if (part && dragAction.type === 'scale') {
          const distance = Math.max(
            1,
            Math.hypot(
              p.x - dragAction.center.x,
              p.y - dragAction.center.y
            )
          );

          part.scale = Math.max(
            5,
            Math.min(
              800,
              dragAction.startScale *
              distance / dragAction.startDistance
            )
          );

          syncEditor();
          render();

        } else if (part && dragAction.type === 'rotate') {
          const angle = Math.atan2(
            p.y - dragAction.center.y,
            p.x - dragAction.center.x
          );

          let delta =
            (angle - dragAction.startAngle) * 180 / Math.PI;

          if (delta > 180) delta -= 360;
          if (delta < -180) delta += 360;

          part.rotation = Math.max(
            -360,
            Math.min(
              360,
              dragAction.startRotation + delta
            )
          );

          syncEditor();
          render();
        }
      }

      return;
    }

    if (!getDrawing() && mode !== 'rect') return;

    lastPointer = e;

    const p = stagePoint(e);

    if (mode === 'free') {
      setFreePoints([...getFreePoints(), p]);
      render();

    } else if (mode === 'erase' || mode === 'restore') {
      brushAt(p);

    } else if (mode === 'rect') {
      setPreviewPoint(p);
      render();
    }
  });

  function finishPointer(e) {
    viewPointers.delete(e.pointerId);

    const mode = getMode();

    if (mode === 'normal') {
      dragAction = null;
      gesture = null;
      return;
    }

    const p = stagePoint(e);
    const startPoint = getStartPoint();

    if (mode === 'rect' && startPoint) {
      cropRect(startPoint, p);
      setStartPoint(null);
      setPreviewPoint(null);
    }

    if (mode === 'free' && getDrawing()) {
      cropFree(getFreePoints());
      setFreePoints([]);
    }

    setDrawing(false);
    lastPointer = null;

    render();
  }

  stage.addEventListener('pointerup', finishPointer);
  stage.addEventListener('pointercancel', finishPointer);
}
