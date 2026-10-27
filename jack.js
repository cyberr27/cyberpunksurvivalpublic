// jack.js (торговец, брат John) — Полная рабочая версия с скупкой
const JACK = {
  x: 1634,
  y: 915,
  width: 90,
  height: 90,
  spriteWidth: 70,
  spriteHeight: 70,
  interactionRadius: 50,
  name: "Jack",
};

let isJackDialogOpen = false;
let jackDialogStage = "greeting";
let isJackMet = false;
let jackSprite = null;

// Анимация
let jackFrame = 0;
let jackFrameTime = 0;
const JACK_FRAME_DURATION = 500;
const JACK_FRAMES_PER_ROW = 13;
const JACK_ANIMATION_ROW1_DURATION = 13 * JACK_FRAME_DURATION;
const JACK_ANIMATION_ROW2_IDLE_DURATION = 8000;

let jackCurrentAnimationPhase = "idle";
let jackPhaseTimer = 0;

// Кнопки над Джеком
let jackButtonsContainer = null;
let isPlayerNearJack = false;

// КРИТИЧНО: Флаг для предотвращения повторного показа приветствия
let hasJackGreetingBeenShown = false;

// Переменные для скупки
let selectedBuybackSlot = null;

// Инициализация стилей (подключаем jack.css)
function initializeJackStyles() {
  if (!document.getElementById("jackStylesLink")) {
    const link = document.createElement("link");
    link.id = "jackStylesLink";
    link.rel = "stylesheet";
    link.href = "jack.css";
    document.head.appendChild(link);
  }
}

// Создание кнопок (3 кнопки: Говорить, Магазин, Скупка)
function createJackButtons(screenX, screenY) {
  if (jackButtonsContainer) document.body.removeChild(jackButtonsContainer);

  jackButtonsContainer = document.createElement("div");
  jackButtonsContainer.className = "jack-buttons-container";

  const zoom = window.movementSystem?.getZoom?.() || 1;
  const totalButtonsHeight = 45 * 3 + 16 * 2; // 3 кнопки
  jackButtonsContainer.style.left = (screenX + JACK.width / 2) * zoom + "px";
  jackButtonsContainer.style.top =
    (screenY - 25) * zoom - totalButtonsHeight + "px";
  jackButtonsContainer.style.transform = "translateX(-50%)";

  // КНОПКА 1: Говорить
  const talkBtn = document.createElement("div");
  talkBtn.className = "jack-button-talk";
  talkBtn.addEventListener("click", openJackTalkDialog);
  jackButtonsContainer.appendChild(talkBtn);

  // КНОПКА 2: Магазин
  const shopBtn = document.createElement("div");
  shopBtn.className = "jack-button-shop";
  shopBtn.addEventListener("click", openJackShopDialog);
  jackButtonsContainer.appendChild(shopBtn);

  // КНОПКА 3: СКУПКА (НОВАЯ)
  const buybackBtn = document.createElement("div");
  buybackBtn.className = "jack-button-buyback";
  buybackBtn.addEventListener("click", openJackBuybackDialog);
  jackButtonsContainer.appendChild(buybackBtn);

  document.body.appendChild(jackButtonsContainer);
}

function removeJackButtons() {
  if (jackButtonsContainer) {
    document.body.removeChild(jackButtonsContainer);
    jackButtonsContainer = null;
  }
}

function updateJackButtonsPosition() {
  if (!isPlayerNearJack || !jackButtonsContainer) {
    return;
  }

  if (window.worldSystem?.currentWorldId !== 0) {
    return;
  }

  const camera = window.movementSystem?.getCamera?.();

  if (!camera) return;

  const zoom = window.movementSystem?.getZoom?.() || 1;

  const screenX = JACK.x - camera.x;
  const screenY = JACK.y - camera.y;

  const totalButtonsHeight = 45 * 3 + 16 * 2;

  jackButtonsContainer.style.left = (screenX + JACK.width / 2) * zoom + "px";

  jackButtonsContainer.style.top =
    (screenY - 25) * zoom - totalButtonsHeight + "px";
}

// НОВЫЕ ФУНКЦИИ ДЛЯ КНОПОК
function openJackTalkDialog() {
  showJackDialog("talk");
}

function openJackShopDialog() {
  showJackDialog("shop");
}

function openJackBuybackDialog() {
  showJackDialog("buyback");
}

