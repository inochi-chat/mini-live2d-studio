
import { setEditMode as setEditorEditMode } from "./edit-mode.js";
import { showObjectMenu } from "./object-menu.js";

let callbacks = {};
let selectedMode = "translate";
let currentEditMode = "object";
let workspaceMode = "object";

export function initUI(options = {}) {
  callbacks = options;
    createWorkspaceModeControls();

  const addButton = document.getElementById("addButton");
  const moveButton = document.getElementById("moveButton");
  const rotateButton = document.getElementById("rotateButton");
  const scaleButton = document.getElementById("scaleButton");
  const duplicateButton = document.getElementById("duplicateButton");
  const deleteButton = document.getElementById("deleteButton");
  const saveButton = document.getElementById("saveButton");
  const undoButton = document.getElementById("undoButton");
  const redoButton = document.getElementById("redoButton");

  const objectModeButton = document.getElementById("objectModeButton");
  const vertexModeButton = document.getElementById("vertexModeButton");
  const edgeModeButton = document.getElementById("edgeModeButton");
  const faceModeButton = document.getElementById("faceModeButton");

  objectModeButton?.addEventListener("click", () => setEditMode("object"));
  vertexModeButton?.addEventListener("click", () => setEditMode("vertex"));
  edgeModeButton?.addEventListener("click", () => setEditMode("edge"));
  faceModeButton?.addEventListener("click", () => setEditMode("face"));

  addButton?.addEventListener("click", () => {
    console.log("追加ボタンが押されました");
    console.log("現在の制作モード:", workspaceMode);
    
    showObjectMenu((type) => {
    console.log("追加するパーツ:", type);

    const result = callbacks.onAdd?.(type);

    refreshObjectList();
    refreshProperties();

    return result;
  }, workspaceMode);
});
  moveButton?.addEventListener("click", () => setMode("translate"));
  rotateButton?.addEventListener("click", () => setMode("rotate"));
  scaleButton?.addEventListener("click", () => setMode("scale"));

  duplicateButton?.addEventListener("click", () => {
    callbacks.onDuplicate?.();
    refreshObjectList();
    refreshProperties();
  });

  deleteButton?.addEventListener("click", () => {
    callbacks.onDelete?.();
    refreshObjectList();
    refreshProperties();
  });

  saveButton?.addEventListener("click", () => callbacks.onSave?.());
  undoButton?.addEventListener("click", () => callbacks.onUndo?.());
  redoButton?.addEventListener("click", () => callbacks.onRedo?.());

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

export function refreshObjectList() {
  const list = document.getElementById("objectList");
  if (!list) return;

  list.innerHTML = "";

  const objects = callbacks.getObjects?.() || [];
  const selected = callbacks.getSelected?.();

  const count = document.getElementById("objectCount");
  if (count) count.textContent = "Objects: " + objects.length;

  if (objects.length === 0) {
    list.innerHTML =
      '<p class="empty-message">オブジェクトがありません</p>';
    return;
  }

  objects.forEach((object, index) => {
    const item = document.createElement("div");
    item.className = "object-item";

    if (object === selected) item.classList.add("selected");

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

function createMaterialControls(panel) {
  const material = callbacks.getMaterial?.();

  const heading = document.createElement("div");
  heading.textContent = "材質・カラー";
  heading.style.cssText =
    "margin-top:20px;padding-top:12px;border-top:1px solid #555;font-size:14px;color:#c5a5ff;";
  panel.appendChild(heading);

  if (!material) {
    const message = document.createElement("p");
    message.textContent = "材質情報を取得できません";
    panel.appendChild(message);
    return;
  }

  const colorLabel = document.createElement("div");
  colorLabel.textContent = "オブジェクトの色";
  colorLabel.style.cssText = "margin-top:12px;font-size:12px;";
  panel.appendChild(colorLabel);

  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = material.color || "#9b8cff";
  colorInput.style.cssText =
    "width:100%;height:42px;margin-top:6px;background:#171824;border:1px solid #555;border-radius:8px;";

  colorInput.addEventListener("input", () => {
    callbacks.onMaterialChange?.({ color: colorInput.value });
  });

  panel.appendChild(colorInput);

  createMaterialSlider(
    panel,
    "光沢（低いほどツヤが強い）",
    "roughness",
    material.roughness ?? 0.55
  );

  createMaterialSlider(
    panel,
    "金属感",
    "metalness",
    material.metalness ?? 0.05
  );
}

function createMaterialSlider(panel, labelText, key, initialValue) {
  const row = document.createElement("div");
  row.style.cssText = "margin-top:14px;";

  const label = document.createElement("div");
  label.style.cssText =
    "display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;";

  const name = document.createElement("span");
  name.textContent = labelText;

  const valueText = document.createElement("span");
  valueText.textContent = Number(initialValue).toFixed(2);

  label.append(name, valueText);

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "1";
  slider.step = "0.01";
  slider.value = initialValue;
  slider.style.width = "100%";

  slider.addEventListener("input", () => {
    const value = Number(slider.value);
    valueText.textContent = value.toFixed(2);
    callbacks.onMaterialChange?.({ [key]: value });
  });

  row.append(label, slider);
  panel.appendChild(row);
}

function createFacePaintControls(panel) {
  const heading = document.createElement("div");
  heading.textContent = "面の色塗り";
  heading.style.cssText =
    "margin-top:20px;padding-top:12px;border-top:1px solid #555;font-size:14px;color:#c5a5ff;";
  panel.appendChild(heading);

  const description = document.createElement("p");
  description.textContent =
    "面モードで色を塗りたい面を選択してください。";
  description.style.cssText =
    "font-size:12px;line-height:1.6;color:#ccc;margin-top:10px;";
  panel.appendChild(description);

  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = "#ff6699";
  colorInput.style.cssText =
    "width:100%;height:42px;margin-top:6px;background:#171824;border:1px solid #555;border-radius:8px;";
  panel.appendChild(colorInput);

  const paintButton = document.createElement("button");
  paintButton.textContent = "選択した面に色を塗る";
  paintButton.style.cssText = `
    width:100%;
    margin-top:10px;
    padding:12px;
    border:1px solid #a78bfa;
    border-radius:10px;
    background:#51417c;
    color:white;
    font-size:13px;
  `;

  paintButton.addEventListener("click", () => {
    if (currentEditMode !== "face") {
      alert("先に面モードに切り替えてください。");
      return;
    }

    callbacks.onFacePaint?.(colorInput.value);
  });

  panel.appendChild(paintButton);
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

  createMaterialControls(panel);
  createFacePaintControls(panel);
}

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
  refreshProperties();
}

export function getEditMode() {
  return currentEditMode;
}

export function createWorkspaceModeControls() {
  const addButton = document.getElementById("addButton");
  if (!addButton || document.getElementById("workspaceModeBar")) return;

  const bar = document.createElement("div");
  bar.id = "workspaceModeBar";

  bar.style.cssText = `
    display: flex;
    gap: 8px;
    width: 100%;
    margin-bottom: 10px;
  `;

  const modes = [
    ["object", "通常モード"],
    ["character", "キャラクター制作"]
  ];

  modes.forEach(([mode, label]) => {
    const button = document.createElement("button");
    button.textContent = label;
    button.dataset.mode = mode;

    button.style.cssText = `
      flex: 1;
      min-height: 44px;
      border: 1px solid #8c7bd1;
      border-radius: 10px;
      background: #292b40;
      color: white;
      padding: 8px;
      font-size: 13px;
    `;

    button.addEventListener("click", () => {
      workspaceMode = mode;

      bar.querySelectorAll("button").forEach(item => {
        item.style.background =
          item.dataset.mode === mode ? "#7053ad" : "#292b40";
      });

      callbacks.onWorkspaceMode?.(mode);

      console.log("制作モード:", mode);
    });

    bar.appendChild(button);
  });

  addButton.parentElement.insertBefore(bar, addButton);

  bar.querySelector('[data-mode="object"]').click();
}
