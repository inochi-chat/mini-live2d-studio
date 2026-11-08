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
