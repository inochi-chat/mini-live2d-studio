import * as THREE from "three";

export function createExtrudeTool(options = {}) {
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

  function extrudeSelectedFaces() {
    const object = getSelectedObject();
    const faceRecords = getFaceRecords();
    const faceTriangleToRecord = getFaceTriangleToRecord();

    if (!object || getEditMode() !== "face") {
      alert("面モードで面を選択してください。");
      return;
    }

    if (selectedFaceIndices.size === 0) {
      alert("押し出す面を選択してください。");
      return;
    }

    const distanceInput = document.getElementById("extrudeDistance");
    const distance = distanceInput
      ? Number(distanceInput.value)
      : 0.5;

    if (!Number.isFinite(distance) || distance === 0) {
      alert("押し出す距離に0以外の数値を入力してください。");
      return;
    }

    const geometry = object.geometry;
    const positions = geometry.attributes.position;
    const indexAttribute = geometry.index;

    const count = indexAttribute
      ? indexAttribute.count
      : positions.count;

    const newPositions = [];
    const topTriangleIndices = [];

    function getPoint(index) {
      return new THREE.Vector3(
        positions.getX(index),
        positions.getY(index),
        positions.getZ(index)
      );
    }

    function addTriangle(a, b, c, isTop = false) {
      const triangleIndex = newPositions.length / 9;

      newPositions.push(
        a.x, a.y, a.z,
        b.x, b.y, b.z,
        c.x, c.y, c.z
      );

      if (isTop) {
        topTriangleIndices.push(triangleIndex);
      }
    }

    function addSide(a, b, normal) {
      const a2 = a.clone().add(normal);
      const b2 = b.clone().add(normal);

      addTriangle(a, b, b2);
      addTriangle(a, b2, a2);
    }

    const offsets = new Map();

    selectedFaceIndices.forEach((faceIndex) => {
      const face = faceRecords[faceIndex];

      if (!face || face.vertices.length < 3) return;

      const a = getPoint(face.vertices[0]);
      const b = getPoint(face.vertices[1]);
      const c = getPoint(face.vertices[2]);

      const normal = new THREE.Vector3()
        .subVectors(b, a)
        .cross(new THREE.Vector3().subVectors(c, a))
        .normalize();

      offsets.set(
        faceIndex,
        normal.multiplyScalar(distance)
      );
    });

    if (!offsets.size) {
      alert("押し出せる面がありません。");
      return;
    }

    for (let i = 0; i + 2 < count; i += 3) {
      const triangleIndex = i / 3;
      const recordIndex = faceTriangleToRecord[triangleIndex];

      const aIndex = indexAttribute
        ? indexAttribute.getX(i)
        : i;

      const bIndex = indexAttribute
        ? indexAttribute.getX(i + 1)
        : i + 1;

      const cIndex = indexAttribute
        ? indexAttribute.getX(i + 2)
        : i + 2;

      const a = getPoint(aIndex);
      const b = getPoint(bIndex);
      const c = getPoint(cIndex);

      const offset = offsets.get(recordIndex);

      if (offset) {
        addTriangle(
          a.clone().add(offset),
          b.clone().add(offset),
          c.clone().add(offset),
          true
        );
      } else {
        addTriangle(a, b, c);
      }
    }

    offsets.forEach((normal, faceIndex) => {
      const face = faceRecords[faceIndex];
      const edgeCounts = new Map();
      const edgePoints = new Map();

      for (
        let i = 0;
        i + 2 < face.vertices.length;
        i += 3
      ) {
        const triangle = [
          face.vertices[i],
          face.vertices[i + 1],
          face.vertices[i + 2]
        ];

        for (let j = 0; j < 3; j++) {
          const aIndex = triangle[j];
          const bIndex = triangle[(j + 1) % 3];

          const key = [aIndex, bIndex]
            .sort((a, b) => a - b)
            .join("_");

          edgeCounts.set(
            key,
            (edgeCounts.get(key) || 0) + 1
          );

          edgePoints.set(key, [aIndex, bIndex]);
        }
      }

      edgeCounts.forEach((edgeCount, key) => {
        if (edgeCount !== 1) return;

        const [aIndex, bIndex] = edgePoints.get(key);

        addSide(
          getPoint(aIndex),
          getPoint(bIndex),
          normal
        );
      });
    });

    const newGeometry = new THREE.BufferGeometry();

    newGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(newPositions, 3)
    );

    newGeometry.computeVertexNormals();
    newGeometry.computeBoundingBox();
    newGeometry.computeBoundingSphere();

    geometry.dispose();
    object.geometry = newGeometry;

    if (Array.isArray(object.material)) {
      object.material.forEach(material => {
        material.side = THREE.DoubleSide;
      });
    } else {
      object.material.side = THREE.DoubleSide;
    }

    updateEditDisplay();

    selectedFaceIndices.clear();

    topTriangleIndices.forEach((triangleIndex) => {
      const faceIndex = faceTriangleToRecord[triangleIndex];

      if (faceIndex !== undefined) {
        selectedFaceIndices.add(faceIndex);
      }
    });

    updateFaceColors();
    refreshObjectList();
    refreshProperties();
    saveHistory();

    updateDebugPanel(
      "先端面：" + selectedFaceIndices.size + "個を選択"
    );
  }

  return {
    extrudeSelectedFaces
  };
}
