
export function createDebugPanel(options = {}) {
  const getSelectedObject = options.getSelectedObject;
  const getEditMode = options.getEditMode;
  const getEdgeCount = options.getEdgeCount;
  const getFaceCount = options.getFaceCount;

  const debugPanel = document.createElement("div");

  debugPanel.style.cssText = `
    position:fixed;
    top:12px;
    right:12px;
    z-index:99999;
    width:190px;
    background:rgba(15,15,30,.94);
    color:white;
    border:1px solid #aaa;
    border-radius:10px;
    font-size:13px;
    line-height:1.7;
    pointer-events:auto;
    white-space:pre-line;
    overflow:hidden;
    box-shadow:0 4px 15px rgba(0,0,0,.3);
  `;

  const debugHeader = document.createElement("div");

  debugHeader.style.cssText = `
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:6px;
    padding:10px;
    background:rgba(104,120,255,.35);
    border-bottom:1px solid #777;
    font-weight:bold;
    cursor:grab;
    touch-action:none;
    user-select:none;
    -webkit-user-select:none;
  `;

  const debugTitle = document.createElement("span");
  debugTitle.textContent = "☰ 編集診断";
  debugTitle.style.flex = "1";
  debugTitle.style.pointerEvents = "none";

  const debugToggle = document.createElement("button");
  debugToggle.type = "button";
  debugToggle.textContent = "－";
  debugToggle.setAttribute("aria-label", "診断パネルを折りたたむ");

  debugToggle.style.cssText = `
    flex:0 0 auto;
    background:transparent;
    border:1px solid #aaa;
    border-radius:5px;
    color:white;
    padding:2px 9px;
    font-size:16px;
    line-height:1.2;
    touch-action:manipulation;
  `;

  debugHeader.appendChild(debugTitle);
  debugHeader.appendChild(debugToggle);

  const debugContent = document.createElement("div");
  debugContent.style.cssText = "padding:10px;";

  debugPanel.appendChild(debugHeader);
  debugPanel.appendChild(debugContent);
  document.body.appendChild(debugPanel);

  let collapsed = false;

  debugToggle.addEventListener("pointerdown", event => {
    event.stopPropagation();
  });

  debugToggle.addEventListener("click", event => {
    event.stopPropagation();

    collapsed = !collapsed;
    debugContent.style.display = collapsed ? "none" : "block";
    debugToggle.textContent = collapsed ? "＋" : "－";

    debugToggle.setAttribute(
      "aria-label",
      collapsed ? "診断パネルを展開" : "診断パネルを折りたたむ"
    );
  });

  const positionKey = "inochi3d-debug-panel-position";

  try {
    const saved = JSON.parse(
      localStorage.getItem(positionKey) || "null"
    );

    if (
      saved &&
      Number.isFinite(saved.left) &&
      Number.isFinite(saved.top)
    ) {
      debugPanel.style.left = Math.max(
        0,
        Math.min(window.innerWidth - debugPanel.offsetWidth, saved.left)
      ) + "px";

      debugPanel.style.top = Math.max(
        0,
        Math.min(window.innerHeight - debugPanel.offsetHeight, saved.top)
      ) + "px";

      debugPanel.style.right = "auto";
    }
  } catch (error) {
    console.warn("診断パネルの位置を復元できませんでした", error);
  }

  function updateDebugPanel(message = "待機中") {
    const selected = getSelectedObject?.();

    debugContent.textContent =
      "モード：" + (getEditMode?.() ?? "不明") + "\n" +
      "選択：" + (selected ? selected.name : "なし") + "\n" +
      "辺：" + (getEdgeCount?.() ?? 0) + "\n" +
      "面：" + (getFaceCount?.() ?? 0) + "\n" +
      "状態：" + message;
  }

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  function savePosition() {
    const rect = debugPanel.getBoundingClientRect();

    try {
      localStorage.setItem(
        positionKey,
        JSON.stringify({
          left: rect.left,
          top: rect.top
        })
      );
    } catch (error) {
      console.warn("診断パネルの位置を保存できませんでした", error);
    }
  }

  debugHeader.addEventListener("pointerdown", event => {
    if (event.target === debugToggle) return;

    dragging = true;

    const rect = debugPanel.getBoundingClientRect();

    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;

    debugPanel.style.left = rect.left + "px";
    debugPanel.style.top = rect.top + "px";
    debugPanel.style.right = "auto";

    debugHeader.style.cursor = "grabbing";
    debugHeader.setPointerCapture(event.pointerId);

    event.preventDefault();
  });

  debugHeader.addEventListener("pointermove", event => {
    if (!dragging) return;

    const maxLeft = Math.max(
      0,
      window.innerWidth - debugPanel.offsetWidth
    );

    const maxTop = Math.max(
      0,
      window.innerHeight - debugPanel.offsetHeight
    );

    debugPanel.style.left = Math.max(
      0,
      Math.min(maxLeft, event.clientX - offsetX)
    ) + "px";

    debugPanel.style.top = Math.max(
      0,
      Math.min(maxTop, event.clientY - offsetY)
    ) + "px";
  });

  function stopDragging() {
    if (!dragging) return;

    dragging = false;
    debugHeader.style.cursor = "grab";
    savePosition();
  }

  debugHeader.addEventListener("pointerup", stopDragging);
  debugHeader.addEventListener("pointercancel", stopDragging);

  window.addEventListener("resize", () => {
    const rect = debugPanel.getBoundingClientRect();

    debugPanel.style.left = Math.max(
      0,
      Math.min(window.innerWidth - debugPanel.offsetWidth, rect.left)
    ) + "px";

    debugPanel.style.top = Math.max(
      0,
      Math.min(window.innerHeight - debugPanel.offsetHeight, rect.top)
    ) + "px";

    debugPanel.style.right = "auto";
    savePosition();
  });

  return updateDebugPanel;
}
