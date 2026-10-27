// ===============================================
//          КАПИТАН ЗАСТАВЫ — ФИНАЛЬНАЯ ВЕРСИЯ 2025 (ОБНОВЛЕНО ПОД НОВУЮ ЛОГИКУ ПЕЧАТИ)
// ===============================================

const OUTPOST_CAPTAIN = {
  x: 2909,
  y: 990,
  width: 70,
  height: 70,
  interactionRadius: 50,
  name: "Captain Sheva",
  spriteSrc: "outpost_captain.png",
  totalFrames: 13,
  frameDuration: 300,
};

let isCaptainMet = false;
let isCaptainDialogOpen = false;
let hasCaptainGreetingShown = false;

let captainButtonsContainer = null;
let captainSprite = null;

let captainFrame = 0;
let captainFrameTime = 0;

const captainTopics = [
  {
    title: "О себе",
    text: "Я Райдер, капитан заставы «Северный Периметр». Когда-то служил в корпоративной охране. После Отключения остался здесь — держать рубеж. Не герой. Просто тот, кто не сбежал, когда все остальные сбежали.",
  },
  {
    title: "О заставах",
    text: "Мы — последняя линия между Неоновым Городом и Пустошами. Патрули, мутанты, рейдеры, караваны. Каждый день — война. Пока мы стоим — город живёт. Когда упадём — город падёт следом.",
  },
  {
    title: "Пустоши",
    text: "За стенами — ад. Песчаные бури, радиация, мутанты размером с грузовик. Вода — на вес золота. Люди там либо становятся рейдерами, либо остаются костями в песке. Старые города? Только ржавчина и тишина.",
  },
  {
    title: "Корпорации",
    text: "Эти ублюдки в башнях думают, что могут купить всё. Предлагали контракт — охранять их грузы. Отказались. Сегодня ты их сторож, завтра они сбрасывают бомбу на твою заставу. Не ведись.",
  },
  {
    title: "Совет сталкеру",
    text: "В этом мире выживает не сильнейший — а тот, кто не сдаётся. Собирай всё, чему можно найти применение. Не свети балярами. И никогда не доверяй тому, кто слишком красиво говорит о «светлом будущем».",
  },
  {
    title: "Будущее периметра",
    text: "Заставы держатся на людях, а не на стенах. Если найдутся те, кто готов стоять рядом — мы продержимся. Если нет — песок заберёт всё. Выбор за тобой, сталкер.",
  },
];

function initializeCaptain() {
  if (captainSprite) {
    return;
  }

  const sprite = new Image();
  sprite.src = OUTPOST_CAPTAIN.spriteSrc;
  captainSprite = sprite;
}

function updateCaptain(deltaTime) {
  // Обновляем существующую анимацию.
  captainFrameTime += deltaTime;

  while (captainFrameTime >= OUTPOST_CAPTAIN.frameDuration) {
    captainFrameTime -= OUTPOST_CAPTAIN.frameDuration;

    captainFrame = (captainFrame + 1) % OUTPOST_CAPTAIN.totalFrames;
  }

  // Проверяем взаимодействие независимо от рендерера.
  updateCaptainInteraction();
}

// ===============================================
// ЗАКРЫТИЕ ВСЕГО ПРИ ВЫХОДЕ ИЗ ЗОНЫ
// ===============================================
function closeAllCaptainUI() {
  removeCaptainButtons();
  const dialog = document.getElementById("captainDialog");
  if (dialog) dialog.remove();
  isCaptainDialogOpen = false;
  document.body.classList.remove("npc-dialog-active");

  // Если ещё не знакомы — разрешаем снова показать приветствие при следующем подходе
  if (!isCaptainMet) {
    hasCaptainGreetingShown = false;
  }
}

function updateCaptainInteraction() {
  if (window.worldSystem?.currentWorldId !== 0) {
    closeAllCaptainUI();
    return;
  }

  const me = players.get(myId);

  if (!me || me.health <= 0 || me.worldId !== 0) {
    closeAllCaptainUI();
    return;
  }

  const dist = Math.hypot(me.x - OUTPOST_CAPTAIN.x, me.y - OUTPOST_CAPTAIN.y);

  const isNear = dist < OUTPOST_CAPTAIN.interactionRadius;

  if (!isNear) {
    closeAllCaptainUI();
    return;
  }

  if (!isCaptainMet && !hasCaptainGreetingShown) {
    showCaptainGreeting();
    return;
  }

  if (isCaptainMet) {
    const camera = window.movementSystem?.getCamera?.();

    if (!camera) return;

    const screenX = OUTPOST_CAPTAIN.x - camera.x;
    const screenY = OUTPOST_CAPTAIN.y - camera.y - OUTPOST_CAPTAIN.height + 30;

    createCaptainButtons(screenX, screenY);

    // Обновляем положение кнопок при движении 2D-камеры.
    if (captainButtonsContainer) {
      const zoom = window.movementSystem?.getZoom?.() || 1;

      captainButtonsContainer.style.left = (screenX + 35) * zoom + "px";

      captainButtonsContainer.style.top = (screenY - 120) * zoom + "px";
    }
  }
}

