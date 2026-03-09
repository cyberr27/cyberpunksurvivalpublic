// neon_npc.js — оптимизированная версия (2025–2026)

const NEON_NPC = {
  name: "Neon",
  spriteKey: "alexNeonSprite",
  photoKey: "alexNeonFoto",
  x: 20,
  y: 2626,

  // Размеры на экране (можно менять)
  width: 80,
  height: 80,

  // Реальные размеры кадра в спрайтшите
  spriteWidth: 70,
  spriteHeight: 70,

  interactionRadius: 50,

  speed: 0.04,
  targetA: { x: 20, y: 2626 },
  targetB: { x: 2222, y: 2150 },
  movingToB: true,
  isWaiting: true,
  waitDuration: 20000,
  waitTimer: 0,

  // Анимация
  animationTime: 0,
  currentFrame: 0,
  direction: "right",
  state: "idle",

  isPlayerNear: false,
  isDialogOpen: false,
  isMet: false,
};

const NEON_FRAMES_PER_ROW = 13;
const NEON_FRAME_DURATION = 120;
const NEON_ANIMATION_ROW_DURATION = NEON_FRAMES_PER_ROW * NEON_FRAME_DURATION;

let neonButtonsContainer = null;
let activeDialog = null;
let rejectionShownThisApproach = false;
let firstMeetingDialogClosed = false;
let questProgressElement = null;

const NEON_QUESTS = [
  {
    id: "neon_quest_1",
    title: "Очистка пустошей",
    description:
      "Сектор кишит мутантами. Убей 3 штуки — докажи, что не бесполезен.",
    goal: { killMutants: 3 },
    reward: { xp: 150, balyary: 50 },
  },
];

const CURRENT_QUEST = NEON_QUESTS[0];

// ==================== ПРОГРЕСС КВЕСТА В ЧАТЕ ====================

function createQuestProgressInChat() {
  if (questProgressElement) return;

  const chatMessages = document.getElementById("chatMessages");
  if (!chatMessages) return;

  questProgressElement = document.createElement("div");
  questProgressElement.id = "neonQuestProgress";
  questProgressElement.style.cssText = `
    background: linear-gradient(90deg, #00ffff, #0088ff);
    color: black;
    font-weight: bold;
    padding: 8px 12px;
    border-radius: 8px;
    margin: 8px 0;
    text-align: center;
    font-size: 14px;
    box-shadow: 0 0 10px #00ffff;
    pointer-events: none;
    opacity: 0.95;
  `;
  chatMessages.appendChild(questProgressElement);
  updateQuestProgressDisplay();
}

function updateQuestProgressDisplay() {
  if (!questProgressElement) return;

  const me = players.get(myId);
  const questData = me?.neonQuest;
  const isActive = questData?.currentQuestId === CURRENT_QUEST.id;
  const kills = questData?.progress?.killMutants || 0;
  const needed = CURRENT_QUEST.goal.killMutants;

  if (!isActive) {
    questProgressElement.style.display = "none";
    return;
  }

  if (kills < needed) {
    questProgressElement.textContent = `${CURRENT_QUEST.title}: ${kills}/${needed} мутантов убито`;
    questProgressElement.style.background =
      "linear-gradient(90deg, #00ffff, #0088ff)";
    questProgressElement.style.boxShadow = "0 0 10px #00ffff";
  } else {
    questProgressElement.textContent = `${CURRENT_QUEST.title}: ГОТОВО! Вернись к Neon Alex`;
    questProgressElement.style.background =
      "linear-gradient(90deg, #00ff00, #00cc00)";
    questProgressElement.style.boxShadow = "0 0 15px #00ff00";
  }

  questProgressElement.style.display = "block";

  const chatMessages = document.getElementById("chatMessages");
  if (chatMessages) chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeQuestProgressFromChat() {
  if (questProgressElement) {
    questProgressElement.remove();
    questProgressElement = null;
  }
}

// ==================== ДИАЛОГИ ====================

function closeActiveDialog() {
  if (activeDialog) {
    activeDialog.remove();
    activeDialog = null;
  }
  NEON_NPC.isDialogOpen = false;
}

function openFirstMeetingDialog() {
  closeActiveDialog();
  activeDialog = document.createElement("div");
  activeDialog.className = "npc-dialog";
  activeDialog.innerHTML = `
    <div class="npc-dialog-header">
      <img src="${images[NEON_NPC.photoKey].src}" class="npc-photo">
      <h2 class="npc-title">${NEON_NPC.name}</h2>
    </div>
    <div class="npc-dialog-content">
      <div class="npc-text">
        Новое лицо в секторе 7? Редкость...<br><br>
        Меня зовут Neon Alex. Если выживешь — поговорим.
      </div>
    </div>
    <button class="neon-btn" onclick="closeFirstMeetingAndEnableButtons()">Понял</button>
  `;
  document.body.appendChild(activeDialog);
  NEON_NPC.isDialogOpen = true;
}

window.closeFirstMeetingAndEnableButtons = () => {
  closeActiveDialog();
  NEON_NPC.isMet = true;
  firstMeetingDialogClosed = true;
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "meetNeonAlex" }));
  }
};

