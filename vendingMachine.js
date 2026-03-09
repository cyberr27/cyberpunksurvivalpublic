// vendingMachine.js
// Логика автомата с водой в стиле киберпанк-нуара

// Изображение автомата
const vendingMachineImage = new Image();
vendingMachineImage.src = "vending_machine.png"; // Укажи путь к твоему изображению (110x90)

// Координаты автомата на карте (выбери место, где он не пересекается с препятствиями)
const VENDING_MACHINE = {
  x: 600,
  y: 2350,
  width: 110,
  height: 90,
};

// Состояние меню автомата
let isVendingMenuOpen = false;

// Элемент меню
let vendingMenu = null;

// Инициализация автомата
function initializeVendingMachine() {
  // Добавляем стили для меню
  const vendingStyles = `
    .vending-menu {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, rgba(10, 10, 10, 0.95), rgba(20, 20, 20, 0.9));
      border: 2px solid #00ffff;
      border-radius: 10px;
      padding: 20px;
      color: #00ffff;
      font-family: "Courier New", monospace;
      text-align: center;
      z-index: 1000;
      max-width: 350px;
      width: 90%;
      box-shadow: 0 0 20px rgba(0, 255, 255, 0.5), 0 0 30px rgba(255, 0, 255, 0.3);
      animation: neonPulse 2s infinite alternate;
    }
    .vending-title {
      color: #00ffff;
      font-size: 24px;
      text-shadow: 0 0 5px #00ffff, 0 0 10px #ff00ff;
      margin-bottom: 15px;
    }
    .vending-item {
      background: rgba(0, 0, 0, 0.85);
      padding: 12px;
      margin: 8px 0;
      cursor: pointer;
      border: 1px solid #00ffff;
      border-radius: 5px;
      color: #00ffff;
      font-size: 14px;
      text-shadow: 0 0 5px rgba(0, 255, 255, 0.7);
      box-shadow: 0 0 8px rgba(0, 255, 255, 0.3);
      transition: all 0.3s ease;
    }
    .vending-item:hover {
      background: rgba(0, 255, 255, 0.15);
      border-color: #ff00ff;
      box-shadow: 0 0 15px rgba(255, 0, 255, 0.7);
      transform: translateX(5px);
    }
    .vending-error {
      color: #ff00ff;
      font-size: 12px;
      margin-top: 10px;
    }
    @media (max-width: 500px) {
      .vending-menu {
        max-width: 90%;
        padding: 15px;
      }
      .vending-title {
        font-size: 20px;
      }
      .vending-item {
        padding: 10px;
        font-size: 12px;
      }
    }
  `;
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = vendingStyles;
  document.head.appendChild(styleSheet);
}

// Проверка близости к автомату
function checkVendingMachineProximity() {
  if (window.worldSystem.currentWorldId !== 0) return; // Проверяем только в мире id: 0
  const me = players.get(myId);
  if (!me) return;

  const dx = me.x + 20 - (VENDING_MACHINE.x + VENDING_MACHINE.width / 2);
  const dy = me.y + 20 - (VENDING_MACHINE.y + VENDING_MACHINE.height / 2);
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < 50 && !isVendingMenuOpen) {
    showVendingMenu();
  } else if (distance >= 50 && isVendingMenuOpen) {
    hideVendingMenu();
  }
}

// Показать меню автомата
function showVendingMenu() {
  isVendingMenuOpen = true;
  vendingMenu = document.createElement("div");
  vendingMenu.className = "vending-menu";
  vendingMenu.innerHTML = `
    <h2 class="vending-title">Автомат с водой</h2>
    <div class="vending-item" data-option="large">Большой стакан воды: [2 баляра | + 50 воды.]</div>
    <div class="vending-item" data-option="small">Маленький стакан воды: [1 баляр | + 20 воды.]</div>
    <p id="vendingError" class="vending-error"></p>
  `;
  document.body.appendChild(vendingMenu);

  const items = vendingMenu.querySelectorAll(".vending-item");
  items.forEach((item) => {
    item.addEventListener("click", () =>
      handleVendingOption(item.dataset.option),
    );
  });
}

// Скрыть меню автомата
function hideVendingMenu() {
  if (vendingMenu) {
    vendingMenu.remove();
    vendingMenu = null;
    isVendingMenuOpen = false;
  }
}

// Обработка выбора опции
function handleVendingOption(option) {
  const me = players.get(myId);
  if (!me) return;

  let cost, waterGain;
  if (option === "large") {
    cost = 2;
    waterGain = 50;
  } else if (option === "small") {
    cost = 1;
    waterGain = 20;
  } else {
    return;
  }

  // Проверяем наличие баляр
  const balyarySlot = inventory.findIndex(
    (slot) => slot && slot.type === "balyary",
  );
  const balyaryCount =
    balyarySlot !== -1 ? inventory[balyarySlot].quantity || 1 : 0;

  const errorEl = document.getElementById("vendingError");
  if (balyaryCount < cost) {
    errorEl.textContent = "Недостаточно баляр!";
    return;
  }

  // Отправляем запрос на сервер
  sendWhenReady(
    ws,
    JSON.stringify({
      type: "buyWater",
      option,
      cost,
      waterGain,
    }),
  );
}

// Отрисовка автомата
function drawVendingMachine() {
  if (window.worldSystem.currentWorldId !== 0) return; // Отрисовываем только в мире id: 0
  if (vendingMachineImage.complete) {
    const camera = window.movementSystem.getCamera(); // Получаем камеру из movement.js
    const screenX = VENDING_MACHINE.x - camera.x;
    const screenY = VENDING_MACHINE.y - camera.y;
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
}

// Экспорт функций для использования в code.js
window.vendingMachine = {
  initialize: initializeVendingMachine,
  checkProximity: checkVendingMachineProximity,
  draw: drawVendingMachine,
  hideVendingMenu: hideVendingMenu, // Добавляем экспорт функции
};
