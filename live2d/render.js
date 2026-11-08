
export function drawPart(ctx, part, image, transform) {
  if (!part.visible || !image) return;

  ctx.save();

  ctx.translate(transform.x, transform.y);
  ctx.rotate((part.rotation || 0) * Math.PI / 180);

  const scale = (part.scale || 100) / 100;
  ctx.scale(scale, scale);

  ctx.drawImage(
    image,
    -part.w / 2,
    -part.h / 2,
    part.w,
    part.h
  );

  ctx.restore();
}
