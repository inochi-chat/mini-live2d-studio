
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

let scene;
let objects = [];
let selectedObject = null;
let nextId = 1;

export function initObjects(targetScene) {
  scene = targetScene;
}

export function addObject(type) {
  if (!scene) return null;

  let geometry;

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

    default:
      return null;
  }

  const material = new THREE.MeshStandardMaterial({
    color: 0x9b8cff,
    roughness: 0.55,
    metalness: 0.05
  });

  const mesh = new THREE.Mesh(geometry, material);

  mesh.name = type + "_" + nextId;
  mesh.userData.id = nextId++;

  mesh.position.set(
    (Math.random() - 0.5) * 2,
    0.5,
    (Math.random() - 0.5) * 2
  );

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

// 材質設定を変更
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

// 現在の材質設定を取得
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

  objects = objects.filter(
    obj => obj !== selectedObject
  );

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

  if (position) {
    selectedObject.position.copy(position);
  }

  if (rotation) {
    selectedObject.rotation.copy(rotation);
  }

  if (scale) {
    selectedObject.scale.copy(scale);
  }
}