// ===============================================
// ОТРИСОВКА + ЛОГИКА ВЗАИМОДЕЙСТВИЯ
// ===============================================
function drawCaptainSprite(camX, camY) {
  if (window.worldSystem.currentWorldId !== 0) return;

  const screenX = OUTPOST_CAPTAIN.x - camX;
  const screenY = OUTPOST_CAPTAIN.y - camY - OUTPOST_CAPTAIN.height + 30;

  if (
    screenX < -200 ||
    screenX > canvas.width + 200 ||
    screenY < -200 ||
    screenY > canvas.height + 200
  ) {
    return;
  }

  if (captainSprite?.complete && captainSprite.naturalWidth > 0) {
    ctx.drawImage(
      captainSprite,
      captainFrame * 70,
      0,
      70,
      70,
      screenX,
      screenY,
      90,
      90,
    );
  } else {
    ctx.fillStyle = "#00ffff";
    ctx.fillRect(screenX, screenY, 70, 70);
    ctx.fillStyle = "#000";
    ctx.font = "12px Courier New";
    ctx.fillText("CAPT", screenX + 20, screenY + 40);
  }

  ctx.font = "16px 'Courier New'";
  ctx.fillStyle = "#fff200";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 3;
  ctx.textAlign = "center";
  ctx.strokeText(
    isCaptainMet ? OUTPOST_CAPTAIN.name : "?",
    screenX + 35,
    screenY - 20,
  );
  ctx.fillText(
    isCaptainMet ? OUTPOST_CAPTAIN.name : "?",
    screenX + 35,
    screenY - 20,
  );

  const me = players.get(myId);
  if (!me) return;
}

// Старый draw оставляем для совместимости
function drawCaptain(ctx, cameraX, cameraY) {
  drawCaptainSprite(cameraX, cameraY);
}

// ===============================================
// ПРИВЕТСТВИЕ
// ===============================================
function showCaptainGreeting() {
  if (isCaptainDialogOpen || hasCaptainGreetingShown) return;

  const me = players.get(myId);
  const hasCertificate = me && me.medicalCertificate === true;

  isCaptainDialogOpen = true;
  document.body.classList.add("npc-dialog-active");
  hasCaptainGreetingShown = true;

  const dialog = document.createElement("div");
  dialog.className = "npc-dialog open";
  dialog.id = "captainDialog";
  dialog.dataset.npc = hasCertificate ? "sheva-doc" : "sheva-nodoc";
  dialog.style.backgroundImage = `url(${
    hasCertificate
      ? images.shevaDoc?.src || "shevaDoc.png"
      : images.shevaNoDoc?.src || "shevaNoDoc.png"
  })`;
  dialog.style.backgroundSize = "cover";
  dialog.style.backgroundPosition = "center";

  dialog.innerHTML = `
    <div class="npc-dialog-content"></div>
    <button class="neon-btn-thimblerigger-ok" id="captainGreetingOk"></button>
  `;

  document.getElementById("gameContainer").appendChild(dialog);

  const okBtn = dialog.querySelector("#captainGreetingOk");
  if (okBtn) {
    okBtn.onclick = () => {
      dialog.remove();
      isCaptainDialogOpen = false;
      document.body.classList.remove("npc-dialog-active");

      if (hasCertificate) {
        // Знакомимся только если справка получена
        if (ws?.readyState === WebSocket.OPEN) {
          sendWhenReady(
            ws,
            JSON.stringify({ type: "meetCaptain", captainMet: true }),
          );
        }
      }
    };
  }
}

