// potionNpc.js — Полная версия с квестом "Потерянная книга Алхимика"

const POTION_NPC = {
  name: "Potion",
  spriteKey: "old_man_with_potions",
  x: 290,
  y: 2915,
  width: 90,
  height: 90,
  spriteWidth: 70,
  spriteHeight: 70,
  interactionRadius: 55,

  // === ТОЧКИ ДВИЖЕНИЯ ===
  targetA: { x: 290, y: 2915 },
  targetB: { x: 1194, y: 2810 },
  targetC: { x: 1656, y: 2449 }, // НОВАЯ ТОЧКА

  movingToB: true,
  currentTarget: "A", // "A" или "C" после квеста
  isWaiting: true,
  waitDuration: 3000, // 3 секунды до квеста
  waitDurationAfterQuest: 180000, // 3 минуты после квеста
  waitTimer: 0,

  animationTime: 0,
  currentFrame: 0,
  direction: "right",
  state: "idle",

  isPlayerNear: false,
  isDialogOpen: false,
  isMet: false,
  hasGreetingShownThisApproach: false, // не открывать диалог повторно, пока не вышли из зоны
};

const POTION_FRAMES_PER_ROW = 13;
const POTION_FRAME_DURATION = 160;

let potionButtonsContainer = null;
let activePotionDialog = null;
let potionQuestProgressElement = null;

function createPotionQuestProgressInChat() {
  if (potionQuestProgressElement) return;
  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) return;

  potionQuestProgressElement = document.createElement("div");
  potionQuestProgressElement.id = "potionQuestProgress";
  potionQuestProgressElement.style.cssText = `
    background: linear-gradient(90deg, #00ff88, #00ccff);
    color: black;
    font-weight: bold;
    padding: 8px 12px;
    border-radius: 8px;
    margin: 8px 0;
    text-align: center;
    font-size: 14px;
    box-shadow: 0 0 10px #00ff88;
    pointer-events: none;
    opacity: 0.95;
  `;
  chatMessages.appendChild(potionQuestProgressElement);
  updatePotionQuestProgressDisplay();
}

function updatePotionQuestProgressDisplay() {
  if (!potionQuestProgressElement) return;
  const me = players.get(myId);
  const questData = me?.potionQuest;
  const isActive = questData?.currentQuestId === "potion_quest_1";

  if (!isActive) {
    potionQuestProgressElement.style.display = "none";
    return;
  }

  const hasBook = me.inventory.some(
    (slot) => slot && slot.type === "potion_book",
  );

  potionQuestProgressElement.style.display = "block";
  if (hasBook) {
    potionQuestProgressElement.innerHTML =
      "📖 Книга найдена! Вернись к Алхимику (1/1)";
  } else {
    potionQuestProgressElement.innerHTML =
      "🔍 Ищи потерянную книгу Алхимика...";
  }
}

function removePotionQuestProgressFromChat() {
  if (potionQuestProgressElement) {
    potionQuestProgressElement.remove();
    potionQuestProgressElement = null;
  }
}

function createPotionButtons(screenX, screenY) {
  if (potionButtonsContainer) return;
  const zoom = window.movementSystem?.getZoom?.() || 1;

  potionButtonsContainer = document.createElement("div");
  potionButtonsContainer.className = "npc-buttons-container";
  potionButtonsContainer.style.left = `${(screenX + 40) * zoom}px`;
  potionButtonsContainer.style.top = `${(screenY - 95) * zoom}px`;

  const talkBtn = document.createElement("div");
  talkBtn.className = "npc-button npc-talk-btn";
  talkBtn.onclick = (e) => {
    e.stopPropagation();
    openPotionTalkDialog(0);
  };

  const potionsBtn = document.createElement("div");
  potionsBtn.className = "npc-button potion-quests-btn";
  potionsBtn.onclick = (e) => {
    e.stopPropagation();
    openPotionTalkDialog(1);
  };

  const questsBtn = document.createElement("div");
  questsBtn.className = "npc-button npc-quests-btn";
  questsBtn.onclick = (e) => {
    e.stopPropagation();
    openPotionTalkDialog(2);
  };

  potionButtonsContainer.append(talkBtn, potionsBtn, questsBtn);
  document.body.appendChild(potionButtonsContainer);
}

