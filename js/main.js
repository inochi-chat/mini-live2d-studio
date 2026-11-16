
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import * as THREE from "three";

import { createDebugPanel } from "./debug-panel.js";
import { createScene } from "./scene.js";
import { createHistoryManager } from "./history.js";

import {
  initObjects,
  addObject,
  selectObject,
  getSelectedObject,
  getObjects,
  deleteSelectedObject,
  duplicateSelectedObject,
  setSelectedMaterial,
  getSelectedMaterial
} from "./objects.js?v=20261115-2";

import {
  initTools,
  attachObject,
  detachObject,
  setToolMode
} from "./tools.js";

import {
  initUI,
  refreshObjectList,
  refreshProperties
} from "./ui.js?v=20261117-2";

import { getEditMode } from "./edit-mode.js";
import { paintSelectedFaces } from "./face-paint.js";

import { createModelingTools } from "./modeling-tools/modeling-tools.js";
import { createInsetTool } from "./modeling-tools/inset.js";
import { createExtrudeTool } from "./modeling-tools/extrude.js";
import { createLoopCutTool } from "./modeling-tools/loop-cut.js";
import { createMirrorTool } from "./modeling-tools/mirror.js";
import { createMergeVerticesTool } from "./modeling-tools/merge-vertices.js";

import { createShowVerticesTool } from "./modeling-tools/show-vertices.js";
import { createShowEdgesTool } from "./modeling-tools/show-edges.js";
import { createShowFacesTool } from "./modeling-tools/show-faces.js";
import { createSelectionTool } from "./modeling-tools/selection.js";
import { createAddVertexTool } from "./modeling-tools/add-vertex.js";
import { createAddEdgeTool } from "./modeling-tools/add-edge.js";
import { createFaceTool } from "./modeling-tools/create-face.js";
import { createHitTestTools } from "./modeling-tools/hit-test.js";
import { createDragTools } from "./modeling-tools/drag-tools.js";

// =========================
// 初期設定
// =========================

const canvas = document.getElementById("threeCanvas");
const { scene, camera, renderer, controls } = createScene(canvas);

initObjects(scene);
initTools(camera, renderer, scene);

let isDragging = false;
let isAddingVertex = false;

let vertexHelper = null;
let edgeHelper = null;
let faceHelper = null;

let pendingVertex = null;
let pendingEdge = null;
let pendingFace = null;

let pointerDownPosition = null;

let selectedVertexIndices = new Set();
let selectedEdgeIndices = new Set();
let selectedFaceIndices = new Set();

let edgeRecords = [];
let faceRecords = [];
let faceTriangleToRecord = [];

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

raycaster.params.Points.threshold = 0.8;
raycaster.params.Line.threshold = 0.8;

// =========================
// ヒットテスト
// =========================

const hitTest = createHitTestTools({
  canvas,
  camera,
  raycaster,
  pointer,

  getVertexHelper: () => vertexHelper,
  getEdgeHelper: () => edgeHelper,
  getFaceHelper: () => faceHelper,

  getFaceTriangleToRecord: () => faceTriangleToRecord
});

const updatePointer = hitTest.updatePointer;
const getVertexHit = hitTest.getVertexHit;
const getEdgeHit = hitTest.getEdgeHit;
const getFaceHit = hitTest.getFaceHit;

// =========================
// 診断パネル
// =========================

const updateDebugPanel = createDebugPanel({
  getSelectedObject,
  getEditMode,
  getEdgeCount: () => edgeRecords.length,
  getFaceCount: () => faceRecords.length
});

// =========================
// ヘルパー削除
// =========================

function clearVertexHelper() {
  if (!vertexHelper) return;

  vertexHelper.parent?.remove(vertexHelper);
  vertexHelper.geometry.dispose();
  vertexHelper.material.dispose();

  vertexHelper = null;
}

function clearEdgeHelper() {
  if (!edgeHelper) return;

  edgeHelper.parent?.remove(edgeHelper);
  edgeHelper.geometry.dispose();
  edgeHelper.material.dispose();

  edgeHelper = null;
  edgeRecords = [];
}

