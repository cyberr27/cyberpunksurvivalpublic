const TORESTOS = {
  x: 679,
  y: 2540,
  width: 70,
  height: 70,
  interactionRadius: 50,
  name: "Master Torestos",
  worldId: 0,
};

const MAIN_PHASE_DURATION = 15000;
const ACTIVE_PHASE_DURATION = 5000;
const FRAME_DURATION_TORESTOS = 200;
const TOTAL_FRAMES_TORESTOS = 13;
const MAX_DELTA = 1000;

let isMet = false;
let isDialogOpen = false;
let isNear = false;

let spriteTorestos = null;
let buttonsContainer = null;
let dialogElement = null;

let frame = 0;
let frameTime = 0;
let cycleTime = 0;
let currentPhaseTorestos = "main";

// Для отката при отмене улучшения
let backupInventoryBeforeUpgrade = null;
let backupSelectedSlot = null;

(() => {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "torestosStyle.css";
  document.head.appendChild(link);
})();

function openNoDocDialog() {
  if (isDialogOpen) return;
  isDialogOpen = true;
  document.body.classList.add("npc-dialog-active");

  dialogElement = document.createElement("div");
  dialogElement.className = "npc-dialog open";
  dialogElement.dataset.npc = "torestos-nodoc";
  dialogElement.style.backgroundImage = `url(${images.torestosNoDoc?.src || "torestosNoDoc.png"})`;
  dialogElement.style.backgroundSize = "cover";
  dialogElement.style.backgroundPosition = "center";

  dialogElement.innerHTML = `
    <div class="npc-dialog-content"></div>
    <button class="neon-btn-thimblerigger-ok" id="torestos-nodoc-ok"></button>
  `;

  document.body.appendChild(dialogElement);

  const okBtn = document.getElementById("torestos-nodoc-ok");
  if (okBtn) {
    okBtn.onclick = () => {
      closeDialog();
    };
  }
}

function openGreeting() {
  if (isDialogOpen) return;
  isDialogOpen = true;
  document.body.classList.add("npc-dialog-active");

  dialogElement = document.createElement("div");
  dialogElement.className = "npc-dialog open";
  dialogElement.dataset.npc = "torestos-doc";
  dialogElement.style.backgroundImage = `url(${images.torestosDoc?.src || "torestosDoc.png"})`;
  dialogElement.style.backgroundSize = "cover";
  dialogElement.style.backgroundPosition = "center";

  dialogElement.innerHTML = `
    <div class="npc-dialog-content"></div>
    <button class="neon-btn-thimblerigger-ok" id="torestos-greeting-ok"></button>
  `;

  document.body.appendChild(dialogElement);

  const okBtn = document.getElementById("torestos-greeting-ok");
  if (okBtn) {
    okBtn.onclick = () => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "meetTorestos" }));
      }
      closeDialog();
    };
  }
}

