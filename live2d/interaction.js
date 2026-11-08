export function stagePoint(stage, e, W, H) {
  const r = stage.getBoundingClientRect();

  return {
    x: (e.clientX - r.left) * W / r.width,
    y: (e.clientY - r.top) * H / r.height
  };
}

export function sourcePoint(p, fit) {
  return {
    x: (p.x - fit.ox) / fit.scale,
    y: (p.y - fit.oy) / fit.scale
  };
}

export function clampZoom(value) {
  return Math.max(0.25, Math.min(5, value));
}

export function getPanDelta(current, previous) {
  return {
    x: current.x - previous.x,
    y: current.y - previous.y
  };
}

export function getPinchRatio(distance, startDistance) {
  return distance / Math.max(1, startDistance);
}

export function clampPan(value) {
  return Math.max(-3000, Math.min(3000, value));
}
