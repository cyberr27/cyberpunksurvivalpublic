const NEON_NPC = {
  name: "Neon",
  spriteKey: "alexNeonSprite",
  photoKey: "alexNeonFoto",
  x: 68,
  y: 3959,
  width: 80,
  height: 80,
  spriteWidth: 70,
  spriteHeight: 70,
  interactionRadius: 50,
  speed: 0.04,
  targetA: { x: 68, y: 3959 },
  targetB: { x: 3823, y: 3950 },
  movingToB: true,
  isWaiting: true,
  waitDuration: 20000,
  waitTimer: 0,
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
let neonNoDocDialog = null;
let neonNoLevelDialog = null;
let neonHiDialog = null;
let hasNeonGreetingShownThisApproach = false;

const NEON_QUESTS = [
  {
    id: "neon_quest_1",
    title: "",
    description: "",
    goal: { killMutants: 3 },
    reward: { xp: 150, balyary: 50 },
    isKillQuest: true,
  },
  {
    id: "neon_quest_2",
    title: "",
    description: "",
    goal: { mutant_bone: 10, scorpion_sting: 3 },
    reward: { xp: 333, balyary: 75, item: "recipe_chameleon_equipment" },
    isCollectionQuest: true,
  },
];

const CURRENT_QUEST = NEON_QUESTS[0];

function applyNeonQuestStateFromServer(questState) {
  const me = players.get(myId);
  if (!me) return;

  me.neonQuest = {
    currentQuestId: questState?.currentQuestId ?? null,
    progress: { ...(questState?.progress || {}) },
    completed: Array.isArray(questState?.completed)
      ? [...questState.completed]
      : [],
  };

  players.set(myId, { ...me });
}

function getNeonQuestViewState(me) {
  const q = me?.neonQuest || {
    currentQuestId: null,
    progress: {},
    completed: [],
  };

  let activeQuestIndex = 0;
  if (
    q.completed?.includes("neon_quest_1") &&
    !q.completed?.includes("neon_quest_2")
  ) {
    activeQuestIndex = 1;
  } else if (q.currentQuestId === "neon_quest_2") {
    activeQuestIndex = 1;
  }

  return {
    questData: q,
    quest: NEON_QUESTS[activeQuestIndex],
    activeQuestIndex,
  };
}

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

function neonNpcCloseActiveDialog() {
  if (activeDialog) {
    activeDialog.remove();
    activeDialog = null;
  }
  if (neonNoDocDialog) {
    neonNoDocDialog.remove();
    neonNoDocDialog = null;
  }
  if (neonNoLevelDialog) {
    neonNoLevelDialog.remove();
    neonNoLevelDialog = null;
  }
  if (neonHiDialog) {
    neonHiDialog.remove();
    neonHiDialog = null;
  }
  NEON_NPC.isDialogOpen = false;
  if (window.npcDialogSystem) {
    window.npcDialogSystem.currentOpenNpc = null;
  }

  hasNeonGreetingShownThisApproach = false;
}

function neonNpcOpenNoDocDialog() {
  neonNpcCloseActiveDialog();
  neonNoDocDialog = document.createElement("div");
  neonNoDocDialog.className = "neon-npc-dialog neon-npc-dialog-open";
  neonNoDocDialog.dataset.npc = "neon-nodoc";
  neonNoDocDialog.style.backgroundImage = `url(${images.neonNoDoc?.src || "neon-no-doc.png"})`;
  neonNoDocDialog.style.backgroundSize = "cover";
  neonNoDocDialog.style.backgroundPosition = "center";
  neonNoDocDialog.style.backgroundRepeat = "no-repeat";

  neonNoDocDialog.innerHTML = `
    <div class="neon-npc-dialog-content"></div>
    <button class="neon-npc-btn-ok" onclick="neonNpcCloseNoDocDialog()"></button>
  `;
  document.body.appendChild(neonNoDocDialog);
  NEON_NPC.isDialogOpen = true;
}

window.neonNpcCloseNoDocDialog = () => {
  if (neonNoDocDialog) {
    neonNoDocDialog.remove();
    neonNoDocDialog = null;
  }
  NEON_NPC.isDialogOpen = false;
};

function neonNpcOpenNoLevelDialog() {
  neonNpcCloseActiveDialog();
  neonNoLevelDialog = document.createElement("div");
  neonNoLevelDialog.className = "neon-npc-dialog neon-npc-dialog-open";
  neonNoLevelDialog.dataset.npc = "neon-nolevel";
  neonNoLevelDialog.style.backgroundImage = `url(${images.neonNoLevel?.src || "neon-no-level.png"})`;
  neonNoLevelDialog.style.backgroundSize = "cover";
  neonNoLevelDialog.style.backgroundPosition = "center";
  neonNoLevelDialog.style.backgroundRepeat = "no-repeat";

  neonNoLevelDialog.innerHTML = `
    <div class="neon-npc-dialog-content"></div>
    <button class="neon-npc-btn-ok" onclick="neonNpcCloseNoLevelDialog()"></button>
  `;
  document.body.appendChild(neonNoLevelDialog);
  NEON_NPC.isDialogOpen = true;
}

window.neonNpcCloseNoLevelDialog = () => {
  if (neonNoLevelDialog) {
    neonNoLevelDialog.remove();
    neonNoLevelDialog = null;
  }
  NEON_NPC.isDialogOpen = false;
};

function neonNpcOpenHiDialog() {
  neonNpcCloseActiveDialog();
  neonHiDialog = document.createElement("div");
  neonHiDialog.className = "neon-npc-dialog neon-npc-dialog-open";
  neonHiDialog.dataset.npc = "neon-hi";
  neonHiDialog.style.backgroundImage = `url(${images.neonHi?.src || "neon-hi.png"})`;
  neonHiDialog.style.backgroundSize = "cover";
  neonHiDialog.style.backgroundPosition = "center";
  neonHiDialog.style.backgroundRepeat = "no-repeat";

  neonHiDialog.innerHTML = `
    <div class="neon-npc-dialog-content"></div>
    <button class="neon-npc-btn-ok" onclick="neonNpcConfirmHiMeeting()"></button>
  `;
  document.body.appendChild(neonHiDialog);
  NEON_NPC.isDialogOpen = true;
}

window.neonNpcConfirmHiMeeting = () => {
  if (neonHiDialog) {
    neonHiDialog.remove();
    neonHiDialog = null;
  }
  NEON_NPC.isDialogOpen = false;
  NEON_NPC.isMet = true;
  firstMeetingDialogClosed = true;

  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "meetNeonAlex" }));
  }
};

