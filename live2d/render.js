
import { getWorldTransform } from './hierarchy.js';
import { selectionHandles } from './selection.js';
import {
  drawDeformedImage,
  drawMeshGrid
} from './mesh-renderer.js';

// パーツの画面上の位置・大きさ・角度を計算
export function partScreenInfo(part, options) {
  const {
    parts,
    fit,
    getWorldTransform: getWorldTransformFn
  } = options;

  const wt = getWorldTransformFn
    ? getWorldTransformFn(part)
    : getWorldTransform(part, parts);

  return {
    cx: fit.ox + wt.x * fit.scale,
    cy: fit.oy + wt.y * fit.scale,
    w: part.w * fit.scale * wt.scale / 100,
    h: part.h * fit.scale * wt.scale / 100,
    angle: wt.rotation * Math.PI / 180,
    wt
  };
}

// パーツ1個を通常描画
export function drawPart(ctx, part, image, options) {
  if (!part.visible || !image) return;

  const {
    x,
    y,
    width,
    height,
    rotation = 0
  } = options;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  ctx.drawImage(
    image,
    -width / 2,
    -height / 2,
    width,
    height
  );

  ctx.restore();
}

// ステージ全体を描画
export function renderStage(ctx, options) {
  const {
    W,
    H,
    sourceCanvas,
    hideBase,
    parts,
    selectedId,
    fit,
    getWorldTransform: getWorldTransformFn,
    images,
    motionTime = 0,
    animation = false,
    startPoint = null,
    currentPoint = null,
    freePoints = [],
    mode = 'normal',
    meshEditor = null
  } = options;

  ctx.clearRect(0, 0, W, H);

  // 元画像
  if (
    sourceCanvas &&
    sourceCanvas.width &&
    sourceCanvas.height &&
    !hideBase
  ) {
    ctx.drawImage(
      sourceCanvas,
      fit.ox,
      fit.oy,
      sourceCanvas.width * fit.scale,
      sourceCanvas.height * fit.scale
    );
  }

  // パーツ描画
  parts.forEach(part => {
    if (!part.visible) return;

    const image = images.get(part.id);
    if (!image) return;

    const info = partScreenInfo(part, {
      parts,
      fit,
      getWorldTransform: getWorldTransformFn
    });

    let x = info.cx;
    let y = info.cy;
    let width = info.w;
    let height = info.h;
    const rotation = info.angle;

    // 簡易アニメーション
    if (animation && part.motion !== 'none') {
      const wave = Math.sin(
        motionTime * Math.max(1, Number(part.speed) || 10) * 0.5 +
        (part.phase || 0)
      );

      const amount = Number(part.sway) || 0;

      if (part.motion === 'faceX' || part.motion === 'eyeX') {
        x += wave * amount * fit.scale;
      }

      if (part.motion === 'faceY' || part.motion === 'eyeY') {
        y += wave * amount * fit.scale;
      }

      if (part.motion === 'blink') {
        height *= Math.max(0.06, 1 - Math.max(0, wave) * 0.9);
      }

      if (part.motion === 'mouth') {
        height *= 1 + Math.max(0, wave) * 0.25;
      }
    }

    // メッシュがあるパーツは変形描画
    if (
      part.mesh &&
      part.mesh.vertices &&
      part.mesh.triangles
    ) {
      drawDeformedImage(ctx, image, part.mesh, {
        x,
        y,
        scaleX: width / part.w,
        scaleY: height / part.h,
        rotation
      });
    } else {
      drawPart(ctx, part, image, {
        x,
        y,
        width,
        height,
        rotation
      });
    }
  });

  const selected = parts.find(p => p.id === selectedId);

  // メッシュ編集モードのグリッド
  if (
    mode === 'mesh' &&
    selected &&
    selected.visible &&
    selected.mesh
  ) {
    const info = partScreenInfo(selected, {
      parts,
      fit,
      getWorldTransform: getWorldTransformFn
    });

    drawMeshGrid(ctx, selected.mesh, {
      x: info.cx,
      y: info.cy,
      scaleX: info.w / selected.w,
      scaleY: info.h / selected.h,
      rotation: info.angle,
      selectedVertex: meshEditor
        ? meshEditor.getSelectedVertex()
        : -1
    });
  }

  // 通常モードの選択枠と操作ハンドル
  if (
    mode !== 'mesh' &&
    selected &&
    selected.visible
  ) {
    const h = selectionHandles(
      selected,
      part => partScreenInfo(part, {
        parts,
        fit,
        getWorldTransform: getWorldTransformFn
      })
    );

    ctx.save();

    ctx.strokeStyle = '#e6c7ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);

    ctx.beginPath();
    h.corners.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();

    ctx.setLineDash([]);

    const top = h.corners[0];

    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(h.rotate.x, h.rotate.y);
    ctx.stroke();

    h.corners.forEach(p => {
      ctx.beginPath();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#8d65c9';
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    ctx.beginPath();
    ctx.fillStyle = '#ffd36e';
    ctx.strokeStyle = '#8d65c9';
    ctx.arc(h.rotate.x, h.rotate.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  // 四角切り抜きのプレビュー
  if (mode === 'rect' && startPoint && currentPoint) {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);

    ctx.strokeRect(
      startPoint.x,
      startPoint.y,
      currentPoint.x - startPoint.x,
      currentPoint.y - startPoint.y
    );

    ctx.restore();
  }

  // 自由切り抜きのプレビュー
  if (mode === 'free' && freePoints.length) {
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);

    ctx.beginPath();

    freePoints.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });

    ctx.stroke();
    ctx.restore();
  }
}
