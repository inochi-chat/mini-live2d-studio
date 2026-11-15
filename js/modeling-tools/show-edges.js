
import { findMatchingVertices } from "./vertex-utils.js";

export function createShowEdgesTool(options = {}) {
  const {
    THREE,
    setEdgeHelper,
    setEdgeRecords,
    clearEdgeHelper,
    updateEdgeColors
  } = options;

  function showEdges(object) {
    if (!object || !object.geometry) return;

    clearEdgeHelper();

    const geometry = object.geometry;
    geometry.computeBoundingBox();

    const bounds = geometry.boundingBox;
    if (!bounds) return;

    const min = bounds.min;
    const max = bounds.max;

    const corners = [
      new THREE.Vector3(min.x, min.y, min.z),
      new THREE.Vector3(max.x, min.y, min.z),
      new THREE.Vector3(min.x, max.y, min.z),
      new THREE.Vector3(max.x, max.y, min.z),
      new THREE.Vector3(min.x, min.y, max.z),
      new THREE.Vector3(max.x, min.y, max.z),
      new THREE.Vector3(min.x, max.y, max.z),
      new THREE.Vector3(max.x, max.y, max.z)
    ];

    const positions = [];
    const records = [];

    for (let i = 0; i < corners.length; i++) {
      for (let j = i + 1; j < corners.length; j++) {
        const a = corners[i];
        const b = corners[j];

        const axes =
          Number(Math.abs(a.x - b.x) > 0.0001) +
          Number(Math.abs(a.y - b.y) > 0.0001) +
          Number(Math.abs(a.z - b.z) > 0.0001);

        if (axes !== 1) continue;

        const verticesA = findMatchingVertices(object, a);
        const verticesB = findMatchingVertices(object, b);

        if (!verticesA.length || !verticesB.length) continue;

        records.push({
          a: a.clone(),
          b: b.clone(),
          verticesA,
          verticesB
        });

        positions.push(
          a.x, a.y, a.z,
          b.x, b.y, b.z
        );
      }
    }

    setEdgeRecords(records);

    if (!records.length) return;

    const lineGeometry = new THREE.BufferGeometry();

    lineGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );

    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      depthTest: false,
      depthWrite: false
    });

    const helper = new THREE.LineSegments(
      lineGeometry,
      material
    );

    helper.renderOrder = 999;

    object.add(helper);
    setEdgeHelper(helper);

    updateEdgeColors();
  }

  return {
    showEdges
  };
}