function removePotionButtons() {
  if (potionButtonsContainer) {
    potionButtonsContainer.remove();
    potionButtonsContainer = null;
  }
}

function closePotionDialog() {
  if (activePotionDialog) {
    activePotionDialog.remove();
    activePotionDialog = null;
  }
  POTION_NPC.isDialogOpen = false;
}

// ==================== ДИНАМИЧЕСКИЙ ДИАЛОГ ====================
function openPotionTalkDialog(option = 0) {
  closePotionDialog();
  const me = players.get(myId);
  if (!me) return;

  activePotionDialog = document.createElement("div");
  activePotionDialog.className = "npc-dialog potion-dialog";

  let content = "";
  let buttons = "";

  const hasBook = me.inventory.some(
    (slot) => slot && slot.type === "potion_book",
  );
  const questActive = me.potionQuest?.currentQuestId === "potion_quest_1";
  const questCompleted = me.potionQuest?.completed?.includes("potion_quest_1");

  // === КВЕСТОВЫЕ СОСТОЯНИЯ (оставляем как было) ===
  if (!POTION_NPC.isMet && !questActive && !questCompleted) {
    if (!me.corporateDocumentsSubmitted) {
      activePotionDialog.className = "npc-dialog potion-dialog0";
      buttons = `<button class="potion-ok-btn" onclick="closePotionDialog()"></button>`;
    } else {
      activePotionDialog.className = "npc-dialog potion-dialog1";
      buttons = `
        <button class="potion-yes-btn" onclick="acceptPotionQuest()"></button>
        <button class="potion-cancel-btn" onclick="closePotionDialog()"></button>
      `;
    }
  } else if (questActive && !hasBook) {
    activePotionDialog.className = "npc-dialog potion-dialog2";
  } else if (questActive && hasBook) {
    activePotionDialog.className = "npc-dialog potion-dialog3";
    buttons = `<button class="potion-return-book" onclick="completePotionQuest()"></button>
    <button class="potion-cancel-btn" onclick="closePotionDialog()"></button>
    `;
  }
  // === ПОСЛЕ КВЕСТА (isMet === true) ===
  else if (POTION_NPC.isMet) {
    // Выбор фона в зависимости от нажатой кнопки
    if (option === 0) {
      // Полноценный talk с 6 темами (как у Thimblerigger)
      openPotionTalkTopics();
      return; // важно — не продолжаем дальше и не ставим простой content
    } else if (option === 1) {
      activePotionDialog.className =
        "npc-dialog potion-dialog potion-dialog-potions";
      content = `<p class="potion-text">Зелья будут доступны позже.</p>`;
    } else if (option === 2) {
      activePotionDialog.className =
        "npc-dialog potion-dialog potion-dialog-quests";
      content = `<p class="potion-text">Дополнительные задания будут позже.</p>`;
    }

    buttons = `<button class="neon-btn-thimblerigger" onclick="closePotionDialog()"></button>`;
  }

  activePotionDialog.innerHTML = `
    <div class="npc-dialog-header"></div>
    <div class="npc-dialog-content">${content}</div>
    ${buttons}
  `;

  document.body.appendChild(activePotionDialog);
  POTION_NPC.isDialogOpen = true;

  if (window.npcDialogSystem) window.npcDialogSystem.currentOpenNpc = "potion";
}

