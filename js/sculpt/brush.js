
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
  let brushRadius = 0.2;
  let brushStrength = 0.035;

  function setRadius(value) {
    brushRadius = Math.max(0.05, Math.min(0.8, Number(value) || 0.2));
  }

  function setStrength(value) {
    brushStrength = Math.max(0.005, Math.min(0.15, Number(value) || 0.035));
  }

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
    // 頂点同士のつながりを取得
const neighbors = Array.from(
  { length: positions.count },
  () => new Set()
);

const indexArray = geometry.index
  ? Array.from(geometry.index.array)
  : Array.from(
      { length: positions.count },
      (_, i) => i
    );

for (let i = 0; i + 2 < indexArray.length; i += 3) {
  const a = indexArray[i];
  const b = indexArray[i + 1];
  const c = indexArray[i + 2];

  neighbors[a].add(b);
  neighbors[a].add(c);
  neighbors[b].add(a);
  neighbors[b].add(c);
  neighbors[c].add(a);
  neighbors[c].add(b);
}

const originalPositions = positions.array.slice();
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

      if (brushMode === "smooth") {
  const list = Array.from(neighbors[i]);

  if (list.length === 0) continue;

  const average = new THREE.Vector3();

  for (const neighbor of list) {
    average.x += originalPositions[neighbor * 3];
    average.y += originalPositions[neighbor * 3 + 1];
    average.z += originalPositions[neighbor * 3 + 2];
  }

  average.divideScalar(list.length);

  const smoothAmount = Math.min(
    1,
    brushStrength * 20 * weight
  );

  vertex.lerp(average, smoothAmount);
} else {
  vertex.addScaledVector(normal, amount);
}

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
    setMode,
    setRadius,
    setStrength
  };
}