function clearFaceHelper() {
  if (!faceHelper) return;

  faceHelper.parent?.remove(faceHelper);
  faceHelper.geometry.dispose();
  faceHelper.material.dispose();

  faceHelper = null;
  faceRecords = [];
  faceTriangleToRecord = [];
}

// =========================
// 頂点表示
// =========================


function updateVertexColors() {
  if (!vertexHelper) return;

  const positions = vertexHelper.geometry.attributes.position;
  const colors = [];

  for (let i = 0; i < positions.count; i++) {
    const color = selectedVertexIndices.has(i)
      ? new THREE.Color(0xff6600)
      : new THREE.Color(0xffff00);

    colors.push(color.r, color.g, color.b);
  }

  vertexHelper.geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3)
  );
}


// =========================
// 面表示
// =========================

function updateFaceColors() {
  if (!faceHelper) return;

  const colors = [];

  faceRecords.forEach((face, index) => {
    const color = new THREE.Color(
      selectedFaceIndices.has(index) ? 0xff6600 : 0xffff00
    );

    for (let i = 0; i < face.vertices.length; i++) {
      colors.push(color.r, color.g, color.b);
    }
  });

  faceHelper.geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3)
  );
}

// =========================
// 編集表示更新
// =========================

function updateEditDisplay() {
  const mode = getEditMode();
  const selected = getSelectedObject();

  clearVertexHelper();
  clearEdgeHelper();
  clearFaceHelper();

  selectedVertexIndices.clear();
  selectedEdgeIndices.clear();
  selectedFaceIndices.clear();

  if (mode === "object") {
    if (selected) attachObject(selected);
  } else {
    detachObject();

    if (mode === "vertex" && selected) {
      showVerticesTool.showVertices(selected);
    }

    if (mode === "edge" && selected) {
      showEdgesTool.showEdges(selected);
    }

    if (mode === "face" && selected) {
      showFacesTool.showFaces(selected);
    }
  }

  updateDebugPanel("編集モード切り替え済み");
}

window.addEventListener("edit-mode-changed", updateEditDisplay);

// =========================
// オブジェクト選択
// =========================

function selectMesh(mesh) {
  if (!mesh) return;

  selectObject(mesh);

  selectedVertexIndices.clear();
  selectedEdgeIndices.clear();
  selectedFaceIndices.clear();

  if (getEditMode() === "object") {
    attachObject(mesh);
  } else {
    detachObject();
  }

  updateEditDisplay();
  refreshObjectList();
  refreshProperties();
}

// =========================
// 全オブジェクト削除
// =========================

function clearAllObjects() {
  detachObject();

  clearVertexHelper();
  clearEdgeHelper();
  clearFaceHelper();

  selectedVertexIndices.clear();
  selectedEdgeIndices.clear();
  selectedFaceIndices.clear();

  getObjects().forEach((object) => {
    selectObject(object);
    deleteSelectedObject();
  });
}

// =========================
// 履歴
// =========================

const historyManager = createHistoryManager({
  getObjects,
  addObject,
  selectMesh,
  clearAllObjects,
  updateEditDisplay,
  refreshObjectList,
  refreshProperties,
  updateDebugPanel
});

const {
  saveHistory,
  undoHistory,
  redoHistory,
  saveProject,
  loadProject
} = historyManager;

// =========================
// モデリングツール
// =========================

const modelingTools = createModelingTools({
  THREE,
  RoundedBoxGeometry,
  getSelectedObject,
  updateEditDisplay,
  refreshObjectList,
  refreshProperties,
  saveHistory,
  updateDebugPanel
});

const insetTool = createInsetTool({
  getSelectedObject,
  getEditMode,
  selectedFaceIndices,
  getFaceRecords: () => faceRecords,
  getFaceTriangleToRecord: () => faceTriangleToRecord,
  updateEditDisplay,
  updateFaceColors,
  refreshObjectList,
  refreshProperties,
  saveHistory,
  updateDebugPanel
});

