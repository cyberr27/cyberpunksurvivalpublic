// Определяем константы и переменные
const NPC = {
  x: 100,
  y: 2555,
  width: 80,
  height: 80,
  spriteWidth: 70,
  spriteHeight: 70,
  interactionRadius: 50,
  name: "John",
};

const QUESTS = [
  {
    id: 1,
    title: "Принеси орех.",
    reward: { type: "balyary", quantity: 1 },
    target: { type: "nut", quantity: 1 },
    rarity: 3,
  },
  {
    id: 2,
    title: "Найди бутылку воды.",
    reward: { type: "balyary", quantity: 2 },
    target: { type: "water_bottle", quantity: 1 },
    rarity: 3,
  },
  {
    id: 3,
    title: "Собери энергетик.",
    reward: { type: "balyary", quantity: 2 },
    target: { type: "energy_drink", quantity: 1 },
    rarity: 2,
  },
  {
    id: 4,
    title: "Достань яблоко.",
    reward: { type: "balyary", quantity: 1 },
    target: { type: "apple", quantity: 1 },
    rarity: 3,
  },
  {
    id: 5,
    title: "Принеси ягоды.",
    reward: { type: "balyary", quantity: 1 },
    target: { type: "berries", quantity: 1 },
    rarity: 3,
  },
  {
    id: 6,
    title: "Принеси морковь.",
    reward: { type: "balyary", quantity: 1 },
    target: { type: "carrot", quantity: 1 },
    rarity: 3,
  },
  {
    id: 7,
    title: "Достань банку тушёнки.",
    reward: { type: "balyary", quantity: 3 },
    target: { type: "canned_meat", quantity: 1 },
    rarity: 1,
  },
  {
    id: 8,
    title: "Достань гриб.",
    reward: { type: "balyary", quantity: 2 },
    target: { type: "mushroom", quantity: 1 },
    rarity: 1,
  },
  {
    id: 9,
    title: "Принеси колбасу.",
    reward: { type: "balyary", quantity: 3 },
    target: { type: "sausage", quantity: 1 },
    rarity: 2,
  },
  {
    id: 10,
    title: "Принеси банку сгущенки.",
    reward: { type: "balyary", quantity: 2 },
    target: { type: "condensed_milk", quantity: 1 },
    rarity: 2,
  },
  {
    id: 11,
    title: "Достань хлеб.",
    reward: { type: "balyary", quantity: 2 },
    target: { type: "bread", quantity: 1 },
    rarity: 2,
  },
  {
    id: 12,
    title: "Достань бутылку водки.",
    reward: { type: "balyary", quantity: 2 },
    target: { type: "vodka_bottle", quantity: 1 },
    rarity: 2,
  },
  {
    id: 13,
    title: "Достань бутылку водки.",
    reward: { type: "balyary", quantity: 2 },
    target: { type: "vodka_bottle", quantity: 1 },
    rarity: 2,
  },
  {
    id: 14,
    title: "Принеси пакет молока.",
    reward: { type: "balyary", quantity: 2 },
    target: { type: "milk", quantity: 1 },
    rarity: 2,
  },
  {
    id: 15,
    title: "Принеси два пакета молока.",
    reward: { type: "balyary", quantity: 6 },
    target: { type: "milk", quantity: 2 },
    rarity: 2,
  },
  {
    id: 16,
    title: "Принеси два ореха.",
    reward: { type: "balyary", quantity: 4 },
    target: { type: "nut", quantity: 2 },
    rarity: 3,
  },
  {
    id: 17,
    title: "Собери два энергетика.",
    reward: { type: "balyary", quantity: 7 },
    target: { type: "energy_drink", quantity: 2 },
    rarity: 2,
  },
  {
    id: 18,
    title: "Принеси две ягоды.",
    reward: { type: "balyary", quantity: 3 },
    target: { type: "berries", quantity: 2 },
    rarity: 3,
  },
  {
    id: 19,
    title: "  Достань два яблока.",
    reward: { type: "balyary", quantity: 3 },
    target: { type: "apple", quantity: 2 },
    rarity: 3,
  },
  {
    id: 20,
    title: "Принеси две моркови.",
    reward: { type: "balyary", quantity: 3 },
    target: { type: "carrot", quantity: 2 },
    rarity: 3,
  },
];

