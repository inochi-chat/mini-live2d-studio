
import * as THREE from "three";

export function createEditHelpers({
  scene,
  selectedVertexIndices,
  selectedEdgeIndices,
  selectedFaceIndices
}) {
  let vertexHelper = null;
  let edgeHelper = null;
  let faceHelper = null;

  let edgeRecords = [];
  let faceRecords = [];
  let faceTriangleToRecord = [];

  function clearVertexHelper() {
    if (!vertexHelper) return;

    vertexHelper.parent?.remove(vertexHelper);
    vertexHelper.geometry.dispose();

    if (Array.isArray(vertexHelper.material)) {
      vertexHelper.material.forEach((material) => material.dispose());
    } else {
      vertexHelper.material.dispose();
    }

    vertexHelper = null;
  }

  function clearEdgeHelper() {
    if (!edgeHelper) {
      edgeRecords = [];
      return;
    }

    edgeHelper.parent?.remove(edgeHelper);
    edgeHelper.geometry.dispose();

    if (Array.isArray(edgeHelper.material)) {
      edgeHelper.material.forEach((material) => material.dispose());
    } else {
      edgeHelper.material.dispose();
    }

    edgeHelper = null;
    edgeRecords = [];
  }

  function clearFaceHelper() {
    if (!faceHelper) {
      faceRecords = [];
      faceTriangleToRecord = [];
      return;
    }

    faceHelper.parent?.remove(faceHelper);
    faceHelper.geometry.dispose();

    if (Array.isArray(faceHelper.material)) {
      faceHelper.material.forEach((material) => material.dispose());
    } else {
      faceHelper.material.dispose();
    }

    faceHelper = null;
    faceRecords = [];
    faceTriangleToRecord = [];
  }

  function updateVertexColors() {
    if (!vertexHelper) return;

    const positions = vertexHelper.geometry.attributes.position;
    const colors = [];

    for (let i = 0; i < positions.count; i++) {
      const color = new THREE.Color(
        selectedVertexIndices.has(i) ? 0xff6600 : 0xffff00
      );

      colors.push(color.r, color.g, color.b);
    }

    vertexHelper.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );

    vertexHelper.geometry.attributes.color.needsUpdate = true;
  }

  function updateEdgeColors() {
    if (!edgeHelper) return;

    const colors = [];

    for (let i = 0; i < edgeRecords.length; i++) {
      const color = new THREE.Color(
        selectedEdgeIndices.has(i) ? 0xff6600 : 0xffff00
      );

      colors.push(
        color.r, color.g, color.b,
        color.r, color.g, color.b
      );
    }

    edgeHelper.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );

    edgeHelper.geometry.attributes.color.needsUpdate = true;
  }

  function updateFaceColors() {
    if (!faceHelper) return;

    const colors = [];

    faceRecords.forEach((face, index) => {
      const color = new THREE.Color(
        selectedFaceIndices.has(index) ? 0xff6600 : 0xffff00
      );

      for (let i = 0; i < face.vertices.length; i++) {
        colors.push(color.r, color.g, color.b);
      }
    });

    faceHelper.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );

    faceHelper.geometry.attributes.color.needsUpdate = true;
  }

  return {
    getVertexHelper: () => vertexHelper,
    getEdgeHelper: () => edgeHelper,
    getFaceHelper: () => faceHelper,

    setVertexHelper: (helper) => {
      vertexHelper = helper;
    },
    setEdgeHelper: (helper) => {
      edgeHelper = helper;
    },
    setFaceHelper: (helper) => {
      faceHelper = helper;
    },

    getEdgeRecords: () => edgeRecords,
    getFaceRecords: () => faceRecords,
    getFaceTriangleToRecord: () => faceTriangleToRecord,

    setEdgeRecords: (records) => {
      edgeRecords = records;
    },
    setFaceRecords: (records) => {
      faceRecords = records;
    },
    setFaceTriangleToRecord: (records) => {
      faceTriangleToRecord = records;
    },

    clearVertexHelper,
    clearEdgeHelper,
    clearFaceHelper,

    updateVertexColors,
    updateEdgeColors,
    updateFaceColors
  };
}
