// thimblerigger.js — Напёрсточник в Неоновом городе (ПРОСТАЯ РАБОЧАЯ ИГРА)

const THIMBLERIGGER = {
  x: 350,
  y: 3740,
  width: 70,
  height: 70,
  interactionRadius: 50,
  name: "Thimble",
  worldId: 0,
};

window.getCorporateDocumentsStatus = () => {
  const me = players.get(myId);
  return me?.corporateDocumentsSubmitted === true;
};

let isThimbleriggerMet = false;
let isThimbleriggerDialogOpen = false;
let isPlayerNearThimblerigger = false;
let hasGreetingBeenShownThisSession = false;

let thimbleriggerSprite = null;
let thimbleriggerButtonsContainer = null;

// Анимация NPC (без изменений)
let thimbleriggerFrame = 0;
let thimbleriggerFrameTime = 0;
const FRAME_DURATION_Thimble = 180;
const TOTAL_FRAMES = 13;
const MAX_DELTA_TIME = 1000;

let animationCycleTime = 0;
const ATTRACT_PHASE_DURATION = 10000;
const IDLE_PHASE_DURATION = 10000;
let currentPhase = "attract";

let gameDialog = null;
let greetingDialog = null;
let lastSelectedCup = -1;

// Подключаем CSS (без изменений)
(() => {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "thimblerigger.css";
  document.head.appendChild(link);
})();

function openThimbleriggerGame() {
  if (isThimbleriggerDialogOpen) return;
  isThimbleriggerDialogOpen = true;
  document.body.classList.add("npc-dialog-active");
  gameActive = false;

  const isDoc = !window.getCorporateDocumentsStatus?.();

  gameDialog = document.createElement("div");
  gameDialog.className = "npc-dialog open";
  gameDialog.style.backgroundImage = `url(${isDoc ? images.thimbleriggerDocBg.src : images.thimbleriggerGameBg.src})`;
  gameDialog.style.backgroundSize = "cover";
  gameDialog.style.backgroundPosition = "center";
  gameDialog.innerHTML = `
    <div class="npc-dialog-content" style="display:flex;flex-direction:column;gap:15px;">
      <div style="text-align:center;">
        <input type="number" min="1" max="100" value="50" id="betInput" class="bet-input" style="padding:8px;font-size:16px;text-align:center;">  
        <button class="neon-btn-thimblerigger-play-ok" id="startBtn" style="margin-left:15px;padding:12px 24px;"></button>

      <div class="thimble-game-container" id="gameArea">
        <div class="game-message" id="msg"></div>
      </div>

      <button class="neon-btn-neon" onclick="window.thimbleriggerSystem.closeDialog()"></button>
    </div>
  `;
  document.body.appendChild(gameDialog);

  const startBtn = gameDialog.querySelector("#startBtn");
  startBtn.onclick = () => {
    const bet = parseInt(gameDialog.querySelector("#betInput").value) || 50;
    if (bet < 1 || bet > 100) return alert("Ставка от 1 до 100 баляров!");

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "thimbleriggerBet", bet }));
    } else {
      alert("Соединение с сервером потеряно.");
    }
  };
}

