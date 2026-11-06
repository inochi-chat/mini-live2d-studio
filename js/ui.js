import { setEditMode as setEditorEditMode } from "./edit-mode.js";
let callbacks = {};
let selectedMode = "translate";

export function initUI(options = {}) {
  callbacks = options;

  const addButton = document.getElementById("addButton");
  const moveButton = document.getElementById("moveButton");
  const rotateButton = document.getElementById("rotateButton");
  const scaleButton = document.getElementById("scaleButton");
  const duplicateButton = document.getElementById("duplicateButton");
  const deleteButton = document.getElementById("deleteButton");
  const saveButton = document.getElementById("saveButton");
  const undoButton = document.getElementById("undoButton");
  const redoButton = document.getElementById("redoButton");
  // 編集モードボタン
const objectModeButton = document.getElementById("objectModeButton");
const vertexModeButton = document.getElementById("vertexModeButton");
const edgeModeButton = document.getElementById("edgeModeButton");
const faceModeButton = document.getElementById("faceModeButton");

objectModeButton.addEventListener("click", () => {
  setEditMode("object");
});

vertexModeButton.addEventListener("click", () => {
  setEditMode("vertex");
});

edgeModeButton.addEventListener("click", () => {
  setEditMode("edge");
});

faceModeButton.addEventListener("click", () => {
  setEditMode("face");
});

  addButton.addEventListener("click", showAddMenu);
  moveButton.addEventListener("click", () => setMode("translate"));
  rotateButton.addEventListener("click", () => setMode("rotate"));
  scaleButton.addEventListener("click", () => setMode("scale"));

  duplicateButton.addEventListener("click", () => {
    callbacks.onDuplicate?.();
    refreshObjectList();
    refreshProperties();
  });

  deleteButton.addEventListener("click", () => {
    callbacks.onDelete?.();
    refreshObjectList();
    refreshProperties();
  });

  saveButton.addEventListener("click", () => {
    callbacks.onSave?.();
  });

  undoButton.addEventListener("click", () => {
    callbacks.onUndo?.();
  });

  redoButton.addEventListener("click", () => {
    callbacks.onRedo?.();
  });

  updateModeButtons();
  refreshObjectList();
  refreshProperties();
}

function setMode(mode) {
  selectedMode = mode;
  callbacks.onMode?.(mode);
  updateModeButtons();
}

function updateModeButtons() {
  const modes = {
    translate: "moveButton",
    rotate: "rotateButton",
    scale: "scaleButton"
  };

  Object.entries(modes).forEach(([mode, id]) => {
    document.getElementById(id)?.classList.toggle(
      "active",
      mode === selectedMode
    );
  });
}

function showAddMenu() {
  document.getElementById("addMenu")?.remove();

  const menu = document.createElement("div");
  menu.id = "addMenu";

  menu.style.cssText = `
    position:fixed;
    left:12px;
    right:12px;
    bottom:calc(45% + 15px);
    z-index:100;
    padding:16px;
    border-radius:16px;
    background:#292b40;
    border:1px solid #7770ae;
    display:grid;
    grid-template-columns:repeat(3,1fr);
    gap:10px;
  `;

  [
    ["cube", "立方体"],
    ["sphere", "球"],
    ["cylinder", "円柱"]
  ].forEach(([type, label]) => {
    const button = document.createElement("button");
    button.textContent = label;

    button.addEventListener("click", () => {
      callbacks.onAdd?.(type);
      menu.remove();
      refreshObjectList();
      refreshProperties();
    });

    menu.appendChild(button);
  });

  const close = document.createElement("button");
  close.textContent = "閉じる";
  close.style.gridColumn = "1 / -1";
  close.addEventListener("click", () => menu.remove());

  menu.appendChild(close);
  document.body.appendChild(menu);
}

export function refreshObjectList() {
  const list = document.getElementById("objectList");
  if (!list) return;

  list.innerHTML = "";

  const objects = callbacks.getObjects?.() || [];
  const selected = callbacks.getSelected?.();

  document.getElementById("objectCount").textContent =
    "Objects: " + objects.length;

  if (objects.length === 0) {
    list.innerHTML =
      '<p class="empty-message">オブジェクトがありません</p>';
    return;
  }

  objects.forEach((object, index) => {
    const item = document.createElement("div");
    item.className = "object-item";

    if (object === selected) {
      item.classList.add("selected");
    }

    const name = document.createElement("span");
    name.textContent = object.name || "Object " + (index + 1);

    const type = document.createElement("span");
    type.textContent = object.geometry?.type || "Mesh";

    item.append(name, type);

    item.addEventListener("click", () => {
      callbacks.onSelect?.(object);
      refreshObjectList();
      refreshProperties();
    });

    list.appendChild(item);
  });
}

export function refreshProperties() {
  const panel = document.getElementById("properties");
  if (!panel) return;

  const object = callbacks.getSelected?.();

  panel.innerHTML =
    '<div class="section-title">プロパティ</div>';

  if (!object) {
    const message = document.createElement("p");
    message.textContent = "オブジェクトを選択してください";
    panel.appendChild(message);
    return;
  }

  const groups = [
    { title: "位置", key: "position" },
    { title: "回転", key: "rotation" },
    { title: "サイズ", key: "scale" }
  ];

  groups.forEach(group => {
    const heading = document.createElement("div");
    heading.textContent = group.title;
    heading.style.cssText =
      "margin-top:12px;font-size:12px;color:#c5a5ff;";
    panel.appendChild(heading);

    ["x", "y", "z"].forEach(axis => {
      const row = document.createElement("div");
      row.style.cssText =
        "display:flex;align-items:center;gap:8px;margin:7px 0;";

      const label = document.createElement("span");
      label.textContent = axis.toUpperCase();
      label.style.width = "20px";

      const input = document.createElement("input");
      input.type = "number";
      input.step = "0.1";
      input.value = object[group.key][axis].toFixed(2);
      input.style.cssText =
        "flex:1;min-width:0;background:#171824;color:white;border:1px solid #555;border-radius:8px;padding:9px;";

      input.addEventListener("change", () => {
        const value = Number(input.value);
        if (!Number.isFinite(value)) return;

        object[group.key][axis] = value;
        callbacks.onPropertyChange?.();
        refreshProperties();
      });

      row.append(label, input);
      panel.appendChild(row);
    });
  });
}
// 編集モード切り替え
let currentEditMode = "object";

function setEditMode(mode) {
  currentEditMode = mode;
  setEditorEditMode(mode);
  const buttons = {
    object: "objectModeButton",
    vertex: "vertexModeButton",
    edge: "edgeModeButton",
    face: "faceModeButton"
  };

  Object.entries(buttons).forEach(([key, id]) => {
    document.getElementById(id)?.classList.toggle(
      "active",
      key === mode
    );
  });

  callbacks.onEditMode?.(mode);
}

export function getEditMode() {
  return currentEditMode;
}
