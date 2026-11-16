
export function createDragTools(options = {}) {
  const {
    THREE,
    camera,
    raycaster,
    controls,
    updatePointer,
    getSelectedObject,
    getVertexHelper,
    getEdgeHelper,
    getFaceHelper,
    getEdgeRecords,
    getFaceRecords,
    selectedVertexIndices,
    selectedEdgeIndices,
    selectedFaceIndices,
    setDragging,
    saveHistory,
    refreshProperties,
    updateDebugPanel
  } = options;

  let vertexDrag = null;
  let edgeDrag = null;
  let faceDrag = null;

  function createDragPlane(event, localPosition, object) {
    object.updateMatrixWorld(true);

    const worldPosition = object.localToWorld(localPosition.clone());
    const normal = new THREE.Vector3();

    camera.getWorldDirection(normal);

    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      normal,
      worldPosition
    );

    updatePointer(event);

    const startPoint = new THREE.Vector3();

    if (!raycaster.ray.intersectPlane(plane, startPoint)) {
      return null;
    }

    return {
      plane,
      startLocal: object.worldToLocal(startPoint.clone())
    };
  }

  function beginVertexDrag(event, pendingVertex) {
    if (!pendingVertex) return;

    const object = getSelectedObject();
    if (!object) return;

    const positions = object.geometry.attributes.position;
    const index = pendingVertex.index;

    const local = new THREE.Vector3(
      positions.getX(index),
      positions.getY(index),
      positions.getZ(index)
    );

    const drag = createDragPlane(event, local, object);
    if (!drag) return;

    const originalPositions = new Map();

    selectedVertexIndices.forEach((i) => {
      originalPositions.set(
        i,
        new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        )
      );
    });

    vertexDrag = {
      object,
      plane: drag.plane,
      startLocal: drag.startLocal,
      originalPositions
    };

    setDragging(true);
    controls.enabled = false;
  }

  function moveVertices(event) {
    if (!vertexDrag) return;

    updatePointer(event);

    const point = new THREE.Vector3();

    if (!raycaster.ray.intersectPlane(vertexDrag.plane, point)) return;

    const object = vertexDrag.object;
    object.updateMatrixWorld(true);

    const current = object.worldToLocal(point.clone());
    const delta = current.sub(vertexDrag.startLocal);

    const positions = object.geometry.attributes.position;

    vertexDrag.originalPositions.forEach((original, index) => {
      positions.setXYZ(
        index,
        original.x + delta.x,
        original.y + delta.y,
        original.z + delta.z
      );
    });

    positions.needsUpdate = true;

    object.geometry.computeVertexNormals();
    object.geometry.computeBoundingBox();
    object.geometry.computeBoundingSphere();

    const helper = getVertexHelper();

    if (helper) {
      const helperPositions = helper.geometry.attributes.position;

      vertexDrag.originalPositions.forEach((original, index) => {
        helperPositions.setXYZ(
          index,
          original.x + delta.x,
          original.y + delta.y,
          original.z + delta.z
        );
      });

      helperPositions.needsUpdate = true;
    }
  }

  function beginEdgeDrag(event, pendingEdge) {
    if (!pendingEdge) return;

    const object = getSelectedObject();
    if (!object) return;

    const edgeRecords = getEdgeRecords();
    const record = edgeRecords[pendingEdge.index];
    if (!record) return;

    const midpoint = record.a.clone().add(record.b).multiplyScalar(0.5);
    const drag = createDragPlane(event, midpoint, object);

    if (!drag) return;

    const positions = object.geometry.attributes.position;
    const originalPositions = new Map();

    selectedEdgeIndices.forEach((edgeIndex) => {
      const edge = edgeRecords[edgeIndex];
      if (!edge) return;

      [...edge.verticesA, ...edge.verticesB].forEach((index) => {
        if (originalPositions.has(index)) return;

        originalPositions.set(
          index,
          new THREE.Vector3(
            positions.getX(index),
            positions.getY(index),
            positions.getZ(index)
          )
        );
      });
    });

    if (!originalPositions.size) return;

    edgeDrag = {
      object,
      plane: drag.plane,
      startLocal: drag.startLocal,
      originalPositions
    };

    setDragging(true);
    controls.enabled = false;
  }

  function averageVertexPosition(positions, indices) {
    const result = new THREE.Vector3();

    for (const index of indices) {
      result.x += positions.getX(index);
      result.y += positions.getY(index);
      result.z += positions.getZ(index);
    }

    return indices.length
      ? result.multiplyScalar(1 / indices.length)
      : result;
  }

  function moveEdges(event) {
    const helper = getEdgeHelper();

    if (!edgeDrag || !helper) return;

    updatePointer(event);

    const point = new THREE.Vector3();

    if (!raycaster.ray.intersectPlane(edgeDrag.plane, point)) return;

    const object = edgeDrag.object;
    object.updateMatrixWorld(true);

    const current = object.worldToLocal(point.clone());
    const delta = current.sub(edgeDrag.startLocal);

    const positions = object.geometry.attributes.position;

    edgeDrag.originalPositions.forEach((original, index) => {
      positions.setXYZ(
        index,
        original.x + delta.x,
        original.y + delta.y,
        original.z + delta.z
      );
    });

    positions.needsUpdate = true;

    object.geometry.computeVertexNormals();
    object.geometry.computeBoundingBox();
    object.geometry.computeBoundingSphere();

    const helperPositions = helper.geometry.attributes.position;
    const edgeRecords = getEdgeRecords();

    edgeRecords.forEach((edge, index) => {
      const a = averageVertexPosition(positions, edge.verticesA);
      const b = averageVertexPosition(positions, edge.verticesB);

      edge.a.copy(a);
      edge.b.copy(b);

      helperPositions.setXYZ(index * 2, a.x, a.y, a.z);
      helperPositions.setXYZ(index * 2 + 1, b.x, b.y, b.z);
    });

    helperPositions.needsUpdate = true;
    helper.geometry.computeBoundingSphere();
  }

  function beginFaceDrag(event, pendingFace) {
    if (!pendingFace) return;

    const object = getSelectedObject();
    if (!object) return;

    const faceRecords = getFaceRecords();
    const record = faceRecords[pendingFace.index];
    if (!record) return;

    const positions = object.geometry.attributes.position;
    const center = new THREE.Vector3();

    record.vertices.forEach((index) => {
      center.x += positions.getX(index);
      center.y += positions.getY(index);
      center.z += positions.getZ(index);
    });

    center.multiplyScalar(1 / record.vertices.length);

    const drag = createDragPlane(event, center, object);
    if (!drag) return;

    const originalPositions = new Map();

    selectedFaceIndices.forEach((faceIndex) => {
      const face = faceRecords[faceIndex];
      if (!face) return;

      face.vertices.forEach((index) => {
        if (originalPositions.has(index)) return;

        originalPositions.set(
          index,
          new THREE.Vector3(
            positions.getX(index),
            positions.getY(index),
            positions.getZ(index)
          )
        );
      });
    });

    if (!originalPositions.size) return;

    faceDrag = {
      object,
      plane: drag.plane,
      startLocal: drag.startLocal,
      originalPositions
    };

    setDragging(true);
    controls.enabled = false;
  }

  function moveFaces(event) {
    const helper = getFaceHelper();

    if (!faceDrag || !helper) return;

    updatePointer(event);

    const point = new THREE.Vector3();

    if (!raycaster.ray.intersectPlane(faceDrag.plane, point)) return;

    const object = faceDrag.object;
    object.updateMatrixWorld(true);

    const current = object.worldToLocal(point.clone());
    const delta = current.sub(faceDrag.startLocal);

    const positions = object.geometry.attributes.position;

    faceDrag.originalPositions.forEach((original, index) => {
      positions.setXYZ(
        index,
        original.x + delta.x,
        original.y + delta.y,
        original.z + delta.z
      );
    });

    positions.needsUpdate = true;

    object.geometry.computeVertexNormals();
    object.geometry.computeBoundingBox();
    object.geometry.computeBoundingSphere();

    const helperPositions = helper.geometry.attributes.position;
    let offset = 0;

    getFaceRecords().forEach((face) => {
      face.vertices.forEach((index) => {
        helperPositions.setXYZ(
          offset++,
          positions.getX(index),
          positions.getY(index),
          positions.getZ(index)
        );
      });
    });

    helperPositions.needsUpdate = true;
    helper.geometry.computeBoundingSphere();
  }

  function finishVertexDrag() {
    if (!vertexDrag) return;

    vertexDrag = null;
    setDragging(false);
    controls.enabled = true;

    saveHistory();
    refreshProperties();
    updateDebugPanel("頂点を移動しました");
  }

  function finishEdgeDrag() {
    if (!edgeDrag) return;

    edgeDrag = null;
    setDragging(false);
    controls.enabled = true;

    saveHistory();
    refreshProperties();
    updateDebugPanel("辺を移動しました");
  }

  function finishFaceDrag() {
    if (!faceDrag) return;

    faceDrag = null;
    setDragging(false);
    controls.enabled = true;

    saveHistory();
    refreshProperties();
    updateDebugPanel("面を移動しました");
  }

  return {
    beginVertexDrag,
    moveVertices,
    finishVertexDrag,

    beginEdgeDrag,
    moveEdges,
    finishEdgeDrag,

    beginFaceDrag,
    moveFaces,
    finishFaceDrag,

    hasVertexDrag: () => vertexDrag !== null,
    hasEdgeDrag: () => edgeDrag !== null,
    hasFaceDrag: () => faceDrag !== null
  };
}
