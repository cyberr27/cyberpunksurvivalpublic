const HOMELESS = {
  x: 1510,
  y: 3430,
  interactionRadius: 50,
  name: "Homeless",
  worldId: 0,
};

let homelessSprite = null;
let isNearHomeless = false;
let isDialogOpenHomeless = false;
let isStorageOpenHomeless = false;

let buttonsContainerHomeless = null;
let dialogElementHomeless = null;
let storageDialogHomeless = null;

let currentStorageItems = [];
let currentRentUntil = null;
let openStorageAfterRent = false;
let selectedPlayerSlotHomeless = null;
let selectedStorageSlotHomeless = null;

// === ЛОГИКА ЗНАКОМСТВА ===
let isHomelessMet = false;
let homelessHasGreetingBeenShownThisSession = false;
let homelessGreetingDialog = null;

// ─── АНИМАЦИЯ (оригинальная, без изменений) ─────────────────────────────────
const FRAME_COUNT = 13;
const FRAME_W = 70;
const FRAME_H = 70;
const LONG_ROW_DURATION = 10000;
const SHORT_ROW_DURATION = 2000;

let animationTime = 0;
let currentRow = 0;
let frameHomeless = 0;
let transitionProgress = 1;
const TRANSITION_DURATION = 400;

function updateHomelessAnimation(deltaTime) {
  if (!homelessSprite) return;

  if (transitionProgress > 0.01 && !isNearHomeless) {
    animationTime += deltaTime;
  }

  if (isNearHomeless) {
    if (transitionProgress > 0) {
      transitionProgress = Math.max(
        0,
        transitionProgress - deltaTime / TRANSITION_DURATION,
      );
    }
  } else {
    if (transitionProgress < 1) {
      transitionProgress = Math.min(
        1,
        transitionProgress + deltaTime / TRANSITION_DURATION,
      );
    }
  }

  if (transitionProgress < 0.02) {
    frameHomeless = 0;
    currentRow = 0;
    return;
  }

  const elapsed = animationTime;

  if (currentRow === 0) {
    const progress = (elapsed % LONG_ROW_DURATION) / LONG_ROW_DURATION;
    frameHomeless = Math.floor(progress * FRAME_COUNT) % FRAME_COUNT;

    if (elapsed >= LONG_ROW_DURATION && !isNearHomeless) {
      currentRow = 1;
      animationTime = 0;
      frameHomeless = 0;
    }
  } else {
    const progress = elapsed / SHORT_ROW_DURATION;
    frameHomeless = Math.floor(progress * FRAME_COUNT);

    if (frameHomeless >= FRAME_COUNT) {
      currentRow = 0;
      animationTime = 0;
      frameHomeless = 0;
    }
  }
}

function drawHomelessSprite(camX, camY) {
  if (!homelessSprite?.complete) return;
  if (window.worldSystem?.currentWorldId !== HOMELESS.worldId) return;

  const screenX = HOMELESS.x - camX;
  const screenY = HOMELESS.y - camY;

  if (
    screenX < -100 ||
    screenX > canvas.width + 100 ||
    screenY < -100 ||
    screenY > canvas.height + 100
  )
    return;

  let drawFrame = frameHomeless;
  let drawRow = currentRow * FRAME_H;

  if (transitionProgress < 0.98) {
    drawFrame = Math.round(transitionProgress * (FRAME_COUNT - 1));
    drawRow = 0;
  }

  ctx.drawImage(
    homelessSprite,
    drawFrame * FRAME_W,
    drawRow,
    FRAME_W,
    FRAME_H,
    screenX - 35,
    screenY - 35,
    FRAME_W + 5,
    FRAME_H + 5,
  );

  ctx.fillStyle = isHomelessMet ? "rgb(255, 85, 0)" : "#ffffff";
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(isHomelessMet ? HOMELESS.name : "?", screenX + 0, screenY - 40);
}

function drawHomeless() {
  const cam = movementSystem.getCamera();
  drawHomelessSprite(cam.x, cam.y);
}

// ====================== ЛОГИКА ЗНАКОМСТВА ======================

