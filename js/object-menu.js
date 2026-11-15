
export function showObjectMenu(onAdd) {
  document.getElementById("addMenu")?.remove();

  const menu = document.createElement("div");
  menu.id = "addMenu";

  menu.style.cssText = `
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: 20px;
    z-index: 99999;
    max-height: 70vh;
    overflow-y: auto;
    padding: 16px;
    border-radius: 16px;
    background: #292b40;
    border: 1px solid #7770ae;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  `;

  const types = [
    ["cube", "立方体"],
    ["sphere", "球"],
    ["cylinder", "円柱"],
    ["cone", "円錐"],
    ["plane", "平面"],
    ["torus", "ドーナツ"],

    ["triangularPrism", "三角柱"],
    ["squarePrism", "四角柱"],
    ["hexagonalPrism", "六角柱"],
    ["triangularPyramid", "三角錐"],
    ["squarePyramid", "四角錐"],
    ["octahedron", "八面体"]
  ];

  types.forEach(([type, label]) => {
    const button = document.createElement("button");
    button.textContent = label;

    button.style.cssText = `
      min-height: 48px;
      border: 1px solid #8c7bd1;
      border-radius: 10px;
      background: #51417c;
      color: white;
      font-size: 13px;
      padding: 8px;
    `;

    button.addEventListener("click", () => {
      onAdd?.(type);
      menu.remove();
    });

    menu.appendChild(button);
  });

  const close = document.createElement("button");
  close.textContent = "閉じる";
  close.style.gridColumn = "1 / -1";

  close.addEventListener("click", () => menu.remove());

  menu.appendChild(close);
  document.body.appendChild(menu);
}
