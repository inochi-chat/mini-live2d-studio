
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
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];

      const material = materials[0];

      return {
        name: object.name,
        id: object.userData.id,
        type: geometry.type,
        parameters: geometry.parameters
          ? { ...geometry.parameters }
          : null,

        position: object.position.toArray(),
        rotation: object.rotation.toArray(),
        scale: object.scale.toArray(),

        color: material?.color?.getHex() ?? 0xffffff,
        roughness: material?.roughness,
        metalness: material?.metalness,

        vertices: Array.from(
          geometry.attributes.position.array
        ),

        colors: geometry.attributes.color
          ? Array.from(geometry.attributes.color.array)
          : null,

        indices: geometry.index
          ? Array.from(geometry.index.array)
          : null,

        customEdges: Array.isArray(object.userData.customEdges)
          ? JSON.parse(JSON.stringify(object.userData.customEdges))
          : [],

        characterPart: object.userData.characterPart === true,
        partType: object.userData.partType ?? null
      };
    });
  }

  function saveHistory() {
    const snapshot = createSnapshot();

    history = history.slice(0, historyIndex + 1);
    history.push(JSON.stringify(snapshot));

    if (history.length > 50) {
      history.shift();
    }

    historyIndex = history.length - 1;
  }

  function createGeometry(data) {
    const geometry = new THREE.BufferGeometry();

    if (!Array.isArray(data.vertices)) {
      return geometry;
    }

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(data.vertices, 3)
    );

    if (Array.isArray(data.indices)) {
      geometry.setIndex(data.indices);
    }

    if (Array.isArray(data.colors)) {
      geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(data.colors, 3)
      );
    }

    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;
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

    if (data.type === "CylinderGeometry") {
      if (p.radialSegments === 3) {
        type = "triangularPrism";
      }

      if (p.radialSegments === 4) {
        type = p.radiusTop === 0
          ? "squarePyramid"
          : "squarePrism";
      }

      if (p.radialSegments === 6) {
        type = "hexagonalPrism";
      }

      if (p.radiusTop === 0 && p.radialSegments === 32) {
        type = "cone";
      }
    }

    const object = addObject(type);
    if (!object) return;

    const oldGeometry = object.geometry;
    object.geometry = createGeometry(data);
    oldGeometry.dispose();

    object.name = data.name;

    if (data.id !== undefined) {
      object.userData.id = data.id;
    }

    object.position.fromArray(data.position);
    object.rotation.fromArray(data.rotation);
    object.scale.fromArray(data.scale);

    object.userData.customEdges = Array.isArray(data.customEdges)
      ? JSON.parse(JSON.stringify(data.customEdges))
      : [];

    if (data.characterPart) {
      object.userData.characterPart = true;
      object.userData.partType = data.partType;
    }

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];

    materials.forEach(material => {
      if (data.color !== undefined) {
        material.color.setHex(data.color);
      }

      if (data.roughness !== undefined && "roughness" in material) {
        material.roughness = data.roughness;
      }

      if (data.metalness !== undefined && "metalness" in material) {
        material.metalness = data.metalness;
      }

      material.vertexColors = Array.isArray(data.colors);
      material.needsUpdate = true;
    });
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
