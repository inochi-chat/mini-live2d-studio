
import * as THREE from "three";

export function createInsetTool(options = {}) {
  const {
    getSelectedObject,
    getEditMode,
    selectedFaceIndices,
    getFaceRecords,
    getFaceTriangleToRecord,
    updateEditDisplay,
    updateFaceColors,
    refreshObjectList,
    refreshProperties,
    saveHistory,
    updateDebugPanel
  } = options;

  function insetSelectedFaces() {
    const object = getSelectedObject();
    const faceRecords = getFaceRecords();
    const faceTriangleToRecord = getFaceTriangleToRecord();

    if (!object || getEditMode() !== "face") {
      alert("面モードで面を選択してください。");
      return;
    }

    if (selectedFaceIndices.size === 0) {
      alert("差し込む面を選択してください。");
      return;
    }

    const input = document.getElementById("insetAmount");
    const amount = input ? Number(input.value) : 0.1;

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("差し込み幅を入力してください。");
      return;
    }

    const geometry = object.geometry;
    const positions = geometry.attributes.position;
    const output = [];
    const innerTriangleIndices = [];

    function getPoint(index) {
      return new THREE.Vector3(
        positions.getX(index),
        positions.getY(index),
        positions.getZ(index)
      );
    }

    function addTriangle(a, b, c, isInner = false) {
      const triangleIndex = output.length / 9;

      output.push(
        a.x, a.y, a.z,
        b.x, b.y, b.z,
        c.x, c.y, c.z
      );

      if (isInner) innerTriangleIndices.push(triangleIndex);
    }

    for (let faceIndex = 0; faceIndex < faceRecords.length; faceIndex++) {
      const face = faceRecords[faceIndex];
      const vertices = face.vertices;

      if (!selectedFaceIndices.has(faceIndex)) {
        for (let i = 0; i + 2 < vertices.length; i += 3) {
          addTriangle(
            getPoint(vertices[i]),
            getPoint(vertices[i + 1]),
            getPoint(vertices[i + 2])
          );
        }
        continue;
      }

      const edgeMap = new Map();

      for (let i = 0; i + 2 < vertices.length; i += 3) {
        const triangle = vertices.slice(i, i + 3);

        for (let j = 0; j < 3; j++) {
          const a = triangle[j];
          const b = triangle[(j + 1) % 3];
          const key = Math.min(a, b) + "_" + Math.max(a, b);

          if (edgeMap.has(key)) {
            edgeMap.delete(key);
          } else {
            edgeMap.set(key, [a, b]);
          }
        }
      }

      const edges = [...edgeMap.values()];

      if (edges.length < 3) continue;

      const loop = [edges[0][0], edges[0][1]];
      const used = new Set([0]);

      while (loop.length <= edges.length) {
        const last = loop[loop.length - 1];
        if (last === loop[0]) break;

        let found = false;

        for (let i = 0; i < edges.length; i++) {
          if (used.has(i)) continue;

          const [a, b] = edges[i];

          if (a === last || b === last) {
            loop.push(a === last ? b : a);
            used.add(i);
            found = true;
            break;
          }
        }

        if (!found) break;
      }

      if (loop.length < 4 || loop[loop.length - 1] !== loop[0]) {
        for (let i = 0; i + 2 < vertices.length; i += 3) {
          addTriangle(
            getPoint(vertices[i]),
            getPoint(vertices[i + 1]),
            getPoint(vertices[i + 2])
          );
        }
        continue;
      }

      loop.pop();

      const outer = loop.map(getPoint);
      const center = new THREE.Vector3();

      outer.forEach(point => center.add(point));
      center.divideScalar(outer.length);

      const inset = THREE.MathUtils.clamp(amount, 0.01, 0.95);

      const inner = outer.map(point =>
        center.clone().add(
          point.clone().sub(center).multiplyScalar(1 - inset)
        )
      );

      for (let i = 0; i < outer.length; i++) {
        const next = (i + 1) % outer.length;

        addTriangle(outer[i], outer[next], inner[next]);
        addTriangle(outer[i], inner[next], inner[i]);
      }

      for (let i = 1; i < inner.length - 1; i++) {
        addTriangle(inner[0], inner[i], inner[i + 1], true);
      }
    }

    const newGeometry = new THREE.BufferGeometry();

    newGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(output, 3)
    );

    newGeometry.computeVertexNormals();
    newGeometry.computeBoundingBox();
    newGeometry.computeBoundingSphere();

    geometry.dispose();
    object.geometry = newGeometry;
    object.material.side = THREE.DoubleSide;

    updateEditDisplay();

    innerTriangleIndices.forEach(triangleIndex => {
      const faceIndex = faceTriangleToRecord[triangleIndex];

      if (faceIndex !== undefined) {
        selectedFaceIndices.add(faceIndex);
      }
    });

    updateFaceColors();
    refreshObjectList();
    refreshProperties();
    saveHistory();

    updateDebugPanel("面を差し込みました");
  }

  return { insetSelectedFaces };
}