function openPotionTalkTopics() {
  closePotionDialog(); // на всякий случай чистим предыдущий

  activePotionDialog = document.createElement("div");
  activePotionDialog.className =
    "npc-dialog open potion-dialog potion-dialog-talk";
  activePotionDialog.style.backgroundImage = `url(${images.potionTalkBg?.src || "potion-talk-bg.png"})`;
  activePotionDialog.style.backgroundSize = "cover";
  activePotionDialog.style.backgroundPosition = "center";
  activePotionDialog.dataset.npc = "potion-talk";

  activePotionDialog.innerHTML = `
    <div class="npc-dialog-content">
      <div id="potionTalkTopics" class="potion-talk-topics"></div>
    </div>
    <button id="potionCloseTalkBtn" class="neon-btn-thimblerigger"></button>
  `;

  document.body.appendChild(activePotionDialog);
  POTION_NPC.isDialogOpen = true;

  if (window.npcDialogSystem) window.npcDialogSystem.currentOpenNpc = "potion";

  const topicsContainer = document.getElementById("potionTalkTopics");
  const closeBtn = document.getElementById("potionCloseTalkBtn");

  const topics = [
    {
      title: "О себе",
      text: "Когда-то меня звали алхимиком Верхних уровней. Теперь я просто Potion — старик с котлами и запахом реагентов. Город забрал всё, кроме знаний и этой книги, которую ты мне вернул.",
    },
    {
      title: "О зельях",
      text: "Зелья — это не магия, а точный расчёт. Один неправильный кристалл — и вместо лечения получишь яд. Я делаю только то, что работает. Остальное — для шарлатанов с неоновых вывесок.",
    },
    {
      title: "О Неоновом городе",
      text: "Город светится, но внутри гниёт. Корпорации покупают жизнь, банды продают смерть, а мы, старые крысы, варим то, что помогает выжить ещё один день. Неон не лечит — он только маскирует раны.",
    },
    {
      title: "О книге",
      text: "Та книга — не просто рецепты. В ней записаны формулы, которые корпорации хотели бы стереть. Спасибо, что вернул. Без неё я был бы просто нищим стариком у трубы.",
    },
    {
      title: "Советы сталкеру",
      text: "Не пей то, что светится слишком ярко. Не доверяй зельям без запаха. И всегда носи с собой антидот — в этом городе яд встречается чаще, чем чистая вода.",
    },
    {
      title: "О будущем",
      text: "Когда-нибудь неон погаснет, и те, кто умеет варить настоящие зелья, снова станут нужны. А пока я сижу здесь и жду тех, кто ещё помнит, что такое настоящая алхимия.",
    },
  ];

  topics.forEach((topic) => {
    const div = document.createElement("div");
    div.className = "potion-talk-topic";
    div.innerHTML = `<strong class="potion-talk-topic-title">${topic.title}</strong>`;

    div.addEventListener("click", () => {
      topicsContainer.classList.add("hidden");

      const npcContent = activePotionDialog.querySelector(
        ".npc-dialog-content",
      );
      npcContent.innerHTML = `
        <div class="potion-fullscreen">
          <div class="potion-talk-text-content">${topic.text}</div>
        </div>
      `;
      closeBtn.onclick = () => showPotionTopics();
    });

    topicsContainer.appendChild(div);
  });

  function showPotionTopics() {
    topicsContainer.classList.remove("hidden");
    const npcContent = activePotionDialog.querySelector(".npc-dialog-content");

    npcContent.innerHTML = `<div id="potionTalkTopics" class="potion-talk-topics"></div>`;

    const newTopicsContainer = document.getElementById("potionTalkTopics");
    topics.forEach((topic) => {
      const div = document.createElement("div");
      div.className = "potion-talk-topic";
      div.innerHTML = `<strong class="potion-talk-topic-title">${topic.title}</strong>`;
      div.addEventListener("click", () => {
        newTopicsContainer.classList.add("hidden");
        npcContent.innerHTML = `
          <div class="potion-fullscreen">
            <div class="potion-talk-text-content">${topic.text}</div>
          </div>
        `;
        closeBtn.onclick = () => showPotionTopics();
      });
      newTopicsContainer.appendChild(div);
    });

    closeBtn.onclick = closePotionDialog;
  }

  closeBtn.onclick = closePotionDialog;
}

// ==================== КВЕСТ ФУНКЦИИ ====================
window.acceptPotionQuest = () => {
  closePotionDialog();
  createPotionQuestProgressInChat();

  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "potionQuestAccept" }));
  }

  setTimeout(() => {
    if (window.potionNpcSystem?.refreshDialog) {
      window.potionNpcSystem.refreshDialog();
    } else if (window.npcDialogSystem) {
      window.npcDialogSystem.refreshCurrentDialog();
    }
  }, 30);
};

window.completePotionQuest = () => {
  closePotionDialog();
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "potionQuestComplete" }));
  }
};