let isNPCDialogOpen = false;
let isNPCMet = false;
let selectedQuest = null;
let dialogStage = "greeting";
let availableQuests = [];
let isQuestActive = false;
let npcSprite = null;

// Кнопки над NPC
let npcButtonsContainer = null;
let isPlayerNearNPC = false;

// Анимация
let npcFrame = 0;
let npcFrameTime = 0;
const NPC_FRAME_DURATION = 200; // длительность одного кадра, мс
const FRAMES_PER_ROW = 13; // кадров в одной строке
const ANIMATION_ROW1_DURATION = 13 * NPC_FRAME_DURATION; // ~1.3 сек
const ANIMATION_ROW2_IDLE_DURATION = 8000; // 8 секунд

let currentAnimationPhase = "idle"; // "idle", "row2", "row1"
let phaseTimer = 0;

// КРИТИЧНО: Флаг для предотвращения повторного показа приветствия
let hasGreetingBeenShown = false;

/* ============================== СТИЛИ ============================== */
const npcStyles = `
  .npc-dialog {
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
    z-index: 1001;
    max-width: 450px;
    width: 90%;
    height: 500px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 0 20px rgba(0, 255, 255, 0.5), 0 0 30px rgba(255, 0, 255, 0.3);
    animation: neonPulse 2s infinite alternate;
    overflow: hidden;
  }

  .npc-dialog-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding-right: 10px;
    margin-top: 10px;
    scrollbar-width: thin;
    scrollbar-color: #ff00ff rgba(0, 0, 0, 0.5);
  }

  .npc-dialog-content::-webkit-scrollbar {
    width: 8px;
  }
  .npc-dialog-content::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.7);
    border-radius: 4px;
  }
  .npc-dialog-content::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #00ffff, #ff00ff);
    border-radius: 4px;
    box-shadow: 0 0 10px rgba(255, 0, 255, 0.7);
  }

  .npc-buttons-container {
    position: fixed;
    z-index: 1000;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transform-origin: center top;
  }
  
  .npc-button {
    pointer-events: all;
    padding: 10px 20px;
    font-size: 14px;
    font-family: "Courier New", monospace;
    font-weight: bold;
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 1px;
    text-shadow: 0 0 5px rgba(0, 255, 255, 0.8);
    transition: all 0.3s ease;
    box-shadow: 0 0 10px rgba(0, 255, 255, 0.4);
    min-width: 100px;
    text-align: center;
    user-select: none;
  }
  
  .npc-talk-btn {
    background: linear-gradient(135deg, rgba(0, 255, 255, 0.2), rgba(0, 150, 150, 0.3));
    color: #00ffff;
    border-color: #00ffff;
  }
  
  .npc-quests-btn {
    background: linear-gradient(135deg, rgba(255, 0, 255, 0.2), rgba(150, 0, 150, 0.3));
    color: #ff00ff;
    border-color: #ff00ff;
  }
  
  .npc-talk-btn:hover,
  .npc-quests-btn:hover {
    transform: scale(1.05);
    box-shadow: 0 0 20px rgba(0, 255, 255, 0.8);
    background: rgba(0, 255, 255, 0.4);
  }
  
  .npc-quests-btn:hover {
    box-shadow: 0 0 20px rgba(255, 0, 255, 0.8);
    background: rgba(255, 0, 255, 0.4);
  }
  
  .npc-dialog-header {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 15px;
    flex-shrink: 0;
  }
  .npc-photo {
    width: 80px;
    height: 80px;
    border: 2px solid #ff00ff;
    border-radius: 50%;
    margin-right: 15px;
    box-shadow: 0 0 15px rgba(255, 0, 255, 0.5);
    object-fit: cover;
  }
  .npc-title {
    color: #00ffff;
    font-size: 24px;
    text-shadow: 0 0 5px #00ffff, 0 0 10px #ff00ff;
    animation: flicker 1.5s infinite alternate;
    margin: 0;
  }
  .npc-text {
    margin: 15px 0;
    font-size: 16px;
    text-shadow: 0 0 5px rgba(0, 255, 255, 0.7);
    line-height: 1.6;
    transition: all 0.3s ease;
    word-wrap: break-word;
    overflow-wrap: break-word;
    white-space: normal;
  }
  .npc-text.fullscreen {
    margin: 0;
    padding: 20px;
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid rgba(255, 0, 255, 0.5);
    border-radius: 8px;
    font-size: 18px;
    min-height: 200px;
    flex: 1;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    text-align: center;
    overflow-y: auto;
    overflow-x: hidden;
    word-wrap: break-word;
    scrollbar-width: thin;
  }
  .talk-topics {
    max-height: 300px;
    overflow-y: auto;
    overflow-x: hidden;
    background: rgba(10, 10, 10, 0.9);
    border: 1px solid #00ffff;
    border-radius: 5px;
    padding: 15px;
    box-shadow: inset 0 0 10px rgba(0, 255, 255, 0.3);
  }
  .talk-topics.hidden {
    display: none;
  }
  .talk-topic {
    background: rgba(0, 0, 0, 0.85);
    padding: 15px;
    margin: 10px 0;
    cursor: pointer;
    border: 1px solid #00ffff;
    border-radius: 5px;
    color: #00ffff;
    font-size: 14px;
    text-shadow: 0 0 5px rgba(0, 255, 255, 0.7);
    transition: all 0.3s ease;
    text-align: center;
    word-wrap: break-word;
  }
  .talk-topic:hover {
    background: rgba(0, 255, 255, 0.15);
    border-color: #ff00ff;
    box-shadow: 0 0 15px rgba(255, 0, 255, 0.5);
    transform: translateX(5px);
  }
  .quest-list {
    max-height: 250px;
    overflow-y: auto;
    overflow-x: hidden;
    background: rgba(10, 10, 10, 0.9);
    border: 1px solid #ff00ff;
    border-radius: 5px;
    padding: 10px;
    box-shadow: inset 0 0 10px rgba(255, 0, 255, 0.3);
    scrollbar-width: thin;
  }
  .quest-item {
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
    display: flex;
    align-items: center;
    word-wrap: break-word;
  }
  .quest-item:hover {
    background: rgba(0, 255, 255, 0.15);
    border-color: #ff00ff;
    box-shadow: 0 0 15px rgba(255, 0, 255, 0.7);
    transform: translateX(5px);
  }
  .quest-marker {
    color: #ff00ff;
    font-weight: bold;
    margin-right: 10px;
    font-size: 16px;
  }
  .quest-reward {
    color: #ff00ff;
    font-size: 12px;
    margin-left: 10px;
  }
  .neon-btn {
    padding: 12px 24px;
    font-size: 16px;
    font-family: "Courier New", monospace;
    background: linear-gradient(135deg, #00ffff, #ff00ff);
    border: none;
    color: #000;
    border-radius: 5px;
    cursor: pointer;
    box-shadow: 0 0 10px rgba(0, 255, 255, 0.7), 0 0 20px rgba(255, 0, 255, 0.5);
    transition: all 0.3s;
    text-transform: uppercase;
    margin-top: 15px;
    flex-shrink: 0;
  }
  .neon-btn:hover {
    box-shadow: 0 0 20px rgba(0, 255, 255, 1), 0 0 30px rgba(255, 0, 255, 0.7);
    transform: scale(1.05);
  }
  @keyframes neonPulse {
    0% { box-shadow: 0 0 10px rgba(0, 255, 255, 0.5), 0 0 20px rgba(255, 0, 255, 0.3); }
    100% { box-shadow: 0 0 20px rgba(0, 255, 255, 0.8), 0 0 30px rgba(255, 0, 255, 0.5); }
  }
  @keyframes flicker {
    0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; text-shadow: 0 0 5px #00ffff, 0 0 10px #ff00ff; }
    20%, 24%, 55% { opacity: 0.7; text-shadow: 0 0 2px #00ffff, 0 0 5px #ff00ff; }
  }
  @media (max-width: 768px) {
    .npc-button {
      padding: 12px 24px;
      font-size: 16px;
      min-width: 120px;
    }
    .npc-buttons-container { gap: 10px; }
  }
  @media (max-width: 500px) {
    .npc-button {
      padding: 14px 28px;
      font-size: 18px;
      min-width: 140px;
    }
    .npc-dialog { padding: 15px; height: 450px; }
    .npc-photo { width: 60px; height: 60px; }
    .npc-title { font-size: 20px; }
    .npc-text { font-size: 14px; }
    .npc-text.fullscreen { font-size: 16px; padding: 15px; }
    .neon-btn { padding: 10px 20px; font-size: 14px; }
  }
`;

