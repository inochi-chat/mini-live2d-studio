
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

export function paintSelectedFaces(
  object,
  faceTriangleToRecord,
  selectedFaceIndices,
  colorHex
) {
  if (!object || selectedFaceIndices.size === 0) {
    return false;
  }

  const oldGeometry = object.geometry;

  // 面ごとに頂点を分離する
  const geometry = oldGeometry.index
    ? oldGeometry.toNonIndexed()
    : oldGeometry.clone();

  const vertexCount = geometry.attributes.position.count;

  let colors = geometry.attributes.color;

  if (!colors || colors.count !== vertexCount) {
    const values = new Float32Array(vertexCount * 3);
    values.fill(1);

    colors = new THREE.BufferAttribute(values, 3);
    geometry.setAttribute("color", colors);
  }

  const paintColor = new THREE.Color(colorHex);

  // 選択された面に対応する三角形を塗る
  for (let triangleIndex = 0;
       triangleIndex < faceTriangleToRecord.length;
       triangleIndex++) {

    const recordIndex = faceTriangleToRecord[triangleIndex];

    if (!selectedFaceIndices.has(recordIndex)) continue;

    for (let vertex = 0; vertex < 3; vertex++) {
      const index = triangleIndex * 3 + vertex;

      if (index >= colors.count) continue;

      colors.setXYZ(
        index,
        paintColor.r,
        paintColor.g,
        paintColor.b
      );
    }
  }

  colors.needsUpdate = true;

  // 頂点カラーを表示できるようにする
  const materials = Array.isArray(object.material)
    ? object.material
    : [object.material];

  materials.forEach(material => {
    material.vertexColors = true;
    material.color.set(0xffffff);
    material.needsUpdate = true;
  });

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  oldGeometry.dispose();
  object.geometry = geometry;

  return true;
}