function openHomelessGreeting() {
  if (isDialogOpenHomeless) return;
  isDialogOpenHomeless = true;
  document.body.classList.add("npc-dialog-active");

  const isDoc = window.getCorporateDocumentsStatus?.() || false;

  homelessGreetingDialog = document.createElement("div");
  homelessGreetingDialog.className = "npc-dialog open";
  homelessGreetingDialog.style.backgroundImage = `url(${isDoc ? "homeless-doc.png" : "homeless-no-doc.png"})`;
  homelessGreetingDialog.style.backgroundSize = "cover";
  homelessGreetingDialog.style.backgroundPosition = "center";

  homelessGreetingDialog.innerHTML = `
    <div class="npc-dialog-content"></div>
    <button class="neon-btn-thimblerigger-ok" id="homelessGreetingOkBtn"></button>
  `;

  document.body.appendChild(homelessGreetingDialog);

  document.getElementById("homelessGreetingOkBtn").onclick = () => {
    if (isDoc) {
      window.homelessSystem.meetAndCloseGreeting();
    } else {
      closeHomelessGreeting();
    }
  };
}

function closeHomelessGreeting() {
  if (homelessGreetingDialog) {
    homelessGreetingDialog.remove();
    homelessGreetingDialog = null;
  }
  isDialogOpenHomeless = false;
  document.body.classList.remove("npc-dialog-active");

  if (!isHomelessMet) homelessHasGreetingBeenShownThisSession = false;
}

const meetAndCloseGreeting = () => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "meetHomeless" }));
  }
  closeHomelessGreeting();
  window.homelessSystem.setHomelessMet(true);
};

// ====================== ОСНОВНЫЕ ФУНКЦИИ ======================

function showHomelessButtons() {
  if (buttonsContainerHomeless) return;

  buttonsContainerHomeless = document.createElement("div");
  buttonsContainerHomeless.className = "homeless-buttons-container";

  const btns = [
    { cls: "homeless-talk-btn", action: "talk" },
    { cls: "homeless-quests-btn", action: "quests" },
    { cls: "homeless-storage-btn", action: "storage" },
  ];

  btns.forEach((b) => {
    const btn = document.createElement("button");
    btn.className = `homeless-button ${b.cls}`;
    btn.dataset.action = b.action;
    btn.addEventListener("click", () => openHomelessDialog(b.action));
    buttonsContainerHomeless.appendChild(btn);
  });

  document.body.appendChild(buttonsContainerHomeless);
}

function removeButtons() {
  if (buttonsContainerHomeless) {
    buttonsContainerHomeless.remove();
    buttonsContainerHomeless = null;
  }
}

function closeHomelessDialog() {
  if (dialogElementHomeless) {
    dialogElementHomeless.remove();
    dialogElementHomeless = null;
  }
  if (storageDialogHomeless) {
    storageDialogHomeless.remove();
    storageDialogHomeless = null;
    isStorageOpenHomeless = false;
  }
  if (homelessGreetingDialog) {
    homelessGreetingDialog.remove();
    homelessGreetingDialog = null;
  }
  isDialogOpenHomeless = false;
  document.body.classList.remove(
    "npc-dialog-active",
    "homeless-storage-active",
  );
  selectedPlayerSlotHomeless = null;
  selectedStorageSlotHomeless = null;
}

function openHomelessDialog(section) {
  closeHomelessDialog();
  isDialogOpenHomeless = true;
  document.body.classList.add("npc-dialog-active");

  if (section === "storage") {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "homelessOpenStorage" }));
    }
    return;
  }

  if (section === "talk") {
    openHomelessTalk();
    return;
  }

  // === Квесты: пока активных нет → показываем диалог «нет квестов» ===
  if (section === "quests") {
    dialogElementHomeless = document.createElement("div");
    dialogElementHomeless.className = "homeless-main-dialog open";
    dialogElementHomeless.style.backgroundImage = `url(homeless-no-quest.png)`;
    dialogElementHomeless.style.backgroundSize = "cover";
    dialogElementHomeless.style.backgroundPosition = "center";
    dialogElementHomeless.style.border = "none"; // чтобы фон был чистым

    dialogElementHomeless.innerHTML = `
      <button class="homeless-close-btn" id="homelessNoQuestCloseBtn"></button>
    `;

    document.body.appendChild(dialogElementHomeless);

    // Надёжная привязка по ID (как у storage и остальных)
    const closeBtn = document.getElementById("homelessNoQuestCloseBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeHomelessDialog);
    }
    return;
  }
}