window.neonNpcCloseFirstMeetingAndEnableButtons = () => {
  neonNpcCloseActiveDialog();
  NEON_NPC.isMet = true;
  firstMeetingDialogClosed = true;
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "meetNeonAlex" }));
  }
};

function neonNpcOpenTalkDialog() {
  neonNpcCloseActiveDialog();
  if (window.npcDialogSystem) {
    window.npcDialogSystem.currentOpenNpc = "neon";
  }

  activeDialog = document.createElement("div");
  activeDialog.className = "neon-npc-dialog neon-npc-dialog-open";
  activeDialog.dataset.npc = "neon-talk";
  activeDialog.style.backgroundImage = `url(${images.neonTalk?.src || images[NEON_NPC.photoKey]?.src || ""})`;
  activeDialog.style.backgroundSize = "cover";
  activeDialog.style.backgroundPosition = "center";
  activeDialog.style.backgroundRepeat = "no-repeat";

  activeDialog.innerHTML = `
    <div class="neon-npc-dialog-content">
      <div id="neonNpcTalkTopics" class="neon-npc-talk-topics"></div>
    </div>
    <button id="neonNpcCloseTalkBtn" class="neon-npc-btn-talk-close"></button>
  `;

  document.body.appendChild(activeDialog);
  NEON_NPC.isDialogOpen = true;

  const topicsContainer = document.getElementById("neonNpcTalkTopics");
  const closeBtn = document.getElementById("neonNpcCloseTalkBtn");

  const topics = [
    {
      title: "О себе",
      text: "Меня зовут Neon Alex. Я вырос среди неоновых вывесок и токсичных туманов. Когда-то работал на корпорацию, пока не понял, что они гниют изнутри. Теперь помогаю тем, кто ещё не продал душу системе.",
    },
    {
      title: "О Неоновом городе",
      text: "Город живёт на обмане и балярах. Сверху — стеклянные башни, снизу — мутанты и отбросы. Неон слепит глаза, чтобы ты не видел, как корпорации выкачивают последние соки из улиц.",
    },
    {
      title: "О мутантах",
      text: "Мутанты — не просто звери. Это то, во что превращаются те, кого система выбросила. Кости и жала — ценный ресурс. Но помни: чем больше убиваешь, тем сильнее они становятся.",
    },
    {
      title: "О корпорациях",
      text: "Корпорации держат город за горло. Документы, уровни доступа, медицинские справки — всё это клетки. Без бумажки ты никто. С бумажкой — просто более удобный раб.",
    },
    {
      title: "Советы сталкеру",
      text: "Не бегай в одиночку в пустоши. Собирай кости и жала — они пригодятся. Следи за уровнем и документами. И никогда не доверяй тому, кто улыбается слишком широко в неоновом свете.",
    },
    {
      title: "О будущем",
      text: "Город на краю. Либо кто-то сломает систему изнутри, либо неон погаснет вместе со всеми нами. Я делаю ставку на тех, кто ещё способен драться. Может, ты один из них.",
    },
  ];

  function renderTopics() {
    topicsContainer.innerHTML = "";
    topicsContainer.classList.remove("hidden");

    topics.forEach((topic) => {
      const div = document.createElement("div");
      div.className = "neon-npc-talk-topic";
      div.innerHTML = `<strong class="neon-npc-talk-topic-title">${topic.title}</strong>`;

      div.addEventListener("click", () => {
        topicsContainer.classList.add("hidden");

        const npcContent = activeDialog.querySelector(
          ".neon-npc-dialog-content",
        );
        npcContent.innerHTML = `
          <div class="neon-npc-talk-fullscreen">
            <div class="neon-npc-talk-text-content">${topic.text}</div>
          </div>
        `;

        closeBtn.onclick = () => {
          // возвращаем список тем
          npcContent.innerHTML = `<div id="neonNpcTalkTopics" class="neon-npc-talk-topics"></div>`;
          const newContainer = document.getElementById("neonNpcTalkTopics");
          // пересоздаём темы
          topics.forEach((t) => {
            const d = document.createElement("div");
            d.className = "neon-npc-talk-topic";
            d.innerHTML = `<strong class="neon-npc-talk-topic-title">${t.title}</strong>`;
            d.addEventListener("click", () => {
              newContainer.classList.add("hidden");
              npcContent.innerHTML = `
                <div class="neon-npc-talk-fullscreen">
                  <div class="neon-npc-talk-text-content">${t.text}</div>
                </div>
              `;
              closeBtn.onclick = () => {
                // снова к списку
                npcContent.innerHTML = `<div id="neonNpcTalkTopics" class="neon-npc-talk-topics"></div>`;
                renderTopicsRecursive(
                  document.getElementById("neonNpcTalkTopics"),
                );
                closeBtn.onclick = neonNpcCloseActiveDialog;
              };
            });
            newContainer.appendChild(d);
          });
          closeBtn.onclick = neonNpcCloseActiveDialog;
        };
      });

      topicsContainer.appendChild(div);
    });
  }

  // вспомогательная рекурсия для повторного рендера
  function renderTopicsRecursive(container) {
    container.innerHTML = "";
    topics.forEach((topic) => {
      const div = document.createElement("div");
      div.className = "neon-npc-talk-topic";
      div.innerHTML = `<strong class="neon-npc-talk-topic-title">${topic.title}</strong>`;
      div.addEventListener("click", () => {
        container.classList.add("hidden");
        const npcContent = activeDialog.querySelector(
          ".neon-npc-dialog-content",
        );
        npcContent.innerHTML = `
          <div class="neon-npc-talk-fullscreen">
            <div class="neon-npc-talk-text-content">${topic.text}</div>
          </div>
        `;
        closeBtn.onclick = () => {
          npcContent.innerHTML = `<div id="neonNpcTalkTopics" class="neon-npc-talk-topics"></div>`;
          renderTopicsRecursive(document.getElementById("neonNpcTalkTopics"));
          closeBtn.onclick = neonNpcCloseActiveDialog;
        };
      });
      container.appendChild(div);
    });
  }

  renderTopics();
  closeBtn.onclick = neonNpcCloseActiveDialog;
}

