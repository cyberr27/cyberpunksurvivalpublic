// toremidos.js

const TOREMIDOS_CONFIG = {
  x: 349,
  y: 2530,
  width: 70,
  height: 70,
  interactionRadius: 50,
  name: "Master Toremidos",
  worldId: 0,
};

const TOREMIDOS_MAIN_PHASE_DURATION = 14000;
const TOREMIDOS_ACTIVE_PHASE_DURATION = 5000;
const TOREMIDOS_FRAME_DURATION = 180;
const TOREMIDOS_TOTAL_FRAMES = 13;
const TOREMIDOS_MAX_DELTA = 1000;

let toremidosIsMet = false;
let toremidosIsNear = false;
let toremidosIsDialogOpen = false;

let toremidosSprite = null;
let toremidosButtonsContainer = null;
let toremidosDialogElement = null;

let toremidosFrame = 0;
let toremidosFrameTime = 0;
let toremidosCycleTime = 0;
let toremidosCurrentPhase = "main";

function toremidosOpenNoDocDialog() {
  if (toremidosIsDialogOpen) return;
  toremidosIsDialogOpen = true;
  document.body.classList.add("npc-dialog-active");
  document.body.classList.add("toremidos-dialog-active");

  toremidosDialogElement = document.createElement("div");
  toremidosDialogElement.className = "npc-dialog open";
  toremidosDialogElement.dataset.npc = "toremidos-nodoc";
  toremidosDialogElement.style.backgroundImage = `url(${images.toremidosNoDoc?.src || "toremidosNoDoc.png"})`;
  toremidosDialogElement.style.backgroundSize = "cover";
  toremidosDialogElement.style.backgroundPosition = "center";

  toremidosDialogElement.innerHTML = `
    <div class="npc-dialog-content"></div>
    <button class="neon-btn-thimblerigger-ok" id="toremidos-nodoc-ok"></button>
  `;

  document.body.appendChild(toremidosDialogElement);

  const okBtn = document.getElementById("toremidos-nodoc-ok");
  if (okBtn) {
    okBtn.onclick = () => {
      toremidosCloseDialog();
    };
  }
}

function toremidosOpenGreeting() {
  if (toremidosIsDialogOpen) return;
  toremidosIsDialogOpen = true;
  document.body.classList.add("npc-dialog-active");
  document.body.classList.add("toremidos-dialog-active");

  toremidosDialogElement = document.createElement("div");
  toremidosDialogElement.className = "npc-dialog open";
  toremidosDialogElement.dataset.npc = "toremidos-doc";
  toremidosDialogElement.style.backgroundImage = `url(${images.toremidosDoc?.src || "toremidosDoc.png"})`;
  toremidosDialogElement.style.backgroundSize = "cover";
  toremidosDialogElement.style.backgroundPosition = "center";

  toremidosDialogElement.innerHTML = `
    <div class="npc-dialog-content"></div>
    <button class="neon-btn-thimblerigger-ok" id="toremidos-greeting-ok"></button>
  `;

  document.body.appendChild(toremidosDialogElement);

  const okBtn = document.getElementById("toremidos-greeting-ok");
  if (okBtn) {
    okBtn.onclick = () => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "meetToremidos" }));
      }
      toremidosCloseDialog();
    };
  }
}

