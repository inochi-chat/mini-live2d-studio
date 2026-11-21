
import * as THREE from "three";

export function createEditHelpers({
  getVertexHelper,
  setVertexHelper,
  getEdgeHelper,
  setEdgeHelper,
  setFaceTriangleToRecord,
  getFaceHelper,
  setFaceHelper,
  getEdgeRecords,
  setEdgeRecords,
  getFaceRecords,
  setFaceRecords,
  selectedVertexIndices,
  selectedEdgeIndices,
  selectedFaceIndices
}) {
  function disposeHelper(helper) {
    if (!helper) return;

    helper.parent?.remove(helper);
    helper.geometry?.dispose();

    if (Array.isArray(helper.material)) {
      helper.material.forEach((material) => material.dispose());
    } else {
      helper.material?.dispose();
    }
  }

  function clearVertexHelper() {
    const helper = getVertexHelper();
    if (!helper) return;

    disposeHelper(helper);
    setVertexHelper(null);
  }

  function clearEdgeHelper() {
    const helper = getEdgeHelper();

    if (!helper) {
      setEdgeRecords([]);
      return;
    }

    disposeHelper(helper);
    setEdgeHelper(null);
    setEdgeRecords([]);
  }

  function clearFaceHelper() {
    const helper = getFaceHelper();

    if (!helper) {
      setFaceRecords([]);
      setFaceTriangleToRecord([]);
      return;
    }

    disposeHelper(helper);
    setFaceHelper(null);
    setFaceRecords([]);
    setFaceTriangleToRecord([]);
  }

  function updateVertexColors() {
    const helper = getVertexHelper();
    if (!helper) return;

    const positions = helper.geometry.attributes.position;
    const colors = [];

    for (let i = 0; i < positions.count; i++) {
      const color = new THREE.Color(
        selectedVertexIndices.has(i) ? 0xff6600 : 0xffff00
      );

      colors.push(color.r, color.g, color.b);
    }

    helper.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );

    helper.geometry.attributes.color.needsUpdate = true;
  }

  function updateEdgeColors() {
    const helper = getEdgeHelper();
    if (!helper) return;

    const records = getEdgeRecords();
    const colors = [];

    for (let i = 0; i < records.length; i++) {
      const color = new THREE.Color(
        selectedEdgeIndices.has(i) ? 0xff6600 : 0xffff00
      );

      colors.push(
        color.r, color.g, color.b,
        color.r, color.g, color.b
      );
    }

    helper.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );

    helper.geometry.attributes.color.needsUpdate = true;
  }

  function updateFaceColors() {
    const helper = getFaceHelper();
    if (!helper) return;

    const records = getFaceRecords();
    const colors = [];

    records.forEach((face, index) => {
      const color = new THREE.Color(
        selectedFaceIndices.has(index) ? 0xff6600 : 0xffff00
      );

      for (let i = 0; i < face.vertices.length; i++) {
        colors.push(color.r, color.g, color.b);
      }
    });

    helper.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );

    helper.geometry.attributes.color.needsUpdate = true;
  }

  return {
    clearVertexHelper,
    clearEdgeHelper,
    clearFaceHelper,
    updateVertexColors,
    updateEdgeColors,
    updateFaceColors
  };
}
