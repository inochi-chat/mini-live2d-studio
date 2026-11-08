import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import * as THREE from "three";
import { createScene } from "./scene.js";

import {
  initObjects, addObject, selectObject, getSelectedObject,
  getObjects, deleteSelectedObject, duplicateSelectedObject
} from "./objects.js";

import {
  initTools, attachObject, detachObject, setToolMode
} from "./tools.js";

import {
  initUI, refreshObjectList, refreshProperties
} from "./ui.js";

import { getEditMode } from "./edit-mode.js";

const canvas = document.getElementById("threeCanvas");
const { scene, camera, renderer, controls } = createScene(canvas);

initObjects(scene);
initTools(camera, renderer, scene);

let isDragging = false;

let vertexHelper = null;
let edgeHelper = null;
let faceHelper = null;

let vertexDrag = null;
let edgeDrag = null;
let faceDrag = null;

let pendingVertex = null;
let pendingEdge = null;
let pendingFace = null;
let pointerDownPosition = null;

let selectedVertexIndices = new Set();
let selectedEdgeIndices = new Set();
let selectedFaceIndices = new Set();

let edgeRecords = [];
let faceRecords = [];
let faceTriangleToRecord = [];

let history = [];
let historyIndex = -1;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

raycaster.params.Points.threshold = 0.5;
raycaster.params.Line.threshold = 0.5;

// -------------------------
// 診断パネル
// -------------------------

const debugPanel = document.createElement("div");

debugPanel.style.cssText = `
  position:fixed;
  top:12px;
  right:12px;
  z-index:99999;
  background:rgba(15,15,30,.94);
  color:white;
  padding:12px;
  border:1px solid #aaa;
  border-radius:10px;
  font-size:13px;
  line-height:1.7;
  pointer-events:none;
  white-space:pre-line;
  max-width:190px;
`;

document.body.appendChild(debugPanel);

function updateDebugPanel(message = "待機中") {
  const selected = getSelectedObject();

  debugPanel.textContent =
    "🔧 編集診断\n" +
    "モード：" + getEditMode() + "\n" +
    "選択：" + (selected ? selected.name : "なし") + "\n" +
    "辺：" + edgeRecords.length + "\n" +
    "面：" + faceRecords.length + "\n" +
    "状態：" + message;
}

// -------------------------
// ポインター
// -------------------------

function updatePointer(event) {
  const rect = canvas.getBoundingClientRect();

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
}

// -------------------------
// ヘルパー削除
// -------------------------

function clearVertexHelper() {
  if (!vertexHelper) return;

  vertexHelper.parent?.remove(vertexHelper);
  vertexHelper.geometry.dispose();
  vertexHelper.material.dispose();
  vertexHelper = null;
}

function clearEdgeHelper() {
  if (!edgeHelper) return;

  edgeHelper.parent?.remove(edgeHelper);
  edgeHelper.geometry.dispose();
  edgeHelper.material.dispose();
  edgeHelper = null;
  edgeRecords = [];
}

function clearFaceHelper() {
  if (!faceHelper) return;

  faceHelper.parent?.remove(faceHelper);
  faceHelper.geometry.dispose();
  faceHelper.material.dispose();
  faceHelper = null;

  faceRecords = [];
  faceTriangleToRecord = [];
}

// -------------------------
// 頂点表示
// -------------------------

function updateVertexColors() {
  if (!vertexHelper) return;

  const positions = vertexHelper.geometry.attributes.position;
  const colors = [];

  for (let i = 0; i < positions.count; i++) {
    const color = selectedVertexIndices.has(i)
      ? new THREE.Color(0xff6600)
      : new THREE.Color(0xffff00);

    colors.push(color.r, color.g, color.b);
  }

  vertexHelper.geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3)
  );
}

function showVertices(object) {
  clearVertexHelper();

  const positions = object.geometry.attributes.position;
  const points = [];

  for (let i = 0; i < positions.count; i++) {
    points.push(
      positions.getX(i),
      positions.getY(i),
      positions.getZ(i)
    );
  }

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(points, 3)
  );

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    vertexColors: true,
    size: 0.12,
    sizeAttenuation: true,
    depthTest: false
  });

  vertexHelper = new THREE.Points(geometry, material);
  vertexHelper.renderOrder = 10;
  object.add(vertexHelper);

  updateVertexColors();
}

// -------------------------
// 頂点検索
// -------------------------

function findMatchingVertices(object, point) {
  const positions = object.geometry.attributes.position;
  const matches = [];

  for (let i = 0; i < positions.count; i++) {
    if (
      Math.abs(positions.getX(i) - point.x) < 0.0001 &&
      Math.abs(positions.getY(i) - point.y) < 0.0001 &&
      Math.abs(positions.getZ(i) - point.z) < 0.0001
    ) {
      matches.push(i);
    }
  }

  return matches;
}

// -------------------------
// 辺表示・色
// -------------------------

function updateEdgeColors() {
  if (!edgeHelper) return;

  const colors = [];

  for (let i = 0; i < edgeRecords.length; i++) {
    const color = new THREE.Color(
      selectedEdgeIndices.has(i) ? 0xff6600 : 0xffff00
    );

    colors.push(
      color.r, color.g, color.b,
      color.r, color.g, color.b
    );
  }

  edgeHelper.geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3)
  );
}