function updateJackAnimation(deltaTime) {
  if (window.worldSystem.currentWorldId !== 0) return;

  const me = players.get(myId);
  const dx = me ? me.x + 35 - (JACK.x + 35) : 9999;
  const dy = me ? me.y + 35 - (JACK.y + 35) : 9999;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const isPlayerNear = distance < JACK.interactionRadius;

  if (isPlayerNear) {
    // Рядом с игроком — всегда первый кадр (покой)
    jackFrame = 0;
    jackCurrentAnimationPhase = "idle";
    jackPhaseTimer = 0;
  } else {
    // Игрок далеко → анимация
    jackPhaseTimer += deltaTime;

    if (jackCurrentAnimationPhase === "idle") {
      jackFrame = 0;
      // Через 8 секунд начинаем вторую строку
      if (jackPhaseTimer >= JACK_ANIMATION_ROW2_IDLE_DURATION) {
        jackCurrentAnimationPhase = "row2";
        jackPhaseTimer = 0;
        jackFrame = JACK_FRAMES_PER_ROW; // первый кадр второй строки = 13
      }
    } else if (jackCurrentAnimationPhase === "row2") {
      // Проигрываем вторую строку (кадры 13..25)
      jackFrame =
        JACK_FRAMES_PER_ROW + Math.floor(jackPhaseTimer / JACK_FRAME_DURATION);

      // 8 секунд прошло → переходим на одну прокрутку первой строки
      if (jackPhaseTimer >= JACK_ANIMATION_ROW2_IDLE_DURATION) {
        jackCurrentAnimationPhase = "row1";
        jackPhaseTimer = 0;
        jackFrame = 0;
      }
    } else if (jackCurrentAnimationPhase === "row1") {
      // Проигрываем один раз первую строку (кадры 0..12)
      jackFrame = Math.floor(jackPhaseTimer / JACK_FRAME_DURATION);

      // Закончили один проход первой строки → возвращаемся к 8 секундам второй
      if (jackPhaseTimer >= JACK_ANIMATION_ROW1_DURATION) {
        jackCurrentAnimationPhase = "row2";
        jackPhaseTimer = 0;
        jackFrame = JACK_FRAMES_PER_ROW;
      }
    }
  }
}

// Чистый draw Jack (без обновления анимации)
function drawJackSprite(camX, camY) {
  if (window.worldSystem.currentWorldId !== 0) return;

  const screenX = JACK.x - camX;
  const screenY = JACK.y - camY;

  if (jackSprite && jackSprite.complete) {
    let sourceY = 0;
    if (jackFrame >= JACK_FRAMES_PER_ROW) {
      sourceY = 70;
    }

    let frameInRow = jackFrame % JACK_FRAMES_PER_ROW;

    ctx.drawImage(
      jackSprite,
      frameInRow * 70,
      sourceY,
      70,
      70,
      screenX,
      screenY,
      JACK.width,
      JACK.height,
    );
  } else {
    ctx.fillStyle = "purple";
    ctx.fillRect(screenX, screenY, JACK.width, JACK.height);
  }

  // Рисуем имя
  ctx.fillStyle = isJackMet ? "#15ce00ff" : "#ffffff";
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(
    isJackMet ? JACK.name : "?",
    screenX + JACK.width / 2,
    screenY - 10,
  );
}

// Старый draw оставляем для совместимости
function drawJack(deltaTime) {
  updateJackAnimation(deltaTime);
  const cam = window.movementSystem.getCamera();
  drawJackSprite(cam.x, cam.y);
}

function checkJackProximity() {
  if (window.worldSystem?.currentWorldId !== 0) {
    if (isJackDialogOpen) closeJackDialog();

    isPlayerNearJack = false;
    removeJackButtons();
    return;
  }

  const me = players.get(myId);

  if (!me || me.health <= 0) {
    if (isJackDialogOpen) closeJackDialog();

    isPlayerNearJack = false;
    removeJackButtons();
    return;
  }

  const dx = me.x + 35 - (JACK.x + 35);
  const dy = me.y + 35 - (JACK.y + 35);
  const distance = Math.sqrt(dx * dx + dy * dy);
  const isNear = distance < JACK.interactionRadius;

  if (isNear) {
    if (!isJackDialogOpen) {
      if (!isJackMet && !hasJackGreetingBeenShown) {
        hasJackGreetingBeenShown = true;
        openJackDialog();
      } else if (isJackMet && !isPlayerNearJack) {
        isPlayerNearJack = true;
        const camera = window.movementSystem.getCamera();
        createJackButtons(JACK.x - camera.x, JACK.y - camera.y);
      }
    }
  } else {
    if (isJackDialogOpen) closeJackDialog();

    if (isPlayerNearJack) {
      isPlayerNearJack = false;
      removeJackButtons();
    }
  }

  // Обновляем положение кнопок независимо от drawJackSprite().
  updateJackButtonsPosition();
}