// ===============================================
// КНОПКИ НАД ГОЛОВОЙ
// ===============================================
function createCaptainButtons(screenX, screenY) {
  if (captainButtonsContainer) return;

  captainButtonsContainer = document.createElement("div");
  captainButtonsContainer.className = "npc-buttons-container";
  const zoom = window.movementSystem?.getZoom?.() || 1;
  captainButtonsContainer.style.left = (screenX + 35) * zoom + "px";
  captainButtonsContainer.style.top = (screenY - 120) * zoom + "px";
  captainButtonsContainer.style.transform = "translateX(-50%)";

  const talkBtn = document.createElement("div");
  talkBtn.className = "npc-button npc-talk-btn";
  talkBtn.onclick = openCaptainTalk;

  const questsBtn = document.createElement("div");
  questsBtn.className = "npc-button npc-quests-btn";
  questsBtn.onclick = openCaptainQuests;

  captainButtonsContainer.append(talkBtn, questsBtn);
  document.body.appendChild(captainButtonsContainer);
}

function removeCaptainButtons() {
  if (captainButtonsContainer) {
    captainButtonsContainer.remove();
    captainButtonsContainer = null;
  }
}

// ===============================================
// ДИАЛОГИ
// ===============================================
function openCaptainTalk() {
  closeAllCaptainUI();
  isCaptainDialogOpen = true;
  document.body.classList.add("npc-dialog-active");

  const dialog = document.createElement("div");
  dialog.className = "npc-dialog open";
  dialog.id = "captainDialog";
  dialog.dataset.npc = "captain-talk";
  dialog.style.backgroundImage = `url(captain-talk-bg.png)`;
  dialog.style.backgroundSize = "cover";
  dialog.style.backgroundPosition = "center";
  document.getElementById("gameContainer").appendChild(dialog);

  dialog.innerHTML = `
    <div class="npc-dialog-content">
      <div id="captainTalkTopics" class="captain-talk-topics"></div>
    </div>
    <button id="captainCloseTalkBtn" class="neon-btn-thimblerigger"></button>
  `;

  const topicsContainer = document.getElementById("captainTalkTopics");
  const closeBtn = document.getElementById("captainCloseTalkBtn");

  captainTopics.forEach((topic) => {
    const div = document.createElement("div");
    div.className = "captain-talk-topic";
    div.innerHTML = `<strong class="captain-talk-topic-title">${topic.title}</strong>`;

    div.addEventListener("click", () => {
      topicsContainer.classList.add("hidden");

      const npcContent = dialog.querySelector(".npc-dialog-content");
      npcContent.innerHTML = `
        <div class="captain-fullscreen">
          <div class="captain-talk-text-content">${topic.text}</div>
        </div>
      `;
      closeBtn.onclick = () => showCaptainTopics();
    });

    topicsContainer.appendChild(div);
  });

  function showCaptainTopics() {
    const npcContent = dialog.querySelector(".npc-dialog-content");
    npcContent.innerHTML = `<div id="captainTalkTopics" class="captain-talk-topics"></div>`;

    const newTopicsContainer = document.getElementById("captainTalkTopics");
    captainTopics.forEach((topic) => {
      const div = document.createElement("div");
      div.className = "captain-talk-topic";
      div.innerHTML = `<strong class="captain-talk-topic-title">${topic.title}</strong>`;
      div.addEventListener("click", () => {
        newTopicsContainer.classList.add("hidden");
        npcContent.innerHTML = `
          <div class="captain-fullscreen">
            <div class="captain-talk-text-content">${topic.text}</div>
          </div>
        `;
        closeBtn.onclick = () => showCaptainTopics();
      });
      newTopicsContainer.appendChild(div);
    });

    closeBtn.onclick = () => {
      dialog.remove();
      isCaptainDialogOpen = false;
      document.body.classList.remove("npc-dialog-active");
    };
  }

  closeBtn.onclick = () => {
    dialog.remove();
    isCaptainDialogOpen = false;
    document.body.classList.remove("npc-dialog-active");
  };
}

const hasMedicalCertificateInInventory = () =>
  inventory.some((i) => i && i.type === "medical_certificate");