const extrudeTool = createExtrudeTool({
  getSelectedObject,
  getEditMode,
  selectedFaceIndices,
  getFaceRecords: () => faceRecords,
  getFaceTriangleToRecord: () => faceTriangleToRecord,
  updateEditDisplay,
  updateFaceColors,
  refreshObjectList,
  refreshProperties,
  saveHistory,
  updateDebugPanel
});

const loopCutTool = createLoopCutTool({
  getSelectedObject,
  updateEditDisplay,
  refreshObjectList,
  refreshProperties,
  saveHistory,
  updateDebugPanel
});

const mirrorTool = createMirrorTool({
  getSelectedObject,
  duplicateSelectedObject,
  refreshObjectList,
  refreshProperties,
  saveHistory,
  updateDebugPanel
});

const mergeVerticesTool = createMergeVerticesTool({
  THREE,
  getSelectedObject,
  updateEditDisplay,
  refreshObjectList,
  refreshProperties,
  saveHistory,
  updateDebugPanel
});

// =========================
// 辺表示ツール
// =========================

const showEdgesTool = createShowEdgesTool({
  THREE,

  setEdgeHelper: (helper) => {
    edgeHelper = helper;
  },

  setEdgeRecords: (records) => {
    edgeRecords = records;
  },

  clearEdgeHelper,
  updateEdgeColors
});

// =========================
// 面表示ツール
// =========================

const showFacesTool = createShowFacesTool({
  THREE,

  setFaceHelper: (helper) => {
    faceHelper = helper;
  },

  setFaceRecords: (records) => {
    faceRecords = records;
  },

  setFaceTriangleToRecord: (records) => {
    faceTriangleToRecord = records;
  },

  clearFaceHelper,
  updateFaceColors,
  updateDebugPanel
});

// =========================
// 選択ツール
// =========================

const selectionTool = createSelectionTool({
  selectedVertexIndices,
  selectedEdgeIndices,
  selectedFaceIndices,
  updateVertexColors,
  updateEdgeColors,
  updateFaceColors
});

// =========================
// 頂点追加・辺作成ツール
// =========================

const addVertexTool = createAddVertexTool();

const addEdgeTool = createAddEdgeTool({
  getSelectedObject,
  selectedVertexIndices,
  updateEditDisplay,
  refreshProperties,
  saveHistory
});

// =========================
// 面作成ツール
// =========================

const createFaceToolInstance = createFaceTool({
  getSelectedObject,
  selectedVertexIndices,
  saveHistory,
  refreshProperties,
  updateDebugPanel
});

// =========================
// ドラッグツール
// =========================

const dragTools = createDragTools({
  THREE,
  camera,
  raycaster,
  controls,
  updatePointer,

  getSelectedObject,

  getVertexHelper: () => vertexHelper,
  getEdgeHelper: () => edgeHelper,
  getFaceHelper: () => faceHelper,

  getEdgeRecords: () => edgeRecords,
  getFaceRecords: () => faceRecords,

  selectedVertexIndices,
  selectedEdgeIndices,
  selectedFaceIndices,

  setDragging: (value) => {
    isDragging = value;
  },

  saveHistory,
  refreshProperties,
  updateDebugPanel
});

// =========================
// ポインター操作
// =========================

