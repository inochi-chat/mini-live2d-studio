export async function readPSDFile(file) {
  if (!file) {
    throw new Error('PSDファイルが選択されていません');
  }

  if (!window.agPsd?.readPsd) {
    throw new Error(
      'PSD読み込みライブラリを読み込めませんでした'
    );
  }

  const buffer = await file.arrayBuffer();

  const psd = window.agPsd.readPsd(buffer, {
    skipThumbnail: true
  });

  if (!psd.width || !psd.height) {
    throw new Error('PSDのサイズを取得できません');
  }

  return psd;
}
