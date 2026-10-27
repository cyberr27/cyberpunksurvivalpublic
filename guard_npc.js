// guard_npc.js — оптимизированная продакшен-версия (2026)

const GUARD_NPC = {
  name: "GUARD",
  spriteKey: "guardSprite",
  photoKey: "guardPhoto",
  x: 2854,
  y: 357,

  width: 50,
  height: 90,
  spriteWidth: 70,
  spriteHeight: 70,

  interactionRadius: 50,

  // Анимация
  animationTime: 0,
  currentFrame: 0,

  isPlayerNear: false,
  isDialogOpen: false,

  // Таймеры для патруля анимации (когда далеко)
  animationModeTimer: 0,
  currentMode: 1, // 1 = 2-я строка (60 сек), 2 = 3-я строка (20 сек)
};

// Настраиваемые скорости анимации для каждой строки (мс на кадр)
const GUARD_FRAME_DURATIONS = [200, 200, 250]; // строка 0, 1, 2

const GUARD_FRAMES_PER_ROW = 13;
const MODE1_DURATION = 60000; // 60 секунд — 2-я строка
const MODE2_DURATION = 20000; // 20 секунд — 3-я строка

let guardDialog = null;
let lastAnimationTime = 0; // для стабильной анимации при табу

function closeGuardDialog() {
  if (guardDialog) {
    guardDialog.remove();
    guardDialog = null;
  }
  GUARD_NPC.isDialogOpen = false;
}

function openGuardDialog() {
  closeGuardDialog();

  guardDialog = document.createElement("div");
  guardDialog.className = "guard-dialog open";

  const photoSrc = images[GUARD_NPC.photoKey]
    ? images[GUARD_NPC.photoKey].src
    : "";

  document.body.appendChild(guardDialog);
  GUARD_NPC.isDialogOpen = true;
}

function updateGuardNpc(deltaTime) {
  if (window.worldSystem?.currentWorldId !== 0) return;

  const me = players.get(myId);
  if (!me) return;

  // Проверка близости игрока (оптимизировано)
  const dx = me.x - GUARD_NPC.x;
  const dy = me.y - GUARD_NPC.y;
  const dist = Math.hypot(dx, dy);
  const nowNear = dist < GUARD_NPC.interactionRadius;

  // Переключение состояния при изменении близости
  if (nowNear !== GUARD_NPC.isPlayerNear) {
    GUARD_NPC.isPlayerNear = nowNear;

    if (nowNear) {
      GUARD_NPC.currentMode = 0; // 1-я строка при приближении
      GUARD_NPC.animationTime = 0;
      if (!GUARD_NPC.isDialogOpen) openGuardDialog();
    } else {
      if (GUARD_NPC.isDialogOpen) closeGuardDialog();
      GUARD_NPC.animationModeTimer = 0;
      GUARD_NPC.animationTime = 0;
    }
  }

  const now = performance.now();

  // === Анимация ===
  if (!GUARD_NPC.isPlayerNear) {
    // Игрок далеко — цикл режимов
    GUARD_NPC.animationModeTimer += deltaTime;

    const isMode1 = GUARD_NPC.currentMode === 1;
    const modeDuration = isMode1 ? MODE1_DURATION : MODE2_DURATION;
    const targetRow = isMode1 ? 1 : 2;

    if (GUARD_NPC.animationModeTimer >= modeDuration) {
      GUARD_NPC.currentMode = isMode1 ? 2 : 1;
      GUARD_NPC.animationModeTimer = 0;
      GUARD_NPC.animationTime = 0;
    }

    const frameDuration = GUARD_FRAME_DURATIONS[targetRow];
    GUARD_NPC.animationTime += deltaTime;

    const frameInRow =
      Math.floor(GUARD_NPC.animationTime / frameDuration) %
      GUARD_FRAMES_PER_ROW;
    GUARD_NPC.currentFrame = targetRow * GUARD_FRAMES_PER_ROW + frameInRow;
  } else {
    // Игрок рядом — всегда 1-я строка
    const frameDuration = GUARD_FRAME_DURATIONS[0];
    GUARD_NPC.animationTime += deltaTime;

    const frameInRow =
      Math.floor(GUARD_NPC.animationTime / frameDuration) %
      GUARD_FRAMES_PER_ROW;
    GUARD_NPC.currentFrame = frameInRow; // строка 0
  }
}

