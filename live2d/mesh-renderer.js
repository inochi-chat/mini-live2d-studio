
// メッシュを使って画像を変形描画

export function drawDeformedImage(ctx, image, mesh, options = {}) {
  if (!ctx || !image || !mesh) return;

  const {
    x = 0,
    y = 0,
    scaleX = 1,
    scaleY = 1,
    rotation = 0
  } = options;

  const sw = image.naturalWidth || image.width;
  const sh = image.naturalHeight || image.height;

  if (!sw || !sh || !mesh.width || !mesh.height) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scaleX, scaleY);

  mesh.triangles.forEach(triangle => {
    const source = triangle.map(index => {
      const p = mesh.originalVertices[index];

      return {
        x: p.x * sw / mesh.width,
        y: p.y * sh / mesh.height
      };
    });

    // 画像の中央を原点にする
    const target = triangle.map(index => {
      const p = mesh.vertices[index];

      return {
        x: p.x - mesh.width / 2,
        y: p.y - mesh.height / 2
      };
    });

    drawTriangle(ctx, image, source, target);
  });

  ctx.restore();
}


// メッシュの格子と頂点を描画
export function drawMeshGrid(ctx, mesh, options = {}) {
  if (!ctx || !mesh) return;

  const {
    x = 0,
    y = 0,
    scaleX = 1,
    scaleY = 1,
    rotation = 0,
    selectedVertex = -1
  } = options;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scaleX, scaleY);

  ctx.strokeStyle = '#bda0ff';
  ctx.lineWidth = 1 / Math.max(0.001, Math.abs(scaleX));
  ctx.fillStyle = '#ffffff';

  // 横方向の格子
  for (let row = 0; row <= mesh.rows; row++) {
    ctx.beginPath();

    for (let col = 0; col <= mesh.columns; col++) {
      const index = row * (mesh.columns + 1) + col;
      const p = mesh.vertices[index];

      const px = p.x - mesh.width / 2;
      const py = p.y - mesh.height / 2;

      if (col === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.stroke();
  }

  // 縦方向の格子
  for (let col = 0; col <= mesh.columns; col++) {
    ctx.beginPath();

    for (let row = 0; row <= mesh.rows; row++) {
      const index = row * (mesh.columns + 1) + col;
      const p = mesh.vertices[index];

      const px = p.x - mesh.width / 2;
      const py = p.y - mesh.height / 2;

      if (row === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.stroke();
  }

  // 頂点
  mesh.vertices.forEach((vertex, index) => {
    const px = vertex.x - mesh.width / 2;
    const py = vertex.y - mesh.height / 2;

    ctx.beginPath();

    ctx.arc(
      px,
      py,
      4 / Math.max(0.001, Math.abs(scaleX)),
      0,
      Math.PI * 2
    );

    ctx.fillStyle =
      index === selectedVertex ? '#ffb347' : '#ffffff';

    ctx.fill();

    if (index === selectedVertex) {
      ctx.strokeStyle = '#ff8c42';
      ctx.lineWidth = 2 / Math.max(0.001, Math.abs(scaleX));
      ctx.stroke();
    }
  });

  ctx.restore();
}


// 三角形単位で画像を変形描画
function drawTriangle(ctx, image, source, target) {
  const [s0, s1, s2] = source;
  const [t0, t1, t2] = target;

  const u1 = s1.x - s0.x;
  const v1 = s1.y - s0.y;
  const u2 = s2.x - s0.x;
  const v2 = s2.y - s0.y;

  const a = t1.x - t0.x;
  const b = t1.y - t0.y;
  const c = t2.x - t0.x;
  const d = t2.y - t0.y;

  const det = u1 * v2 - u2 * v1;

  if (Math.abs(det) < 0.0001) return;

  const m11 = (a * v2 - c * v1) / det;
  const m12 = (b * v2 - d * v1) / det;
  const m21 = (c * u1 - a * u2) / det;
  const m22 = (d * u1 - b * u2) / det;

  const tx = t0.x - m11 * s0.x - m21 * s0.y;
  const ty = t0.y - m12 * s0.x - m22 * s0.y;

  ctx.save();

  ctx.beginPath();
  ctx.moveTo(t0.x, t0.y);
  ctx.lineTo(t1.x, t1.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.closePath();
  ctx.clip();

  ctx.transform(m11, m12, m21, m22, tx, ty);
  ctx.drawImage(image, 0, 0);

  ctx.restore();
}
