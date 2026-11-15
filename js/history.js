
import * as THREE from "three";

export function createHistoryManager(options = {}) {
  const {
    getObjects,
    addObject,
    selectMesh,
    clearAllObjects,
    updateEditDisplay,
    refreshObjectList,
    refreshProperties,
    updateDebugPanel
  } = options;

  let history = [];
  let historyIndex = -1;

  function createSnapshot() {
    return getObjects().map(object => {
      const geometry = object.geometry;

      return {
        name: object.name,
        type: geometry.type,
        parameters: geometry.parameters
          ? { ...geometry.parameters }
          : null,
        position: object.position.toArray(),
        rotation: object.rotation.toArray(),
        scale: object.scale.toArray(),
        color: object.material.color.getHex(),
        roughness: object.material.roughness,
        metalness: object.material.metalness,
        vertices: Array.from(geometry.attributes.position.array),
        colors: geometry.attributes.color
          ? Array.from(geometry.attributes.color.array)
          : null,
        indices: geometry.index
          ? Array.from(geometry.index.array)
          : null
      };
    });
  }

  function saveHistory() {
    const snapshot = createSnapshot();

    history = history.slice(0, historyIndex + 1);
    history.push(JSON.stringify(snapshot));

    if (history.length > 50) history.shift();

    historyIndex = history.length - 1;
  }

  function restoreCustomGeometry(object, data) {
    if (data.type === "BoxGeometry") {
      const p = data.parameters || {};

      const geometry = new THREE.BoxGeometry(
        p.width || 1,
        p.height || 1,
        p.depth || 1,
        p.widthSegments || 1,
        p.heightSegments || 1,
        p.depthSegments || 1
      );

      object.geometry.dispose();
      object.geometry = geometry;
      return;
    }

    if (data.type !== "BufferGeometry") return;

    object.geometry.dispose();

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(data.vertices, 3)
    );

    if (Array.isArray(data.indices)) {
      geometry.setIndex(data.indices);
    }

    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    object.geometry = geometry;

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    materials.forEach(material => {
      material.side = THREE.DoubleSide;
    });
  }

  function applyVertexData(object, vertices) {
    if (!Array.isArray(vertices)) return;

    const positions = object.geometry.attributes.position;

    if (!positions || positions.array.length !== vertices.length) return;

    positions.array.set(vertices);
    positions.needsUpdate = true;

    object.geometry.computeVertexNormals();
    object.geometry.computeBoundingBox();
    object.geometry.computeBoundingSphere();
  }

  function applyColorData(object, colors) {
    if (!Array.isArray(colors)) return;

    const positions = object.geometry.attributes.position;

    if (!positions || colors.length !== positions.count * 3) return;

    object.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3)
    );

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    materials.forEach(material => {
      material.vertexColors = true;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    });
  }

  
  function restoreData(data) {
    const geometryTypes = {
      BoxGeometry: "cube",
      SphereGeometry: "sphere",
      CylinderGeometry: "cylinder",
      ConeGeometry: "cone",
      PlaneGeometry: "plane",
      TorusGeometry: "torus",
      TetrahedronGeometry: "triangularPyramid",
      OctahedronGeometry: "octahedron"
    };

    const p = data.parameters || {};
    let type = geometryTypes[data.type] || "cube";

    // 円柱の分割数から柱の種類を判定
    if (data.type === "CylinderGeometry") {
      if (p.radialSegments === 3) type = "triangularPrism";
      if (p.radialSegments === 4) {
        type = p.radiusTop === 0
          ? "squarePyramid"
          : "squarePrism";
      }
      if (p.radialSegments === 6) type = "hexagonalPrism";
      if (p.radiusTop === 0 && p.radialSegments === 32) {
        type = "cone";
      }
    }

    const object = addObject(type);
    if (!object) return;

    restoreCustomGeometry(object, data);

    object.name = data.name;
    object.position.fromArray(data.position);
    object.rotation.fromArray(data.rotation);
    object.scale.fromArray(data.scale);

    if (data.color !== undefined) {
      object.material.color.setHex(data.color);
    }

    if (data.roughness !== undefined) {
      object.material.roughness = data.roughness;
    }

    if (data.metalness !== undefined) {
      object.material.metalness = data.metalness;
    }

    applyVertexData(object, data.vertices);
    applyColorData(object, data.colors);
  }


  function finishRestore() {
    const objects = getObjects();

    if (objects.length > 0) {
      selectMesh(objects[objects.length - 1]);
    } else {
      refreshObjectList();
      refreshProperties();
    }

    updateEditDisplay();
  }

  function restoreHistory(snapshotText) {
    const snapshot = JSON.parse(snapshotText);

    clearAllObjects();

    snapshot.forEach(restoreData);

    finishRestore();
  }

  function undoHistory() {
    if (historyIndex <= 0) return;

    historyIndex--;
    restoreHistory(history[historyIndex]);
  }

  function redoHistory() {
    if (historyIndex >= history.length - 1) return;

    historyIndex++;
    restoreHistory(history[historyIndex]);
  }

  function saveProject() {
    const data = {
      objects: createSnapshot()
    };

    const blob = new Blob(
      [JSON.stringify(data, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "inochi-3d-project.json";
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function loadProject(data) {
    if (!data || !Array.isArray(data.objects)) {
      alert("プロジェクトデータが正しくありません。");
      return;
    }

    clearAllObjects();

    data.objects.forEach(restoreData);

    finishRestore();

    history = [];
    historyIndex = -1;
    saveHistory();

    updateDebugPanel("プロジェクトを読み込みました");
  }

  return {
    createSnapshot,
    saveHistory,
    undoHistory,
    redoHistory,
    saveProject,
    loadProject
  };
}