function openRejectionDialog() {
  closeActiveDialog();
  activeDialog = document.createElement("div");
  activeDialog.className = "npc-dialog";
  activeDialog.innerHTML = `
    <div class="npc-dialog-header">
      <img src="${images[NEON_NPC.photoKey].src}" class="npc-photo">
      <h2 class="npc-title">${NEON_NPC.name}</h2>
    </div>
    <div class="npc-dialog-content">
      <div class="npc-text">
        Мне нужен тот кто хотя бы может держать кастеты в руках...
      </div>
    </div>
    <button class="neon-btn" onclick="closeActiveDialog()">Уйти</button>
  `;
  document.body.appendChild(activeDialog);
  NEON_NPC.isDialogOpen = true;
}

function openNeonTalkDialog() {
  closeActiveDialog();
  activeDialog = document.createElement("div");
  activeDialog.className = "npc-dialog";

  let topicsHTML = "";
  const topics = [
    {
      title: "О городе",
      text: "Этот город никогда не спит. Здесь либо ты ешь, либо тебя едят.",
    },
    {
      title: "Кто ты такой?",
      text: "Я — Neon Alex. Был когда-то хакером высшего звена, теперь просто пытаюсь выжить.",
    },
    {
      title: "Где мы?",
      text: "Заброшенный сектор 7. Корпорации бросили его лет 15 назад. Теперь здесь только мы и мутанты.",
    },
    {
      title: "Что с корпорациями?",
      text: "Они всё ещё наверху, в небоскрёбах. Сюда спускаются только за редкими ресурсами… или за нами.",
    },
    {
      title: "Как выживать?",
      text: "Не доверяй никому. Держи нож за спиной, а глаза открытыми. И никогда не пей воду из открытых источников.",
    },
    {
      title: "Есть ли выход?",
      text: "Говорят, в старом метро есть туннель на поверхность. Но туда никто не возвращался.",
    },
    {
      title: "Твоя история",
      text: "Я украл у них данные, которые стоили миллиарды. Теперь я в розыске. А ты… ты тоже беглец?",
    },
    {
      title: "О мутантах",
      text: "Радиация, эксперименты, химия… всё вместе. Некоторые ещё помнят, что были людьми.",
    },
    {
      title: "Зачем ты здесь?",
      text: "Жду человека, который сможет вытащить меня отсюда. Может, это ты?",
    },
  ];

  topics.forEach((t) => {
    topicsHTML += `<div class="talk-topic" onclick="showTopicText('${t.title}', \`${t.text}\`)">${t.title}</div>`;
  });

  activeDialog.innerHTML = `
    <div class="npc-dialog-header">
      <img src="${images[NEON_NPC.photoKey].src}" class="npc-photo">
      <h2 class="npc-title">${NEON_NPC.name}</h2>
    </div>
    <div class="npc-dialog-content">
      <div class="talk-topics" id="neonTopicsList">${topicsHTML}</div>
      <div class="npc-text fullscreen" id="neonTopicText" style="display:none;"></div>
    </div>
    <button class="neon-btn" onclick="closeActiveDialog()">Закрыть</button>
  `;
  document.body.appendChild(activeDialog);
  NEON_NPC.isDialogOpen = true;
}

window.showTopicText = (title, text) => {
  document.getElementById("neonTopicsList").classList.add("hidden");
  const el = document.getElementById("neonTopicText");
  el.style.display = "flex";
  el.innerHTML = `<b>${title}</b><br><br>${text}`;
};