function showEdges(object) {
  clearEdgeHelper();

  const geometry = object.geometry;
  geometry.computeBoundingBox();

  const bounds = geometry.boundingBox;
  if (!bounds) return;

  const min = bounds.min;
  const max = bounds.max;

  const corners = [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, max.y, max.z)
  ];

  const positions = [];

  for (let i = 0; i < corners.length; i++) {
    for (let j = i + 1; j < corners.length; j++) {
      const a = corners[i];
      const b = corners[j];

      const axes =
        Number(Math.abs(a.x - b.x) > 0.0001) +
        Number(Math.abs(a.y - b.y) > 0.0001) +
        Number(Math.abs(a.z - b.z) > 0.0001);

      if (axes !== 1) continue;

      const verticesA = findMatchingVertices(object, a);
      const verticesB = findMatchingVertices(object, b);

      if (!verticesA.length || !verticesB.length) continue;

      edgeRecords.push({
        a: a.clone(),
        b: b.clone(),
        verticesA,
        verticesB
      });

      positions.push(
        a.x, a.y, a.z,
        b.x, b.y, b.z
      );
    }
  }

  if (!edgeRecords.length) return;

  const lineGeometry = new THREE.BufferGeometry();

  lineGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );

  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    depthTest: false,
    depthWrite: false
  });

  edgeHelper = new THREE.LineSegments(lineGeometry, material);
  edgeHelper.renderOrder = 999;
  object.add(edgeHelper);

  updateEdgeColors();
}

// -------------------------
// 面表示・色
// -------------------------

function updateFaceColors() {
  if (!faceHelper) return;

  const colors = [];

  faceRecords.forEach((face, index) => {
    const color = new THREE.Color(
      selectedFaceIndices.has(index)
        ? 0xff6600
        : 0xffff00
    );

    for (let i = 0; i < face.vertices.length; i++) {
      colors.push(color.r, color.g, color.b);
    }
  });

  faceHelper.geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3)
  );
}

function showFaces(object) {
  clearFaceHelper();

  const geometry = object.geometry;
  const positions = geometry.attributes.position;
  const indexAttribute = geometry.index;

  if (!positions) {
    updateDebugPanel("面データがありません");
    return;
  }

  const facePositions = [];

  if (
    geometry.type === "BoxGeometry" &&
    indexAttribute &&
    geometry.groups.length === 6
  ) {
    geometry.groups.forEach((group, faceIndex) => {
      const vertices = [];

      for (
        let i = group.start;
        i < group.start + group.count;
        i++
      ) {
        const vertexIndex = indexAttribute.getX(i);

        vertices.push(vertexIndex);

        facePositions.push(
          positions.getX(vertexIndex),
          positions.getY(vertexIndex),
          positions.getZ(vertexIndex)
        );
      }

      faceRecords.push({
        vertices,
        faceIndex
      });

      faceTriangleToRecord.push(faceRecords.length - 1);
      faceTriangleToRecord.push(faceRecords.length - 1);
    });
  } else {
    const count = indexAttribute
      ? indexAttribute.count
      : positions.count;

    for (let i = 0; i + 2 < count; i += 3) {
      const vertices = [];

      for (let j = 0; j < 3; j++) {
        const vertexIndex = indexAttribute
          ? indexAttribute.getX(i + j)
          : i + j;

        vertices.push(vertexIndex);

        facePositions.push(
          positions.getX(vertexIndex),
          positions.getY(vertexIndex),
          positions.getZ(vertexIndex)
        );
      }

      faceRecords.push({
        vertices,
        faceIndex: faceRecords.length
      });

      faceTriangleToRecord.push(faceRecords.length - 1);
    }
  }

  if (!faceRecords.length) {
    updateDebugPanel("面を作成できませんでした");
    return;
  }

  const faceGeometry = new THREE.BufferGeometry();

  faceGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(facePositions, 3)
  );

  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false
  });

  faceHelper = new THREE.Mesh(faceGeometry, material);
  faceHelper.renderOrder = 998;

  object.add(faceHelper);

  updateFaceColors();
  updateDebugPanel("面を表示しました");
}

// -------------------------
// 編集表示更新
// -------------------------

function updateEditDisplay() {
  const mode = getEditMode();
  const selected = getSelectedObject();

  clearVertexHelper();
  clearEdgeHelper();
  clearFaceHelper();

  selectedVertexIndices.clear();
  selectedEdgeIndices.clear();
  selectedFaceIndices.clear();

  if (mode === "object") {
    if (selected) attachObject(selected);
  } else {
    detachObject();

    if (mode === "vertex" && selected) {
      showVertices(selected);
    }

    if (mode === "edge" && selected) {
      showEdges(selected);
    }

    if (mode === "face" && selected) {
      showFaces(selected);
    }
  }

  updateDebugPanel("編集モード切り替え済み");
}

window.addEventListener("edit-mode-changed", updateEditDisplay);

// -------------------------
// オブジェクト選択
// -------------------------

function selectMesh(mesh) {
  if (!mesh) return;

  selectObject(mesh);

  selectedVertexIndices.clear();
  selectedEdgeIndices.clear();
  selectedFaceIndices.clear();

  if (getEditMode() === "object") {
    attachObject(mesh);
  } else {
    detachObject();
  }

  updateEditDisplay();
  refreshObjectList();
  refreshProperties();
}

// -------------------------
// 選択切り替え
// -------------------------

function toggleVertexSelection(index) {
  if (selectedVertexIndices.has(index)) {
    selectedVertexIndices.delete(index);
  } else {
    selectedVertexIndices.add(index);
  }

  updateVertexColors();
}

function toggleEdgeSelection(index) {
  if (selectedEdgeIndices.has(index)) {
    selectedEdgeIndices.delete(index);
  } else {
    selectedEdgeIndices.add(index);
  }

  updateEdgeColors();
}

function toggleFaceSelection(index) {
  if (selectedFaceIndices.has(index)) {
    selectedFaceIndices.delete(index);
  } else {
    selectedFaceIndices.add(index);
  }

  updateFaceColors();
}

// -------------------------
// ヒット判定
// -------------------------

function getVertexHit(event) {
  if (!vertexHelper) return null;

  updatePointer(event);

  const hits = raycaster.intersectObject(vertexHelper, false);

  return hits.length ? hits[0].index : null;
}

function getEdgeHit(event) {
  if (!edgeHelper) return null;

  updatePointer(event);

  const hits = raycaster.intersectObject(edgeHelper, false);

  if (!hits.length || hits[0].index == null) return null;

  return Math.floor(hits[0].index / 2);
}

