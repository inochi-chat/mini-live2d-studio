
export function createShowVerticesTool(options = {}) {
  const {
    THREE,
    getVertexHelper,
    setVertexHelper,
    selectedVertexIndices,
    clearVertexHelper,
    updateVertexColors
  } = options;

  function showVertices(object) {
    clearVertexHelper();

    const positions = object.geometry.attributes.position;
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

    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      vertexColors: true,
      size: 0.12,
      sizeAttenuation: true,
      depthTest: false
    });

    const helper = new THREE.Points(geometry, material);
    helper.renderOrder = 10;

    object.add(helper);
    setVertexHelper(helper);

    updateVertexColors();
  }

  return {
    showVertices
  };
}