function toremidosOpenDialog() {
  toremidosCloseDialog();

  toremidosIsDialogOpen = true;
  document.body.classList.add("npc-dialog-active"); // универсальный класс (блокирует скролл)
  document.body.classList.add("toremidos-dialog-active");

  toremidosDialogElement = document.createElement("div");
  toremidosDialogElement.className = "npc-dialog open"; // универсальный контейнер
  toremidosDialogElement.dataset.npc = "toremidos-talk";
  toremidosDialogElement.style.backgroundImage = `url(toremidos-talk-bg.png)`;
  toremidosDialogElement.style.backgroundSize = "cover";
  toremidosDialogElement.style.backgroundPosition = "center";

  toremidosDialogElement.innerHTML = `
    <div class="npc-dialog-content">
      <div id="toremidosTalkTopics" class="toremidos-talk-topics"></div>
    </div>
    <button id="toremidosCloseTalkBtn" class="neon-btn-thimblerigger"></button>
  `;

  document.body.appendChild(toremidosDialogElement);

  const topicsContainer = document.getElementById("toremidosTalkTopics");
  const closeBtn = document.getElementById("toremidosCloseTalkBtn");

  const topics = [
    {
      title: "О себе",
      text: "Я Торемидос. Раньше учил бойцов в Верхних уровнях, пока корпорации не решили, что навыки можно качать чипами. Теперь сижу здесь и смотрю, кто ещё помнит, что такое настоящая сила.",
    },
    {
      title: "О навыках",
      text: "Навык — это не цифра в интерфейсе. Это то, что остаётся, когда батарейка садится и неон гаснет. Качай то, что реально спасает жизнь, а не то, что красиво светится.",
    },
    {
      title: "О Неоновом городе",
      text: "Город жрёт слабых. Корпорации, банды, аномалии — все хотят кусок. Единственный способ выжить — стать сильнее быстрее, чем они успеют тебя заметить.",
    },
    {
      title: "Про корпорации",
      text: "Они продают импланты и говорят, что это прогресс. А я видел, как после отказа чипа парень забывал, как держать нож. Настоящая сила не в железе.",
    },
    {
      title: "Совет сталкеру",
      text: "Не трать очки на ерунду. Сначала удар и выносливость — без них ты просто мишень. Остальное — потом. И не подходи ко мне, если руки трясутся.",
    },
    {
      title: "О будущем",
      text: "Когда-нибудь неон погаснет. Те, кто качал только чипы, останутся беспомощными. А те, кто качал себя — будут править руинами. Выбирай, кем хочешь быть.",
    },
  ];

  topics.forEach((topic) => {
    const div = document.createElement("div");
    div.className = "toremidos-talk-topic";
    div.innerHTML = `<strong class="toremidos-talk-topic-title">${topic.title}</strong>`;

    div.addEventListener("click", () => {
      topicsContainer.classList.add("hidden");

      const npcContent = toremidosDialogElement.querySelector(
        ".npc-dialog-content",
      );
      npcContent.innerHTML = `
        <div class="toremidos-fullscreen">
          <div class="toremidos-talk-text-content">${topic.text}</div>
        </div>
      `;
      closeBtn.onclick = () => showToremidosTopics();
    });

    topicsContainer.appendChild(div);
  });

  function showToremidosTopics() {
    topicsContainer.classList.remove("hidden");
    const npcContent = toremidosDialogElement.querySelector(
      ".npc-dialog-content",
    );

    npcContent.innerHTML = `<div id="toremidosTalkTopics" class="toremidos-talk-topics"></div>`;

    const newTopicsContainer = document.getElementById("toremidosTalkTopics");
    topics.forEach((topic) => {
      const div = document.createElement("div");
      div.className = "toremidos-talk-topic";
      div.innerHTML = `<strong class="toremidos-talk-topic-title">${topic.title}</strong>`;
      div.addEventListener("click", () => {
        newTopicsContainer.classList.add("hidden");
        npcContent.innerHTML = `
          <div class="toremidos-fullscreen">
            <div class="toremidos-talk-text-content">${topic.text}</div>
          </div>
        `;
        closeBtn.onclick = () => showToremidosTopics();
      });
      newTopicsContainer.appendChild(div);
    });

    closeBtn.onclick = toremidosCloseDialog;
  }

  closeBtn.onclick = toremidosCloseDialog;
}

