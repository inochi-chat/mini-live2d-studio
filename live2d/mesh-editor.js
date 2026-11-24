
// メッシュ編集機能全体を管理

import {
  createMesh,
  moveMeshVertex,
  resetMesh
} from './mesh-deformer.js';

import {
  drawDeformedImage,
  drawMeshGrid
} from './mesh-renderer.js';


export function createMeshEditor(options = {}) {
  const {
    getImage,
    getPart,
    onChange = () => {}
  } = options;

  let partId = null;
  let selectedVertex = -1;


  // 現在選択中のパーツを取得
  function getCurrentPart() {
    const part = getPart?.();

    if (!part || part.id !== partId) {
      return null;
    }

    return part;
  }


  // 現在のパーツのメッシュを取得
  function getMesh() {
    const part = getCurrentPart();

    if (!part || !part.mesh) {
      return null;
    }

    return part.mesh;
  }


  // メッシュを初期化
  function initialize(columns = 4, rows = 4) {
    const part = getPart?.();
    const image = getImage?.();

    if (!part || !image) {
      return false;
    }

    const width = part.w || image.naturalWidth || image.width;
    const height = part.h || image.naturalHeight || image.height;

    if (!width || !height) {
      return false;
    }

    // 既存メッシュがあれば再利用
    if (
      part.mesh &&
      part.mesh.vertices &&
      part.mesh.originalVertices &&
      part.mesh.triangles
    ) {
      partId = part.id;
      selectedVertex = -1;
      onChange();
      return true;
    }

    // 新しいメッシュをパーツに保存
    part.mesh = createMesh(width, height, columns, rows);

    partId = part.id;
    selectedVertex = -1;

    onChange();
    return true;
  }


  // 編集対象を切り替える
  function setPart(part) {
    partId = part?.id ?? null;
    selectedVertex = -1;
  }


  // メッシュがあるか確認
  function hasMesh() {
    return Boolean(getMesh());
  }


  // 頂点を探す
  function findVertex(x, y, radius = 14) {
    const mesh = getMesh();

    if (!mesh) return -1;

    let nearest = -1;
    let nearestDistance = radius * radius;

    mesh.vertices.forEach((vertex, index) => {
      const dx = vertex.x - x;
      const dy = vertex.y - y;
      const distance = dx * dx + dy * dy;

      if (distance <= nearestDistance) {
        nearest = index;
        nearestDistance = distance;
      }
    });

    return nearest;
  }


  // 選択頂点を設定
  function selectVertex(index) {
    const mesh = getMesh();

    if (!mesh || index < 0 || index >= mesh.vertices.length) {
      selectedVertex = -1;
    } else {
      selectedVertex = index;
    }

    onChange();
  }


  // 頂点を移動
  function moveVertex(index, x, y) {
    const mesh = getMesh();

    if (!mesh) return false;

    if (index < 0 || index >= mesh.vertices.length) {
      return false;
    }

    moveMeshVertex(mesh, index, x, y);

    onChange();
    return true;
  }


  // メッシュをリセット
  function reset() {
    const mesh = getMesh();

    if (!mesh) return false;

    resetMesh(mesh);
    selectedVertex = -1;

    onChange();
    return true;
  }


  // 変形した画像を描画
  function draw(ctx, image, drawOptions = {}) {
    const mesh = getMesh();

    if (!mesh || !image) return;

    drawDeformedImage(ctx, image, mesh, drawOptions);
  }


  // メッシュの格子を描画
  function drawGrid(ctx, drawOptions = {}) {
    const mesh = getMesh();

    if (!mesh) return;

    drawMeshGrid(ctx, mesh, {
      ...drawOptions,
      selectedVertex
    });
  }


  return {
    initialize,
    getMesh,
    hasMesh,
    setPart,
    findVertex,
    selectVertex,
    moveVertex,
    reset,
    draw,
    drawGrid,
    getSelectedVertex: () => selectedVertex
  };
}
