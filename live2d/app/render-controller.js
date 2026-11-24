
import { renderStage } from '../render.js?v=2';

// 描画処理を管理
export function createRenderController(options = {}) {
  const {
    ctx,
    calculateFit,
    preparePartImages,
    getRenderOptions,
    getImages
  } = options;

  // 画像キャッシュを描画用Mapに変換
  function createImageMap() {
    const imageMap = new Map();
    const images = getImages?.();

    if (!images) return imageMap;

    images.forEach((entry, id) => {
      if (entry?.image) {
        imageMap.set(id, entry.image);
      }
    });

    return imageMap;
  }

  // ステージを描画
  function render() {
    calculateFit?.();
    preparePartImages?.();

    const renderOptions = getRenderOptions?.() || {};

    renderStage(ctx, {
      ...renderOptions,
      images: createImageMap()
    });
  }

  return {
    render
  };
}