function toremidosOpenSkillsWindow() {
  if (document.getElementById("toremidos-skills-container")) return;

  const container = document.createElement("div");
  container.id = "toremidos-skills-container";
  container.className = "skills-container";
  container.style.position = "fixed";
  container.style.top = "50%";
  container.style.left = "50%";
  container.style.transform = "translate(-50%, -50%)";
  container.style.zIndex = "1001";
  container.style.width = "min(540px, 94vw)";
  container.style.height = "min(620px, 90vh)";

  container.innerHTML = `
    <div class="skills-header" style="padding:12px; border-bottom:2px solid #00ffff; position:relative;">
      <h2 style="margin:0; color:#00ffff;">Умения (Торемидос)</h2>
      <button id="toremidos-skills-close" style="
        position:absolute; right:12px; top:12px; background:transparent; border:none;
        color:#ff0044; font-size:28px; cursor:pointer; line-height:1;">×</button>
    </div>
    <div id="toremidos-skills-grid" style="
      display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); grid-auto-rows:minmax(0,1fr); gap:12px; padding:12px; min-height:0; overflow-y:auto; align-content:stretch;"></div>
    <div id="toremidos-skills-description" style="
      padding:12px 15px; background:rgba(0,0,0,0.6); border-top:1px solid #00ffff;
      color:#e0e0ff; min-height:100px; max-height:150px; overflow-y:auto;"></div>
  `;

  document.body.appendChild(container);

  document.getElementById("toremidos-skills-close").onclick = () => {
    container.remove();
  };

  const grid = document.getElementById("toremidos-skills-grid");
  const desc = document.getElementById("toremidos-skills-description");

  for (let i = 0; i < window.skillsSystem.skillTemplates.length; i++) {
    const template = window.skillsSystem.skillTemplates[i];
    if (!template) continue;

    const slot = document.createElement("div");
    slot.className = "skill-slot";
    slot.dataset.index = i;

    const playerSkill = window.skillsSystem.playerSkills.find(
      (s) => s.id === template.id,
    );

    if (template.code) {
      const img = document.createElement("img");
      img.src = `images/skills/${template.code}.png`;
      img.alt = template.name;
      slot.appendChild(img);
    } else {
      slot.classList.add("skill-slot-placeholder");
      slot.setAttribute("aria-label", template.name);
    }

    const badge = document.createElement("div");
    badge.className = "level-badge";
    badge.textContent = `${playerSkill?.level || 0}/${template.maxLevel}`;
    slot.appendChild(badge);

    if (!playerSkill || playerSkill.level === 0) {
      slot.style.opacity = "0.85";
    }

    slot.onclick = () => {
      grid
        .querySelectorAll(".skill-slot")
        .forEach((s) => s.classList.remove("active"));
      slot.classList.add("active");

      const currentLevel = playerSkill?.level || 0;
      const canUpgrade =
        template.implemented !== false &&
        window.skillsSystem.skillPoints > 0 &&
        currentLevel < template.maxLevel;

      desc.innerHTML = `
        <h3>${template.name} (ур. ${currentLevel}/${template.maxLevel})</h3>
        <p>${template.description}</p>
        <p style="margin-top:12px; color:#00ffcc; font-weight:bold;">
          Доступно очков навыков: <strong>${window.skillsSystem.skillPoints}</strong>
        </p>
        <button id="toremidos-upgrade-btn" 
                class="toremidos-neon-btn upgrade-skill-btn" 
                style="margin-top:12px; width:100%; font-size:16px;"
                ${canUpgrade ? "" : "disabled"}>
          Улучшить (1 очко)
        </button>
      `;

      const upgradeBtn = document.getElementById("toremidos-upgrade-btn");
      if (upgradeBtn && canUpgrade) {
        upgradeBtn.onclick = () => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: "upgradeSkill",
                skillId: template.id,
              }),
            );
          }
        };
      }
    };

    grid.appendChild(slot);
  }

  if (!grid.querySelector(".active")) {
    desc.innerHTML =
      "<p style='text-align:center; padding:20px;'>Выберите умение для улучшения</p>";
  }
}

function toremidosCloseDialog() {
  if (toremidosDialogElement) {
    toremidosDialogElement.remove();
    toremidosDialogElement = null;
  }
  document.body.classList.remove("toremidos-dialog-active");
  document.body.classList.remove("npc-dialog-active");
  toremidosIsDialogOpen = false;

  const skillsWin = document.getElementById("toremidos-skills-container");
  if (skillsWin) skillsWin.remove();
}

function toremidosCreateButtons() {
  if (toremidosButtonsContainer) return;

  toremidosButtonsContainer = document.createElement("div");
  toremidosButtonsContainer.className = "toremidos-buttons-container";

  const talkBtn = document.createElement("div");
  talkBtn.className = "toremidos-button toremidos-talk-btn";
  talkBtn.onclick = () => toremidosOpenDialog();

  const skillsBtn = document.createElement("div");
  skillsBtn.className = "toremidos-button toremidos-skills-btn";
  skillsBtn.onclick = () => toremidosOpenSkillsWindow();

  toremidosButtonsContainer.append(talkBtn, skillsBtn);
  document.body.appendChild(toremidosButtonsContainer);

  // Позиционируем сразу
  toremidosUpdateButtonsPosition(
    window.movementSystem.getCamera().x,
    window.movementSystem.getCamera().y,
  );
}