function getFaceHit(event) {
  if (!faceHelper) return null;

  updatePointer(event);

  const hits = raycaster.intersectObject(faceHelper, false);

  if (!hits.length || hits[0].faceIndex == null) {
    return null;
  }

  return faceTriangleToRecord[hits[0].faceIndex] ?? null;
}

// -------------------------
// ドラッグ共通
// -------------------------

function createDragPlane(event, localPosition, object) {
  object.updateMatrixWorld(true);

  const worldPosition = object.localToWorld(localPosition.clone());
  const normal = new THREE.Vector3();

  camera.getWorldDirection(normal);

  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
    normal,
    worldPosition
  );

  updatePointer(event);

  const startPoint = new THREE.Vector3();

  if (!raycaster.ray.intersectPlane(plane, startPoint)) {
    return null;
  }

  return {
    plane,
    startLocal: object.worldToLocal(startPoint.clone())
  };
}

// -------------------------
// 頂点ドラッグ開始
// -------------------------

function beginVertexDrag(event) {
  if (!pendingVertex) return;

  const object = getSelectedObject();
  if (!object) return;

  const positions = object.geometry.attributes.position;
  const index = pendingVertex.index;

  const local = new THREE.Vector3(
    positions.getX(index),
    positions.getY(index),
    positions.getZ(index)
  );

  const drag = createDragPlane(event, local, object);
  if (!drag) return;

  const originalPositions = new Map();

  selectedVertexIndices.forEach((i) => {
    originalPositions.set(
      i,
      new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      )
    );
  });

  vertexDrag = {
    object,
    plane: drag.plane,
    startLocal: drag.startLocal,
    originalPositions
  };

  isDragging = true;
  controls.enabled = false;
}

// -------------------------
// 頂点移動
// -------------------------

function moveVertices(event) {
  if (!vertexDrag) return;

  updatePointer(event);

  const point = new THREE.Vector3();

  if (!raycaster.ray.intersectPlane(vertexDrag.plane, point)) {
    return;
  }

  const object = vertexDrag.object;
  object.updateMatrixWorld(true);

  const current = object.worldToLocal(point.clone());
  const delta = current.sub(vertexDrag.startLocal);

  const positions = object.geometry.attributes.position;

  vertexDrag.originalPositions.forEach((original, index) => {
    positions.setXYZ(
      index,
      original.x + delta.x,
      original.y + delta.y,
      original.z + delta.z
    );
  });

  positions.needsUpdate = true;
  object.geometry.computeVertexNormals();
  object.geometry.computeBoundingBox();
  object.geometry.computeBoundingSphere();

  if (vertexHelper) {
    const helperPositions = vertexHelper.geometry.attributes.position;

    vertexDrag.originalPositions.forEach((original, index) => {
      helperPositions.setXYZ(
        index,
        original.x + delta.x,
        original.y + delta.y,
        original.z + delta.z
      );
    });

    helperPositions.needsUpdate = true;
  }
}

// -------------------------
// 辺ドラッグ開始
// -------------------------

function beginEdgeDrag(event) {
  if (!pendingEdge) return;

  const object = getSelectedObject();
  if (!object) return;

  const record = edgeRecords[pendingEdge.index];
  if (!record) return;

  const midpoint = record.a.clone().add(record.b).multiplyScalar(0.5);
  const drag = createDragPlane(event, midpoint, object);

  if (!drag) return;

  const positions = object.geometry.attributes.position;
  const originalPositions = new Map();

  selectedEdgeIndices.forEach((edgeIndex) => {
    const edge = edgeRecords[edgeIndex];
    if (!edge) return;

    [...edge.verticesA, ...edge.verticesB].forEach((index) => {
      if (originalPositions.has(index)) return;

      originalPositions.set(
        index,
        new THREE.Vector3(
          positions.getX(index),
          positions.getY(index),
          positions.getZ(index)
        )
      );
    });
  });

  if (!originalPositions.size) return;

  edgeDrag = {
    object,
    plane: drag.plane,
    startLocal: drag.startLocal,
    originalPositions
  };

  isDragging = true;
  controls.enabled = false;
}

// -------------------------
// 辺移動
// -------------------------

function averageVertexPosition(positions, indices) {
  const result = new THREE.Vector3();

  for (const index of indices) {
    result.x += positions.getX(index);
    result.y += positions.getY(index);
    result.z += positions.getZ(index);
  }

  return indices.length
    ? result.multiplyScalar(1 / indices.length)
    : result;
}

function moveEdges(event) {
  if (!edgeDrag || !edgeHelper) return;

  updatePointer(event);

  const point = new THREE.Vector3();

  if (!raycaster.ray.intersectPlane(edgeDrag.plane, point)) {
    return;
  }

  const object = edgeDrag.object;
  object.updateMatrixWorld(true);

  const current = object.worldToLocal(point.clone());
  const delta = current.sub(edgeDrag.startLocal);

  const positions = object.geometry.attributes.position;

  edgeDrag.originalPositions.forEach((original, index) => {
    positions.setXYZ(
      index,
      original.x + delta.x,
      original.y + delta.y,
      original.z + delta.z
    );
  });

  positions.needsUpdate = true;
  object.geometry.computeVertexNormals();
  object.geometry.computeBoundingBox();
  object.geometry.computeBoundingSphere();

  const helperPositions = edgeHelper.geometry.attributes.position;

  edgeRecords.forEach((edge, index) => {
    const a = averageVertexPosition(positions, edge.verticesA);
    const b = averageVertexPosition(positions, edge.verticesB);

    edge.a.copy(a);
    edge.b.copy(b);

    helperPositions.setXYZ(index * 2, a.x, a.y, a.z);
    helperPositions.setXYZ(index * 2 + 1, b.x, b.y, b.z);
  });

  helperPositions.needsUpdate = true;
  edgeHelper.geometry.computeBoundingSphere();
}

// -------------------------
// 面ドラッグ開始
// -------------------------