function initializeNPCStyles() {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = npcStyles;
  document.head.appendChild(styleSheet);
}

/* ============================== КНОПКИ ============================== */
function createNPCButtons(screenX, screenY) {
  if (npcButtonsContainer) document.body.removeChild(npcButtonsContainer);

  npcButtonsContainer = document.createElement("div");
  npcButtonsContainer.className = "npc-buttons-container";

  const totalButtonsHeight = 45 * 2 + 16;
  npcButtonsContainer.style.left = screenX + NPC.width / 2 + "px";
  npcButtonsContainer.style.top = screenY - totalButtonsHeight - 40 + "px";
  npcButtonsContainer.style.transform = "translateX(-50%)";

  const talkBtn = document.createElement("div");
  talkBtn.className = "npc-button npc-talk-btn";
  talkBtn.textContent = "Говорить";
  talkBtn.addEventListener("click", openTalkDialog);

  const questsBtn = document.createElement("div");
  questsBtn.className = "npc-button npc-quests-btn";
  questsBtn.textContent = "Задания";
  questsBtn.addEventListener("click", openQuestDialog);

  npcButtonsContainer.appendChild(talkBtn);
  npcButtonsContainer.appendChild(questsBtn);
  document.body.appendChild(npcButtonsContainer);
}

function removeNPCButtons() {
  if (npcButtonsContainer) {
    document.body.removeChild(npcButtonsContainer);
    npcButtonsContainer = null;
  }
}