function toremidosRemoveButtons() {
  if (toremidosButtonsContainer) {
    toremidosButtonsContainer.remove();
    toremidosButtonsContainer = null;
  }
}

function toremidosUpdateButtonsPosition(cameraX, cameraY) {
  if (!toremidosButtonsContainer || !toremidosIsNear) return;

  const zoom = window.movementSystem?.getZoom?.() || 1;
  const screenX = TOREMIDOS_CONFIG.x - cameraX + 35;
  const screenY = TOREMIDOS_CONFIG.y - cameraY - 90;

  toremidosButtonsContainer.style.left = `${screenX * zoom}px`;
  toremidosButtonsContainer.style.top = `${screenY * zoom}px`;
}

function toremidosUpdateAnimation(deltaTime) {
  if (window.worldSystem.currentWorldId !== TOREMIDOS_CONFIG.worldId) return;

  deltaTime = Math.min(deltaTime, TOREMIDOS_MAX_DELTA);

  if (toremidosIsNear) {
    toremidosFrame = 0;
    toremidosFrameTime = 0;
    toremidosCycleTime = 0;
    toremidosCurrentPhase = "main";
  } else {
    toremidosCycleTime += deltaTime;
    const phaseDuration =
      toremidosCurrentPhase === "main"
        ? TOREMIDOS_MAIN_PHASE_DURATION
        : TOREMIDOS_ACTIVE_PHASE_DURATION;

    while (toremidosCycleTime >= phaseDuration) {
      toremidosCycleTime -= phaseDuration;
      toremidosCurrentPhase =
        toremidosCurrentPhase === "main" ? "active" : "main";
      toremidosFrame = 0;
      toremidosFrameTime = 0;
    }

    toremidosFrameTime += deltaTime;
    while (toremidosFrameTime >= TOREMIDOS_FRAME_DURATION) {
      toremidosFrameTime -= TOREMIDOS_FRAME_DURATION;
      toremidosFrame = (toremidosFrame + 1) % TOREMIDOS_TOTAL_FRAMES;
    }
  }
}

function toremidosDrawSprite(camX, camY) {
  if (window.worldSystem.currentWorldId !== TOREMIDOS_CONFIG.worldId) return;

  const screenX = TOREMIDOS_CONFIG.x - camX;
  const screenY = TOREMIDOS_CONFIG.y - camY;

  let sx, sy;

  if (toremidosIsNear) {
    sx = 0;
    sy = 0;
  } else {
    sy = toremidosCurrentPhase === "main" ? 70 : 0;
    sx = toremidosFrame * 70;
  }

  if (toremidosSprite?.complete) {
    ctx.drawImage(toremidosSprite, sx, sy, 70, 70, screenX, screenY, 90, 90);
  } else {
    ctx.fillStyle = "#00aaff";
    ctx.fillRect(screenX, screenY, 70, 70);
  }

  ctx.fillStyle = toremidosIsMet ? "#fbff00" : "#ffffff";
  ctx.font = "13px Arial";
  ctx.strokeStyle = "#000";
  ctx.textAlign = "center";
  ctx.fillText(
    toremidosIsMet ? TOREMIDOS_CONFIG.name : "?",
    screenX + 35,
    screenY - 12,
  );

  if (toremidosIsNear) {
    toremidosUpdateButtonsPosition(camX, camY);
  }
}

function toremidosDraw(deltaTime) {
  toremidosUpdateAnimation(deltaTime);
  const cam = window.movementSystem.getCamera();
  toremidosDrawSprite(cam.x, cam.y);
}