function openHomelessTalk() {
  if (isDialogOpenHomeless && dialogElementHomeless) return; // защита

  isDialogOpenHomeless = true;
  document.body.classList.add("npc-dialog-active");

  dialogElementHomeless = document.createElement("div");
  dialogElementHomeless.className = "npc-dialog open";
  dialogElementHomeless.style.backgroundImage = `url(homeless-talk-bg.png)`; // если есть фон, иначе можно убрать
  dialogElementHomeless.style.backgroundSize = "cover";
  dialogElementHomeless.style.backgroundPosition = "center";
  dialogElementHomeless.dataset.npc = "homeless-talk";

  dialogElementHomeless.innerHTML = `
    <div class="npc-dialog-content">
      <div id="homelessTalkTopics" class="homeless-talk-topics"></div>
    </div>
    <button id="homelessCloseTalkBtn" class="neon-btn-thimblerigger"></button>
  `;

  document.body.appendChild(dialogElementHomeless);

  const topicsContainer = document.getElementById("homelessTalkTopics");
  const closeBtn = document.getElementById("homelessCloseTalkBtn");

  const topics = [
    {
      title: "О себе",
      text: "Я просто Homeless. Когда-то у меня был дом, работа и имя. Теперь у меня есть угол у трубы и этот склад. В Неоновом городе имена стираются быстрее, чем неон гаснет.",
    },
    {
      title: "О Неоновом городе",
      text: "Город красивый сверху и гнилой снизу. Корпорации строят башни, а мы, те, кто внизу, строим жизнь из обрывков. Здесь каждый сам себе и бог, и крыса.",
    },
    {
      title: "Про склад",
      text: "Мой склад — единственное, что ещё принадлежит мне. Арендуй его, клади вещи — я не полезу. Но если срок выйдет, всё исчезнет. Таковы правила улицы.",
    },
    {
      title: "Советы по выживанию",
      text: "Не высовывайся. Не показывай, сколько у тебя баляров. Не доверяй тем, кто слишком улыбается. И всегда имей запас еды и воды. Голод здесь убивает быстрее пуль.",
    },
    {
      title: "Уличные истории",
      text: "Один парень оставил у меня целый ящик кристаллов на неделю. Вернулся — ящик был на месте. Другой оставил оружие и не вернулся вообще. Город забирает своих.",
    },
    {
      title: "Надежда и будущее",
      text: "Иногда мне кажется, что когда-нибудь неон погаснет и мы снова увидим настоящие звёзды. Пока же я просто сижу здесь и жду, когда кто-то снова подойдёт.",
    },
  ];

  topics.forEach((topic) => {
    const div = document.createElement("div");
    div.className = "homeless-talk-topic";
    div.innerHTML = `<strong class="homeless-talk-topic-title">${topic.title}</strong>`;

    div.addEventListener("click", () => {
      topicsContainer.classList.add("hidden");

      const npcContent = dialogElementHomeless.querySelector(
        ".npc-dialog-content",
      );
      npcContent.innerHTML = `
        <div class="homeless-fullscreen">
          <div class="homeless-talk-text-content">${topic.text}</div>
        </div>
      `;
      closeBtn.onclick = () => showHomelessTopics();
    });

    topicsContainer.appendChild(div);
  });

  function showHomelessTopics() {
    topicsContainer.classList.remove("hidden");
    const npcContent = dialogElementHomeless.querySelector(
      ".npc-dialog-content",
    );

    npcContent.innerHTML = `<div id="homelessTalkTopics" class="homeless-talk-topics"></div>`;

    const newTopicsContainer = document.getElementById("homelessTalkTopics");
    topics.forEach((topic) => {
      const div = document.createElement("div");
      div.className = "homeless-talk-topic";
      div.innerHTML = `<strong class="homeless-talk-topic-title">${topic.title}</strong>`;
      div.addEventListener("click", () => {
        newTopicsContainer.classList.add("hidden");
        npcContent.innerHTML = `
          <div class="homeless-fullscreen">
            <div class="homeless-talk-text-content">${topic.text}</div>
          </div>
        `;
        closeBtn.onclick = () => showHomelessTopics();
      });
      newTopicsContainer.appendChild(div);
    });

    closeBtn.onclick = closeHomelessDialog;
  }

  closeBtn.onclick = closeHomelessDialog;
}

