
export function createFaceTool(options = {}) {
  const {
    getSelectedObject,
    selectedVertexIndices,
    saveHistory,
    refreshProperties,
    updateDebugPanel
  } = options;

  function createFaceFromSelectedVertices() {
    const object = getSelectedObject();

    if (!object || !object.geometry) {
      return {
        success: false,
        message: "オブジェクトを選択してください"
      };
    }

    const indices = Array.from(selectedVertexIndices);

    if (indices.length !== 3 && indices.length !== 4) {
      return {
        success: false,
        message: "面を作る頂点を3つまたは4つ選択してください"
      };
    }

    const geometry = object.geometry;
    const position = geometry.attributes.position;

    if (!position) {
      return {
        success: false,
        message: "頂点データがありません"
      };
    }

    for (const index of indices) {
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= position.count
      ) {
        return {
          success: false,
          message: "選択した頂点が正しくありません"
        };
      }
    }

    // 同じ頂点が重複していないか確認
    if (new Set(indices).size !== indices.length) {
      return {
        success: false,
        message: "同じ頂点は使用できません"
      };
    }

    // 面の頂点が一直線上にないか確認
    const THREE = object.userData?.THREE;

    const a = {
      x: position.getX(indices[0]),
      y: position.getY(indices[0]),
      z: position.getZ(indices[0])
    };

    const b = {
      x: position.getX(indices[1]),
      y: position.getY(indices[1]),
      z: position.getZ(indices[1])
    };

    const c = {
      x: position.getX(indices[2]),
      y: position.getY(indices[2]),
      z: position.getZ(indices[2])
    };

    const ab = {
      x: b.x - a.x,
      y: b.y - a.y,
      z: b.z - a.z
    };

    const ac = {
      x: c.x - a.x,
      y: c.y - a.y,
      z: c.z - a.z
    };

    const cross = {
      x: ab.y * ac.z - ab.z * ac.y,
      y: ab.z * ac.x - ab.x * ac.z,
      z: ab.x * ac.y - ab.y * ac.x
    };

    const area = Math.hypot(cross.x, cross.y, cross.z);

    if (area < 0.000001) {
      return {
        success: false,
        message: "一直線上の頂点では面を作れません"
      };
    }

    // 四角形の場合は4番目の頂点も確認
    if (indices.length === 4) {
      const d = {
        x: position.getX(indices[3]),
        y: position.getY(indices[3]),
        z: position.getZ(indices[3])
      };

      const ad = {
        x: d.x - a.x,
        y: d.y - a.y,
        z: d.z - a.z
      };

      const distanceFromPlane =
        Math.abs(
          cross.x * ad.x +
          cross.y * ad.y +
          cross.z * ad.z
        ) / area;

      if (distanceFromPlane > 0.001) {
        return {
          success: false,
          message: "四角形の頂点が同じ平面上にありません"
        };
      }
    }

    // 既存のインデックスを維持
    let oldIndices;

    if (geometry.index) {
      oldIndices = Array.from(geometry.index.array);
    } else {
      oldIndices = Array.from(
        { length: position.count },
        (_, i) => i
      );
    }

    // 追加する三角形
    const newTriangles = indices.length === 3
      ? [
          indices[0],
          indices[1],
          indices[2]
        ]
      : [
          indices[0],
          indices[1],
          indices[2],
          indices[0],
          indices[2],
          indices[3]
        ];

    // 既存の面と重複していないか確認
    const customFaces =
      object.userData.customFaces || [];

    const faceKey = [...indices].sort((a, b) => a - b).join("_");

    const alreadyExists = customFaces.some(face => {
      return (
        [...face.vertices]
          .sort((a, b) => a - b)
          .join("_") === faceKey
      );
    });

    if (alreadyExists) {
      return {
        success: false,
        message: "同じ面はすでに作成されています"
      };
    }

    const startIndex = oldIndices.length;

    oldIndices.push(...newTriangles);

    geometry.setIndex(oldIndices);

    geometry.index.needsUpdate = true;

    // 既存の面グループがある場合、新しい面の表示範囲も登録
    if (geometry.groups.length > 0) {
      geometry.addGroup(
        startIndex,
        newTriangles.length,
        0
      );
    }

    // 作成した面の情報を保存
    if (!object.userData.customFaces) {
      object.userData.customFaces = [];
    }

    object.userData.customFaces.push({
      vertices: [...newTriangles],
      startIndex,
      triangleCount: newTriangles.length / 3
    });

    // ジオメトリを更新
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    if (typeof saveHistory === "function") {
      saveHistory();
    }

    if (typeof refreshProperties === "function") {
      refreshProperties();
    }

    const message = indices.length === 3
      ? "三角形の面を作成しました"
      : "四角形の面を作成しました";

    if (typeof updateDebugPanel === "function") {
      updateDebugPanel(message);
    }

    return {
      success: true,
      message,
      vertices: indices
    };
  }

  return {
    createFaceFromSelectedVertices
  };
}
