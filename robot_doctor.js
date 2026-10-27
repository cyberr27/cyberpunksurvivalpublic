// robot_doctor.js — NeoCorp Medical Robot (production optimized)
// UI и поведение 1:1 corporateRobot.js
// ЛОГИКА НЕ ИЗМЕНЕНА

window.robotDoctorSystem = (() => {
  "use strict";

  /* ================== CONSTANTS ================== */

  const X = 1850;
  const Y = 3295;
  const RADIUS_SQ = 2500;

  const FRAME = 70;
  const HALF = 35;
  const FRAMES = 13;
  const FRAME_TIME = 140;

  /* ================== STATE ================== */

  let sprite = null;
  let initialized = false;
  let frame = 0;
  let frameTimer = 0;

  const state = {
    inRange: false,
  };

  /* ================== UI CACHE ================== */

  let buttons = null;
  let dialog = null;
  let dialogText = null;

  /* ================== DATA ================== */

  const TALK_TOPICS = [
    {
      title: "Идентификация",
      text: "Биосигнатура подтверждена. Система NeoCorp Medical зафиксировала ваш статус. Доступ к протоколам лечения и выдаче справок МД-07 открыт.",
    },
    {
      title: "О модуле",
      text: "Я — автономный медицинский модуль NeoCorp. Функции: диагностика, восстановление ресурса, выдача справок. Эмоции отключены. Приоритет — эффективность.",
    },
    {
      title: "Протоколы лечения",
      text: "Доступны три режима: бесплатный осмотр (уровень ≤ 5), частичное восстановление (+20 HP за 1 баляр) и полное восстановление. Стоимость рассчитывается автоматически по недостающему здоровью.",
    },
    {
      title: "Медицинская справка МД-07",
      text: "Справка МД-07 обязательна для допуска в корпоративные зоны и на заставы. После диагностики модуль выдаёт документ один раз. Повторная выдача не требуется.",
    },
    {
      title: "Рекомендации системы",
      text: "Корпорация рекомендует поддерживать здоровье выше критического порога. Регулярные проверки снижают риск полного отказа биологической системы.",
    },
    {
      title: "Статус ресурса",
      text: "Критических отклонений не обнаружено. Медицинский протокол активен. Ожидаю команду. NeoCorp заинтересована в сохранности вашего ресурса.",
    },
  ];

  /* ================== UI ================== */

  function createUI() {
    if (buttons) return;

    const body = document.body;

    // --- Buttons ---
    buttons = document.createElement("div");
    buttons.className = "npc-buttons-container";
    buttons.style.cssText = "display:none;pointer-events:auto;z-index:2100;";

    const btnTalk = document.createElement("div");
    btnTalk.className = "npc-button npc-talk-btn";
    btnTalk.onclick = openTalk;

    const btnHeal = document.createElement("div");
    btnHeal.className = "npc-button rd-button-healt";
    btnHeal.onclick = openHeal;

    const btnQuest = document.createElement("div");
    btnQuest.className = "npc-button npc-quests-btn";
    btnQuest.onclick = openQuest;

    buttons.append(btnTalk, btnHeal, btnQuest);
    body.appendChild(buttons);

    // --- Dialog ---
    dialog = document.createElement("div");
    dialog.className = "npc-dialog";
    dialog.style.cssText = "display:none;pointer-events:auto;z-index:2101;";

    const content = document.createElement("div");
    content.className = "npc-dialog-content";

    dialogText = document.createElement("div");
    dialogText.className = "npc-text";
    content.appendChild(dialogText);

    const close = document.createElement("div");
    close.className = "rd-close-btn";
    close.onclick = closeDialog;

    dialog.append(content, close);
    body.appendChild(dialog);
  }

  /* ================== DIALOG ================== */

  function openDialog(html) {
    ensureDialogStructure();
    dialog.classList.add("open");
    delete dialog.dataset.npc;
    dialogText.innerHTML = html;
    dialog.style.display = "flex";
    document.body.classList.add("npc-dialog-active");
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }

  function closeDialog() {
    if (!dialog) return;
    dialog.style.display = "none";
    dialog.classList.remove("open");
    document.body.classList.remove("npc-dialog-active");
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  }

  function ensureDialogStructure() {
    // Если openTalk ранее уничтожил структуру — восстанавливаем
    if (
      !dialog.querySelector(".npc-dialog-header") ||
      !dialog.querySelector(".npc-text")
    ) {
      dialog.innerHTML = "";
      dialog.className = "npc-dialog";
      delete dialog.dataset.npc;

      const content = document.createElement("div");
      content.className = "npc-dialog-content";

      dialogText = document.createElement("div");
      dialogText.className = "npc-text";
      content.appendChild(dialogText);

      const close = document.createElement("div");
      close.className = "rd-close-btn";
      close.onclick = closeDialog;

      dialog.append(content, close);
    }

    // Сбрасываем talk-метку при любом другом режиме
    if (dialog.dataset.npc === "robot-doctor-talk") {
      delete dialog.dataset.npc;
    }
  }

  function openTalk() {
    // Восстанавливаем исходную структуру диалога, если она была перезаписана
    ensureDialogStructure();

    dialog.classList.add("open");
    dialog.dataset.npc = "robot-doctor-talk";
    dialog.style.display = "flex";
    document.body.classList.add("npc-dialog-active");
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    dialog.style.backgroundImage = `url(robot_doctor_talk.png)`;
    dialog.style.backgroundSize = "cover";
    dialog.style.backgroundPosition = "center";

    // Темы только в content-зоне, кнопка «Закрыть» остаётся
    dialogText.innerHTML = `<div id="rdTalkTopics" class="rd-talk-topics"></div>`;

    // Правильный селектор кнопки закрытия (как у thimblerigger — id/class, а не .neon-btn)
    const closeBtn = dialog.querySelector(".rd-close-btn");

    // Функция показа списка тем (логика 1:1 с showThimbleriggerTopics)
    function showRdTopics() {
      dialogText.innerHTML = `<div id="rdTalkTopics" class="rd-talk-topics"></div>`;
      const newTopicsContainer = document.getElementById("rdTalkTopics");

      TALK_TOPICS.forEach((topic) => {
        const div = document.createElement("div");
        div.className = "rd-talk-topic";
        div.innerHTML = `<strong class="rd-talk-topic-title">${topic.title}</strong>`;

        div.addEventListener("click", () => {
          newTopicsContainer.classList.add("hidden");
          dialogText.innerHTML = `
            <div class="rd-fullscreen">
              <div class="rd-talk-text-content">${topic.text}</div>
            </div>
          `;
          // При открытом тексте темы close возвращает к списку
          if (closeBtn) {
            closeBtn.onclick = () => showRdTopics();
          }
        });

        newTopicsContainer.appendChild(div);
      });

      // При списке тем close полностью закрывает диалог
      if (closeBtn) {
        closeBtn.onclick = closeDialog;
      }
    }

    // Первичное заполнение тем
    const topicsContainer = document.getElementById("rdTalkTopics");
    TALK_TOPICS.forEach((topic) => {
      const div = document.createElement("div");
      div.className = "rd-talk-topic";
      div.innerHTML = `<strong class="rd-talk-topic-title">${topic.title}</strong>`;

      div.addEventListener("click", () => {
        topicsContainer.classList.add("hidden");
        dialogText.innerHTML = `
          <div class="rd-fullscreen">
            <div class="rd-talk-text-content">${topic.text}</div>
          </div>
        `;
        // При открытом тексте темы close возвращает к списку
        if (closeBtn) {
          closeBtn.onclick = () => showRdTopics();
        }
      });

      topicsContainer.appendChild(div);
    });

    // Изначально close закрывает диалог
    if (closeBtn) {
      closeBtn.onclick = closeDialog;
    }
  }

  function openHeal() {
    ensureDialogStructure();
    dialog.style.backgroundImage = `url(robot_doctor_healting.png)`;
    dialog.style.backgroundSize = "cover";
    dialog.style.backgroundPosition = "center";
    openDialog(getHealHTML());
  }

  function openQuest() {
    ensureDialogStructure();
    dialog.style.backgroundImage = `url(robot_doctor_quest.png)`;
    dialog.style.backgroundSize = "cover";
    dialog.style.backgroundPosition = "center";
    openDialog(getQuestHTML());
  }

  /* ================== CONTENT ================== */

  function getHealHTML() {
    const me = players.get(myId);
    if (!me) return "Ошибка данных";

    const missing = me.maxStats.health - me.health;
    const cost = (missing / 20) | 1;

    let html = "";

    if (me.level <= 5 && missing > 0) {
      html += `<div class="rd-free-btn" onclick="robotDoctorFreeHeal()"></div><br>`;
    }

    html += `<div class="rd-20-btn" onclick="robotDoctorHeal20()"></div><br>`;

    html +=
      missing > 0
        ? `<div class="rd-full-btn" onclick="robotDoctorFullHeal(${cost})">
          <span class="rd-full-text">${cost}$</span>
         </div>`
        : '<br><span class="rd-full-text-normal">Здоровье в норме!</span>';

    return html;
  }

  function getQuestHTML() {
    const me = players.get(myId);
    if (me?.medicalCertificate) {
      return "Справка MN-69 выдана.";
    }

    return `
      Диагностика требуется для допуска к корпоративным зонам.<br><br>
      <div class="rd-certificate-btn" onclick="completeDoctorQuest()"></div>
    `;
  }

  /* ================== NETWORK ================== */

  function send(type) {
    if (ws?.readyState === WebSocket.OPEN) {
      sendWhenReady(ws, JSON.stringify({ type }));
    }
    closeDialog();
  }

  window.robotDoctorFreeHeal = () => send("robotDoctorFreeHeal");
  window.robotDoctorHeal20 = () => send("robotDoctorHeal20");
  window.robotDoctorFullHeal = () => send("robotDoctorFullHeal");
  window.completeDoctorQuest = () => send("completeDoctorQuest");

  /* ================== PROXIMITY ================== */

  function updateProximity() {
    const me = players.get(myId);

    if (!me || window.worldSystem.currentWorldId !== 0) {
      if (state.inRange) {
        state.inRange = false;
        buttons.style.display = "none";
        closeDialog();
      }
      return;
    }

    const dx = me.x + HALF - X;
    const dy = me.y + HALF - Y;
    const inRange = dx * dx + dy * dy <= RADIUS_SQ;

    if (inRange !== state.inRange) {
      state.inRange = inRange;
      buttons.style.display = inRange ? "flex" : "none";
      if (!inRange) closeDialog();
    }

    if (inRange) {
      const cam = movementSystem.getCamera();
      const zoom = movementSystem.getZoom?.() || 1;
      buttons.style.left = (X - cam.x + 30) * zoom + "px";
      buttons.style.top = (Y - cam.y - 100) * zoom + "px";
    }
  }

  /* ================== LOOP ================== */

  function update(dt) {
    createUI();
    if (window.worldSystem.currentWorldId !== 0) return;
    if (!sprite?.complete) return;

    updateProximity();

    frameTimer += dt;
    if (frameTimer >= FRAME_TIME) {
      frameTimer = 0;
      frame = (frame + 1) % FRAMES;
    }
  }

  function drawSprite(camX, camY) {
    if (window.worldSystem.currentWorldId !== 0) return;
    if (!sprite?.complete) return;

    ctx.drawImage(
      sprite,
      frame * FRAME,
      0,
      FRAME,
      FRAME,
      X - camX,
      Y - camY,
      FRAME + 10,
      FRAME + 10,
    );

    const screenX = X - camX;
    const screenY = Y - camY;
    ctx.font = "12px Courier New";
    ctx.fillStyle = "#26ff00";
    ctx.textAlign = "center";
    ctx.fillText("Medical Module", screenX + HALF, screenY - 15);
  }

  function draw() {
    const cam = movementSystem.getCamera();
    drawSprite(cam.x, cam.y);
  }

  function getRenderData() {
    if (window.worldSystem?.currentWorldId !== 0) {
      return null;
    }

    if (
      !sprite?.complete ||
      sprite.naturalWidth <= 0 ||
      sprite.naturalHeight <= 0
    ) {
      return null;
    }

    return {
      id: "robotDoctor",
      type: "npc",
      visualType: "billboard",

      // Исходные мировые координаты.
      x: X,
      y: Y,

      worldId: 0,

      // Используем существующий спрайт.
      sprite,

      // Текущий кадр из update(dt).
      frame,
      row: 0,

      frameCount: FRAMES,

      frameWidth: FRAME,
      frameHeight: FRAME,

      // Размеры оригинальной 2D-отрисовки.
      displayWidth: FRAME + 10,
      displayHeight: FRAME + 10,
    };
  }

  return {
    initialize(robotSprite) {
      if (initialized) return;
      sprite = robotSprite;
      createUI();
      initialized = true;
    },

    // Данные для общего WebGL2 billboard-рендерера.
    getRenderData,

    getPosition() {
      return { x: X, y: Y };
    },

    drawSprite(camX, camY) {
      drawSprite(camX, camY);
    },

    update,
    draw,
  };
})();