// ─── Обработка сообщений от сервера ────────────────────────────────────────────────

function handleHomelessServerMessage(data) {
  if (data.type === "homelessMet") {
    // уже обработано в setHomelessMet
    return;
  }
  if (data.type === "homelessStorageStatus") {
    currentRentUntil = data.rentUntil || null;
    if (!data.rented) {
      showHomelessRentDialog();
    } else {
      if (openStorageAfterRent) {
        currentStorageItems = data.storageItems || Array(20).fill(null);
        showHomelessStorageInterface(data.storageItems);
        openStorageAfterRent = false;
      } else {
        showHomelessRentDialog();
      }
    }
  } else if (data.type === "homelessRentSuccess") {
    currentRentUntil = data.rentUntil; // обновляем дату после продления
    showNotification(
      `Склад арендован до ${new Date(data.rentUntil).toLocaleString()}`,
      "#00ff88",
    );

    // После успешной оплаты НЕ открываем сразу сумку — остаёмся в окне аренды
    // Пользователь сам нажмёт "Сумка", если захочет
    showHomelessRentDialog();
  } else if (data.type === "homelessStorageUpdate") {
    currentStorageItems = data.storageItems || Array(20).fill(null);
    if (storageDialogHomeless) {
      updateHomelessStorageUI(data.inventory, data.storageItems);
    }
  } else if (data.type === "homelessError") {
    showNotification(data.message, "#ff4444");
  }
}

// ─── Диалог аренды ────────────────────────────────────────────────

function showHomelessRentDialog() {
  closeHomelessDialog();

  dialogElementHomeless = document.createElement("div");
  dialogElementHomeless.className =
    "homeless-main-dialog open homeless-rent-dialog";

  let rentInfoHtml = "";
  if (currentRentUntil && currentRentUntil > Date.now()) {
    const rentDate = new Date(currentRentUntil).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    rentInfoHtml = `<p class="homeless-text-rent-info">${rentDate}</p>`;
  } else {
    rentInfoHtml = `<p class="homeless-text-rent-info">Rent has not been paid.</p>`;
  }

  dialogElementHomeless.innerHTML = `
      ${rentInfoHtml}
      <input type="number" id="homelessRentDays" min="1" value="1" class="homeless-rent-input">
      
        <button class="homeless-rent-ok"></button>
        ${
          currentRentUntil && currentRentUntil > Date.now()
            ? '<button class="homeless-rent-bag"></button>'
            : ""
        }
        <button class="homeless-close-btn"></button>
  `;

  document.body.appendChild(dialogElementHomeless);

  // Обработчики кнопок
  dialogElementHomeless
    .querySelector(".homeless-close-btn")
    .addEventListener("click", closeHomelessDialog);

  dialogElementHomeless
    .querySelector(".homeless-rent-ok")
    .addEventListener("click", () => {
      const days = parseInt(document.getElementById("homelessRentDays").value);
      if (days >= 1) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: "homelessRentConfirm",
              days,
            }),
          );
        }
      } else {
        showNotification("Введите корректное количество дней", "#ff4444");
      }
    });

  // Если аренда оплачена — добавляем обработчик на кнопку "Сумка"
  const bagBtn = dialogElementHomeless.querySelector(".homeless-rent-bag");
  if (bagBtn) {
    bagBtn.addEventListener("click", () => {
      openStorageAfterRent = true;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "homelessOpenStorage" }));
      }
    });
  }
}

// ─── Интерфейс хранилища ────────────────────────────────────────────────

