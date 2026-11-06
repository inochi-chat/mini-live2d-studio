
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

const {
  scene,
  camera,
  renderer,
  controls
} = createScene(canvas);

initObjects(scene);
initTools(camera, renderer, scene);

let isDragging = false;
let vertexHelper = null;

let history = [];
let historyIndex = -1;

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

  const geometry = object.geometry;
  const positions = geometry.attributes.position;

  if (!positions) return;

  const points = [];

  for (let i = 0; i < positions.count; i++) {
    points.push(
      positions.getX(i),
      positions.getY(i),
      positions.getZ(i)
    );
  }

  const vertexGeometry = new THREE.BufferGeometry();

  vertexGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(points, 3)
  );

  const vertexMaterial = new THREE.PointsMaterial({
    color: 0xffff00,
    size: 0.09,
    sizeAttenuation: true,
    depthTest: false
  });

  vertexHelper = new THREE.Points(
    vertexGeometry,
    vertexMaterial
  );

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

// 編集モード変更を受け取る
window.addEventListener("edit-mode-changed", () => {
  updateEditDisplay();
});

// -------------------------
// オブジェクト選択
// -------------------------

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

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

let pointerDownPosition = null;

canvas.addEventListener("pointerdown", (event) => {
  pointerDownPosition = {
    x: event.clientX,
    y: event.clientY
  };
});

canvas.addEventListener("pointerup", (event) => {
  if (isDragging || !pointerDownPosition) return;

  const dx = event.clientX - pointerDownPosition.x;
  const dy = event.clientY - pointerDownPosition.y;

  pointerDownPosition = null;

  if (Math.sqrt(dx * dx + dy * dy) > 5) return;

  const rect = canvas.getBoundingClientRect();

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  const meshes = getObjects();

  const hits = raycaster.intersectObjects(meshes, false);

  if (hits.length > 0) {
    selectMesh(hits[0].object);
  }
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
    color: object.material.color.getHex()
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
