
export function showObjectMenu(onAdd, mode = "object") {
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

  const heading = document.createElement("div");
  heading.textContent =
    mode === "character" ? "キャラクター人体パーツ" : "図形を追加";

  heading.style.cssText = `
    grid-column: 1 / -1;
    color: white;
    font-size: 16px;
    font-weight: bold;
    margin-bottom: 6px;
  `;

  menu.appendChild(heading);

  const objectTypes = [
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

  const characterTypes = [
    ["head", "頭"],
    ["neck", "首"],
    ["torso", "胴体"],
    ["upperArmL", "左上腕"],
    ["upperArmR", "右上腕"],
    ["forearmL", "左前腕"],
    ["forearmR", "右前腕"],
    ["handL", "左手"],
    ["handR", "右手"],
    ["thighL", "左太もも"],
    ["thighR", "右太もも"],
    ["lowerLegL", "左すね"],
    ["lowerLegR", "右すね"],
    ["footL", "左足"],
    ["footR", "右足"],
    ["hair", "髪"]
  ];

  const types = mode === "character"
    ? characterTypes
    : objectTypes;

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
  close.style.cssText = `
    grid-column: 1 / -1;
    min-height: 42px;
    border-radius: 10px;
  `;

  close.addEventListener("click", () => menu.remove());

  menu.appendChild(close);
  document.body.appendChild(menu);
}
