
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

  // オブジェクト追加
  addButton.addEventListener("click", () => {
    showAddMenu();
  });

  // 操作モード
  moveButton.addEventListener("click", () => {
    setMode("translate");
  });

  rotateButton.addEventListener("click", () => {
    setMode("rotate");
  });

  scaleButton.addEventListener("click", () => {
    setMode("scale");
  });

  // 複製
  duplicateButton.addEventListener("click", () => {
    callbacks.onDuplicate?.();
    refreshObjectList();
  });

  // 削除
  deleteButton.addEventListener("click", () => {
    callbacks.onDelete?.();
    refreshObjectList();
    refreshProperties();
  });

  // 保存
  saveButton.addEventListener("click", () => {
    callbacks.onSave?.();
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
    const button = document.getElementById(id);

    button?.classList.toggle(
      "active",
      mode === selectedMode
    );
  });
}

// 追加メニュー
function showAddMenu() {
  const oldMenu = document.getElementById("addMenu");
  if (oldMenu) oldMenu.remove();

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

  const types = [
    ["cube", "立方体"],
    ["sphere", "球"],
    ["cylinder", "円柱"]
  ];

  types.forEach(([type, label]) => {
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

  close.addEventListener("click", () => {
    menu.remove();
  });

  menu.appendChild(close);

  document.body.appendChild(menu);
}

// オブジェクト一覧
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

// プロパティ表示
export function refreshProperties(){
 const panel=document.getElementById("properties");
 if(!panel)return;

 const object=callbacks.getSelected?.();

 panel.innerHTML='<div class="section-title">プロパティ</div>';

 if(!object){
  const message=document.createElement("p");
  message.textContent="オブジェクトを選択してください";
  panel.appendChild(message);
  return;
 }

 const groups=[
  {title:"位置",key:"position"},
  {title:"回転",key:"rotation"},
  {title:"サイズ",key:"scale"}
 ];

 groups.forEach(group=>{
  const heading=document.createElement("div");
  heading.textContent=group.title;
  heading.style.cssText="margin-top:12px;font-size:12px;color:#c5a5ff;";
  panel.appendChild(heading);

  ["x","y","z"].forEach(axis=>{
   const row=document.createElement("div");
   row.style.cssText="display:flex;align-items:center;gap:8px;margin:7px 0;";

   const label=document.createElement("span");
   label.textContent=axis.toUpperCase();
   label.style.width="20px";

   const input=document.createElement("input");
   input.type="number";
   input.step="0.1";
   input.value=object[group.key][axis].toFixed(2);
   input.style.cssText="flex:1;min-width:0;background:#171824;color:white;border:1px solid #555;border-radius:8px;padding:9px;";

   input.addEventListener("change",()=>{
    const value=Number(input.value);
    if(!Number.isFinite(value))return;

    object[group.key][axis]=value;
    refreshProperties();
   });

   row.append(label,input);
   panel.appendChild(row);
  });
 });
}

  const rows = [
    ["位置 X", object.position.x],
    ["位置 Y", object.position.y],
    ["位置 Z", object.position.z],
    ["回転 X", object.rotation.x],
    ["回転 Y", object.rotation.y],
    ["回転 Z", object.rotation.z],
    ["サイズ X", object.scale.x],
    ["サイズ Y", object.scale.y],
    ["サイズ Z", object.scale.z]
  ];

  rows.forEach(([label, value]) => {
    const row = document.createElement("div");

    row.style.cssText = `
      display:flex;
      justify-content:space-between;
      padding:7px 0;
      font-size:12px;
      color:#c9c8e0;
    `;

    const title = document.createElement("span");
    title.textContent = label;

    const number = document.createElement("span");
    number.textContent = Number(value).toFixed(2);

    row.append(title, number);
    panel.appendChild(row);
  });
}