// Универсальная функция показа диалога
function showJackDialog(stage) {
  jackDialogStage = stage;

  let container = document.getElementById("jackDialog");
  if (container) {
    container.remove();
  }

  container = document.createElement("div");
  container.id = "jackDialog";
  container.className = `jack-dialog ${stage}`;
  document.body.appendChild(container);

  switch (stage) {
    case "greeting":
      jackShowGreetingDialog(container);
      break;
    case "talk":
      openJackTalkDialogContent(container);
      break;
    case "shop":
      showShopDialog(container);
      break;
    case "buyback":
      showBuybackDialog(container);
      break;
  }

  document.body.classList.add("npc-dialog-active");
  isJackDialogOpen = true;
}

// Открытие диалога (старое название для обратной совместимости)
function openJackDialog(skipGreeting = false) {
  if (!isJackMet && !skipGreeting) {
    showJackDialog("greeting");
  } else {
    showJackDialog("shop");
  }
}

// Закрытие
function closeJackDialog() {
  const dlg = document.getElementById("jackDialog");
  if (dlg) dlg.remove();
  isJackDialogOpen = false;
  document.body.classList.remove("npc-dialog-active");
  if (!isJackMet) hasJackGreetingBeenShown = false;
}

// Приветствие (без изменений)
function jackShowGreetingDialog(container) {
  const me = players.get(myId);
  const hasDocuments = me && me.corporateDocumentsSubmitted === true;

  // Переводим на универсальный npc-dialog стиль (как у остальных NPC)
  container.className = "npc-dialog open";
  container.id = "jackDialog";
  container.dataset.npc = hasDocuments ? "jack-doc" : "jack-nodoc";
  container.style.backgroundImage = `url(${
    hasDocuments
      ? images.jackDoc?.src || "jackDoc.png"
      : images.jackNoDoc?.src || "jackNoDoc.png"
  })`;
  container.style.backgroundSize = "cover";
  container.style.backgroundPosition = "center";

  container.innerHTML = `
    <div class="npc-dialog-content"></div>
    <button class="neon-btn-thimblerigger-ok" id="jackGreetingOk"></button>
  `;

  const okBtn = document.getElementById("jackGreetingOk");
  if (okBtn) {
    okBtn.onclick = () => {
      closeJackDialog();

      if (hasDocuments) {
        // Знакомимся только если документы сданы
        if (ws?.readyState === WebSocket.OPEN) {
          sendWhenReady(ws, JSON.stringify({ type: "meetJack" }));
        }
        // isJackMet выставится после ответа сервера (jackMet)
      }
      // Если документов нет — просто закрыли
    };
  }
}

