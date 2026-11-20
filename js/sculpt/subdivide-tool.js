
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

    let newGeometry;

    try {
      newGeometry = subdivideGeometry(object.geometry, level);

      if (!newGeometry.attributes.position?.count) {
        newGeometry.dispose();
        return false;
      }

      const oldGeometry = object.geometry;
      object.geometry = newGeometry;
      oldGeometry.dispose();

      updateEditDisplay();
      refreshObjectList();
      refreshProperties();

      saveHistory();

      updateDebugPanel(
        `メッシュを${level}段階細分化しました`
      );

      return true;
    } catch (error) {
      newGeometry?.dispose();
      console.error("細分化エラー:", error);
      updateDebugPanel("細分化に失敗しました");
      return false;
    }
  }

  return {
    subdivideSelectedObject
  };
}
