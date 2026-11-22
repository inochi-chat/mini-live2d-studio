
export function getWorldTransform(part, parts, seen = new Set()) {
  if (!part || seen.has(part.id)) {
    return { x: 0, y: 0, scale: 100, rotation: 0 };
  }

  seen.add(part.id);

  const parent = parts.find(p => p.id === part.parentId);

  if (!parent) {
    return {
      x: part.x,
      y: part.y,
      scale: part.scale,
      rotation: part.rotation
    };
  }

  const pt = getWorldTransform(parent, parts, seen);
  const rad = pt.rotation * Math.PI / 180;

  const lx = part.x * pt.scale / 100;
  const ly = part.y * pt.scale / 100;

  return {
    x: pt.x + lx * Math.cos(rad) - ly * Math.sin(rad),
    y: pt.y + lx * Math.sin(rad) + ly * Math.cos(rad),
    scale: pt.scale * part.scale / 100,
    rotation: pt.rotation + part.rotation
  };
}

export function isChildOf(partId, targetId, parts) {
  let part = parts.find(p => p.id === partId);
  const seen = new Set();

  while (part && part.parentId != null && !seen.has(part.id)) {
    if (part.parentId === targetId) return true;

    seen.add(part.id);
    part = parts.find(p => p.id === part.parentId);
  }

  return false;
}

export function setParent(part, parentId, parts) {
  const old = getWorldTransform(part, parts);
  const parent = parentId
    ? parts.find(p => p.id === Number(parentId))
    : null;

  if (!parent) {
    part.parentId = null;
    part.x = old.x;
    part.y = old.y;
    part.scale = old.scale;
    part.rotation = old.rotation;
    return;
  }

  const pt = getWorldTransform(parent, parts);
  const dx = old.x - pt.x;
  const dy = old.y - pt.y;

  const rad = -pt.rotation * Math.PI / 180;
  const scale = pt.scale / 100;

  part.x = (dx * Math.cos(rad) - dy * Math.sin(rad)) / scale;
  part.y = (dx * Math.sin(rad) + dy * Math.cos(rad)) / scale;
  part.scale = old.scale / pt.scale * 100;
  part.rotation = old.rotation - pt.rotation;
  part.parentId = parent.id;
}

export function worldToLocalPosition(part, wx, wy, parts) {
  const parent = parts.find(p => p.id === part.parentId);

  if (!parent) {
    part.x = wx;
    part.y = wy;
    return;
  }

  const pt = getWorldTransform(parent, parts);
  const dx = wx - pt.x;
  const dy = wy - pt.y;
  const rad = -pt.rotation * Math.PI / 180;
  const scale = pt.scale / 100;

  part.x = (dx * Math.cos(rad) - dy * Math.sin(rad)) / scale;
  part.y = (dx * Math.sin(rad) + dy * Math.cos(rad)) / scale;
}