(function registerRobotDoctorVisualProvider() {
  "use strict";

  function registerRobotDoctor3D() {
    const scene = window.sceneEntitySystem;
    const doctor = window.robotDoctorSystem;

    if (
      typeof scene?.registerNPCVisualProvider !== "function" ||
      typeof scene?.getRegisteredNPCIds !== "function" ||
      typeof doctor?.getRenderData !== "function"
    ) {
      return false;
    }

    const id = "robotDoctor";

    // Защита от повторной регистрации.
    if (scene.getRegisteredNPCIds().includes(id)) {
      return true;
    }

    // Реестр принимает объект с методом getRenderData().
    scene.registerNPCVisualProvider(id, {
      getRenderData() {
        return doctor.getRenderData();
      },
    });

    // Проверяем фактическую регистрацию.
    const registered = scene.getRegisteredNPCIds().includes(id);

    if (registered) {
      console.log("[RobotDoctor3D] Visual provider registered successfully.");
    } else {
      console.error("[RobotDoctor3D] Failed to register visual provider.");
    }

    return registered;
  }

  // Первая попытка сразу после загрузки скрипта.
  if (!registerRobotDoctor3D()) {
    // Повторная попытка, если sceneEntitySystem
    // ещё не был доступен.
    window.addEventListener("load", registerRobotDoctor3D, { once: true });
  }
})();
