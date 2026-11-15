
export function findMatchingVertices(object, point) {
  const positions = object.geometry.attributes.position;
  const matches = [];

  for (let i = 0; i < positions.count; i++) {
    if (
      Math.abs(positions.getX(i) - point.x) < 0.0001 &&
      Math.abs(positions.getY(i) - point.y) < 0.0001 &&
      Math.abs(positions.getZ(i) - point.z) < 0.0001
    ) {
      matches.push(i);
    }
  }

  return matches;
}