// Диалог разговора (перенесена логика из openJackTalkDialog)
function openJackTalkDialogContent(container) {
  // Переводим контейнер на универсальный npc-dialog стиль
  container.className = "npc-dialog open";
  container.dataset.npc = "jack-talk";
  container.style.backgroundImage = `url(jack-talk-bg.png)`;
  container.style.backgroundSize = "cover";

  const topics = [
    {
      title: "О себе",
      text: "Я Джек — бывший контрабандист, теперь торговец. Всегда был в тени Джона: он чинит, я продаю. После Отключения выжил на чёрном рынке. Здесь выживает хитрый, а не сильный.",
    },
    {
      title: "Чёрный рынок",
      text: "Нижние уровни — сердце теневой торговли. Импланты, чипы, карты бункеров. Рынок родился после Отключения. Там информация дороже любого ножа. Я выжил, зная, когда молчать.",
    },
    {
      title: "Корпорации",
      text: "В верхних башнях они плетут интриги и сливают токсины вниз. Сегодня союзники, завтра сбрасывают бомбу. Не ведись на их обещания бессмертия — это просто новая цепь.",
    },
    {
      title: "Банды",
      text: "«Неоновые Тени», «Красные Клинки» — альянсы хрупкие. Сегодня делятся оружием, завтра нож в спину. Сила в числах, но доверие здесь — редкость.",
    },
    {
      title: "Совет покупателю",
      text: "Не свети балярами. Не показывай, сколько у тебя еды. Покупай только то, что реально нужно. И никогда не верь тому, кто слишком сладко говорит о «светлом будущем».",
    },
    {
      title: "Брат Джон",
      text: "Джон — идеалист. Я — реалист. Мы потеряли родителей в Отключении. Он чинит гаджеты, я маневрирую в тенях. Разные, но вместе — выжившие в этом аду.",
    },
  ];

  container.innerHTML = `
    <div class="npc-dialog-content">
      <div id="jackTalkTopics" class="jack-talk-topics"></div>
    </div>
    <button id="jackCloseTalkBtn" class="jack-btn-thimblerigger"></button>
  `;

  const topicsContainer = document.getElementById("jackTalkTopics");
  const closeBtn = document.getElementById("jackCloseTalkBtn");

  topics.forEach((topic) => {
    const div = document.createElement("div");
    div.className = "jack-talk-topic";
    div.innerHTML = `<strong class="jack-talk-topic-title">${topic.title}</strong>`;

    div.addEventListener("click", () => {
      topicsContainer.classList.add("hidden");

      const npcContent = container.querySelector(".npc-dialog-content");
      npcContent.innerHTML = `
        <div class="jack-fullscreen">
          <div class="jack-talk-text-content">${topic.text}</div>
        </div>
      `;
      closeBtn.onclick = () => showJackTopics();
    });

    topicsContainer.appendChild(div);
  });

  function showJackTopics() {
    const npcContent = container.querySelector(".npc-dialog-content");
    npcContent.innerHTML = `<div id="jackTalkTopics" class="jack-talk-topics"></div>`;

    const newTopicsContainer = document.getElementById("jackTalkTopics");
    topics.forEach((topic) => {
      const div = document.createElement("div");
      div.className = "jack-talk-topic";
      div.innerHTML = `<strong class="jack-talk-topic-title">${topic.title}</strong>`;
      div.addEventListener("click", () => {
        newTopicsContainer.classList.add("hidden");
        npcContent.innerHTML = `
          <div class="jack-fullscreen">
            <div class="jack-talk-text-content">${topic.text}</div>
          </div>
        `;
        closeBtn.onclick = () => showJackTopics();
      });
      newTopicsContainer.appendChild(div);
    });

    closeBtn.onclick = closeJackDialog;
  }

  closeBtn.onclick = closeJackDialog;
}

// Магазин Джека — структура и механика 1-в-1 как у Cristina (автономные классы)
let selectedItemType = null;
let selectedPrice = 0;

function showShopDialog(container) {
  // Переводим контейнер на тот же паттерн, что у Cristina
  container.className = "npc-dialog open jack-shop-dialog";
  container.dataset.npc = "jack-buy";
  container.style.backgroundImage = `url(jackBuy.png)`;
  container.style.backgroundSize = "cover";
  container.style.backgroundPosition = "center";

  container.innerHTML = `
    <div class="npc-dialog-content jack-shop-content">
      <div id="jackShopGrid" class="jack-shop-grid"></div>
    </div>
    <div class="jack-shop-buttons">
      <button class="jack-buy-confirm-btn" id="jack-shop-buy" disabled></button>
      <button class="neon-btn-ok" id="jack-shop-close"></button>
    </div>
  `;

  const grid = document.getElementById("jackShopGrid");
  const buyBtn = document.getElementById("jack-shop-buy");
  const closeBtn = document.getElementById("jack-shop-close");

  if (closeBtn) closeBtn.onclick = () => closeJackDialog();

  selectedItemType = null;
  selectedPrice = 0;

  const BLACKLIST = [
    "balyary",
    "atom",
    "blood_pack",
    "blood_syringe",
    "blue_crystal",
    "red_crystal",
    "green_crystal",
    "white_crystal",
    "yellow_crystal",
    "chameleon_crystal",
    "nanoalloy",
    "nanofilament",
  ];

  const availableItems = Object.entries(ITEM_CONFIG).filter(([type, cfg]) => {
    const isBlacklisted = BLACKLIST.includes(type);
    const isWeapon = cfg.category === "weapon";
    const isRarityValid = cfg.rarity >= 1 && cfg.rarity <= 3;
    return isRarityValid && !isBlacklisted && !isWeapon;
  });

  // Группируем в колонки по 6 предметов (как у Cristina — 4 колонки)
  const COLUMNS = 4;
  const itemsPerColumn = Math.ceil(availableItems.length / COLUMNS) || 1;

  for (let col = 0; col < COLUMNS; col++) {
    const column = document.createElement("div");
    column.className = "jack-shop-column";

    const start = col * itemsPerColumn;
    const end = Math.min(start + itemsPerColumn, availableItems.length);
    const columnItems = availableItems.slice(start, end);

    columnItems.forEach(([type, cfg]) => {
      let price = 5;
      if (cfg.rarity === 2) price = 4;
      else if (cfg.rarity === 3) price = 3;

      let desc = cfg.description || type;
      if (window.i18n) {
        const tKey = "itemdesc_" + type;
        const translated = window.i18n.t(tKey);
        if (translated && translated !== tKey) desc = translated;
      }

      const itemEl = document.createElement("div");
      itemEl.className = "jack-shop-item";
      itemEl.dataset.type = type;

      itemEl.innerHTML = `
        <img src="${cfg.image?.src || ""}" alt="${type}" width="40" height="40">
        <div class="jack-shop-item-info">
          <div class="jack-shop-item-name">${desc}</div>
          <div class="jack-shop-item-price">${price} баляр</div>
        </div>
      `;

      itemEl.onclick = () => {
        grid.querySelectorAll(".jack-shop-item").forEach((el) => {
          el.classList.remove("selected");
        });
        itemEl.classList.add("selected");
        selectedItemType = type;
        selectedPrice = price;
        buyBtn.disabled = false;
      };

      column.appendChild(itemEl);
    });

    grid.appendChild(column);
  }

  // Кнопка Купить
  buyBtn.onclick = () => {
    if (!selectedItemType) return;
    buyItem(selectedItemType, selectedPrice);
  };
}

