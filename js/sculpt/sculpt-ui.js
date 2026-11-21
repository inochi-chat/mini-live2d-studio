
export function createSculptUI({
  sculptBrush,
  subdivideTool,
  updateDebugPanel
}) {
  let sculptEnabled = false;

  function connectButton(id, mode, message) {
    const button = document.getElementById(id);

    if (!button) return;

    button.addEventListener("click", () => {
      sculptBrush.setMode(mode);
      updateDebugPanel(message);
    });
  }

  // スカルプト開始・終了
  const toggleButton =
    document.getElementById("sculptToggleButton");

  if (toggleButton) {
    toggleButton.addEventListener("click", () => {
      sculptEnabled = !sculptEnabled;

      sculptBrush.setEnabled(sculptEnabled);

      toggleButton.textContent = sculptEnabled
        ? "スカルプト終了"
        : "スカルプト開始";
    });
  }

  // 基本ブラシ
  connectButton(
    "sculptRaiseButton",
    "raise",
    "盛り上げブラシを選択"
  );

  connectButton(
    "sculptLowerButton",
    "lower",
    "へこませブラシを選択"
  );

  connectButton(
    "sculptSmoothButton",
    "smooth",
    "なめらかブラシを選択"
  );

  connectButton(
    "sculptGrabButton",
    "grab",
    "つまむブラシを選択"
  );

  connectButton(
    "sculptInflateButton",
    "inflate",
    "膨らませるブラシを選択"
  );

  connectButton(
    "sculptFlattenButton",
    "flatten",
    "平らにするブラシを選択"
  );

  // 追加ブラシ
  connectButton(
    "sculptClayButton",
    "clay",
    "粘土ブラシを選択"
  );

  connectButton(
    "sculptPinchButton",
    "pinch",
    "ピンチブラシを選択"
  );

  connectButton(
    "sculptCreaseButton",
    "crease",
    "溝彫りブラシを選択"
  );

  connectButton(
    "sculptMaskButton",
    "mask",
    "マスクブラシを選択"
  );

  connectButton(
    "sculptUnmaskButton",
    "unmask",
    "マスク解除ブラシを選択"
  );

  // マスク操作
  const clearMaskButton =
    document.getElementById("sculptClearMaskButton");

  if (clearMaskButton) {
    clearMaskButton.addEventListener("click", () => {
      sculptBrush.clearMask();
      updateDebugPanel("マスクをすべて解除しました");
    });
  }

  const invertMaskButton =
    document.getElementById("sculptInvertMaskButton");

  if (invertMaskButton) {
    invertMaskButton.addEventListener("click", () => {
      sculptBrush.invertMask();
      updateDebugPanel("マスクを反転しました");
    });
  }

  // ブラシサイズ
  const radiusInput =
    document.getElementById("sculptRadius");

  if (radiusInput) {
    sculptBrush.setRadius(radiusInput.value);

    radiusInput.addEventListener("input", () => {
      sculptBrush.setRadius(radiusInput.value);
    });
  }

  // ブラシの強さ
  const strengthInput =
    document.getElementById("sculptStrength");

  if (strengthInput) {
    sculptBrush.setStrength(strengthInput.value);

    strengthInput.addEventListener("input", () => {
      sculptBrush.setStrength(strengthInput.value);
    });
  }

  // 細分化
  const subdivideButton =
    document.getElementById("subdivideButton");

  const subdivideLevel =
    document.getElementById("subdivideLevel");

  if (subdivideButton) {
    subdivideButton.addEventListener("click", () => {
      const level = subdivideLevel
        ? Number(subdivideLevel.value)
        : 1;

      subdivideTool.subdivideSelectedObject(level);
    });
  }

  return {
    setEnabled(value) {
      sculptEnabled = Boolean(value);
      sculptBrush.setEnabled(sculptEnabled);

      if (toggleButton) {
        toggleButton.textContent = sculptEnabled
          ? "スカルプト終了"
          : "スカルプト開始";
      }
    }
  };
}
