
import { moveMeshVertex } from './mesh-deformer.js';

// メッシュ頂点の操作を管理
export function createMeshInteraction(options = {}) {
  const {
    getMesh,
    getPointerPosition,
    onChange = () => {},
    hitRadius = 14
  } = options;

  let selectedVertex = -1;
  let dragging = false;

  function findVertex(point) {
    const mesh = getMesh();
    if (!mesh || !point) return -1;

    let nearest = -1;
    let nearestDistance = hitRadius * hitRadius;

    mesh.vertices.forEach((vertex, index) => {
      const dx = vertex.x - point.x;
      const dy = vertex.y - point.y;
      const distance = dx * dx + dy * dy;

      if (distance <= nearestDistance) {
        nearest = index;
        nearestDistance = distance;
      }
    });

    return nearest;
  }

  function pointerDown(event) {
    const point = getPointerPosition(event);
    const index = findVertex(point);

    if (index < 0) return false;

    selectedVertex = index;
    dragging = true;
    onChange();

    return true;
  }

  function pointerMove(event) {
    if (!dragging) return false;

    const mesh = getMesh();
    const point = getPointerPosition(event);

    if (!mesh || !point) return false;

    moveMeshVertex(
      mesh,
      selectedVertex,
      point.x,
      point.y
    );

    onChange();
    return true;
  }

  function pointerUp() {
    if (!dragging) return false;

    dragging = false;
    onChange();

    return true;
  }

  function attach(element) {
    if (!element) return;

    element.addEventListener('pointerdown', handleDown);
    element.addEventListener('pointermove', handleMove);
    element.addEventListener('pointerup', handleUp);
    element.addEventListener('pointercancel', handleUp);
  }

  function detach(element) {
    if (!element) return;

    element.removeEventListener('pointerdown', handleDown);
    element.removeEventListener('pointermove', handleMove);
    element.removeEventListener('pointerup', handleUp);
    element.removeEventListener('pointercancel', handleUp);
  }

  function handleDown(event) {
    if (pointerDown(event)) {
      event.preventDefault();
      event.stopPropagation();

      if (event.currentTarget.setPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }
  }

  function handleMove(event) {
    if (pointerMove(event)) {
      event.preventDefault();
    }
  }

  function handleUp(event) {
    if (pointerUp()) {
      event.preventDefault();
    }
  }

  return {
    attach,
    detach,
    pointerDown,
    pointerMove,
    pointerUp,
    getSelectedVertex: () => selectedVertex,
    isDragging: () => dragging
  };
}
