
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
  getSourceCanvas,
  meshEditor
}) {
  const viewPointers = new Map();

  let gesture = null;
  let dragAction = null;
  let lastPointer = null;
  let meshDrag = null;

  // ステージ座標をメッシュの画像内座標に変換
  function toMeshPoint(point, part) {
    const info = partScreenInfo(part);
    const factor = info.w / part.w;

    if (!Number.isFinite(factor) || factor <= 0) {
      return null;
    }

    const dx = point.x - info.cx;
    const dy = point.y - info.cy;

    const cos = Math.cos(info.angle);
    const sin = Math.sin(info.angle);

    return {
      x: (dx * cos + dy * sin) / factor + part.w / 2,
      y: (-dx * sin + dy * cos) / factor + part.h / 2,
      factor
    };
  }

  stage.addEventListener('pointerdown', e => {
    const p = stagePoint(e);

    lastPointer = e;
    viewPointers.set(e.pointerId, p);

    stage.setPointerCapture(e.pointerId);

    const mode = getMode();

    // メッシュ編集
    if (mode === 'mesh') {
      const part = getSelected();

      if (!part || !meshEditor) return;

      meshEditor.setPart(part);

      if (!meshEditor.hasMesh()) {
        if (!meshEditor.initialize()) return;
      }

      const local = toMeshPoint(p, part);

      if (!local) return;

      const index = meshEditor.findVertex(
        local.x,
        local.y,
        14 / local.factor
      );

      if (index < 0) return;

      saveUndo();

      meshEditor.selectVertex(index);

      meshDrag = {
        index,
        partId: part.id
      };

      e.preventDefault();
      return;
    }

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

    // メッシュ頂点の移動
    if (mode === 'mesh' && meshDrag) {
      const part = getParts().find(
        p => p.id === meshDrag.partId
      );

      if (!part) return;

      const local = toMeshPoint(
        stagePoint(e),
        part
      );

      if (!local) return;

      meshEditor.moveVertex(
        meshDrag.index,
        local.x,
        local.y
      );

      e.preventDefault();
      return;
    }

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

    if (mode === 'mesh') {
      meshDrag = null;
      return;
    }

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
