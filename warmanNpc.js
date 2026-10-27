/**
 * Warman NPC System
 * World 0 only. Display + nameplate + meet + buttons (Talk / Training / Arena stubs)
 * Sprite: 3 rows × 13 frames × 70×70
 *
 * Animation cycle:
 *   phase 0 → row 0 for phaseDurationRow0 (20s)
 *   phase 1 → row 1 exactly 1 full loop
 *   phase 2 → row 2 for phaseDurationRow2 (20s)
 *   phase 3 → row 1 exactly 1 full loop
 *   → repeat
 */
(function () {
  "use strict";

  // ─── Tunable parameters ───────────────────────────────────────────────
  const WARMAN_CONFIG = {
    worldId: 0,
    x: 3263,
    y: 3695,
    interactionRadius: 50,

    // Размер одного кадра в спрайт-листе (не менять)
    frameWidth: 70,
    frameHeight: 70,
    framesPerRow: 13,

    // Размер отображения на игровом поле
    displayWidth: 90,
    displayHeight: 100,

    // Frame duration (ms) for each row
    frameDurationRow0: 180,
    frameDurationRow1: 160,
    frameDurationRow2: 180,

    // Long phase durations (ms)
    phaseDurationRow0: 20_000,
    phaseDurationRow2: 20_000,

    // Сколько полных циклов строки 1 между длинными фазами
    row1LoopsBetween: 1,
  };

  // ─── Internal state ───────────────────────────────────────────────────
  let sprite = null;
  let initialized = false;
  let isMet = false;
  let isNear = false;
  let isDialogOpen = false;
  let dialogElement = null;
  let buttonsContainer = null;

  // Animation state
  let currentRow = 0;
  let currentFrame = 0;
  let frameAccum = 0;
  let phaseAccum = 0;
  let phase = 0; // 0=row0 long, 1=row1 loops, 2=row2 long, 3=row1 loops

  const ROW_DURATIONS = [
    WARMAN_CONFIG.frameDurationRow0,
    WARMAN_CONFIG.frameDurationRow1,
    WARMAN_CONFIG.frameDurationRow2,
  ];

  // ─── Public API ───────────────────────────────────────────────────────
  function initialize(image) {
    if (initialized) return;
    sprite = image || null;
    initialized = true;
    isMet = false;
    isNear = false;
    isDialogOpen = false;
    removeButtons();
    removeDialog();
    resetAnimation();
  }

  function resetAnimation() {
    currentRow = 0;
    currentFrame = 0;
    frameAccum = 0;
    phaseAccum = 0;
    phase = 0;
  }

  function update(deltaTime) {
    if (!initialized || !sprite || !sprite.complete) return;

    const worldId = window.worldSystem?.currentWorldId;
    if (worldId !== WARMAN_CONFIG.worldId) return;

    // Cap delta so animation never catches up after tab restore
    const dt = Math.min(deltaTime, 50);
    frameAccum += dt;

    const frameDur = ROW_DURATIONS[currentRow] || 100;

    while (frameAccum >= frameDur) {
      frameAccum -= frameDur;
      currentFrame = (currentFrame + 1) % WARMAN_CONFIG.framesPerRow;

      if (currentFrame === 0) {
        advancePhaseOnLoopComplete();
      }
    }
  }

  function advancePhaseOnLoopComplete() {
    if (phase === 1 || phase === 3) {
      phaseAccum += 1;
      if (phaseAccum >= WARMAN_CONFIG.row1LoopsBetween) {
        phaseAccum = 0;
        phase = (phase + 1) % 4;
        setRowForPhase();
      }
    }
  }

  function setRowForPhase() {
    switch (phase) {
      case 0:
        currentRow = 0;
        break;
      case 1:
      case 3:
        currentRow = 1;
        break;
      case 2:
        currentRow = 2;
        break;
    }
    currentFrame = 0;
    frameAccum = 0;
  }

  function updateTimeBasedPhases(deltaTime) {
    if (phase !== 0 && phase !== 2) return;

    const dt = Math.min(deltaTime, 50);
    phaseAccum += dt;

    const limit =
      phase === 0
        ? WARMAN_CONFIG.phaseDurationRow0
        : WARMAN_CONFIG.phaseDurationRow2;

    if (phaseAccum >= limit) {
      phaseAccum = 0;
      phase = (phase + 1) % 4;
      setRowForPhase();
    }
  }

  function draw() {
    if (!initialized || !sprite || !sprite.complete) return;

    const worldId = window.worldSystem?.currentWorldId;
    if (worldId !== WARMAN_CONFIG.worldId) return;

    const camera = window.movementSystem?.getCamera?.();
    if (!camera) return;

    const screenX = WARMAN_CONFIG.x - camera.x;
    const screenY = WARMAN_CONFIG.y - camera.y;

    const canvas = document.getElementById("gameCanvas");
    if (!canvas) return;

    const dw = WARMAN_CONFIG.displayWidth;
    const dh = WARMAN_CONFIG.displayHeight;

    // Early cull — offscreen
    if (
      screenX < -dw - 20 ||
      screenX > canvas.width + 20 ||
      screenY < -dh - 20 ||
      screenY > canvas.height + 20
    ) {
      return;
    }

    const sx = currentFrame * WARMAN_CONFIG.frameWidth;
    const sy = currentRow * WARMAN_CONFIG.frameHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      sprite,
      sx,
      sy,
      WARMAN_CONFIG.frameWidth,
      WARMAN_CONFIG.frameHeight,
      screenX,
      screenY,
      dw,
      dh,
    );

    // Nameplate
    const label = isMet ? "Warman" : "?";
    const labelX = screenX + dw * 0.5;
    const labelY = screenY - 12;

    ctx.font = "13px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = isMet ? "#ff0000" : "#ffffff";
    ctx.fillText(label, labelX, labelY);

    // Buttons follow camera
    updateButtonsPosition(camera.x, camera.y);
  }

  function tick(deltaTime) {
    update(deltaTime);
    updateTimeBasedPhases(deltaTime);
  }

  // ─── Dialog helpers ───────────────────────────────────────────────────
  function closeDialog() {
    if (!isDialogOpen) return;
    isDialogOpen = false;
    document.body.classList.remove("npc-dialog-active");
    removeDialog();
  }

  function removeDialog() {
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
    dialogElement.className = "npc-dialog open";
    dialogElement.dataset.npc = "warman-nodoc";
    dialogElement.style.backgroundImage = "url(warmanNoDoc.png)";
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content"></div>
      <button class="neon-btn-ok" id="warman-nodoc-ok"></button>
    `;

    document.body.appendChild(dialogElement);

    const okBtn = document.getElementById("warman-nodoc-ok");
    if (okBtn) okBtn.onclick = () => closeDialog();
  }

  function openGreetingDialog() {
    if (isDialogOpen) return;
    isDialogOpen = true;
    document.body.classList.add("npc-dialog-active");

    dialogElement = document.createElement("div");
    dialogElement.className = "npc-dialog open";
    dialogElement.dataset.npc = "warman-doc";
    dialogElement.style.backgroundImage = "url(warmanDoc.png)";
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content"></div>
      <button class="neon-btn-ok" id="warman-greeting-ok"></button>
    `;

    document.body.appendChild(dialogElement);

    const okBtn = document.getElementById("warman-greeting-ok");
    if (okBtn) {
      okBtn.onclick = () => {
        if (typeof sendWhenReady === "function" && typeof ws !== "undefined") {
          sendWhenReady(ws, JSON.stringify({ type: "meetWarman" }));
        }
        closeDialog();
      };
    }
  }

  // ─── Post-meet dialogs (stubs) ────────────────────────────────────────
  function openTalkDialog() {
    closeDialog();
    isDialogOpen = true;
    document.body.classList.add("npc-dialog-active");

    dialogElement = document.createElement("div");
    dialogElement.className = "npc-dialog open";
    dialogElement.dataset.npc = "warman-talk";
    dialogElement.style.backgroundImage = "url(warmanTalk.png)";
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content"></div>
      <button class="neon-btn-ok" id="warman-talk-close"></button>
    `;

    document.body.appendChild(dialogElement);

    const closeBtn = document.getElementById("warman-talk-close");
    if (closeBtn) closeBtn.onclick = () => closeDialog();
  }

  function openTrainingDialog() {
    closeDialog();
    isDialogOpen = true;
    document.body.classList.add("npc-dialog-active");

    dialogElement = document.createElement("div");
    dialogElement.className = "npc-dialog open";
    dialogElement.dataset.npc = "warman-training";
    dialogElement.style.backgroundImage = "url(warmanTraining.png)";
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
    <div class="npc-dialog-content"></div>
    <button class="neon-btn-ok" id="warman-training-enter"></button>
    <button class="neon-btn-ok" id="warman-training-close"></button>
  `;

    document.body.appendChild(dialogElement);

    const enterBtn = document.getElementById("warman-training-enter");
    if (enterBtn) {
      enterBtn.onclick = () => {
        if (typeof sendWhenReady === "function" && typeof ws !== "undefined") {
          sendWhenReady(ws, JSON.stringify({ type: "enterTrainingArena" }));
        }
        closeDialog();
      };
    }

    const closeBtn = document.getElementById("warman-training-close");
    if (closeBtn) closeBtn.onclick = () => closeDialog();
  }

  function openArenaDialog() {
    closeDialog();
    isDialogOpen = true;
    document.body.classList.add("npc-dialog-active");

    dialogElement = document.createElement("div");
    dialogElement.className = "npc-dialog open warman-arena-dialog";
    dialogElement.dataset.npc = "warman-arena";
    dialogElement.style.backgroundImage = "url(warmanArena.png)";
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
    <div class="npc-dialog-content"></div>
    <button class="neon-btn-ok" id="warman-arena-enter"></button>
    <button class="neon-btn-ok" id="warman-arena-close"></button>
  `;

    document.body.appendChild(dialogElement);

    const enterBtn = document.getElementById("warman-arena-enter");
    if (enterBtn) {
      enterBtn.onclick = () => {
        if (typeof sendWhenReady === "function" && typeof ws !== "undefined") {
          sendWhenReady(ws, JSON.stringify({ type: "enterArena" }));
        }
        closeDialog();
      };
    }

    const closeBtn = document.getElementById("warman-arena-close");
    if (closeBtn) closeBtn.onclick = () => closeDialog();
  }

  // ─── Buttons ──────────────────────────────────────────────────────────
  function createButtons() {
    if (buttonsContainer) return;

    buttonsContainer = document.createElement("div");
    buttonsContainer.className = "warman-buttons-container";

    const configs = [
      { className: "warman-talk-btn", action: openTalkDialog },
      { className: "warman-training-btn", action: openTrainingDialog },
      { className: "warman-arena-btn", action: openArenaDialog },
    ];

    configs.forEach((cfg) => {
      const btn = document.createElement("div");
      btn.className = "warman-button " + cfg.className;
      btn.onclick = (e) => {
        e.stopPropagation();
        cfg.action();
      };
      buttonsContainer.appendChild(btn);
    });

    document.body.appendChild(buttonsContainer);
  }

  function removeButtons() {
    if (buttonsContainer) {
      buttonsContainer.remove();
      buttonsContainer = null;
    }
  }

  function updateButtonsPosition(cameraX, cameraY) {
    if (!buttonsContainer || !isNear) return;
    const zoom = window.movementSystem?.getZoom?.() || 1;
    const screenX = WARMAN_CONFIG.x - cameraX + WARMAN_CONFIG.displayWidth / 2;
    const screenY = WARMAN_CONFIG.y - cameraY - 150;
    buttonsContainer.style.left = `${screenX * zoom}px`;
    buttonsContainer.style.top = `${screenY * zoom}px`;
  }

  // ─── Proximity ────────────────────────────────────────────────────────
  function checkProximity() {
    const me = typeof players !== "undefined" ? players.get(myId) : null;
    const currentWorldId = window.worldSystem?.currentWorldId;

    if (
      !me ||
      me.worldId !== WARMAN_CONFIG.worldId ||
      me.health <= 0 ||
      currentWorldId !== WARMAN_CONFIG.worldId
    ) {
      if (isNear) {
        isNear = false;
        removeButtons();
        closeDialog();
      }
      return;
    }

    const dx = me.x + 35 - (WARMAN_CONFIG.x + WARMAN_CONFIG.displayWidth / 2);
    const dy = me.y + 35 - (WARMAN_CONFIG.y + WARMAN_CONFIG.displayHeight / 2);
    const dist = Math.hypot(dx, dy);
    const nowNear = dist < WARMAN_CONFIG.interactionRadius;

    if (nowNear && !isNear) {
      isNear = true;
      if (isMet) {
        createButtons();
      } else {
        const hasDocuments = me.corporateDocumentsSubmitted === true;
        if (!hasDocuments) {
          openNoDocDialog();
        } else {
          openGreetingDialog();
        }
      }
    } else if (!nowNear && isNear) {
      isNear = false;
      removeButtons();
      closeDialog();
    }
  }

  // ─── Meet state ───────────────────────────────────────────────────────
  function setMet(met) {
    isMet = !!met;
    if (isNear) {
      if (isMet) createButtons();
      else removeButtons();
    }
  }

  // ─── Export ───────────────────────────────────────────────────────────
  function getRenderData() {
    if (!initialized || !sprite || !sprite.complete || !window.worldSystem) {
      return null;
    }

    if (window.worldSystem.currentWorldId !== WARMAN_CONFIG.worldId) {
      return null;
    }

    return {
      id: "warman",
      type: "npc",
      x: WARMAN_CONFIG.x,
      y: WARMAN_CONFIG.y,
      worldId: WARMAN_CONFIG.worldId,
      sprite,
      frame: currentFrame,
      row: currentRow,
      frameCount: WARMAN_CONFIG.framesPerRow,
      frameWidth: WARMAN_CONFIG.frameWidth,
      frameHeight: WARMAN_CONFIG.frameHeight,
      displayWidth: WARMAN_CONFIG.displayWidth,
      displayHeight: WARMAN_CONFIG.displayHeight,
      visualType: "billboard",
    };
  }

  window.warmanNpc = {
    initialize,
    update: tick,

    getPosition() {
      return { x: WARMAN_CONFIG.x, y: WARMAN_CONFIG.y };
    },

    getRenderData,

    drawSprite(camX, camY) {
      if (!initialized || !sprite || !sprite.complete) return;

      const worldId = window.worldSystem?.currentWorldId;
      if (worldId !== WARMAN_CONFIG.worldId) return;

      const screenX = WARMAN_CONFIG.x - camX;
      const screenY = WARMAN_CONFIG.y - camY;

      const canvas = document.getElementById("gameCanvas");
      if (!canvas) return;

      const dw = WARMAN_CONFIG.displayWidth;
      const dh = WARMAN_CONFIG.displayHeight;

      if (
        screenX < -dw - 20 ||
        screenX > canvas.width + 20 ||
        screenY < -dh - 20 ||
        screenY > canvas.height + 20
      ) {
        return;
      }

      const sx = currentFrame * WARMAN_CONFIG.frameWidth;
      const sy = currentRow * WARMAN_CONFIG.frameHeight;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        sprite,
        sx,
        sy,
        WARMAN_CONFIG.frameWidth,
        WARMAN_CONFIG.frameHeight,
        screenX,
        screenY,
        dw,
        dh,
      );

      const label = isMet ? "Warman" : "?";
      const labelX = screenX + dw * 0.5;
      const labelY = screenY - 12;

      ctx.font = "13px Arial";
      ctx.textAlign = "center";
      ctx.fillStyle = isMet ? "#ff0000" : "#ffffff";
      ctx.fillText(label, labelX, labelY);

      updateButtonsPosition(camX, camY);
    },

    draw() {
      const camera = window.movementSystem?.getCamera?.();
      if (!camera) return;
      this.drawSprite(camera.x, camera.y);
    },

    checkProximity,
    setMet,
    setWarmanMet: setMet,
    config: WARMAN_CONFIG,
    resetAnimation,
    getState: () => ({
      isMet,
      isNear,
      currentRow,
      currentFrame,
      phase,
    }),
  };

  if (
    window.sceneEntitySystem &&
    typeof window.sceneEntitySystem.registerNPCVisualProvider === "function"
  ) {
    window.sceneEntitySystem.registerNPCVisualProvider(
      "warman",
      window.warmanNpc,
    );
  }
})();
