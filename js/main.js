
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
let vertexDrag = null;

let history = [];
let historyIndex = -1;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

raycaster.params.Points.threshold = 0.15;

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
// 頂点表示
// -------------------------

function clearVertexHelper() {
  if (!vertexHelper) return;

  if (vertexHelper.parent) {
    vertexHelper.parent.remove(vertexHelper);
  }

  vertexHelper.geometry.dispose();
  vertexHelper.material.dispose();

  vertexHelper = null;
}

function showVertices(object) {
  clearVertexHelper();

  if (!object || !object.geometry) return;

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
    color: 0xffff00,
    size: 0.09,
    sizeAttenuation: true,
    depthTest: false
  });

  vertexHelper = new THREE.Points(geometry, material);
  vertexHelper.renderOrder = 10;

  object.add(vertexHelper);
}

function updateEditDisplay() {
  const mode = getEditMode();
  const selected = getSelectedObject();

  clearVertexHelper();

  if (mode === "object") {
    if (selected) {
      attachObject(selected);
    }
  } else {
    detachObject();

    if (mode === "vertex" && selected) {
      showVertices(selected);
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
// 頂点をドラッグ
// -------------------------

function startVertexDrag(event) {
  if (getEditMode() !== "vertex") return false;
  if (!vertexHelper) return false;

  updatePointer(event);

  const hits = raycaster.intersectObject(vertexHelper, false);

  if (hits.length === 0) return false;

  const index = hits[0].index;
  const object = getSelectedObject();

  if (!object || index === undefined) return false;

  const positions = object.geometry.attributes.position;

  const localPosition = new THREE.Vector3(
    positions.getX(index),
    positions.getY(index),
    positions.getZ(index)
  );

  object.updateMatrixWorld(true);

  const worldPosition = object.localToWorld(localPosition.clone());

  const normal = new THREE.Vector3();
  camera.getWorldDirection(normal);

  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
    normal,
    worldPosition
  );

  vertexDrag = {
    object,
    index,
    plane
  };

  isDragging = true;
  controls.enabled = false;

  if (canvas.setPointerCapture) {
    canvas.setPointerCapture(event.pointerId);
  }

  return true;
}

function moveVertex(event) {
  if (!vertexDrag) return;

  updatePointer(event);

  const worldPosition = new THREE.Vector3();

  const hit = raycaster.ray.intersectPlane(
    vertexDrag.plane,
    worldPosition
  );

  if (!hit) return;

  const object = vertexDrag.object;
  const index = vertexDrag.index;

  object.updateMatrixWorld(true);

  const localPosition = object.worldToLocal(worldPosition.clone());

  const positions = object.geometry.attributes.position;

  positions.setXYZ(
    index,
    localPosition.x,
    localPosition.y,
    localPosition.z
  );

  positions.needsUpdate = true;

  object.geometry.computeVertexNormals();
  object.geometry.computeBoundingBox();
  object.geometry.computeBoundingSphere();

  if (vertexHelper) {
    const helperPositions = vertexHelper.geometry.attributes.position;

    helperPositions.setXYZ(
      index,
      localPosition.x,
      localPosition.y,
      localPosition.z
    );

    helperPositions.needsUpdate = true;
  }
}

function finishVertexDrag() {
  if (!vertexDrag) return;

  vertexDrag = null;

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

  startVertexDrag(event);
});

canvas.addEventListener("pointermove", (event) => {
  if (vertexDrag) {
    moveVertex(event);
  }
});

canvas.addEventListener("pointerup", (event) => {
  if (vertexDrag) {
    finishVertexDrag();
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

  const meshes = getObjects();
  const hits = raycaster.intersectObjects(meshes, false);

  if (hits.length > 0) {
    selectMesh(hits[0].object);
  }
});

canvas.addEventListener("pointercancel", () => {
  if (vertexDrag) {
    finishVertexDrag();
  }

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

  getObjects().forEach((object) => {
    selectObject(object);
    deleteSelectedObject();
  });

  snapshot.forEach((data) => {
    let type = "cube";

    if (data.type === "SphereGeometry") {
      type = "sphere";
    } else if (data.type === "CylinderGeometry") {
      type = "cylinder";
    }

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

  getObjects().forEach((object) => {
    selectObject(object);
    deleteSelectedObject();
  });

  data.objects.forEach((item) => {
    let type = "cube";

    if (item.type === "SphereGeometry") {
      type = "sphere";
    } else if (item.type === "CylinderGeometry") {
      type = "cylinder";
    }

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
