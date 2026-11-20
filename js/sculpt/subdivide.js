
import * as THREE from "three";

/**
 * スカルプト用メッシュ細分化
 * 各三角形を4つの三角形に分割する
 */
export function subdivideGeometry(geometry, levels = 1) {
  let current = geometry.clone();

  const count = Math.max(
    1,
    Math.min(3, Math.floor(Number(levels) || 1))
  );

  for (let level = 0; level < count; level++) {
    const source = current.attributes.position;
    const positions = [];
    const indices = [];

    const midpointCache = new Map();

    function addVertex(a, b, c) {
      const index = positions.length / 3;
      positions.push(a, b, c);
      return index;
    }

    function midpoint(i1, i2) {
      const low = Math.min(i1, i2);
      const high = Math.max(i1, i2);
      const key = `${low}_${high}`;

      if (midpointCache.has(key)) {
        return midpointCache.get(key);
      }

      const a = new THREE.Vector3().fromBufferAttribute(
        source,
        i1
      );

      const b = new THREE.Vector3().fromBufferAttribute(
        source,
        i2
      );

      const middle = a.add(b).multiplyScalar(0.5);

      const index = addVertex(
        middle.x,
        middle.y,
        middle.z
      );

      midpointCache.set(key, index);
      return index;
    }

    const sourceIndex = current.index
      ? current.index.array
      : Array.from(
          { length: source.count },
          (_, i) => i
        );

    for (let i = 0; i < sourceIndex.length; i += 3) {
      const a = sourceIndex[i];
      const b = sourceIndex[i + 1];
      const c = sourceIndex[i + 2];

      const A = new THREE.Vector3().fromBufferAttribute(
        source,
        a
      );

      const B = new THREE.Vector3().fromBufferAttribute(
        source,
        b
      );

      const C = new THREE.Vector3().fromBufferAttribute(
        source,
        c
      );

      const ab = midpoint(a, b);
      const bc = midpoint(b, c);
      const ca = midpoint(c, a);

      const base = positions.length / 3;

      positions.push(
        A.x, A.y, A.z,
        B.x, B.y, B.z,
        C.x, C.y, C.z
      );

      indices.push(
        base, ab, ca,
        ab, base + 1, bc,
        ca, bc, base + 2,
        ab, bc, ca
      );
    }

    current.dispose();

    const next = new THREE.BufferGeometry();

    next.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    );

    next.setIndex(indices);
    next.computeVertexNormals();
    next.computeBoundingBox();
    next.computeBoundingSphere();

    current = next;
  }

  return current;
}
