// ===============================================
//          КАПИТАН ЗАСТАВЫ — ФИНАЛЬНАЯ ВЕРСИЯ 2025 (ОБНОВЛЕНО ПОД НОВУЮ ЛОГИКУ ПЕЧАТИ)
// ===============================================

const OUTPOST_CAPTAIN = {
  x: 2295,
  y: 1073,
  width: 70,
  height: 70,
  interactionRadius: 50,
  name: "Капитан Райдер",
  spriteSrc: "outpost_captain.png",
  totalFrames: 13,
  frameDuration: 180,
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
    title: "О заставах",
    text: "Мы — последняя линия обороны между Неоновым Городом и Пустошами. Когда-то корпорации держали периметр, но после Отключения всё рухнуло. Теперь мы, выжившие солдаты, держим заставы на своих плечах. Патрулируем, отстреливаем мутантов, помогаем караванам. Каждый день — это война. Но пока мы стоим — город живёт.",
  },
  {
    title: "Пустоши",
    text: "За стенами — ад. Песчаные бури, радиация, мутанты размером с грузовик. Вода там — на вес золота, а баляры не котируются. Люди там либо становятся рейдерами, либо сжираются в пустыне. Говорят, раньше были целые города... теперь только кости и ржавчина.",
  },
  {
    title: "Корпорации",
    text: "Эти ублюдки в башнях думают, что могут купить всё. Даже нас. Предлагали контракт — охранять их грузы за баляры. Отказались. Потому что знаем: сегодня ты охраняешь их склад, а завтра они сбрасывают бомбу на твою заставу.",
  },
  {
    title: "Твой путь",
    text: "Вижу в тебе что-то... не как у других крыс из подвалов. Глаза горят. Слушай сюда, новичок: в этом мире выживает не сильнейший, а тот, кто не сдаётся. Докажи, что достоин войти в Неоновый Город.",
  },
];

// ===============================================
// ИНИЦИАЛИЗАЦИЯ
// ===============================================
function initializeCaptain() {
  captainSprite = new Image();
  captainSprite.src = OUTPOST_CAPTAIN.spriteSrc;
}

// ===============================================
// АНИМАЦИЯ
// ===============================================
function updateCaptain(deltaTime) {
  captainFrameTime += deltaTime;
  while (captainFrameTime >= OUTPOST_CAPTAIN.frameDuration) {
    captainFrameTime -= OUTPOST_CAPTAIN.frameDuration;
    captainFrame = (captainFrame + 1) % OUTPOST_CAPTAIN.totalFrames;
  }
}

// ===============================================
// ЗАКРЫТИЕ ВСЕГО ПРИ ВЫХОДЕ ИЗ ЗОНЫ
// ===============================================
function closeAllCaptainUI() {
  removeCaptainButtons();
  const dialog = document.getElementById("captainDialog");
  if (dialog) dialog.remove();
  isCaptainDialogOpen = false;
}

// ===============================================
// ОТРИСОВКА + ЛОГИКА ВЗАИМОДЕЙСТВИЯ
// ===============================================
function drawCaptain(ctx, cameraX, cameraY) {
  if (window.worldSystem.currentWorldId !== 0) return;

  const screenX = OUTPOST_CAPTAIN.x - cameraX;
  const screenY = OUTPOST_CAPTAIN.y - cameraY - OUTPOST_CAPTAIN.height + 30;

  if (
    screenX < -200 ||
    screenX > canvas.width + 200 ||
    screenY < -200 ||
    screenY > canvas.height + 200
  ) {
    closeAllCaptainUI();
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
      70,
      70,
    );
  } else {
    ctx.fillStyle = "#00ffff";
    ctx.fillRect(screenX, screenY, 70, 70);
    ctx.fillStyle = "#000";
    ctx.font = "12px Courier New";
    ctx.fillText("CAPT", screenX + 20, screenY + 40);
  }

  ctx.font = "16px 'Courier New'";
  ctx.fillStyle = "#00ffff";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 3;
  ctx.textAlign = "center";
  ctx.strokeText(
    isCaptainMet ? OUTPOST_CAPTAIN.name : "?",
    screenX + 35,
    screenY - 10,
  );
  ctx.fillText(
    isCaptainMet ? OUTPOST_CAPTAIN.name : "?",
    screenX + 35,
    screenY - 10,
  );

  const me = players.get(myId);
  if (!me) return;

  const dist = Math.hypot(me.x - OUTPOST_CAPTAIN.x, me.y - OUTPOST_CAPTAIN.y);

  if (dist < OUTPOST_CAPTAIN.interactionRadius) {
    if (!isCaptainMet && !hasCaptainGreetingShown) {
      showCaptainGreeting();
    } else if (isCaptainMet) {
      createCaptainButtons(screenX, screenY);
    }
  } else {
    closeAllCaptainUI();
  }
}