// === НОВАЯ ВЕРСИЯ startSimpleGame — использует swapSequence с сервера ===
function startSimpleGame(swapSequence) {
  const area = document.getElementById("gameArea");
  const msg = document.getElementById("msg");
  msg.textContent = "";
  area.innerHTML = '<div class="game-message" id="msg"></div>';

  const positions = [
    "calc(16.666% - 80px)",
    "calc(50% - 80px)",
    "calc(83.333% - 80px)",
  ];

  const ballPositions = [
    "calc(16.666% - 10px)",
    "calc(50% - 10px)",
    "calc(83.333% - 10px)",
  ];

  const cups = [];
  for (let i = 0; i < 3; i++) {
    const cup = document.createElement("div");
    cup.className = "thimble-cup";
    cup.style.left = positions[i];
    cup.style.transition = "left 0.25s ease-in-out";
    area.appendChild(cup);
    cups.push(cup);
  }

  // Показываем шарик визуально (случайно — для зрелищности)
  const visualCup = Math.floor(Math.random() * 3);
  const initialBall = document.createElement("div");
  initialBall.className = "thimble-ball";
  initialBall.style.left = ballPositions[visualCup];
  initialBall.style.opacity = "1";
  area.appendChild(initialBall);

  msg.textContent = "Смотри внимательно, где шарик!";

  setTimeout(() => {
    initialBall.remove();
    msg.textContent = "Перемешиваю... следи за руками!";

    let swapCount = 0;
    const totalSwaps = swapSequence ? swapSequence.length : 12;

    function performSwap() {
      if (swapCount >= totalSwaps) {
        msg.textContent = "Где шарик? Выбирай чашку!";
        cups.forEach((cup, idx) => {
          cup.onclick = () => {
            lastSelectedCup = idx;
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "thimbleriggerGameResult",
                  selectedCup: idx,
                }),
              );
            }
          };
        });
        return;
      }

      // Выполняем своп ТОЧНО по последовательности с сервера
      const [a, b] = swapSequence[swapCount];
      if (a !== b) {
        const temp = cups[a].style.left;
        cups[a].style.left = cups[b].style.left;
        cups[b].style.left = temp;
      }

      swapCount++;
      const nextDelay = 200 + Math.floor(Math.random() * 300);
      setTimeout(performSwap, nextDelay);
    }

    performSwap();
  }, 2000);
}

function closeThimbleriggerDialog() {
  if (!isThimbleriggerDialogOpen) return;
  isThimbleriggerDialogOpen = false;
  document.body.classList.remove("npc-dialog-active");
  const msg = document.getElementById("msg");
  if (msg) msg.textContent = "";
  const dialog = document.querySelector(".npc-dialog.open");
  const topicsContainer = document.getElementById("talkTopics");
  if (topicsContainer) topicsContainer.classList.remove("hidden");
  const npcText = document.querySelector(".npc-text");
  if (npcText) npcText.classList.remove("fullscreen");
  if (dialog) dialog.remove();
  gameDialog = null;
  greetingDialog = null;
  gameActive = false;
}

function openThimbleriggerGreeting() {
  if (isThimbleriggerDialogOpen) return;
  isThimbleriggerDialogOpen = true;
  document.body.classList.add("npc-dialog-active");

  const isDoc = !window.getCorporateDocumentsStatus?.();

  greetingDialog = document.createElement("div");
  greetingDialog.className = "npc-dialog open";
  greetingDialog.style.backgroundImage = `url(${isDoc ? images.thimbleriggerDocBg.src : images.thimbleriggerMeetBg.src})`;
  greetingDialog.style.backgroundSize = "cover";
  greetingDialog.style.backgroundPosition = "center";

  greetingDialog.innerHTML = `
    <div class="npc-dialog-content">  
    </div>
    <button class="neon-btn-thimblerigger-ok" id="greetingOkBtn"></button>
  `;

  document.body.appendChild(greetingDialog);

  const okBtn = document.getElementById("greetingOkBtn");
  okBtn.onclick = () => {
    const me = players.get(myId);
    const hasDocuments = me && me.corporateDocumentsSubmitted === true;

    if (hasDocuments) {
      // Знакомимся только если документы сданы
      window.thimbleriggerSystem.thimbleriggerMeetAndCloseGreeting();
    } else {
      // Просто закрываем диалог
      closeThimbleriggerGreeting();
    }
  };
}

function closeThimbleriggerGreeting() {
  if (greetingDialog) {
    greetingDialog.remove();
    greetingDialog = null;
  }
  isThimbleriggerDialogOpen = false;
  document.body.classList.remove("npc-dialog-active");

  // Разрешаем показать приветствие снова при следующем подходе
  if (!isThimbleriggerMet) {
    hasGreetingBeenShownThisSession = false;
  }
}

