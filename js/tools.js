
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { TransformControls } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/TransformControls.js";

let transformControls = null;
let currentMode = "translate";

export function initTools(camera, renderer, scene) {
  transformControls = new TransformControls(
    camera,
    renderer.domElement
  );

  scene.add(transformControls.getHelper());

  transformControls.setMode(currentMode);
  transformControls.setSpace("world");
  transformControls.setSize(0.8);

  transformControls.addEventListener("dragging-changed", event => {
    window.dispatchEvent(
      new CustomEvent("transform-dragging", {
        detail: event.value
      })
    );
  });

  return transformControls;
}

export function attachObject(object) {
  if (!transformControls) return;

  transformControls.attach(object);
}

export function detachObject() {
  if (!transformControls) return;

  transformControls.detach();
}

export function setToolMode(mode) {
  if (!transformControls) return;

  const modes = [
    "translate",
    "rotate",
    "scale"
  ];

  if (!modes.includes(mode)) return;

  currentMode = mode;

  transformControls.setMode(mode);
}

export function getToolMode() {
  return currentMode;
}

export function setTransformSpace(space) {
  if (!transformControls) return;

  if (space !== "world" && space !== "local") return;

  transformControls.setSpace(space);
}

export function setTransformSize(size) {
  if (!transformControls) return;

  transformControls.setSize(
    THREE.MathUtils.clamp(size, 0.4, 2)
  );
}

export function disposeTools() {
  if (!transformControls) return;

  transformControls.detach();
  transformControls.dispose();
  transformControls = null;
}