// ===============================================
// ПРИВЕТСТВИЕ
// ===============================================
function showCaptainGreeting() {
  if (isCaptainDialogOpen || hasCaptainGreetingShown) return;

  isCaptainDialogOpen = true;

  const dialog = document.createElement("div");
  dialog.className = "npc-dialog";
  dialog.id = "captainDialog";
  document.getElementById("gameContainer").appendChild(dialog);

  dialog.innerHTML = `
    <div class="npc-dialog-header">
      <img src="outpost_captain_foto.png" alt="Капитан Райдер" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid #ff00ff;">
      <h2 class="npc-title">Капитан Райдер</h2>
    </div>
    <div class="npc-dialog-content">
      <p class="npc-text">
        Назовись, сталкер.<br><br>
        Я — Райдер, капитан заставы «Северный Периметр».<br>
        Держим рубеж от мутантов и рейдеров.<br><br>
        Хочешь попасть в Неоновый Город — принеси медсправку МД-07.<br>
        Поставлю печать. Без неё — ни шагу за стену.
      </p>
    </div>
    <button class="neon-btn" id="captainGreetingOk">Понял</button>
  `;

  dialog.querySelector("#captainGreetingOk").onclick = () => {
    dialog.remove();
    isCaptainDialogOpen = false;
    isCaptainMet = true;
    hasCaptainGreetingShown = true;
    sendWhenReady(
      ws,
      JSON.stringify({ type: "meetCaptain", captainMet: true }),
    );
  };
}

// ===============================================
// КНОПКИ НАД ГОЛОВОЙ
// ===============================================
function createCaptainButtons(screenX, screenY) {
  if (captainButtonsContainer) return;

  captainButtonsContainer = document.createElement("div");
  captainButtonsContainer.className = "npc-buttons-container";
  captainButtonsContainer.style.left = screenX + 35 + "px";
  captainButtonsContainer.style.top = screenY - 100 + "px";
  captainButtonsContainer.style.transform = "translateX(-50%)";

  const talkBtn = document.createElement("div");
  talkBtn.className = "npc-button npc-talk-btn";
  talkBtn.textContent = "Говорить";
  talkBtn.onclick = openCaptainTalk;

  const questsBtn = document.createElement("div");
  questsBtn.className = "npc-button npc-quests-btn";
  questsBtn.textContent = "Задания";
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

  const dialog = document.createElement("div");
  dialog.className = "npc-dialog";
  dialog.id = "captainDialog";
  document.getElementById("gameContainer").appendChild(dialog);

  dialog.innerHTML = `
    <div class="npc-dialog-header">
      <img src="outpost_captain_foto.png" alt="Капитан Райдер" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid #ff00ff;">
      <h2 class="npc-title">Капитан Райдер</h2>
    </div>
    <div class="npc-dialog-content">
      <p class="npc-text">О чём поговорим, сталкер?</p>
      <div id="captainTopics" class="talk-topics"></div>
    </div>
    <button class="neon-btn" id="closeBtn">Закрыть</button>
  `;

  const container = dialog.querySelector("#captainTopics");
  captainTopics.forEach((topic) => {
    const el = document.createElement("div");
    el.className = "talk-topic";
    el.innerHTML = `<strong>${topic.title}</strong>`;
    el.onclick = () => {
      dialog.querySelector(".npc-text").innerHTML = topic.text;
      dialog.querySelector(".npc-text").classList.add("fullscreen");
      container.classList.add("hidden");
      dialog.querySelector("#closeBtn").textContent = "Назад";
      dialog.querySelector("#closeBtn").onclick = () => {
        dialog.querySelector(".npc-text").innerHTML =
          "О чём поговорим, сталкер?";
        dialog.querySelector(".npc-text").classList.remove("fullscreen");
        container.classList.remove("hidden");
        dialog.querySelector("#closeBtn").textContent = "Закрыть";
        dialog.querySelector("#closeBtn").onclick = () => {
          dialog.remove();
          isCaptainDialogOpen = false;
        };
      };
    };
    container.appendChild(el);
  });

  dialog.querySelector("#closeBtn").onclick = () => {
    dialog.remove();
    isCaptainDialogOpen = false;
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
    dialog.innerHTML = `
      <div class="npc-dialog-header">
        <img src="outpost_captain_foto.png" alt="Капитан Райдер" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid #ff00ff;">
        <h2 class="npc-title">Капитан Райдер</h2>
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
    dialog.innerHTML = `
      <div class="npc-dialog-header">
        <img src="outpost_captain_foto.png" alt="Капитан Райдер" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid #ff00ff;">
        <h2 class="npc-title">Капитан Райдер</h2>
      </div>
      <div class="npc-dialog-content">
        <p class="npc-text">
          Вижу у тебя справка МД-07.<br><br>
          Давай поставлю печать заставы.<br>
          Теперь ты официально чист.
        </p>
      </div>
      <button class="neon-btn" id="stampRequestBtn">Поставить печать</button>
      <button class="neon-btn" style="margin-top:8px;" id="closeBtn">Отказаться</button>
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
    dialog.innerHTML = `
      <div class="npc-dialog-header">
        <img src="outpost_captain_foto.png" alt="Капитан Райдер" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid #ff00ff;">
        <h2 class="npc-title">Капитан Райдер</h2>
      </div>
      <div class="npc-dialog-content">
        <p class="npc-text">
          Принеси медсправку МД-07 от робота-доктора.<br><br>
          Только с печатью заставы пропустим в Неоновый Город.
        </p>
      </div>
      <button class="neon-btn" id="closeBtn">Понял</button>
    `;
    dialog.querySelector("#closeBtn").onclick = () => {
      dialog.remove();
      isCaptainDialogOpen = false;
    };
  }
}

// ===============================================
// ЭКСПОРТ
// ===============================================
window.outpostCaptainSystem = {
  initialize: initializeCaptain,
  update: updateCaptain,
  drawCaptain,
  setCaptainMet: (met) => {
    isCaptainMet = met;
    if (!met) hasCaptainGreetingShown = false;
  },
  isCaptainDialogOpen: () => isCaptainDialogOpen,
  closeAllCaptainUI,
};