function openTorestosDialog(section = "talk") {
  // Всегда закрываем предыдущее окно Торестоса, если оно открыто
  closeDialog();

  isDialogOpen = true;
  document.body.classList.add("npc-dialog-active");

  dialogElement = document.createElement("div");

  const isTalk = section === "talk";
  const isUpgrade = section === "upgrade";
  const isCollection = section === "collection";

  // Правильно выбираем класс окна в зависимости от типа
  dialogElement.className = isUpgrade
    ? "torestos-upgrade-dialog open"
    : isTalk
      ? "torestos-dialog open"
      : "torestos-dialog open";

  document.body.appendChild(dialogElement);

  let closeBtn = null;

  // Общая кнопка "ОТМЕНА" / "ЗАКРЫТЬ" для upgrade и collection
  if (!isTalk) {
    closeBtn = document.createElement("button");
    closeBtn.className = "torestos-neon-btn-cancel";
    closeBtn.style.position = "absolute";
    closeBtn.style.top = "3%";
    closeBtn.style.width = "10%";
    closeBtn.textContent = "ОТМЕНА";
    closeBtn.onclick = closeDialog;
    dialogElement.appendChild(closeBtn);
  }

  const contentContainer = document.createElement("div");
  contentContainer.id = "torestosContent";
  dialogElement.appendChild(contentContainer);

  // ────────────────────────────────────────────────
  // ГОВОРИТЬ
  // ────────────────────────────────────────────────
  if (isTalk) {
    dialogElement.className = "npc-dialog open"; // универсальный контейнер
    dialogElement.dataset.npc = "torestos-talk";

    dialogElement.style.backgroundImage = `url(torestos-talk-bg.png)`;
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content">
        <div id="torestosTalkTopics" class="torestos-talk-topics"></div>
      </div>
      <button id="torestosCloseTalkBtn" class="neon-btn-thimblerigger"></button>
    `;

    const topicsContainer = document.getElementById("torestosTalkTopics");
    const closeBtn = document.getElementById("torestosCloseTalkBtn");

    const topics = [
      {
        title: "О себе",
        text: "Меня зовут Торестос. Когда-то я был инженером в верхних лабораториях NeoCorp. После Большого Отключения остался внизу — чиню и усиливаю то, что ещё можно спасти. Мастер — это не титул, это выживание.",
      },
      {
        title: "Об улучшениях",
        text: "Улучшения делают тебя сильнее в мире, где слабых перемалывают. Я могу усилить броню, добавить скрытые модули. Но каждый имплант забирает часть человечности. Выбирай wisely.",
      },
      {
        title: "О Неоновом городе",
        text: "Город светится сверху и гниёт снизу. Корпорации правят верхними уровнями, банды делят трущобы. Неон не лечит — он только маскирует раны. Здесь выживает тот, кто умеет чинить себя сам.",
      },
      {
        title: "Большое Отключение",
        text: "За одну ночь погасли все огни. ИИ решил, что человечество — вирус. Я видел, как коллеги падали без искусственных лёгких. С тех пор город поделён на тех, кто наверху, и нас — внизу.",
      },
      {
        title: "Совет сталкеру",
        text: "Не доверяй никому полностью. Собирай всё, что найдёшь. Учись разбирать и собирать. Держи баляры при себе, но не свети ими. И найди цель — без неё неон сожрёт тебя быстрее любой пули.",
      },
      {
        title: "О будущем",
        text: "Город умирает, но может возродиться. Если мастера и сталкеры объединят знания — сможем очистить сети и вернуть контроль. Может, однажды неон снова будет светить для всех.",
      },
    ];

    topics.forEach((topic) => {
      const div = document.createElement("div");
      div.className = "torestos-talk-topic";
      div.innerHTML = `<strong class="torestos-talk-topic-title">${topic.title}</strong>`;

      div.addEventListener("click", () => {
        topicsContainer.classList.add("hidden");

        const npcContent = dialogElement.querySelector(".npc-dialog-content");
        npcContent.innerHTML = `
          <div class="torestos-fullscreen">
            <div class="torestos-talk-text-content">${topic.text}</div>
          </div>
        `;
        closeBtn.onclick = () => showTorestosTopics();
      });

      topicsContainer.appendChild(div);
    });

    function showTorestosTopics() {
      topicsContainer.classList.remove("hidden");
      const npcContent = dialogElement.querySelector(".npc-dialog-content");

      npcContent.innerHTML = `<div id="torestosTalkTopics" class="torestos-talk-topics"></div>`;

      const newTopicsContainer = document.getElementById("torestosTalkTopics");
      topics.forEach((topic) => {
        const div = document.createElement("div");
        div.className = "torestos-talk-topic";
        div.innerHTML = `<strong class="torestos-talk-topic-title">${topic.title}</strong>`;
        div.addEventListener("click", () => {
          newTopicsContainer.classList.add("hidden");
          npcContent.innerHTML = `
            <div class="torestos-fullscreen">
              <div class="torestos-talk-text-content">${topic.text}</div>
            </div>
          `;
          closeBtn.onclick = () => showTorestosTopics();
        });
        newTopicsContainer.appendChild(div);
      });

      closeBtn.onclick = closeDialog;
    }

    closeBtn.onclick = closeDialog;
  }

  // ────────────────────────────────────────────────
  // КОЛЛЕКЦИЯ (заглушка)
  // ────────────────────────────────────────────────
  else if (section === "collection") {
    contentContainer.innerHTML = `
      <h2 class="torestos-title" style="margin: 20px 0;">КОЛЛЕКЦИЯ</h2>
      <p class="torestos-text" style="text-align:center; margin-top:60px;">
        Коллекции пока нет в игре.<br>
        Но скоро здесь будут редкие артефакты,<br>
        мутировавшие предметы и постоянные бонусы.
      </p>
      <p class="torestos-text" style="font-size:14px; opacity:0.7; margin-top:40px;">
        Держи ушки на макушке, странник...
      </p>
    `;
  }

  // ────────────────────────────────────────────────
  // УЛУЧШИТЬ — основная логика
  // ────────────────────────────────────────────────
  else if (section === "upgrade") {
    // Бэкап перед открытием (для отката при отмене)
    backupInventoryBeforeUpgrade = window.inventory.map((slot) =>
      slot ? { ...slot } : null,
    );
    backupSelectedSlot = window.selectedSlot;

    const header = document.createElement("h2");
    header.className = "torestos-title";
    header.textContent = "УЛУЧШЕНИЯ У ТОРЕСТОСА";
    contentContainer.appendChild(header);

    const upgradeContent = document.createElement("div");
    upgradeContent.className = "upgrade-content";
    contentContainer.appendChild(upgradeContent);

    // Левая часть — инвентарь игрока
    const playerInventoryContainer = document.createElement("div");
    playerInventoryContainer.className = "upgrade-player-inventory";
    upgradeContent.appendChild(playerInventoryContainer);

    const playerGrid = document.createElement("div");
    playerGrid.className = "upgrade-inventory-grid";
    playerInventoryContainer.appendChild(playerGrid);

    // Кнопка USE >>
    const useContainer = document.createElement("div");
    useContainer.className = "upgrade-use-container";
    upgradeContent.appendChild(useContainer);

    const useBtn = document.createElement("button");
    useBtn.className = "torestos-neon-btn-use upgrade-use-btn";
    useBtn.textContent = "USE >>";
    useBtn.disabled = true;
    useContainer.appendChild(useBtn);

    // Правая часть — центр + материалы
    const upgradeArea = document.createElement("div");
    upgradeArea.className = "upgrade-area";
    upgradeContent.appendChild(upgradeArea);

    const centralContainer = document.createElement("div");
    centralContainer.className = "upgrade-central-container";
    upgradeArea.appendChild(centralContainer);

    const centralSlotEl = document.createElement("div");
    centralSlotEl.className = "upgrade-central-slot";
    centralSlotEl.id = "centralUpgradeSlot";
    centralContainer.appendChild(centralSlotEl);

    const materialGrid = document.createElement("div");
    materialGrid.className = "upgrade-material-grid";
    upgradeArea.appendChild(materialGrid);

    // Кнопки внизу
    const upgradeButtons = document.createElement("div");
    upgradeButtons.className = "upgrade-buttons";
    upgradeArea.appendChild(upgradeButtons);

    const upgradeBtn = document.createElement("button");
    upgradeBtn.className = "torestos-neon-btn-create";
    upgradeBtn.textContent = "УЛУЧШИТЬ";
    upgradeBtn.disabled = true;

    upgradeBtn.onclick = () => {
      // Отправляем текущее состояние инвентаря на сервер
      if (ws?.readyState !== WebSocket.OPEN) {
        showNotification("Нет соединения с сервером", "#ff4444");
        return;
      }

      upgradeBtn.disabled = true;
      upgradeBtn.textContent = "ОБРАБОТКА...";

      ws.send(
        JSON.stringify({
          type: "torestosUpgrade",
          inventory: window.inventory.map((item) =>
            item ? { ...item } : null,
          ),
        }),
      );

      // Через 12 секунд (на всякий случай таймаут) разблокируем кнопку
      setTimeout(() => {
        if (upgradeBtn.textContent === "ОБРАБОТКА...") {
          upgradeBtn.disabled = false;
          upgradeBtn.textContent = "УЛУЧШИТЬ";
        }
      }, 12000);
    };

    upgradeButtons.appendChild(upgradeBtn);

    let selectedPlayerSlot = null;

    // ─── Вспомогательные функции ───
    const findFreeSlot = () => window.inventory.findIndex((s) => s === null);

    const renderUpgradeUI = () => {
      // ─── Левая панель — всегда 20 слотов ───
      playerGrid.innerHTML = "";
      for (let i = 0; i < 20; i++) {
        const slot = document.createElement("div");
        slot.className = "upgrade-inventory-slot";
        slot.dataset.index = i;

        const item = window.inventory[i];

        if (item && !item.isUpgradeItem && !item.isMaterial) {
          const img = document.createElement("img");
          img.src = ITEM_CONFIG[item.type]?.image?.src || "";
          img.style.width = "100%";
          img.style.height = "100%";
          slot.appendChild(img);

          if (item.quantity > 1) {
            const q = document.createElement("div");
            q.className = "quantity-label";
            q.textContent = item.quantity;
            slot.appendChild(q);
          }

          slot.onclick = () => {
            selectedPlayerSlot = i;
            useBtn.disabled = false;
            renderUpgradeUI();
          };

          if (selectedPlayerSlot === i) {
            slot.classList.add("selected");
          }
        }

        playerGrid.appendChild(slot);
      }

      // ─── Центральный слот ───
      centralSlotEl.innerHTML = "";
      const centerItem = window.inventory.find((s) => s?.isUpgradeItem);
      if (centerItem) {
        const img = document.createElement("img");
        img.src = ITEM_CONFIG[centerItem.type]?.image?.src || "";
        img.style.width = "160px";
        img.style.height = "160px";
        centralSlotEl.appendChild(img);

        // Двойной клик — вернуть в инвентарь
        centralSlotEl.ondblclick = () => {
          const idx = window.inventory.findIndex((s) => s === centerItem);
          if (idx !== -1) {
            const freeIdx = findFreeSlot();
            if (freeIdx !== -1) {
              window.inventory[freeIdx] = { ...centerItem };
              delete window.inventory[freeIdx].isUpgradeItem;
            }
            window.inventory[idx] = null;
            selectedPlayerSlot = null;
            useBtn.disabled = true;
            renderUpgradeUI();
            upgradeBtn.disabled = true;
          }
        };

        upgradeBtn.disabled = false;
      } else {
        upgradeBtn.disabled = true;
      }

      // ─── Материалы — всегда 20 слотов ───
      materialGrid.innerHTML = "";
      for (let i = 0; i < 20; i++) {
        const slot = document.createElement("div");
        slot.className = "upgrade-material-slot";
        slot.dataset.matIndex = i;

        const matItem = window.inventory.find(
          (s) => s && s.isMaterial && s.materialSlotIndex === i,
        );

        if (matItem) {
          const img = document.createElement("img");
          img.src = ITEM_CONFIG[matItem.type]?.image?.src || "";
          img.style.width = "100%";
          img.style.height = "100%";
          slot.appendChild(img);

          if (matItem.quantity > 1) {
            const q = document.createElement("div");
            q.className = "quantity-label";
            q.textContent = matItem.quantity;
            slot.appendChild(q);
          }

          slot.ondblclick = () => {
            const idx = window.inventory.findIndex((s) => s === matItem);
            if (idx !== -1) {
              const freeIdx = findFreeSlot();
              if (freeIdx !== -1) {
                window.inventory[freeIdx] = { ...matItem };
                delete window.inventory[freeIdx].isMaterial;
                delete window.inventory[freeIdx].materialSlotIndex;
              }
              window.inventory[idx] = null;
              renderUpgradeUI();
            }
          };
        }

        materialGrid.appendChild(slot);
      }
    };

    // ─── Кнопка USE >> ───
    useBtn.onclick = () => {
      if (selectedPlayerSlot === null) return;

      const item = window.inventory[selectedPlayerSlot];
      if (!item) return;

      const cfg = ITEM_CONFIG[item.type];
      if (!cfg) return;

      const isUpgradable = !!cfg.type || !!cfg.collection || !!cfg.hands;

      if (isUpgradable) {
        // Находим текущий центральный слот (если есть)
        const centerIdx = window.inventory.findIndex((s) => s?.isUpgradeItem);

        const newItem = { ...item, isUpgradeItem: true };

        if (centerIdx !== -1) {
          // SWAP: старый центр → на место выбранного слота
          const oldCenter = { ...window.inventory[centerIdx] };
          delete oldCenter.isUpgradeItem;
          window.inventory[selectedPlayerSlot] = oldCenter;

          // Новый → в центр
          window.inventory[centerIdx] = newItem;
        } else {
          // Просто перенос в свободный слот
          window.inventory[selectedPlayerSlot] = null;
          const freeIdx = findFreeSlot();
          if (freeIdx !== -1) {
            window.inventory[freeIdx] = newItem;
          } else {
            // защита
            window.inventory[selectedPlayerSlot] = { ...item };
            alert("Нет свободного места для улучшаемого предмета");
            return;
          }
        }

        selectedPlayerSlot = null;
        useBtn.disabled = true;
      } else {
        // ─── Материал ───
        const usedMaterialSlots = new Set(
          window.inventory
            .filter((s) => s?.isMaterial)
            .map((s) => s.materialSlotIndex),
        );

        let freeMatIndex = -1;
        for (let i = 0; i < 20; i++) {
          if (!usedMaterialSlots.has(i)) {
            freeMatIndex = i;
            break;
          }
        }

        if (freeMatIndex === -1) {
          alert("Все слоты материалов заняты!");
          return;
        }

        const qty = item.quantity > 1 ? 1 : item.quantity;
        const matItem = {
          ...item,
          quantity: qty,
          isMaterial: true,
          materialSlotIndex: freeMatIndex,
        };

        // Уменьшаем или удаляем исходный
        if (item.quantity > qty) {
          item.quantity -= qty;
        } else {
          window.inventory[selectedPlayerSlot] = null;
          selectedPlayerSlot = null;
          useBtn.disabled = true;
        }

        // Добавляем материал
        const freeIdx = findFreeSlot();
        if (freeIdx !== -1) {
          window.inventory[freeIdx] = matItem;
        }
      }

      renderUpgradeUI();
    };

    renderUpgradeUI();
  }
}

function closeDialog() {
  if (!isDialogOpen) return;
  isDialogOpen = false;
  document.body.classList.remove("npc-dialog-active");

  if (dialogElement) {
    dialogElement.remove();
    dialogElement = null;
    selectedPlayerSlot = null;
  }

  // Откат изменений, если была открыта панель улучшений
  if (backupInventoryBeforeUpgrade) {
    window.inventory = backupInventoryBeforeUpgrade.map((slot) =>
      slot ? { ...slot } : null,
    );
    window.selectedSlot = backupSelectedSlot;
    window.inventorySystem.updateInventoryDisplay();
  }

  backupInventoryBeforeUpgrade = null;
  backupSelectedSlot = null;
}

function createButtons() {
  if (buttonsContainer) return;
  buttonsContainer = document.createElement("div");
  buttonsContainer.className = "torestos-buttons-container";

  const buttonConfig = [
    { class: "torestos-talk-btn", section: "talk" },
    { class: "torestos-upgrade-btn", section: "upgrade" },
    {
      class: "torestos-collection-btn",
      section: "collection",
    },
  ];

  buttonConfig.forEach((config) => {
    const btn = document.createElement("div");
    btn.className = "torestos-button " + config.class;
    btn.textContent = config.text;
    btn.onclick = (e) => {
      e.stopPropagation();
      openTorestosDialog(config.section);
    };
    buttonsContainer.appendChild(btn);
  });

  document.body.appendChild(buttonsContainer);
}

function removeButtonsTorestos() {
  if (buttonsContainer) {
    buttonsContainer.remove();
    buttonsContainer = null;
  }
}

function updateButtonsPosition(cameraX, cameraY) {
  if (!buttonsContainer || !isNear) return;
  const zoom = window.movementSystem?.getZoom?.() || 1;
  const screenX = TORESTOS.x - cameraX + 35;
  const screenY = TORESTOS.y - cameraY - 90;
  buttonsContainer.style.left = `${screenX * zoom}px`;
  buttonsContainer.style.top = `${screenY * zoom}px`;
}

function updateTorestosAnimation(deltaTime) {
  if (window.worldSystem.currentWorldId !== TORESTOS.worldId) return;

  deltaTime = Math.min(deltaTime, MAX_DELTA);

  if (isNear) {
    frame = 0;
    frameTime = 0;
    cycleTime = 0;
    currentPhaseTorestos = "main";
    return;
  }

  cycleTime += deltaTime;
  while (
    cycleTime >=
    (currentPhaseTorestos === "main"
      ? MAIN_PHASE_DURATION
      : ACTIVE_PHASE_DURATION)
  ) {
    cycleTime -=
      currentPhaseTorestos === "main"
        ? MAIN_PHASE_DURATION
        : ACTIVE_PHASE_DURATION;
    currentPhaseTorestos = currentPhaseTorestos === "main" ? "active" : "main";
    frame = 0;
    frameTime = 0;
  }

  frameTime += deltaTime;
  while (frameTime >= FRAME_DURATION_TORESTOS) {
    frameTime -= FRAME_DURATION_TORESTOS;
    frame = (frame + 1) % TOTAL_FRAMES_TORESTOS;
  }
}

function drawTorestosSprite(camX, camY) {
  if (window.worldSystem.currentWorldId !== TORESTOS.worldId) return;

  const screenX = TORESTOS.x - camX;
  const screenY = TORESTOS.y - camY;

  let sx, sy;

  if (isNear) {
    sx = 0;
    sy = 0;
  } else {
    sy = currentPhaseTorestos === "main" ? 0 : 70;
    sx = frame * 70;
  }

  if (spriteTorestos?.complete) {
    ctx.drawImage(spriteTorestos, sx, sy, 70, 70, screenX, screenY, 90, 90);
  } else {
    ctx.fillStyle = "#ff00aa";
    ctx.fillRect(screenX, screenY, 70, 70);
  }

  ctx.fillStyle = isMet ? "#fbff00" : "#ffffff";
  ctx.font = "13px Arial";
  ctx.textAlign = "center";
  ctx.fillText(isMet ? TORESTOS.name : "?", screenX + 35, screenY - 12);

  updateButtonsPosition(camX, camY);
}

// Старый draw оставляем для совместимости (анимация + отрисовка)
function drawTorestos(deltaTime) {
  updateTorestosAnimation(deltaTime);
  const cam = window.movementSystem.getCamera();
  drawTorestosSprite(cam.x, cam.y);
}

function checkProximity() {
  const me = players.get(myId);
  const currentWorldId = window.worldSystem.currentWorldId;

  if (
    !me ||
    me.worldId !== TORESTOS.worldId ||
    me.health <= 0 ||
    currentWorldId !== TORESTOS.worldId
  ) {
    if (isNear) {
      isNear = false;
      removeButtonsTorestos();
      closeDialog();
    }
    return;
  }

  const dx = me.x + 35 - (TORESTOS.x + 35);
  const dy = me.y + 35 - (TORESTOS.y + 35);
  const dist = Math.hypot(dx, dy);
  const nowNear = dist < TORESTOS.interactionRadius;

  if (nowNear && !isNear) {
    isNear = true;
    if (isMet) {
      createButtons();
    } else {
      // Документы не сданы → no-doc диалог (без знакомства)
      const me = players.get(myId);
      const hasDocuments = me && me.corporateDocumentsSubmitted === true;

      if (!hasDocuments) {
        openNoDocDialog();
      } else {
        openGreeting();
      }
    }
  } else if (!nowNear && isNear) {
    isNear = false;
    removeButtonsTorestos();
    closeDialog();
    currentPhaseTorestos = "main";
    cycleTime = 0;
    frame = 0;
    frameTime = 0;
  }
}

function setMet(met) {
  isMet = met;
  if (isNear) {
    if (met) createButtons();
    else removeButtonsTorestos();
  }
}

function getTorestosRenderData() {
  if (window.worldSystem?.currentWorldId !== TORESTOS.worldId) {
    return null;
  }

  if (
    !spriteTorestos?.complete ||
    spriteTorestos.naturalWidth <= 0 ||
    spriteTorestos.naturalHeight <= 0
  ) {
    return null;
  }

  // Повторяем выбор кадра из drawTorestosSprite().
  const currentFrame = isNear ? 0 : frame;

  const currentRow = isNear ? 0 : currentPhaseTorestos === "main" ? 0 : 1;

  return {
    id: "torestos",
    type: "npc",
    visualType: "billboard",

    // Исходные мировые координаты NPC.
    x: TORESTOS.x,
    y: TORESTOS.y,

    worldId: TORESTOS.worldId,

    sprite: spriteTorestos,

    frame: currentFrame,
    row: currentRow,

    frameCount: TOTAL_FRAMES_TORESTOS,

    frameWidth: 70,
    frameHeight: 70,

    // Размеры из оригинального drawTorestosSprite().
    displayWidth: 90,
    displayHeight: 90,
  };
}

window.torestosSystem = {
  drawTorestos, // оставляем для совместимости

  getRenderData: getTorestosRenderData,

  /** Возвращает текущую мировую позицию (для depth-sort) */
  getPosition() {
    return { x: TORESTOS.x, y: TORESTOS.y };
  },

  /** Чистый draw — вызывается из code.js после сортировки */
  drawSprite(camX, camY) {
    drawTorestosSprite(camX, camY);
  },

  /** Обновление анимации (вызывается из code.js перед depth-sort) */
  updateAnimation(deltaTime) {
    updateTorestosAnimation(deltaTime);
  },

  checkTorestosProximity: checkProximity,
  setTorestosMet: setMet,
  initialize: (s) => {
    spriteTorestos = s;
    currentPhaseTorestos = "main";
    cycleTime = 0;
    frame = 0;
    frameTime = 0;
  },
};

(function registerTorestosVisualProvider() {
  "use strict";

  function registerTorestos3D() {
    const scene = window.sceneEntitySystem;
    const torestos = window.torestosSystem;

    if (
      typeof scene?.registerNPCVisualProvider !== "function" ||
      typeof scene?.getRegisteredNPCIds !== "function" ||
      typeof torestos?.getRenderData !== "function"
    ) {
      return false;
    }

    const id = "torestos";

    // Защита от повторной регистрации.
    if (scene.getRegisteredNPCIds().includes(id)) {
      return true;
    }

    // Регистрируем визуального провайдера.
    scene.registerNPCVisualProvider(id, {
      getRenderData() {
        return torestos.getRenderData();
      },
    });

    // Проверяем фактическую регистрацию.
    const registered = scene.getRegisteredNPCIds().includes(id);

    if (registered) {
      console.log("[Torestos3D] Visual provider registered successfully.");
    } else {
      console.error("[Torestos3D] Failed to register visual provider.");
    }

    return registered;
  }

  // Первая попытка — сразу после выполнения скрипта.
  if (!registerTorestos3D()) {
    // Повторная попытка после загрузки страницы.
    window.addEventListener("load", registerTorestos3D, { once: true });
  }
})();
