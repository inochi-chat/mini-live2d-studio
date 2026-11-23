export function initModeEvents({
  changeMode,
  setBrushSize
}) {
  const modes = {
    brushOff: 'normal',
    cropMode: 'rect',
    freeCropMode: 'free',
    brushErase: 'erase',
    brushRestore: 'restore'
  };

  Object.entries(modes).forEach(([id, mode]) => {
    document.getElementById(id).addEventListener('click', () => {
      changeMode(mode);
    });
  });

  const brushSize = document.getElementById('brushSize');
  const brushValue = document.getElementById('brushValue');

  brushSize.addEventListener('input', e => {
    const value = Number(e.target.value);
    brushValue.textContent = value;
    setBrushSize(value);
  });
}
