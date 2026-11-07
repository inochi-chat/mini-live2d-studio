
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
// 立方体・球体・円柱に対応
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

  // 立方体は6面をそれぞれ1つの面として扱う
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

      // 立方体の1面は三角形2枚
      faceTriangleToRecord.push(faceRecords.length - 1);
      faceTriangleToRecord.push(faceRecords.length - 1);
    });
  } else {
    // 球体・円柱などは三角形ごとに面を作る
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

  // 面ヘルパーも更新
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

// -------------------------
// ドラッグ終了
// -------------------------

function finishDrag(type) {
  if (type === "vertex") vertexDrag = null;
  if (type === "edge") edgeDrag = null;
  if (type === "face") faceDrag = null;

  isDragging = false;
  controls.enabled = true;

  saveHistory();
  refreshProperties();
}

function finishVertexDrag() {
  if (vertexDrag) finishDrag("vertex");
}

function finishEdgeDrag() {
  if (edgeDrag) finishDrag("edge");
}

function finishFaceDrag() {
  if (faceDrag) finishDrag("face");
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

function restoreHistory(snapshotText) {
  const snapshot = JSON.parse(snapshotText);

  clearAllObjects();

  snapshot.forEach((data) => {
    let type = "cube";

    if (data.type === "SphereGeometry") type = "sphere";
    if (data.type === "CylinderGeometry") type = "cylinder";

    const object = addObject(type);
    if (!object) return;

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
