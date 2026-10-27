/**
 * Daniel NPC System
 * World 0 only. Display + meet + Talk/Quests stubs + Rent (40 slots, 5 bal/day)
 * Sprite: 6 rows × 13 frames × 70×70
 */
(function () {
  "use strict";

  const DANIEL_CONFIG = {
    worldId: 0,
    x: 1011,
    y: 1979,
    interactionRadius: 50,
    frameWidth: 70,
    frameHeight: 70,
    framesPerRow: 13,
    displayWidth: 80,
    displayHeight: 80,
    frameDurationRow0: 220,
    frameDurationRow1: 180,
    frameDurationRow2: 220,
    frameDurationRow3: 130,
    frameDurationRow4: 180,
    frameDurationRow5: 130,
    phaseDurationRow0: 25_000,
    phaseDurationRow2: 25_000,
    row1LoopsBetween: 1,
  };

  const DANIEL_STORAGE_SLOTS = 40;

  let sprite = null;
  let initialized = false;
  let isMet = false;
  let isNear = false;
  let isDialogOpen = false;
  let isStorageOpen = false;
  let dialogElement = null;
  let storageDialog = null;
  let buttonsContainer = null;

  let currentStorageItems = [];
  let currentRentUntil = null;
  let openStorageAfterRent = false;
  let selectedPlayerSlot = null;
  let selectedStorageSlot = null;

  let mode = "idle";
  let currentRow = 0;
  let currentFrame = 0;
  let frameAccum = 0;
  let phaseAccum = 0;
  let idlePhase = 0;

  const ROW_DURATIONS = [
    DANIEL_CONFIG.frameDurationRow0,
    DANIEL_CONFIG.frameDurationRow1,
    DANIEL_CONFIG.frameDurationRow2,
    DANIEL_CONFIG.frameDurationRow3,
    DANIEL_CONFIG.frameDurationRow4,
    DANIEL_CONFIG.frameDurationRow5,
  ];

  function initialize(image) {
    if (initialized) return;
    sprite = image || null;
    initialized = true;
    isMet = false;
    isNear = false;
    isDialogOpen = false;
    isStorageOpen = false;
    removeButtons();
    closeAllDialogs();
    resetAnimation();
  }

  function resetAnimation() {
    mode = "idle";
    currentRow = 0;
    currentFrame = 0;
    frameAccum = 0;
    phaseAccum = 0;
    idlePhase = 0;
  }

  function setIdleRowForPhase() {
    switch (idlePhase) {
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
      default:
        currentRow = 0;
    }
    currentFrame = 0;
    frameAccum = 0;
  }

  function advanceIdlePhaseOnLoopComplete() {
    if (idlePhase === 1 || idlePhase === 3) {
      phaseAccum += 1;
      if (phaseAccum >= DANIEL_CONFIG.row1LoopsBetween) {
        phaseAccum = 0;
        idlePhase = (idlePhase + 1) % 4;
        setIdleRowForPhase();
      }
    }
  }

  function updateIdleTimeBasedPhases(deltaTime) {
    if (idlePhase !== 0 && idlePhase !== 2) return;
    phaseAccum += deltaTime;
    const limit =
      idlePhase === 0
        ? DANIEL_CONFIG.phaseDurationRow0
        : DANIEL_CONFIG.phaseDurationRow2;
    if (phaseAccum >= limit) {
      phaseAccum = 0;
      idlePhase = (idlePhase + 1) % 4;
      setIdleRowForPhase();
    }
  }

  function startEnter() {
    mode = "enter";
    currentRow = 3;
    currentFrame = 0;
    frameAccum = 0;
  }

  function startNearLoop() {
    mode = "near";
    currentRow = 4;
    currentFrame = 0;
    frameAccum = 0;
  }

  function startExit() {
    mode = "exit";
    currentRow = 5;
    currentFrame = 0;
    frameAccum = 0;
  }

  function returnToIdle() {
    mode = "idle";
    idlePhase = 0;
    phaseAccum = 0;
    setIdleRowForPhase();
  }

  function update(deltaTime) {
    if (!initialized || !sprite || !sprite.complete) return;
    const worldId = window.worldSystem?.currentWorldId;
    if (worldId !== DANIEL_CONFIG.worldId) return;

    const dt = Math.min(deltaTime, 50);
    frameAccum += dt;
    const frameDur = ROW_DURATIONS[currentRow] || 180;

    while (frameAccum >= frameDur) {
      frameAccum -= frameDur;
      currentFrame = (currentFrame + 1) % DANIEL_CONFIG.framesPerRow;
      if (currentFrame === 0) {
        if (mode === "enter") startNearLoop();
        else if (mode === "exit") returnToIdle();
        else if (mode === "idle") advanceIdlePhaseOnLoopComplete();
      }
    }
    if (mode === "idle") updateIdleTimeBasedPhases(dt);
  }

  function drawSprite(camX, camY) {
    if (!initialized || !sprite || !sprite.complete) return;
    const worldId = window.worldSystem?.currentWorldId;
    if (worldId !== DANIEL_CONFIG.worldId) return;

    const screenX = DANIEL_CONFIG.x - camX;
    const screenY = DANIEL_CONFIG.y - camY;
    const canvas = document.getElementById("gameCanvas");
    if (!canvas) return;
    const dw = DANIEL_CONFIG.displayWidth;
    const dh = DANIEL_CONFIG.displayHeight;

    if (
      screenX < -dw - 20 ||
      screenX > canvas.width + 20 ||
      screenY < -dh - 20 ||
      screenY > canvas.height + 20
    )
      return;

    const sx = currentFrame * DANIEL_CONFIG.frameWidth;
    const sy = currentRow * DANIEL_CONFIG.frameHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      sprite,
      sx,
      sy,
      DANIEL_CONFIG.frameWidth,
      DANIEL_CONFIG.frameHeight,
      screenX,
      screenY,
      dw,
      dh,
    );

    const label = isMet ? "Daniel" : "?";
    ctx.font = "13px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = isMet ? "#a0e0ff" : "#ffffff";
    ctx.fillText(label, screenX + dw * 0.5, screenY - 12);

    updateButtonsPosition(camX, camY);
  }

  function draw() {
    const camera = window.movementSystem?.getCamera?.();
    if (!camera) return;
    drawSprite(camera.x, camera.y);
  }

  function closeDialog() {
    if (dialogElement) {
      dialogElement.remove();
      dialogElement = null;
    }
    isDialogOpen = false;
    if (!isStorageOpen) {
      document.body.classList.remove("npc-dialog-active");
    }
  }

  function closeStorage() {
    if (storageDialog) {
      storageDialog.remove();
      storageDialog = null;
    }
    isStorageOpen = false;
    document.body.classList.remove(
      "npc-dialog-active",
      "daniel-storage-active",
    );
    selectedPlayerSlot = null;
    selectedStorageSlot = null;
  }

  function closeAllDialogs() {
    closeDialog();
    closeStorage();
  }

  function removeDialog() {
    closeAllDialogs();
  }

  function openNoDocDialog() {
    if (isDialogOpen || isStorageOpen) return;
    isDialogOpen = true;
    document.body.classList.add("npc-dialog-active");

    dialogElement = document.createElement("div");
    dialogElement.className = "npc-dialog open";
    dialogElement.dataset.npc = "daniel-nodoc";
    dialogElement.style.backgroundImage = "url(danielNoDoc.png)";
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";
    dialogElement.innerHTML = `
      <div class="npc-dialog-content"></div>
      <button class="neon-btn-ok" id="daniel-nodoc-ok"></button>
    `;
    document.body.appendChild(dialogElement);
    const okBtn = document.getElementById("daniel-nodoc-ok");
    if (okBtn) okBtn.onclick = () => closeDialog();
  }

  function openGreetingDialog() {
    if (isDialogOpen || isStorageOpen) return;
    isDialogOpen = true;
    document.body.classList.add("npc-dialog-active");

    dialogElement = document.createElement("div");
    dialogElement.className = "npc-dialog open";
    dialogElement.dataset.npc = "daniel-doc";
    dialogElement.style.backgroundImage = "url(danielDoc.png)";
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";
    dialogElement.innerHTML = `
      <div class="npc-dialog-content"></div>
      <button class="neon-btn-ok" id="daniel-greeting-ok"></button>
    `;
    document.body.appendChild(dialogElement);
    const okBtn = document.getElementById("daniel-greeting-ok");
    if (okBtn) {
      okBtn.onclick = () => {
        if (typeof sendWhenReady === "function" && typeof ws !== "undefined") {
          sendWhenReady(ws, JSON.stringify({ type: "meetDaniel" }));
        }
        closeDialog();
      };
    }
  }

  function openTalkDialog() {
    closeAllDialogs();
    isDialogOpen = true;
    document.body.classList.add("npc-dialog-active");

    dialogElement = document.createElement("div");
    dialogElement.className = "npc-dialog open";
    dialogElement.dataset.npc = "daniel-talk";
    dialogElement.style.backgroundImage = "url(danielTalk.png)";
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content">
        <div id="danielTalkTopics" class="daniel-talk-topics"></div>
      </div>
      <button id="danielCloseTalkBtn" class="neon-btn-thimblerigger"></button>
    `;

    document.body.appendChild(dialogElement);

    const topicsContainer = document.getElementById("danielTalkTopics");
    const closeBtn = document.getElementById("danielCloseTalkBtn");

    const topics = [
      {
        title: "О себе",
        text: "Меня зовут Daniel. Когда-то работал на складах корпорации — учёт, охрана, логистика. Потом меня сократили. Теперь у меня свой склад на 40 ячеек. Я беру честно и не лезу в чужие вещи.",
      },
      {
        title: "Про склад",
        text: "Сорок слотов. Пять баляров в день. Арендуй на сколько нужно, клади что угодно. Если срок выйдет — содержимое исчезнет. Правила простые, как и я. Не люблю сюрпризов.",
      },
      {
        title: "О Неоновом городе",
        text: "Город светится сверху и гниёт внизу. Здесь всё можно купить, продать или потерять за одну ночь. Мой склад — островок порядка среди хаоса. Пока платишь — твои вещи в безопасности.",
      },
      {
        title: "Советы сталкеру",
        text: "Не носи всё с собой. Тяжёлый инвентарь замедляет и привлекает внимание. Держи запас на складе, бери только то, что нужно прямо сейчас. И всегда имей немного баляров на аренду.",
      },
      {
        title: "Почему именно я?",
        text: "Потому что я не бандит и не корпорат. Я просто человек, который знает цену порядку. Мой склад не самый дешёвый, но самый надёжный в этом районе. Проверено временем.",
      },
      {
        title: "Надежда",
        text: "Иногда мне кажется, что неон когда-нибудь погаснет и мы снова увидим настоящие звёзды. Пока же я здесь — с ключами от ячеек и открытой дверью. Заходи, если нужно место.",
      },
    ];

    topics.forEach((topic) => {
      const div = document.createElement("div");
      div.className = "daniel-talk-topic";
      div.innerHTML = `<strong class="daniel-talk-topic-title">${topic.title}</strong>`;

      div.addEventListener("click", () => {
        topicsContainer.classList.add("hidden");

        const npcContent = dialogElement.querySelector(".npc-dialog-content");
        npcContent.innerHTML = `
          <div class="daniel-fullscreen">
            <div class="daniel-talk-text-content">${topic.text}</div>
          </div>
        `;
        closeBtn.onclick = () => showDanielTopics();
      });

      topicsContainer.appendChild(div);
    });

    function showDanielTopics() {
      const npcContent = dialogElement.querySelector(".npc-dialog-content");
      npcContent.innerHTML = `<div id="danielTalkTopics" class="daniel-talk-topics"></div>`;

      const newTopicsContainer = document.getElementById("danielTalkTopics");
      topics.forEach((topic) => {
        const div = document.createElement("div");
        div.className = "daniel-talk-topic";
        div.innerHTML = `<strong class="daniel-talk-topic-title">${topic.title}</strong>`;
        div.addEventListener("click", () => {
          newTopicsContainer.classList.add("hidden");
          npcContent.innerHTML = `
            <div class="daniel-fullscreen">
              <div class="daniel-talk-text-content">${topic.text}</div>
            </div>
          `;
          closeBtn.onclick = () => showDanielTopics();
        });
        newTopicsContainer.appendChild(div);
      });

      closeBtn.onclick = closeDialog;
    }

    closeBtn.onclick = closeDialog;
  }

  function openQuestDialog() {
    closeAllDialogs();
    isDialogOpen = true;
    document.body.classList.add("npc-dialog-active");

    dialogElement = document.createElement("div");
    dialogElement.className = "npc-dialog open";
    dialogElement.dataset.npc = "daniel-quest";
    dialogElement.style.backgroundImage = "url(danielQuest.png)";
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";
    dialogElement.innerHTML = `
      <div class="npc-dialog-content"></div>
      <button class="neon-btn-ok" id="daniel-quest-close"></button>
    `;
    document.body.appendChild(dialogElement);
    const closeBtn = document.getElementById("daniel-quest-close");
    if (closeBtn) closeBtn.onclick = () => closeDialog();
  }

  // ─── RENT ─────────────────────────────────────────────────────────────
  function openRentDialog() {
    closeAllDialogs();
    if (typeof sendWhenReady === "function" && typeof ws !== "undefined") {
      sendWhenReady(ws, JSON.stringify({ type: "danielOpenStorage" }));
    }
  }

  function showDanielRentDialog() {
    closeAllDialogs();
    isDialogOpen = true;
    document.body.classList.add("npc-dialog-active");

    dialogElement = document.createElement("div");
    dialogElement.className = "daniel-main-dialog open daniel-rent-dialog";

    let rentInfoHtml = "";
    if (currentRentUntil && currentRentUntil > Date.now()) {
      const rentDate = new Date(currentRentUntil).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      rentInfoHtml = `<p class="daniel-text-rent-info">${rentDate}</p>`;
    } else {
      rentInfoHtml = `<p class="daniel-text-rent-info">Rent has not been paid.</p>`;
    }

    dialogElement.innerHTML = `
      ${rentInfoHtml}
      <input type="number" id="danielRentDays" min="1" value="1" class="daniel-rent-input">
      <button class="daniel-rent-ok"></button>
      ${
        currentRentUntil && currentRentUntil > Date.now()
          ? '<button class="daniel-rent-bag"></button>'
          : ""
      }
      <button class="daniel-close-btn"></button>
    `;

    document.body.appendChild(dialogElement);

    dialogElement
      .querySelector(".daniel-close-btn")
      .addEventListener("click", closeAllDialogs);

    dialogElement
      .querySelector(".daniel-rent-ok")
      .addEventListener("click", () => {
        const days = parseInt(
          document.getElementById("danielRentDays").value,
          10,
        );
        if (days >= 1) {
          if (
            typeof sendWhenReady === "function" &&
            typeof ws !== "undefined"
          ) {
            sendWhenReady(
              ws,
              JSON.stringify({ type: "danielRentConfirm", days }),
            );
          }
        } else if (typeof showNotification === "function") {
          showNotification("Введите корректное количество дней", "#ff4444");
        }
      });

    const bagBtn = dialogElement.querySelector(".daniel-rent-bag");
    if (bagBtn) {
      bagBtn.addEventListener("click", () => {
        openStorageAfterRent = true;
        if (typeof sendWhenReady === "function" && typeof ws !== "undefined") {
          sendWhenReady(ws, JSON.stringify({ type: "danielOpenStorage" }));
        }
      });
    }
  }

  // ─── STORAGE 40 SLOTS ─────────────────────────────────────────────────
  function showDanielStorageInterface(storageItems) {
    currentStorageItems =
      storageItems || Array(DANIEL_STORAGE_SLOTS).fill(null);
    closeAllDialogs();

    isStorageOpen = true;
    document.body.classList.add("npc-dialog-active", "daniel-storage-active");

    storageDialog = document.createElement("div");
    storageDialog.className = "daniel-storage-dialog open";
    storageDialog.innerHTML = `
      <div class="daniel-storage-header">
        <button id="daniel-close-btn-bag" class="daniel-close-btn"></button>
      </div>
      <div class="daniel-storage-content">
        <div class="daniel-player-inventory">
          <div class="daniel-grid" id="danielPlayerGrid"></div>
        </div>
        <div class="daniel-storage-buttons">
          <button id="danielPutBtn" disabled></button>
          <button id="danielTakeBtn" disabled></button>
        </div>
        <div class="daniel-stack-form" id="danielStackForm" style="display: none;">
          <div class="daniel-cyber-text" id="danielStackText">Количество:</div>
          <input type="number" id="danielStackInput" class="daniel-cyber-input" min="1" value="1">
          <div class="daniel-error-text" id="danielStackError"></div>
        </div>
        <div class="daniel-storage-inventory">
          <div class="daniel-grid daniel-grid-40" id="danielStorageGrid"></div>
        </div>
      </div>
    `;

    document.body.appendChild(storageDialog);

    storageDialog
      .querySelector(".daniel-close-btn")
      .addEventListener("click", closeAllDialogs);

    const inv =
      typeof inventory !== "undefined" ? inventory : Array(20).fill(null);
    updateDanielStorageUI(inv, currentStorageItems);

    document
      .getElementById("danielPutBtn")
      .addEventListener("click", putSelectedItem);
    document
      .getElementById("danielTakeBtn")
      .addEventListener("click", takeSelectedItem);
  }

  function updateDanielStorageUI(playerInv, storageInv) {
    const playerGrid = document.getElementById("danielPlayerGrid");
    const storageGrid = document.getElementById("danielStorageGrid");
    if (!playerGrid || !storageGrid) return;

    playerGrid.innerHTML = "";
    storageGrid.innerHTML = "";

    const inv = playerInv || Array(20).fill(null);
    for (let i = 0; i < 20; i++) {
      const item = inv[i];
      const slot = document.createElement("div");
      slot.className = "daniel-slot";
      slot.dataset.index = i;

      if (item) {
        const cfg =
          typeof ITEM_CONFIG !== "undefined" ? ITEM_CONFIG[item.type] : null;
        const img = document.createElement("img");
        img.src = cfg?.image?.src || item.type + ".png";
        slot.appendChild(img);
        if (item.quantity > 1) {
          const q = document.createElement("div");
          q.className = "daniel-quantity";
          q.textContent = item.quantity;
          slot.appendChild(q);
        }
      }

      slot.addEventListener("click", () => {
        selectedPlayerSlot = i;
        selectedStorageSlot = null;
        updateDanielSelection();
      });
      playerGrid.appendChild(slot);
    }

    const stor = storageInv || Array(DANIEL_STORAGE_SLOTS).fill(null);
    for (let i = 0; i < DANIEL_STORAGE_SLOTS; i++) {
      const item = stor[i];
      const slot = document.createElement("div");
      slot.className = "daniel-slot";
      slot.dataset.index = i;

      if (item) {
        const cfg =
          typeof ITEM_CONFIG !== "undefined" ? ITEM_CONFIG[item.type] : null;
        const img = document.createElement("img");
        img.src = cfg?.image?.src || item.type + ".png";
        slot.appendChild(img);
        if (item.quantity > 1) {
          const q = document.createElement("div");
          q.className = "daniel-quantity";
          q.textContent = item.quantity;
          slot.appendChild(q);
        }
      }

      slot.addEventListener("click", () => {
        selectedStorageSlot = i;
        selectedPlayerSlot = null;
        updateDanielSelection();
      });
      storageGrid.appendChild(slot);
    }

    updateDanielSelection();
  }

  function updateDanielSelection() {
    document
      .querySelectorAll(".daniel-slot")
      .forEach((el) => el.classList.remove("selected"));

    const putBtn = document.getElementById("danielPutBtn");
    const takeBtn = document.getElementById("danielTakeBtn");
    const stackForm = document.getElementById("danielStackForm");
    const stackInput = document.getElementById("danielStackInput");
    const stackText = document.getElementById("danielStackText");
    const stackError = document.getElementById("danielStackError");

    if (stackForm) stackForm.style.display = "none";
    if (stackError) stackError.textContent = "";
    if (putBtn) putBtn.disabled = true;
    if (takeBtn) takeBtn.disabled = true;

    const inv =
      typeof inventory !== "undefined" ? inventory : Array(20).fill(null);

    if (selectedPlayerSlot !== null) {
      const el = document.querySelector(
        `#danielPlayerGrid .daniel-slot[data-index="${selectedPlayerSlot}"]`,
      );
      if (el) el.classList.add("selected");

      const item = inv[selectedPlayerSlot];
      if (putBtn) putBtn.disabled = !item;

      if (
        item &&
        typeof ITEM_CONFIG !== "undefined" &&
        ITEM_CONFIG[item.type]?.stackable &&
        item.quantity > 1
      ) {
        if (stackForm && stackInput) {
          stackForm.style.display = "flex";
          stackText.textContent = "";
          stackInput.max = item.quantity;
          stackInput.value = item.quantity;
        }
      }
    } else if (selectedStorageSlot !== null) {
      const el = document.querySelector(
        `#danielStorageGrid .daniel-slot[data-index="${selectedStorageSlot}"]`,
      );
      if (el) el.classList.add("selected");

      const item = currentStorageItems[selectedStorageSlot];
      if (takeBtn && item) takeBtn.disabled = false;

      if (
        item &&
        typeof ITEM_CONFIG !== "undefined" &&
        ITEM_CONFIG[item.type]?.stackable &&
        item.quantity > 1
      ) {
        if (stackForm && stackInput) {
          stackForm.style.display = "flex";
          stackText.textContent = "";
          stackInput.max = item.quantity;
          stackInput.value = item.quantity;
        }
      }
    }
  }

  function putSelectedItem() {
    if (selectedPlayerSlot === null) return;
    const inv =
      typeof inventory !== "undefined" ? inventory : Array(20).fill(null);
    const item = inv[selectedPlayerSlot];
    if (!item) return;

    let quantity = 1;
    const stackInput = document.getElementById("danielStackInput");
    if (
      typeof ITEM_CONFIG !== "undefined" &&
      ITEM_CONFIG[item.type]?.stackable &&
      stackInput &&
      stackInput.parentElement.style.display !== "none"
    ) {
      quantity = parseInt(stackInput.value, 10) || 1;
      if (quantity < 1 || quantity > item.quantity) {
        const err = document.getElementById("danielStackError");
        if (err) err.textContent = "Неверное количество";
        return;
      }
    }

    if (typeof sendWhenReady === "function" && typeof ws !== "undefined") {
      sendWhenReady(
        ws,
        JSON.stringify({
          type: "danielPutItem",
          playerSlot: selectedPlayerSlot,
          quantity,
        }),
      );
    }
    selectedPlayerSlot = null;
    updateDanielSelection();
  }

  function takeSelectedItem() {
    if (selectedStorageSlot === null) return;
    const item = currentStorageItems[selectedStorageSlot];
    if (!item) return;

    let quantity = 1;
    const stackInput = document.getElementById("danielStackInput");
    if (
      typeof ITEM_CONFIG !== "undefined" &&
      ITEM_CONFIG[item.type]?.stackable &&
      stackInput &&
      stackInput.parentElement.style.display !== "none"
    ) {
      quantity = parseInt(stackInput.value, 10) || 1;
      if (quantity < 1 || quantity > item.quantity) {
        const err = document.getElementById("danielStackError");
        if (err) err.textContent = "Неверное количество";
        return;
      }
    }

    if (typeof sendWhenReady === "function" && typeof ws !== "undefined") {
      sendWhenReady(
        ws,
        JSON.stringify({
          type: "danielTakeItem",
          storageSlot: selectedStorageSlot,
          quantity,
        }),
      );
    }
    selectedStorageSlot = null;
    updateDanielSelection();
  }

  // ─── Server messages ──────────────────────────────────────────────────
  function handleMessage(data) {
    if (data.type === "danielStorageStatus") {
      currentRentUntil = data.rentUntil || null;
      if (!data.rented) {
        showDanielRentDialog();
      } else {
        if (openStorageAfterRent) {
          currentStorageItems =
            data.storageItems || Array(DANIEL_STORAGE_SLOTS).fill(null);
          showDanielStorageInterface(data.storageItems);
          openStorageAfterRent = false;
        } else {
          showDanielRentDialog();
        }
      }
    } else if (data.type === "danielRentSuccess") {
      currentRentUntil = data.rentUntil;
      if (data.inventory && typeof inventory !== "undefined") {
        for (let i = 0; i < 20; i++) {
          inventory[i] = data.inventory[i] || null;
        }
        const me = typeof players !== "undefined" ? players.get(myId) : null;
        if (me) {
          me.inventory = data.inventory;
          players.set(myId, me);
        }
        if (window.inventorySystem?.updateInventoryDisplay) {
          window.inventorySystem.updateInventoryDisplay();
        }
      }
      if (typeof showNotification === "function") {
        showNotification(
          `Склад арендован до ${new Date(data.rentUntil).toLocaleString()}`,
          "#00ff88",
        );
      }
      showDanielRentDialog();
    } else if (data.type === "danielStorageUpdate") {
      if (data.inventory && typeof inventory !== "undefined") {
        for (let i = 0; i < 20; i++) {
          inventory[i] = data.inventory[i] || null;
        }
        const me = typeof players !== "undefined" ? players.get(myId) : null;
        if (me) {
          me.inventory = data.inventory;
          players.set(myId, me);
        }
        if (window.inventorySystem?.updateInventoryDisplay) {
          window.inventorySystem.updateInventoryDisplay();
        }
      }
      currentStorageItems =
        data.storageItems || Array(DANIEL_STORAGE_SLOTS).fill(null);
      if (storageDialog) {
        updateDanielStorageUI(
          typeof inventory !== "undefined" ? inventory : [],
          currentStorageItems,
        );
      }
    } else if (data.type === "danielError") {
      if (typeof showNotification === "function") {
        showNotification(data.message || "Ошибка", "#ff4444");
      }
    } else if (data.type === "danielInventoryFull") {
      if (typeof showNotification === "function") {
        showNotification("Инвентарь полон", "#ff4444");
      }
    }
  }

  // ─── Buttons ──────────────────────────────────────────────────────────
  function createButtons() {
    if (buttonsContainer) return;
    buttonsContainer = document.createElement("div");
    buttonsContainer.className = "daniel-buttons-container";

    const configs = [
      { className: "daniel-talk-btn", action: openTalkDialog },
      { className: "daniel-quest-btn", action: openQuestDialog },
      { className: "daniel-rent-btn", action: openRentDialog },
    ];

    configs.forEach((cfg) => {
      const btn = document.createElement("div");
      btn.className = "daniel-button " + cfg.className;
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
    const screenX = DANIEL_CONFIG.x - cameraX + DANIEL_CONFIG.displayWidth / 2;
    const screenY = DANIEL_CONFIG.y - cameraY - 150;
    buttonsContainer.style.left = `${screenX * zoom}px`;
    buttonsContainer.style.top = `${screenY * zoom}px`;
  }

  function checkProximity() {
    const me = typeof players !== "undefined" ? players.get(myId) : null;
    const currentWorldId = window.worldSystem?.currentWorldId;

    if (
      !me ||
      me.worldId !== DANIEL_CONFIG.worldId ||
      me.health <= 0 ||
      currentWorldId !== DANIEL_CONFIG.worldId
    ) {
      if (isNear) {
        isNear = false;
        if (mode === "near" || mode === "enter") startExit();
        removeButtons();
        closeAllDialogs();
      }
      return;
    }

    const dx = me.x + 35 - (DANIEL_CONFIG.x + DANIEL_CONFIG.displayWidth / 2);
    const dy = me.y + 35 - (DANIEL_CONFIG.y + DANIEL_CONFIG.displayHeight / 2);
    const dist = Math.hypot(dx, dy);
    const nowNear = dist < DANIEL_CONFIG.interactionRadius;

    if (nowNear && !isNear) {
      isNear = true;
      startEnter();
      if (isMet) createButtons();
      else {
        const hasDocuments = me.corporateDocumentsSubmitted === true;
        if (!hasDocuments) openNoDocDialog();
        else openGreetingDialog();
      }
    } else if (!nowNear && isNear) {
      isNear = false;
      startExit();
      removeButtons();
      closeAllDialogs();
    }
  }

  function setMet(met) {
    isMet = !!met;
    if (isNear) {
      if (isMet) createButtons();
      else removeButtons();
    }
  }

  function getRenderData() {
    if (!initialized || !sprite || !sprite.complete || !window.worldSystem) {
      return null;
    }

    if (window.worldSystem.currentWorldId !== DANIEL_CONFIG.worldId) {
      return null;
    }

    return {
      id: "daniel",
      type: "npc",
      x: DANIEL_CONFIG.x,
      y: DANIEL_CONFIG.y,
      worldId: DANIEL_CONFIG.worldId,
      sprite,
      frame: currentFrame,
      row: currentRow,
      frameCount: DANIEL_CONFIG.framesPerRow,
      frameWidth: DANIEL_CONFIG.frameWidth,
      frameHeight: DANIEL_CONFIG.frameHeight,
      displayWidth: DANIEL_CONFIG.displayWidth,
      displayHeight: DANIEL_CONFIG.displayHeight,
      visualType: "billboard",
    };
  }

  window.danielNpc = {
    initialize,
    update,
    draw,

    getPosition() {
      return { x: DANIEL_CONFIG.x, y: DANIEL_CONFIG.y };
    },

    getRenderData,

    drawSprite(camX, camY) {
      drawSprite(camX, camY);
    },

    checkProximity,
    setMet,
    setDanielMet: setMet,
    handleMessage,
    config: DANIEL_CONFIG,
    resetAnimation,
    getState: () => ({
      isMet,
      isNear,
      mode,
      currentRow,
      currentFrame,
      idlePhase,
    }),
  };

  if (
    window.sceneEntitySystem &&
    typeof window.sceneEntitySystem.registerNPCVisualProvider === "function"
  ) {
    window.sceneEntitySystem.registerNPCVisualProvider(
      "daniel",
      window.danielNpc,
    );
  }
})();