function showHomelessStorageInterface(storageItems) {
  currentStorageItems = storageItems || Array(20).fill(null);
  closeHomelessDialog();

  isStorageOpenHomeless = true;
  document.body.classList.add("homeless-storage-active");

  storageDialogHomeless = document.createElement("div");
  storageDialogHomeless.className = "homeless-storage-dialog open";

  storageDialogHomeless.innerHTML = `
    <div class="homeless-storage-header">
      <button id="homeless-close-btn-bag" class="homeless-close-btn"></button>
    </div>
    <div class="homeless-storage-content">
      <div class="homeless-player-inventory">
        <div class="homeless-grid" id="homelessPlayerGrid"></div>
      </div>
      <div class="homeless-storage-buttons">
        <button id="homelessPutBtn" disabled></button>
        <button id="homelessTakeBtn" disabled></button>
      </div>
      <div class="homeless-stack-form" id="homelessStackForm" style="display: none;">
        <div class="homeless-cyber-text" id="homelessStackText">Количество:</div>
        <input type="number" id="homelessStackInput" class="homeless-cyber-input" min="1" value="1">
        <div class="homeless-error-text" id="homelessStackError"></div>
      </div>
      <div class="homeless-storage-inventory">
        <div class="homeless-grid" id="homelessStorageGrid"></div>
      </div>
    </div>
  `;

  document.body.appendChild(storageDialogHomeless);

  // Надёжная привязка по уникальному ID (как у Put/Take)
  const closeBtnBag = document.getElementById("homeless-close-btn-bag");
  if (closeBtnBag) {
    closeBtnBag.addEventListener("click", closeHomelessDialog);
  }

  updateHomelessStorageUI(window.inventory, currentStorageItems);

  document
    .getElementById("homelessPutBtn")
    .addEventListener("click", putSelectedItem);
  document
    .getElementById("homelessTakeBtn")
    .addEventListener("click", takeSelectedItem);
}

function updateHomelessStorageUI(playerInv, storageInv) {
  const playerGrid = document.getElementById("homelessPlayerGrid");
  const storageGrid = document.getElementById("homelessStorageGrid");

  if (!playerGrid || !storageGrid) return;

  playerGrid.innerHTML = "";
  storageGrid.innerHTML = "";

  playerInv.forEach((item, i) => {
    const slot = document.createElement("div");
    slot.className = "homeless-slot";
    slot.dataset.index = i;

    if (item) {
      const img = document.createElement("img");
      img.src = ITEM_CONFIG[item.type]?.image?.src || "";
      slot.appendChild(img);

      if (item.quantity > 1) {
        const q = document.createElement("div");
        q.className = "homeless-quantity";
        q.textContent = item.quantity;
        slot.appendChild(q);
      }
    }

    slot.addEventListener("click", () => {
      selectedPlayerSlotHomeless = i;
      selectedStorageSlotHomeless = null;
      updateHomelessSelection();
    });

    playerGrid.appendChild(slot);
  });

  storageInv.forEach((item, i) => {
    const slot = document.createElement("div");
    slot.className = "homeless-slot";
    slot.dataset.index = i;

    if (item) {
      const img = document.createElement("img");
      img.src = ITEM_CONFIG[item.type]?.image?.src || "";
      slot.appendChild(img);

      if (item.quantity > 1) {
        const q = document.createElement("div");
        q.className = "homeless-quantity";
        q.textContent = item.quantity;
        slot.appendChild(q);
      }
    }

    slot.addEventListener("click", () => {
      selectedStorageSlotHomeless = i;
      selectedPlayerSlotHomeless = null;
      updateHomelessSelection();
    });

    storageGrid.appendChild(slot);
  });

  updateHomelessSelection();
}

