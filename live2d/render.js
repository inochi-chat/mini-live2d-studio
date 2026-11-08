
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