function refreshNeonQuestDialog() {
  if (!activeDialog || !NEON_NPC.isDialogOpen) return;

  const me = players.get(myId);
  const {
    questData: q,
    quest: CURRENT_QUEST,
    activeQuestIndex,
  } = getNeonQuestViewState(me);

  const shouldShowCompletedState =
    q.currentQuestId === null &&
    Array.isArray(q.completed) &&
    q.completed.includes("neon_quest_1") &&
    !q.completed.includes("neon_quest_2");

  if (shouldShowCompletedState) {
    activeQuestIndex = 1;
  }

  // Меняем класс
  activeDialog.classList.remove("neon-npc-quest-one", "neon-npc-quest-two");
  activeDialog.classList.add(
    activeQuestIndex === 1 ? "neon-npc-quest-two" : "neon-npc-quest-one",
  );

  const bgKey = activeQuestIndex === 1 ? "neonQuestTwo" : "neonQuestOne";
  const bgImg = images[bgKey];
  if (bgImg?.src) {
    activeDialog.style.backgroundImage = `url(${bgImg.src})`;
    activeDialog.style.backgroundSize = "cover";
    activeDialog.style.backgroundPosition = "center";
    activeDialog.style.backgroundRepeat = "no-repeat";
  }

  const isActive = q.currentQuestId === CURRENT_QUEST.id;
  const isCompleted = q.completed?.includes(CURRENT_QUEST.id);

  let statusHTML = "";
  let buttonHTML = "";

  if (isCompleted) {
    statusHTML = `<span style="color:#00ff00;font-weight:bold;">Задание уже выполнено</span>`;
    buttonHTML = `<button class="neon-npc-btn-complete" disabled>Сдать</button>`;
  } else if (isActive) {
    if (CURRENT_QUEST.isKillQuest) {
      const kills = q.progress?.killMutants || 0;
      const needed = CURRENT_QUEST.goal.killMutants;
      if (kills >= needed) {
        statusHTML = `<span class="neon-npc-quest-one-text">Мертвых мутантов: ${kills}/${needed}</span>`;
        buttonHTML = `<button class="neon-npc-btn-complete-quest" onclick="completeNeonQuest()"></button>`;
      } else {
        statusHTML = `<span class="neon-npc-quest-one-text"> Мертвых мутантов: ${kills}/${needed}</span>`;
        buttonHTML = `<button class="neon-npc-btn-complete" disabled>Сдать</button>`;
      }
    } else if (CURRENT_QUEST.isCollectionQuest) {
      // === НОВЫЙ ДИНАМИЧЕСКИЙ ПРОГРЕСС ПО ИНВЕНТАРЮ ===
      const bones = countItemInInventory("mutant_bone");
      const stings = countItemInInventory("scorpion_sting");
      const neededBones = CURRENT_QUEST.goal.mutant_bone;
      const neededStings = CURRENT_QUEST.goal.scorpion_sting;

      const canComplete = bones >= neededBones && stings >= neededStings;

      statusHTML = `<span class="neon-npc-quest-two-text">
        Кости мутанта: ${bones}/${neededBones}<br>
        Жала скорпиона: ${stings}/${neededStings}
      </span>`;

      if (canComplete) {
        buttonHTML = `<button class="neon-npc-btn-complete" onclick="completeNeonQuest()"></button>`;
      } else {
        buttonHTML = `<button class="neon-npc-btn-complete" disabled style="opacity:0.6;cursor:not-allowed;"></button>`;
      }
    }
  } else {
    // Квест ещё не взят
    if (q.completed?.includes("neon_quest_1")) {
      statusHTML = "";
    } else {
      statusHTML = "";
    }
    buttonHTML = `
      <button class="neon-npc-btn-take-quest" onclick="acceptNeonQuest()"></button>
      <button class="neon-npc-btn-cancel-quest" onclick="neonNpcCloseActiveDialog()"></button>
    `;
  }

  const textContainer = activeDialog.querySelector(".neon-npc-text");
  if (textContainer) {
    textContainer.innerHTML = `
    <strong>${CURRENT_QUEST.title}</strong><br><br>
    ${CURRENT_QUEST.description}<br><br>
    <strong>${statusHTML}</strong>
  `;
  }

  const buttonContainer = activeDialog.querySelector(
    "div[style*='text-align:center']",
  );
  if (buttonContainer) {
    buttonContainer.innerHTML = buttonHTML;
  }
}

