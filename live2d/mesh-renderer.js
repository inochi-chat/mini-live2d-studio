
import { createMesh } from './mesh-deformer.js';

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

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scaleX, scaleY);

  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;

  if (!sourceWidth || !sourceHeight) {
    ctx.restore();
    return;
  }

  mesh.triangles.forEach(triangle => {
    const [i0, i1, i2] = triangle;

    const source = [
      mesh.originalVertices[i0],
      mesh.originalVertices[i1],
      mesh.originalVertices[i2]
    ];

    const target = [
      mesh.vertices[i0],
      mesh.vertices[i1],
      mesh.vertices[i2]
    ];

    drawTriangle(ctx, image, source, target);
  });

  ctx.restore();
}

// 三角形単位で画像を変形描画
function drawTriangle(ctx, image, source, target) {
  const [s0, s1, s2] = source;
  const [t0, t1, t2] = target;

  const sw = image.naturalWidth || image.width;
  const sh = image.naturalHeight || image.height;

  const sx = sw / (Math.max(...source.map(p => p.x)) || 1);
  const sy = sh / (Math.max(...source.map(p => p.y)) || 1);

  const a = t1.x - t0.x;
  const b = t1.y - t0.y;
  const c = t2.x - t0.x;
  const d = t2.y - t0.y;

  const det = a * d - b * c;
  if (Math.abs(det) < 0.0001) return;

  const sourceA = (s1.x - s0.x) * sx;
  const sourceB = (s1.y - s0.y) * sy;
  const sourceC = (s2.x - s0.x) * sx;
  const sourceD = (s2.y - s0.y) * sy;

  const inv = 1 / (sourceA * sourceD - sourceB * sourceC);
  if (!Number.isFinite(inv)) return;

  const m11 = (a * sourceD - c * sourceB) * inv;
  const m12 = (b * sourceD - d * sourceB) * inv;
  const m21 = (c * sourceA - a * sourceC) * inv;
  const m22 = (d * sourceA - b * sourceC) * inv;

  const sourceX = s0.x * sx;
  const sourceY = s0.y * sy;

  const tx = t0.x - m11 * sourceX - m21 * sourceY;
  const ty = t0.y - m12 * sourceX - m22 * sourceY;

  ctx.save();

  ctx.beginPath();
  ctx.moveTo(t0.x, t0.y);
  ctx.lineTo(t1.x, t1.y);
  ctx.lineTo(t2.x, t2.y);
  ctx.closePath();
  ctx.clip();

  ctx.transform(m11, m12, m21, m22, tx, ty);
  ctx.drawImage(image, 0, 0, sw, sh);

  ctx.restore();
}
