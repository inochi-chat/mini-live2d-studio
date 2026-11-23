
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

    const imageData = sourceCanvas.toDataURL('image/png');
    const result = await segmenter(imageData);

    if (!result || !result[0]) {
      throw new Error('画像の解析結果を取得できなかったよ。');
    }

    const canvas = result[0].toCanvas();

    onProgress('解析が完了したよ！');

    return canvas;

  } catch (error) {
    console.error('自動パーツ分けエラー:', error);
    throw error;
  }
}