// Покупка (без изменений)
function buyItem(type, price) {
  if (ws.readyState === WebSocket.OPEN) {
    sendWhenReady(ws, JSON.stringify({ type: "buyFromJack", itemType: type })); // Отправляем тип и цену (сервер проверит)
  } else {
    alert("Соединение потеряно. Попробуйте позже.");
  }
}

// НОВЫЙ ДИАЛОГ СКУПКИ
function showBuybackDialog(container) {
  // Переводим на тот же паттерн, что у Cristina sell
  container.className = "npc-dialog open jack-sell-dialog";
  container.dataset.npc = "jack-sell";
  container.style.backgroundImage = `url(jackSell.png)`;
  container.style.backgroundSize = "cover";
  container.style.backgroundPosition = "center";

  container.innerHTML = `
    <div class="npc-dialog-content jack-sell-content">
      <div id="jackSellGrid" class="jack-sell-grid"></div>
    </div>
    <div class="jack-sell-buttons">
      <button class="jack-sell-confirm-btn" id="jack-sell-confirm" disabled></button>
      <button class="neon-btn-ok" id="jack-sell-close"></button>
    </div>
  `;

  const grid = document.getElementById("jackSellGrid");
  const sellBtn = document.getElementById("jack-sell-confirm");
  const closeBtn = document.getElementById("jack-sell-close");

  if (closeBtn) closeBtn.onclick = () => closeJackDialog();

  selectedBuybackSlot = null; // сброс при каждом открытии

  // Рисуем инвентарь (20 слотов) — логика 1-в-1
  const inv = (typeof inventory !== "undefined" ? inventory : []) || [];
  for (let i = 0; i < 20; i++) {
    const slot = document.createElement("div");
    slot.className = "jack-sell-slot";
    slot.dataset.index = i;

    const item = inv[i];
    if (item) {
      const cfg = ITEM_CONFIG?.[item.type];
      const img = document.createElement("img");
      img.src = cfg?.image?.src || "";
      img.width = 40;
      img.height = 40;
      slot.appendChild(img);

      if (item.quantity > 1) {
        const qty = document.createElement("div");
        qty.className = "jack-sell-qty";
        qty.textContent = item.quantity;
        slot.appendChild(qty);
      }
    }

    slot.onclick = () => {
      grid.querySelectorAll(".jack-sell-slot").forEach((el) => {
        el.classList.remove("selected");
      });
      slot.classList.add("selected");
      selectedBuybackSlot = i;

      // Активируем кнопку только для продуктов питания (старая логика)
      const itemType = inv[i]?.type;
      sellBtn.disabled = !isFoodProduct(itemType);
    };

    grid.appendChild(slot);
  }

  // Кнопка Продать — логика 1-в-1
  sellBtn.onclick = () => {
    if (selectedBuybackSlot === null) return;
    const item = inv[selectedBuybackSlot];
    if (!item || !isFoodProduct(item.type)) return;

    sellItemToJack(selectedBuybackSlot);
    // Диалог оставляем открытым — после ответа сервера инвентарь обновится
    // (как у Cristina). Если нужно мгновенно перерисовать — можно вызвать
    // showBuybackDialog(container), но серверный updateInventory уже придёт.
  };
}

