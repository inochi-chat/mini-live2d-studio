
let modelPromise = null;

export async function separateCharacter(sourceCanvas, onProgress = () => {}) {
  if (!sourceCanvas || !sourceCanvas.width || !sourceCanvas.height) {
    throw new Error('読み込まれた画像が見つからないよ。');
  }

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
          { dtype: 'q8' }
        );
      })().catch(error => {
        modelPromise = null;
        throw error;
      });
    }

    const segmenter = await modelPromise;

    onProgress('イラストを解析しています…');

    const imageData = await new Promise((resolve, reject) => {
      sourceCanvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('画像データを作成できなかったよ。'));
      }, 'image/png');
    });

    const result = await segmenter(
      await createImageBitmap(imageData)
    );

    if (!result || !result[0]) {
      throw new Error('画像の解析結果を取得できなかったよ。');
    }

    const output = result[0];

    let source;

    if (typeof output.toCanvas === 'function') {
      source = output.toCanvas();
    } else if (output instanceof Blob) {
      source = await createImageBitmap(output);
    } else {
      source = output;
    }

    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;

    const ctx = canvas.getContext('2d');

    if (source instanceof ImageData) {
      ctx.putImageData(source, 0, 0);
    } else if (source.data && !('getContext' in source)) {
      const image = new ImageData(
        new Uint8ClampedArray(source.data),
        source.width,
        source.height
      );
      ctx.putImageData(image, 0, 0);
    } else {
      ctx.drawImage(source, 0, 0);
    }

    if (typeof canvas.toDataURL !== 'function') {
      throw new Error('通常のCanvasへの変換に失敗したよ。');
    }

    onProgress('解析が完了したよ！');

    return canvas;

  } catch (error) {
    console.error('自動パーツ分けエラー:', error);
    throw error;
  }
}
