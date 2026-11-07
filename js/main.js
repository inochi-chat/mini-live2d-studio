
import * as THREE from "three";
import { createScene } from "./scene.js";

import {
  initObjects,
  addObject,
  selectObject,
  getSelectedObject,
  getObjects,
  deleteSelectedObject,
  duplicateSelectedObject
} from "./objects.js";

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
} from "./ui.js";

import { getEditMode } from "./edit-mode.js";

const canvas = document.getElementById("threeCanvas");

const { scene, camera, renderer, controls } = createScene(canvas);

initObjects(scene);
initTools(camera, renderer, scene);

let isDragging = false;

let vertexHelper = null;
let edgeHelper = null;

let vertexDrag = null;
let edgeDrag = null;
let pendingVertex = null;
let pendingEdge = null;

let selectedVertexIndices = new Set();
let selectedEdgeIndices = new Set();

let edgeRecords = [];

let history = [];
let historyIndex = -1;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

raycaster.params.Points.threshold = 0.5;
raycaster.params.Line.threshold = 0.18;

// -------------------------
// ポインター座標
// -------------------------

function updatePointer(event) {
  const rect = canvas.getBoundingClientRect();

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
}

// -------------------------
// ヘルパー削除
// -------------------------

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

// -------------------------
// 頂点の色
// -------------------------

function updateVertexColors() {
  if (!vertexHelper) return;

  const positions = vertexHelper.geometry.attributes.position;
  const colors = [];

  for (let i = 0; i < positions.count; i++) {
    if (selectedVertexIndices.has(i)) {
      colors.push(1, 0.35, 0);
    } else {
      colors.push(1, 1, 0);
    }
  }

  vertexHelper.geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3)
  );
}

// -------------------------
// 頂点表示
// -------------------------

function showVertices(object) {
  clearVertexHelper();

  if (!object?.geometry) return;

  const positions = object.geometry.attributes.position;
  if (!positions) return;

  const points = [];

  for (let i = 0; i < positions.count; i++) {
    points.push(
      positions.getX(i),
      positions.getY(i),
      positions.getZ(i)
    );
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(points, 3)
  );

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    vertexColors: true,
    size: 0.12,
    sizeAttenuation: true,
    depthTest: false
  });

  vertexHelper = new THREE.Points(geometry, material);
  vertexHelper.renderOrder = 10;

  object.add(vertexHelper);

  updateVertexColors();
}

// -------------------------
// 辺の頂点対応を調べる
// -------------------------

function findMatchingVertices(object, point) {
  const positions = object.geometry.attributes.position;
  const matches = [];

  const tolerance = 0.0001;

  for (let i = 0; i < positions.count; i++) {
    const dx = positions.getX(i) - point.x;
    const dy = positions.getY(i) - point.y;
    const dz = positions.getZ(i) - point.z;

    if (
      Math.abs(dx) < tolerance &&
      Math.abs(dy) < tolerance &&
      Math.abs(dz) < tolerance
    ) {
      matches.push(i);
    }
  }

  return matches;
}

// -------------------------
// 辺の色を更新
// -------------------------

function updateEdgeColors() {
  if (!edgeHelper) return;

  const colors = [];

  for (let i = 0; i < edgeRecords.length; i++) {
    const selected = selectedEdgeIndices.has(i);

    const color = selected
      ? [1, 0.25, 0]
      : [1, 0.85, 0];

    colors.push(...color, ...color);
  }

  edgeHelper.geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3)
  );
}

// -------------------------
// 辺表示
// -------------------------

function showEdges(object) {
  clearEdgeHelper();

  if (!object?.geometry) return;

  const edgesGeometry = new THREE.EdgesGeometry(
    object.geometry,
    1
  );

  const positions = edgesGeometry.attributes.position;

  if (!positions || positions.count < 2) {
    edgesGeometry.dispose();
    return;
  }

  const records = [];
  const linePositions = [];

  for (let i = 0; i < positions.count; i += 2) {
    const a = new THREE.Vector3(
      positions.getX(i),
      positions.getY(i),
      positions.getZ(i)
    );

    const b = new THREE.Vector3(
      positions.getX(i + 1),
      positions.getY(i + 1),
      positions.getZ(i + 1)
    );

    records.push({
      a,
      b,
      verticesA: findMatchingVertices(object, a),
      verticesB: findMatchingVertices(object, b)
    });

    linePositions.push(
      a.x, a.y, a.z,
      b.x, b.y, b.z
    );
  }

  edgesGeometry.dispose();

  edgeRecords = records;

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(linePositions, 3)
  );

  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    depthTest: false
  });

  edgeHelper = new THREE.LineSegments(
    geometry,
    material
  );

  edgeHelper.renderOrder = 11;

  object.add(edgeHelper);

  updateEdgeColors();
}

