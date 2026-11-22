
import { getWorldTransform } from './hierarchy.js';

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
