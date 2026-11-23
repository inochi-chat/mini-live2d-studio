export function initFileEvents({
  loadImageFileToStage,
  importPSD,
  status
}) {
  const imageFile = document.getElementById('imageFile');
  const psdFile = document.getElementById('psdFile');

  imageFile.addEventListener('change', e => {
    const file = e.target.files?.[0];

    if (!file) {
      status('ファイルが選択されていません', 'error');
      return;
    }

    status('ファイルを選択したよ：' + file.name);
    loadImageFileToStage(file);

    e.target.value = '';
  });

  psdFile.addEventListener('change', e => {
    const file = e.target.files?.[0];

    if (!file) {
      status('PSDファイルが選択されていません', 'error');
      return;
    }

    status('PSDを選択：' + file.name);
    importPSD(file);

    e.target.value = '';
  });
}
