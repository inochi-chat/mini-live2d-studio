
import * as THREE from "three";

// メッシュに新しい頂点を追加する
export function createAddVertexTool() {

  function addVertex(object, worldPosition) {
    if (!object || !object.geometry || !worldPosition) {
      return -1;
    }

    const geometry = object.geometry;
    const oldPosition = geometry.attributes.position;

    if (!oldPosition) return -1;

    // ワールド座標をメッシュのローカル座標に変換
    object.updateMatrixWorld(true);

    const localPosition = object.worldToLocal(
      worldPosition.clone()
    );

    const oldCount = oldPosition.count;
    const newIndex = oldCount;

    // 既存の頂点属性を維持しながら1頂点分拡張
    for (const name of Object.keys(geometry.attributes)) {
      const attribute = geometry.attributes[name];

      if (!attribute.isBufferAttribute) continue;

      const itemSize = attribute.itemSize;
      const oldArray = attribute.array;

      const newArray = new oldArray.constructor(
        (oldCount + 1) * itemSize
      );

      newArray.set(oldArray);

      if (name === "position") {
        newArray[oldCount * itemSize] = localPosition.x;
        newArray[oldCount * itemSize + 1] = localPosition.y;
        newArray[oldCount * itemSize + 2] = localPosition.z;
      } else {
        // その他の属性は近くの頂点から引き継ぐ
        for (let i = 0; i < itemSize; i++) {
          newArray[oldCount * itemSize + i] =
            oldArray[i];
        }
      }

      geometry.setAttribute(
        name,
        new THREE.BufferAttribute(
          newArray,
          itemSize,
          attribute.normalized
        )
      );
    }

    // インデックスがないメッシュにも対応
    if (!geometry.index) {
      const indices = [];

      for (let i = 0; i < oldCount; i++) {
        indices.push(i);
      }

      geometry.setIndex(indices);
    }

    geometry.attributes.position.needsUpdate = true;

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return newIndex;
  }

  return {
    addVertex
  };
}