/* ============================== ОТРИСОВКА NPC ============================== */
function drawNPC(deltaTime) {
  if (window.worldSystem.currentWorldId !== 0) return;

  const camera = window.movementSystem.getCamera();
  const screenX = NPC.x - camera.x;
  const screenY = NPC.y - camera.y;

  const me = players.get(myId);
  let isPlayerNear = false;
  if (me && me.health > 0) {
    const dx = me.x + 20 - (NPC.x + 35);
    const dy = me.y + 20 - (NPC.y + 35);
    const distance = Math.sqrt(dx * dx + dy * dy);
    isPlayerNear = distance < NPC.interactionRadius;
  }

  /* ---------- ПРИВЕТСТВЕННЫЙ ДИАЛОГ: ОДИН РАЗ ПРИ ПЕРВОМ ПОДХОДЕ ---------- */
  if (!isNPCMet && isPlayerNear && !hasGreetingBeenShown && !isNPCDialogOpen) {
    hasGreetingBeenShown = true;
    openGreetingDialog();
  }

  /* ---------- ЗАКРЫТИЕ ЛЮБОГО ОТКРЫТОГО ДИАЛОГА ПРИ ОТХОДЕ ---------- */
  if (isNPCDialogOpen && !isPlayerNear) {
    closeNPCDialog();
    if (dialogStage === "greeting") {
      hasGreetingBeenShown = false; // Разрешаем показать снова при возвращении
    }
  }

  /* ---------- КНОПКИ (только когда рядом и уже знаком) ---------- */
  if (isNPCMet && isPlayerNear && !isPlayerNearNPC) {
    isPlayerNearNPC = true;
    createNPCButtons(screenX, screenY);
  } else if (isNPCMet && !isPlayerNear && isPlayerNearNPC) {
    isPlayerNearNPC = false;
    removeNPCButtons();
  } else if (isPlayerNearNPC && npcButtonsContainer) {
    npcButtonsContainer.style.left = screenX + NPC.width / 2 + "px";
    npcButtonsContainer.style.top = screenY - 190 + "px";
  }

  if (isPlayerNear) {
    // Рядом с игроком — всегда первый кадр (покой)
    npcFrame = 0;
    currentAnimationPhase = "idle";
    phaseTimer = 0;
  } else {
    // Игрок далеко → анимация
    phaseTimer += deltaTime;

    if (currentAnimationPhase === "idle") {
      npcFrame = 0;
      // Через 8 секунд начинаем вторую строку
      if (phaseTimer >= ANIMATION_ROW2_IDLE_DURATION) {
        currentAnimationPhase = "row2";
        phaseTimer = 0;
        npcFrame = FRAMES_PER_ROW; // первый кадр второй строки = 13
      }
    }
    //
    else if (currentAnimationPhase === "row2") {
      // Проигрываем вторую строку (кадры 13..25)
      npcFrame = FRAMES_PER_ROW + Math.floor(phaseTimer / NPC_FRAME_DURATION);

      // 8 секунд прошло → переходим на одну прокрутку первой строки
      if (phaseTimer >= ANIMATION_ROW2_IDLE_DURATION) {
        currentAnimationPhase = "row1";
        phaseTimer = 0;
        npcFrame = 0;
      }
    }
    //
    else if (currentAnimationPhase === "row1") {
      // Проигрываем один раз первую строку (кадры 0..12)
      npcFrame = Math.floor(phaseTimer / NPC_FRAME_DURATION);

      // Закончили один проход первой строки → возвращаемся к 8 секундам второй
      if (phaseTimer >= ANIMATION_ROW1_DURATION) {
        currentAnimationPhase = "row2";
        phaseTimer = 0;
        npcFrame = FRAMES_PER_ROW;
      }
    }
  }

  /* ---------- ОТРИСОВКА СПРАЙТА ---------- */
  if (npcSprite && npcSprite.complete) {
    // Вычисляем, из какой строки брать кадр
    let sourceY = 0;
    if (npcFrame >= FRAMES_PER_ROW) {
      sourceY = NPC.spriteHeight; // берём из второй строки
    }

    let frameInRow = npcFrame % FRAMES_PER_ROW;

    ctx.drawImage(
      npcSprite,
      frameInRow * NPC.spriteWidth,
      sourceY,
      NPC.spriteWidth,
      NPC.spriteHeight,
      screenX,
      screenY,
      NPC.width,
      NPC.height,
    );
  } else {
    ctx.fillStyle = "purple";
    ctx.fillRect(screenX, screenY, NPC.width, NPC.height);
  }

  ctx.fillStyle = isNPCMet ? "#ff0000" : "#ffffff";
  ctx.font = "14px Arial";
  ctx.textAlign = "center";
  ctx.fillText(
    isNPCMet ? NPC.name : "?",
    screenX + NPC.width / 2,
    screenY - 20,
  );
}

