
export function initToolButtons({
  modelingTools,
  insetTool,
  extrudeTool,
  loopCutTool,
  mirrorTool,
  mergeVerticesTool,
  addVertexTool,
  addEdgeTool,
  createFaceToolInstance,
  getEditMode,
  updateEditDisplay,
  updateDebugPanel,
  getIsAddingVertex,
  setIsAddingVertex
}) {
  // ベベル
  const bevelButton = document.getElementById("bevelButton");

  if (bevelButton) {
    bevelButton.addEventListener(
      "click",
      modelingTools.bevelSelectedObject
    );
  }

  // インセット
  const insetButton = document.getElementById("insetButton");

  if (insetButton) {
    insetButton.addEventListener(
      "click",
      insetTool.insetSelectedFaces
    );
  }

  // 押し出し
  const extrudeButton = document.getElementById("extrudeButton");

  if (extrudeButton) {
    extrudeButton.addEventListener(
      "click",
      extrudeTool.extrudeSelectedFaces
    );
  }

  // ループカット
  const loopCutButton = document.getElementById("loopCutButton");

  if (loopCutButton) {
    loopCutButton.addEventListener(
      "click",
      loopCutTool.loopCutSelectedObject
    );
  }

  // ミラー
  const mirrorButton = document.getElementById("mirrorButton");

  if (mirrorButton) {
    mirrorButton.addEventListener(
      "click",
      mirrorTool.mirrorSelectedObject
    );
  }

  // 頂点結合
  const mergeVerticesButton =
    document.getElementById("mergeVerticesButton");

  if (mergeVerticesButton) {
    mergeVerticesButton.addEventListener(
      "click",
      mergeVerticesTool.mergeSelectedVertices
    );
  }

  // 頂点追加
  const addVertexButton =
    document.getElementById("addVertexButton");

  if (addVertexButton) {
    addVertexButton.addEventListener("click", () => {
      const next = !getIsAddingVertex();
      setIsAddingVertex(next);

      addVertexButton.textContent = next
        ? "配置中（終了）"
        : "＋ 頂点を追加";

      updateDebugPanel(
        next
          ? "追加したい位置の表面をタップしてください"
          : "頂点配置を終了しました"
      );
    });
  }

  // 辺作成
  const addEdgeButton =
    document.getElementById("addEdgeButton");

  if (addEdgeButton) {
    addEdgeButton.addEventListener("click", () => {
      const result =
        addEdgeTool.addEdgeBetweenSelectedVertices();

      if (!result.success) {
        alert(result.message);
        return;
      }

      updateDebugPanel(result.message);
      alert(result.message);
    });
  }

  // 面作成
  const createFaceButton =
    document.getElementById("createFaceButton");

  if (createFaceButton) {
    createFaceButton.addEventListener("click", () => {
      if (getEditMode() !== "vertex") {
        alert("頂点モードに切り替えてください");
        return;
      }

      const result =
        createFaceToolInstance.createFaceFromSelectedVertices();

      if (!result.success) {
        alert(result.message);
        return;
      }

      updateEditDisplay();
      updateDebugPanel(result.message);
      alert(result.message);
    });
  }
}
