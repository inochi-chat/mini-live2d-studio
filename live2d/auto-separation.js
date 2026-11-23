
let modelPromise = null;

export async function separateCharacter(sourceCanvas, onProgress = () => {}) {
  if (!sourceCanvas || !sourceCanvas.width || !sourceCanvas.height) {
    throw new Error('読み込まれた画像が見つからないよ。');
  }

  let imageUrl = null;

  try {
    if (!modelPromise) {
      modelPromise = (async () => {
        onProgress('AIモデルを読み込んでいます…');

        const { pipeline } = await import(
          'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1'
        );

        return await pipeline(
          'background-removal',
          'Xenova/modnet',
          { dtype: 'fp32' }
        );
      })().catch(error => {
        modelPromise = null;
        throw error;
      });
    }

    const segmenter = await modelPromise;

    onProgress('画像を準備しています…');

    const blob = await new Promise((resolve, reject) => {
      sourceCanvas.toBlob(result => {
        if (result) resolve(result);
        else reject(new Error('画像データを作成できなかったよ。'));
      }, 'image/png');
    });

    imageUrl = URL.createObjectURL(blob);

    onProgress('AIで背景を解析しています…');

    const result = await segmenter(imageUrl);

    if (!result || !result[0]) {
      throw new Error('解析結果が見つからなかったよ。');
    }

    const output = result[0];

    if (typeof output.toBlob !== 'function') {
      throw new Error('AIの出力画像を取得できなかったよ。');
    }

    onProgress('画像を変換しています…');

    const outputBlob = await output.toBlob();

    if (!outputBlob) {
      throw new Error('変換後の画像が空だったよ。');
    }

    const bitmap = await createImageBitmap(outputBlob);

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvasを作成できなかったよ。');
    }

    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    onProgress('解析が完了したよ！');

    return canvas;

  } catch (error) {
    console.error('自動パーツ分けエラー:', error);
    throw error;

  } finally {
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
  }
}