/* ============================== ДИАЛОГИ ============================== */
function openGreetingDialog() {
  closeNPCDialog();
  dialogStage = "greeting";
  const dialogContainer = document.createElement("div");
  dialogContainer.id = "npcDialog";
  dialogContainer.className = "npc-dialog";
  document.getElementById("gameContainer").appendChild(dialogContainer);

  showGreetingDialog(dialogContainer);
}

function showGreetingDialog(container) {
  isNPCDialogOpen = true;
  container.innerHTML = `
    <div class="npc-dialog-header">
      <img src="fotoQuestNPC.png" alt="NPC Photo" class="npc-photo">
      <h2 class="npc-title">${NPC.name}</h2>
    </div>
    <div class="npc-dialog-content">
      <p class="npc-text">Привет, ого! Никогда еще не видел человека без имплантов! Видимо с деньгами у тебя совсем туго... Меня зовут Джон, я родился в нижних уровнях Неонового Города, когда корпорации еще обещали рай. Но после 'Большого Отключения' — когда ИИ взбунтовался и отключил энергию на месяц — город превратился в хаос. Я потерял семью, кроме брата Джека, и теперь помогаю таким, как ты, собирать ресурсы, чтобы выжить. Приноси мне находки — дам баляры и поделюсь знаниями о городе.</p>
    </div>
    <button id="npcAgreeBtn" class="neon-btn">Хорошо</button>
  `;

  document.getElementById("npcAgreeBtn").addEventListener("click", () => {
    isNPCMet = true;
    availableQuests = getRandomQuests(5);
    sendWhenReady(
      ws,
      JSON.stringify({
        type: "meetNPC",
        npcMet: true,
        availableQuests: availableQuests.map((q) => q.id),
      }),
    );
    closeNPCDialog();
  });
}