function toremidosCheckProximity() {
  const player = players.get(myId);
  if (
    !player ||
    player.worldId !== TOREMIDOS_CONFIG.worldId ||
    player.health <= 0
  ) {
    if (toremidosIsNear) {
      toremidosIsNear = false;
      toremidosRemoveButtons();
      toremidosCloseDialog();
    }
    return;
  }

  const dx = player.x + 35 - (TOREMIDOS_CONFIG.x + 35);
  const dy = player.y + 35 - (TOREMIDOS_CONFIG.y + 35);
  const dist = Math.hypot(dx, dy);

  const nowNear = dist < TOREMIDOS_CONFIG.interactionRadius;

  if (nowNear && !toremidosIsNear) {
    toremidosIsNear = true;
    if (toremidosIsMet) {
      toremidosCreateButtons();
    } else {
      // Документы не сданы → показываем no-doc диалог (без знакомства)
      const me = players.get(myId);
      const hasDocuments = me && me.corporateDocumentsSubmitted === true;

      if (!hasDocuments) {
        toremidosOpenNoDocDialog();
      } else {
        toremidosOpenGreeting();
      }
    }
  } else if (!nowNear && toremidosIsNear) {
    toremidosIsNear = false;
    toremidosRemoveButtons();
    toremidosCloseDialog();
    toremidosCurrentPhase = "main";
    toremidosCycleTime = 0;
    toremidosFrame = 0;
    toremidosFrameTime = 0;
  }
}

function toremidosSetMet(met) {
  toremidosIsMet = !!met;
  if (toremidosIsNear) {
    if (toremidosIsMet) {
      toremidosCreateButtons();
    } else {
      toremidosRemoveButtons();
    }
  }
}

function getToremidosRenderData() {
  if (window.worldSystem?.currentWorldId !== TOREMIDOS_CONFIG.worldId) {
    return null;
  }

  if (
    !toremidosSprite?.complete ||
    toremidosSprite.naturalWidth <= 0 ||
    toremidosSprite.naturalHeight <= 0
  ) {
    return null;
  }

  // Полностью повторяем выбор кадра из toremidosDrawSprite().
  const frame = toremidosIsNear ? 0 : toremidosFrame;

  const row = toremidosIsNear ? 0 : toremidosCurrentPhase === "main" ? 1 : 0;

  return {
    id: "toremidos",
    type: "npc",
    visualType: "billboard",

    // Исходные мировые координаты.
    x: TOREMIDOS_CONFIG.x,
    y: TOREMIDOS_CONFIG.y,

    worldId: TOREMIDOS_CONFIG.worldId,

    sprite: toremidosSprite,

    frame,
    row,

    frameCount: TOREMIDOS_TOTAL_FRAMES,

    frameWidth: 70,
    frameHeight: 70,

    // Размеры оригинальной 2D-отрисовки.
    displayWidth: 90,
    displayHeight: 90,
  };
}

window.toremidosSystem = {
  initialize: (img) => {
    toremidosSprite = img;
    toremidosCurrentPhase = "main";
    toremidosCycleTime = 0;
    toremidosFrame = 0;
    toremidosFrameTime = 0;
  },

  // Визуальные данные для общего WebGL2-рендерера.
  getRenderData: getToremidosRenderData,

  getPosition() {
    return { x: TOREMIDOS_CONFIG.x, y: TOREMIDOS_CONFIG.y };
  },

  drawSprite(camX, camY) {
    toremidosDrawSprite(camX, camY);
  },

  updateAnimation(deltaTime) {
    toremidosUpdateAnimation(deltaTime);
  },

  draw: toremidosDraw,
  checkProximity: toremidosCheckProximity,
  setMet: toremidosSetMet,
};

(function registerToremidosVisualProvider() {
  "use strict";

  function registerToremidos3D() {
    const scene = window.sceneEntitySystem;
    const toremidos = window.toremidosSystem;

    if (
      typeof scene?.registerNPCVisualProvider !== "function" ||
      typeof scene?.getRegisteredNPCIds !== "function" ||
      typeof toremidos?.getRenderData !== "function"
    ) {
      return false;
    }

    const id = "toremidos";

    // Защита от повторной регистрации.
    if (scene.getRegisteredNPCIds().includes(id)) {
      return true;
    }

    // Регистрируем визуального провайдера.
    scene.registerNPCVisualProvider(id, {
      getRenderData() {
        return toremidos.getRenderData();
      },
    });

    // Проверяем фактическую регистрацию.
    const registered = scene.getRegisteredNPCIds().includes(id);

    if (registered) {
      console.log("[Toremidos3D] Visual provider registered successfully.");
    } else {
      console.error("[Toremidos3D] Failed to register visual provider.");
    }

    return registered;
  }

  // Первая попытка сразу после выполнения скрипта.
  if (!registerToremidos3D()) {
    // Повторная попытка после загрузки страницы.
    window.addEventListener("load", registerToremidos3D, { once: true });
  }
})();
