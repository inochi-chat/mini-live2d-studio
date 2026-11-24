
import { state } from './state.js';
import { createHistoryManager } from './history.js';
import { initFileEvents } from './file-events.js';
import { initProjectIO } from './project-io.js';
import { initModeEvents } from './mode-events.js';
import { initPartEvents } from './part-events.js';
import { initEditorEvents } from './editor-events.js';
import { initViewEvents } from './view-events.js';
import { initStageEvents } from './stage-events.js';
import { createAnimation } from './animation.js';
import { createPartList } from './part-list.js?v=2';
import { createPartActions } from './part-actions.js';
import { createView } from './view.js';
import { createMeshEditor } from './mesh-editor.js';


import {
  canvasURL,
  cloneCanvas,
  imageFromURL
} from './canvas-utils.js';

import { loadImageFile } from './image-loader.js';
import { readPSDFile } from './psd-loader.js';
import { createPartsFromPSD } from './psd-parts.js';

import {
  cropRectCanvas,
  cropFreeCanvas
} from './crop.js';

import {
  eraseCanvas,
  restoreCanvas
} from './eraser.js';

import {
  createPart,
  getSelectedPart
} from './parts.js';

import { separateCharacter } from './auto-separation.js';

import { partTemplates } from './templates/part-templates.js';

import {
  partScreenInfo as partScreenInfoFromModule,
  renderStage
} from './render.js';

import {
  hitSelectedHandle,
  hitPart
} from './selection.js';

import {
  getWorldTransform as getWorldTransformFromModule,
  isChildOf as isChildOfFromModule,
  setParent as setParentFromModule,
  worldToLocalPosition as worldToLocalPositionFromModule
} from './hierarchy.js';

import {
  stagePoint as stagePointFromModule,
  sourcePoint as sourcePointFromModule,
  clampZoom,
  getPinchRatio,
  clampPan
} from './interaction.js';


