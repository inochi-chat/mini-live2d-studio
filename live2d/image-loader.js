export function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('画像ファイルが選択されていません'));
      return;
    }

    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('画像を読み込めませんでした'));
    };

    image.src = url;
  });
}
