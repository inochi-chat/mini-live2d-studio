
export function initModeEvents({ changeMode, setBrushSize }) {
  const modes = {
    brushOff: 'normal',
    cropMode: 'rect',
    freeCropMode: 'free',
    brushErase: 'erase',
    brushRestore: 'restore',
    meshMode: 'mesh'
  };

  Object.entries(modes).forEach(([id, mode]) => {
    const button = document.getElementById(id);

    if (!button) return;

    button.addEventListener('click', () => {
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
