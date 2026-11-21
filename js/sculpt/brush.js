
import * as THREE from "three";

export function createSculptBrush(options = {}) {
  const {
    scene,
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

  // ブラシ円
  const brushCircle = new THREE.Mesh(
    new THREE.RingGeometry(0.96, 1, 64),
    new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      side: THREE.DoubleSide,
      depthTest: false,
      transparent: true,
      opacity: 0.9
    })
  );

  brushCircle.visible = false;
  brushCircle.renderOrder = 999;

  if (scene) scene.add(brushCircle);

  // 設定
  let enabled = false;
  let drawing = false;
  let changed = false;
  let pointerId = null;

  let brushMode = "raise";
  let brushRadius = 0.2;
  let brushStrength = 0.035;

  // Grab用
  let grabStartPoint = null;
  let grabOriginalPositions = null;
  let grabObject = null;

  function setRadius(value) {
    brushRadius = Math.max(
      0.05,
      Math.min(0.8, Number(value) || 0.2)
    );
    brushCircle.scale.setScalar(brushRadius);
  }

  function setStrength(value) {
    brushStrength = Math.max(
      0.005,
      Math.min(0.15, Number(value) || 0.035)
    );
  }

  function setMode(mode) {
    if (
      ["raise", "lower", "smooth", "grab"].includes(mode)
    ) {
      brushMode = mode;

      const names = {
        raise: "盛り上げ",
        lower: "へこませ",
        smooth: "スムーズ",
        grab: "つまむ"
      };

      updateDebugPanel(
        "スカルプト：" + names[mode]
      );
    }
  }

  function setEnabled(value) {
    enabled = Boolean(value);

    if (enabled) {
      updateDebugPanel(
        "スカルプトモード：指でなぞって造形"
      );
    } else {
      drawing = false;
      brushCircle.visible = false;
      pointerId = null;
      grabStartPoint = null;
      grabOriginalPositions = null;
      grabObject = null;

      updateDebugPanel("スカルプトモード終了");
    }
  }

  // ヒット位置
  function getHit(event) {
    const object = getSelectedObject();

    if (!object || !object.geometry?.attributes?.position) {
      brushCircle.visible = false;
      return null;
    }

    object.updateMatrixWorld(true);

    const rect = canvas.getBoundingClientRect();

    pointer.x =
      ((event.clientX - rect.left) / rect.width) * 2 - 1;

    pointer.y =
      -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObject(object, false);

    if (!hits.length || !hits[0].face) {
      brushCircle.visible = false;
      return null;
    }

    const hit = hits[0];
    const worldPoint = hit.point.clone();

    const worldNormal = hit.face.normal.clone()
      .transformDirection(object.matrixWorld)
      .normalize();

    brushCircle.position.copy(worldPoint);
    brushCircle.position.addScaledVector(worldNormal, 0.003);

    brushCircle.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      worldNormal
    );

    brushCircle.scale.setScalar(brushRadius);
    brushCircle.visible = true;

    return {
      object,
      point: object.worldToLocal(worldPoint)
    };
  }

  // 頂点のつながり
  function createNeighbors(geometry) {
    const count = geometry.attributes.position.count;

    const neighbors = Array.from(
      { length: count },
      () => new Set()
    );

    const indexArray = geometry.index
      ? Array.from(geometry.index.array)
      : Array.from({ length: count }, (_, i) => i);

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

    return neighbors;
  }

  // 通常のスカルプト
  function sculpt(hit) {
    const object = hit.object;
    const geometry = object.geometry;
    const positions = geometry.attributes.position;

    if (!geometry.attributes.normal) {
      geometry.computeVertexNormals();
    }

    const normals = geometry.attributes.normal;
    const neighbors = createNeighbors(geometry);
    const originalPositions = positions.array.slice();

    const sign = brushMode === "lower" ? -1 : 1;
    let moved = false;

    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3()
        .fromBufferAttribute(positions, i);

      const distance = vertex.distanceTo(hit.point);
      if (distance >= brushRadius) continue;

      const normal = new THREE.Vector3()
        .fromBufferAttribute(normals, i)
        .normalize();

      const weight = Math.pow(
        1 - distance / brushRadius,
        2
      );

      if (brushMode === "smooth") {
        const list = Array.from(neighbors[i]);
        if (!list.length) continue;

        const average = new THREE.Vector3();

        for (const neighbor of list) {
          average.x += originalPositions[neighbor * 3];
          average.y += originalPositions[neighbor * 3 + 1];
          average.z += originalPositions[neighbor * 3 + 2];
        }

        average.divideScalar(list.length);

        vertex.lerp(
          average,
          Math.min(1, brushStrength * 20 * weight)
        );
      } else {
        vertex.addScaledVector(
          normal,
          brushStrength * weight * sign
        );
      }

      positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
      moved = true;
    }

    if (moved) updateGeometry(geometry);
  }

  // Grab開始時の頂点を保存
  function startGrab(hit) {
    const positions = hit.object.geometry.attributes.position;

    grabObject = hit.object;
    grabStartPoint = hit.point.clone();
    grabOriginalPositions = positions.array.slice();

    changed = true;
  }

  // Grab：指の移動に合わせて頂点を引っ張る
  function moveGrab(hit) {
    if (!grabObject || !grabStartPoint || !grabOriginalPositions) {
      return;
    }

    const geometry = grabObject.geometry;
    const positions = geometry.attributes.position;

    const delta = hit.point.clone().sub(grabStartPoint);

    let moved = false;

    for (let i = 0; i < positions.count; i++) {
      const original = new THREE.Vector3(
        grabOriginalPositions[i * 3],
        grabOriginalPositions[i * 3 + 1],
        grabOriginalPositions[i * 3 + 2]
      );

      const distance = original.distanceTo(grabStartPoint);
      if (distance >= brushRadius) continue;

      const weight = Math.pow(
        1 - distance / brushRadius,
        2
      );

      const target = original.clone().addScaledVector(
        delta,
        weight
      );

      positions.setXYZ(
        i,
        target.x,
        target.y,
        target.z
      );

      moved = true;
    }

    if (moved) updateGeometry(geometry);
  }

  function updateGeometry(geometry) {
    const positions = geometry.attributes.position;
    positions.needsUpdate = true;

    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    changed = true;
  }

  // 指を押した
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

    if (brushMode === "grab") {
      startGrab(hit);
    } else {
      sculpt(hit);
    }
  }

  // 指を動かした
  function onPointerMove(event) {
    if (!enabled || !drawing) return;
    if (event.pointerId !== pointerId) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const hit = getHit(event);
    if (!hit) return;

    if (brushMode === "grab") {
      moveGrab(hit);
    } else {
      sculpt(hit);
    }
  }

  // 指を離した
  function finishStroke(event) {
    if (!drawing) return;
    if (event && event.pointerId !== pointerId) return;

    drawing = false;
    brushCircle.visible = false;

    try {
      if (pointerId !== null) {
        canvas.releasePointerCapture(pointerId);
      }
    } catch {}

    pointerId = null;
    grabStartPoint = null;
    grabOriginalPositions = null;
    grabObject = null;

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
