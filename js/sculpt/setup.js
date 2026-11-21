
import { createSculptUI } from "./sculpt-ui.js";
import { createSculptBrush } from "./brush.js";
import { createSubdivideTool } from "./subdivide-tool.js";

export function createSculptSystem({
  scene,
  camera,
  renderer,
  getSelectedObject,
  saveHistory,
  updateDebugPanel,
  updateEditDisplay,
  refreshObjectList,
  refreshProperties
}) {
  // スカルプトブラシ
  let sculptBrush = {
    setEnabled() {},
    setMode() {},
    setRadius() {},
    setStrength() {},
    clearMask() {},
    invertMask() {}
  };

  try {
    sculptBrush = createSculptBrush({
      scene,
      camera,
      renderer,
      getSelectedObject,
      saveHistory,
      updateDebugPanel,
      updateEditDisplay
    });

    console.log("スカルプトブラシ初期化成功");
  } catch (error) {
    console.error("スカルプトブラシ初期化エラー:", error);

    updateDebugPanel(
      "スカルプト初期化エラー：コンソールを確認してください"
    );
  }

  // スカルプト用細分化
  const subdivideTool = createSubdivideTool({
    getSelectedObject,
    saveHistory,
    updateEditDisplay,
    refreshObjectList,
    refreshProperties,
    updateDebugPanel
  });

  // スカルプトUI接続
  function connectUI() {
    createSculptUI({
      sculptBrush,
      subdivideTool,
      updateDebugPanel
    });
  }

  return {
    sculptBrush,
    subdivideTool,
    connectUI
  };
}
