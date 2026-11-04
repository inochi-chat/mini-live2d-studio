
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js";

export function createScene(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x191b29);

  // カメラ
  const camera = new THREE.PerspectiveCamera(
    45,
    1,
    0.1,
    1000
  );

  camera.position.set(6, 5, 8);

  // レンダラー
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false
  });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
  );

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // 環境光
  const ambient = new THREE.HemisphereLight(
    0xffffff,
    0x454565,
    2
  );
  scene.add(ambient);

  // メインライト
  const light = new THREE.DirectionalLight(
    0xffffff,
    3
  );

  light.position.set(5, 10, 7);
  light.castShadow = true;
  scene.add(light);

  // 床
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({
      color: 0x25283a,
      roughness: 0.9
    })
  );

  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.025;
  floor.receiveShadow = true;
  scene.add(floor);

  // グリッド
  const grid = new THREE.GridHelper(
    100,
    100,
    0x7772b9,
    0x41445d
  );

  grid.position.y = 0;
  scene.add(grid);

  // 中心軸
  const axes = new THREE.AxesHelper(3);
  scene.add(axes);

  // カメラ操作
  const controls = new OrbitControls(
    camera,
    renderer.domElement
  );

  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.target.set(0, 1, 0);

  controls.minDistance = 2;
  controls.maxDistance = 50;
  controls.maxPolarAngle = Math.PI * 0.49;

  // サイズ調整
  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (!width || !height) return;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height, false);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  resize();

  // 描画ループ
  let animationId;

  function animate() {
    animationId = requestAnimationFrame(animate);

    controls.update();
    renderer.render(scene, camera);
  }

  animate();

  return {
    scene,
    camera,
    renderer,
    controls,

    dispose() {
      cancelAnimationFrame(animationId);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
    }
  };
}