function beginFaceDrag(event) {
  if (!pendingFace) return;

  const object = getSelectedObject();
  if (!object) return;

  const record = faceRecords[pendingFace.index];
  if (!record) return;

  const positions = object.geometry.attributes.position;
  const center = new THREE.Vector3();

  record.vertices.forEach((index) => {
    center.x += positions.getX(index);
    center.y += positions.getY(index);
    center.z += positions.getZ(index);
  });

  center.multiplyScalar(1 / record.vertices.length);

  const drag = createDragPlane(event, center, object);
  if (!drag) return;

  const originalPositions = new Map();

  selectedFaceIndices.forEach((faceIndex) => {
    const face = faceRecords[faceIndex];
    if (!face) return;

    face.vertices.forEach((index) => {
      if (originalPositions.has(index)) return;

      originalPositions.set(
        index,
        new THREE.Vector3(
          positions.getX(index),
          positions.getY(index),
          positions.getZ(index)
        )
      );
    });
  });

  if (!originalPositions.size) return;

  faceDrag = {
    object,
    plane: drag.plane,
    startLocal: drag.startLocal,
    originalPositions
  };

  isDragging = true;
  controls.enabled = false;
}

// -------------------------
// 面移動
// -------------------------

function moveFaces(event) {
  if (!faceDrag || !faceHelper) return;

  updatePointer(event);

  const point = new THREE.Vector3();

  if (!raycaster.ray.intersectPlane(faceDrag.plane, point)) {
    return;
  }

  const object = faceDrag.object;
  object.updateMatrixWorld(true);

  const current = object.worldToLocal(point.clone());
  const delta = current.sub(faceDrag.startLocal);

  const positions = object.geometry.attributes.position;

  faceDrag.originalPositions.forEach((original, index) => {
    positions.setXYZ(
      index,
      original.x + delta.x,
      original.y + delta.y,
      original.z + delta.z
    );
  });

  positions.needsUpdate = true;

  object.geometry.computeVertexNormals();
  object.geometry.computeBoundingBox();
  object.geometry.computeBoundingSphere();

  const helperPositions = faceHelper.geometry.attributes.position;
  let offset = 0;

  faceRecords.forEach((face) => {
    face.vertices.forEach((index) => {
      helperPositions.setXYZ(
        offset++,
        positions.getX(index),
        positions.getY(index),
        positions.getZ(index)
      );
    });
  });

  helperPositions.needsUpdate = true;
  faceHelper.geometry.computeBoundingSphere();
}

function mirrorSelectedObject() {
  const original = getSelectedObject();

  if (!original) {
    alert("ミラー複製するオブジェクトを選択してください。");
    return;
  }

  const axisInput = document.getElementById("mirrorAxis");
  const axis = axisInput ? axisInput.value : "x";

  // 元のオブジェクトの位置と大きさを保存
  const originalPosition = original.position.clone();
  const originalScale = original.scale.clone();

  // 複製
  const mirrored = duplicateSelectedObject();

  if (!mirrored) return;

  // 指定軸の反対側へ移動して反転
  mirrored.position[axis] = -originalPosition[axis];
  mirrored.scale.copy(originalScale);
  mirrored.scale[axis] *= -1;

  mirrored.name = original.name + "_mirror";

  refreshObjectList();
  refreshProperties();
  saveHistory();

  updateDebugPanel("ミラー複製しました");
}

function loopCutSelectedObject() {
  const object = getSelectedObject();

  if (!object) {
    alert("ループカットする立方体を選択してください。");
    return;
  }

  if (object.geometry.type !== "BoxGeometry") {
    alert("今のループカットは、追加したばかりの立方体に対応しています。");
    return;
  }

  const axisInput = document.getElementById("loopCutAxis");
  const axis = axisInput ? axisInput.value : "x";

  const geometry = object.geometry;
  geometry.computeBoundingBox();

  const size = new THREE.Vector3();
  geometry.boundingBox.getSize(size);

  let segmentsX = 1;
  let segmentsY = 1;
  let segmentsZ = 1;

  if (axis === "x") segmentsX = 2;
  if (axis === "y") segmentsY = 2;
  if (axis === "z") segmentsZ = 2;

  const newGeometry = new THREE.BoxGeometry(
    size.x,
    size.y,
    size.z,
    segmentsX,
    segmentsY,
    segmentsZ
  );

  geometry.dispose();
  object.geometry = newGeometry;

  updateEditDisplay();
  refreshObjectList();
  refreshProperties();
  saveHistory();

  updateDebugPanel("ループカットを追加しました");
}

function bevelSelectedObject() {
  const object = getSelectedObject();

  if (!object) {
    alert("角を丸めるオブジェクトを選択してください。");
    return;
  }

  if (object.geometry.type !== "BoxGeometry") {
    alert("今のベベル機能は、追加したばかりの立方体に対応しています。");
    return;
  }

  const amountInput = document.getElementById("bevelAmount");
  const segmentsInput = document.getElementById("bevelSegments");

  const amount = amountInput ? Number(amountInput.value) : 0.1;
  const segments = segmentsInput
    ? Math.max(1, Math.min(8, Math.floor(Number(segmentsInput.value))))
    : 3;

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("丸める幅を正しく入力してください。");
    return;
  }

  const geometry = object.geometry;
  geometry.computeBoundingBox();

  const size = new THREE.Vector3();
  geometry.boundingBox.getSize(size);

  const radius = Math.min(
    amount,
    size.x * 0.49,
    size.y * 0.49,
    size.z * 0.49
  );

  const roundedGeometry = new RoundedBoxGeometry(
    size.x,
    size.y,
    size.z,
    segments,
    radius
  );

  roundedGeometry.computeVertexNormals();
  roundedGeometry.computeBoundingBox();
  roundedGeometry.computeBoundingSphere();

  // 履歴・保存機能で扱える形式にする
  roundedGeometry.type = "BufferGeometry";

  geometry.dispose();
  object.geometry = roundedGeometry;

  updateEditDisplay();
  refreshObjectList();
  refreshProperties();
  saveHistory();

  updateDebugPanel("角を丸めました");
}

