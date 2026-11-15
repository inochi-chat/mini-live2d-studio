
export function createMergeVerticesTool(options = {}) {
  const {
    getSelectedObject,
    updateEditDisplay,
    refreshObjectList,
    refreshProperties,
    saveHistory,
    updateDebugPanel
  } = options;

  function mergeSelectedVertices() {
    const object = getSelectedObject();

    if (!object) {
      alert("頂点を結合するオブジェクトを選択してください。");
      return;
    }

    const input = document.getElementById("mergeTolerance");
    const tolerance = input ? Number(input.value) : 0.001;

    if (!Number.isFinite(tolerance) || tolerance <= 0) {
      alert("結合距離を正しく入力してください。");
      return;
    }

    const oldGeometry = object.geometry;
    const positions = oldGeometry.attributes.position;
    const oldVertexCount = positions.count;
    const oldIndex = oldGeometry.index;

    const sourceIndices = oldIndex
      ? Array.from(oldIndex.array)
      : Array.from({ length: positions.count }, (_, i) => i);

    const uniquePositions = [];
    const newIndices = [];
    const cells = new Map();

    function cellKey(x, y, z) {
      return `${x},${y},${z}`;
    }

    function findVertex(x, y, z) {
      const cx = Math.floor(x / tolerance);
      const cy = Math.floor(y / tolerance);
      const cz = Math.floor(z / tolerance);

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const key = cellKey(cx + dx, cy + dy, cz + dz);
            const candidates = cells.get(key) || [];

            for (const index of candidates) {
              const p = uniquePositions[index];

              const distance = Math.hypot(
                p[0] - x,
                p[1] - y,
                p[2] - z
              );

              if (distance <= tolerance) return index;
            }
          }
        }
      }

      const index = uniquePositions.length;
      uniquePositions.push([x, y, z]);

      const key = cellKey(cx, cy, cz);

      if (!cells.has(key)) {
        cells.set(key, []);
      }

      cells.get(key).push(index);

      return index;
    }

    for (const oldIndexValue of sourceIndices) {
      const index = findVertex(
        positions.getX(oldIndexValue),
        positions.getY(oldIndexValue),
        positions.getZ(oldIndexValue)
      );

      newIndices.push(index);
    }

    const newGeometry = new THREE.BufferGeometry();
    const flatPositions = uniquePositions.flat();

    newGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(flatPositions, 3)
    );

    newGeometry.setIndex(newIndices);
    newGeometry.computeVertexNormals();
    newGeometry.computeBoundingBox();
    newGeometry.computeBoundingSphere();

    oldGeometry.dispose();
    object.geometry = newGeometry;

    updateEditDisplay();
    refreshObjectList();
    refreshProperties();
    saveHistory();

    updateDebugPanel(
      "頂点を結合しました：" +
      oldVertexCount + " → " +
      uniquePositions.length
    );

    alert(
      "頂点を結合しました！\n" +
      "結合前：" + oldVertexCount + "\n" +
      "結合後：" + uniquePositions.length
    );
  }

  return {
    mergeSelectedVertices
  };
}
