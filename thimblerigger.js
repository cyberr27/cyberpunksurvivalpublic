// thimblerigger.js — Напёрсточник в Неоновом городе (ПРОСТАЯ РАБОЧАЯ ИГРА)

const THIMBLERIGGER = {
  x: 750,
  y: 2380,
  width: 70,
  height: 70,
  interactionRadius: 50,
  name: "Thimble",
  worldId: 0,
};

let isThimbleriggerMet = false;
let isThimbleriggerDialogOpen = false;
let isPlayerNearThimblerigger = false;
let hasGreetingBeenShownThisSession = false;

let thimbleriggerSprite = null;
let thimbleriggerButtonsContainer = null;

// Новая система анимации
let thimbleriggerFrame = 0;
let thimbleriggerFrameTime = 0;
const FRAME_DURATION_Thimble = 180; // 180 мс на кадр
const TOTAL_FRAMES = 13;
const MAX_DELTA_TIME = 1000; // Cap для deltaTime, чтобы избежать экстремальных скачков

// Цикл анимации вне зоны взаимодействия
let animationCycleTime = 0; // накапливаем время для переключения фаз
const ATTRACT_PHASE_DURATION = 10000; // 5 секунд строка 1 (привлекающая)
const IDLE_PHASE_DURATION = 10000; // 10 секунд строка 0 (спокойная)
let currentPhase = "attract"; // "attract" или "idle"

let gameDialog = null;
let correctCup = -1;
let gameActive = false;

let greetingDialog = null;