function updateHomelessSelection() {
  document
    .querySelectorAll(".homeless-slot")
    .forEach((el) => el.classList.remove("selected"));

  const putBtn = document.getElementById("homelessPutBtn");
  const takeBtn = document.getElementById("homelessTakeBtn");
  const stackForm = document.getElementById("homelessStackForm");
  const stackInput = document.getElementById("homelessStackInput");
  const stackText = document.getElementById("homelessStackText");
  const stackError = document.getElementById("homelessStackError");

  // По умолчанию скрываем форму количества
  if (stackForm) stackForm.style.display = "none";
  if (stackError) stackError.textContent = "";

  if (putBtn) putBtn.disabled = true;
  if (takeBtn) takeBtn.disabled = true;

  // Выбран слот игрока (кладём на склад)
  if (selectedPlayerSlotHomeless !== null) {
    const el = document.querySelector(
      `#homelessPlayerGrid .homeless-slot[data-index="${selectedPlayerSlotHomeless}"]`,
    );
    if (el) el.classList.add("selected");

    const item = window.inventory[selectedPlayerSlotHomeless];
    if (putBtn) {
      putBtn.disabled = !item;
    }

    // Если предмет стекаемый — показываем поле количества
    if (item && ITEM_CONFIG[item.type]?.stackable && item.quantity > 1) {
      if (stackForm && stackInput) {
        stackForm.style.display = "flex";
        stackText.textContent = "";
        stackInput.max = item.quantity;
        stackInput.value = item.quantity; // по умолчанию весь стек
      }
    }
  }

  // Выбран слот хранилища (забираем)
  else if (selectedStorageSlotHomeless !== null) {
    const el = document.querySelector(
      `#homelessStorageGrid .homeless-slot[data-index="${selectedStorageSlotHomeless}"]`,
    );
    if (el) el.classList.add("selected");

    const item = currentStorageItems[selectedStorageSlotHomeless];
    if (takeBtn && item) {
      takeBtn.disabled = false;
    }

    // Если предмет стекаемый — показываем поле количества
    if (item && ITEM_CONFIG[item.type]?.stackable && item.quantity > 1) {
      if (stackForm && stackInput) {
        stackForm.style.display = "flex";
        stackText.textContent = "";
        stackInput.max = item.quantity;
        stackInput.value = item.quantity; // по умолчанию весь стек
      }
    }
  }
}

function putSelectedItem() {
  if (selectedPlayerSlotHomeless === null) return;

  const item = window.inventory[selectedPlayerSlotHomeless];
  if (!item) return;

  let quantity = 1;

  // Если стекаемый и форма видна — берём количество из поля
  const stackInput = document.getElementById("homelessStackInput");
  if (
    ITEM_CONFIG[item.type]?.stackable &&
    stackInput &&
    stackInput.parentElement.style.display !== "none"
  ) {
    quantity = parseInt(stackInput.value) || 1;
    if (quantity < 1 || quantity > item.quantity) {
      document.getElementById("homelessStackError").textContent =
        "Неверное количество";
      return;
    }
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "homelessPutItem",
        playerSlot: selectedPlayerSlotHomeless,
        quantity: quantity,
        // storageSlot НЕ отправляем больше!
      }),
    );
  }

  selectedPlayerSlotHomeless = null;
  updateHomelessSelection();
}

function takeSelectedItem() {
  if (selectedStorageSlotHomeless === null) return;

  const item = currentStorageItems[selectedStorageSlotHomeless];
  if (!item) return;

  let quantity = 1;

  // Если стекаемый и форма видна — берём количество из поля
  const stackInput = document.getElementById("homelessStackInput");
  if (
    ITEM_CONFIG[item.type]?.stackable &&
    stackInput &&
    stackInput.parentElement.style.display !== "none"
  ) {
    quantity = parseInt(stackInput.value) || 1;
    if (quantity < 1 || quantity > item.quantity) {
      document.getElementById("homelessStackError").textContent =
        "Неверное количество";
      return;
    }
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "homelessTakeItem",
        storageSlot: selectedStorageSlotHomeless,
        quantity: quantity,
      }),
    );
  }

  selectedStorageSlotHomeless = null;
  updateHomelessSelection();
}

