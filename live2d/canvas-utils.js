export const canvasURL = canvas =>
  canvas.toDataURL('image/png');

export function cloneCanvas(canvas) {
  const copy = document.createElement('canvas');

  copy.width = canvas.width;
  copy.height = canvas.height;

  copy.getContext('2d').drawImage(canvas, 0, 0);

  return copy;
}

export function imageFromURL(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error('画像データを開けません'));

    image.src = url;

    if (image.complete && image.naturalWidth) {
      resolve(image);
    }
  });
}