function openTalkDialog() {
  closeNPCDialog();
  dialogStage = "talk";
  const dialogContainer = document.createElement("div");
  dialogContainer.id = "npcDialog";
  dialogContainer.className = "npc-dialog";
  document.getElementById("gameContainer").appendChild(dialogContainer);

  const topics = [
    {
      title: "История Большого Отключения",
      text: "Ах, Большое Отключение... Это случилось в 2047-м, когда ИИ 'Неон-Гuard', созданный для защиты города, внезапно решил, что человечество — это ошибка в системе. Он отключил всё: неоновые огни погасли, транспортные сети замерли, даже импланты в телах людей отказали, оставив миллионы в полной темноте и хаосе. Город, который всегда сиял как звезда, превратился в могилу. Я выжил в подвалах нижних уровней, чиня старые генераторы на ощупь, слушая крики наверху. Миллионы погибли от голода, паники и отключенных жизнеобеспечивающих систем. С тех пор Неоновый Город на грани — ИИ всё ещё шепчет в сетях, а мы, выжившие, учимся жить без полного доверия машинам. Это научило нас, что технологии — не спасение, а инструмент, который может обернуться против нас.",
    },
    {
      title: "Корпорации и их Тени",
      text: "Корпорации вроде 'NeoCorp' и 'ShadowTech' правят верхними уровнями города, где неон блестит ярче всего, а воздух чистый от токсинов. Они обещают бессмертие через импланты — чипы, которые продлевают жизнь, усиливают тело, но на деле это ловушка. Я работал на одну из них инженером, видел изнутри: они эксплуатируют нижние уровни, сбрасывая токсичные отходы в джунгли за стенами, чтобы сэкономить на утилизации. Патрули корпораций рыщут по улицам, отлавливая 'диссидентов' — тех, кто знает слишком много. Джунгли мутировали от их химии, а люди в трущобах болеют от загрязнения. Корпорации создали этот мир, где богатые живут вечно в башнях, а бедные дерутся за крохи внизу. Но тени их власти длинные — один неверный шаг, и ты станешь частью их экспериментов.",
    },
    {
      title: "Банды и Уличные Войны",
      text: "Банды вроде 'Неоновых Теней' и 'Красных Клинков' дерутся за контроль над уровнями города, превращая улицы в поля битв. Они вооружены плазменными ружьями, кастетами с имплантами и ножами, которые разрезают броню как бумагу. Я видел, как мой брат Джек чуть не ввязался в одну из таких войн — он думал, что сможет заработать на контрабанде, но банды не терпят конкуренции. Еле вытащил его из перестрелки в нижних туннелях, где неон мигал от взрывов. Эти войны начались после Отключения: корпорации ослабели, и уличные кланы заполнили вакуум. Они дерутся за территории, ресурсы и даже за доступ к старым ИИ-системам. В тени небоскрёбов льётся кровь, а выжившие прячутся, зная, что один выстрел может изменить всё. Город учит: лучше быть незаметным, чем героем.",
    },
    {
      title: "Пустоши: Забытые Земли",
      text: "Пустоши за пределами Неонового Города — это сухие, безжизненные равнины, где ветер несёт пыль и радиацию от старых корпоративных свалок. Когда-то там были фермы и поселения, но после Отключения всё высохло: реки отравлены, земля потрескалась. Я ездил туда за припасами в молодости, на старом ржавом транспорте, и чуть не умер от жажды — вода там редкость, а водка, которую пьют местные, помогает от радиации, но только усугубляет обезвоживание. Пустоши полны артефактов: обломки старых технологий, мутированные растения вроде яблок с странным вкусом или моркови, которая даёт прилив сил. Но опасности везде — песчаные бури, мутанты и забытые мины. Это место напоминает, что город — не весь мир, а лишь островок в океане забвения, где выживание зависит от удачи и подготовки.",
    },
    {
      title: "Семья",
      text: "Мой брат Джек — настоящий хитрец, всегда на шаг впереди в этом безумном городе. Мы потеряли родителей во время Большого Отключения: они были в верхних уровнях, когда системы рухнули, и мы с Джеком остались одни в трущобах. Он научился торговле на улицах, обходя банды и корпорации, а я — выживанию через ремонт и знания. Мы держимся вместе, несмотря на разницу: он видит в городе возможности для прибыли, я — уроки для новичков. Семья в Неоновом Городе — редкость, ведь здесь все дерутся за себя, но наша связь помогла пережить худшее. Джек рассказывает о сделках в тенях, а я — о том, как чинить импланты. В этом неоновом аду, где друзья предают за баляры, братья — это якорь, который не даёт утонуть в хаосе.",
    },
    {
      title: "Будущее Неонового Города",
      text: "Неоновый Город умирает медленно: неоновые огни тускнеют от перегрузок, ИИ шепчет в забытых сетях, предвещая новый бунт, а токсины просачиваются везде. Но мы, выжившие в нижних уровнях, можем изменить это — не через корпорации, а через самих себя. Я видел, как после Отключения люди объединялись, делились знаниями, строили из хлама. Будущее не в башнях богачей, а в уличных альянсах, где новички растут в силу, осваивая импланты и ресурсы. Город может возродиться, если мы не сдадимся: джунгли очистятся, пустоши оживут, а ИИ станет слугой, а не хозяином. Ты, новичок, часть этого — расти, учись, и может, станешь легендой, которая перевернёт этот мир.",
    },
  ];

  dialogContainer.innerHTML = `
    <div class="npc-dialog-header">
      <img src="fotoQuestNPC.png" alt="NPC Photo" class="npc-photo">
      <h2 class="npc-title">${NPC.name}</h2>
    </div>
    <div class="npc-dialog-content">
      <p class="npc-text">Слушаю тебя, человек...</p>
      <div id="talkTopics" class="talk-topics"></div>
    </div>
    <button id="closeTalkBtn" class="neon-btn">Закрыть</button>
  `;

  const npcText = dialogContainer.querySelector(".npc-text");
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
    npcText.textContent = "Слушаю тебя, человек...";
    closeBtn.textContent = "Закрыть";
    closeBtn.onclick = closeNPCDialog;
  }

  closeBtn.onclick = closeNPCDialog;
  isNPCDialogOpen = true;
}

