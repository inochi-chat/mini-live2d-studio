
import { getWorldTransform } from './hierarchy.js';

// パーツの画面上の位置・大きさ・角度を計算
export function partScreenInfo(part, options) {
  const {
    parts,
    fit,
    W,
    H,
    viewZoom = 1,
    viewPanX = 0,
    viewPanY = 0,
    getWorldTransform: getWorldTransformFn
  } = options;

  const wt = getWorldTransformFn
    ? getWorldTransformFn(part)
    : getWorldTransform(part, parts);

  const baseX = fit.ox + wt.x * fit.scale;
  const baseY = fit.oy + wt.y * fit.scale;

  const cx = (baseX - W / 2) * viewZoom
    + W / 2 + viewPanX;

  const cy = (baseY - H / 2) * viewZoom
    + H / 2 + viewPanY;

  const scale = fit.scale * viewZoom * wt.scale / 100;

  return {
    cx,
    cy,
    w: part.w * scale,
    h: part.h * scale,
    angle: wt.rotation * Math.PI / 180,
    wt
  };
}

// パーツをキャンバスに描画
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
  ctx.rotate(rotation * Math.PI / 180);

  ctx.drawImage(
    image,
    -width / 2,
    -height / 2,
    width,
    height
  );

  ctx.restore();
}