function insetSelectedFaces() {
  const object = getSelectedObject();

  if (!object || getEditMode() !== "face") {
    alert("面モードで面を選択してください。");
    return;
  }

  if (selectedFaceIndices.size === 0) {
    alert("差し込む面を選択してください。");
    return;
  }

  const input = document.getElementById("insetAmount");
  const amount = input ? Number(input.value) : 0.1;

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("差し込み幅を入力してください。");
    return;
  }

  const geometry = object.geometry;
  const positions = geometry.attributes.position;
  const indexAttribute = geometry.index;
  const output = [];
  const innerTriangleIndices = [];

  function getPoint(index) {
    return new THREE.Vector3(
      positions.getX(index),
      positions.getY(index),
      positions.getZ(index)
    );
  }

  function addTriangle(a, b, c, isInner = false) {
    const triangleIndex = output.length / 9;

    output.push(
      a.x, a.y, a.z,
      b.x, b.y, b.z,
      c.x, c.y, c.z
    );

    if (isInner) innerTriangleIndices.push(triangleIndex);
  }

  for (let faceIndex = 0; faceIndex < faceRecords.length; faceIndex++) {
    const face = faceRecords[faceIndex];
    const vertices = face.vertices;

    if (!selectedFaceIndices.has(faceIndex)) {
      for (let i = 0; i + 2 < vertices.length; i += 3) {
        addTriangle(
          getPoint(vertices[i]),
          getPoint(vertices[i + 1]),
          getPoint(vertices[i + 2])
        );
      }
      continue;
    }

    const edgeMap = new Map();

    for (let i = 0; i + 2 < vertices.length; i += 3) {
      const triangle = vertices.slice(i, i + 3);

      for (let j = 0; j < 3; j++) {
        const a = triangle[j];
        const b = triangle[(j + 1) % 3];
        const key = Math.min(a, b) + "_" + Math.max(a, b);

        if (edgeMap.has(key)) {
          edgeMap.delete(key);
        } else {
          edgeMap.set(key, [a, b]);
        }
      }
    }

    const edges = [...edgeMap.values()];

    if (edges.length < 3) continue;

    const loop = [edges[0][0], edges[0][1]];
    const used = new Set([0]);

    while (loop.length <= edges.length) {
      const last = loop[loop.length - 1];
      if (last === loop[0]) break;

      let found = false;

      for (let i = 0; i < edges.length; i++) {
        if (used.has(i)) continue;

        const [a, b] = edges[i];

        if (a === last || b === last) {
          loop.push(a === last ? b : a);
          used.add(i);
          found = true;
          break;
        }
      }

      if (!found) break;
    }

    if (loop.length < 4 || loop[loop.length - 1] !== loop[0]) {
      for (let i = 0; i + 2 < vertices.length; i += 3) {
        addTriangle(
          getPoint(vertices[i]),
          getPoint(vertices[i + 1]),
          getPoint(vertices[i + 2])
        );
      }
      continue;
    }

    loop.pop();

    const outer = loop.map(getPoint);
    const center = new THREE.Vector3();

    outer.forEach(point => center.add(point));
    center.divideScalar(outer.length);

    const inset = THREE.MathUtils.clamp(amount, 0.01, 0.95);

    const inner = outer.map(point =>
      center.clone().add(
        point.clone().sub(center).multiplyScalar(1 - inset)
      )
    );

    for (let i = 0; i < outer.length; i++) {
      const next = (i + 1) % outer.length;

      addTriangle(outer[i], outer[next], inner[next]);
      addTriangle(outer[i], inner[next], inner[i]);
    }

    for (let i = 1; i < inner.length - 1; i++) {
      addTriangle(inner[0], inner[i], inner[i + 1], true);
    }
  }

  const newGeometry = new THREE.BufferGeometry();

  newGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(output, 3)
  );

  newGeometry.computeVertexNormals();
  newGeometry.computeBoundingBox();
  newGeometry.computeBoundingSphere();

  geometry.dispose();
  object.geometry = newGeometry;

  object.material.side = THREE.DoubleSide;

  updateEditDisplay();

  innerTriangleIndices.forEach(triangleIndex => {
    const faceIndex = faceTriangleToRecord[triangleIndex];

    if (faceIndex !== undefined) {
      selectedFaceIndices.add(faceIndex);
    }
  });

  updateFaceColors();
  refreshObjectList();
  refreshProperties();
  saveHistory();

  updateDebugPanel("面を差し込みました");
}

// -------------------------
// 面の押し出し
// -------------------------