// -------------------------
// 編集表示更新
// -------------------------

function updateEditDisplay() {
  const mode = getEditMode();
  const selected = getSelectedObject();

  clearVertexHelper();
  clearEdgeHelper();

  selectedVertexIndices.clear();
  selectedEdgeIndices.clear();

  if (mode === "object") {
    if (selected) attachObject(selected);
  } else {
    detachObject();

    if (mode === "vertex" && selected) {
      showVertices(selected);
    }

    if (mode === "edge" && selected) {
      showEdges(selected);
    }
  }
}

window.addEventListener("edit-mode-changed", () => {
  updateEditDisplay();
});

// -------------------------
// オブジェクト選択
// -------------------------

function selectMesh(mesh) {
  if (!mesh) return;

  selectObject(mesh);

  selectedVertexIndices.clear();
  selectedEdgeIndices.clear();

  if (getEditMode() === "object") {
    attachObject(mesh);
  } else {
    detachObject();
  }

  updateEditDisplay();

  refreshObjectList();
  refreshProperties();
}

// -------------------------
// 頂点選択
// -------------------------

function toggleVertexSelection(index) {
  if (selectedVertexIndices.has(index)) {
    selectedVertexIndices.delete(index);
  } else {
    selectedVertexIndices.add(index);
  }

  updateVertexColors();
}

// -------------------------
// 辺選択
// -------------------------

function toggleEdgeSelection(index) {
  if (selectedEdgeIndices.has(index)) {
    selectedEdgeIndices.delete(index);
  } else {
    selectedEdgeIndices.add(index);
  }

  updateEdgeColors();
}

// -------------------------
// 頂点ヒット判定
// -------------------------

function getVertexHit(event) {
  if (!vertexHelper) return null;

  updatePointer(event);

  const hits = raycaster.intersectObject(
    vertexHelper,
    false
  );

  if (hits.length === 0) return null;

  return hits[0].index;
}

// -------------------------
// 辺ヒット判定
// -------------------------

function getEdgeHit(event) {
  if (!edgeHelper) return null;

  updatePointer(event);

  const hits = raycaster.intersectObject(
    edgeHelper,
    false
  );

  if (hits.length === 0) return null;

  const vertexIndex = hits[0].index;

  if (vertexIndex === undefined) return null;

  return Math.floor(vertexIndex / 2);
}

// -------------------------
// 頂点ドラッグ開始
// -------------------------

function beginVertexDrag(event) {
  if (!pendingVertex) return;

  const object = getSelectedObject();
  if (!object) return;

  const positions = object.geometry.attributes.position;
  const index = pendingVertex.index;

  const localPosition = new THREE.Vector3(
    positions.getX(index),
    positions.getY(index),
    positions.getZ(index)
  );

  object.updateMatrixWorld(true);

  const worldPosition = object.localToWorld(
    localPosition.clone()
  );

  const normal = new THREE.Vector3();
  camera.getWorldDirection(normal);

  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
    normal,
    worldPosition
  );

  updatePointer(event);

  const startPoint = new THREE.Vector3();

  if (!raycaster.ray.intersectPlane(plane, startPoint)) {
    return;
  }

  const startLocal = object.worldToLocal(
    startPoint.clone()
  );

  const originalPositions = new Map();

  selectedVertexIndices.forEach((vertexIndex) => {
    originalPositions.set(
      vertexIndex,
      new THREE.Vector3(
        positions.getX(vertexIndex),
        positions.getY(vertexIndex),
        positions.getZ(vertexIndex)
      )
    );
  });

  vertexDrag = {
    object,
    plane,
    startLocal,
    originalPositions
  };

  isDragging = true;
  controls.enabled = false;
}

// -------------------------
// 頂点移動
// -------------------------