// ==================== КВЕСТЫ ====================

function openNeonQuestDialog() {
  closeActiveDialog();
  activeDialog = document.createElement("div");
  activeDialog.className = "npc-dialog";

  const me = players.get(myId);
  const q = me?.neonQuest || {
    currentQuestId: null,
    progress: {},
    completed: [],
  };
  const isActive = q.currentQuestId === CURRENT_QUEST.id;
  const isCompleted = q.completed?.includes(CURRENT_QUEST.id);
  const kills = q.progress?.killMutants || 0;
  const needed = CURRENT_QUEST.goal.killMutants;

  let statusHTML = "";
  let buttonHTML = "";

  if (isCompleted) {
    statusHTML = `<span style="color:#00ff00;font-weight:bold;">Задание уже выполнено</span>`;
    buttonHTML = `<button class="neon-btn" disabled style="opacity:0.6;cursor:not-allowed;">Сдать</button>`;
  } else if (isActive) {
    if (kills >= needed) {
      statusHTML = `<span style="color:#00ff00;font-weight:bold;">Прогресс: ${kills}/${needed} — ГОТОВО!</span>`;
      buttonHTML = `<button class="neon-btn" onclick="completeNeonQuest()">Сдать задание</button>`;
    } else {
      statusHTML = `Прогресс: ${kills}/${needed} мутантов убито`;
      buttonHTML = `<button class="neon-btn" disabled style="opacity:0.6;cursor:not-allowed;">Сдать</button>`;
    }
  } else {
    statusHTML = "Задание ещё не взято";
    buttonHTML = `<button class="neon-btn" onclick="acceptNeonQuest()">Взять задание</button>`;
  }

  activeDialog.innerHTML = `
    <div class="npc-dialog-header">
      <img src="${images[NEON_NPC.photoKey].src}" class="npc-photo">
      <h2 class="npc-title">${NEON_NPC.name}</h2>
    </div>
    <div class="npc-dialog-content">
      <div class="npc-text" style="line-height:1.6;">
        <strong>${CURRENT_QUEST.title}</strong><br><br>
        ${CURRENT_QUEST.description}<br><br>
        <strong>${statusHTML}</strong>
      </div>
    </div>
    <div style="text-align:center;padding:10px;">
      ${buttonHTML}
    </div>
  `;

  document.body.appendChild(activeDialog);
  NEON_NPC.isDialogOpen = true;
}

window.acceptNeonQuest = () => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "neonQuestAccept" }));
  }
  closeActiveDialog();
  createQuestProgressInChat();
};

window.completeNeonQuest = () => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "neonQuestComplete" }));
  }
  closeActiveDialog();
};

// ==================== КНОПКИ ====================

function createNeonButtons(screenX, screenY) {
  if (neonButtonsContainer) return;

  neonButtonsContainer = document.createElement("div");
  neonButtonsContainer.className = "npc-buttons-container";
  neonButtonsContainer.style.left = `${screenX + 35}px`;
  neonButtonsContainer.style.top = `${screenY - 90}px`;

  const talkBtn = document.createElement("div");
  talkBtn.className = "npc-button npc-talk-btn";
  talkBtn.textContent = "Поговорить";
  talkBtn.onclick = (e) => {
    e.stopPropagation();
    openNeonTalkDialog();
  };

  const questBtn = document.createElement("div");
  questBtn.className = "npc-button npc-quests-btn";
  questBtn.textContent = "Задания";
  questBtn.onclick = (e) => {
    e.stopPropagation();
    openNeonQuestDialog();
  };

  neonButtonsContainer.append(talkBtn, questBtn);
  document.body.appendChild(neonButtonsContainer);
}

function removeNeonButtons() {
  if (neonButtonsContainer) {
    neonButtonsContainer.remove();
    neonButtonsContainer = null;
  }
}

// ==================== ОБНОВЛЕНИЕ И ДВИЖЕНИЕ ====================

