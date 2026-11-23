
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
  // キャンバスの表示位置と倍率を計算
  function calculateFit() {
    const sourceCanvas = getSourceCanvas();

    if (!sourceCanvas.width || !sourceCanvas.height) {
      const fit = {
        scale: 1,
        ox: 0,
        oy: 0
      };

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

  // 表示倍率を変更
  function setViewZoom(value) {
    setViewZoomState(clampZoom(value));
    updateZoomLabel();
  }

  // 表示位置と表示倍率だけをリセット
  function resetViewOnly() {
    setViewZoomState(1);
    setViewPanState(0, 0);
    updateZoomLabel();
  }

  // 画面に合わせる
  function fitView() {
    resetViewOnly();
  }

  // イラスト自体の倍率を変更
  function setArtScale(value) {
    setArtScaleState(value);
  }

  // 表示倍率・位置・イラスト倍率をすべてリセット
  function resetAllView() {
    setViewZoomState(1);
    setViewPanState(0, 0);
    setArtScaleState(1);
    updateZoomLabel();
  }

  return {
    calculateFit,
    setViewZoom,
    resetViewOnly,
    fitView,
    setArtScale,
    resetAllView
  };
}