const thimbleriggerMeetAndCloseGreeting = () => {
  if (ws.readyState === WebSocket.OPEN) {
    sendWhenReady(ws, JSON.stringify({ type: "meetThimblerigger" }));
  }
  closeThimbleriggerGreeting();
  // Устанавливаем флаг знакомства
  window.thimbleriggerSystem.setThimbleriggerMet(true);
};

function openThimbleriggerTalk() {
  if (isThimbleriggerDialogOpen) return;
  isThimbleriggerDialogOpen = true;
  document.body.classList.add("npc-dialog-active");

  const dialog = document.createElement("div");
  dialog.className = "npc-dialog open";
  dialog.style.backgroundImage = `url(${images.thimbleriggerTalkBg.src})`;
  dialog.style.backgroundSize = "cover";
  dialog.style.backgroundPosition = "center";
  dialog.dataset.npc = "thimblerigger-talk";

  dialog.innerHTML = `
    <div class="npc-dialog-content">
      <!-- Заголовок убран — текст будет появляться только при выборе темы -->
      <div id="thimbleriggerTalkTopics" class="thimblerigger-talk-topics"></div>
    </div>
    <button id="closeTalkBtn" class="neon-btn-thimblerigger"></button>
  `;

  document.body.appendChild(dialog);

  const topicsContainer = document.getElementById("thimbleriggerTalkTopics");
  const closeBtn = document.getElementById("closeTalkBtn");

  const topics = [
    {
      title: "О себе",
      text: "Я Напёрсточник, король уличных иллюзий в этом неоновом аду. Родился в нижних уровнях, где обман — единственный способ выжить. Мои напёрстки видели больше слёз и триумфов, чем корпоративные башни.",
    },
    {
      title: "О Неоновом городе",
      text: "Город — как моя игра: яркий снаружи, но полный обмана внутри. Неон мигает, скрывая тени, где баляры текут рекой. Здесь удача решает, выживешь ли ты или растворишься в токсинах.",
    },
    {
      title: "Советы по игре",
      text: "Смотри не на чашки, а на мои руки — но не слишком пристально, иначе обману. Удача любит смелых, но помни: дом всегда в выигрыше. Начни с малой ставки, сталкер.",
    },
    {
      title: "Истории выигрышей",
      text: "Один парень угадал пять раз подряд — ушёл с карманами, полными баляров. Но на следующий день его нашли в переулке без имплантов. Удача притягивает зависть в этом городе.",
    },
    {
      title: "Почему напёрстки?",
      text: "В мире ИИ и хакеров старая игра напоминает: не всё цифровое. Напёрстки — тест на интуицию, а не код. Здесь нет багов, только чистая ловкость и обман.",
    },
    {
      title: "Будущее города",
      text: "Неоновый город стоит на краю. Корпорации давят, банды воюют, а мы, старые уличные крысы, держимся за свои напёрстки. Может, когда-нибудь кто-то переиграет систему... или система переиграет всех.",
    },
  ];

  topics.forEach((topic) => {
    const div = document.createElement("div");
    div.className = "thimblerigger-talk-topic";
    div.innerHTML = `<strong class="thimblerigger-talk-topic-title">${topic.title}</strong>`;

    div.addEventListener("click", () => {
      topicsContainer.classList.add("hidden");

      // Полностью заменяем содержимое диалога на текст темы (как у Джона)
      const npcContent = dialog.querySelector(".npc-dialog-content");
      npcContent.innerHTML = `
        <div class="thimblerigger-fullscreen">
          <div class="thimblerigger-talk-text-content">${topic.text}</div>
        </div>
      `;
      closeBtn.onclick = () => showThimbleriggerTopics();
    });

    topicsContainer.appendChild(div);
  });

  function showThimbleriggerTopics() {
    topicsContainer.classList.remove("hidden");
    const npcContent = dialog.querySelector(".npc-dialog-content");

    // Восстанавливаем исходную структуру с контейнером тем
    npcContent.innerHTML = `<div id="thimbleriggerTalkTopics" class="thimblerigger-talk-topics"></div>`;

    // Перезаполняем темы (чтобы не терять обработчики)
    const newTopicsContainer = document.getElementById(
      "thimbleriggerTalkTopics",
    );
    topics.forEach((topic) => {
      const div = document.createElement("div");
      div.className = "thimblerigger-talk-topic";
      div.innerHTML = `<strong class="thimblerigger-talk-topic-title">${topic.title}</strong>`;
      div.addEventListener("click", () => {
        // Повторяем логику выбора
        newTopicsContainer.classList.add("hidden");
        npcContent.innerHTML = `
          <div class="thimblerigger-fullscreen">
            <div class="thimblerigger-talk-text-content">${topic.text}</div>
          </div>
        `;
        closeBtn.onclick = () => showThimbleriggerTopics();
      });
      newTopicsContainer.appendChild(div);
    });

    closeBtn.textContent = "";
    closeBtn.onclick = window.thimbleriggerSystem.closeDialog;
  }

  closeBtn.onclick = window.thimbleriggerSystem.closeDialog;
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && isThimbleriggerDialogOpen)
    closeThimbleriggerDialog();
});

