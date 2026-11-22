
// パーツの画面上の位置・大きさ・角度を計算
export function partScreenInfo(part, options) {
  const {
    fit,
    viewZoom = 1,
    viewPanX = 0,
    viewPanY = 0,
    artScale = 1,
    getWorldTransform
  } = options;

  const world = getWorldTransform(part);

  const scale = fit.scale * viewZoom * artScale;
  const cx = fit.ox + world.x * fit.scale;
  const cy = fit.oy + world.y * fit.scale;

  return {
    cx: (cx - options.W / 2) * viewZoom
      + options.W / 2 + viewPanX,
    cy: (cy - options.H / 2) * viewZoom
      + options.H / 2 + viewPanY,
    w: part.w * scale * world.scale / 100,
    h: part.h * scale * world.scale / 100,
    angle: world.rotation * Math.PI / 180
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
