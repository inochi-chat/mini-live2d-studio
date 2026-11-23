
import {
  clampZoom
} from './interaction.js';

export function createView({
  W,
  H,
  getSourceCanvas,
  render,
  updateZoomLabel
}) {
  let viewZoom = 1;
  let viewPanX = 0;
  let viewPanY = 0;
  let artScale = 1;

  let fit = {
    scale: 1,
    ox: 0,
    oy: 0
  };

  function calculateFit() {
    const sourceCanvas = getSourceCanvas();

    if (!sourceCanvas.width || !sourceCanvas.height) {
      fit = {
        scale: 1,
        ox: 0,
        oy: 0
      };
      return fit;
    }

    const base = Math.min(
      W / sourceCanvas.width,
      H / sourceCanvas.height
    ) * viewZoom;

    const s = base * artScale;

    fit = {
      scale: s,
      ox: (W - sourceCanvas.width * s) / 2 + viewPanX,
      oy: (H - sourceCanvas.height * s) / 2 + viewPanY
    };

    return fit;
  }

  function setViewZoom(value) {
    viewZoom = clampZoom(value);
    updateZoomLabel();
    render();
  }

  function resetViewOnly() {
    viewZoom = 1;
    viewPanX = 0;
    viewPanY = 0;

    updateZoomLabel();
    render();
  }

  function fitView() {
    resetViewOnly();
  }

  function setArtScale(value) {
    artScale = value;
  }

  function getFit() {
    return fit;
  }

  function getViewZoom() {
    return viewZoom;
  }

  function getViewPan() {
    return {
      x: viewPanX,
      y: viewPanY
    };
  }

  function setViewPan(x, y) {
    viewPanX = x;
    viewPanY = y;
  }

  function setViewZoomFromGesture(value) {
    viewZoom = clampZoom(value);
    updateZoomLabel();
  }

  function getArtScale() {
    return artScale;
  }

  function setArtScaleFromProject(value) {
    artScale = value;
  }

  function resetViewState() {
    viewZoom = 1;
    viewPanX = 0;
    viewPanY = 0;
    artScale = 1;

    updateZoomLabel();
  }

  function updateLabel() {
    updateZoomLabel();
  }

  return {
    calculateFit,
    setViewZoom,
    resetViewOnly,
    fitView,
    setArtScale,
    getFit,
    getViewZoom,
    getViewPan,
    setViewPan,
    setViewZoomFromGesture,
    getArtScale,
    setArtScaleFromProject,
    resetViewState,
    updateLabel
  };
}
