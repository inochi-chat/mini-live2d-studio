
import {
  initUI,
  refreshObjectList,
  refreshProperties
} from "./ui.js?v=20261117-3";

import { paintSelectedFaces } from "./face-paint.js";

export function connectStudioUI({
  addObject,
  selectMesh,
  saveHistory,
  setToolMode,
  clearVertexHelper,
  clearEdgeHelper,
  clearFaceHelper,
  selectedVertexIndices,
  selectedEdgeIndices,
  selectedFaceIndices,
  detachObject,
  deleteSelectedObject,
  updateDebugPanel,
  duplicateSelectedObject,
  setSelectedMaterial,
  getSelectedMaterial,
  getSelectedObject,
  getEditMode,
  faceTriangleToRecord,
  undoHistory,
  redoHistory,
  saveProject
}) {
  initUI({
    onAdd(type) {
      const object = addObject(type);

      if (object) {
        selectMesh(object);
        saveHistory();
      }
    },

    onMode(mode) {
      setToolMode(mode);
    },

    onSelect(object) {
      selectMesh(object);
    },

    onDelete() {
      clearVertexHelper();
      clearEdgeHelper();
      clearFaceHelper();

      selectedVertexIndices.clear();
      selectedEdgeIndices.clear();
      selectedFaceIndices.clear();

      detachObject();
      deleteSelectedObject();

      refreshObjectList();
      refreshProperties();
      updateDebugPanel("オブジェクトを削除しました");

      saveHistory();
    },

    onDuplicate() {
      const object = duplicateSelectedObject();

      if (object) {
        selectMesh(object);
        saveHistory();
      }
    },

    onPropertyChange() {
      saveHistory();
    },

    onEditMode() {
      // 編集モードの表示更新は既存イベントに任せる
    },

    getMaterial() {
      return getSelectedMaterial();
    },

    onMaterialChange(options) {
      const changed = setSelectedMaterial(options);

      if (changed) {
        saveHistory();
        updateDebugPanel("材質を変更しました");
      }
    },

    onFacePaint(color) {
      const object = getSelectedObject();

      if (!object || getEditMode() !== "face") {
        alert("面モードでオブジェクトの面を選択してください。");
        return;
      }

      const changed = paintSelectedFaces(
        object,
        faceTriangleToRecord,
        selectedFaceIndices,
        color
      );

      if (!changed) {
        alert("色を塗る面を選択してください。");
        return;
      }

      saveHistory();
      refreshProperties();
      updateDebugPanel("選択した面に色を塗りました");

      window.dispatchEvent(
        new Event("edit-mode-changed")
      );
    },

    getSelected() {
      return getSelectedObject();
    },

    onSave() {
      saveProject();
    },

    onUndo() {
      undoHistory();
    },

    onRedo() {
      redoHistory();
    }
  });
}
