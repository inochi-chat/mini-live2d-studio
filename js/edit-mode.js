
let currentMode = "object";

export function setEditMode(mode) {
  const modes = ["object", "vertex", "edge", "face"];

  if (!modes.includes(mode)) return;

  currentMode = mode;

  window.dispatchEvent(
    new CustomEvent("edit-mode-changed", {
      detail: { mode }
    })
  );
}

export function getEditMode() {
  return currentMode;
}
