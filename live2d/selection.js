
// 選択パーツの操作範囲を計算
export function selectionHandles(p, partScreenInfo) {
  const a = partScreenInfo(p);
  const c = Math.cos(a.angle);
  const s = Math.sin(a.angle);
  const hw = a.w / 2;
  const hh = a.h / 2;

  const point = (x, y) => ({
    x: a.cx + x * c - y * s,
    y: a.cy + x * s + y * c
  });

  const corners = [
    point(-hw, -hh),
    point(hw, -hh),
    point(hw, hh),
    point(-hw, hh)
  ];

  const top = point(0, -hh);

  const rotate = {
    x: top.x - Math.sin(a.angle) * 28,
    y: top.y + Math.cos(a.angle) * 28
  };

  return { ...a, corners, rotate, point };
}

// 拡大・回転ハンドルの判定
export function hitSelectedHandle(p, pos, partScreenInfo) {
  if (!p) return null;

  const h = selectionHandles(p, partScreenInfo);

  if (Math.hypot(pos.x - h.rotate.x, pos.y - h.rotate.y) < 15) {
    return 'rotate';
  }

  for (let i = 0; i < h.corners.length; i++) {
    if (Math.hypot(pos.x - h.corners[i].x, pos.y - h.corners[i].y) < 15) {
      return 'scale';
    }
  }

  return null;
}

// パーツ本体に触れたか判定
export function hitPart(pos, parts, partScreenInfo) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];

    if (!p.visible) continue;

    const a = partScreenInfo(p);
    const dx = pos.x - a.cx;
    const dy = pos.y - a.cy;
    const c = Math.cos(-a.angle);
    const s = Math.sin(-a.angle);

    const lx = dx * c - dy * s;
    const ly = dx * s + dy * c;

    if (Math.abs(lx) <= a.w / 2 + 5 &&
        Math.abs(ly) <= a.h / 2 + 5) {
      return p;
    }
  }

  return null;
}
