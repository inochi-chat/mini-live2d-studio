
export function createShowVerticesTool(options = {}) {
  const {
    THREE,
    setVertexHelper,
    clearVertexHelper,
    updateVertexColors
  } = options;

  function showVertices(object) {
    if (!object || !object.geometry) return;

    const positions = object.geometry.attributes.position;

    if (!positions) return;

    clearVertexHelper();

    const points = [];

    for (let i = 0; i < positions.count; i++) {
      points.push(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points, 3)
    );

    geometry.computeBoundingSphere();

    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      vertexColors: true,
      size: 10,
      sizeAttenuation: false,
      depthTest: false,
      depthWrite: false
    });

    const helper = new THREE.Points(geometry, material);

    helper.renderOrder = 999;
    helper.frustumCulled = false;

    object.add(helper);
    setVertexHelper(helper);

    updateVertexColors();
  }

  return {
    showVertices
  };
}
