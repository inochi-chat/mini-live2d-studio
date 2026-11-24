
// メッシュ変形の基本処理

// メッシュを生成
export function createMesh(width, height, columns = 4, rows = 4) {
  const vertices = [];
  const originalVertices = [];
  const triangles = [];

  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x <= columns; x++) {
      const px = (width / columns) * x;
      const py = (height / rows) * y;

      const vertex = { x: px, y: py };

      vertices.push({ ...vertex });
      originalVertices.push({ ...vertex });
    }
  }

  // 三角形を作成
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const a = y * (columns + 1) + x;
      const b = a + 1;
      const c = a + columns + 1;
      const d = c + 1;

      triangles.push([a, b, c]);
      triangles.push([b, d, c]);
    }
  }

  return {
    width,
    height,
    columns,
    rows,
    vertices,
    originalVertices,
    triangles
  };
}

// 頂点を移動
export function moveMeshVertex(mesh, index, x, y) {
  if (!mesh || !mesh.vertices[index]) return;

  mesh.vertices[index].x = x;
  mesh.vertices[index].y = y;
}

// メッシュを元の形に戻す
export function resetMesh(mesh) {
  if (!mesh) return;

  mesh.vertices = mesh.originalVertices.map(vertex => ({
    x: vertex.x,
    y: vertex.y
  }));
}

// 頂点の初期位置を保存
export function saveMeshOriginal(mesh) {
  if (!mesh) return;

  mesh.originalVertices = mesh.vertices.map(vertex => ({
    x: vertex.x,
    y: vertex.y
  }));
}