// ==================== ОБНОВЛЕНИЕ ====================
function refreshPotionDialog() {
  updatePotionQuestProgressDisplay();

  if (activePotionDialog && POTION_NPC.isDialogOpen) {
    openPotionTalkDialog(0);
  } else if (POTION_NPC.isPlayerNear) {
    openPotionTalkDialog(0);
  }
}

function updatePotionNpc(deltaTime) {
  if (window.worldSystem.currentWorldId !== 0) return;

  const me = players.get(myId);
  if (!me) return;

  POTION_NPC.isMet = !!me.potionMet;

  const dx = me.x - POTION_NPC.x;
  const dy = me.y - POTION_NPC.y;
  const dist = Math.hypot(dx, dy);
  const nowNear = dist < POTION_NPC.interactionRadius;

  if (nowNear !== POTION_NPC.isPlayerNear) {
    POTION_NPC.isPlayerNear = nowNear;
  }

  // === ЛОГИКА ДВИЖЕНИЯ ===
  if (!POTION_NPC.isPlayerNear && !POTION_NPC.isDialogOpen) {
    const isAfterQuest = POTION_NPC.isMet;

    if (POTION_NPC.isWaiting) {
      POTION_NPC.waitTimer += deltaTime;

      const currentWait = isAfterQuest
        ? POTION_NPC.waitDurationAfterQuest
        : POTION_NPC.waitDuration;

      if (POTION_NPC.waitTimer >= currentWait) {
        POTION_NPC.isWaiting = false;
        POTION_NPC.waitTimer = 0;

        // Переключаем цель
        if (isAfterQuest) {
          POTION_NPC.currentTarget =
            POTION_NPC.currentTarget === "A" ? "C" : "A";
        } else {
          POTION_NPC.movingToB = !POTION_NPC.movingToB;
        }
      }
    } else {
      let target;
      if (isAfterQuest) {
        target =
          POTION_NPC.currentTarget === "A"
            ? POTION_NPC.targetA
            : POTION_NPC.targetC;
      } else {
        target = POTION_NPC.movingToB ? POTION_NPC.targetB : POTION_NPC.targetA;
      }

      const tdx = target.x - POTION_NPC.x;
      const tdy = target.y - POTION_NPC.y;
      const tdist = Math.hypot(tdx, tdy);

      if (tdist > 5) {
        POTION_NPC.x += (tdx / tdist) * 0.045 * deltaTime;
        POTION_NPC.y += (tdy / tdist) * 0.045 * deltaTime;
        POTION_NPC.state = "walking";
      } else {
        POTION_NPC.isWaiting = true;
        POTION_NPC.state = "idle";
      }
    }
  } else {
    POTION_NPC.state = "idle";
  }

  // === АНИМАЦИЯ ===
  POTION_NPC.animationTime += deltaTime;

  if (POTION_NPC.isPlayerNear) {
    // Ряд 4 — смотрит на игрока (полная анимация)
    const frameInRow =
      Math.floor(POTION_NPC.animationTime / POTION_FRAME_DURATION) %
      POTION_FRAMES_PER_ROW;
    POTION_NPC.currentFrame = 4 * POTION_FRAMES_PER_ROW + frameInRow;
  } else if (POTION_NPC.isWaiting) {
    // Стоит
    const row = POTION_NPC.isMet ? 3 : 0;
    POTION_NPC.currentFrame =
      row * POTION_FRAMES_PER_ROW +
      (Math.floor(POTION_NPC.animationTime / POTION_FRAME_DURATION) %
        POTION_FRAMES_PER_ROW);
  } else {
    // Идёт
    const row = POTION_NPC.isMet
      ? POTION_NPC.currentTarget === "A"
        ? 1
        : 2
      : POTION_NPC.movingToB
        ? 2
        : 1;

    POTION_NPC.currentFrame =
      row * POTION_FRAMES_PER_ROW +
      (Math.floor(POTION_NPC.animationTime / POTION_FRAME_DURATION) %
        POTION_FRAMES_PER_ROW);
  }
}

