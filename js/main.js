import * as THREE from "three";
import { createScene } from "./scene.js";

import {
  initObjects,
  addObject,
  getObjects,
  getSelectedObject,
  selectObject,
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

// 3D画面の起動
const canvas = document.getElementById("threeCanvas");

const engine = createScene(canvas);

const { scene, camera, renderer, controls } = engine;

// オブジェクト管理
initObjects(scene);

// 編集ツール
initTools(camera, renderer, scene);

// 選択機能
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let pointerStart = null;
let isDragging = false;

window.addEventListener("transform-dragging", event => {
  isDragging = event.detail;
  controls.enabled = !isDragging;
});

// オブジェクト選択
canvas.addEventListener("pointerdown", event => {
  pointerStart = {
    x: event.clientX,
    y: event.clientY
  };
});

canvas.addEventListener("pointerup", event => {
  if (!pointerStart || isDragging) return;

  const dx = Math.abs(event.clientX - pointerStart.x);
  const dy = Math.abs(event.clientY - pointerStart.y);

  pointerStart = null;

  if (dx > 8 || dy > 8) return;

  const rect = canvas.getBoundingClientRect();

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(
    getObjects(),
    false
  );

  if (hits.length > 0) {
    selectMesh(hits[0].object);
  }
});

function selectMesh(object) {
  selectObject(object);
  attachObject(object);

  refreshObjectList();
  refreshProperties();
}

// UI接続
initUI({

  onAdd(type) {
    const object = addObject(type);

    if (object) {
      attachObject(object);
    }
  },

  onMode(mode) {
    setToolMode(mode);
  },

  onSelect(object) {
    selectMesh(object);
  },

  onDelete() {
    detachObject();
    deleteSelectedObject();
  },

  onDuplicate() {
    const object = duplicateSelectedObject();

    if (object) {
      attachObject(object);
    }
  },

  getObjects() {
    return getObjects();
  },

  getSelected() {
    return getSelectedObject();
  },

  onSave() {
    saveProject();
  }
});

// 初期オブジェクト
const initialCube = addObject("cube");

if (initialCube) {
  attachObject(initialCube);
}

// プロジェクト保存
function saveProject() {
  const data = {
    version: 1,
    name: "Inochi 3D Project",
    objects: getObjects().map(object => ({
      name: object.name,
      type: object.geometry.type,
      position: object.position.toArray(),
      rotation: object.rotation.toArray(),
      scale: object.scale.toArray(),
      color: "#" + object.material.color.getHexString()
    }))
  };

  const json = JSON.stringify(data, null, 2);

  try {
    localStorage.setItem(
      "inochi3d_project",
      json
    );

    const blob = new Blob(
      [json],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "inochi3d-project.json";
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    alert("プロジェクトを保存しました！");
  } catch (error) {
    console.error(error);
    alert("保存に失敗しました。");
  }
}

console.log("INOCHI 3D STUDIO STARTED");
