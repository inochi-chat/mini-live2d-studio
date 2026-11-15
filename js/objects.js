
import * as THREE from "three";

let scene;
let objects = [];
let selectedObject = null;
let nextId = 1;

// キャラクター人体パーツの設定
const characterParts = {
  head: {
    label: "頭",
    geometry: "sphere",
    scale: [0.55, 0.65, 0.5],
    position: [0, 2.35, 0]
  },
  neck: {
    label: "首",
    geometry: "cylinder",
    scale: [0.2, 0.35, 0.2],
    position: [0, 1.85, 0]
  },
  torso: {
    label: "胴体",
    geometry: "sphere",
    scale: [0.65, 0.85, 0.35],
    position: [0, 1.35, 0]
  },
  upperArmL: {
    label: "左上腕",
    geometry: "cylinder",
    scale: [0.16, 0.48, 0.16],
    position: [-0.72, 1.35, 0]
  },
  upperArmR: {
    label: "右上腕",
    geometry: "cylinder",
    scale: [0.16, 0.48, 0.16],
    position: [0.72, 1.35, 0]
  },
  forearmL: {
    label: "左前腕",
    geometry: "cylinder",
    scale: [0.13, 0.42, 0.13],
    position: [-0.78, 0.75, 0]
  },
  forearmR: {
    label: "右前腕",
    geometry: "cylinder",
    scale: [0.13, 0.42, 0.13],
    position: [0.78, 0.75, 0]
  },
  handL: {
    label: "左手",
    geometry: "sphere",
    scale: [0.17, 0.2, 0.12],
    position: [-0.78, 0.28, 0]
  },
  handR: {
    label: "右手",
    geometry: "sphere",
    scale: [0.17, 0.2, 0.12],
    position: [0.78, 0.28, 0]
  },
  thighL: {
    label: "左太もも",
    geometry: "cylinder",
    scale: [0.23, 0.48, 0.23],
    position: [-0.28, 0.55, 0]
  },
  thighR: {
    label: "右太もも",
    geometry: "cylinder",
    scale: [0.23, 0.48, 0.23],
    position: [0.28, 0.55, 0]
  },
  lowerLegL: {
    label: "左すね",
    geometry: "cylinder",
    scale: [0.16, 0.43, 0.16],
    position: [-0.28, -0.12, 0]
  },
  lowerLegR: {
    label: "右すね",
    geometry: "cylinder",
    scale: [0.16, 0.43, 0.16],
    position: [0.28, -0.12, 0]
  },
  footL: {
    label: "左足",
    geometry: "box",
    scale: [0.25, 0.15, 0.48],
    position: [-0.28, -0.48, 0.15]
  },
  footR: {
    label: "右足",
    geometry: "box",
    scale: [0.25, 0.15, 0.48],
    position: [0.28, -0.48, 0.15]
  },
  hair: {
    label: "髪",
    geometry: "sphere",
    scale: [0.58, 0.35, 0.53],
    position: [0, 2.72, -0.03]
  }
};

export function initObjects(targetScene) {
  scene = targetScene;
}

