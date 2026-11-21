
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
  refreshObjectList,
  refreshProperties
} from "./ui.js?v=20261117-3";

import { connectStudioUI } from "./ui-connection.js?v=20261121-1";
import { getEditMode } from "./edit-mode.js";
import { initProjectLoader } from "./project-io.js";
import { createModelingTools } from "./modeling-tools/modeling-tools.js";
import { createInsetTool } from "./modeling-tools/inset.js";
import { createExtrudeTool } from "./modeling-tools/extrude.js";
import { createLoopCutTool } from "./modeling-tools/loop-cut.js";
import { createMirrorTool } from "./modeling-tools/mirror.js";
import { createMergeVerticesTool } from "./modeling-tools/merge-vertices.js";
import { createSculptSystem } from "./sculpt/setup.js?v=20261121-1";
import { createShowVerticesTool } from "./modeling-tools/show-vertices.js";
import { createShowEdgesTool } from "./modeling-tools/show-edges.js";
import { createShowFacesTool } from "./modeling-tools/show-faces.js";
import { createSelectionTool } from "./modeling-tools/selection.js";
import { createAddVertexTool } from "./modeling-tools/add-vertex.js";
import { createAddEdgeTool } from "./modeling-tools/add-edge.js";
import { createFaceTool } from "./modeling-tools/create-face.js";
import { createHitTestTools } from "./modeling-tools/hit-test.js";
import { createDragTools } from "./modeling-tools/drag-tools.js";
import { createBoxSelectionTool } from "./modeling-tools/box-selection.js";
import { createPointerEvents } from "./editing/pointer-events.js";
import { createEditDisplay } from "./editing/edit-display.js?v=20261121-1";
import { createEditHelpers } from "./editing/edit-helpers.js?v=20261121-2";
import { createObjectSelection } from "./editing/object-selection.js?v=20261121-1";
import { initToolButtons } from "./ui-tool-buttons.js?v=20261121-1";

// =========================
// 初期設定
// =========================

const canvas = document.getElementById("threeCanvas");

if (!canvas) {
  throw new Error("threeCanvas が見つかりません");
}

const { scene, camera, renderer, controls } = createScene(canvas);

initObjects(scene);
initTools(camera, renderer, scene);

let isDragging = false;
let isAddingVertex = false;

let vertexHelper = null;
let edgeHelper = null;
let faceHelper = null;

const selectedVertexIndices = new Set();
const selectedEdgeIndices = new Set();
const selectedFaceIndices = new Set();

let edgeRecords = [];
let faceRecords = [];
let faceTriangleToRecord = [];

// =========================
// 編集ヘルパー管理
// =========================

const editHelpers = createEditHelpers({
  getVertexHelper: () => vertexHelper,
  setVertexHelper: (value) => {
    vertexHelper = value;
  },

  getEdgeHelper: () => edgeHelper,
  setEdgeHelper: (value) => {
    edgeHelper = value;
  },

  getFaceHelper: () => faceHelper,
  setFaceHelper: (value) => {
    faceHelper = value;
  },

  getEdgeRecords: () => edgeRecords,
  setEdgeRecords: (value) => {
    edgeRecords = value;
  },

  getFaceRecords: () => faceRecords,
  setFaceRecords: (value) => {
    faceRecords = value;
  },

  setFaceTriangleToRecord: (value) => {
    faceTriangleToRecord = value;
  },

  selectedVertexIndices,
  selectedEdgeIndices,
  selectedFaceIndices
});

const {
  clearVertexHelper,
  clearEdgeHelper,
  clearFaceHelper,
  updateVertexColors,
  updateEdgeColors,
  updateFaceColors
} = editHelpers;

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
// 頂点表示ツール
// =========================

const showVerticesTool = createShowVerticesTool({
  THREE,

  setVertexHelper: (helper) => {
    vertexHelper = helper;
  },

  clearVertexHelper,
  updateVertexColors
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
// 編集表示更新
// =========================

const editDisplay = createEditDisplay({
  getEditMode,
  getSelectedObject,
  attachObject,
  detachObject,

  clearVertexHelper,
  clearEdgeHelper,
  clearFaceHelper,

  selectedVertexIndices,
  selectedEdgeIndices,
  selectedFaceIndices,

  showVerticesTool,
  showEdgesTool,
  showFacesTool,

  updateDebugPanel
});

const updateEditDisplay = editDisplay.updateEditDisplay;

// =========================
// オブジェクト選択
// =========================

const objectSelection = createObjectSelection({
  selectObject,
  getEditMode,
  attachObject,
  detachObject,

  selectedVertexIndices,
  selectedEdgeIndices,
  selectedFaceIndices,

  updateEditDisplay,
  refreshObjectList,
  refreshProperties
});

const { selectMesh } = objectSelection;

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

  const objects = [...getObjects()];

  objects.forEach((object) => {
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
// スカルプトシステム
// =========================

const sculptSystem = createSculptSystem({
  scene,
  camera,
  renderer,
  getSelectedObject,
  saveHistory,
  updateDebugPanel,
  updateEditDisplay,
  refreshObjectList,
  refreshProperties
});

const sculptBrush = sculptSystem.sculptBrush;
const subdivideTool = sculptSystem.subdivideTool;

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
// ボックス選択
// =========================

const boxSelectionTool = createBoxSelectionTool({
  THREE,
  canvas,
  camera,
  getEditMode,
  getVertexHelper: () => vertexHelper,
  selectedVertexIndices,
  updateVertexColors,
  updateDebugPanel
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

createPointerEvents({
  canvas,

  getEditMode,
  updatePointer,

  getVertexHit,
  getEdgeHit,
  getFaceHit,

  raycaster,
  getObjects,

  addVertexTool,
  selectMesh,

  selectedVertexIndices,
  selectedEdgeIndices,
  selectedFaceIndices,

  updateVertexColors,

  dragTools,

  getIsAddingVertex: () => isAddingVertex,
  getIsDragging: () => isDragging,

  saveHistory,
  refreshProperties,

  selectionTool,

  updateDebugPanel
});

// =========================
// プロジェクト読み込み
// =========================

initProjectLoader(loadProject);

// =========================
// UI接続
// =========================

connectStudioUI({
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
  updateEditDisplay,
  faceTriangleToRecord,

  undoHistory,
  redoHistory,
  saveProject
});

// =========================
// 編集ツールボタン接続
// =========================

initToolButtons({
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

  getIsAddingVertex: () => isAddingVertex,

  setIsAddingVertex: (value) => {
    isAddingVertex = value;
  }
});

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
// スカルプトUI接続
// =========================

sculptSystem.connectUI();

console.log("INOCHI 3D STUDIO 起動完了");