function extrudeSelectedFaces() {
  const object = getSelectedObject();

  if (!object || getEditMode() !== "face") {
    alert("面モードで面を選択してください。");
    return;
  }

  if (selectedFaceIndices.size === 0) {
    alert("押し出す面を選択してください。");
    return;
  }

  const distanceInput = document.getElementById("extrudeDistance");
  const distance = distanceInput ? Number(distanceInput.value) : 0.5;

  if (!Number.isFinite(distance) || distance === 0) {
    alert("押し出す距離に0以外の数値を入力してください。");
    return;
  }

  const geometry = object.geometry;
  const positions = geometry.attributes.position;
  const indexAttribute = geometry.index;

  const count = indexAttribute ? indexAttribute.count : positions.count;
  const newPositions = [];
  const topTriangleIndices = [];

  function getPoint(index) {
    return new THREE.Vector3(
      positions.getX(index),
      positions.getY(index),
      positions.getZ(index)
    );
  }

  function addTriangle(a, b, c, isTop = false) {
    const triangleIndex = newPositions.length / 9;

    newPositions.push(
      a.x, a.y, a.z,
      b.x, b.y, b.z,
      c.x, c.y, c.z
    );

    if (isTop) {
      topTriangleIndices.push(triangleIndex);
    }
  }

  function addSide(a, b, normal) {
    const a2 = a.clone().add(normal);
    const b2 = b.clone().add(normal);

    addTriangle(a, b, b2);
    addTriangle(a, b2, a2);
  }

  const offsets = new Map();

  selectedFaceIndices.forEach((faceIndex) => {
    const face = faceRecords[faceIndex];
    if (!face || face.vertices.length < 3) return;

    const a = getPoint(face.vertices[0]);
    const b = getPoint(face.vertices[1]);
    const c = getPoint(face.vertices[2]);

    const normal = new THREE.Vector3()
      .subVectors(b, a)
      .cross(new THREE.Vector3().subVectors(c, a))
      .normalize();

    offsets.set(faceIndex, normal.multiplyScalar(distance));
  });

  if (!offsets.size) {
    alert("押し出せる面がありません。");
    return;
  }

  // 元の面と押し出した先端を作成
  for (let i = 0; i + 2 < count; i += 3) {
    const triangleIndex = i / 3;
    const recordIndex = faceTriangleToRecord[triangleIndex];

    const aIndex = indexAttribute ? indexAttribute.getX(i) : i;
    const bIndex = indexAttribute ? indexAttribute.getX(i + 1) : i + 1;
    const cIndex = indexAttribute ? indexAttribute.getX(i + 2) : i + 2;

    const a = getPoint(aIndex);
    const b = getPoint(bIndex);
    const c = getPoint(cIndex);

    const offset = offsets.get(recordIndex);

    if (offset) {
      addTriangle(
        a.clone().add(offset),
        b.clone().add(offset),
        c.clone().add(offset),
        true
      );
    } else {
      addTriangle(a, b, c);
    }
  }

  // 側面を作成
  offsets.forEach((normal, faceIndex) => {
    const face = faceRecords[faceIndex];
    const edgeCounts = new Map();
    const edgePoints = new Map();

    for (let i = 0; i + 2 < face.vertices.length; i += 3) {
      const triangle = [
        face.vertices[i],
        face.vertices[i + 1],
        face.vertices[i + 2]
      ];

      for (let j = 0; j < 3; j++) {
        const aIndex = triangle[j];
        const bIndex = triangle[(j + 1) % 3];

        const key = [aIndex, bIndex]
          .sort((a, b) => a - b)
          .join("_");

        edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
        edgePoints.set(key, [aIndex, bIndex]);
      }
    }

    edgeCounts.forEach((edgeCount, key) => {
      if (edgeCount !== 1) return;

      const [aIndex, bIndex] = edgePoints.get(key);

      addSide(
        getPoint(aIndex),
        getPoint(bIndex),
        normal
      );
    });
  });

  // 新しいジオメトリ
  const newGeometry = new THREE.BufferGeometry();

  newGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(newPositions, 3)
  );

  newGeometry.computeVertexNormals();
  newGeometry.computeBoundingBox();
  newGeometry.computeBoundingSphere();

  geometry.dispose();
  object.geometry = newGeometry;

  if (Array.isArray(object.material)) {
    object.material.forEach(material => {
      material.side = THREE.DoubleSide;
    });
  } else {
    object.material.side = THREE.DoubleSide;
  }

  // 面表示を作り直す
  updateEditDisplay();

  // 新しい面番号を直接選択
  selectedFaceIndices.clear();

  topTriangleIndices.forEach((triangleIndex) => {
    const faceIndex = faceTriangleToRecord[triangleIndex];

    if (faceIndex !== undefined) {
      selectedFaceIndices.add(faceIndex);
    }
  });

  updateFaceColors();

  refreshObjectList();
  refreshProperties();

  saveHistory();

  updateDebugPanel(
    "先端面：" + selectedFaceIndices.size + "個を選択"
  );
}

// -------------------------
// ポインター操作
// -------------------------