// Проверка является ли предмет продуктом питания (та же логика что в магазине)
function isFoodProduct(type) {
  if (!type || !ITEM_CONFIG[type]) return false;
  const cfg = ITEM_CONFIG[type];
  const BLACKLIST = [
    "balyary",
    "atom",
    "blood_pack",
    "blood_syringe",
    "blue_crystal",
    "red_crystal",
    "green_crystal",
    "white_crystal",
    "yellow_crystal",
    "chameleon_crystal",
    "nanoalloy",
    "nanofilament",
  ];
  const isBlacklisted = BLACKLIST.includes(type);
  const isWeapon = cfg.category === "weapon";
  const isRarityValid = cfg.rarity >= 1 && cfg.rarity <= 3;
  return isRarityValid && !isBlacklisted && !isWeapon;
}

// Продажа предмета Джеку (1 баляр за любой продукт)
function sellItemToJack(slotIndex) {
  if (ws.readyState === WebSocket.OPEN) {
    sendWhenReady(ws, JSON.stringify({ type: "sellToJack", slotIndex })); // Отправляем слот (сервер проверит item)
  } else {
    alert("Соединение потеряно. Попробуйте позже.");
  }
}

function getJackRenderData() {
  if (window.worldSystem?.currentWorldId !== 0) {
    return null;
  }

  if (
    !jackSprite?.complete ||
    jackSprite.naturalWidth <= 0 ||
    jackSprite.naturalHeight <= 0
  ) {
    return null;
  }

  // Повторяем выбор кадра из drawJackSprite().
  // В исходной анимации номер кадра общий для двух строк.
  const safeFrame = Math.max(
    0,
    Math.min(jackFrame, JACK_FRAMES_PER_ROW * 2 - 1),
  );

  const row = Math.floor(safeFrame / JACK_FRAMES_PER_ROW);

  const frame = safeFrame % JACK_FRAMES_PER_ROW;

  return {
    id: "jack",
    type: "npc",
    visualType: "billboard",

    x: JACK.x,
    y: JACK.y,

    worldId: 0,

    sprite: jackSprite,

    frame,
    row,

    frameCount: JACK_FRAMES_PER_ROW,

    frameWidth: JACK.spriteWidth,
    frameHeight: JACK.spriteHeight,

    displayWidth: JACK.width,
    displayHeight: JACK.height,
  };
}

// Экспорт
window.jackSystem = {
  drawJack, // оставляем для совместимости

  getRenderData: getJackRenderData,

  /** Возвращает текущую мировую позицию (для depth-sort) */
  getPosition() {
    return { x: JACK.x, y: JACK.y };
  },

  /** Чистый draw — вызывается из code.js после сортировки */
  drawSprite(camX, camY) {
    drawJackSprite(camX, camY);
  },

  /** Обновление анимации (вызывается из code.js перед depth-sort) */
  updateAnimation(deltaTime) {
    updateJackAnimation(deltaTime);
  },

  checkJackProximity,
  setJackMet: (met) => {
    isJackMet = met;
    if (!met) {
      removeJackButtons();
      isPlayerNearJack = false;
      hasJackGreetingBeenShown = false;
    }
  },
  initialize: (spriteImg) => {
    jackSprite = spriteImg;
    initializeJackStyles();
    hasJackGreetingBeenShown = false;
  },
};

(function registerJackVisualProvider() {
  "use strict";

  function registerJack3D() {
    const scene = window.sceneEntitySystem;
    const jack = window.jackSystem;

    if (
      typeof scene?.registerNPCVisualProvider !== "function" ||
      typeof scene?.getRegisteredNPCIds !== "function" ||
      typeof jack?.getRenderData !== "function"
    ) {
      return false;
    }

    const id = "jack";

    // Защита от повторной регистрации.
    if (scene.getRegisteredNPCIds().includes(id)) {
      return true;
    }

    scene.registerNPCVisualProvider(id, {
      getRenderData() {
        return jack.getRenderData();
      },
    });

    const registered = scene.getRegisteredNPCIds().includes(id);

    if (registered) {
      console.log("[Jack3D] Visual provider registered successfully.");
    } else {
      console.error("[Jack3D] Failed to register visual provider.");
    }

    return registered;
  }

  if (!registerJack3D()) {
    window.addEventListener("load", registerJack3D, { once: true });
  }
})();
