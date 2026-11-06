
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

// ===================================
// 1. 3Dエンジン起動
// ===================================

const canvas = document.getElementById("threeCanvas");

const engine = createScene(canvas);

const { scene, camera, renderer, controls } = engine;

initObjects(scene);
initTools(camera, renderer, scene);

// ===================================
// 2. オブジェクト選択処理
// ===================================

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let pointerStart = null;
let isDragging = false;

window.addEventListener("transform-dragging", event => {
  isDragging = event.detail;
  controls.enabled = !isDragging;

  // 操作終了時に履歴を保存
  if (!isDragging) {
    saveHistory();
    refreshProperties();
  }
});

canvas.addEventListener("pointerdown", event => {
  pointerStart = {
    x: event.clientX,
    y: event.clientY
  };
});

canvas.addEventListener("pointercancel", () => {
  pointerStart = null;
});

canvas.addEventListener("pointerup", event => {
  if (!pointerStart || isDragging) return;

  const dx = Math.abs(event.clientX - pointerStart.x);
  const dy = Math.abs(event.clientY - pointerStart.y);

  pointerStart = null;

  if (dx > 8 || dy > 8) return;

  const rect = canvas.getBoundingClientRect();

  pointer.x =
    ((event.clientX - rect.left) / rect.width) * 2 - 1;

  pointer.y =
    -((event.clientY - rect.top) / rect.height) * 2 + 1;

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

// ===================================
// 3. 操作履歴システム
// ===================================

let historyStack = [];
let historyIndex = -1;

const MAX_HISTORY = 50;

function createSnapshot() {
  return getObjects().map(object => ({
    name: object.name,
    type: object.geometry.type,

    position: object.position.toArray(),
    rotation: object.rotation.toArray(),
    scale: object.scale.toArray(),

    color: "#" + object.material.color.getHexString()
  }));
}

function saveHistory() {
  const state = JSON.stringify(createSnapshot());

  // 同じ状態は重複保存しない
  if (
    historyIndex >= 0 &&
    historyStack[historyIndex] === state
  ) {
    return;
  }

  // Undo後に新しい操作をした場合、
  // 未来の履歴を削除
  historyStack = historyStack.slice(
    0,
    historyIndex + 1
  );

  historyStack.push(state);

  if (historyStack.length > MAX_HISTORY) {
    historyStack.shift();
  }

  historyIndex = historyStack.length - 1;
}

function restoreHistory(index) {
  if (
    index < 0 ||
    index >= historyStack.length
  ) {
    return;
  }

  const state = JSON.parse(historyStack[index]);

  // 現在のオブジェクトを削除
  detachObject();

  [...getObjects()].forEach(object => {
    selectObject(object);
    deleteSelectedObject();
  });

  // 履歴からオブジェクトを再生成
  state.forEach(item => {
    let type = null;

    if (item.type === "BoxGeometry") {
      type = "cube";
    }

    if (item.type === "SphereGeometry") {
      type = "sphere";
    }

    if (item.type === "CylinderGeometry") {
      type = "cylinder";
    }

    if (!type) return;

    const object = addObject(type);

    if (!object) return;

    object.name = item.name;

    object.position.fromArray(item.position);
    object.rotation.fromArray(item.rotation);
    object.scale.fromArray(item.scale);

    object.material.color.set(item.color);
  });

  // 最後のオブジェクトを選択
  const objects = getObjects();

  if (objects.length > 0) {
    const lastObject = objects[objects.length - 1];

    selectObject(lastObject);
    attachObject(lastObject);
  }

  historyIndex = index;

  refreshObjectList();
  refreshProperties();
}

function undoHistory() {
  if (historyIndex <= 0) return;

  restoreHistory(historyIndex - 1);
}

function redoHistory() {
  if (historyIndex >= historyStack.length - 1) return;

  restoreHistory(historyIndex + 1);
}

// ===================================
// 4. UIとの接続
// ===================================

initUI({

  // オブジェクト追加
  onAdd(type) {
    const object = addObject(type);

    if (object) {
      attachObject(object);
      saveHistory();
    }
  },

  // 操作モード
  onMode(mode) {
    setToolMode(mode);
  },

  // 選択
  onSelect(object) {
    selectMesh(object);
  },

  // 削除
  onDelete() {
    detachObject();
    deleteSelectedObject();
    saveHistory();
  },

  // 複製
  onDuplicate() {
    const object = duplicateSelectedObject();

    if (object) {
      attachObject(object);
      saveHistory();
    }
  },

  // 数値編集
  onPropertyChange() {
    saveHistory();
  },

  // 一覧取得
  getObjects() {
    return getObjects();
  },

  // 選択中のオブジェクト取得
  getSelected() {
    return getSelectedObject();
  },

  // 保存
  onSave() {
    saveProject();
  },

  // Undo
  onUndo() {
    undoHistory();
  },

  // Redo
  onRedo() {
    redoHistory();
  }

});

// ===================================
// 5. 最初の立方体
// ===================================

const initialCube = addObject("cube");

if (initialCube) {
  attachObject(initialCube);
}

refreshObjectList();
refreshProperties();

// 最初の状態を記録
saveHistory();

// ===================================
// 6. プロジェクト保存
// ===================================

function saveProject() {
  const data = {
    version: 1,
    name: "Inochi 3D Project",
    objects: createSnapshot()
  };

  const json = JSON.stringify(data, null, 2);

  try {
    localStorage.setItem("inochi3d_project", json);

    const blob = new Blob(
      [json],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "inochi3d-project.json";

    link.click();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);

    alert("プロジェクトを保存しました！");

  } catch (error) {
    console.error(error);
    alert("保存に失敗しました。");
  }
}

// ===================================
// 7. プロジェクト読み込み
// ===================================

const loadButton = document.getElementById("loadButton");
const loadFileInput = document.getElementById("loadFileInput");

if (loadButton && loadFileInput) {

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

      detachObject();

      // 現在のモデルを削除
      [...getObjects()].forEach(object => {
        selectObject(object);
        deleteSelectedObject();
      });

      // モデルを復元
      data.objects.forEach(item => {

        let type = null;

        if (item.type === "BoxGeometry") {
          type = "cube";
        }

        if (item.type === "SphereGeometry") {
          type = "sphere";
        }

        if (item.type === "CylinderGeometry") {
          type = "cylinder";
        }

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

      // 最後のモデルを選択
      const objects = getObjects();

      if (objects.length > 0) {
        const lastObject = objects[objects.length - 1];

        selectObject(lastObject);
        attachObject(lastObject);
      }

      // 読み込み後の状態を履歴に保存
      saveHistory();

      refreshObjectList();
      refreshProperties();

      alert("プロジェクトを読み込みました！");

    } catch (error) {
      console.error(error);

      alert(
        "読み込みに失敗しました。JSONファイルを確認してください。"
      );
    }

    loadFileInput.value = "";
  });
}

console.log("INOCHI 3D STUDIO STARTED");