function drawPotionNpc() {
  if (window.worldSystem.currentWorldId !== 0) return;

  const camera = window.movementSystem.getCamera();
  const screenX = POTION_NPC.x - camera.x;
  const screenY = POTION_NPC.y - camera.y - 25;

  if (
    screenX < -120 ||
    screenX > canvas.width + 120 ||
    screenY < -120 ||
    screenY > canvas.height + 120
  ) {
    removePotionButtons();
    return;
  }

  const sprite = images[POTION_NPC.spriteKey];
  if (sprite?.complete) {
    const row = Math.floor(POTION_NPC.currentFrame / POTION_FRAMES_PER_ROW);
    const col = POTION_NPC.currentFrame % POTION_FRAMES_PER_ROW;

    ctx.drawImage(
      sprite,
      col * POTION_NPC.spriteWidth,
      row * POTION_NPC.spriteHeight,
      POTION_NPC.spriteWidth,
      POTION_NPC.spriteHeight,
      screenX,
      screenY,
      POTION_NPC.width,
      POTION_NPC.height,
    );
  } else {
    ctx.fillStyle = "#ff00ff";
    ctx.fillRect(screenX, screenY, POTION_NPC.width, POTION_NPC.height);
  }

  const showName = POTION_NPC.isMet;
  ctx.fillStyle = showName ? "#00ffff" : "#ffffff";
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(showName ? POTION_NPC.name : "?", screenX + 40, screenY - 30);

  if (POTION_NPC.isPlayerNear) {
    if (POTION_NPC.isMet) {
      createPotionButtons(screenX, screenY);
      if (POTION_NPC.isDialogOpen) removePotionButtons();
    } else {
      // Открываем диалог только один раз за подход
      if (
        !POTION_NPC.isDialogOpen &&
        !POTION_NPC.hasGreetingShownThisApproach
      ) {
        POTION_NPC.hasGreetingShownThisApproach = true;
        openPotionTalkDialog();
      }
    }
  } else {
    closePotionDialog();
    removePotionButtons();
    // Сбрасываем флаг — при следующем входе в зону диалог снова покажется
    POTION_NPC.hasGreetingShownThisApproach = false;
  }
}

// ==================== ОБРАБОТКА СООБЩЕНИЙ ====================
function handlePotionMessages(data) {
  try {
    if (data.type === "potionQuestStarted") {
      showNotification("Квест принят: Найти книгу Алхимика", "#00ff88");
      createPotionQuestProgressInChat();
      if (window.npcDialogSystem) window.npcDialogSystem.refreshCurrentDialog();
    }

    if (data.type === "potionQuestCompleted") {
      showNotification(`Книга сдана! +120 XP | +40 баляров`, "#00ffff");
      POTION_NPC.isMet = true;
      removePotionQuestProgressFromChat();

      if (data.inventory) {
        inventory = data.inventory.map((slot) => (slot ? { ...slot } : null));
        if (window.inventorySystem)
          window.inventorySystem.updateInventoryDisplay();
      }

      if (window.levelSystem) {
        window.levelSystem.setLevelData(
          data.level,
          data.xp,
          null,
          data.upgradePoints,
        );
        window.levelSystem.showXPEffect(120);
      }

      if (window.npcDialogSystem) window.npcDialogSystem.refreshCurrentDialog();
    }

    if (
      data.type === "potionQuestError" ||
      data.type === "potionQuestCompleteFailed"
    ) {
      showNotification(data.error || "Ошибка квеста", "#ff5555");
    }
  } catch (e) {
    console.error("Potion NPC message error:", e);
  }
}

function getPotionRenderData() {
  if (window.worldSystem?.currentWorldId !== 0) {
    return null;
  }

  const sprite = images[POTION_NPC.spriteKey];

  if (
    !sprite?.complete ||
    sprite.naturalWidth <= 0 ||
    sprite.naturalHeight <= 0
  ) {
    return null;
  }

  const row = Math.floor(POTION_NPC.currentFrame / POTION_FRAMES_PER_ROW);

  const frame = POTION_NPC.currentFrame % POTION_FRAMES_PER_ROW;

  return {
    id: "potion",
    type: "npc",
    visualType: "billboard",

    // Актуальная позиция движущегося NPC.
    x: POTION_NPC.x,
    y: POTION_NPC.y,

    worldId: 0,

    sprite,

    // Кадр внутри строки и номер строки.
    frame,
    row,

    frameCount: POTION_FRAMES_PER_ROW,

    frameWidth: POTION_NPC.spriteWidth,
    frameHeight: POTION_NPC.spriteHeight,

    displayWidth: POTION_NPC.width,
    displayHeight: POTION_NPC.height,
  };
}