function getHomelessRenderData() {
  if (window.worldSystem?.currentWorldId !== HOMELESS.worldId) {
    return null;
  }

  if (
    !homelessSprite?.complete ||
    homelessSprite.naturalWidth <= 0 ||
    homelessSprite.naturalHeight <= 0
  ) {
    return null;
  }

  // Полностью повторяем выбор кадра из drawHomelessSprite().
  let drawFrame = frameHomeless;
  let drawRow = currentRow;

  // Плавный переход при приближении/удалении игрока.
  if (transitionProgress < 0.98) {
    drawFrame = Math.round(transitionProgress * (FRAME_COUNT - 1));

    drawRow = 0;
  }

  // Защита от выхода за границы спрайт-листа.
  drawFrame = Math.max(0, Math.min(FRAME_COUNT - 1, drawFrame));

  drawRow = Math.max(0, Math.min(1, drawRow));

  return {
    id: "homeless",
    type: "npc",
    visualType: "billboard",

    x: HOMELESS.x,
    y: HOMELESS.y,

    worldId: HOMELESS.worldId,

    sprite: homelessSprite,

    frame: drawFrame,
    row: drawRow,

    frameCount: FRAME_COUNT,

    frameWidth: FRAME_W,
    frameHeight: FRAME_H,

    displayWidth: FRAME_W + 5,
    displayHeight: FRAME_H + 5,
  };
}

window.homelessSystem = {
  getRenderData: getHomelessRenderData,
  initialize(sprite, initialMet = null) {
    homelessSprite = sprite;
    animationTime = 0;
    currentRow = 0;
    frameHomeless = 0;
    transitionProgress = 1;

    const met =
      initialMet !== null
        ? !!initialMet
        : players.get(myId)?.homelessMet === true;

    isHomelessMet = met;
    homelessHasGreetingBeenShownThisSession = met;
    console.log("[Homeless] initialized", { met });
  },

  setHomelessMet(met) {
    isHomelessMet = met;
    homelessHasGreetingBeenShownThisSession = met;
    if (!met && isNearHomeless) removeButtons();
    if (met && isNearHomeless) showHomelessButtons();
  },

  checkProximity() {
    const me = players.get(myId);
    if (!me || me.health <= 0 || me.worldId !== HOMELESS.worldId) {
      if (isNearHomeless) {
        isNearHomeless = false;
        removeButtons();
        closeHomelessDialog();
      }
      return;
    }

    const dx = me.x - HOMELESS.x;
    const dy = me.y - HOMELESS.y;
    const dist = Math.hypot(dx, dy);
    const nowNear = dist < HOMELESS.interactionRadius;

    if (nowNear && !isNearHomeless) {
      isNearHomeless = true;
      if (isHomelessMet) {
        showHomelessButtons();
      } else {
        homelessHasGreetingBeenShownThisSession = true;
        openHomelessGreeting();
      }
    } else if (!nowNear && isNearHomeless) {
      isNearHomeless = false;
      removeButtons();
      closeHomelessDialog();
      currentRow = 0;
      animationTime = 0;
      frameHomeless = 0;
    }
  },

  getPosition() {
    return { x: HOMELESS.x, y: HOMELESS.y };
  },

  drawSprite(camX, camY) {
    drawHomelessSprite(camX, camY);
  },

  updateAnimation(deltaTime) {
    updateHomelessAnimation(deltaTime);
  },

  draw: drawHomeless,
  update: updateHomelessAnimation,
  handleMessage: handleHomelessServerMessage,
  meetAndCloseGreeting,
  closeDialog: closeHomelessDialog,
};

(function registerHomelessVisualProvider() {
  "use strict";

  function registerHomeless3D() {
    const scene = window.sceneEntitySystem;
    const homeless = window.homelessSystem;

    if (
      typeof scene?.registerNPCVisualProvider !== "function" ||
      typeof scene?.getRegisteredNPCIds !== "function" ||
      typeof homeless?.getRenderData !== "function"
    ) {
      return false;
    }

    const id = "homeless";

    // Защита от повторной регистрации.
    if (scene.getRegisteredNPCIds().includes(id)) {
      return true;
    }

    scene.registerNPCVisualProvider(id, {
      getRenderData() {
        return homeless.getRenderData();
      },
    });

    const registered = scene.getRegisteredNPCIds().includes(id);

    if (registered) {
      console.log("[Homeless3D] Visual provider registered successfully.");
    } else {
      console.error("[Homeless3D] Failed to register visual provider.");
    }

    return registered;
  }

  if (!registerHomeless3D()) {
    window.addEventListener("load", registerHomeless3D, { once: true });
  }
})();