canvas.addEventListener("pointerdown", (event) => {
  pointerDownPosition = {
    x: event.clientX,
    y: event.clientY
  };

  const mode = getEditMode();

  if (mode === "vertex") {
    const index = getVertexHit(event);

    pendingVertex = index === null
      ? null
      : { index, x: event.clientX, y: event.clientY };
  }

  if (mode === "edge") {
    const index = getEdgeHit(event);

    pendingEdge = index === null
      ? null
      : { index, x: event.clientX, y: event.clientY };
  }

  if (mode === "face") {
    const index = getFaceHit(event);

    pendingFace = index === null
      ? null
      : { index, x: event.clientX, y: event.clientY };
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (dragTools.hasVertexDrag()) {
    dragTools.moveVertices(event);
    return;
  }

  if (dragTools.hasEdgeDrag()) {
    dragTools.moveEdges(event);
    return;
  }

  if (dragTools.hasFaceDrag()) {
    dragTools.moveFaces(event);
    return;
  }

  if (pendingVertex) {
    const dx = event.clientX - pendingVertex.x;
    const dy = event.clientY - pendingVertex.y;

    if (
      Math.hypot(dx, dy) >= 6 &&
      selectedVertexIndices.has(pendingVertex.index)
    ) {
      dragTools.beginVertexDrag(event, pendingVertex);

      if (dragTools.hasVertexDrag()) {
        dragTools.moveVertices(event);
      }
    }
  }

  if (pendingEdge) {
    const dx = event.clientX - pendingEdge.x;
    const dy = event.clientY - pendingEdge.y;

    if (
      Math.hypot(dx, dy) >= 6 &&
      selectedEdgeIndices.has(pendingEdge.index)
    ) {
      dragTools.beginEdgeDrag(event, pendingEdge);

      if (dragTools.hasEdgeDrag()) {
        dragTools.moveEdges(event);
      }
    }
  }

  if (pendingFace) {
    const dx = event.clientX - pendingFace.x;
    const dy = event.clientY - pendingFace.y;

    if (
      Math.hypot(dx, dy) >= 6 &&
      selectedFaceIndices.has(pendingFace.index)
    ) {
      dragTools.beginFaceDrag(event, pendingFace);

      if (dragTools.hasFaceDrag()) {
        dragTools.moveFaces(event);
      }
    }
  }
});

canvas.addEventListener("pointerup", (event) => {
  // 頂点配置モード
  if (isAddingVertex) {
    updatePointer(event);

    const hits = raycaster.intersectObjects(
      getObjects(),
      false
    );

    if (hits.length > 0) {
      const hit = hits[0];

      const newIndex = addVertexTool.addVertex(
        hit.object,
        hit.point
      );

      if (newIndex >= 0) {
        selectMesh(hit.object);

        if (getEditMode() === "vertex") {
          selectedVertexIndices.add(newIndex);
          updateVertexColors();
        }

        saveHistory();
        refreshProperties();

        updateDebugPanel(
          "新しい頂点を追加しました: " + newIndex
        );
      }
    }

    pendingVertex = null;
    pendingEdge = null;
    pendingFace = null;
    pointerDownPosition = null;
    return;
  }

  if (dragTools.hasVertexDrag()) {
    dragTools.finishVertexDrag();

    pendingVertex = null;
    pendingEdge = null;
    pendingFace = null;
    pointerDownPosition = null;
    return;
  }

  if (dragTools.hasEdgeDrag()) {
    dragTools.finishEdgeDrag();

    pendingVertex = null;
    pendingEdge = null;
    pendingFace = null;
    pointerDownPosition = null;
    return;
  }

  if (dragTools.hasFaceDrag()) {
    dragTools.finishFaceDrag();

    pendingVertex = null;
    pendingEdge = null;
    pendingFace = null;
    pointerDownPosition = null;
    return;
  }

  if (pendingVertex) {
    const dx = event.clientX - pendingVertex.x;
    const dy = event.clientY - pendingVertex.y;

    if (Math.hypot(dx, dy) < 6) {
      selectionTool.toggleVertexSelection(pendingVertex.index);
    }

    pendingVertex = null;
    pointerDownPosition = null;
    return;
  }

  if (pendingEdge) {
    const dx = event.clientX - pendingEdge.x;
    const dy = event.clientY - pendingEdge.y;

    if (Math.hypot(dx, dy) < 6) {
      selectionTool.toggleEdgeSelection(pendingEdge.index);
    }

    pendingEdge = null;
    pointerDownPosition = null;
    return;
  }

  if (pendingFace) {
    const dx = event.clientX - pendingFace.x;
    const dy = event.clientY - pendingFace.y;

    if (Math.hypot(dx, dy) < 6) {
      selectionTool.toggleFaceSelection(pendingFace.index);
    }

    pendingFace = null;
    pointerDownPosition = null;
    return;
  }

  if (isDragging || !pointerDownPosition) {
    pointerDownPosition = null;
    return;
  }

  const dx = event.clientX - pointerDownPosition.x;
  const dy = event.clientY - pointerDownPosition.y;

  pointerDownPosition = null;

  if (Math.hypot(dx, dy) > 5) return;

  updatePointer(event);

  const hits = raycaster.intersectObjects(getObjects(), false);

  if (hits.length > 0) {
    selectMesh(hits[0].object);
  }
});

canvas.addEventListener("pointercancel", () => {
  if (dragTools.hasVertexDrag()) {
    dragTools.finishVertexDrag();
  }

  if (dragTools.hasEdgeDrag()) {
    dragTools.finishEdgeDrag();
  }

  if (dragTools.hasFaceDrag()) {
    dragTools.finishFaceDrag();
  }

  pendingVertex = null;
  pendingEdge = null;
  pendingFace = null;
  pointerDownPosition = null;
});

// =========================
// プロジェクト読み込み
// =========================

const createSnapshot = historyManager.createSnapshot;

const loadFileInput = document.getElementById("loadFileInput");

if (loadFileInput) {
  loadFileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        loadProject(JSON.parse(reader.result));
      } catch (error) {
        alert("ファイルを読み込めませんでした。");
        console.error(error);
      }
    };

    reader.readAsText(file);
    event.target.value = "";
  });
}