function moveVertices(event) {
  if (!vertexDrag) return;

  updatePointer(event);

  const currentPoint = new THREE.Vector3();

  if (!raycaster.ray.intersectPlane(
    vertexDrag.plane,
    currentPoint
  )) return;

  const object = vertexDrag.object;

  object.updateMatrixWorld(true);

  const currentLocal = object.worldToLocal(
    currentPoint.clone()
  );

  const delta = currentLocal.sub(vertexDrag.startLocal);

  const positions = object.geometry.attributes.position;

  vertexDrag.originalPositions.forEach((original, index) => {
    positions.setXYZ(
      index,
      original.x + delta.x,
      original.y + delta.y,
      original.z + delta.z
    );
  });

  positions.needsUpdate = true;

  object.geometry.computeVertexNormals();
  object.geometry.computeBoundingBox();
  object.geometry.computeBoundingSphere();

  if (vertexHelper) {
    const helperPositions =
      vertexHelper.geometry.attributes.position;

    vertexDrag.originalPositions.forEach((original, index) => {
      helperPositions.setXYZ(
        index,
        original.x + delta.x,
        original.y + delta.y,
        original.z + delta.z
      );
    });

    helperPositions.needsUpdate = true;
  }
}

// -------------------------
// 辺ドラッグ開始
// -------------------------

function beginEdgeDrag(event) {
  if (!pendingEdge) return;

  const object = getSelectedObject();
  if (!object) return;

  const record = edgeRecords[pendingEdge.index];
  if (!record) return;

  const midpoint = record.a.clone().add(record.b).multiplyScalar(0.5);

  object.updateMatrixWorld(true);

  const worldPosition = object.localToWorld(midpoint.clone());

  const normal = new THREE.Vector3();
  camera.getWorldDirection(normal);

  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
    normal,
    worldPosition
  );

  updatePointer(event);

  const startPoint = new THREE.Vector3();

  if (!raycaster.ray.intersectPlane(plane, startPoint)) {
    return;
  }

  const startLocal = object.worldToLocal(
    startPoint.clone()
  );

  const positions = object.geometry.attributes.position;
  const originalPositions = new Map();

  // 選択されたすべての辺の両端を集める
  selectedEdgeIndices.forEach((edgeIndex) => {
    const edge = edgeRecords[edgeIndex];

    if (!edge) return;

    const indices = [
      ...edge.verticesA,
      ...edge.verticesB
    ];

    indices.forEach((vertexIndex) => {
      if (originalPositions.has(vertexIndex)) return;

      originalPositions.set(
        vertexIndex,
        new THREE.Vector3(
          positions.getX(vertexIndex),
          positions.getY(vertexIndex),
          positions.getZ(vertexIndex)
        )
      );
    });
  });

  if (originalPositions.size === 0) return;

  edgeDrag = {
    object,
    plane,
    startLocal,
    originalPositions
  };

  isDragging = true;
  controls.enabled = false;
}

// -------------------------
// 辺移動
// -------------------------

function moveEdges(event) {
  if (!edgeDrag) return;

  updatePointer(event);

  const currentPoint = new THREE.Vector3();

  if (!raycaster.ray.intersectPlane(
    edgeDrag.plane,
    currentPoint
  )) return;

  const object = edgeDrag.object;

  object.updateMatrixWorld(true);

  const currentLocal = object.worldToLocal(
    currentPoint.clone()
  );

  const delta = currentLocal.sub(edgeDrag.startLocal);

  const positions = object.geometry.attributes.position;

  edgeDrag.originalPositions.forEach((original, index) => {
    positions.setXYZ(
      index,
      original.x + delta.x,
      original.y + delta.y,
      original.z + delta.z
    );
  });

  positions.needsUpdate = true;

  object.geometry.computeVertexNormals();
  object.geometry.computeBoundingBox();
  object.geometry.computeBoundingSphere();

  // 辺の表示を更新
  const records = edgeRecords.map((edge) => ({
    ...edge,
    a: edge.a.clone(),
    b: edge.b.clone()
  }));

  records.forEach((edge) => {
    const aIndex = edge.verticesA[0];
    const bIndex = edge.verticesB[0];

    if (aIndex !== undefined) {
      edge.a.set(
        positions.getX(aIndex),
        positions.getY(aIndex),
        positions.getZ(aIndex)
      );
    }

    if (bIndex !== undefined) {
      edge.b.set(
        positions.getX(bIndex),
        positions.getY(bIndex),
        positions.getZ(bIndex)
      );
    }
  });

  const helperPositions =
    edgeHelper.geometry.attributes.position;

  records.forEach((edge, index) => {
    helperPositions.setXYZ(
      index * 2,
      edge.a.x,
      edge.a.y,
      edge.a.z
    );

    helperPositions.setXYZ(
      index * 2 + 1,
      edge.b.x,
      edge.b.y,
      edge.b.z
    );

    edgeRecords[index].a.copy(edge.a);
    edgeRecords[index].b.copy(edge.b);
  });

  helperPositions.needsUpdate = true;
  edgeHelper.geometry.computeBoundingSphere();
}