function updateNeonNpc(deltaTime) {
  if (window.worldSystem.currentWorldId !== 0) return;

  const me = players.get(myId);
  if (!me) return;

  // ─── Проверка близости ───────────────────────────────────────
  const dx = me.x - NEON_NPC.x;
  const dy = me.y - NEON_NPC.y;
  const dist = Math.hypot(dx, dy);
  const nowNear = dist < NEON_NPC.interactionRadius;

  if (nowNear !== NEON_NPC.isPlayerNear) {
    NEON_NPC.isPlayerNear = nowNear;
    // Сброс флага отказа при уходе
    if (!nowNear) rejectionShownThisApproach = false;
  }

  // ─── Движение только если игрок далеко и нет диалога ────────
  if (!NEON_NPC.isPlayerNear && !NEON_NPC.isDialogOpen) {
    if (NEON_NPC.isWaiting) {
      NEON_NPC.waitTimer += deltaTime;
      if (NEON_NPC.waitTimer >= NEON_NPC.waitDuration) {
        NEON_NPC.isWaiting = false;
        NEON_NPC.waitTimer = 0;
        NEON_NPC.movingToB = !NEON_NPC.movingToB;
      }
    } else {
      const target = NEON_NPC.movingToB ? NEON_NPC.targetB : NEON_NPC.targetA;
      const tdx = target.x - NEON_NPC.x;
      const tdy = target.y - NEON_NPC.y;
      const tdist = Math.hypot(tdx, tdy);

      if (tdist > 5) {
        NEON_NPC.x += (tdx / tdist) * NEON_NPC.speed * deltaTime;
        NEON_NPC.y += (tdy / tdist) * NEON_NPC.speed * deltaTime;
        NEON_NPC.state = "walking";

        // Определяем направление
        if (Math.abs(tdx) > Math.abs(tdy)) {
          NEON_NPC.direction = tdx > 0 ? "right" : "left";
        } else {
          NEON_NPC.direction = tdy > 0 ? "down" : "up";
        }
      } else {
        NEON_NPC.isWaiting = true;
        NEON_NPC.state = "idle";
      }
    }
  } else {
    NEON_NPC.state = "idle";
  }

  // ─── Анимация ходьбы (независимо от пауз) ────────────────────
  if (NEON_NPC.isPlayerNear) {
    // Игрок рядом → показываем 5-ю строку (индекс 4), кадр 0
    const rowIndexWhenNear = 4;
    NEON_NPC.currentFrame = rowIndexWhenNear * NEON_FRAMES_PER_ROW + 0;
    NEON_NPC.animationTime = 0;
  } else {
    // Обычная логика патрулирования
    NEON_NPC.animationTime += deltaTime;

    let rowIndex = 0;

    if (NEON_NPC.isWaiting) {
      // Стоим
      if (NEON_NPC.movingToB) {
        // Точка A → 4-я строка (индекс 3)
        rowIndex = 2;
      } else {
        // Точка B → 3-я строка (индекс 2)
        rowIndex = 3;
      }
    } else {
      // Движемся
      if (NEON_NPC.movingToB) {
        // A → B → 2-я строка (индекс 1)
        rowIndex = 1;
      } else {
        // B → A → 1-я строка (индекс 0)
        rowIndex = 0;
      }
    }

    // Кадр внутри строки (циклически)
    const frameInRow =
      Math.floor(NEON_NPC.animationTime / NEON_FRAME_DURATION) %
      NEON_FRAMES_PER_ROW;

    NEON_NPC.currentFrame = rowIndex * NEON_FRAMES_PER_ROW + frameInRow;
  }

  // Направление оставляем для совместимости (хотя сейчас не используется)
  if (!NEON_NPC.isWaiting && !NEON_NPC.isPlayerNear) {
    const target = NEON_NPC.movingToB ? NEON_NPC.targetB : NEON_NPC.targetA;
    const tdx = target.x - NEON_NPC.x;
    if (Math.abs(tdx) > 5) {
      NEON_NPC.direction = tdx > 0 ? "right" : "left";
    }
  }
}