// Экспорт
window.potionNpcSystem = {
  update: updatePotionNpc,

  // Визуальные данные для 3D billboard-рендерера.
  getRenderData: getPotionRenderData,

  /** Возвращает текущую мировую позицию (для depth-sort) */
  getPosition() {
    return { x: POTION_NPC.x, y: POTION_NPC.y };
  },

  /** Чистый draw без проверки worldId — вызывается из code.js после сортировки */
  drawSprite(camX, camY) {
    const screenX = POTION_NPC.x - camX;
    const screenY = POTION_NPC.y - camY - 25;

    if (
      screenX < -120 ||
      screenX > canvas.width + 120 ||
      screenY < -120 ||
      screenY > canvas.height + 120
    ) {
      removePotionButtons();
      return;
    }

    const sprite = images[POTION_NPC.spriteKey];
    if (sprite?.complete) {
      const row = Math.floor(POTION_NPC.currentFrame / POTION_FRAMES_PER_ROW);
      const col = POTION_NPC.currentFrame % POTION_FRAMES_PER_ROW;

      ctx.drawImage(
        sprite,
        col * POTION_NPC.spriteWidth,
        row * POTION_NPC.spriteHeight,
        POTION_NPC.spriteWidth,
        POTION_NPC.spriteHeight,
        screenX,
        screenY,
        POTION_NPC.width,
        POTION_NPC.height,
      );
    } else {
      ctx.fillStyle = "#ff00ff";
      ctx.fillRect(screenX, screenY, POTION_NPC.width, POTION_NPC.height);
    }

    const showName = POTION_NPC.isMet;
    ctx.fillStyle = showName ? "#00ffff" : "#ffffff";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(showName ? POTION_NPC.name : "?", screenX + 40, screenY - 30);

    // === Логика кнопок и диалогов (полностью сохранена) ===
    if (POTION_NPC.isPlayerNear) {
      if (POTION_NPC.isMet) {
        createPotionButtons(screenX, screenY);
        if (POTION_NPC.isDialogOpen) removePotionButtons();
      } else {
        // Открываем диалог только один раз за подход
        if (
          !POTION_NPC.isDialogOpen &&
          !POTION_NPC.hasGreetingShownThisApproach
        ) {
          POTION_NPC.hasGreetingShownThisApproach = true;
          openPotionTalkDialog();
        }
      }
    } else {
      closePotionDialog();
      removePotionButtons();
      // Сбрасываем флаг — при следующем входе в зону диалог снова покажется
      POTION_NPC.hasGreetingShownThisApproach = false;
    }
  },

  /** Старый draw оставляем для совместимости */
  draw() {
    if (window.worldSystem.currentWorldId !== 0) return;
    const cam = window.movementSystem.getCamera();
    this.drawSprite(cam.x, cam.y);
  },

  initialize: (sprite) => {
    images[POTION_NPC.spriteKey] = sprite;
  },
  refreshDialog: refreshPotionDialog,
  handleMessage: handlePotionMessages,
};

(function registerPotionNPCVisualProvider() {
  "use strict";

  function registerPotion3D() {
    const scene = window.sceneEntitySystem;
    const potion = window.potionNpcSystem;

    if (
      typeof scene?.registerNPCVisualProvider !== "function" ||
      typeof scene?.getRegisteredNPCIds !== "function" ||
      typeof potion?.getRenderData !== "function"
    ) {
      console.error("[Potion3D] Required visual provider API is unavailable.");

      return false;
    }

    const id = "potion";

    // Не допускаем повторной регистрации.
    if (scene.getRegisteredNPCIds().includes(id)) {
      return true;
    }

    // В реестре Copilot провайдер — объект с getRenderData().
    const success = scene.registerNPCVisualProvider(id, {
      getRenderData() {
        return potion.getRenderData();
      },
    });

    if (!success) {
      console.error("[Potion3D] Failed to register Potion NPC.");

      return false;
    }

    console.log("[Potion3D] Potion NPC registered successfully.");

    return true;
  }

  if (!registerPotion3D()) {
    window.addEventListener("load", registerPotion3D, { once: true });
  }
})();