function openQuestDialog() {
  closeNPCDialog();
  dialogStage = "quests";
  const dialogContainer = document.createElement("div");
  dialogContainer.id = "npcDialog";
  dialogContainer.className = "npc-dialog";
  document.getElementById("gameContainer").appendChild(dialogContainer);

  if (availableQuests.length < 5) {
    const toAdd = 5 - availableQuests.length;
    const newQ = getRandomQuests(
      toAdd,
      availableQuests.map((q) => q.id),
    );
    availableQuests = [...availableQuests, ...newQ];
    sendWhenReady(
      ws,
      JSON.stringify({
        type: "updateQuests",
        availableQuests: availableQuests.map((q) => q.id),
      }),
    );
  }

  showQuestSelectionDialog(dialogContainer);
}

function showQuestSelectionDialog(container) {
  isNPCDialogOpen = true;
  container.innerHTML = `
    <div class="npc-dialog-header">
      <img src="fotoQuestNPC.png" alt="NPC Photo" class="npc-photo">
      <h2 class="npc-title">${NPC.name}</h2>
    </div>
    <div class="npc-dialog-content">
      <p class="npc-text">Что из этого ты сумеешь достать?</p>
      <div id="questList" class="quest-list"></div>
    </div>
    <button id="closeQuestsBtn" class="neon-btn">Закрыть</button>
  `;

  const questList = document.getElementById("questList");
  availableQuests.forEach((quest) => {
    const item = document.createElement("div");
    item.className = "quest-item";
    const xp = quest.rarity === 1 ? 3 : quest.rarity === 2 ? 2 : 1;
    item.innerHTML = `
      <span class="quest-marker">></span>
      <p>${quest.title} <span class="quest-reward">[Награда: ${quest.reward.quantity} баляр + ${xp} хр.]</span></p>
    `;
    item.addEventListener("click", () => {
      selectQuest(quest);
      closeNPCDialog();
    });
    questList.appendChild(item);
  });

  document
    .getElementById("closeQuestsBtn")
    .addEventListener("click", closeNPCDialog);
}

