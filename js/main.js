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
  // プロジェクト読み込み
const loadButton = document.getElementById("loadButton");
const loadFileInput = document.getElementById("loadFileInput");

loadButton.addEventListener("click", () => {
  loadFileInput.click();
});

loadFileInput.addEventListener("change", async () => {
  const file = loadFileInput.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!Array.isArray(data.objects)) {
      throw new Error("不正なプロジェクトファイルです");
    }

    // 現在のオブジェクトをすべて削除
    detachObject();
    [...getObjects()].forEach(object => {
      selectObject(object);
      deleteSelectedObject();
    });

    // 読み込んだオブジェクトを復元
    data.objects.forEach(item => {
      let type;

      if (item.type === "BoxGeometry") type = "cube";
      if (item.type === "SphereGeometry") type = "sphere";
      if (item.type === "CylinderGeometry") type = "cylinder";

      if (!type) return;

      const object = addObject(type);
      if (!object) return;

      object.name = item.name || type;
      object.position.fromArray(item.position);
      object.rotation.fromArray(item.rotation);
      object.scale.fromArray(item.scale);

      if (item.color) {
        object.material.color.set(item.color);
      }
    });

    detachObject();

    const objects = getObjects();
    if (objects.length > 0) {
      selectObject(objects[objects.length - 1]);
      attachObject(getSelectedObject());
    }

    refreshObjectList();
    refreshProperties();

    alert("プロジェクトを読み込みました！");
  } catch (error) {
    console.error(error);
    alert("読み込みに失敗しました。JSONファイルを確認してください。");
  }

  loadFileInput.value = "";
});

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
