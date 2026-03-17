// robot_doctor.js — NeoCorp Medical Robot (production optimized)
// UI и поведение 1:1 corporateRobot.js
// ЛОГИКА НЕ ИЗМЕНЕНА

window.robotDoctorSystem = (() => {
  "use strict";

  /* ================== CONSTANTS ================== */

  const X = 1600;
  const Y = 1717;
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
    talkIndex: 0,
  };

  /* ================== UI CACHE ================== */

  let buttons = null;
  let dialog = null;
  let dialogText = null;

  /* ================== DATA ================== */

  const TALK_TOPICS = [
    "Идентификация завершена. Биологический объект подтверждён.",
    "Медицинские показатели в допустимых пределах.",
    "Корпорация рекомендует поддерживать здоровье выше минимума.",
    "Медицинский протокол активен. Ожидание команды.",
    "Критических отклонений не обнаружено.",
    "NeoCorp заинтересована в сохранности вашего ресурса.",
  ];

  /* ================== UI ================== */

  function createUI() {
    if (buttons) return;

    const body = document.body;

    // --- Buttons ---
    buttons = document.createElement("div");
    buttons.className = "npc-buttons-container";
    buttons.style.display = "none";

    const btnTalk = document.createElement("div");
    btnTalk.className = "npc-button npc-talk-btn";
    btnTalk.textContent = "Говорить";
    btnTalk.onclick = openTalk;

    const btnHeal = document.createElement("div");
    btnHeal.className = "npc-button";
    btnHeal.textContent = "Лечение";
    btnHeal.style.color = "#00FF00";
    btnHeal.style.borderColor = "#00FF00";
    btnHeal.onclick = openHeal;

    const btnQuest = document.createElement("div");
    btnQuest.className = "npc-button npc-quests-btn";
    btnQuest.textContent = "Задания";
    btnQuest.onclick = openQuest;

    buttons.append(btnTalk, btnHeal, btnQuest);
    body.appendChild(buttons);

    // --- Dialog ---
    dialog = document.createElement("div");
    dialog.className = "npc-dialog";
    dialog.style.display = "none";

    const header = document.createElement("div");
    header.className = "npc-dialog-header";

    const img = document.createElement("img");
    img.className = "npc-photo";
    img.src = "robot_doctor_foto.png";

    const title = document.createElement("h2");
    title.className = "npc-title";
    title.textContent = "Медицинский Модуль";

    header.append(img, title);

    const content = document.createElement("div");
    content.className = "npc-dialog-content";

    dialogText = document.createElement("div");
    dialogText.className = "npc-text";
    content.appendChild(dialogText);

    const close = document.createElement("div");
    close.className = "neon-btn";
    close.textContent = "Закрыть";
    close.onclick = closeDialog;

    dialog.append(header, content, close);
    body.appendChild(dialog);
  }

  /* ================== DIALOG ================== */

  function openDialog(html) {
    dialogText.innerHTML = html;
    dialog.style.display = "flex";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }

  function closeDialog() {
    if (!dialog || dialog.style.display === "none") return;
    dialog.style.display = "none";
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  }

  function openTalk() {
    openDialog(TALK_TOPICS[state.talkIndex]);
    state.talkIndex = (state.talkIndex + 1) % TALK_TOPICS.length;
  }

  function openHeal() {
    openDialog(getHealHTML());
  }

  function openQuest() {
    openDialog(getQuestHTML());
  }

  /* ================== CONTENT ================== */

  function getHealHTML() {
    const me = players.get(myId);
    if (!me) return "Ошибка данных";

    const missing = me.maxStats.health - me.health;
    const cost = (missing / 20) | 0;

    let html = "Выберите медицинский протокол:<br><br>";

    if (me.level <= 5 && missing > 0) {
      html += `<div class="neon-btn" onclick="robotDoctorFreeHeal()">Бесплатный осмотр</div><br>`;
    }

    html += `<div class="neon-btn" onclick="robotDoctorHeal20()">+20 HP — 1 баляр</div><br>`;

    html +=
      missing > 0
        ? `<div class="neon-btn" onclick="robotDoctorFullHeal(${cost})">
           Полное восстановление — ${cost}
         </div>`
        : "<br>Здоровье в норме.";

    return html;
  }

  function getQuestHTML() {
    const me = players.get(myId);
    if (me?.medicalCertificate) {
      return "Медицинская справка уже выдана.";
    }

    return `
      Диагностика требуется для допуска к корпоративным зонам.<br><br>
      <div class="neon-btn" onclick="completeDoctorQuest()">Получить справку</div>
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
      buttons.style.left = X - cam.x + "px";
      buttons.style.top = Y - cam.y - 80 + "px";
    }
  }

  /* ================== LOOP ================== */

  function update(dt) {
    if (window.worldSystem.currentWorldId !== 0) return;
    if (!sprite?.complete) return;

    updateProximity();

    frameTimer += dt;
    if (frameTimer >= FRAME_TIME) {
      frameTimer = 0;
      frame = (frame + 1) % FRAMES;
    }
  }

  function draw() {
    if (window.worldSystem.currentWorldId !== 0) return;
    if (!sprite?.complete) return;

    const cam = movementSystem.getCamera();
    ctx.drawImage(
      sprite,
      frame * FRAME,
      0,
      FRAME,
      FRAME,
      X - cam.x,
      Y - cam.y,
      FRAME,
      FRAME,
    );
  }

  /* ================== PUBLIC ================== */

  return {
    initialize(robotSprite) {
      if (initialized) return;
      sprite = robotSprite;
      createUI();
      initialized = true;
    },
    update,
    draw,
  };
})();