function drawGuardNpc() {
  if (window.worldSystem?.currentWorldId !== 0) return;

  const camera = window.movementSystem?.getCamera?.();
  if (!camera) return;

  const screenX = GUARD_NPC.x - camera.x;
  const screenY = GUARD_NPC.y - camera.y - 30;

  // Cull (отсечение невидимых)
  if (
    screenX < -100 ||
    screenX > canvas.width + 100 ||
    screenY < -100 ||
    screenY > canvas.height + 100
  ) {
    return;
  }

  const sprite = images[GUARD_NPC.spriteKey];
  if (sprite?.complete) {
    const row = Math.floor(GUARD_NPC.currentFrame / GUARD_FRAMES_PER_ROW);
    const frameInRow = GUARD_NPC.currentFrame % GUARD_FRAMES_PER_ROW;

    const sourceX = frameInRow * GUARD_NPC.spriteWidth;
    const sourceY = row * GUARD_NPC.spriteHeight;

    ctx.drawImage(
      sprite,
      sourceX,
      sourceY,
      GUARD_NPC.spriteWidth,
      GUARD_NPC.spriteHeight,
      screenX,
      screenY,
      GUARD_NPC.width,
      GUARD_NPC.height,
    );
  } else {
    // Fallback
    ctx.fillStyle = "#26ff00";
    ctx.fillRect(screenX, screenY, GUARD_NPC.width, GUARD_NPC.height);
  }

  // Имя над головой
  ctx.fillStyle = "#66ff00";
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(GUARD_NPC.name, screenX + 22, screenY - 10);
}

function getGuardRenderData() {
  if (window.worldSystem?.currentWorldId !== 0) {
    return null;
  }

  const sprite = images[GUARD_NPC.spriteKey];

  if (
    !sprite?.complete ||
    sprite.naturalWidth <= 0 ||
    sprite.naturalHeight <= 0
  ) {
    return null;
  }

  const row = Math.floor(GUARD_NPC.currentFrame / GUARD_FRAMES_PER_ROW);

  const frame = GUARD_NPC.currentFrame % GUARD_FRAMES_PER_ROW;

  return {
    id: "guard",
    type: "npc",
    visualType: "billboard",

    // Координаты с сохранением оригинального смещения.
    x: GUARD_NPC.x,
    y: GUARD_NPC.y - 30,

    worldId: 0,

    sprite,

    frame,
    row,

    frameCount: GUARD_FRAMES_PER_ROW,

    frameWidth: GUARD_NPC.spriteWidth,
    frameHeight: GUARD_NPC.spriteHeight,

    displayWidth: GUARD_NPC.width,
    displayHeight: GUARD_NPC.height,
  };
}

window.guardNpcSystem = {
  update: updateGuardNpc,

  getRenderData: getGuardRenderData,

  getPosition() {
    return { x: GUARD_NPC.x, y: GUARD_NPC.y };
  },

  drawSprite(camX, camY) {
    if (window.worldSystem?.currentWorldId !== 0) return;

    const screenX = GUARD_NPC.x - camX;
    const screenY = GUARD_NPC.y - camY - 30;

    if (
      screenX < -100 ||
      screenX > canvas.width + 100 ||
      screenY < -100 ||
      screenY > canvas.height + 100
    ) {
      return;
    }

    const sprite = images[GUARD_NPC.spriteKey];
    if (sprite?.complete) {
      const row = Math.floor(GUARD_NPC.currentFrame / GUARD_FRAMES_PER_ROW);
      const frameInRow = GUARD_NPC.currentFrame % GUARD_FRAMES_PER_ROW;

      const sourceX = frameInRow * GUARD_NPC.spriteWidth;
      const sourceY = row * GUARD_NPC.spriteHeight;

      ctx.drawImage(
        sprite,
        sourceX,
        sourceY,
        GUARD_NPC.spriteWidth,
        GUARD_NPC.spriteHeight,
        screenX,
        screenY,
        GUARD_NPC.width,
        GUARD_NPC.height,
      );
    } else {
      ctx.fillStyle = "#26ff00";
      ctx.fillRect(screenX, screenY, GUARD_NPC.width, GUARD_NPC.height);
    }

    ctx.fillStyle = "#66ff00";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(GUARD_NPC.name, screenX + 22, screenY - 10);
  },

  draw: drawGuardNpc,
};

(function registerGuardVisualProvider() {
  "use strict";

  function registerGuard3D() {
    const scene = window.sceneEntitySystem;
    const guard = window.guardNpcSystem;

    if (
      typeof scene?.registerNPCVisualProvider !== "function" ||
      typeof scene?.getRegisteredNPCIds !== "function" ||
      typeof guard?.getRenderData !== "function"
    ) {
      return false;
    }

    const id = "guard";

    // Защита от повторной регистрации.
    if (scene.getRegisteredNPCIds().includes(id)) {
      return true;
    }

    // Регистрируем объект-провайдер.
    scene.registerNPCVisualProvider(id, {
      getRenderData() {
        return guard.getRenderData();
      },
    });

    // Проверяем фактическое наличие ID в реестре.
    const registered = scene.getRegisteredNPCIds().includes(id);

    if (registered) {
      console.log("[Guard3D] Visual provider registered successfully.");
    } else {
      console.error("[Guard3D] Failed to register visual provider.");
    }

    return registered;
  }

  // Первая попытка — сразу после выполнения файла.
  if (!registerGuard3D()) {
    // Повторная попытка после загрузки страницы.
    window.addEventListener("load", registerGuard3D, { once: true });
  }
})();