canvas.addEventListener("pointerdown", (event) => {
  pointerDownPosition = {
    x: event.clientX,
    y: event.clientY
  };

  const mode = getEditMode();

  if (mode === "vertex") {
    const index = getVertexHit(event);

    pendingVertex = index === null
      ? null
      : { index, x: event.clientX, y: event.clientY };
  }

  if (mode === "edge") {
    const index = getEdgeHit(event);

    pendingEdge = index === null
      ? null
      : { index, x: event.clientX, y: event.clientY };
  }

  if (mode === "face") {
    const index = getFaceHit(event);

    pendingFace = index === null
      ? null
      : { index, x: event.clientX, y: event.clientY };
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (vertexDrag) {
    moveVertices(event);
    return;
  }

  if (edgeDrag) {
    moveEdges(event);
    return;
  }

  if (faceDrag) {
    moveFaces(event);
    return;
  }

  if (pendingVertex) {
    const dx = event.clientX - pendingVertex.x;
    const dy = event.clientY - pendingVertex.y;

    if (
      Math.hypot(dx, dy) >= 6 &&
      selectedVertexIndices.has(pendingVertex.index)
    ) {
      beginVertexDrag(event);
      if (vertexDrag) moveVertices(event);
    }
  }

  if (pendingEdge) {
    const dx = event.clientX - pendingEdge.x;
    const dy = event.clientY - pendingEdge.y;

    if (
      Math.hypot(dx, dy) >= 6 &&
      selectedEdgeIndices.has(pendingEdge.index)
    ) {
      beginEdgeDrag(event);
      if (edgeDrag) moveEdges(event);
    }
  }

  if (pendingFace) {
    const dx = event.clientX - pendingFace.x;
    const dy = event.clientY - pendingFace.y;

    if (
      Math.hypot(dx, dy) >= 6 &&
      selectedFaceIndices.has(pendingFace.index)
    ) {
      beginFaceDrag(event);
      if (faceDrag) moveFaces(event);
    }
  }
});

canvas.addEventListener("pointerup", (event) => {
  if (vertexDrag) {
    finishVertexDrag();
    pendingVertex = null;
    pendingEdge = null;
    pendingFace = null;
    pointerDownPosition = null;
    return;
  }

  if (edgeDrag) {
    finishEdgeDrag();
    pendingVertex = null;
    pendingEdge = null;
    pendingFace = null;
    pointerDownPosition = null;
    return;
  }

  if (faceDrag) {
    finishFaceDrag();
    pendingVertex = null;
    pendingEdge = null;
    pendingFace = null;
    pointerDownPosition = null;
    return;
  }

  if (pendingVertex) {
    const dx = event.clientX - pendingVertex.x;
    const dy = event.clientY - pendingVertex.y;

    if (Math.hypot(dx, dy) < 6) {
      toggleVertexSelection(pendingVertex.index);
    }

    pendingVertex = null;
    pointerDownPosition = null;
    return;
  }

  if (pendingEdge) {
    const dx = event.clientX - pendingEdge.x;
    const dy = event.clientY - pendingEdge.y;

    if (Math.hypot(dx, dy) < 6) {
      toggleEdgeSelection(pendingEdge.index);
    }

    pendingEdge = null;
    pointerDownPosition = null;
    return;
  }

  if (pendingFace) {
    const dx = event.clientX - pendingFace.x;
    const dy = event.clientY - pendingFace.y;

    if (Math.hypot(dx, dy) < 6) {
      toggleFaceSelection(pendingFace.index);
    }

    pendingFace = null;
    pointerDownPosition = null;
    return;
  }

  if (isDragging || !pointerDownPosition) {
    pointerDownPosition = null;
    return;
  }

  const dx = event.clientX - pointerDownPosition.x;
  const dy = event.clientY - pointerDownPosition.y;

  pointerDownPosition = null;

  if (Math.hypot(dx, dy) > 5) return;

  updatePointer(event);

  const hits = raycaster.intersectObjects(getObjects(), false);

  if (hits.length > 0) {
    selectMesh(hits[0].object);
  }
});

canvas.addEventListener("pointercancel", () => {
  if (vertexDrag) finishVertexDrag();
  if (edgeDrag) finishEdgeDrag();
  if (faceDrag) finishFaceDrag();

  pendingVertex = null;
  pendingEdge = null;
  pendingFace = null;
  pointerDownPosition = null;
});

// -------------------------
// 履歴
// -------------------------

function createSnapshot() {
  return getObjects().map((object) => ({
    name: object.name,
    type: object.geometry.type,
    position: object.position.toArray(),
    rotation: object.rotation.toArray(),
    scale: object.scale.toArray(),
    color: object.material.color.getHex(),
    vertices: Array.from(object.geometry.attributes.position.array)
  }));
}

function saveHistory() {
  const snapshot = createSnapshot();

  history = history.slice(0, historyIndex + 1);
  history.push(JSON.stringify(snapshot));

  if (history.length > 50) history.shift();

  historyIndex = history.length - 1;
}

// -------------------------
// カスタム形状の復元
// -------------------------

function restoreCustomGeometry(object, data) {
  if (data.type !== "BufferGeometry") return;

  object.geometry.dispose();

  const geometry = new THREE.BufferGeometry();

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(data.vertices, 3)
  );

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  object.geometry = geometry;
  object.material.side = THREE.DoubleSide;
}

function applyVertexData(object, vertices) {
  if (!vertices) return;

  const positions = object.geometry.attributes.position;

  if (positions.array.length !== vertices.length) return;

  positions.array.set(vertices);
  positions.needsUpdate = true;

  object.geometry.computeVertexNormals();
  object.geometry.computeBoundingBox();
  object.geometry.computeBoundingSphere();
}

// -------------------------
// 全オブジェクト削除
// -------------------------

function clearAllObjects() {
  detachObject();

  clearVertexHelper();
  clearEdgeHelper();
  clearFaceHelper();

  selectedVertexIndices.clear();
  selectedEdgeIndices.clear();
  selectedFaceIndices.clear();

  getObjects().forEach((object) => {
    selectObject(object);
    deleteSelectedObject();
  });
}

// -------------------------
// 履歴復元
// -------------------------

function restoreHistory(snapshotText) {
  const snapshot = JSON.parse(snapshotText);

  clearAllObjects();

  snapshot.forEach((data) => {
    let type = "cube";

    if (data.type === "SphereGeometry") type = "sphere";
    if (data.type === "CylinderGeometry") type = "cylinder";

    const object = addObject(type);
    if (!object) return;

    restoreCustomGeometry(object, data);

    object.name = data.name;
    object.position.fromArray(data.position);
    object.rotation.fromArray(data.rotation);
    object.scale.fromArray(data.scale);
    object.material.color.setHex(data.color);

    applyVertexData(object, data.vertices);
  });

  const objects = getObjects();

  if (objects.length > 0) {
    selectMesh(objects[objects.length - 1]);
  } else {
    refreshObjectList();
    refreshProperties();
  }

  updateEditDisplay();
}

function undoHistory() {
  if (historyIndex <= 0) return;

  historyIndex--;
  restoreHistory(history[historyIndex]);
}

function redoHistory() {
  if (historyIndex >= history.length - 1) return;

  historyIndex++;
  restoreHistory(history[historyIndex]);
}

// -------------------------
// 保存・読み込み
// -------------------------

function saveProject() {
  const data = {
    objects: createSnapshot()
  };

  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "inochi-3d-project.json";
  link.click();

  URL.revokeObjectURL(url);
}

function loadProject(data) {
  if (!data || !Array.isArray(data.objects)) return;

  clearAllObjects();

  data.objects.forEach((item) => {
    let type = "cube";

    if (item.type === "SphereGeometry") type = "sphere";
    if (item.type === "CylinderGeometry") type = "cylinder";

    const object = addObject(type);
    if (!object) return;

    restoreCustomGeometry(object, item);

    object.name = item.name;
    object.position.fromArray(item.position);
    object.rotation.fromArray(item.rotation);
    object.scale.fromArray(item.scale);

    if (item.color !== undefined) {
      object.material.color.setHex(item.color);
    }

    applyVertexData(object, item.vertices);
  });

  const objects = getObjects();

  if (objects.length > 0) {
    selectMesh(objects[objects.length - 1]);
  }

  refreshObjectList();
  refreshProperties();

  history = [];
  historyIndex = -1;
  saveHistory();
}

