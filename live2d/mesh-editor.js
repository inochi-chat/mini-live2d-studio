
import {
  createMesh,
  moveMeshVertex,
  resetMesh
} from './mesh-deformer.js';

import {
  drawDeformedImage
} from './mesh-renderer.js';

import {
  createMeshInteraction
} from './mesh-interaction.js';

// メッシュ編集機能全体を管理
export function createMeshEditor(options = {}) {
  const {
    canvas,
    getImage,
    getPart,
    getPointerPosition,
    onChange = () => {}
  } = options;

  let mesh = null;
  let partId = null;
  let enabled = false;

  // 選択パーツのメッシュを生成
  function initialize(columns = 4, rows = 4) {
    const part = getPart?.();
    const image = getImage?.();

    if (!part || !image) return false;

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    if (!width || !height) return false;

    mesh = createMesh(width, height, columns, rows);
    partId = part.id;

    onChange();
    return true;
  }

  // メッシュを取得
  function getMesh() {
    return mesh;
  }

  // メッシュ編集モード
  function setEnabled(value) {
    enabled = Boolean(value);
    onChange();
  }

  function isEnabled() {
    return enabled;
  }

  // 頂点を移動
  function moveVertex(index, x, y) {
    if (!mesh) return;

    moveMeshVertex(mesh, index, x, y);
    onChange();
  }

  // メッシュを初期状態に戻す
  function reset() {
    if (!mesh) return;

    resetMesh(mesh);
    onChange();
  }

  // 変形した画像を描画
  function draw(ctx, image, drawOptions = {}) {
    if (!enabled || !mesh || !image) return;

    drawDeformedImage(ctx, image, mesh, drawOptions);
  }

  // メッシュの格子を描画
  function drawGrid(ctx) {
    if (!enabled || !mesh) return;

    ctx.save();

    ctx.strokeStyle = '#bda0ff';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#ffffff';

    mesh.triangles.forEach(triangle => {
      const [a, b, c] = triangle.map(
        index => mesh.vertices[index]
      );

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
      ctx.stroke();
    });

    mesh.vertices.forEach((vertex, index) => {
      ctx.beginPath();
      ctx.arc(vertex.x, vertex.y, 4, 0, Math.PI * 2);
      ctx.fill();

      if (interaction.getSelectedVertex() === index) {
        ctx.strokeStyle = '#ffb347';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    ctx.restore();
  }

  // 頂点操作
  const interaction = createMeshInteraction({
    getMesh,
    getPointerPosition,
    onChange
  });

  function attach() {
    if (canvas) interaction.attach(canvas);
  }

  function detach() {
    if (canvas) interaction.detach(canvas);
  }

  return {
    initialize,
    getMesh,
    setEnabled,
    isEnabled,
    moveVertex,
    reset,
    draw,
    drawGrid,
    attach,
    detach,
    getSelectedVertex: interaction.getSelectedVertex
  };
}
