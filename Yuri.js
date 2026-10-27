// Yuri.js
// NPC Yuri — отображение + анимация + знакомство (noDoc / greeting)
// Атлас: 2 строки × 13 кадров 70×70
// Цикл: 20с row1 → 3 полных прохода row0 → repeat
// Senior: visibility pause, delta cap, zero alloc in hot path

(function () {
  "use strict";

  // === КОНФИГУРАЦИЯ ===
  const YURI_CONFIG = {
    x: 2560,
    y: 740,
    worldId: 0,
    interactionRadius: 50,

    frameWidth: 70,
    frameHeight: 70,
    framesPerRow: 13,

    displayWidth: 80,
    displayHeight: 90,

    // ms на один кадр — можно менять независимо
    rowSpeeds: {
      0: 120, // первая строка
      1: 120, // вторая строка
    },

    // сколько миллисекунд держать вторую строку
    row1DurationMs: 20_000,

    // сколько полных проходов первой строки после row1
    row0FullCycles: 3,
  };

  // === СОСТОЯНИЕ ===
  let sprite = null;
  let ctx = null;
  let isMet = false;
  let isNear = false;
  let isDialogOpen = false;
  let dialogElement = null;

  let currentRow = 1; // старт со второй строки
  let currentFrame = 0;
  let frameTimer = 0;

  // фаза: "row1" | "row0"
  let phase = "row1";
  let phaseTimer = 0;
  let row0CyclesDone = 0;

  const MAX_DELTA = 50;

  // === ИНИЦИАЛИЗАЦИЯ ===
  function initialize(spriteImage) {
    if (!spriteImage) {
      console.warn("[Yuri] spriteImage is missing");
      return;
    }
    sprite = spriteImage;

    const canvas = document.getElementById("gameCanvas");
    if (canvas) ctx = canvas.getContext("2d");

    currentRow = 1;
    currentFrame = 0;
    frameTimer = 0;
    phase = "row1";
    phaseTimer = 0;
    row0CyclesDone = 0;
    isMet = false;
    isNear = false;
    isDialogOpen = false;
    closeDialog();

    console.log("[Yuri] initialized");
  }

  // === ОБНОВЛЕНИЕ АНИМАЦИИ ===
  function update(deltaTime) {
    if (document.hidden || !sprite || !sprite.complete) return;

    const dt = Math.min(deltaTime || 16.67, MAX_DELTA);
    frameTimer += dt;

    if (phase === "row1") {
      phaseTimer += dt;
      const speed = YURI_CONFIG.rowSpeeds[1] || 120;

      if (frameTimer >= speed) {
        frameTimer -= speed;
        currentFrame++;
        if (currentFrame >= YURI_CONFIG.framesPerRow) {
          currentFrame = 0;
        }
      }

      if (phaseTimer >= YURI_CONFIG.row1DurationMs) {
        phase = "row0";
        currentRow = 0;
        currentFrame = 0;
        frameTimer = 0;
        phaseTimer = 0;
        row0CyclesDone = 0;
      }
    } else {
      const speed = YURI_CONFIG.rowSpeeds[0] || 120;

      if (frameTimer >= speed) {
        frameTimer -= speed;
        currentFrame++;

        if (currentFrame >= YURI_CONFIG.framesPerRow) {
          currentFrame = 0;
          row0CyclesDone++;

          if (row0CyclesDone >= YURI_CONFIG.row0FullCycles) {
            phase = "row1";
            currentRow = 1;
            currentFrame = 0;
            frameTimer = 0;
            phaseTimer = 0;
            row0CyclesDone = 0;
          }
        }
      }
    }

    checkProximity();
  }

  // === ОТРИСОВКА ===
  function drawSprite(camX, camY) {
    if (!sprite || !sprite.complete || !ctx) return;
    if (
      !window.worldSystem ||
      window.worldSystem.currentWorldId !== YURI_CONFIG.worldId
    ) {
      return;
    }

    const screenX = YURI_CONFIG.x - camX;
    const screenY = YURI_CONFIG.y - camY;

    const margin = 120;
    if (
      screenX < -margin ||
      screenX > (window.innerWidth || 1920) + margin ||
      screenY < -margin ||
      screenY > (window.innerHeight || 1080) + margin
    ) {
      return;
    }

    const sx = currentFrame * YURI_CONFIG.frameWidth;
    const sy = currentRow * YURI_CONFIG.frameHeight;

    ctx.drawImage(
      sprite,
      sx,
      sy,
      YURI_CONFIG.frameWidth,
      YURI_CONFIG.frameHeight,
      screenX,
      screenY,
      YURI_CONFIG.displayWidth,
      YURI_CONFIG.displayHeight,
    );

    // Подпись над головой
    const label = isMet ? "Yuri" : "?";
    const labelX = screenX + YURI_CONFIG.displayWidth * 0.5;
    const labelY = screenY - 12;

    ctx.font = "13px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = isMet ? "#66ff00" : "#ffffff";
    ctx.fillText(label, labelX, labelY);
  }

  function draw() {
    const camera = window.movementSystem?.getCamera?.() || { x: 0, y: 0 };
    drawSprite(camera.x, camera.y);
  }

  // === ДИАЛОГИ ===
  function closeDialog() {
    if (!isDialogOpen) return;
    isDialogOpen = false;
    document.body.classList.remove("npc-dialog-active");
    if (dialogElement) {
      dialogElement.remove();
      dialogElement = null;
    }
  }

  function openNoDocDialog() {
    if (isDialogOpen) return;
    isDialogOpen = true;
    document.body.classList.add("npc-dialog-active");

    dialogElement = document.createElement("div");
    dialogElement.className = "npc-dialog open yuri-dialog";
    dialogElement.dataset.npc = "yuri-nodoc";
    dialogElement.style.backgroundImage = `url(yuriNoDoc.png)`;
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content"></div>
      <button class="yuri-ok-btn" id="yuri-nodoc-ok"></button>
    `;

    document.body.appendChild(dialogElement);

    const okBtn = document.getElementById("yuri-nodoc-ok");
    if (okBtn) okBtn.onclick = () => closeDialog();
  }

  function openGreetingDialog() {
    if (isDialogOpen) return;
    isDialogOpen = true;
    document.body.classList.add("npc-dialog-active");

    dialogElement = document.createElement("div");
    dialogElement.className = "npc-dialog open yuri-dialog";
    dialogElement.dataset.npc = "yuri-doc";
    dialogElement.style.backgroundImage = `url(yuriDoc.png)`;
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content"></div>
      <button class="yuri-ok-btn" id="yuri-greeting-ok"></button>
    `;

    document.body.appendChild(dialogElement);

    const okBtn = document.getElementById("yuri-greeting-ok");
    if (okBtn) {
      okBtn.onclick = () => {
        if (typeof sendWhenReady === "function" && ws) {
          sendWhenReady(ws, JSON.stringify({ type: "meetYuri" }));
        }
        closeDialog();
      };
    }
  }

  // === PROXIMITY ===
  function checkProximity() {
    const me = players.get(myId);
    const currentWorldId = window.worldSystem?.currentWorldId;

    if (
      !me ||
      me.worldId !== YURI_CONFIG.worldId ||
      me.health <= 0 ||
      currentWorldId !== YURI_CONFIG.worldId
    ) {
      if (isNear) {
        isNear = false;
        closeDialog();
      }
      return;
    }

    const dx = me.x + 35 - (YURI_CONFIG.x + YURI_CONFIG.displayWidth / 2);
    const dy = me.y + 35 - (YURI_CONFIG.y + YURI_CONFIG.displayHeight / 2);
    const dist = Math.hypot(dx, dy);
    const nowNear = dist < YURI_CONFIG.interactionRadius;

    if (nowNear && !isNear) {
      isNear = true;

      if (!isMet) {
        const hasDocuments = me.corporateDocumentsSubmitted === true;
        if (!hasDocuments) {
          openNoDocDialog();
        } else {
          openGreetingDialog();
        }
      }
      // isMet === true → пока ничего (кнопки позже)
    } else if (!nowNear && isNear) {
      isNear = false;
      closeDialog();
    }
  }

  // === API ===
  function setMet(met) {
    isMet = !!met;
  }

  function getRenderData() {
    if (!sprite || !sprite.complete || !window.worldSystem) {
      return null;
    }

    if (window.worldSystem.currentWorldId !== YURI_CONFIG.worldId) {
      return null;
    }

    return {
      id: "yuri",
      type: "npc",
      x: YURI_CONFIG.x,
      y: YURI_CONFIG.y,
      worldId: YURI_CONFIG.worldId,
      sprite,
      frame: currentFrame,
      row: currentRow,
      frameCount: YURI_CONFIG.framesPerRow,
      frameWidth: YURI_CONFIG.frameWidth,
      frameHeight: YURI_CONFIG.frameHeight,
      displayWidth: YURI_CONFIG.displayWidth,
      displayHeight: YURI_CONFIG.displayHeight,
      visualType: "billboard",
    };
  }

  window.yuriSystem = {
    initialize,
    update,
    draw,

    getPosition() {
      return { x: YURI_CONFIG.x, y: YURI_CONFIG.y };
    },

    getRenderData,

    drawSprite(camX, camY) {
      drawSprite(camX, camY);
    },

    checkProximity,
    setMet,
    setYuriMet: setMet,

    getConfig: () => ({ ...YURI_CONFIG }),
    getState: () => ({
      isMet,
      isNear,
      currentRow,
      currentFrame,
      phase,
      phaseTimer,
      row0CyclesDone,
    }),
  };

  if (
    window.sceneEntitySystem &&
    typeof window.sceneEntitySystem.registerNPCVisualProvider === "function"
  ) {
    window.sceneEntitySystem.registerNPCVisualProvider("yuri", window.yuriSystem);
  }
})();
