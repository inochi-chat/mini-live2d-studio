
export function createShowFacesTool(options = {}) {
  const {
    THREE,
    setFaceHelper,
    setFaceRecords,
    setFaceTriangleToRecord,
    clearFaceHelper,
    updateFaceColors,
    updateDebugPanel
  } = options;

  function showFaces(object) {
    if (!object || !object.geometry) return;

    clearFaceHelper();

    const geometry = object.geometry;
    const positions = geometry.attributes.position;
    const indexAttribute = geometry.index;

    if (!positions) {
      updateDebugPanel("面データがありません");
      return;
    }

    const facePositions = [];
    const records = [];
    const triangleToRecord = [];

    if (
      geometry.type === "BoxGeometry" &&
      indexAttribute &&
      geometry.groups.length === 6
    ) {
      geometry.groups.forEach((group, faceIndex) => {
        const vertices = [];

        for (
          let i = group.start;
          i < group.start + group.count;
          i++
        ) {
          const vertexIndex = indexAttribute.getX(i);

          vertices.push(vertexIndex);

          facePositions.push(
            positions.getX(vertexIndex),
            positions.getY(vertexIndex),
            positions.getZ(vertexIndex)
          );
        }

        records.push({ vertices, faceIndex });

        triangleToRecord.push(records.length - 1);
        triangleToRecord.push(records.length - 1);
      });
    } else {
      const count = indexAttribute
        ? indexAttribute.count
        : positions.count;

      for (let i = 0; i + 2 < count; i += 3) {
        const vertices = [];

        for (let j = 0; j < 3; j++) {
          const vertexIndex = indexAttribute
            ? indexAttribute.getX(i + j)
            : i + j;

          vertices.push(vertexIndex);

          facePositions.push(
            positions.getX(vertexIndex),
            positions.getY(vertexIndex),
            positions.getZ(vertexIndex)
          );
        }

        records.push({
          vertices,
          faceIndex: records.length
        });

        triangleToRecord.push(records.length - 1);
      }
    }

    setFaceRecords(records);
    setFaceTriangleToRecord(triangleToRecord);

    if (!records.length) {
      updateDebugPanel("面を作成できませんでした");
      return;
    }

    const faceGeometry = new THREE.BufferGeometry();

    faceGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(facePositions, 3)
    );

    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false
    });

    const helper = new THREE.Mesh(faceGeometry, material);
    helper.renderOrder = 998;

    object.add(helper);
    setFaceHelper(helper);

    updateFaceColors();
    updateDebugPanel("面を表示しました");
  }

  return {
    showFaces
  };
}
