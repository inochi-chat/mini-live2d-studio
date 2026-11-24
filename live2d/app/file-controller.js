
// ファイル処理を管理
export function createFileController(options = {}) {
  const {
    loadImageFile,
    importPSD
  } = options;

  // 画像ファイルを読み込む
  async function loadImage(file) {
    if (!file || !loadImageFile) return;
    await loadImageFile(file);
  }

  // PSDファイルを読み込む
  async function loadPSD(file) {
    if (!file || !importPSD) return;
    await importPSD(file);
  }

  return {
    loadImage,
    loadPSD
  };
}