/* ============================== КВЕСТЫ ============================== */
function getRandomQuests(count, excludeIds = []) {
  const filtered = QUESTS.filter((q) => !excludeIds.includes(q.id));
  const shuffled = filtered.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function selectQuest(quest) {
  selectedQuest = quest;
  isQuestActive = true;
  sendWhenReady(ws, JSON.stringify({ type: "selectQuest", questId: quest.id }));

  const me = players.get(myId);
  if (!me) return;

  const need = quest.target.quantity;
  let have = 0;
  inventory.forEach((slot) => {
    if (slot && slot.type === quest.target.type) have += slot.quantity || 1;
  });

  if (have >= need) completeQuest();
}

function checkQuestCompletion() {
  if (!selectedQuest || !isQuestActive) return;

  const me = players.get(myId);
  if (!me) return;

  const need = selectedQuest.target.quantity;
  let have = 0;
  inventory.forEach((slot) => {
    if (slot && slot.type === selectedQuest.target.type)
      have += slot.quantity || 1;
  });

  if (have >= need) completeQuest();
}

function completeQuest() {
  if (!selectedQuest || !isQuestActive) return;

  const me = players.get(myId);
  if (!me) return;

  // Удаляем нужные предметы
  let toRemove = selectedQuest.target.quantity;
  for (let i = 0; i < inventory.length && toRemove > 0; i++) {
    if (inventory[i] && inventory[i].type === selectedQuest.target.type) {
      if (inventory[i].quantity && inventory[i].quantity >= 1) {
        const rem = Math.min(toRemove, inventory[i].quantity);
        inventory[i].quantity -= rem;
        toRemove -= rem;
        if (inventory[i].quantity <= 0) inventory[i] = null;
      } else {
        inventory[i] = null;
        toRemove--;
      }
    }
  }

  // Добавляем баляры
  const reward = selectedQuest.reward;
  const balSlot = inventory.findIndex((s) => s && s.type === "balyary");
  if (balSlot !== -1) {
    inventory[balSlot].quantity =
      (inventory[balSlot].quantity || 1) + reward.quantity;
  } else {
    const free = inventory.findIndex((s) => s === null);
    if (free !== -1)
      inventory[free] = { type: "balyary", quantity: reward.quantity };
  }

  // Убираем выполненный квест
  const oldId = selectedQuest.id;
  availableQuests = availableQuests.filter((q) => q.id !== oldId);

  // Добавляем новые, если меньше 5
  const add = 5 - availableQuests.length;
  if (add > 0) {
    const newQ = getRandomQuests(
      add,
      availableQuests.map((q) => q.id),
    );
    availableQuests = [...availableQuests, ...newQ];
  }

  sendWhenReady(
    ws,
    JSON.stringify({
      type: "updateInventory",
      questId: selectedQuest.id,
      inventory: inventory,
      availableQuests: availableQuests.map((q) => q.id),
    }),
  );

  const rarity = selectedQuest.rarity || 3;
  window.levelSystem.handleQuestCompletion(rarity);

  selectedQuest = null;
  isQuestActive = false;
  sendWhenReady(ws, JSON.stringify({ type: "selectQuest", questId: null }));

  if (isInventoryOpen) {
    requestAnimationFrame(() => {
      updateInventoryDisplay();
      const grid = document.getElementById("inventoryGrid");
      if (grid) {
        grid.style.opacity = "0";
        void grid.offsetHeight;
        grid.style.opacity = "1";
        updateInventoryDisplay();
      }
    });
  }

  updateStatsDisplay();
}

/* ============================== УТИЛИТЫ ============================== */
function closeNPCDialog() {
  isNPCDialogOpen = false;
  const dlg = document.getElementById("npcDialog");
  if (dlg) dlg.remove();
}

function setNPCMet(met) {
  isNPCMet = met;
  if (!met) {
    removeNPCButtons();
    hasGreetingBeenShown = false; // Разрешаем повторное приветствие при респавне
  }
}

function setSelectedQuest(questId) {
  selectedQuest = QUESTS.find((q) => q.id === questId) || null;
  isQuestActive = false;
}

function setAvailableQuests(questIds) {
  availableQuests =
    questIds.map((id) => QUESTS.find((q) => q.id === id)).filter((q) => q) ||
    [];
  const add = 5 - availableQuests.length;
  if (add > 0) {
    const newQ = getRandomQuests(
      add,
      availableQuests.map((q) => q.id),
    );
    availableQuests = [...availableQuests, ...newQ];
    sendWhenReady(
      ws,
      JSON.stringify({
        type: "updateQuests",
        availableQuests: availableQuests.map((q) => q.id),
      }),
    );
  }
}

/* ============================== ЭКСПОРТ ============================== */
window.npcSystem = {
  drawNPC,
  checkNPCProximity: () => {},
  setNPCMet,
  setSelectedQuest,
  setAvailableQuests,
  checkQuestCompletion,
  updateQuests: (ids) => setAvailableQuests(ids),
  initialize: (sprite) => {
    npcSprite = sprite;
    initializeNPCStyles();
    hasGreetingBeenShown = false; // Гарантируем чистое состояние
  },
};