function setThimbleriggerMet(met) {
  isThimbleriggerMet = met;
  hasGreetingBeenShownThisSession = met;
  if (!met && isPlayerNearThimblerigger) removeThimbleriggerButtons();
  if (met && isPlayerNearThimblerigger) createThimbleriggerButtons();
}

function createThimbleriggerButtons() {
  if (thimbleriggerButtonsContainer) return;
  thimbleriggerButtonsContainer = document.createElement("div");
  thimbleriggerButtonsContainer.className = "npc-buttons-container";

  const talkBtn = document.createElement("div");
  talkBtn.className = "npc-button thimblerigger-talk-btn";
  talkBtn.onclick = (e) => {
    e.stopPropagation();
    openThimbleriggerTalk();
  };

  const playBtn = document.createElement("div");
  playBtn.className = "npc-button thimblerigger-play-btn";
  playBtn.onclick = (e) => {
    e.stopPropagation();
    openThimbleriggerGame();
  };

  thimbleriggerButtonsContainer.appendChild(talkBtn);
  thimbleriggerButtonsContainer.appendChild(playBtn);
  document.body.appendChild(thimbleriggerButtonsContainer);
}

function removeThimbleriggerButtons() {
  if (thimbleriggerButtonsContainer) {
    thimbleriggerButtonsContainer.remove();
    thimbleriggerButtonsContainer = null;
  }
}

function updateThimbleriggerButtonsPosition(cameraX, cameraY) {
  if (!thimbleriggerButtonsContainer || !isPlayerNearThimblerigger) return;
  const zoom = window.movementSystem?.getZoom?.() || 1;
  const screenX = THIMBLERIGGER.x - cameraX + 35;
  const screenY = THIMBLERIGGER.y - cameraY - 80;
  thimbleriggerButtonsContainer.style.left = `${screenX * zoom}px`;
  thimbleriggerButtonsContainer.style.top = `${screenY * zoom}px`;
}