// -------------------------
// ドラッグ終了
// -------------------------

function finishVertexDrag() {
  if (!vertexDrag) return;

  vertexDrag = null;
  isDragging = false;
  controls.enabled = true;

  saveHistory();
  refreshProperties();
}

function finishEdgeDrag() {
  if (!edgeDrag) return;

  edgeDrag = null;
  isDragging = false;
  controls.enabled = true;

  saveHistory();
  refreshProperties();
}

// -------------------------
// 画面操作
// -------------------------

let pointerDownPosition = null;

canvas.addEventListener("pointerdown", (event) => {
  pointerDownPosition = {
    x: event.clientX,
    y: event.clientY
  };

  if (getEditMode() === "vertex") {
    const index = getVertexHit(event);

    pendingVertex = index === null
      ? null
      : {
          index,
          x: event.clientX,
          y: event.clientY
        };
  }

  if (getEditMode() === "edge") {
    const index = getEdgeHit(event);

    pendingEdge = index === null
      ? null
      : {
          index,
          x: event.clientX,
          y: event.clientY
        };
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (vertexDrag) {
    moveVertices(event);
    return;
  }

  if (edgeDrag) {
    moveEdges(event);
    return;
  }

  if (pendingVertex) {
    const dx = event.clientX - pendingVertex.x;
    const dy = event.clientY - pendingVertex.y;

    if (Math.sqrt(dx * dx + dy * dy) >= 6) {
      if (selectedVertexIndices.has(pendingVertex.index)) {
        beginVertexDrag(event);
        if (vertexDrag) moveVertices(event);
      }
    }
  }

  if (pendingEdge) {
    const dx = event.clientX - pendingEdge.x;
    const dy = event.clientY - pendingEdge.y;

    if (Math.sqrt(dx * dx + dy * dy) >= 6) {
      if (selectedEdgeIndices.has(pendingEdge.index)) {
        beginEdgeDrag(event);
        if (edgeDrag) moveEdges(event);
      }
    }
  }
});

canvas.addEventListener("pointerup", (event) => {
  if (vertexDrag) {
    finishVertexDrag();
    pendingVertex = null;
    pendingEdge = null;
    pointerDownPosition = null;
    return;
  }

  if (edgeDrag) {
    finishEdgeDrag();
    pendingVertex = null;
    pendingEdge = null;
    pointerDownPosition = null;
    return;
  }

  if (pendingVertex) {
    const dx = event.clientX - pendingVertex.x;
    const dy = event.clientY - pendingVertex.y;

    if (Math.sqrt(dx * dx + dy * dy) < 6) {
      toggleVertexSelection(pendingVertex.index);
    }

    pendingVertex = null;
    pointerDownPosition = null;
    return;
  }

  if (pendingEdge) {
    const dx = event.clientX - pendingEdge.x;
    const dy = event.clientY - pendingEdge.y;

    if (Math.sqrt(dx * dx + dy * dy) < 6) {
      toggleEdgeSelection(pendingEdge.index);
    }

    pendingEdge = null;
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

  if (Math.sqrt(dx * dx + dy * dy) > 5) return;

  updatePointer(event);

  const hits = raycaster.intersectObjects(
    getObjects(),
    false
  );

  if (hits.length > 0) {
    selectMesh(hits[0].object);
  }
});

canvas.addEventListener("pointercancel", () => {
  if (vertexDrag) finishVertexDrag();
  if (edgeDrag) finishEdgeDrag();

  pendingVertex = null;
  pendingEdge = null;
  pointerDownPosition = null;
});

// -------------------------
// 履歴
// -------------------------

function createSnapshot() {
  return getObjects().map((object) => ({
    name: object.name,
    type: object.geometry.type,
    position: object.position.toArray(),
    rotation: object.rotation.toArray(),
    scale: object.scale.toArray(),
    color: object.material.color.getHex(),
    vertices: Array.from(
      object.geometry.attributes.position.array
    )
  }));
}

function saveHistory() {
  const snapshot = createSnapshot();

  history = history.slice(0, historyIndex + 1);
  history.push(JSON.stringify(snapshot));

  if (history.length > 50) {
    history.shift();
  }

  historyIndex = history.length - 1;
}

function applyVertexData(object, vertices) {
  if (!vertices) return;

  const positions = object.geometry.attributes.position;

  if (positions.array.length !== vertices.length) return;

  positions.array.set(vertices);
  positions.needsUpdate = true;

  object.geometry.computeVertexNormals();
  object.geometry.computeBoundingBox();
  object.geometry.computeBoundingSphere();
}

function restoreHistory(snapshotText) {
  const snapshot = JSON.parse(snapshotText);

  detachObject();
  clearVertexHelper();
  clearEdgeHelper();

  selectedVertexIndices.clear();
  selectedEdgeIndices.clear();

  getObjects().forEach((object) => {
    selectObject(object);
    deleteSelectedObject();
  });

  snapshot.forEach((data) => {
    let type = "cube";

    if (data.type === "SphereGeometry") type = "sphere";
    if (data.type === "CylinderGeometry") type = "cylinder";

    const object = addObject(type);

    if (!object) return;

    object.name = data.name;
    object.position.fromArray(data.position);
    object.rotation.fromArray(data.rotation);
    object.scale.fromArray(data.scale);
    object.material.color.setHex(data.color);

    applyVertexData(object, data.vertices);
  });

  const objects = getObjects();

  if (objects.length > 0) {
    selectMesh(objects[objects.length - 1]);
  } else {
    refreshObjectList();
    refreshProperties();
  }

  updateEditDisplay();
}

function undoHistory() {
  if (historyIndex <= 0) return;

  historyIndex--;
  restoreHistory(history[historyIndex]);
}

function redoHistory() {
  if (historyIndex >= history.length - 1) return;

  historyIndex++;
  restoreHistory(history[historyIndex]);
}

// -------------------------
// 保存・読み込み
// -------------------------

function saveProject() {
  const data = {
    objects: createSnapshot()
  };

  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "inochi-3d-project.json";
  link.click();

  URL.revokeObjectURL(url);
}

function loadProject(data) {
  if (!data || !Array.isArray(data.objects)) return;

  detachObject();
  clearVertexHelper();
  clearEdgeHelper();

  selectedVertexIndices.clear();
  selectedEdgeIndices.clear();

  getObjects().forEach((object) => {
    selectObject(object);
    deleteSelectedObject();
  });

  data.objects.forEach((item) => {
    let type = "cube";

    if (item.type === "SphereGeometry") type = "sphere";
    if (item.type === "CylinderGeometry") type = "cylinder";

    const object = addObject(type);

    if (!object) return;

    object.name = item.name;
    object.position.fromArray(item.position);
    object.rotation.fromArray(item.rotation);
    object.scale.fromArray(item.scale);

    if (item.color !== undefined) {
      object.material.color.setHex(item.color);
    }

    applyVertexData(object, item.vertices);
  });

  const objects = getObjects();

  if (objects.length > 0) {
    selectMesh(objects[objects.length - 1]);
  }

  refreshObjectList();
  refreshProperties();

  history = [];
  historyIndex = -1;

  saveHistory();
}

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

// -------------------------
// UI接続
// -------------------------

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

    selectedVertexIndices.clear();
    selectedEdgeIndices.clear();

    detachObject();
    deleteSelectedObject();

    refreshObjectList();
    refreshProperties();

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

  onEditMode(mode) {
    updateEditDisplay();
  },

  getObjects() {
    return getObjects();
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

// -------------------------
// TransformControls
// -------------------------

window.addEventListener("transform-dragging", (event) => {
  isDragging = event.detail;
  controls.enabled = !isDragging;

  if (!isDragging) {
    saveHistory();
    refreshProperties();
  }
});

// -------------------------
// 初期オブジェクト
// -------------------------

const firstObject = addObject("cube");

if (firstObject) {
  selectMesh(firstObject);
}

refreshObjectList();
refreshProperties();

saveHistory();