// ===============================================
// ГЛАВНОЕ: ЗАДАНИЯ — ПЕЧАТЬ НА СПРАВКУ (НОВАЯ ЛОГИКА 2025)
// ===============================================
function openCaptainQuests() {
  closeAllCaptainUI();
  isCaptainDialogOpen = true;

  const me = players.get(myId);
  if (!me) return;

  const dialog = document.createElement("div");
  dialog.className = "npc-dialog";
  dialog.id = "captainDialog";
  document.getElementById("gameContainer").appendChild(dialog);

  // Если печать уже стоит
  if (me.medicalCertificateStamped === true) {
    dialog.style.backgroundImage = `url(shevaQuest.png)`;
    dialog.innerHTML = `
      <div class="npc-dialog-header">
      </div>
      <div class="npc-dialog-content">
        <p class="npc-text">
          Печать стоит. Допуск в Неоновый Город у тебя есть.<br><br>
          Пока новых заданий нет.<br>
          Возвращайся позже — может, что-то подвернётся.
        </p>
      </div>
      <button class="neon-btn" id="closeBtn">Закрыть</button>
    `;
    dialog.querySelector("#closeBtn").onclick = () => {
      dialog.remove();
      isCaptainDialogOpen = false;
    };
    return;
  }

  // Если есть справка, но нет печати — предлагаем поставить
  if (me.medicalCertificate === true && hasMedicalCertificateInInventory()) {
    dialog.style.backgroundImage = `url(shevaQuestCertificate.png)`;
    dialog.innerHTML = `
      <div class="npc-dialog-header">
      </div>
      <div class="npc-dialog-content">
      </div>
      <button class="shevaSealBtn" id="stampRequestBtn"></button>
      <button class="shevaCancelBtn" id="closeBtn"></button>
    `;

    dialog.querySelector("#stampRequestBtn").onclick = () => {
      sendWhenReady(ws, JSON.stringify({ type: "requestCaptainStamp" }));
      dialog.remove(); // ← сразу закрываем
      isCaptainDialogOpen = false; // ← без "Ждём..."
    };

    dialog.querySelector("#closeBtn").onclick = () => {
      dialog.remove();
      isCaptainDialogOpen = false;
    };
  } else {
    // Нет справки — просто инфа
    dialog.style.backgroundImage = `url(shevaQuestNoCertificate.png)`;
    dialog.innerHTML = `
      <div class="npc-dialog-header">       
      </div>
      <div class="npc-dialog-content">
      </div>
      <button class="shevaOkBtn" id="closeBtn"></button>
    `;
    dialog.querySelector("#closeBtn").onclick = () => {
      dialog.remove();
      isCaptainDialogOpen = false;
    };
  }
}

function getCaptainRenderData() {
  if (window.worldSystem?.currentWorldId !== 0) {
    return null;
  }

  if (
    !captainSprite?.complete ||
    captainSprite.naturalWidth <= 0 ||
    captainSprite.naturalHeight <= 0
  ) {
    return null;
  }

  return {
    id: "outpostCaptain",
    type: "npc",
    visualType: "billboard",

    // Сохраняем смещение оригинального спрайта:
    // screenY = y - camY - height + 30.
    x: OUTPOST_CAPTAIN.x,
    y: OUTPOST_CAPTAIN.y - OUTPOST_CAPTAIN.height + 30,

    worldId: 0,

    sprite: captainSprite,

    frame: captainFrame,
    row: 0,

    frameCount: OUTPOST_CAPTAIN.totalFrames,

    frameWidth: 70,
    frameHeight: 70,

    displayWidth: 90,
    displayHeight: 90,
  };
}

window.outpostCaptainSystem = {
  initialize: initializeCaptain,
  update: updateCaptain,

  getRenderData: getCaptainRenderData,

  /** Возвращает текущую мировую позицию (для depth-sort) */
  getPosition() {
    return { x: OUTPOST_CAPTAIN.x, y: OUTPOST_CAPTAIN.y };
  },

  /** Чистый draw — вызывается из code.js после сортировки */
  drawSprite(camX, camY) {
    drawCaptainSprite(camX, camY);
  },

  /** Старый draw оставляем для совместимости */
  drawCaptain,

  setCaptainMet: (met) => {
    isCaptainMet = met;
    if (!met) hasCaptainGreetingShown = false;
  },
  isCaptainDialogOpen: () => isCaptainDialogOpen,
  closeAllCaptainUI,
};

(function registerCaptainVisualProvider() {
  "use strict";

  function registerCaptain3D() {
    const scene = window.sceneEntitySystem;
    const captain = window.outpostCaptainSystem;

    if (
      typeof scene?.registerNPCVisualProvider !== "function" ||
      typeof scene?.getRegisteredNPCIds !== "function" ||
      typeof captain?.getRenderData !== "function"
    ) {
      return false;
    }

    const id = "outpostCaptain";

    // Защита от повторной регистрации.
    if (scene.getRegisteredNPCIds().includes(id)) {
      return true;
    }

    scene.registerNPCVisualProvider(id, {
      getRenderData() {
        return captain.getRenderData();
      },
    });

    const registered = scene.getRegisteredNPCIds().includes(id);

    if (registered) {
      console.log("[CaptainSheva3D] Visual provider registered successfully.");
    } else {
      console.error("[CaptainSheva3D] Failed to register visual provider.");
    }

    return registered;
  }

  if (!registerCaptain3D()) {
    window.addEventListener("load", registerCaptain3D, { once: true });
  }
})();
