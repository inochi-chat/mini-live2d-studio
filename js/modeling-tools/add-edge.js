
export function createAddEdgeTool(options = {}) {
  const {
    getSelectedObject,
    selectedVertexIndices,
    updateEditDisplay,
    refreshProperties,
    saveHistory
  } = options;

  function addEdgeBetweenSelectedVertices() {
    const object = getSelectedObject();

    if (!object || !object.geometry) {
      return {
        success: false,
        message: "オブジェクトを選択してください"
      };
    }

    if (selectedVertexIndices.size !== 2) {
      return {
        success: false,
        message: "頂点モードで頂点を2つ選択してください"
      };
    }

    const indices = Array.from(selectedVertexIndices);
    const a = indices[0];
    const b = indices[1];

    const position = object.geometry.attributes.position;

    if (
      !position ||
      a < 0 ||
      b < 0 ||
      a >= position.count ||
      b >= position.count ||
      a === b
    ) {
      return {
        success: false,
        message: "選択した頂点が正しくありません"
      };
    }

    if (!object.userData) {
      object.userData = {};
    }

    if (!Array.isArray(object.userData.customEdges)) {
      object.userData.customEdges = [];
    }

    const edges = object.userData.customEdges;

    // 同じ辺がすでに存在するか確認
    const alreadyExists = edges.some(edge =>
      (edge.a === a && edge.b === b) ||
      (edge.a === b && edge.b === a)
    );

    if (alreadyExists) {
      return {
        success: false,
        message: "この辺はすでに作成されています"
      };
    }

    // 辺を保存
    edges.push({
      a,
      b
    });

    // 表示と履歴を更新
    if (typeof saveHistory === "function") {
      saveHistory();
    }

    if (typeof updateEditDisplay === "function") {
      updateEditDisplay();
    }

    if (typeof refreshProperties === "function") {
      refreshProperties();
    }

    return {
      success: true,
      message: "辺を作成しました"
    };
  }

  return {
    addEdgeBetweenSelectedVertices
  };
}
