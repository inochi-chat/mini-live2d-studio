
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

  // =========================
  // ブラシ表示
  // =========================

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

  scene.add(brushCircle);

  // =========================
  // 設定
  // =========================

  let enabled = false;
  let drawing = false;
  let changed = false;
  let pointerId = null;

  let brushMode = "raise";
  let brushRadius = 0.2;
  let brushStrength = 0.035;

  let grabStartPoint = null;
  let grabOriginalPositions = null;
  let grabObject = null;

  let flattenPlanePoint = null;
  let flattenPlaneNormal = null;

  // メッシュごとのマスク
  const maskData = new WeakMap();

  const brushNames = {
    raise: "盛り上げ",
    lower: "へこませ",
    smooth: "スムーズ",
    grab: "つまむ",
    inflate: "膨らませる",
    flatten: "平らにする",
    clay: "粘土",
    pinch: "引き締め",
    crease: "溝を彫る",
    mask: "マスク",
    unmask: "マスク解除"
  };

  function debug(message) {
    if (typeof updateDebugPanel === "function") {
      updateDebugPanel(message);
    }
  }

  // =========================
  // ブラシ設定
  // =========================

  function setRadius(value) {
    brushRadius = THREE.MathUtils.clamp(
      Number(value) || 0.2,
      0.05,
      0.8
    );

    brushCircle.scale.setScalar(brushRadius);
  }

  function setStrength(value) {
    brushStrength = THREE.MathUtils.clamp(
      Number(value) || 0.035,
      0.005,
      0.15
    );
  }

  function setMode(mode) {
    if (!Object.hasOwn(brushNames, mode)) return;

    brushMode = mode;

    debug("スカルプト：" + brushNames[mode]);
  }

  function setEnabled(value) {
    enabled = Boolean(value);

    if (enabled) {
      debug("スカルプトモード：指でなぞって造形");
    } else {
      finishStroke();

      drawing = false;
      brushCircle.visible = false;
      pointerId = null;

      debug("スカルプトモード終了");
    }
  }

  // =========================
  // マスク管理
  // =========================

  function getMask(geometry) {
    const count = geometry.attributes.position.count;

    let mask = maskData.get(geometry);

    if (!mask || mask.length !== count) {
      mask = new Float32Array(count);
      maskData.set(geometry, mask);
    }

    return mask;
  }

  function clearMask() {
    const object = getSelectedObject();

    if (!object) return;

    const mask = getMask(object.geometry);
    mask.fill(0);

    debug("選択オブジェクトのマスクを解除しました");
  }

  function invertMask() {
    const object = getSelectedObject();

    if (!object) return;

    const mask = getMask(object.geometry);

    for (let i = 0; i < mask.length; i++) {
      mask[i] = 1 - mask[i];
    }

    debug("マスクを反転しました");
  }

  // =========================
  // ヒットテスト
  // =========================

  function getHit(event) {
    const object = getSelectedObject();

    if (!object || !object.geometry?.attributes?.position) {
      brushCircle.visible = false;
      return null;
    }

    object.updateMatrixWorld(true);

    const rect = canvas.getBoundingClientRect();

    if (!rect.width || !rect.height) return null;

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
      point: object.worldToLocal(worldPoint),
      normal: hit.face.normal.clone().normalize()
    };
  }

  // =========================
  // 頂点のつながり
  // =========================

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

  // =========================
  // ジオメトリ更新
  // =========================

  function updateGeometry(geometry) {
    const positions = geometry.attributes.position;

    positions.needsUpdate = true;

    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    changed = true;
  }

  // =========================
  // マスクブラシ
  // =========================

  function paintMask(hit, isErasing = false) {
    const geometry = hit.object.geometry;
    const positions = geometry.attributes.position;
    const mask = getMask(geometry);

    let moved = false;

    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3()
        .fromBufferAttribute(positions, i);

      const distance = vertex.distanceTo(hit.point);

      if (distance >= brushRadius) continue;

      const weight = Math.pow(
        1 - distance / brushRadius,
        2
      );

      const amount = brushStrength * 8 * weight;

      if (isErasing) {
        mask[i] = Math.max(0, mask[i] - amount);
      } else {
        mask[i] = Math.min(1, mask[i] + amount);
      }

      moved = true;
    }

    if (moved) changed = true;
  }

  // =========================
  // 通常ブラシ
  // =========================

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
    const mask = getMask(geometry);

    const flattenHeight = flattenPlanePoint || hit.point;
    const flattenNormal = flattenPlaneNormal || hit.normal;

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

      const falloff = Math.pow(
        1 - distance / brushRadius,
        2
      );

      // マスクされた部分は編集しない
      const weight = falloff * (1 - mask[i]);

      if (weight <= 0.001) continue;

      // -------------------------
      // Flatten：平らにする
      // -------------------------

      if (brushMode === "flatten") {
        const distanceFromPlane = vertex.clone()
          .sub(flattenHeight)
          .dot(flattenNormal);

        vertex.addScaledVector(
          flattenNormal,
          -distanceFromPlane * weight
        );
      }

      // -------------------------
      // Smooth：なめらかにする
      // -------------------------

      else if (brushMode === "smooth") {
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
      }

      // -------------------------
      // Grab：つまむ
      // -------------------------

      else if (brushMode === "grab") {
        if (!grabStartPoint || !grabOriginalPositions) continue;

        const original = new THREE.Vector3(
          grabOriginalPositions[i * 3],
          grabOriginalPositions[i * 3 + 1],
          grabOriginalPositions[i * 3 + 2]
        );

        const delta = hit.point.clone().sub(grabStartPoint);

        vertex.copy(original).addScaledVector(delta, weight);
      }

      // -------------------------
      // Pinch：引き締める
      // -------------------------

      else if (brushMode === "pinch") {
        const direction = hit.point.clone().sub(vertex);

        vertex.addScaledVector(
          direction,
          brushStrength * 3 * weight
        );
      }

      // -------------------------
      // Raise / Lower / Inflate
      // -------------------------

      else if (
        brushMode === "raise" ||
        brushMode === "lower" ||
        brushMode === "inflate"
      ) {
        vertex.addScaledVector(
          normal,
          brushStrength * weight * sign
        );
      }

      // -------------------------
      // Clay：粘土
      // -------------------------

      else if (brushMode === "clay") {
        const amount = brushStrength * weight;

        vertex.addScaledVector(normal, amount);

        const list = Array.from(neighbors[i]);

        if (list.length) {
          const average = new THREE.Vector3();

          for (const neighbor of list) {
            average.x += originalPositions[neighbor * 3];
            average.y += originalPositions[neighbor * 3 + 1];
            average.z += originalPositions[neighbor * 3 + 2];
          }

          average.divideScalar(list.length);

          vertex.lerp(
            average,
            Math.min(0.2, amount * 2)
          );
        }
      }

      // -------------------------
      // Crease：溝を彫る
      // -------------------------

      else if (brushMode === "crease") {
        const narrowWeight = Math.pow(falloff, 2);

        vertex.addScaledVector(
          normal,
          -brushStrength * 2 * narrowWeight * (1 - mask[i])
        );
      }

      positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
      moved = true;
    }

    if (moved) updateGeometry(geometry);
  }

  // =========================
  // Grab開始
  // =========================

  function startGrab(hit) {
    const positions = hit.object.geometry.attributes.position;

    grabObject = hit.object;
    grabStartPoint = hit.point.clone();
    grabOriginalPositions = positions.array.slice();

    changed = true;
  }

  // =========================
  // Grab移動
  // =========================

  function moveGrab(hit) {
    if (!grabObject || !grabStartPoint || !grabOriginalPositions) {
      return;
    }

    const geometry = grabObject.geometry;
    const positions = geometry.attributes.position;
    const mask = getMask(geometry);

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

      const weight =
        Math.pow(1 - distance / brushRadius, 2) *
        (1 - mask[i]);

      const target = original.clone().addScaledVector(
        delta,
        weight
      );

      positions.setXYZ(i, target.x, target.y, target.z);

      moved = true;
    }

    if (moved) updateGeometry(geometry);
  }

  // =========================
  // ストローク開始
  // =========================

  function onPointerDown(event) {
    if (!enabled || drawing) return;

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
    }

    else if (brushMode === "flatten") {
      flattenPlanePoint = hit.point.clone();
      flattenPlaneNormal = hit.normal.clone();
      sculpt(hit);
    }

    else if (brushMode === "mask") {
      paintMask(hit, false);
    }

    else if (brushMode === "unmask") {
      paintMask(hit, true);
    }

    else {
      sculpt(hit);
    }
  }

  // =========================
  // ストローク移動
  // =========================

  function onPointerMove(event) {
    if (!enabled) {
      brushCircle.visible = false;
      return;
    }

    if (!drawing) {
      getHit(event);
      return;
    }

    if (event.pointerId !== pointerId) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const hit = getHit(event);

    if (!hit) return;

    if (brushMode === "grab") {
      moveGrab(hit);
    }

    else if (brushMode === "mask") {
      paintMask(hit, false);
    }

    else if (brushMode === "unmask") {
      paintMask(hit, true);
    }

    else {
      sculpt(hit);
    }
  }

  // =========================
  // ストローク終了
  // =========================

  function finishStroke(event) {
    if (!drawing) return;

    if (
      event &&
      pointerId !== null &&
      event.pointerId !== pointerId
    ) {
      return;
    }

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

    flattenPlanePoint = null;
    flattenPlaneNormal = null;

    if (changed) {
      if (typeof saveHistory === "function") {
        saveHistory();
      }

      if (typeof updateEditDisplay === "function") {
        updateEditDisplay();
      }
    }

    changed = false;
  }

  // =========================
  // イベント登録
  // =========================

  canvas.style.touchAction = "none";

  canvas.addEventListener(
    "pointerdown",
    onPointerDown,
    true
  );

  canvas.addEventListener(
    "pointermove",
    onPointerMove,
    true
  );

  canvas.addEventListener(
    "pointerup",
    finishStroke,
    true
  );

  canvas.addEventListener(
    "pointercancel",
    finishStroke,
    true
  );

  // =========================
  // 外部操作
  // =========================

  setRadius(brushRadius);
  setStrength(brushStrength);

  return {
    setEnabled,
    setMode,
    setRadius,
    setStrength,
    clearMask,
    invertMask
  };
}