(() => {
'use strict';

const $ = id => document.getElementById(id);

state.stage = $('stage');
state.ctx = state.stage.getContext('2d');
state.W = state.stage.width;
state.H = state.stage.height;

const stage = state.stage;
const ctx = state.ctx;
const W = state.W;
const H = state.H;

const partCategory = $('partCategory');

partCategory.replaceChildren();

partTemplates.forEach(template => {
  const option = document.createElement('option');
  option.value = template.id;
  option.textContent = template.name;
  partCategory.append(option);
});

const sourceCanvas = state.sourceCanvas;
let sourceCtx = sourceCanvas.getContext('2d');

let originalCanvas = state.originalCanvas;
let originalCtx = originalCanvas.getContext('2d');

state.sourceCtx = sourceCtx;
state.originalCtx = originalCtx;

let baseImageData = null;
let parts = [];
let selectedId = null;
let nextId = 1;

let mode = 'normal';
let brushSize = 24;
let drawing = false;
let startPoint = null;
let freePoints = [];
let previewPoint = null;

let animFrame = 0;
let raf = null;
let motionTime = 0;
let lastTick = 0;

let fit = { scale: 1, ox: 0, oy: 0 };
let viewZoom = 1;
let viewPanX = 0;
let viewPanY = 0;
let artScale = 1;
let view;

const collapsedParts = new Set();

const images = new Map();
const imageLoading = new Map();
let meshEditor = null;

function clonePart(part) {
  return {
    ...part,
    mesh: part.mesh
      ? {
          ...part.mesh,
          vertices: part.mesh.vertices.map(v => ({ ...v })),
          originalVertices: part.mesh.originalVertices.map(v => ({ ...v })),
          triangles: part.mesh.triangles.map(t => [...t])
        }
      : undefined
  };
}

  
function status(message, type = 'info') {
  const box = $('status');
  box.replaceChildren();

  const title = document.createElement('strong');
  title.textContent = type === 'error'
    ? '⚠️ エラー'
    : '📂 読み込み状況';

  const line = document.createElement('div');
  line.textContent = message;

  box.append(title, line);
}


window.addEventListener('error', e => {
  status(
    (e.message || 'JavaScriptエラー') +
    ' / 行: ' + (e.lineno || '不明'),
    'error'
  );
});

window.addEventListener('unhandledrejection', e => {
  status(
    '非同期エラー: ' +
    String(e.reason?.message || e.reason),
    'error'
  );
});


function downloadBlob(blob, name) {
  if (!blob) {
    status('書き出しに失敗したよ。', 'error');
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = name;

  document.body.append(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 2000);
}


// パーツ画像を必要に応じて読み込む
function preparePartImages() {
  parts.forEach(part => {
    if (!part.data) return;

    const cached = images.get(part.id);

    if (cached?.data === part.data) return;
    if (imageLoading.has(part.id)) return;

    const promise = imageFromURL(part.data)
      .then(image => {
        images.set(part.id, {
          data: part.data,
          image
        });
        render();
      })
      .catch(error => {
        console.error(error);
        status(
          (part.name || 'パーツ') + 'の画像を読み込めなかったよ。',
          'error'
        );
      })
      .finally(() => {
        imageLoading.delete(part.id);
      });

    imageLoading.set(part.id, promise);
  });

  const activeIds = new Set(parts.map(p => p.id));

  for (const id of images.keys()) {
    if (!activeIds.has(id)) images.delete(id);
  }
}


// 描画処理
function render() {
  calculateFit();
  preparePartImages();

  const imageMap = new Map();

  images.forEach((entry, id) => {
    imageMap.set(id, entry.image);
  });

  console.log(
    'animation:',
    $('animation').checked,
    'motion:',
    parts.map(p => p.motion),
    'sway:',
    parts.map(p => p.sway)
  );

  renderStage(ctx, {
    W,
    H,
    sourceCanvas,
    hideBase: $('hideBase').checked,
    parts,
    selectedId,
    fit,
    getWorldTransform,
    images: imageMap,
    motionTime,
    animation: $('animation').checked,
    startPoint,
    currentPoint: previewPoint,
    freePoints,
    mode
  });
}

view = createView({
  W,
  H,

  getSourceCanvas: () => sourceCanvas,

  getViewZoom: () => viewZoom,
  getViewPan: () => ({
    x: viewPanX,
    y: viewPanY
  }),
  getArtScale: () => artScale,

  setViewZoomState: value => {
    viewZoom = value;
  },

  setViewPanState: (x, y) => {
    viewPanX = x;
    viewPanY = y;
  },

  setArtScaleState: value => {
    artScale = value;
  },

  setFit: value => {
    fit = value;
  },

  updateZoomLabel
});  

function createHistorySnapshot() {
  return {
    source: sourceCanvas.width && sourceCanvas.height
      ? canvasURL(sourceCanvas)
      : null,

    parts: parts.map(clonePart),
    selectedId,
    nextId,
    baseImageData
  };
}


function saveUndo() {
  history.save();
}


async function restoreSnapshot(snapshot) {
  if (snapshot.source) {
    const im = await imageFromURL(snapshot.source);

    sourceCanvas.width = im.width;
    sourceCanvas.height = im.height;

    sourceCtx = sourceCanvas.getContext('2d');
    sourceCtx.drawImage(im, 0, 0);
  } else {
    sourceCanvas.width = 0;
    sourceCanvas.height = 0;
    sourceCtx = sourceCanvas.getContext('2d');
  }

  state.sourceCtx = sourceCtx;

  parts = snapshot.parts.map(clonePart);
  selectedId = snapshot.selectedId;
  nextId = snapshot.nextId;
  baseImageData = snapshot.baseImageData;

  images.clear();
  imageLoading.clear();

  updatePartList();
  syncEditor();
  render();
}


const history = createHistoryManager({
  createSnapshot: createHistorySnapshot,
  restoreSnapshot,
  limit: 30
});


function calculateFit() {
  fit = view.calculateFit();
}


function updateZoomLabel() {
  $('zoomLabel').textContent =
    '表示 ' + Math.round(viewZoom * 100) + '%';

  $('artScaleValue').textContent =
    Math.round(artScale * 100);
}


function setViewZoom(value) {
  view.setViewZoom(value);
  render();
}


function resetViewOnly() {
  view.resetViewOnly();
  render();
}


function fitView() {
  view.fitView();
  render();
}


const stagePoint = e =>
  stagePointFromModule(stage, e, W, H);

const sourcePoint = p =>
  sourcePointFromModule(p, fit);


function partScreenInfo(part) {
  return partScreenInfoFromModule(part, {
    parts,
    fit,
    getWorldTransform
  });
}


function getWorldTransform(p, seen = new Set()) {
  return getWorldTransformFromModule(p, parts, seen);
}


function isChildOf(partId, targetId) {
  return isChildOfFromModule(partId, targetId, parts);
}


// パーツ追加
function addPart(name, canvas, x, y) {
  return partActions.addPart(name, canvas, x, y);
}

async function runAutoSeparation() {
  const sourceCanvas = state.sourceCanvas;

  if (!sourceCanvas || !sourceCanvas.width) {
    status('先にイラストを読み込んでね。');
    return;
  }

  const button = document.getElementById('autoSeparate');

  try {
    button.disabled = true;
    status('AIモデルを準備しているよ…');

    const separatedCanvas = await separateCharacter(
      sourceCanvas,
      message => status(message)
    );

    addPart(
      'キャラクター（背景除去）',
      separatedCanvas,
      300,
      300
    );

    status('キャラクターをパーツ一覧に追加したよ！');

  } catch (error) {
    console.error(error);
    status('エラー詳細：' + (error.stack || error.message));

  } finally {
    button.disabled = false;
  }
}
  

// 前後順
function movePart(id, direction) {
  partActions.movePart(id, direction);
}


// パーツ一覧
const { updatePartList } = createPartList({
  parts: () => parts,

  getSelectedId: () => selectedId,

  setSelectedId: id => {
    selectedId = id;
  },

  collapsedParts,
  saveUndo,
  syncEditor,
  render,
  movePart
});


const partActions = createPartActions({
  getParts: () => parts,

  setParts: value => {
    parts = value;
  },

  getSelectedId: () => selectedId,

  setSelectedId: id => {
    selectedId = id;
  },

  getNextId: () => nextId,

  setNextId: id => {
    nextId = id;
  },

  createPart,
  saveUndo,
  updatePartList,
  syncEditor,
  render,
  status,

  getWorldTransform: p => getWorldTransform(p),

  getImages: () => images,
  getImageLoading: () => imageLoading
});


function selected() {
  return getSelectedPart(parts, selectedId);
}

// メッシュエディターを初期化
meshEditor = createMeshEditor({
  getImage: () => {
    const part = selected();
    return part ? images.get(part.id)?.image || null : null;
  },

  getPart: selected,

  onChange: () => {
    render();
  }
});
  

// ★ エディターと選択中パーツの同期
function syncEditor() {
  const p = selected();

  [
    'partName',
    'partCategory',
    'posX',
    'posY',
    'scale',
    'rotation',
    'sway',
    'speed',
    'motionType',
    'parentPart',
    'togglePart',
    'duplicatePart',
    'deletePart'
  ].forEach(id => {
    $(id).disabled = !p;
  });

  const parentSelect = $('parentPart');
  parentSelect.replaceChildren();

  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'なし（親パーツ）';
  parentSelect.append(none);

  parts.forEach(q => {
    if (!p || q.id === p.id || isChildOf(q.id, p.id)) {
      return;
    }

    const option = document.createElement('option');
    option.value = q.id;
    option.textContent = q.name || ('パーツ ' + q.id);

    parentSelect.append(option);
  });

  if (!p) {
    $('partName').value = '';
    partCategory.value = 'other';
    parentSelect.value = '';

    updateValues();
    return;
  }

  $('partName').value = p.name;
  partCategory.value = p.category || 'other';
  $('motionType').value = p.motion || 'none';

  parentSelect.value =
    p.parentId == null ? '' : String(p.parentId);

  $('posX').value =
    Math.max(-300, Math.min(900, Math.round(p.x + 300)));

  $('posY').value =
    Math.max(-300, Math.min(900, Math.round(p.y + 300)));

  $('scale').value =
    Math.max(5, Math.min(800, p.scale));

  $('rotation').value =
    Math.max(-180, Math.min(180, p.rotation));

  $('sway').value = p.sway;
  $('speed').value = p.speed;

  updateValues();
}


// ★ 数値表示の更新
function updateValues() {
  [
    'posX',
    'posY',
    'scale',
    'rotation',
    'sway',
    'speed'
  ].forEach(id => {
    const el = $(id);
    const out = $(id + 'Value');

    if (out) {
      out.textContent =
        id === 'posX' || id === 'posY'
          ? Number(el.value) - 300
          : el.value;
    }
  });
}


// パーツ複製
function duplicateSelectedPart() {
  partActions.duplicateSelectedPart();
}


// 画像読み込み
async function loadImageFileToStage(file) {
  if (!file) return;

  status('画像を読み込み中…');

  try {
    const im = await loadImageFile(file);

    sourceCanvas.width = im.width;
    sourceCanvas.height = im.height;

    sourceCtx = sourceCanvas.getContext('2d');
    sourceCtx.drawImage(im, 0, 0);

    originalCanvas = cloneCanvas(sourceCanvas);
    originalCtx = originalCanvas.getContext('2d');

    state.sourceCtx = sourceCtx;
    state.originalCtx = originalCtx;

    baseImageData = canvasURL(sourceCanvas);

    parts = [];
    images.clear();
    imageLoading.clear();

    selectedId = null;
    nextId = 1;
    history.clear();

    $('hideBase').checked = false;

    view.resetAllView();

    $('artScale').value = 100;

    calculateFit();
    updateZoomLabel();
    updatePartList();
    syncEditor();
    render();

    status('画像を読み込んだよ。切り出したい部分を選んでね。');

  } catch (error) {
    console.error(error);
    status('画像を読み込めなかったよ。', 'error');
  }
}


// 四角切り抜き
function cropRect(a, b) {
  if (!sourceCanvas.width) return;

  const p1 = sourcePoint(a);
  const p2 = sourcePoint(b);

  const x = Math.max(0, Math.floor(Math.min(p1.x, p2.x)));
  const y = Math.max(0, Math.floor(Math.min(p1.y, p2.y)));

  const r = Math.min(
    sourceCanvas.width,
    Math.ceil(Math.max(p1.x, p2.x))
  );

  const bt = Math.min(
    sourceCanvas.height,
    Math.ceil(Math.max(p1.y, p2.y))
  );

  if (r - x < 2 || bt - y < 2) return;

  const c = cropRectCanvas(
    sourceCanvas,
    x,
    y,
    r - x,
    bt - y
  );

  addPart(
    '切り出しパーツ',
    c,
    x + c.width / 2,
    y + c.height / 2
  );

  status('パーツを追加したよ。');
}


// 自由切り抜き
function cropFree(points) {
  if (points.length < 3 || !sourceCanvas.width) return;

  const pts = points.map(sourcePoint);

  const result = cropFreeCanvas(sourceCanvas, pts);
  if (!result) return;

  const { canvas: c, x: minX, y: minY } = result;

  addPart(
    '自由切り抜き',
    c,
    minX + c.width / 2,
    minY + c.height / 2
  );

  status('自由切り抜きパーツを追加したよ。');
}


// 円・四角パーツ
function addShape(type) {
  const c = document.createElement('canvas');

  c.width = type === 'circle' ? 180 : 200;
  c.height = type === 'circle' ? 180 : 140;

  const cc = c.getContext('2d');
  cc.fillStyle = '#c5a5ff';

  if (type === 'circle') {
    cc.beginPath();
    cc.arc(90, 90, 75, 0, Math.PI * 2);
    cc.fill();
  } else {
    cc.fillRect(10, 10, 180, 120);
  }

  addPart(
    type === 'circle' ? '円パーツ' : '四角パーツ',
    c,
    W / 2,
    H / 2
  );
}


// PSD読み込み
async function importPSD(file) {
  if (!file) return;

  if (!window.agPsd?.readPsd) {
    status(
      'PSD読み込みライブラリを読み込めなかったよ。ページを再読み込みしてね。',
      'error'
    );
    return;
  }

  status('PSDを解析中…');
  await new Promise(r => setTimeout(r, 30));

  try {
    const psd = await readPSDFile(file);

    if (!psd.width || !psd.height) {
      throw new Error('PSDのサイズを取得できません');
    }

    sourceCanvas.width = psd.width;
    sourceCanvas.height = psd.height;

    sourceCtx = sourceCanvas.getContext('2d');

    if (psd.canvas) {
      sourceCtx.drawImage(psd.canvas, 0, 0);
      baseImageData = canvasURL(sourceCanvas);
    } else {
      baseImageData = null;
    }

    originalCanvas = cloneCanvas(sourceCanvas);
    originalCtx = originalCanvas.getContext('2d');

    state.sourceCtx = sourceCtx;
    state.originalCtx = originalCtx;

    parts = [];
    images.clear();
    imageLoading.clear();

    selectedId = null;
    nextId = 1;

    const result = createPartsFromPSD(psd, nextId);

    parts = result.parts;
    nextId = result.nextId;

    const added = parts;

    if (!added.length) {
      throw new Error(
        '画像レイヤーが見つからなかったよ。PSDが統合画像だけの可能性もあるよ。'
      );
    }

    $('hideBase').checked = true;
    selectedId = added[added.length - 1].id;

    history.clear();

    view.resetAllView();

    $('artScale').value = 100;

    calculateFit();
    updateZoomLabel();
    updatePartList();
    syncEditor();
    render();

    status(added.length + '個のレイヤーをパーツとして読み込んだよ！');

  } catch (err) {
    console.error(err);

    status(
      'PSDの読み込みに失敗：' + (err?.message || String(err)),
      'error'
    );
  }
}


// 消しゴム・復元
function brushAt(p) {
  if (!sourceCanvas.width) return;

  const q = sourcePoint(p);
  const r = brushSize / 2 / fit.scale;

  if (!Number.isFinite(r)) return;

  if (mode === 'erase') {
    eraseCanvas(sourceCtx, q.x, q.y, r);
  } else {
    restoreCanvas(
      sourceCtx,
      originalCanvas,
      q.x,
      q.y,
      r
    );
  }

  render();
}


/* ステージ操作 */
initStageEvents({
  stage,

  getMode: () => mode,
  getParts: () => parts,
  getSelected: selected,

  setSelectedId: id => {
    selectedId = id;
  },

  partScreenInfo,
  hitSelectedHandle,
  hitPart,

  saveUndo,
  updatePartList,
  syncEditor,
  render,

  stagePoint,

  getFit: () => fit,

  getViewZoom: () => viewZoom,

  setViewZoom: value => {
    viewZoom = clampZoom(value);
    updateZoomLabel();
  },

  getViewPan: () => ({
    x: viewPanX,
    y: viewPanY
  }),

  setViewPan: (x, y) => {
    viewPanX = x;
    viewPanY = y;
  },

  clampZoom,
  clampPan,
  getPinchRatio,

  worldToLocalPosition: (part, x, y) => {
    worldToLocalPositionFromModule(part, x, y, parts);
  },

  cropRect,
  cropFree,
  brushAt,

  getDrawing: () => drawing,

  setDrawing: value => {
    drawing = value;
  },

  getStartPoint: () => startPoint,

  setStartPoint: value => {
    startPoint = value;
  },

  setPreviewPoint: value => {
    previewPoint = value;
  },

  getFreePoints: () => freePoints,

  setFreePoints: value => {
    freePoints = value;
  },

  getSourceCanvas: () => sourceCanvas,

  meshEditor
});


/* ファイル読み込み */
initFileEvents({
  loadImageFileToStage,
  importPSD,
  status
});

document
  .getElementById('autoSeparate')
  .addEventListener('click', runAutoSeparation);
  

/* モード切り替え */
const modeButtons = {
  normal: $('brushOff'),
  rect: $('cropMode'),
  free: $('freeCropMode'),
  erase: $('brushErase'),
  restore: $('brushRestore'),
  mesh: $('meshMode')
};


function setModeButtons() {
  Object.entries(modeButtons).forEach(([key, button]) => {
    button.classList.toggle('active', mode === key);
  });
}


function changeMode(nextMode) {
  mode = nextMode;

  drawing = false;
  startPoint = null;
  previewPoint = null;
  freePoints = [];

  setModeButtons();
  render();
}


initModeEvents({
  changeMode,

  setBrushSize: value => {
    brushSize = value;
  }
});

setModeButtons();


/* Undo / Redo */
$('undoEdit').onclick = async () => {
  await history.undo();
  status('ひとつ戻したよ。');
};

$('redoEdit').onclick = async () => {
  await history.redo();
  status('やり直したよ。');
};


/* 表示設定 */
initViewEvents({
  render,
  setViewZoom,
  getViewZoom: () => viewZoom,
  fitView,
  resetViewOnly,

  setArtScale: value => view.setArtScale(value),

  updateZoomLabel
});


/* パーツ編集イベント */
initEditorEvents({
  $,
  selected,
  partCategory,
  parts,

  setParent: (p, value) => {
    setParentFromModule(p, value, parts);
  },

  syncEditor,
  updatePartList,
  updateValues,
  render,
  saveUndo,
  status
});


/* 削除 */
function deleteSelectedPart() {
  partActions.deleteSelectedPart();
}


/* パーツ追加・複製・削除イベント */
initPartEvents({
  addShape,
  duplicateSelectedPart,
  deleteSelectedPart
});


/* JSON保存 */
function saveProject() {
  try {
    const data = {
      version: 8,
      base: baseImageData,
      parts: parts.map(({ img, ...p }) => p),
      nextId,
      artScale
    };

    downloadBlob(
      new Blob(
        [JSON.stringify(data)],
        { type: 'application/json' }
      ),
      'mini-live2d-project.json'
    );

    status('プロジェクトを保存したよ。');

  } catch (e) {
    status('保存できなかったよ：' + e.message, 'error');
  }
}


/* JSON読み込み */
async function loadProject(e) {
  const f = e.target.files[0];
  if (!f) return;

  try {
    const data = JSON.parse(await f.text());

    parts = (data.parts || []).map(p => ({
      ...p,
      category: p.category || 'other',
      motion: p.motion || 'none',
      parentId: p.parentId ?? null,
      img: null
    }));

    images.clear();
    imageLoading.clear();

    nextId = data.nextId ||
      Math.max(0, ...parts.map(p => p.id)) + 1;

    artScale = data.artScale || 1;
    $('artScale').value = Math.round(artScale * 100);

    view.resetViewOnly();

    selectedId = parts.length
      ? parts[parts.length - 1].id
      : null;

    baseImageData = data.base || null;

    if (data.base) {
      const im = await imageFromURL(data.base);

      sourceCanvas.width = im.width;
      sourceCanvas.height = im.height;

      sourceCtx = sourceCanvas.getContext('2d');
      sourceCtx.drawImage(im, 0, 0);

      originalCanvas = cloneCanvas(sourceCanvas);
      originalCtx = originalCanvas.getContext('2d');

      state.sourceCtx = sourceCtx;
      state.originalCtx = originalCtx;

    } else {
      sourceCanvas.width = 0;
      sourceCanvas.height = 0;
    }

    collapsedParts.clear();

    updatePartList();
    syncEditor();
    render();

    status('プロジェクトを読み込んだよ。');

  } catch (err) {
    status(
      'JSONを読み込めなかったよ：' +
      (err.message || String(err)),
      'error'
    );
  }

  e.target.value = '';
}


/* PNG書き出し */
$('downloadImage').onclick = () => {
  const out = document.createElement('canvas');

  out.width = W;
  out.height = H;

  const oc = out.getContext('2d');
  oc.drawImage(stage, 0, 0);

  out.toBlob(b => {
    downloadBlob(b, 'mini-live2d.png');
  });
};


initProjectIO({
  saveProject,
  loadProject
});


/* 初期化 */
calculateFit();
updateZoomLabel();
updatePartList();
syncEditor();
render();
setModeButtons();


/* アニメーション */
const animationController = createAnimation({
  render,

  getEnabled: () => $('animation').checked,

  onTimeUpdate: time => {
    motionTime = time;
  }
});


$('animation').addEventListener('change', () => {
  if ($('animation').checked) {
    animationController.start();
  } else {
    animationController.stop();
    render();
  }
});


if ($('animation').checked) {
  animationController.start();
}


status('準備完了。画像またはPSDを読み込んでね。通常モードで指1本移動・2本指ズームができるよ。');

status('JavaScriptは動いているよ！');

})();
