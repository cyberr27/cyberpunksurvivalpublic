window.corporateRobotSystem = (() => {
  "use strict";

  /* ================== CONSTANTS ================== */

  const POINT_A = { x: 2050, y: 3400 };
  const POINT_B = { x: 1208, y: 3864 };

  const PAUSE_TIME = 30000;
  const MOVE_SPEED = 33;
  const INTERACTION_RADIUS_SQ = 2500;
  let greetingDialog = null;

  const FRAME_SIZE = 70;
  const HALF_FRAME = 35;

  /* ================== STATE ================== */

  let sprite = null;
  let initialized = false;
  let lastTime = performance.now();

  const state = {
    dialogueIndex: 0,
    playerInRange: false,
    isMoving: false,
    pauseUntil: 0,
    movingTowardsB: true,
    currentPos: { x: POINT_A.x, y: POINT_A.y },
    targetPos: POINT_B,
    greetingShown: false,
    greetingDialogOpen: false,
  };

  /* ================== UI CACHE ================== */

  const ui = {
    buttonsContainer: null,
    dialogWindow: null,
    dialogContent: null,
    dialogText: null,
    acceptBtn: null,
  };

  /* ================== UI CREATION ================== */

  function createUI() {
    if (ui.buttonsContainer) return;

    const body = document.body;

    // Buttons
    const buttons = document.createElement("div");
    buttons.className = "npc-buttons-container";
    buttons.style.cssText =
      "position:absolute;pointer-events:auto;display:none;z-index:2100;";
    body.appendChild(buttons);

    const talkBtn = document.createElement("div");
    talkBtn.className = "npc-button npc-talk-btn";
    talkBtn.onclick = openTalkDialog;
    buttons.appendChild(talkBtn);

    const questBtn = document.createElement("div");
    questBtn.className = "npc-button npc-quests-btn";
    questBtn.onclick = openQuestDialog;
    buttons.appendChild(questBtn);

    ui.buttonsContainer = buttons;

    // Dialog
    const dialog = document.createElement("div");
    dialog.className = "npc-dialog";
    dialog.style.cssText = "display:none;pointer-events:auto;z-index:2101;";
    body.appendChild(dialog);

    const header = document.createElement("div");
    header.className = "npc-dialog-header";

    const photo = document.createElement("img");

    const title = document.createElement("h2");
    title.className = "npc-title";
    title.textContent = "";

    header.append(photo, title);
    dialog.appendChild(header);

    const content = document.createElement("div");
    content.className = "npc-dialog-content";
    content.style.maxHeight = "calc(80vh - 150px)";
    dialog.appendChild(content);

    const text = document.createElement("div");
    text.className = "npc-text";
    content.appendChild(text);

    const closeBtn = document.createElement("div");
    closeBtn.className = "cr-btn-cancel";
    closeBtn.onclick = closeDialog;
    dialog.appendChild(closeBtn);

    ui.dialogWindow = dialog;
    ui.dialogContent = content;
    ui.dialogText = text;
    ui.closeBtn = closeBtn;
  }

  /* ================== DIALOG CONTROL ================== */

  function openDialog() {
    // Скрываем кнопки TALK/QUEST, пока открыт quest-диалог
    if (ui.buttonsContainer) {
      ui.buttonsContainer.style.display = "none";
    }
    ui.dialogWindow.style.display = "flex";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }

  function closeDialog() {
    ui.dialogWindow.style.display = "none";
    // Сбрасываем фон, чтобы следующий QUEST не тащил старый scanPlayer / stamped и т.д.
    ui.dialogWindow.style.backgroundImage = "";
    if (ui.acceptBtn) ui.acceptBtn.style.display = "none";
    if (ui.closeBtn) ui.closeBtn.style.display = "block";

    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";

    // Возвращаем кнопки только если игрок всё ещё в радиусе и нет talk/greeting
    if (
      state.playerInRange &&
      ui.buttonsContainer &&
      !isTalkDialogOpen &&
      !state.greetingDialogOpen
    ) {
      ui.buttonsContainer.style.display = "flex";
    }
  }

  let isTalkDialogOpen = false;

  function openTalkDialog() {
    if (isTalkDialogOpen) return; // защита от двойного открытия
    isTalkDialogOpen = true;

    // Скрываем кнопки и общий quest-диалог (чтобы не всплывал scanPlayer)
    if (ui.buttonsContainer) {
      ui.buttonsContainer.style.display = "none";
    }
    if (ui.dialogWindow) {
      ui.dialogWindow.style.display = "none";
      ui.dialogWindow.style.backgroundImage = "";
    }

    const dialog = document.createElement("div");
    dialog.className = "npc-dialog open corporate-talk-dialog";
    dialog.style.cssText =
      "display:flex;pointer-events:auto;z-index:2200;background-size:cover;background-position:center;";
    dialog.style.backgroundImage = `url(corporate_robot_talk_bg.png)`;

    dialog.innerHTML = `
      <div class="npc-dialog-content">
        <div id="crTalkTopics" class="cr-talk-topics"></div>
      </div>
      <button id="crCloseTalkBtn" class="cr-btn-cancel"></button>
    `;

    document.body.appendChild(dialog);
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const topicsContainer = document.getElementById("crTalkTopics");
    const closeBtn = document.getElementById("crCloseTalkBtn");

    CORPORATE_DIALOGUES.forEach((dialogue) => {
      const div = document.createElement("div");
      div.className = "cr-talk-topic";
      div.innerHTML = `<strong class="cr-talk-topic-title">${dialogue.title}</strong>`;

      div.addEventListener("click", () => {
        topicsContainer.classList.add("hidden");
        const content = dialog.querySelector(".npc-dialog-content");
        content.innerHTML = `
          <div class="cr-fullscreen">
            ${dialogue.text}
          </div>
        `;
        closeBtn.onclick = () =>
          showCrTopics(dialog, topicsContainer, closeBtn);
      });

      topicsContainer.appendChild(div);
    });

    closeBtn.onclick = closeTalkDialog;
  }

  function showCrTopics(dialog, topicsContainer, closeBtn) {
    topicsContainer.classList.remove("hidden");
    const content = dialog.querySelector(".npc-dialog-content");
    content.innerHTML = `<div id="crTalkTopics" class="cr-talk-topics"></div>`;

    const newContainer = document.getElementById("crTalkTopics");

    CORPORATE_DIALOGUES.forEach((dialogue, index) => {
      const div = document.createElement("div");
      div.className = "cr-talk-topic";
      div.innerHTML = `<strong class="cr-talk-topic-title">${dialogue.title}</strong>`;

      div.addEventListener("click", () => {
        newContainer.classList.add("hidden");
        const newContent = dialog.querySelector(".npc-dialog-content");
        newContent.innerHTML = `
          <div class="cr-fullscreen">
            ${dialogue.text}
          </div>
        `;
        closeBtn.onclick = () => showCrTopics(dialog, newContainer, closeBtn);
      });

      newContainer.appendChild(div);
    });

    closeBtn.onclick = closeTalkDialog;
  }

  function closeTalkDialog() {
    isTalkDialogOpen = false;
    const openDialogs = document.querySelectorAll(
      ".npc-dialog.open, .corporate-talk-dialog",
    );
    openDialogs.forEach((d) => {
      // не трогаем общий ui.dialogWindow (у него нет класса open при нормальной работе)
      if (d !== ui.dialogWindow) d.remove();
    });

    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";

    // Возвращаем кнопки, если игрок всё ещё рядом
    if (
      state.playerInRange &&
      ui.buttonsContainer &&
      !state.greetingDialogOpen
    ) {
      ui.buttonsContainer.style.display = "flex";
    }
  }

  /* ================== INVENTORY CHECKS ================== */

  const hasMedicalCertificate = () =>
    inventory.some(
      (i) =>
        i &&
        (i.type === "medical_certificate" ||
          i.type === "medical_certificate_stamped"),
    );

  const hasStampedCertificate = () =>
    inventory.some((i) => i && i.type === "medical_certificate_stamped");

  /* ================== QUEST DIALOG ================== */

  const CORPORATE_DIALOGUES = [
    {
      title: "Лояльность корпорации",
      text: "NeoCorp — это твоя новая семья. Здесь каждый ставит интересы корпорации выше своих. Абсолютная лояльность — единственный путь к процветанию.",
    },
    {
      title: "Мониторинг и прозрачность",
      text: "Мы следим за каждым твоим шагом ради твоей же безопасности. Полная отчётность о здоровье и продуктивности открывает доступ к бонусам и продвижению.",
    },
    {
      title: "Здоровье и показатели",
      text: "Держи здоровье, энергию, еду и воду на максимуме. Низкие показатели замедляют движение и снижают качество ежедневного провианта от корпорации.",
    },
    {
      title: "Иерархия и послушание",
      text: "Корпорация построена на строгой вертикали власти. Приказы старших — закон. Выполняй задания и поднимайся по лестнице Неонового Города.",
    },
    {
      title: "Улучшение показателей",
      text: "Постоянно стремись к 100% эффективности. Корпорация анализирует твои данные в реальном времени и помогает исправлять слабые места через тренировки и ресурсы.",
    },
    {
      title: "Вклад в общее дело",
      text: "Твой вклад укрепляет NeoCorp в мире мутантов и хаоса. Выполняй корпоративные квесты, делись ресурсами — и получишь доступ к элитным технологиям и зонам.",
    },
  ];

  function openQuestDialog() {
    if (ui.acceptBtn) ui.acceptBtn.style.display = "none";

    const me = players.get(myId);
    const dialog = ui.dialogWindow;

    // Сброс фона
    dialog.style.backgroundImage = "";
    dialog.style.backgroundSize = "cover";
    dialog.style.backgroundPosition = "center";

    // По умолчанию показываем кнопку закрытия
    if (ui.closeBtn) ui.closeBtn.style.display = "block";

    // ================== ЗАВЕРШЁННАЯ РЕГИСТРАЦИЯ ==================
    if (
      me?.medicalCertificate === true &&
      me?.medicalCertificateStamped === true &&
      me?.corporateDocumentsSubmitted === true
    ) {
      dialog.style.backgroundImage = `url(registerEnd.png)`;
      openDialog();
      return;
    }

    // ================== НЕТ СПРАВКИ ==================
    if (!hasMedicalCertificate()) {
      dialog.style.backgroundImage = `url(scanPlayer.png)`;
      openDialog();
      return;
    }

    // ================== ЕСТЬ СПРАВКА, НО НЕТ ПЕЧАТИ ==================
    if (hasMedicalCertificate() && !hasStampedCertificate()) {
      dialog.style.backgroundImage = `url(hasStampedCertificate.png)`;
      openDialog();
      return;
    }

    // ================== ГОТОВ СДАВАТЬ ДОКУМЕНТЫ ==================
    // Только в этом состоянии скрываем кнопку закрытия
    if (ui.closeBtn) ui.closeBtn.style.display = "none";

    dialog.style.backgroundImage = `url(stampedCertificate.png)`;

    ui.dialogText.innerHTML = "";

    if (!ui.acceptBtn) {
      ui.acceptBtn = document.createElement("div");
      ui.acceptBtn.className = "cr-btn-confirm";
      ui.acceptBtn.onclick = submitDocuments;
      ui.dialogWindow.insertBefore(
        ui.acceptBtn,
        ui.dialogWindow.lastElementChild,
      );
    } else {
      ui.acceptBtn.onclick = submitDocuments;
    }
    ui.acceptBtn.style.display = "block";

    openDialog();
  }

  function submitDocuments() {
    if (ws?.readyState === WebSocket.OPEN) {
      sendWhenReady(ws, JSON.stringify({ type: "submitCorporateDocuments" }));
    }
    closeDialog();
  }

  function openCorporateFirstGreeting() {
    if (greetingDialog || state.greetingDialogOpen) return;
    state.greetingDialogOpen = true;

    greetingDialog = document.createElement("div");
    greetingDialog.className = "npc-dialog open";
    greetingDialog.style.pointerEvents = "auto";
    greetingDialog.style.zIndex = "2101";
    greetingDialog.style.backgroundImage = `url(theFirstConversation.png)`;
    greetingDialog.style.backgroundSize = "cover";
    greetingDialog.style.backgroundPosition = "center";

    greetingDialog.innerHTML = `
      <div class="npc-dialog-content" style="height: 320px; display:flex; align-items:center; justify-content:center;">
      </div>
      <button class="cr-btn-ok" id="corporateFirstOkBtn"></button>
    `;

    document.body.appendChild(greetingDialog);

    document.getElementById("corporateFirstOkBtn").onclick = () => {
      closeCorporateFirstGreeting();
      if (state.playerInRange) {
        ui.buttonsContainer.style.display = "flex";
      }

      const me = players.get(myId);
      if (me) {
        me.corporateRobotGreetingShown = true;
      }
      state.greetingShown = true;
      state.greetingDialogOpen = false;

      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "meetCorporateRobot" }));
      }
    };
  }

  function closeCorporateFirstGreeting() {
    if (greetingDialog) {
      greetingDialog.remove();
      greetingDialog = null;
    }
    state.greetingDialogOpen = false;
  }

  /* ================== MOVEMENT ================== */

  function updateMovement(dt, now) {
    if (state.playerInRange || now < state.pauseUntil) {
      state.isMoving = false;
      return;
    }

    state.isMoving = true;

    const dx = state.targetPos.x - state.currentPos.x;
    const dy = state.targetPos.y - state.currentPos.y;
    const distSq = dx * dx + dy * dy;

    const move = MOVE_SPEED * (dt / 1000);

    if (distSq <= move * move) {
      state.currentPos.x = state.targetPos.x;
      state.currentPos.y = state.targetPos.y;
      state.pauseUntil = now + PAUSE_TIME;
      state.movingTowardsB = !state.movingTowardsB;
      state.targetPos = state.movingTowardsB ? POINT_B : POINT_A;
      state.isMoving = false;
      return;
    }

    const invDist = move / Math.sqrt(distSq);
    state.currentPos.x += dx * invDist;
    state.currentPos.y += dy * invDist;
  }

  /* ================== PROXIMITY ================== */

  function checkProximity() {
    createUI();

    if (worldSystem.currentWorldId !== 0) {
      if (state.playerInRange) {
        state.playerInRange = false;
        ui.buttonsContainer.style.display = "none";
        closeCorporateFirstGreeting();
      }
      return;
    }

    const me = players.get(myId);
    if (!me || !myId) return; // Защита от раннего вызова

    const dx = me.x + HALF_FRAME - state.currentPos.x;
    const dy = me.y + HALF_FRAME - state.currentPos.y;
    const inRange = dx * dx + dy * dy <= INTERACTION_RADIUS_SQ;

    if (inRange !== state.playerInRange) {
      state.playerInRange = inRange;

      if (inRange) {
        // Главное изменение: проверяем серверный флаг
        const greetingAlreadyShown = !!me.corporateRobotGreetingShown;

        if (
          !greetingAlreadyShown &&
          !state.greetingShown &&
          !state.greetingDialogOpen
        ) {
          openCorporateFirstGreeting();
        } else {
          ui.buttonsContainer.style.display = "flex";
        }
      } else {
        ui.buttonsContainer.style.display = "none";
        closeDialog();
        closeCorporateFirstGreeting();

        // Закрываем talk-диалог при выходе из зоны
        if (typeof closeTalkDialog === "function") {
          closeTalkDialog();
        }
      }
    }
  }

  function updateButtonsPosition() {
    if (!state.playerInRange) return;

    const cam = movementSystem.getCamera();
    const zoom = movementSystem.getZoom?.() || 1;
    let x = (state.currentPos.x - cam.x) * zoom;
    let y = (state.currentPos.y - cam.y - 80) * zoom;

    const w = ui.buttonsContainer.offsetWidth || 200;
    const h = ui.buttonsContainer.offsetHeight || 50;

    ui.buttonsContainer.style.left =
      Math.max(0, Math.min(x, innerWidth - w)) + "px";
    ui.buttonsContainer.style.top =
      Math.max(0, Math.min(y - 35, innerHeight - h)) + "px";
  }

  /* ================== PUBLIC API ================== */

  function getRenderData() {
    if (
      !initialized ||
      window.worldSystem?.currentWorldId !== 0 ||
      !sprite?.complete ||
      sprite.naturalWidth <= 0 ||
      sprite.naturalHeight <= 0
    ) {
      return null;
    }

    const now = performance.now();

    let frame = 0;
    let row = 0;

    // Та же анимация, что используется в drawSprite().
    if (state.isMoving) {
      frame = 1 + (Math.floor(now / 100) % 12);
      row = state.movingTowardsB ? 0 : 1;
    }

    return {
      id: "corporateRobot",
      type: "npc",
      visualType: "billboard",

      // Текущие координаты робота.
      // В оригинале currentPos — центр спрайта.
      x: state.currentPos.x - HALF_FRAME,
      y: state.currentPos.y - HALF_FRAME,

      worldId: 0,

      sprite,

      frame,
      row,

      frameCount: 13,
      frameWidth: FRAME_SIZE,
      frameHeight: FRAME_SIZE,

      // Оригинальный drawSprite() рисует 80 × 80.
      displayWidth: FRAME_SIZE + 10,
      displayHeight: FRAME_SIZE + 10,
    };
  }

  return {
    initialize(robotSprite) {
      if (initialized) return;
      sprite = robotSprite;
      createUI();
      initialized = true;
      const me = players.get(myId);
      if (me) {
        state.greetingShown = !!me.corporateRobotGreetingShown;
      }
    },

    setGreetingShown(shown) {
      state.greetingShown = !!shown;
      if (state.greetingShown) {
        state.greetingDialogOpen = false;
      }
    },

    update() {
      createUI();
      const now = performance.now();
      const dt = now - lastTime;
      lastTime = now;

      checkProximity();
      updateMovement(dt, now);
      updateButtonsPosition();
    },

    getPosition() {
      return { x: state.currentPos.x, y: state.currentPos.y };
    },

    /** Визуальные данные для общего 3D billboard-рендерера */
    getRenderData,

    /** Чистый draw без проверки worldId — вызывается из code.js после сортировки */
    drawSprite(camX, camY) {
      if (!sprite?.complete) return;

      const sx = state.currentPos.x - camX - HALF_FRAME;
      const sy = state.currentPos.y - camY - HALF_FRAME;

      let frame = 0;
      let row = 0;

      if (state.isMoving) {
        frame = 1 + (((performance.now() / 100) | 0) % 12);
        row = state.movingTowardsB ? 0 : 1;
      }

      ctx.drawImage(
        sprite,
        frame * FRAME_SIZE,
        row * FRAME_SIZE,
        FRAME_SIZE,
        FRAME_SIZE,
        sx,
        sy,
        FRAME_SIZE + 10,
        FRAME_SIZE + 10,
      );

      ctx.font = "12px Courier New";
      ctx.fillStyle = "#fbff00";
      ctx.textAlign = "center";
      ctx.fillText("Corporate Module", sx + HALF_FRAME, sy - 15);
    },

    /** Старый draw оставляем для совместимости (пока не удаляем вызовы) */
    draw() {
      if (worldSystem.currentWorldId !== 0) return;
      const cam = movementSystem.getCamera();
      this.drawSprite(cam.x, cam.y);
    },

    isPlayerInteracting: () =>
      state.playerInRange && ui.dialogWindow.style.display === "flex",
  };
})();

(function registerCorporateRobotVisualProvider() {
  "use strict";

  function registerCorporateRobot3D() {
    const scene = window.sceneEntitySystem;
    const robot = window.corporateRobotSystem;

    if (
      typeof scene?.registerNPCVisualProvider !== "function" ||
      typeof scene?.getRegisteredNPCIds !== "function" ||
      typeof robot?.getRenderData !== "function"
    ) {
      console.error(
        "[CorporateRobot3D] Required visual provider API is unavailable.",
      );
      return false;
    }

    const id = "corporateRobot";

    // Предотвращаем повторную регистрацию.
    if (scene.getRegisteredNPCIds().includes(id)) {
      return true;
    }

    // Контракт реестра Copilot: объект с методом getRenderData().
    const success = scene.registerNPCVisualProvider(id, {
      getRenderData() {
        return robot.getRenderData();
      },
    });

    if (!success) {
      console.error("[CorporateRobot3D] Failed to register visual provider.");
      return false;
    }

    console.log("[CorporateRobot3D] Visual provider registered successfully.");

    return true;
  }

  if (!registerCorporateRobot3D()) {
    window.addEventListener("load", registerCorporateRobot3D, { once: true });
  }
})();
