
import { subdivideGeometry } from "./subdivide.js";

export function createSubdivideTool(options = {}) {
  const {
    getSelectedObject,
    saveHistory,
    updateEditDisplay,
    refreshObjectList,
    refreshProperties,
    updateDebugPanel
  } = options;

  function subdivideSelectedObject(levels = 1) {
    const object = getSelectedObject();

    if (!object || !object.geometry?.attributes?.position) {
      updateDebugPanel("細分化するオブジェクトを選択してください");
      return false;
    }

    const level = Math.max(
      1,
      Math.min(3, Math.floor(Number(levels) || 1))
    );

    const oldGeometry = object.geometry;

    try {
      const newGeometry = subdivideGeometry(
        oldGeometry,
        level
      );

      if (!newGeometry.attributes.position?.count) {
        newGeometry.dispose();
        return false;
      }

      saveHistory();

      object.geometry = newGeometry;
      oldGeometry.dispose();

      updateEditDisplay();
      refreshObjectList();
      refreshProperties();

      updateDebugPanel(
        `メッシュを${level}段階細分化しました`
      );

      return true;
    } catch (error) {
      console.error("細分化エラー:", error);
      updateDebugPanel("細分化に失敗しました");
      return false;
    }
  }

  return {
    subdivideSelectedObject
  };
}
