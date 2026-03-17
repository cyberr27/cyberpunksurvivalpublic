// toremidos.js

const TOREMIDOS_CONFIG = {
  x: 575,
  y: 1140,
  width: 70,
  height: 70,
  interactionRadius: 80,
  name: "Мастер Торемидос",
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

function toremidosOpenGreeting() {
  if (toremidosIsDialogOpen) return;
  toremidosIsDialogOpen = true;
  document.body.classList.add("toremidos-dialog-active");

  toremidosDialogElement = document.createElement("div");
  toremidosDialogElement.className = "toremidos-dialog open";
  toremidosDialogElement.innerHTML = `
    <div class="toremidos-dialog-header">
      <h2 class="toremidos-title">Торемидос</h2>
    </div>
    <div class="toremidos-dialog-content">
      <p class="toremidos-text">Эй, ты... Первый раз вижу тебя здесь.</p>
      <p class="toremidos-text">Я Торемидос. Не люблю незнакомцев, но ты не похож на корпоративную шавку.</p>
      <p class="toremidos-text">Говори, чего хотел, или вали отсюда.</p>
    </div>
    <button class="toremidos-neon-btn" id="toremidos-greeting-continue">
      Понял, давай знакомиться
    </button>
  `;
  document.body.appendChild(toremidosDialogElement);

  document.getElementById("toremidos-greeting-continue").onclick = () => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "meetToremidos" }));
    }
    toremidosCloseDialog();
  };
}

function toremidosOpenDialog() {
  toremidosCloseDialog();

  toremidosIsDialogOpen = true;
  document.body.classList.add("toremidos-dialog-active");

  toremidosDialogElement = document.createElement("div");
  toremidosDialogElement.className = "toremidos-dialog open";
  toremidosDialogElement.innerHTML = `
    <div class="toremidos-dialog-header">
      <h2 class="toremidos-title">Торемидос</h2>
    </div>
    <div class="toremidos-dialog-content">
      <p class="toremidos-text">Ну, говори уже. Только без воды — у меня времени мало.</p>
      <p class="toremidos-text">(здесь будет большой диалог / ветвление разговора)</p>
    </div>
    <button class="toremidos-neon-btn" id="toremidos-close-btn">ЗАКРЫТЬ</button>
  `;
  document.body.appendChild(toremidosDialogElement);

  document.getElementById("toremidos-close-btn").onclick = () => {
    toremidosCloseDialog();
  };
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
  container.style.width = "540px";
  container.style.height = "480px";

  container.innerHTML = `
    <div class="skills-header" style="padding:12px; border-bottom:2px solid #00ffff; position:relative;">
      <h2 style="margin:0; color:#00ffff;">Умения (Торемидос)</h2>
      <button id="toremidos-skills-close" style="
        position:absolute; right:12px; top:12px; background:transparent; border:none;
        color:#ff0044; font-size:28px; cursor:pointer; line-height:1;">×</button>
    </div>
    <div id="toremidos-skills-grid" style="
      display:grid; grid-template-columns:repeat(5,1fr); gap:12px; padding:20px;"></div>
    <div id="toremidos-skills-description" style="
      padding:15px; background:rgba(0,0,0,0.6); border-top:1px solid #00ffff;
      color:#e0e0ff; min-height:100px;"></div>
  `;

  document.body.appendChild(container);

  document.getElementById("toremidos-skills-close").onclick = () => {
    container.remove();
  };

  const grid = document.getElementById("toremidos-skills-grid");
  const desc = document.getElementById("toremidos-skills-description");

  for (let i = 0; i < 10; i++) {
    const template = window.skillsSystem.skillTemplates[i];
    if (!template) continue;

    const slot = document.createElement("div");
    slot.className = "skill-slot";
    slot.dataset.index = i;

    const playerSkill = window.skillsSystem.playerSkills.find(
      (s) => s.id === template.id,
    );

    const img = document.createElement("img");
    img.src = `images/skills/${template.code}.png`;
    img.alt = template.name;
    slot.appendChild(img);

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
        window.skillsSystem.skillPoints > 0 && currentLevel < template.maxLevel;

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
  talkBtn.textContent = "ГОВОРИТЬ";
  talkBtn.onclick = () => toremidosOpenDialog();

  const skillsBtn = document.createElement("div");
  skillsBtn.className = "toremidos-button toremidos-skills-btn";
  skillsBtn.textContent = "НАВЫКИ";
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

  const screenX = TOREMIDOS_CONFIG.x - cameraX + 35;
  const screenY = TOREMIDOS_CONFIG.y - cameraY - 110;

  toremidosButtonsContainer.style.left = `${screenX}px`;
  toremidosButtonsContainer.style.top = `${screenY}px`;
}

function toremidosDraw(deltaTime) {
  if (window.worldSystem.currentWorldId !== TOREMIDOS_CONFIG.worldId) return;

  deltaTime = Math.min(deltaTime, TOREMIDOS_MAX_DELTA);

  const camera = window.movementSystem.getCamera();
  const screenX = TOREMIDOS_CONFIG.x - camera.x;
  const screenY = TOREMIDOS_CONFIG.y - camera.y;

  let sx, sy;

  if (toremidosIsNear) {
    sx = 0;
    sy = 0;
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

    sy = toremidosCurrentPhase === "main" ? 70 : 0;
    sx = toremidosFrame * 70;
  }

  if (toremidosSprite?.complete) {
    ctx.drawImage(toremidosSprite, sx, sy, 70, 70, screenX, screenY, 70, 70);
  } else {
    ctx.fillStyle = "#00aaff";
    ctx.fillRect(screenX, screenY, 70, 70);
  }

  ctx.fillStyle = toremidosIsMet ? "#fbff00" : "#ffffff";
  ctx.font = "13px Arial";
  ctx.textAlign = "center";
  ctx.fillText(
    toremidosIsMet ? TOREMIDOS_CONFIG.name : "?",
    screenX + 35,
    screenY - 12,
  );

  // Обновляем позицию кнопок каждый кадр, когда игрок рядом
  if (toremidosIsNear) {
    toremidosUpdateButtonsPosition(camera.x, camera.y);
  }
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
      toremidosOpenGreeting();
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

window.toremidosSystem = {
  initialize: (img) => {
    toremidosSprite = img;
    toremidosCurrentPhase = "main";
    toremidosCycleTime = 0;
    toremidosFrame = 0;
    toremidosFrameTime = 0;
  },
  draw: toremidosDraw,
  checkProximity: toremidosCheckProximity,
  setMet: toremidosSetMet,
};