// =========================
// UI接続
// =========================

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
    updateEditDisplay();
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

    updateEditDisplay();
    saveHistory();
    refreshProperties();
    updateDebugPanel("選択した面に色を塗りました");
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

// =========================
// 編集ツールボタン
// =========================

const insetButton = document.getElementById("insetButton");
const bevelButton = document.getElementById("bevelButton");
const loopCutButton = document.getElementById("loopCutButton");
const mirrorButton = document.getElementById("mirrorButton");
const extrudeButton = document.getElementById("extrudeButton");

if (mirrorButton) {
  mirrorButton.addEventListener(
    "click",
    mirrorTool.mirrorSelectedObject
  );
}

if (loopCutButton) {
  loopCutButton.addEventListener(
    "click",
    loopCutTool.loopCutSelectedObject
  );
}

if (bevelButton) {
  bevelButton.addEventListener(
    "click",
    modelingTools.bevelSelectedObject
  );
}

if (insetButton) {
  insetButton.addEventListener(
    "click",
    insetTool.insetSelectedFaces
  );
}

if (extrudeButton) {
  extrudeButton.addEventListener(
    "click",
    extrudeTool.extrudeSelectedFaces
  );
}

// =========================
// TransformControls
// =========================

window.addEventListener("transform-dragging", (event) => {
  isDragging = event.detail;
  controls.enabled = !isDragging;

  if (!isDragging) {
    saveHistory();
    refreshProperties();
  }
});

// =========================
// 初期オブジェクト
// =========================

const firstObject = addObject("cube");

if (firstObject) {
  selectMesh(firstObject);
}

refreshObjectList();
refreshProperties();
saveHistory();
updateDebugPanel("準備完了");

// =========================
// 頂点結合ボタン
// =========================

const mergeVerticesButton =
  document.getElementById("mergeVerticesButton");

if (mergeVerticesButton) {
  mergeVerticesButton.addEventListener(
    "click",
    mergeVerticesTool.mergeSelectedVertices
  );
}

// =========================
// 頂点追加
// =========================

const addVertexButton =
  document.getElementById("addVertexButton");

if (addVertexButton) {
  addVertexButton.addEventListener("click", () => {
    isAddingVertex = !isAddingVertex;

    addVertexButton.textContent = isAddingVertex
      ? "配置中（終了）"
      : "＋ 頂点を追加";

    updateDebugPanel(
      isAddingVertex
        ? "追加したい位置の表面をタップしてください"
        : "頂点配置を終了しました"
    );
  });
}

// =========================
// 辺作成
// =========================

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

// =========================
// 面作成
// =========================

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