const loadFileInput = document.getElementById("loadFileInput");

if (loadFileInput) {
  loadFileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      try {
        loadProject(JSON.parse(reader.result));
      } catch (error) {
        alert("ファイルを読み込めませんでした。");
        console.error(error);
      }
    };

    reader.readAsText(file);
    event.target.value = "";
  });
}

// -------------------------
// UI接続
// -------------------------

initUI({
  onAdd(type) {
    const object = addObject(type);

    if (object) {
      selectMesh(object);
      saveHistory();
    }
  },

  onMode(mode) {
    setToolMode(mode);
  },

  onSelect(object) {
    selectMesh(object);
  },

  onDelete() {
    clearVertexHelper();
    clearEdgeHelper();
    clearFaceHelper();

    selectedVertexIndices.clear();
    selectedEdgeIndices.clear();
    selectedFaceIndices.clear();

    detachObject();
    deleteSelectedObject();

    refreshObjectList();
    refreshProperties();
    updateDebugPanel("オブジェクトを削除しました");

    saveHistory();
  },

  onDuplicate() {
    const object = duplicateSelectedObject();

    if (object) {
      selectMesh(object);
      saveHistory();
    }
  },

  onPropertyChange() {
    saveHistory();
  },

  onEditMode() {
    updateEditDisplay();
  },

  getObjects() {
    return getObjects();
  },

  getSelected() {
    return getSelectedObject();
  },

  onSave() {
    saveProject();
  },

  onUndo() {
    undoHistory();
  },

  onRedo() {
    redoHistory();
  }
});

// -------------------------
// Inset・押し出しボタン
// -------------------------

const insetButton = document.getElementById("insetButton");
const bevelButton = document.getElementById("bevelButton");
const loopCutButton = document.getElementById("loopCutButton");
const mirrorButton = document.getElementById("mirrorButton");

if (mirrorButton) {
  mirrorButton.addEventListener("click", mirrorSelectedObject);
}
if (loopCutButton) {
  loopCutButton.addEventListener("click", loopCutSelectedObject);
}

if (bevelButton) {
  bevelButton.addEventListener("click", bevelSelectedObject);
}
if (insetButton) {
  insetButton.addEventListener("click", insetSelectedFaces);
}

const extrudeButton = document.getElementById("extrudeButton");

if (extrudeButton) {
  extrudeButton.addEventListener("click", extrudeSelectedFaces);
}

// -------------------------
// TransformControls
// -------------------------

window.addEventListener("transform-dragging", (event) => {
  isDragging = event.detail;
  controls.enabled = !isDragging;

  if (!isDragging) {
    saveHistory();
    refreshProperties();
  }
});

// -------------------------
// 初期オブジェクト
// -------------------------

const firstObject = addObject("cube");

if (firstObject) {
  selectMesh(firstObject);
}

refreshObjectList();
refreshProperties();
saveHistory();
updateDebugPanel("準備完了");

// -------------------------
// 頂点結合
// -------------------------

function mergeSelectedVertices() {
  const object = getSelectedObject();

  if (!object) {
    alert("頂点を結合するオブジェクトを選択してください。");
    return;
  }

  const input = document.getElementById("mergeTolerance");
  const tolerance = input ? Number(input.value) : 0.001;

  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    alert("結合距離を正しく入力してください。");
    return;
  }

  const oldGeometry = object.geometry;
  const positions = oldGeometry.attributes.position;
  const oldIndex = oldGeometry.index;

  const sourceIndices = oldIndex
    ? Array.from(oldIndex.array)
    : Array.from({ length: positions.count }, (_, i) => i);

  const uniquePositions = [];
  const newIndices = [];
  const cells = new Map();

  function cellKey(x, y, z) {
    return `${x},${y},${z}`;
  }

  function findVertex(x, y, z) {
    const cx = Math.floor(x / tolerance);
    const cy = Math.floor(y / tolerance);
    const cz = Math.floor(z / tolerance);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const key = cellKey(cx + dx, cy + dy, cz + dz);
          const candidates = cells.get(key) || [];

          for (const index of candidates) {
            const p = uniquePositions[index];

            const distance = Math.hypot(
              p[0] - x,
              p[1] - y,
              p[2] - z
            );

            if (distance <= tolerance) return index;
          }
        }
      }
    }

    const index = uniquePositions.length;

    uniquePositions.push([x, y, z]);

    const key = cellKey(cx, cy, cz);

    if (!cells.has(key)) {
      cells.set(key, []);
    }

    cells.get(key).push(index);

    return index;
  }

  for (const oldIndexValue of sourceIndices) {
    const index = findVertex(
      positions.getX(oldIndexValue),
      positions.getY(oldIndexValue),
      positions.getZ(oldIndexValue)
    );

    newIndices.push(index);
  }

  const newGeometry = new THREE.BufferGeometry();

  const flatPositions = uniquePositions.flat();

  newGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(flatPositions, 3)
  );

  newGeometry.setIndex(newIndices);

  newGeometry.computeVertexNormals();
  newGeometry.computeBoundingBox();
  newGeometry.computeBoundingSphere();

  oldGeometry.dispose();
  object.geometry = newGeometry;

  updateEditDisplay();
  refreshObjectList();
  refreshProperties();
  saveHistory();

  updateDebugPanel(
    "頂点を結合しました：" +
    positions.count + " → " +
    uniquePositions.length
  );

  alert(
    "頂点を結合しました！\n" +
    "結合前：" + positions.count + "\n" +
    "結合後：" + uniquePositions.length
  );
}

// -------------------------
// 頂点結合ボタン
// -------------------------

const mergeVerticesButton =
  document.getElementById("mergeVerticesButton");

if (mergeVerticesButton) {
  mergeVerticesButton.addEventListener(
    "click",
    mergeSelectedVertices
  );
}
