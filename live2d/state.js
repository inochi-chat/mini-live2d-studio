export const state = {
  stage: null,
  ctx: null,
  W: 0,
  H: 0,

  sourceCanvas: document.createElement('canvas'),
  sourceCtx: null,

  originalCanvas: document.createElement('canvas'),
  originalCtx: null,

  baseImageData: null,
  parts: [],
  selectedId: null,
  nextId: 1,

  mode: 'normal',
  brushSize: 24,
  drawing: false,
  startPoint: null,
  freePoints: [],
  lastPointer: null,

  undoStack: [],
  redoStack: [],

  animFrame: 0,
  raf: null,
  motionTime: 0,
  lastTick: 0,

  fit: {
    scale: 1,
    ox: 0,
    oy: 0
  },

  viewZoom: 1,
  viewPanX: 0,
  viewPanY: 0,
  artScale: 1,

  viewPointers: new Map(),
  gesture: null,
  dragAction: null,

  collapsedParts: new Set()
};
