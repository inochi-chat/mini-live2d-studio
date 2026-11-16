
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

    if (!positions || !indexAttribute) {
      updateDebugPanel("面データがありません");
      return;
    }

    const facePositions = [];
    const records = [];
    const triangleToRecord = [];

    const customFaces = object.userData?.customFaces || [];

    // 自作した面の三角形番号を調べる
    const customTriangleMap = new Map();

    for (const customFace of customFaces) {
      const startIndex = customFace.startIndex;
      const triangleCount = customFace.triangleCount;

      if (
        !Number.isInteger(startIndex) ||
        !Number.isInteger(triangleCount) ||
        startIndex < 0 ||
        triangleCount < 1 ||
        startIndex + triangleCount * 3 > indexAttribute.count
      ) {
        continue;
      }

      const firstTriangle = Math.floor(startIndex / 3);

      for (let i = 0; i < triangleCount; i++) {
        customTriangleMap.set(
          firstTriangle + i,
          customFace
        );
      }
    }

    function addTrianglePositions(indices) {
      for (const vertexIndex of indices) {
        facePositions.push(
          positions.getX(vertexIndex),
          positions.getY(vertexIndex),
          positions.getZ(vertexIndex)
        );
      }
    }

    // BoxGeometryの元の四角形をまとめて表示
    if (
      geometry.type === "BoxGeometry" &&
      geometry.groups.length >= 6
    ) {
      for (let groupIndex = 0; groupIndex < 6; groupIndex++) {
        const group = geometry.groups[groupIndex];
        const vertices = [];

        for (
          let i = group.start;
          i < group.start + group.count;
          i++
        ) {
          const vertexIndex = indexAttribute.getX(i);
          vertices.push(vertexIndex);
        }

        if (vertices.length < 3) continue;

        const recordIndex = records.length;

        records.push({
          vertices,
          faceIndex: recordIndex
        });

        for (let i = 0; i + 2 < vertices.length; i += 3) {
          addTrianglePositions([
            vertices[i],
            vertices[i + 1],
            vertices[i + 2]
          ]);

          triangleToRecord.push(recordIndex);
        }
      }
    } else {
      // 通常のジオメトリは三角形ごとに表示
      const triangleCount = Math.floor(indexAttribute.count / 3);

      for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex++) {
        // 自作面の三角形は後でまとめて登録する
        if (customTriangleMap.has(triangleIndex)) {
          continue;
        }

        const offset = triangleIndex * 3;

        const vertices = [
          indexAttribute.getX(offset),
          indexAttribute.getX(offset + 1),
          indexAttribute.getX(offset + 2)
        ];

        const recordIndex = records.length;

        records.push({
          vertices,
          faceIndex: recordIndex
        });

        addTrianglePositions(vertices);
        triangleToRecord.push(recordIndex);
      }
    }

    // 自作した三角形・四角形をまとめて登録
    for (const customFace of customFaces) {
      const startIndex = customFace.startIndex;
      const triangleCount = customFace.triangleCount;

      if (
        !Number.isInteger(startIndex) ||
        !Number.isInteger(triangleCount) ||
        startIndex < 0 ||
        triangleCount < 1 ||
        startIndex + triangleCount * 3 > indexAttribute.count
      ) {
        continue;
      }

      const vertices = [];
      const recordIndex = records.length;

      for (let i = 0; i < triangleCount; i++) {
        const offset = startIndex + i * 3;

        const triangle = [
          indexAttribute.getX(offset),
          indexAttribute.getX(offset + 1),
          indexAttribute.getX(offset + 2)
        ];

        vertices.push(...triangle);
        addTrianglePositions(triangle);
        triangleToRecord.push(recordIndex);
      }

      records.push({
        vertices,
        faceIndex: recordIndex
      });
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

  return { showFaces };
}
