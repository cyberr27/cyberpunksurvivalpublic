// Определяем константы и переменные
const NPC = {
  x: 3043,
  y: 3585,
  width: 90,
  height: 90,
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
const NPC_FRAME_DURATION = 200;
const FRAMES_PER_ROW = 13;
const ANIMATION_ROW1_DURATION = 13 * NPC_FRAME_DURATION;
const ANIMATION_ROW2_IDLE_DURATION = 8000;

let currentAnimationPhase = "idle";
let phaseTimer = 0;

let hasGreetingBeenShown = false;
let hasNoDocsGreetingBeenShown = false;

/* ============================== ИМПОРТ СТИЛЕЙ ============================== */
function initializeNPCStyles() {
  // Стили теперь подключаются один раз в index.html
  console.log("[NPC] Стили загружены из npcStyle.css");
}

/* ============================== КНОПКИ ============================== */
function createNPCButtons(screenX, screenY) {
  if (npcButtonsContainer) document.body.removeChild(npcButtonsContainer);

  npcButtonsContainer = document.createElement("div");
  npcButtonsContainer.className = "npc-buttons-container";

  const zoom = window.movementSystem?.getZoom?.() || 1;
  const totalButtonsHeight = 45 * 2 + 16;
  npcButtonsContainer.style.left = (screenX + NPC.width / 2) * zoom + "px";
  npcButtonsContainer.style.top =
    (screenY - 40) * zoom - totalButtonsHeight + "px";
  npcButtonsContainer.style.transform = "translateX(-50%)";

  const talkBtn = document.createElement("div");
  talkBtn.className = "npc-button npc-talk-btn";
  talkBtn.addEventListener("click", openTalkDialog);

  const questsBtn = document.createElement("div");
  questsBtn.className = "npc-button npc-quests-btn";
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

// Обновление анимации John (вызывается каждый кадр)
function updateNPCAnimation(deltaTime) {
  if (window.worldSystem.currentWorldId !== 0) return;

  const me = players.get(myId);
  let isPlayerNear = false;
  if (me && me.health > 0) {
    const dx = me.x + 20 - (NPC.x + 35);
    const dy = me.y + 20 - (NPC.y + 35);
    const distance = Math.sqrt(dx * dx + dy * dy);
    isPlayerNear = distance < NPC.interactionRadius;
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
    } else if (currentAnimationPhase === "row2") {
      // Проигрываем вторую строку (кадры 13..25)
      npcFrame = FRAMES_PER_ROW + Math.floor(phaseTimer / NPC_FRAME_DURATION);

      // 8 секунд прошло → переходим на одну прокрутку первой строки
      if (phaseTimer >= ANIMATION_ROW2_IDLE_DURATION) {
        currentAnimationPhase = "row1";
        phaseTimer = 0;
        npcFrame = 0;
      }
    } else if (currentAnimationPhase === "row1") {
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
  updateJohnInteraction();
}

function updateJohnInteraction() {
  if (window.worldSystem?.currentWorldId !== 0) {
    isPlayerNearNPC = false;
    removeNPCButtons();
    return;
  }

  const me = players.get(myId);

  let isPlayerNear = false;

  if (me && me.health > 0) {
    const dx = me.x + 20 - (NPC.x + 35);
    const dy = me.y + 20 - (NPC.y + 35);

    const distance = Math.hypot(dx, dy);

    isPlayerNear = distance < NPC.interactionRadius;
  }

  // Приветствие при первом приближении.
  if (
    !isNPCMet &&
    isPlayerNear &&
    !hasGreetingBeenShown &&
    !isNPCDialogOpen &&
    !hasNoDocsGreetingBeenShown
  ) {
    hasGreetingBeenShown = true;
    openGreetingDialog();
  }

  // Игрок отошёл от NPC.
  if (!isPlayerNear) {
    if (isNPCDialogOpen) {
      closeNPCDialog();
    }

    if (dialogStage === "greeting") {
      hasGreetingBeenShown = false;
      hasNoDocsGreetingBeenShown = false;
    }

    isPlayerNearNPC = false;
    removeNPCButtons();
    return;
  }

  // Кнопки доступны только после знакомства.
  if (isNPCMet && !isPlayerNearNPC) {
    isPlayerNearNPC = true;

    const camera = window.movementSystem?.getCamera?.();

    if (camera) {
      const screenX = NPC.x - camera.x;
      const screenY = NPC.y - camera.y;

      createNPCButtons(screenX, screenY);
    }
  } else if (isPlayerNearNPC && npcButtonsContainer) {
    const camera = window.movementSystem?.getCamera?.();

    if (camera) {
      const zoom = window.movementSystem?.getZoom?.() || 1;

      const screenX = NPC.x - camera.x;
      const screenY = NPC.y - camera.y;

      npcButtonsContainer.style.left = (screenX + NPC.width / 2) * zoom + "px";

      npcButtonsContainer.style.top = (screenY - 130) * zoom + "px";
    }
  }
}

// Чистый draw John + proximity/UI (логика полностью сохранена)
function drawNPCSprite(camX, camY) {
  if (window.worldSystem.currentWorldId !== 0) return;

  const screenX = NPC.x - camX;
  const screenY = NPC.y - camY;

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
      NPC.width + 10,
      NPC.height + 5,
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

// Старый draw оставляем для совместимости
function drawNPC(deltaTime) {
  updateNPCAnimation(deltaTime);
  const cam = window.movementSystem.getCamera();
  drawNPCSprite(cam.x, cam.y);
}

/* ============================== ДИАЛОГИ ============================== */
function openGreetingDialog() {
  closeNPCDialog();
  dialogStage = "greeting";
  const dialogContainer = document.createElement("div");
  dialogContainer.id = "npcDialog";
  document.getElementById("gameContainer").appendChild(dialogContainer);

  showGreetingDialog(dialogContainer);
}

function showGreetingDialog(container) {
  isNPCDialogOpen = true;

  const me = players.get(myId);
  const hasDocuments = me && me.corporateDocumentsSubmitted === true;

  // === КЛАСС ДЛЯ РАЗНЫХ ФОНОВ ===
  const dialogClass = hasDocuments
    ? "npc-dialog john-dialog-normal"
    : "npc-dialog john-dialog-no-docs";

  container.className = dialogClass;

  let html = `<div class="npc-dialog-content"></div>`;

  if (hasDocuments) {
    // === СТАРАЯ ЛОГИКА ДЛЯ НОРМАЛЬНОГО ДИАЛОГА ===
    html += `<button id="npcAgreeBtn" class="neon-btn-ok"></button>`;
  } else {
    // === НОВАЯ КНОПКА ДЛЯ NO-DOCS ===
    html += `<button id="npcNoDocsOkBtn" class="neon-btn-ok"></button>`;
  }

  container.innerHTML = html;

  // === ОБРАБОТКА КНОПКИ ПРИ НАЛИЧИИ ДОКУМЕНТОВ ===
  const agreeBtn = document.getElementById("npcAgreeBtn");
  if (agreeBtn) {
    agreeBtn.addEventListener("click", () => {
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

  // === НОВАЯ ОБРАБОТКА КНОПКИ ДЛЯ NO-DOCS ===
  const noDocsBtn = document.getElementById("npcNoDocsOkBtn");
  if (noDocsBtn) {
    noDocsBtn.addEventListener("click", () => {
      // Просто закрываем диалог — без установки флагов
      closeNPCDialog();
      // Важно: разрешаем показать приветствие снова при следующем подходе
      hasGreetingBeenShown = false;
      hasNoDocsGreetingBeenShown = true;
    });
  }
}

function openTalkDialog() {
  closeNPCDialog();
  dialogStage = "talk";

  const dialogContainer = document.createElement("div");
  dialogContainer.id = "npcDialog";
  dialogContainer.className = "npc-dialog john-dialog-talk open";
  dialogContainer.dataset.npc = "john-talk";
  document.getElementById("gameContainer").appendChild(dialogContainer);

  // Темы (статические, без сервера — lore only)
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

  // Структура как у Thimblerigger: content + кнопка закрытия/назад
  dialogContainer.innerHTML = `
    <div class="npc-dialog-content">
      <div id="talkTopics" class="talk-topics-full john-talk-topics"></div>
    </div>
    <button id="closeTalkBtn" class="neon-btn-thimblerigger john-talk-close-btn"></button>
  `;

  const topicsContainer = document.getElementById("talkTopics");
  const closeBtn = document.getElementById("closeTalkBtn");
  const npcContent = dialogContainer.querySelector(".npc-dialog-content");

  // Заполняем список тем
  function fillTopics(container) {
    container.innerHTML = "";
    topics.forEach((topic) => {
      const div = document.createElement("div");
      div.className = "talk-topic john-talk-topic";
      div.innerHTML = `<strong class="talk-topic-color">${topic.title}</strong>`;
      div.addEventListener("click", () => {
        // Прячем список и показываем fullscreen-текст (как у наперсточника)
        container.classList.add("hidden");
        npcContent.innerHTML = `
          <div class="talk-full-text john-talk-fullscreen">
            <div class="talk-text-content john-talk-text-content">${topic.text}</div>
          </div>
        `;
        // Кнопка теперь = "назад к темам"
        closeBtn.onclick = () => showJohnTopics();
      });
      container.appendChild(div);
    });
  }

  function showJohnTopics() {
    // Восстанавливаем структуру списка тем
    npcContent.innerHTML = `<div id="talkTopics" class="talk-topics-full john-talk-topics"></div>`;
    const newTopicsContainer = document.getElementById("talkTopics");
    fillTopics(newTopicsContainer);
    // Кнопка снова = полное закрытие
    closeBtn.onclick = () => closeNPCDialog();
  }

  // Первый рендер списка
  fillTopics(topicsContainer);

  // Изначально кнопка закрывает весь диалог
  closeBtn.onclick = () => closeNPCDialog();

  isNPCDialogOpen = true;
}

function openQuestDialog() {
  closeNPCDialog();
  dialogStage = "quests";
  const dialogContainer = document.createElement("div");
  dialogContainer.id = "npcDialog";
  dialogContainer.className = "npc-dialog john-dialog-quests";
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
    </div>
    <div class="npc-dialog-content">
      <div id="questList" class="quest-list"></div>
    </div>
    <button id="closeTalkBtn" class="neon-btn-thimblerigger john-talk-close-btn"></button>
  `;

  // Кнопка закрытия — как в Talk
  const closeBtn = document.getElementById("closeTalkBtn");
  if (closeBtn) {
    closeBtn.onclick = () => closeNPCDialog();
  }

  const questList = document.getElementById("questList");
  const me = players.get(myId);
  const currentLevel = me ? me.level || 0 : 0;

  availableQuests.forEach((quest) => {
    const item = document.createElement("div");
    item.className = "quest-item";

    const reward = getScaledQuestReward(quest, currentLevel);

    item.innerHTML = `
      <span class="quest-marker"></span>
      <p>${quest.title} <span class="quest-reward">[Награда: ${reward.balyary} баляр + ${reward.xp} хр.]</span></p>
    `;

    item.addEventListener("click", () => {
      selectQuest(quest);
      closeNPCDialog();
    });
    questList.appendChild(item);
  });
}

/* ============================== КВЕСТЫ ============================== */
function getRandomQuests(count, excludeIds = []) {
  const filtered = QUESTS.filter((q) => !excludeIds.includes(q.id));
  const shuffled = filtered.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function getScaledQuestReward(quest, playerLevel) {
  const level = playerLevel || 0;
  const multiplier = level <= 1 ? 1 : level;

  // Базовые награды по rarity
  let baseBalyary = 1;
  let baseXP = 10;
  if (quest.rarity === 2) {
    baseBalyary = 2;
    baseXP = 20;
  } else if (quest.rarity === 1) {
    baseBalyary = 3;
    baseXP = 30;
  }

  // Умножаем на количество сдаваемых предметов
  const itemCount = quest.target.quantity || 1;
  const fixedBalyary = baseBalyary * itemCount;
  const scaledXP = baseXP * itemCount * multiplier;

  return { balyary: fixedBalyary, xp: scaledXP };
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

  if (have >= need) {
    completeQuest();
    closeNPCDialog();
  }
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
  closeNPCDialog();
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

function getJohnRenderData() {
  if (window.worldSystem?.currentWorldId !== 0) {
    return null;
  }

  if (
    !npcSprite?.complete ||
    npcSprite.naturalWidth <= 0 ||
    npcSprite.naturalHeight <= 0
  ) {
    return null;
  }

  const frame = npcFrame % FRAMES_PER_ROW;

  const row = Math.floor(npcFrame / FRAMES_PER_ROW);

  return {
    id: "john",
    type: "npc",
    visualType: "billboard",

    x: NPC.x,
    y: NPC.y,

    worldId: 0,

    sprite: npcSprite,

    frame,
    row,

    frameCount: FRAMES_PER_ROW,

    frameWidth: NPC.spriteWidth,
    frameHeight: NPC.spriteHeight,

    displayWidth: NPC.width + 10,
    displayHeight: NPC.height + 5,
  };
}

/* ============================== ЭКСПОРТ ============================== */
window.npcSystem = {
  drawNPC, // оставляем для совместимости

  getRenderData: getJohnRenderData,

  /** Возвращает текущую мировую позицию (для depth-sort) */
  getPosition() {
    return { x: NPC.x, y: NPC.y };
  },

  /** Чистый draw — вызывается из code.js после сортировки */
  drawSprite(camX, camY) {
    drawNPCSprite(camX, camY);
  },

  /** Обновление анимации (вызывается из code.js перед depth-sort) */
  updateAnimation(deltaTime) {
    updateNPCAnimation(deltaTime);
  },

  checkNPCProximity: () => {}, // уже есть
  setNPCMet: (met) => {
    isNPCMet = met;
    if (!met) {
      removeNPCButtons();
      hasGreetingBeenShown = false;
      hasNoDocsGreetingBeenShown = false;
    } else if (isPlayerNearNPC) {
      // Если игрок уже рядом — сразу показываем кнопки
      const camera = window.movementSystem.getCamera();
      const screenX = NPC.x - camera.x;
      const screenY = NPC.y - camera.y;
      createNPCButtons(screenX, screenY);
    }
  },
  setSelectedQuest,
  setAvailableQuests,
  checkQuestCompletion,
  updateQuests: (ids) => setAvailableQuests(ids),
  initialize: (sprite) => {
    npcSprite = sprite;
    initializeNPCStyles();
    hasGreetingBeenShown = false;
    hasNoDocsGreetingBeenShown = false;
  },
};

(function registerJohnVisualProvider() {
  "use strict";

  function registerJohn3D() {
    const scene = window.sceneEntitySystem;
    const john = window.npcSystem;

    if (
      typeof scene?.registerNPCVisualProvider !== "function" ||
      typeof scene?.getRegisteredNPCIds !== "function" ||
      typeof john?.getRenderData !== "function"
    ) {
      return false;
    }

    const id = "john";

    // Защита от повторной регистрации.
    if (scene.getRegisteredNPCIds().includes(id)) {
      return true;
    }

    scene.registerNPCVisualProvider(id, {
      getRenderData() {
        return john.getRenderData();
      },
    });

    // Проверяем фактическую регистрацию.
    const registered = scene.getRegisteredNPCIds().includes(id);

    if (registered) {
      console.log("[John3D] Visual provider registered successfully.");
    } else {
      console.error("[John3D] Failed to register visual provider.");
    }

    return registered;
  }

  if (!registerJohn3D()) {
    window.addEventListener("load", registerJohn3D, { once: true });
  }
})();
