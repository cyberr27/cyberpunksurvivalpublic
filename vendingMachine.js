// vendingMachine.js — обновлённая версия с NPC-style диалогом
const vendingMachineImage = new Image();
vendingMachineImage.src = "vending_machine.png";

const VENDING_MACHINE = {
  x: 1420,
  y: 3550,
  width: 110,
  height: 90,
};

let isVendingDialogOpen = false;
let vendingDialog = null;
let stylesLoaded = false;

function loadVendingStyles() {
  if (stylesLoaded) return;
  stylesLoaded = true;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "vendingStyle.css"; // предполагаем, что файл лежит в корне
  document.head.appendChild(link);
  console.log("[VendingMachine] Styles loaded: vendingStyle.css");
}

function initializeVendingMachine() {
  loadVendingStyles();
  console.log("[VendingMachine] Initialized with external CSS");
}

function checkVendingMachineProximity() {
  if (window.worldSystem.currentWorldId !== 0) return;
  const me = players.get(myId);
  if (!me) return;

  const dx = me.x + 20 - (VENDING_MACHINE.x + VENDING_MACHINE.width / 2);
  const dy = me.y + 20 - (VENDING_MACHINE.y + VENDING_MACHINE.height / 2);
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 50 && !isVendingDialogOpen) {
    showVendingDialog();
  } else if (distance >= 50 && isVendingDialogOpen) {
    hideVendingDialog();
  }
}

function showVendingDialog() {
  if (isVendingDialogOpen) return;
  isVendingDialogOpen = true;

  vendingDialog = document.createElement("div");
  vendingDialog.className = "vending-dialog"; // комбинируем классы

  // Только backgroundImage оставляем inline (уникально для автомата)
  vendingDialog.style.backgroundImage = "url('vending_machine_bg.png')";
  vendingDialog.style.backgroundSize = "cover";
  vendingDialog.style.backgroundPosition = "center";

  vendingDialog.innerHTML = `
    <div class="npc-dialog-content">
        <div class="vending-option vending-small-npc-button" data-option="small">
        </div>
        <div class="vending-option vending-large-npc-button" data-option="large">
        </div>  
    </div>
    <p id="vendingError"></p>
  `;

  document.body.appendChild(vendingDialog);

  vendingDialog.querySelectorAll(".vending-option").forEach((opt) => {
    opt.addEventListener("click", () =>
      handleVendingOption(opt.dataset.option),
    );
  });
}

function hideVendingDialog() {
  if (vendingDialog) {
    vendingDialog.remove();
    vendingDialog = null;
  }
  isVendingDialogOpen = false;
}

function handleVendingOption(option) {
  const me = players.get(myId);
  if (!me) return;

  // Убираем локальную проверку — сервер теперь всё решает и шлёт notification
  sendWhenReady(
    ws,
    JSON.stringify({
      type: "buyWater",
      option,
    }),
  );
}

function drawVendingMachineSprite(camX, camY) {
  if (window.worldSystem.currentWorldId !== 0) return;
  if (!vendingMachineImage.complete) return;

  const screenX = VENDING_MACHINE.x - camX;
  const screenY = VENDING_MACHINE.y - camY;

  if (
    screenX + VENDING_MACHINE.width > 0 &&
    screenX < canvas.width &&
    screenY + VENDING_MACHINE.height > 0 &&
    screenY < canvas.height
  ) {
    ctx.drawImage(
      vendingMachineImage,
      screenX,
      screenY,
      VENDING_MACHINE.width,
      VENDING_MACHINE.height,
    );
  }
}

function drawVendingMachine() {
  const cam = window.movementSystem.getCamera();
  drawVendingMachineSprite(cam.x, cam.y);
}

function getVendingMachineRenderData() {
  if (
    window.worldSystem?.currentWorldId !== 0 ||
    !vendingMachineImage.complete ||
    vendingMachineImage.naturalWidth <= 0 ||
    vendingMachineImage.naturalHeight <= 0
  ) {
    return null;
  }

  return {
    id: "vendingMachine",
    type: "npc",
    visualType: "billboard",

    // Те же мировые координаты, что в 2D.
    x: VENDING_MACHINE.x,
    y: VENDING_MACHINE.y,

    worldId: 0,

    sprite: vendingMachineImage,

    // Автомат использует одиночное изображение.
    frame: 0,
    row: 0,
    frameCount: 1,

    frameWidth: vendingMachineImage.naturalWidth,
    frameHeight: vendingMachineImage.naturalHeight,

    displayWidth: VENDING_MACHINE.width,
    displayHeight: VENDING_MACHINE.height,
  };
}

window.vendingMachine = {
  initialize: initializeVendingMachine,
  checkProximity: checkVendingMachineProximity,

  // Данные для общего 3D billboard-рендерера.
  getRenderData: getVendingMachineRenderData,

  getPosition() {
    return { x: VENDING_MACHINE.x, y: VENDING_MACHINE.y };
  },

  drawSprite(camX, camY) {
    drawVendingMachineSprite(camX, camY);
  },

  draw: drawVendingMachine,
  hideVendingMenu: hideVendingDialog,
};

(function registerVendingMachineVisualProvider() {
  "use strict";

  function registerVendingMachine3D() {
    const scene = window.sceneEntitySystem;
    const vending = window.vendingMachine;

    if (
      typeof scene?.registerNPCVisualProvider !== "function" ||
      typeof scene?.getRegisteredNPCIds !== "function" ||
      typeof vending?.getRenderData !== "function"
    ) {
      console.error(
        "[VendingMachine3D] Required visual provider API is unavailable.",
      );

      return false;
    }

    const id = "vendingMachine";

    // Защита от повторной регистрации.
    if (scene.getRegisteredNPCIds().includes(id)) {
      return true;
    }

    // Контракт реестра: объект с методом getRenderData().
    const success = scene.registerNPCVisualProvider(id, {
      getRenderData() {
        return vending.getRenderData();
      },
    });

    if (!success) {
      console.error("[VendingMachine3D] Failed to register visual provider.");

      return false;
    }

    console.log("[VendingMachine3D] Visual provider registered successfully.");

    return true;
  }

  if (!registerVendingMachine3D()) {
    window.addEventListener("load", registerVendingMachine3D, { once: true });
  }
})();