function updateThimbleriggerAnimation(deltaTime) {
  if (window.worldSystem.currentWorldId !== THIMBLERIGGER.worldId) return;

  deltaTime = Math.min(deltaTime, MAX_DELTA_TIME);

  if (isPlayerNearThimblerigger) {
    thimbleriggerFrame = 0;
    thimbleriggerFrameTime = 0;
    animationCycleTime = 0;
    return;
  }

  animationCycleTime += deltaTime;

  while (
    animationCycleTime >=
    (currentPhase === "attract" ? ATTRACT_PHASE_DURATION : IDLE_PHASE_DURATION)
  ) {
    animationCycleTime -=
      currentPhase === "attract" ? ATTRACT_PHASE_DURATION : IDLE_PHASE_DURATION;
    currentPhase = currentPhase === "attract" ? "idle" : "attract";
    thimbleriggerFrame = 0;
    thimbleriggerFrameTime = 0;
  }

  thimbleriggerFrameTime += deltaTime;
  while (thimbleriggerFrameTime >= FRAME_DURATION_Thimble) {
    thimbleriggerFrameTime -= FRAME_DURATION_Thimble;
    thimbleriggerFrame = (thimbleriggerFrame + 1) % TOTAL_FRAMES;
  }
}

function drawThimbleriggerSprite(camX, camY) {
  if (window.worldSystem.currentWorldId !== THIMBLERIGGER.worldId) return;

  const screenX = THIMBLERIGGER.x - camX;
  const screenY = THIMBLERIGGER.y - camY;

  let sx, sy;

  if (isPlayerNearThimblerigger) {
    sx = 0;
    sy = 70;
  } else {
    sy = currentPhase === "attract" ? 70 : 0;
    sx = thimbleriggerFrame * 70;
  }

  if (thimbleriggerSprite?.complete) {
    ctx.drawImage(
      thimbleriggerSprite,
      sx,
      sy,
      70,
      70,
      screenX,
      screenY,
      80,
      80,
    );
  } else {
    ctx.fillStyle = "#ff00ff";
    ctx.fillRect(screenX, screenY, 70, 70);
  }

  ctx.fillStyle = isThimbleriggerMet ? "#006effff" : "#ffffff";
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(
    isThimbleriggerMet ? THIMBLERIGGER.name : "?",
    screenX + THIMBLERIGGER.width / 2,
    screenY - 10,
  );

  updateThimbleriggerButtonsPosition(camX, camY);
}

function drawThimblerigger(deltaTime) {
  updateThimbleriggerAnimation(deltaTime);
  const camera = window.movementSystem.getCamera();
  drawThimbleriggerSprite(camera.x, camera.y);
}

function checkThimbleriggerProximity() {
  const me = players.get(myId);
  if (
    !me ||
    me.worldId !== THIMBLERIGGER.worldId ||
    me.health <= 0 ||
    window.worldSystem.currentWorldId !== THIMBLERIGGER.worldId
  ) {
    if (isPlayerNearThimblerigger) {
      isPlayerNearThimblerigger = false;
      removeThimbleriggerButtons();
      closeThimbleriggerDialog();
    }
    return;
  }

  const dx = me.x + 35 - (THIMBLERIGGER.x + 35);
  const dy = me.y + 35 - (THIMBLERIGGER.y + 35);
  const dist = Math.hypot(dx, dy);
  const nowNear = dist < THIMBLERIGGER.interactionRadius;

  if (nowNear && !isPlayerNearThimblerigger) {
    isPlayerNearThimblerigger = true;
    if (isThimbleriggerMet) {
      createThimbleriggerButtons();
    } else {
      // Показываем приветствие всегда, когда не знакомы
      hasGreetingBeenShownThisSession = true;
      openThimbleriggerGreeting();
    }
  } else if (!nowNear && isPlayerNearThimblerigger) {
    isPlayerNearThimblerigger = false;
    removeThimbleriggerButtons();
    closeThimbleriggerDialog();
    // Сброс фазы анимации при выходе из зоны
    currentPhase = "attract";
    animationCycleTime = 0;
    thimbleriggerFrame = 0;
    thimbleriggerFrameTime = 0;
  }
}

