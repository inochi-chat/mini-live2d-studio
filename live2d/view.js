
import { clampZoom } from './interaction.js';

export function createView({
  W,
  H,
  getSourceCanvas,
  getViewZoom,
  getViewPan,
  getArtScale,
  setViewZoomState,
  setViewPanState,
  setArtScaleState,
  setFit,
  updateZoomLabel
}) {
  function calculateFit() {
    const sourceCanvas = getSourceCanvas();

    if (!sourceCanvas.width || !sourceCanvas.height) {
      const fit = { scale: 1, ox: 0, oy: 0 };
      setFit(fit);
      return fit;
    }

    const zoom = getViewZoom();
    const pan = getViewPan();
    const artScale = getArtScale();

    const base = Math.min(
      W / sourceCanvas.width,
      H / sourceCanvas.height
    ) * zoom;

    const scale = base * artScale;

    const fit = {
      scale,
      ox: (W - sourceCanvas.width * scale) / 2 + pan.x,
      oy: (H - sourceCanvas.height * scale) / 2 + pan.y
    };

    setFit(fit);
    return fit;
  }

  function setViewZoom(value) {
    setViewZoomState(clampZoom(value));
    updateZoomLabel();
  }

  function resetViewOnly() {
    setViewZoomState(1);
    setViewPanState(0, 0);
    updateZoomLabel();
  }

  function fitView() {
    resetViewOnly();
  }

  function setArtScale(value) {
    setArtScaleState(value);
  }

  return {
    calculateFit,
    setViewZoom,
    resetViewOnly,
    fitView,
    setArtScale
  };
}
