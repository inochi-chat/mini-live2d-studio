export function cropRectCanvas(sourceCanvas, x, y, width, height) {
  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  canvas.getContext('2d').drawImage(
    sourceCanvas,
    x, y, width, height,
    0, 0, width, height
  );

  return canvas;
}

export function cropFreeCanvas(sourceCanvas, points) {
  if (points.length < 3) return null;

  const minX = Math.max(
    0,
    Math.floor(Math.min(...points.map(p => p.x)))
  );

  const minY = Math.max(
    0,
    Math.floor(Math.min(...points.map(p => p.y)))
  );

  const maxX = Math.min(
    sourceCanvas.width,
    Math.ceil(Math.max(...points.map(p => p.x)))
  );

  const maxY = Math.min(
    sourceCanvas.height,
    Math.ceil(Math.max(...points.map(p => p.y)))
  );

  if (maxX - minX < 2 || maxY - minY < 2) {
    return null;
  }

  const canvas = document.createElement('canvas');

  canvas.width = maxX - minX;
  canvas.height = maxY - minY;

  const ctx = canvas.getContext('2d');

  ctx.save();
  ctx.beginPath();

  points.forEach((point, index) => {
    const x = point.x - minX;
    const y = point.y - minY;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.closePath();
  ctx.clip();

  ctx.drawImage(
    sourceCanvas,
    minX, minY, canvas.width, canvas.height,
    0, 0, canvas.width, canvas.height
  );

  ctx.restore();

  return {
    canvas,
    x: minX,
    y: minY
  };
}
