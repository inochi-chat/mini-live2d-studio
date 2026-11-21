
import * as THREE from "three";

export function createSculptBrush(options = {}) {
  const {
    camera,
    renderer,
    getSelectedObject,
    saveHistory,
    updateDebugPanel,
    updateEditDisplay
  } = options;

  const canvas = renderer.domElement;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let enabled = false;
  let drawing = false;
  let changed = false;
  let pointerId = null;

  let brushMode = "raise";
  const brushRadius = 0.2;
  const brushStrength = 0.035;

  function setMode(mode) {
    brushMode = mode === "lower" ? "lower" : "raise";
  }

  function setEnabled(value) {
    enabled = Boolean(value);

    if (enabled) {
      updateDebugPanel("スカルプトモード：指でなぞって造形");
    } else {
      drawing = false;
      pointerId = null;
      updateDebugPanel("スカルプトモード終了");
    }
  }

  function getHit(event) {
    const object = getSelectedObject();

    if (!object || !object.geometry?.attributes?.position) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();

    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObject(object, false);

    if (!hits.length) return null;

    return {
      object,
      point: object.worldToLocal(hits[0].point.clone())
    };
  }

  function sculpt(hit) {
    const object = hit.object;
    const geometry = object.geometry;

    const positions = geometry.attributes.position;

    if (!geometry.attributes.normal) {
      geometry.computeVertexNormals();
    }

    const normals = geometry.attributes.normal;
    const sign = brushMode === "lower" ? -1 : 1;

    let moved = false;

    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3().fromBufferAttribute(
        positions,
        i
      );

      const distance = vertex.distanceTo(hit.point);

      if (distance >= brushRadius) continue;

      const normal = new THREE.Vector3().fromBufferAttribute(
        normals,
        i
      ).normalize();

      const weight = Math.pow(
        1 - distance / brushRadius,
        2
      );

      const amount = brushStrength * weight * sign;

      vertex.addScaledVector(normal, amount);

      positions.setXYZ(
        i,
        vertex.x,
        vertex.y,
        vertex.z
      );

      moved = true;
    }

    if (moved) {
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      changed = true;
    }
  }

  function onPointerDown(event) {
    if (!enabled) return;

    const hit = getHit(event);
    if (!hit) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    drawing = true;
    changed = false;
    pointerId = event.pointerId;

    try {
      canvas.setPointerCapture(pointerId);
    } catch {}

    sculpt(hit);
  }

  function onPointerMove(event) {
    if (!enabled || !drawing) return;
    if (event.pointerId !== pointerId) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const hit = getHit(event);
    if (hit) sculpt(hit);
  }

  function finishStroke(event) {
    if (!drawing) return;
    if (event && event.pointerId !== pointerId) return;

    drawing = false;

    try {
      if (pointerId !== null) {
        canvas.releasePointerCapture(pointerId);
      }
    } catch {}

    pointerId = null;

    if (changed) {
      saveHistory();
      updateEditDisplay();
    }

    changed = false;
  }

  canvas.addEventListener("pointerdown", onPointerDown, true);
  canvas.addEventListener("pointermove", onPointerMove, true);
  canvas.addEventListener("pointerup", finishStroke, true);
  canvas.addEventListener("pointercancel", finishStroke, true);

  return {
    setEnabled,
    setMode
  };
}