export function addObject(type) {
  if (!scene) return null;

  let geometry;
  const part = characterParts[type];

  if (part) {
    if (part.geometry === "sphere") {
      geometry = new THREE.SphereGeometry(0.5, 32, 24);
    } else if (part.geometry === "cylinder") {
      geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
    } else if (part.geometry === "box") {
      geometry = new THREE.BoxGeometry(1, 1, 1);
    }
  } else {
    switch (type) {
      case "cube":
        geometry = new THREE.BoxGeometry(1, 1, 1);
        break;

      case "sphere":
        geometry = new THREE.SphereGeometry(0.5, 32, 24);
        break;

      case "cylinder":
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
        break;

      case "cone":
        geometry = new THREE.ConeGeometry(0.5, 1, 32);
        break;

      case "plane":
        geometry = new THREE.PlaneGeometry(1, 1);
        break;

      case "torus":
        geometry = new THREE.TorusGeometry(0.5, 0.18, 16, 48);
        break;

      case "triangularPrism":
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 3);
        break;

      case "squarePrism":
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 4);
        break;

      case "hexagonalPrism":
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 6);
        break;

      case "triangularPyramid":
        geometry = new THREE.TetrahedronGeometry(0.7, 0);
        break;

      case "squarePyramid":
        geometry = new THREE.CylinderGeometry(0, 0.7, 1, 4);
        break;

      case "octahedron":
        geometry = new THREE.OctahedronGeometry(0.7, 0);
        break;

      default:
        return null;
    }
  }

  const material = new THREE.MeshStandardMaterial({
    color: 0x9b8cff,
    roughness: 0.55,
    metalness: 0.05
  });

  const mesh = new THREE.Mesh(geometry, material);

  mesh.name = (part ? part.label : type) + "_" + nextId;
  mesh.userData.id = nextId++;

  if (part) {
    mesh.userData.characterPart = true;
    mesh.userData.partType = type;

    mesh.scale.set(...part.scale);
    mesh.position.set(...part.position);
  } else {
    mesh.position.set(
      (Math.random() - 0.5) * 2,
      0.5,
      (Math.random() - 0.5) * 2
    );
  }

  if (type === "plane") {
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.02;
  }

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  scene.add(mesh);
  objects.push(mesh);

  selectObject(mesh);

  return mesh;
}

export function selectObject(mesh) {
  selectedObject = mesh;
  return selectedObject;
}

export function getSelectedObject() {
  return selectedObject;
}

export function getObjects() {
  return [...objects];
}

export function setSelectedMaterial(options = {}) {
  if (!selectedObject) return false;

  const materials = Array.isArray(selectedObject.material)
    ? selectedObject.material
    : [selectedObject.material];

  materials.forEach(material => {
    if (options.color !== undefined) {
      material.color.set(options.color);
    }

    if (options.roughness !== undefined) {
      material.roughness = THREE.MathUtils.clamp(
        Number(options.roughness), 0, 1
      );
    }

    if (options.metalness !== undefined) {
      material.metalness = THREE.MathUtils.clamp(
        Number(options.metalness), 0, 1
      );
    }

    material.needsUpdate = true;
  });

  return true;
}

export function getSelectedMaterial() {
  if (!selectedObject) return null;

  const material = Array.isArray(selectedObject.material)
    ? selectedObject.material[0]
    : selectedObject.material;

  if (!material) return null;

  return {
    color: "#" + material.color.getHexString(),
    roughness: material.roughness ?? 0.5,
    metalness: material.metalness ?? 0
  };
}

export function deleteSelectedObject() {
  if (!selectedObject) return;

  scene.remove(selectedObject);

  selectedObject.geometry.dispose();

  if (Array.isArray(selectedObject.material)) {
    selectedObject.material.forEach(m => m.dispose());
  } else {
    selectedObject.material.dispose();
  }

  objects = objects.filter(obj => obj !== selectedObject);
  selectedObject = null;
}

export function duplicateSelectedObject() {
  if (!selectedObject) return null;

  const clone = selectedObject.clone();

  clone.geometry = selectedObject.geometry.clone();

  if (Array.isArray(selectedObject.material)) {
    clone.material = selectedObject.material.map(m => m.clone());
  } else {
    clone.material = selectedObject.material.clone();
  }

  clone.name = selectedObject.name + "_copy";
  clone.userData.id = nextId++;

  clone.position.x += 1;
  clone.castShadow = true;
  clone.receiveShadow = true;

  scene.add(clone);
  objects.push(clone);

  selectObject(clone);

  return clone;
}

export function setObjectTransform(position, rotation, scale) {
  if (!selectedObject) return;

  if (position) selectedObject.position.copy(position);
  if (rotation) selectedObject.rotation.copy(rotation);
  if (scale) selectedObject.scale.copy(scale);
}