function drawNeonNpc() {
  if (window.worldSystem.currentWorldId !== 0) return;

  const camera = window.movementSystem.getCamera();
  const screenX = NEON_NPC.x - camera.x;
  const screenY = NEON_NPC.y - camera.y - 30;

  // cull
  if (
    screenX < -100 ||
    screenX > canvas.width + 100 ||
    screenY < -100 ||
    screenY > canvas.height + 100
  ) {
    removeNeonButtons();
    return;
  }

  const sprite = images[NEON_NPC.spriteKey];

  if (sprite?.complete) {
    // Вычисляем координаты кадра в спрайтшите
    const row = Math.floor(NEON_NPC.currentFrame / NEON_FRAMES_PER_ROW);
    const frameInRow = NEON_NPC.currentFrame % NEON_FRAMES_PER_ROW;

    const sourceX = frameInRow * NEON_NPC.spriteWidth;
    const sourceY = row * NEON_NPC.spriteHeight;

    ctx.drawImage(
      sprite,
      sourceX,
      sourceY,
      NEON_NPC.spriteWidth,
      NEON_NPC.spriteHeight,
      screenX,
      screenY,
      NEON_NPC.width, // размер на экране
      NEON_NPC.height,
    );
  } else {
    ctx.fillStyle = "#00ffff";
    ctx.fillRect(screenX, screenY, NEON_NPC.width, NEON_NPC.height);
    ctx.fillStyle = "#000";
    ctx.font = "30px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      "NA",
      screenX + NEON_NPC.width / 2,
      screenY + NEON_NPC.height / 2 + 10,
    );
  }

  // Имя над головой
  ctx.fillStyle = NEON_NPC.isMet ? "#00ffff" : "#ffffff";
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(
    NEON_NPC.isMet ? NEON_NPC.name : "?",
    screenX + 35,
    screenY - 35,
  );

  // ─── Логика взаимодействия ───────────────────────────────────
  const player = players.get(myId);
  const level = player?.level || 0;

  if (NEON_NPC.isPlayerNear) {
    if (level < 2) {
      if (!rejectionShownThisApproach && !NEON_NPC.isDialogOpen) {
        openRejectionDialog();
        rejectionShownThisApproach = true;
      }
      removeNeonButtons();
    } else {
      if (!NEON_NPC.isMet && !NEON_NPC.isDialogOpen) {
        openFirstMeetingDialog();
        removeNeonButtons();
      } else if (NEON_NPC.isMet && !NEON_NPC.isDialogOpen) {
        createNeonButtons(screenX, screenY);
      }
      if (NEON_NPC.isDialogOpen) {
        removeNeonButtons();
      }
    }
  } else {
    if (NEON_NPC.isDialogOpen) {
      closeActiveDialog();
    }
    removeNeonButtons();
  }
}

// ==================== СИНХРОНИЗАЦИЯ С СЕРВЕРОМ ====================

if (typeof ws !== "undefined") {
  ws.addEventListener("message", (e) => {
    try {
      const data = JSON.parse(e.data);

      if (
        data.type === "loginSuccess" ||
        (data.type === "update" && data.player?.id === myId)
      ) {
        const player = data.type === "loginSuccess" ? data : data.player;
        NEON_NPC.isMet = !!player.alexNeonMet;
        firstMeetingDialogClosed = !!player.alexNeonMet;

        if (!player.neonQuest) {
          player.neonQuest = {
            currentQuestId: null,
            progress: {},
            completed: [],
          };
        }

        if (player.neonQuest.currentQuestId === CURRENT_QUEST.id) {
          createQuestProgressInChat();
          updateQuestProgressDisplay();
        } else {
          removeQuestProgressFromChat();
        }
      }

      if (data.type === "neonQuestProgressUpdate") {
        const me = players.get(myId);
        if (me?.neonQuest?.currentQuestId === CURRENT_QUEST.id) {
          me.neonQuest.progress = {
            ...me.neonQuest.progress,
            ...data.progress,
          };
          updateQuestProgressDisplay();
        }
      }

      if (data.type === "neonQuestStarted") {
        showNotification("Задание взято: Очистка пустошей", "#00ff44");
        createQuestProgressInChat();
      }

      if (data.type === "neonQuestCompleted") {
        showNotification(`Задание выполнено! +150 XP | +50 баляров`, "#00ffff");
        removeQuestProgressFromChat();

        if (window.levelSystem) {
          window.levelSystem.setLevelData(
            data.level,
            data.xp,
            data.xpToNextLevel,
            data.upgradePoints,
          );
          window.levelSystem.showXPEffect(150);
        }
        if (data.inventory) {
          inventory = data.inventory;
          updateInventoryDisplay();
        }
      }
    } catch (err) {
      console.error("Neon Alex error:", err);
    }
  });
}

window.neonNpcSystem = {
  update: updateNeonNpc,
  draw: drawNeonNpc,
};