function neonNpcOpenQuestDialog() {
  neonNpcCloseActiveDialog();
  if (window.npcDialogSystem) {
    window.npcDialogSystem.currentOpenNpc = "neon";
  }

  const me = players.get(myId);
  const { quest: CURRENT_QUEST, activeQuestIndex } = getNeonQuestViewState(me);

  activeDialog = document.createElement("div");
  activeDialog.className =
    "neon-npc-dialog neon-npc-dialog-open " +
    (activeQuestIndex === 1 ? "neon-npc-quest-two" : "neon-npc-quest-one");

  // Принудительно ставим фон сразу
  const bgKey = activeQuestIndex === 1 ? "neonQuestTwo" : "neonQuestOne";
  const bgImg = images[bgKey];
  if (bgImg?.src) {
    activeDialog.style.backgroundImage = `url(${bgImg.src})`;
    activeDialog.style.backgroundSize = "cover";
    activeDialog.style.backgroundPosition = "center";
    activeDialog.style.backgroundRepeat = "no-repeat";
  }

  let statusHTML = "";
  let buttonHTML = `
    <button class="neon-npc-btn-take-quest" onclick="acceptNeonQuest()"></button>
    <button class="neon-npc-btn-cancel-quest" onclick="neonNpcCloseActiveDialog()"></button>
  `;

  activeDialog.innerHTML = `
    <div class="neon-npc-dialog-header"></div>
    <div class="neon-npc-dialog-content">
      <div class="neon-npc-text" style="line-height:1.6;">
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

  refreshNeonQuestDialog();
}

window.acceptNeonQuest = () => {
  const me = players.get(myId);
  if (!me) return;

  // Определяем, какой квест брать
  let questId = "neon_quest_1";
  if (me.neonQuest?.completed?.includes("neon_quest_1")) {
    questId = "neon_quest_2";
  }

  if (!me.neonQuest) {
    me.neonQuest = { currentQuestId: null, progress: {}, completed: [] };
  }

  me.neonQuest.currentQuestId = questId;

  if (questId === "neon_quest_1") {
    me.neonQuest.progress = { killMutants: 0 };
  } else {
    me.neonQuest.progress = {};
  }

  refreshNeonQuestDialog();

  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "neonQuestAccept" }));
  }
  neonNpcCloseActiveDialog();
  createQuestProgressInChat();
};

window.completeNeonQuest = () => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "neonQuestComplete" }));
  }
};

function createNeonButtons(screenX, screenY) {
  if (neonButtonsContainer) return;
  const zoom = window.movementSystem?.getZoom?.() || 1;
  neonButtonsContainer = document.createElement("div");
  neonButtonsContainer.className = "neon-npc-buttons-container";
  neonButtonsContainer.style.left = `${(screenX + 35) * zoom}px`;
  neonButtonsContainer.style.top = `${(screenY - 80) * zoom}px`;

  const talkBtn = document.createElement("div");
  talkBtn.className = "neon-npc-button neon-npc-talk-btn";
  talkBtn.onclick = (e) => {
    e.stopPropagation();
    neonNpcOpenTalkDialog();
  };

  const questBtn = document.createElement("div");
  questBtn.className = "neon-npc-button neon-npc-quests-btn";
  questBtn.onclick = (e) => {
    e.stopPropagation();
    neonNpcOpenQuestDialog();
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

function updateNeonNpc(deltaTime) {
  if (window.worldSystem.currentWorldId !== 0) return;
  const me = players.get(myId);
  if (!me) return;

  const dx = me.x - NEON_NPC.x;
  const dy = me.y - NEON_NPC.y;
  const dist = Math.hypot(dx, dy);
  const nowNear = dist < NEON_NPC.interactionRadius;

  if (nowNear !== NEON_NPC.isPlayerNear) {
    NEON_NPC.isPlayerNear = nowNear;
    if (!nowNear) rejectionShownThisApproach = false;
    hasNeonGreetingShownThisApproach = false;
  }

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

  if (NEON_NPC.isPlayerNear) {
    const rowIndexWhenNear = 4;
    NEON_NPC.currentFrame = rowIndexWhenNear * NEON_FRAMES_PER_ROW + 0;
    NEON_NPC.animationTime = 0;
  } else {
    NEON_NPC.animationTime += deltaTime;
    let rowIndex = 0;

    if (NEON_NPC.isWaiting) {
      rowIndex = NEON_NPC.movingToB ? 2 : 3;
    } else {
      rowIndex = NEON_NPC.movingToB ? 1 : 0;
    }

    const frameInRow =
      Math.floor(NEON_NPC.animationTime / NEON_FRAME_DURATION) %
      NEON_FRAMES_PER_ROW;
    NEON_NPC.currentFrame = rowIndex * NEON_FRAMES_PER_ROW + frameInRow;
  }

  // Взаимодействие работает независимо от режима рендеринга.
  updateNeonNpcInteraction();
}

function updateNeonNpcInteraction() {
  if (window.worldSystem.currentWorldId !== 0) {
    removeNeonButtons();
    return;
  }

  const me = players.get(myId);

  if (!me) {
    removeNeonButtons();
    return;
  }

  if (!NEON_NPC.isPlayerNear) {
    if (NEON_NPC.isDialogOpen) {
      neonNpcCloseActiveDialog();
    }

    removeNeonButtons();
    return;
  }

  const hasDocuments = !!me.corporateDocumentsSubmitted;
  const playerLevel = me.level || 0;

  if (!hasDocuments) {
    if (!NEON_NPC.isDialogOpen && !hasNeonGreetingShownThisApproach) {
      neonNpcOpenNoDocDialog();
      hasNeonGreetingShownThisApproach = true;
    }

    removeNeonButtons();
    return;
  }

  if (playerLevel < 2) {
    if (!NEON_NPC.isDialogOpen && !hasNeonGreetingShownThisApproach) {
      neonNpcOpenNoLevelDialog();
      hasNeonGreetingShownThisApproach = true;
    }

    removeNeonButtons();
    return;
  }

  if (
    !NEON_NPC.isMet &&
    !NEON_NPC.isDialogOpen &&
    !hasNeonGreetingShownThisApproach
  ) {
    neonNpcOpenHiDialog();
    hasNeonGreetingShownThisApproach = true;
    removeNeonButtons();
    return;
  }

  if (NEON_NPC.isDialogOpen) {
    removeNeonButtons();
    return;
  }

  if (NEON_NPC.isMet) {
    const cam = window.movementSystem?.getCamera?.();

    if (cam) {
      const screenX = NEON_NPC.x - cam.x;
      const screenY = NEON_NPC.y - cam.y - 30;

      createNeonButtons(screenX, screenY);
    }
  }
}

function drawNeonNpc() {
  if (window.worldSystem.currentWorldId !== 0) return;

  const camera = window.movementSystem.getCamera();
  const screenX = NEON_NPC.x - camera.x;
  const screenY = NEON_NPC.y - camera.y - 30;

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
      NEON_NPC.width + 15,
      NEON_NPC.height + 15,
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

  ctx.fillStyle = NEON_NPC.isMet ? "#00ffff" : "#ffffff";
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(
    NEON_NPC.isMet ? NEON_NPC.name : "?",
    screenX + 35,
    screenY - 20,
  );

  const player = players.get(myId);
  const level = player?.level || 0;

  if (NEON_NPC.isPlayerNear) {
    const me = players.get(myId);
    const hasDocuments = !!me?.corporateDocumentsSubmitted;
    const playerLevel = me?.level || 0;

    if (!hasDocuments) {
      // 1. Нет документов
      if (!NEON_NPC.isDialogOpen && !hasNeonGreetingShownThisApproach) {
        neonNpcOpenNoDocDialog();
        hasNeonGreetingShownThisApproach = true;
      }
      removeNeonButtons();
    } else if (playerLevel < 2) {
      // 2. Есть документы, но уровень низкий
      if (!NEON_NPC.isDialogOpen && !hasNeonGreetingShownThisApproach) {
        neonNpcOpenNoLevelDialog();
        hasNeonGreetingShownThisApproach = true;
      }
      removeNeonButtons();
    } else {
      // 3. Всё ок — приветственный диалог
      if (
        !NEON_NPC.isMet &&
        !NEON_NPC.isDialogOpen &&
        !hasNeonGreetingShownThisApproach
      ) {
        neonNpcOpenHiDialog();
        hasNeonGreetingShownThisApproach = true;
        removeNeonButtons();
      } else if (NEON_NPC.isMet && !NEON_NPC.isDialogOpen) {
        createNeonButtons(screenX, screenY);
      }
      if (NEON_NPC.isDialogOpen) {
        removeNeonButtons();
      }
    }

    rejectionShownThisApproach = true;
  } else {
    if (NEON_NPC.isDialogOpen) {
      neonNpcCloseActiveDialog();
    }
    removeNeonButtons();
  }
}

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
          if (window.npcDialogSystem)
            window.npcDialogSystem.refreshCurrentDialog();
        }
      }

      if (data.type === "neonQuestSync") {
        if (data.quest) {
          applyNeonQuestStateFromServer(data.quest);
        }
        if (window.npcDialogSystem) {
          window.npcDialogSystem.refreshCurrentDialog();
        }
      }

      if (data.type === "neonQuestStarted") {
        if (data.quest) {
          applyNeonQuestStateFromServer(data.quest);
        }
        showNotification("Задание взято: Очистка пустошей", "#00ff44");
        createQuestProgressInChat();
        if (window.npcDialogSystem)
          window.npcDialogSystem.refreshCurrentDialog();
      }

      if (data.type === "neonQuestCompleted") {
        if (data.quest) {
          applyNeonQuestStateFromServer(data.quest);
        } else {
          const me = players.get(myId);
          if (me) {
            if (!me.neonQuest) {
              me.neonQuest = {
                currentQuestId: null,
                progress: {},
                completed: [],
              };
            }
            const completedId = me.neonQuest.currentQuestId;
            me.neonQuest.currentQuestId = null;
            me.neonQuest.progress = {};
            if (completedId && !me.neonQuest.completed.includes(completedId)) {
              me.neonQuest.completed.push(completedId);
            }
            players.set(myId, { ...me });
          }
        }

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
        if (activeDialog && NEON_NPC.isDialogOpen) {
          refreshNeonQuestDialog();
        }
        if (window.npcDialogSystem)
          window.npcDialogSystem.refreshCurrentDialog();
      }
      if (data.type === "neonMet") {
        const me = players.get(myId);
        if (me) {
          NEON_NPC.isMet = true;
          firstMeetingDialogClosed = true;
        }

        if (data.xpGained > 0) {
          showNotification(
            `Знакомство с NPC + ${data.xpGained} опыта!`,
            "#ffff00",
          );
          if (window.levelSystem) {
            window.levelSystem.setLevelData(
              data.level,
              data.xp,
              null,
              data.upgradePoints || 0,
            );
          }
        }
      }
    } catch (err) {
      console.error("Neon Alex error:", err);
    }
  });
}

function countItemInInventory(itemType) {
  const me = players.get(myId);
  if (!me || !me.inventory) return 0;
  let count = 0;
  for (const slot of me.inventory) {
    if (slot && slot.type === itemType) {
      count += slot.quantity || 1;
    }
  }
  return count;
}

function getNeonNpcRenderData() {
  if (window.worldSystem?.currentWorldId !== 0) {
    return null;
  }

  const sprite = images[NEON_NPC.spriteKey];

  if (
    !sprite?.complete ||
    sprite.naturalWidth <= 0 ||
    sprite.naturalHeight <= 0
  ) {
    return null;
  }

  const row = Math.floor(NEON_NPC.currentFrame / NEON_FRAMES_PER_ROW);

  const frame = NEON_NPC.currentFrame % NEON_FRAMES_PER_ROW;

  return {
    id: "neon",
    type: "npc",
    visualType: "billboard",

    // Сохраняем оригинальное смещение по Y на 30 px.
    x: NEON_NPC.x,
    y: NEON_NPC.y - 30,

    worldId: 0,

    sprite,

    frame,
    row,

    frameCount: NEON_FRAMES_PER_ROW,

    frameWidth: NEON_NPC.spriteWidth,
    frameHeight: NEON_NPC.spriteHeight,

    // Размеры из экспортированного drawSprite().
    displayWidth: NEON_NPC.width + 10,
    displayHeight: NEON_NPC.height + 10,
  };
}

window.neonNpcSystem = {
  update: updateNeonNpc,

  getRenderData: getNeonNpcRenderData,

  /** Возвращает текущую мировую позицию (для depth-sort) */
  getPosition() {
    return { x: NEON_NPC.x, y: NEON_NPC.y };
  },

  /** Чистый draw без проверки worldId — вызывается из code.js после сортировки */
  drawSprite(camX, camY) {
    const screenX = NEON_NPC.x - camX;
    const screenY = NEON_NPC.y - camY - 30;

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
        NEON_NPC.width + 10,
        NEON_NPC.height + 10,
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

    ctx.fillStyle = NEON_NPC.isMet ? "#00ffff" : "#ffffff";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      NEON_NPC.isMet ? NEON_NPC.name : "?",
      screenX + 35,
      screenY - 20,
    );
  },

  /** Старый draw оставляем для совместимости */
  draw() {
    if (window.worldSystem.currentWorldId !== 0) return;
    const cam = window.movementSystem.getCamera();
    this.drawSprite(cam.x, cam.y);
  },
};

(function registerNeonVisualProvider() {
  "use strict";

  function registerNeon3D() {
    const scene = window.sceneEntitySystem;
    const neon = window.neonNpcSystem;

    if (
      typeof scene?.registerNPCVisualProvider !== "function" ||
      typeof scene?.getRegisteredNPCIds !== "function" ||
      typeof neon?.getRenderData !== "function"
    ) {
      return false;
    }

    const id = "neon";

    if (scene.getRegisteredNPCIds().includes(id)) {
      return true;
    }

    scene.registerNPCVisualProvider(id, {
      getRenderData() {
        return neon.getRenderData();
      },
    });

    // Проверяем фактическую регистрацию, а не возвращаемое
    // значение registerNPCVisualProvider().
    const registered = scene.getRegisteredNPCIds().includes(id);

    if (registered) {
      console.log("[Neon3D] Visual provider registered successfully.");
    } else {
      console.error("[Neon3D] Failed to register visual provider.");
    }

    return registered;
  }

  if (!registerNeon3D()) {
    window.addEventListener("load", registerNeon3D, { once: true });
  }
})();

if (typeof window.npcDialogSystem === "undefined") {
  // Загрузи npcDialogSystem.js перед neon_npc.js в index.html
  console.warn("npcDialogSystem.js не загружен");
}
