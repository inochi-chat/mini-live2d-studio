
export function createHitTestTools(options = {}) {
  const {
    canvas,
    camera,
    raycaster,
    pointer,
    getVertexHelper,
    getEdgeHelper,
    getFaceHelper,
    getFaceTriangleToRecord
  } = options;

  function updatePointer(event) {
    const rect = canvas.getBoundingClientRect();

    pointer.x =
      ((event.clientX - rect.left) / rect.width) * 2 - 1;

    pointer.y =
      -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
  }

  function getVertexHit(event) {
    const helper = getVertexHelper();

    if (!helper) return null;

    updatePointer(event);

    const hits = raycaster.intersectObject(helper, true);

    if (!hits.length) return null;

    const index = hits[0].index;

    return Number.isInteger(index) ? index : null;
  }

  function getEdgeHit(event) {
    const helper = getEdgeHelper();

    if (!helper) return null;

    updatePointer(event);

    const hits = raycaster.intersectObject(helper, true);

    if (!hits.length || hits[0].index == null) {
      return null;
    }

    return Math.floor(hits[0].index / 2);
  }

  function getFaceHit(event) {
    const helper = getFaceHelper();

    if (!helper) return null;

    updatePointer(event);

    const hits = raycaster.intersectObject(helper, true);

    if (!hits.length || hits[0].faceIndex == null) {
      return null;
    }

    const records = getFaceTriangleToRecord();

    return records[hits[0].faceIndex] ?? null;
  }

  return {
    updatePointer,
    getVertexHit,
    getEdgeHit,
    getFaceHit
  };
}