// Подключаем внешний CSS файл
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

  gameDialog = document.createElement("div");
  gameDialog.className = "npc-dialog open";
  gameDialog.innerHTML = `
    <div class="npc-dialog-header">
      <h2 class="npc-title">ИГРА В НАПЁРСТКИ</h2>
    </div>
    <div class="npc-dialog-content" style="display:flex;flex-direction:column;gap:15px;">
      <div style="text-align:center;">
        <input type="number" min="1" max="100" value="50" id="betInput" class="bet-input" style="width:80px;padding:8px;font-size:16px;text-align:center;">  
        <button class="neon-btn-neon" id="startBtn" style="margin-left:15px;padding:12px 24px;"></button>

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
      alert("Соединение с сервером потеряно. Попробуйте позже.");
    }
  };
}

function startSimpleGame(bet) {
  const area = document.getElementById("gameArea");
  const msg = document.getElementById("msg");
  msg.textContent = "";
  area.innerHTML = '<div class="game-message" id="msg"></div>';

  correctCup = Math.floor(Math.random() * 3);

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

  const initialBall = document.createElement("div");
  initialBall.className = "thimble-ball";
  initialBall.style.left = ballPositions[correctCup];
  initialBall.style.opacity = "1";
  area.appendChild(initialBall);

  msg.textContent = "Смотри, где шарик!";

  gameActive = false;

  setTimeout(() => {
    initialBall.remove();
    msg.textContent = "Перемешиваю... быстро!";

    let swapCount = 0;
    const totalSwaps = 10 + Math.floor(Math.random() * 6);

    function performSwap() {
      let a = Math.floor(Math.random() * 3);
      let b = Math.floor(Math.random() * 3);
      if (Math.random() < 0.2) b = a;

      if (a !== b) {
        const temp = cups[a].style.left;
        cups[a].style.left = cups[b].style.left;
        cups[b].style.left = temp;

        if (correctCup === a) correctCup = b;
        else if (correctCup === b) correctCup = a;
      }

      swapCount++;
      if (swapCount >= totalSwaps) {
        msg.textContent = "Где шарик? Выбирай!";
        gameActive = true;

        cups.forEach((cup, idx) => {
          cup.onclick = () => chooseCup(idx, bet);
        });
      } else {
        const nextDelay = 200 + Math.floor(Math.random() * 300);
        setTimeout(performSwap, nextDelay);
      }
    }

    performSwap();
  }, 2000);
}

function chooseCup(selected, bet) {
  if (!gameActive) return;
  gameActive = false;

  const area = document.getElementById("gameArea");
  const msgEl = document.getElementById("msg");

  const cups = area.querySelectorAll(".thimble-cup");
  cups.forEach((cup) => cup.classList.add("lifted"));

  const ball = document.createElement("div");
  ball.className = "thimble-ball";
  ball.style.left = cups[correctCup].style.left.replace("80px", "10px");
  area.appendChild(ball);

  setTimeout(() => {
    const won = selected === correctCup;

    if (won) {
      const balyarySlot = inventory.findIndex(
        (slot) => slot && slot.type === "balyary",
      );
      const winAmount = bet * 2;
      msgEl.textContent = `ВЫИГРЫШ!${winAmount}баляров! ${bet}XP!`;
      msgEl.style.color = "#00ff00";
      if (balyarySlot !== -1) {
        inventory[balyarySlot].quantity =
          (inventory[balyarySlot].quantity || 0) + winAmount;
      } else {
        const freeSlot = inventory.findIndex((slot) => slot === null);
        if (freeSlot !== -1) {
          inventory[freeSlot] = { type: "balyary", quantity: winAmount };
        }
      }
      if (window.levelSystem) {
        window.levelSystem.currentXP += bet;
      }
      updateInventoryDisplay();
      updateStatsDisplay();
    } else {
      msgEl.textContent = "НЕ ПОВЕЗЛО!";
      msgEl.style.color = "#ff0000";
    }

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "thimbleriggerGameResult",
          won,
          bet,
          selectedCup: selected,
          correctCup,
        }),
      );
    }

    setTimeout(() => {
      const input = gameDialog.querySelector("#betInput");
      if (input) input.disabled = false;
      msgEl.textContent = "";
      gameActive = false;
    }, 3000);
  }, 800);
}

function closeThimbleriggerDialog() {
  if (!isThimbleriggerDialogOpen) return;
  isThimbleriggerDialogOpen = false;
  document.body.classList.remove("npc-dialog-active");
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

  greetingDialog = document.createElement("div");
  greetingDialog.className = "npc-dialog open";
  greetingDialog.innerHTML = `
    <div class="npc-dialog-header">
      <h2 class="npc-title">?</h2>
    </div>
    <div class="npc-dialog-content">
      <p class="npc-text">Эй, сталкер! Я Напёрсточник в этом Неоновом городе.</p>
      <p class="npc-text">Хочешь рискнуть в напёрстки? Угадаешь — удвою ставку + Опыт!</p>
    </div>
    <button class="neon-btn" onclick="window.thimbleriggerSystem.meetAndCloseGreeting()">Хорошо</button>
  `;
  document.body.appendChild(greetingDialog);
}

function closeThimbleriggerGreeting() {
  if (greetingDialog) {
    greetingDialog.remove();
    greetingDialog = null;
  }
  isThimbleriggerDialogOpen = false;
  document.body.classList.remove("npc-dialog-active");
}

const meetAndCloseGreeting = () => {
  if (ws.readyState === WebSocket.OPEN) {
    sendWhenReady(ws, JSON.stringify({ type: "meetThimblerigger" }));
  }
  closeThimbleriggerGreeting();
};

function openThimbleriggerTalk() {
  if (isThimbleriggerDialogOpen) return;
  isThimbleriggerDialogOpen = true;
  document.body.classList.add("npc-dialog-active");

  const dialog = document.createElement("div");
  dialog.className = "npc-dialog open";

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
  ];

  dialog.innerHTML = `
    <div class="npc-dialog-header"><h2 class="npc-title">${THIMBLERIGGER.name}</h2></div>
    <div class="npc-dialog-content">
      <p class="npc-text">Эй, сталкер! Что хочешь узнать?</p>
      <div id="talkTopics" class="talk-topics"></div>
    </div>
    <button id="closeTalkBtn" class="neon-btn">ЗАКРЫТЬ</button>
  `;
  document.body.appendChild(dialog);

  const npcText = dialog.querySelector(".npc-text");
  const topicsContainer = document.getElementById("talkTopics");
  const closeBtn = document.getElementById("closeTalkBtn");

  topics.forEach((topic) => {
    const div = document.createElement("div");
    div.className = "talk-topic";
    div.innerHTML = `<strong>${topic.title}</strong>`;
    div.addEventListener("click", () => {
      topicsContainer.classList.add("hidden");
      npcText.classList.add("fullscreen");
      npcText.innerHTML = `<div style="flex:1;overflow-y:auto;padding-right:10px;">${topic.text}</div>`;
      closeBtn.textContent = "Понятно";
      closeBtn.onclick = showTopics;
    });
    topicsContainer.appendChild(div);
  });

  function showTopics() {
    topicsContainer.classList.remove("hidden");
    npcText.classList.remove("fullscreen");
    npcText.textContent = "Эй, сталкер! Что хочешь узнать?";
    closeBtn.textContent = "ЗАКРЫТЬ";
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
  talkBtn.textContent = "ГОВОРИТЬ";
  talkBtn.onclick = (e) => {
    e.stopPropagation();
    openThimbleriggerTalk();
  };

  const playBtn = document.createElement("div");
  playBtn.className = "npc-button thimblerigger-play-btn";
  playBtn.textContent = "ИГРАТЬ";
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
  const screenX = THIMBLERIGGER.x - cameraX + 35;
  const screenY = THIMBLERIGGER.y - cameraY - 80;
  thimbleriggerButtonsContainer.style.left = `${screenX}px`;
  thimbleriggerButtonsContainer.style.top = `${screenY}px`;
}

function drawThimblerigger(deltaTime) {
  if (window.worldSystem.currentWorldId !== THIMBLERIGGER.worldId) return;

  // Cap deltaTime для оптимизации и предотвращения экстремальных скачков
  deltaTime = Math.min(deltaTime, MAX_DELTA_TIME);

  const camera = window.movementSystem.getCamera();
  const cameraX = camera.x;
  const cameraY = camera.y;
  const screenX = THIMBLERIGGER.x - cameraX;
  const screenY = THIMBLERIGGER.y - cameraY;

  let sx, sy;

  if (isPlayerNearThimblerigger) {
    // В зоне взаимодействия — статичный 1-й кадр строки 1
    sx = 0;
    sy = 70;
    thimbleriggerFrame = 0;
    thimbleriggerFrameTime = 0;
    animationCycleTime = 0;
  } else {
    // Вне зоны — циклическая анимация
    animationCycleTime += deltaTime;

    // While для пропуска фаз при большом deltaTime
    while (
      animationCycleTime >=
      (currentPhase === "attract"
        ? ATTRACT_PHASE_DURATION
        : IDLE_PHASE_DURATION)
    ) {
      animationCycleTime -=
        currentPhase === "attract"
          ? ATTRACT_PHASE_DURATION
          : IDLE_PHASE_DURATION;
      currentPhase = currentPhase === "attract" ? "idle" : "attract";
      thimbleriggerFrame = 0;
      thimbleriggerFrameTime = 0;
    }

    // While для пропуска кадров внутри фазы при большом deltaTime
    thimbleriggerFrameTime += deltaTime;
    while (thimbleriggerFrameTime >= FRAME_DURATION_Thimble) {
      thimbleriggerFrameTime -= FRAME_DURATION_Thimble;
      thimbleriggerFrame = (thimbleriggerFrame + 1) % TOTAL_FRAMES;
    }

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
      70,
      70,
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

  updateThimbleriggerButtonsPosition(cameraX, cameraY);
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
    if (isThimbleriggerMet) createThimbleriggerButtons();
    if (!isThimbleriggerMet) {
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

window.thimbleriggerSystem = {
  drawThimblerigger,
  checkThimbleriggerProximity,
  setThimbleriggerMet,
  closeDialog: closeThimbleriggerDialog,
  meetAndCloseGreeting,
  initialize: (sprite) => {
    thimbleriggerSprite = sprite;
    hasGreetingBeenShownThisSession = false;
    // Инициализация анимации
    currentPhase = "attract";
    animationCycleTime = 0;
    thimbleriggerFrame = 0;
    thimbleriggerFrameTime = 0;
  },
};
