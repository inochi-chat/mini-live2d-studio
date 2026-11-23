
export function initViewEvents({
  render,
  setViewZoom,
  getViewZoom,
  fitView,
  resetViewOnly,
  setArtScale,
  updateZoomLabel
}) {
  document.getElementById('hideBase').onchange = render;

  document.getElementById('zoomIn').onclick = () => {
    setViewZoom(getViewZoom() * 1.2);
  };

  document.getElementById('zoomOut').onclick = () => {
    setViewZoom(getViewZoom() / 1.2);
  };

  document.getElementById('fitView').onclick = fitView;
  document.getElementById('resetView').onclick = resetViewOnly;

  document.getElementById('artScale').oninput = e => {
    setArtScale(Number(e.target.value) / 100);
    updateZoomLabel();
    render();
  };
}