function getThimbleriggerRenderData() {
  if (
    window.worldSystem?.currentWorldId !== THIMBLERIGGER.worldId ||
    !thimbleriggerSprite?.complete ||
    thimbleriggerSprite.naturalWidth <= 0 ||
    thimbleriggerSprite.naturalHeight <= 0
  ) {
    return null;
  }

  let frame;
  let row;

  // Полностью повторяем выбор кадра из drawThimbleriggerSprite().
  if (isPlayerNearThimblerigger) {
    frame = 0;
    row = 1;
  } else {
    frame = thimbleriggerFrame;
    row = currentPhase === "attract" ? 1 : 0;
  }

  return {
    id: "thimblerigger",
    type: "npc",
    visualType: "billboard",

    // Исходная мировая позиция NPC.
    x: THIMBLERIGGER.x,
    y: THIMBLERIGGER.y,

    worldId: THIMBLERIGGER.worldId,

    sprite: thimbleriggerSprite,

    frame,
    row,

    frameCount: TOTAL_FRAMES,

    frameWidth: 70,
    frameHeight: 70,

    // Те же размеры, что используются в drawSprite().
    displayWidth: 80,
    displayHeight: 80,
  };
}

window.thimbleriggerSystem = {
  drawThimblerigger,
  checkThimbleriggerProximity,
  setThimbleriggerMet,
  closeDialog: closeThimbleriggerDialog,
  thimbleriggerMeetAndCloseGreeting,

  // Визуальные данные для общего WebGL2-рендерера.
  getRenderData: getThimbleriggerRenderData,

  getPosition() {
    return { x: THIMBLERIGGER.x, y: THIMBLERIGGER.y };
  },

  drawSprite(camX, camY) {
    drawThimbleriggerSprite(camX, camY);
  },

  updateAnimation(deltaTime) {
    updateThimbleriggerAnimation(deltaTime);
  },

  initialize: (sprite) => {
    thimbleriggerSprite = sprite;
    hasGreetingBeenShownThisSession = false;
    currentPhase = "attract";
    animationCycleTime = 0;
    thimbleriggerFrame = 0;
    thimbleriggerFrameTime = 0;
  },
  refreshDialogBackground: () => {
    const isDoc = !window.getCorporateDocumentsStatus();

    if (greetingDialog) {
      greetingDialog.style.backgroundImage = `url(${isDoc ? images.thimbleriggerDocBg.src : images.thimbleriggerMeetBg.src})`;
    }

    if (gameDialog) {
      gameDialog.style.backgroundImage = `url(${isDoc ? images.thimbleriggerDocBg.src : images.thimbleriggerGameBg.src})`;
    }

    const allOpenDialogs = document.querySelectorAll(".npc-dialog.open");
    for (const dlg of allOpenDialogs) {
      const titleEl = dlg.querySelector(".npc-title");
      if (titleEl && titleEl.textContent.trim() === THIMBLERIGGER.name) {
        dlg.style.backgroundImage = `url(${images.thimbleriggerTalkBg.src})`;
        break;
      }
    }
  },
};

(function registerThimbleriggerVisualProvider() {
  "use strict";

  function registerThimblerigger3D() {
    const scene = window.sceneEntitySystem;
    const thimblerigger = window.thimbleriggerSystem;

    if (
      typeof scene?.registerNPCVisualProvider !== "function" ||
      typeof scene?.getRegisteredNPCIds !== "function" ||
      typeof thimblerigger?.getRenderData !== "function"
    ) {
      console.error(
        "[Thimblerigger3D] Required visual provider API is unavailable.",
      );

      return false;
    }

    const id = "thimblerigger";

    // Защита от повторной регистрации.
    if (scene.getRegisteredNPCIds().includes(id)) {
      return true;
    }

    // Реестр принимает объект с методом getRenderData().
    const success = scene.registerNPCVisualProvider(id, {
      getRenderData() {
        return thimblerigger.getRenderData();
      },
    });

    if (!success) {
      console.error("[Thimblerigger3D] Failed to register visual provider.");

      return false;
    }

    console.log("[Thimblerigger3D] Visual provider registered successfully.");

    return true;
  }

  if (!registerThimblerigger3D()) {
    window.addEventListener("load", registerThimblerigger3D, { once: true });
  }
})();
