// cristinaNpc.js
// NPC Cristina (Карина) — отображение + знакомство + кнопки Говорить/Купить/Продать
// Senior-optimized: visibility pause, delta cap, zero alloc in hot path

(function () {
  "use strict";

  // === КОНФИГУРАЦИЯ ===
  const CRISTINA_CONFIG = {
    x: 2271,
    y: 915,
    worldId: 0,
    interactionRadius: 50,

    frameWidth: 70,
    frameHeight: 70,
    framesPerRow: 13,

    displayWidth: 70,
    displayHeight: 83,

    rowSpeeds: {
      0: 300,
      1: 400,
      2: 250,
    },

    phaseDurationRow0: 30 * 1000,
    phaseDurationRow2: 30 * 1000,
  };

  // === СОСТОЯНИЕ ===
  let sprite = null;
  let ctx = null;
  let isMet = false;
  let isNear = false;
  let isDialogOpen = false;
  let dialogElement = null;
  let buttonsContainer = null;

  let currentRow = 0;
  let currentFrame = 0;
  let frameTimer = 0;
  let phaseTimer = 0;
  let phase = 0;
  let row1PlayCount = 0;

  const MAX_DELTA = 50;

  // === ИНИЦИАЛИЗАЦИЯ ===
  function initialize(spriteImage) {
    if (!spriteImage) {
      console.warn("[cristinaNpc] spriteImage is missing");
      return;
    }
    sprite = spriteImage;

    const canvas = document.getElementById("gameCanvas");
    if (canvas) ctx = canvas.getContext("2d");

    currentRow = 0;
    currentFrame = 0;
    frameTimer = 0;
    phaseTimer = 0;
    phase = 0;
    row1PlayCount = 0;
    isMet = false;
    isNear = false;
    isDialogOpen = false;
    removeButtons();

    console.log("[cristinaNpc] initialized");
  }

  // === ОБНОВЛЕНИЕ АНИМАЦИИ ===
  function update(deltaTime) {
    if (document.hidden || !sprite || !sprite.complete) return;

    const dt = Math.min(deltaTime || 16.67, MAX_DELTA);
    frameTimer += dt;
    phaseTimer += dt;

    // 1. Сначала определяем текущую строку по фазе и проверяем переходы
    switch (phase) {
      case 0:
        currentRow = 0;
        if (phaseTimer >= CRISTINA_CONFIG.phaseDurationRow0) {
          phase = 1;
          phaseTimer = 0;
          currentFrame = 0;
          frameTimer = 0;
          row1PlayCount = 0;
          currentRow = 1; // сразу ставим новую строку
        }
        break;
      case 1:
        currentRow = 1;
        if (row1PlayCount >= 2) {
          phase = 2;
          phaseTimer = 0;
          currentFrame = 0;
          frameTimer = 0;
          row1PlayCount = 0;
          currentRow = 2;
        }
        break;
      case 2:
        currentRow = 2;
        if (phaseTimer >= CRISTINA_CONFIG.phaseDurationRow2) {
          phase = 3;
          phaseTimer = 0;
          currentFrame = 0;
          frameTimer = 0;
          row1PlayCount = 0;
          currentRow = 1;
        }
        break;
      case 3:
        currentRow = 1;
        if (row1PlayCount >= 2) {
          phase = 0;
          phaseTimer = 0;
          currentFrame = 0;
          frameTimer = 0;
          row1PlayCount = 0;
          currentRow = 0;
        }
        break;
    }

    // 2. Теперь продвигаем кадры с правильной скоростью текущей строки
    const speed = CRISTINA_CONFIG.rowSpeeds[currentRow] || 120;

    if (frameTimer >= speed) {
      frameTimer -= speed;
      currentFrame = (currentFrame + 1) % CRISTINA_CONFIG.framesPerRow;

      // Считаем полные проходы только для строки 1
      if (currentRow === 1 && currentFrame === 0) {
        row1PlayCount++;
      }
    }
  }

  function drawSprite(camX, camY) {
    if (!sprite || !sprite.complete || !ctx) return;
    if (
      !window.worldSystem ||
      window.worldSystem.currentWorldId !== CRISTINA_CONFIG.worldId
    ) {
      return;
    }

    const screenX = CRISTINA_CONFIG.x - camX;
    const screenY = CRISTINA_CONFIG.y - camY;

    const margin = 120;
    if (
      screenX < -margin ||
      screenX > (window.innerWidth || 1920) + margin ||
      screenY < -margin ||
      screenY > (window.innerHeight || 1080) + margin
    ) {
      return;
    }

    const sx = currentFrame * CRISTINA_CONFIG.frameWidth;
    const sy = currentRow * CRISTINA_CONFIG.frameHeight;

    ctx.drawImage(
      sprite,
      sx,
      sy,
      CRISTINA_CONFIG.frameWidth,
      CRISTINA_CONFIG.frameHeight,
      screenX,
      screenY,
      CRISTINA_CONFIG.displayWidth + 10,
      CRISTINA_CONFIG.displayHeight + 10,
    );

    // Метка
    const label = isMet ? "Cristina" : "?";
    const labelX = screenX + CRISTINA_CONFIG.displayWidth * 0.5;
    const labelY = screenY - 12;

    ctx.font = "13px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = isMet ? "#ff8800" : "#ffffff";
    ctx.fillText(label, labelX, labelY);

    // Обновляем позицию кнопок
    updateButtonsPosition(camX, camY);
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
    dialogElement.className = "npc-dialog open";
    dialogElement.dataset.npc = "cristina-nodoc";
    dialogElement.style.backgroundImage = `url(cristinaNoDoc.png)`;
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content"></div>
      <button class="neon-btn-ok" id="cristina-nodoc-ok"></button>
    `;

    document.body.appendChild(dialogElement);

    const okBtn = document.getElementById("cristina-nodoc-ok");
    if (okBtn) okBtn.onclick = () => closeDialog();
  }

  function openGreetingDialog() {
    if (isDialogOpen) return;
    isDialogOpen = true;
    document.body.classList.add("npc-dialog-active");

    dialogElement = document.createElement("div");
    dialogElement.className = "npc-dialog open";
    dialogElement.dataset.npc = "cristina-doc";
    dialogElement.style.backgroundImage = `url(cristinaDoc.png)`;
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content"></div>
      <button class="neon-btn-ok" id="cristina-greeting-ok"></button>
    `;

    document.body.appendChild(dialogElement);

    const okBtn = document.getElementById("cristina-greeting-ok");
    if (okBtn) {
      okBtn.onclick = () => {
        sendWhenReady(ws, JSON.stringify({ type: "meetCristina" }));
        closeDialog();
      };
    }
  }

  // === ДИАЛОГИ ПОСЛЕ ЗНАКОМСТВА (заглушки) ===
  function openTalkDialog() {
    closeDialog();
    isDialogOpen = true;
    document.body.classList.add("npc-dialog-active");

    dialogElement = document.createElement("div");
    dialogElement.className = "npc-dialog open";
    dialogElement.dataset.npc = "cristina-talk";
    dialogElement.style.backgroundImage = `url(cristinaTalk.png)`;
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content">
        <div id="cristinaTalkTopics" class="cristina-talk-topics"></div>
      </div>
      <button id="cristinaCloseTalkBtn" class="neon-btn-thimblerigger"></button>
    `;

    document.body.appendChild(dialogElement);

    const topicsContainer = document.getElementById("cristinaTalkTopics");
    const closeBtn = document.getElementById("cristinaCloseTalkBtn");

    const topics = [
      {
        title: "О себе",
        text: "Меня зовут Cristina. Когда-то я работала на корпорацию — чинила импланты и штопала броню. Потом меня списали. Теперь я шью из обрывков то, что ещё можно носить. В этом городе даже тряпки имеют цену.",
      },
      {
        title: "О порванной экипировке",
        text: "Всё, что видишь — не мусор. Это остатки настоящих сетов. Health, Energy, Gluttony, Thirst. Каждый кусок ещё держит часть свойств. Купи — и почувствуешь разницу. Или продай мне своё, если совсем прижало.",
      },
      {
        title: "О Неоновом городе",
        text: "Город светится сверху и гниёт снизу. Корпорации строят башни, а мы внизу шьём жизнь из лоскутов. Неон мигает — и кто-то снова теряет имя. Здесь выживает тот, кто умеет чинить себя сам.",
      },
      {
        title: "Советы сталкеру",
        text: "Не ходи голым. Даже порванная броня лучше, чем ничего. Следи за здоровьем, энергией и водой — город забирает всё сразу. И никогда не показывай полный инвентарь незнакомцам.",
      },
      {
        title: "Почему эти вещи?",
        text: "Потому что целые сеты стоят как жизнь. А порванные — это шанс для тех, кто только начинает. Я беру за них мало и плачу за твои ещё меньше. Честный обмен на окраине. Больше никто так не сделает.",
      },
      {
        title: "Надежда",
        text: "Иногда мне кажется, что когда-нибудь неон погаснет и мы снова увидим звёзды. Пока же я сижу здесь, шью и жду тех, кому ещё нужна броня. Может, и ты однажды вернёшься с целым сетом.",
      },
    ];

    topics.forEach((topic) => {
      const div = document.createElement("div");
      div.className = "cristina-talk-topic";
      div.innerHTML = `<strong class="cristina-talk-topic-title">${topic.title}</strong>`;

      div.addEventListener("click", () => {
        topicsContainer.classList.add("hidden");

        const npcContent = dialogElement.querySelector(".npc-dialog-content");
        npcContent.innerHTML = `
          <div class="cristina-fullscreen">
            <div class="cristina-talk-text-content">${topic.text}</div>
          </div>
        `;
        closeBtn.onclick = () => showCristinaTopics();
      });

      topicsContainer.appendChild(div);
    });

    function showCristinaTopics() {
      const npcContent = dialogElement.querySelector(".npc-dialog-content");
      npcContent.innerHTML = `<div id="cristinaTalkTopics" class="cristina-talk-topics"></div>`;

      const newTopicsContainer = document.getElementById("cristinaTalkTopics");
      topics.forEach((topic) => {
        const div = document.createElement("div");
        div.className = "cristina-talk-topic";
        div.innerHTML = `<strong class="cristina-talk-topic-title">${topic.title}</strong>`;
        div.addEventListener("click", () => {
          newTopicsContainer.classList.add("hidden");
          npcContent.innerHTML = `
            <div class="cristina-fullscreen">
              <div class="cristina-talk-text-content">${topic.text}</div>
            </div>
          `;
          closeBtn.onclick = () => showCristinaTopics();
        });
        newTopicsContainer.appendChild(div);
      });

      closeBtn.onclick = closeDialog;
    }

    closeBtn.onclick = closeDialog;
  }

  function openBuyDialog() {
    closeDialog();
    isDialogOpen = true;
    document.body.classList.add("npc-dialog-active");

    dialogElement = document.createElement("div");
    dialogElement.className = "npc-dialog open cristina-shop-dialog";
    dialogElement.dataset.npc = "cristina-buy";
    dialogElement.style.backgroundImage = `url(cristinaBuy.png)`;
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content cristina-shop-content">
        <div id="cristinaShopGrid" class="cristina-shop-grid"></div>
      </div>
      <div class="cristina-shop-buttons">
        <button class="cristina-buy-confirm-btn" id="cristina-shop-buy" disabled></button>
        <button class="neon-btn-ok" id="cristina-shop-close"></button>
      </div>
    `;

    document.body.appendChild(dialogElement);

    const grid = document.getElementById("cristinaShopGrid");
    const buyBtn = document.getElementById("cristina-shop-buy");
    const closeBtn = document.getElementById("cristina-shop-close");

    if (closeBtn) closeBtn.onclick = () => closeDialog();

    let selectedItemType = null;

    // === Четыре сета порванной экипировки (порядок: cap → t-shirt → gloves → belt → pants → sneakers) ===
    const TORN_SETS = [
      // Health
      [
        "torn_baseball_cap_of_health",
        "torn_health_t_shirt",
        "torn_health_gloves",
        "torn_belt_of_health",
        "torn_pants_of_health",
        "torn_health_sneakers",
      ],
      // Energy
      [
        "torn_energy_cap",
        "torn_energy_t_shirt",
        "torn_gloves_of_energy",
        "torn_energy_belt",
        "torn_pants_of_energy",
        "torn_sneakers_of_energy",
      ],
      // Gluttony
      [
        "torn_cap_of_gluttony",
        "torn_t_shirt_of_gluttony",
        "torn_gloves_of_gluttony",
        "torn_belt_of_gluttony",
        "torn_pants_of_gluttony",
        "torn_sneakers_of_gluttony",
      ],
      // Thirst
      [
        "torn_cap_of_thirst",
        "torn_t_shirt_of_thirst",
        "torn_gloves_of_thirst",
        "torn_belt_of_thirst",
        "torn_pants_of_thirst",
        "torn_sneakers_of_thirst",
      ],
    ];

    // Заполняем 4 колонки × 6 строк
    TORN_SETS.forEach((set) => {
      const column = document.createElement("div");
      column.className = "cristina-shop-column";

      set.forEach((type) => {
        const cfg = ITEM_CONFIG?.[type];
        if (!cfg) return;

        const itemEl = document.createElement("div");
        itemEl.className = "cristina-shop-item";
        itemEl.dataset.type = type;

        // Полное описание (как у Джека)
        let desc = cfg.description || type;
        if (window.i18n) {
          const tKey = "itemdesc_" + type;
          const translated = window.i18n.t(tKey);
          if (translated && translated !== tKey) desc = translated;
        }

        itemEl.innerHTML = `
          <img src="${cfg.image?.src || ""}" alt="${type}" width="40" height="40">
          <div class="cristina-shop-item-info">
            <div class="cristina-shop-item-name">${desc}</div>
            <div class="cristina-shop-item-price">50 баляр</div>
          </div>
        `;

        itemEl.onclick = () => {
          grid.querySelectorAll(".cristina-shop-item").forEach((el) => {
            el.classList.remove("selected");
          });
          itemEl.classList.add("selected");
          selectedItemType = type;
          buyBtn.disabled = false;
        };

        column.appendChild(itemEl);
      });

      grid.appendChild(column);
    });

    // Кнопка Buy
    buyBtn.onclick = () => {
      if (!selectedItemType) return;
      if (ws?.readyState === WebSocket.OPEN) {
        sendWhenReady(
          ws,
          JSON.stringify({
            type: "buyFromCristina",
            itemType: selectedItemType,
          }),
        );
      }
    };
  }

  function openSellDialog() {
    closeDialog();
    isDialogOpen = true;
    document.body.classList.add("npc-dialog-active");

    dialogElement = document.createElement("div");
    dialogElement.className = "npc-dialog open cristina-sell-dialog";
    dialogElement.dataset.npc = "cristina-sell";
    dialogElement.style.backgroundImage = `url(cristinaSell.png)`;
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content cristina-sell-content">
        <div id="cristinaSellGrid" class="cristina-sell-grid"></div>
      </div>
      <div class="cristina-sell-buttons">
        <button class="cristina-sell-confirm-btn" id="cristina-sell-confirm" disabled></button>
        <button class="neon-btn-ok" id="cristina-sell-close"></button>
      </div>
    `;

    document.body.appendChild(dialogElement);

    const grid = document.getElementById("cristinaSellGrid");
    const sellBtn = document.getElementById("cristina-sell-confirm");
    const closeBtn = document.getElementById("cristina-sell-close");

    if (closeBtn) closeBtn.onclick = () => closeDialog();

    let selectedSlotIndex = null;

    // Рисуем инвентарь (20 слотов)
    const inv = (typeof inventory !== "undefined" ? inventory : []) || [];
    for (let i = 0; i < 20; i++) {
      const slot = document.createElement("div");
      slot.className = "cristina-sell-slot";
      slot.dataset.index = i;

      const item = inv[i];
      if (item) {
        const cfg = ITEM_CONFIG?.[item.type];
        const img = document.createElement("img");
        img.src = cfg?.image?.src || "";
        img.width = 40;
        img.height = 40;
        slot.appendChild(img);

        if (item.quantity > 1) {
          const qty = document.createElement("div");
          qty.className = "cristina-sell-qty";
          qty.textContent = item.quantity;
          slot.appendChild(qty);
        }
      }

      slot.onclick = () => {
        // Снимаем выделение
        grid.querySelectorAll(".cristina-sell-slot").forEach((el) => {
          el.classList.remove("selected");
        });
        slot.classList.add("selected");
        selectedSlotIndex = i;

        // Активируем кнопку только для порванной экипировки
        const itemType = inv[i]?.type;
        const isTorn = itemType && itemType.startsWith("torn_");
        sellBtn.disabled = !isTorn;
      };

      grid.appendChild(slot);
    }

    // Кнопка Продать
    sellBtn.onclick = () => {
      if (selectedSlotIndex === null) return;
      const item = inv[selectedSlotIndex];
      if (!item || !item.type.startsWith("torn_")) return;

      if (ws?.readyState === WebSocket.OPEN) {
        sendWhenReady(
          ws,
          JSON.stringify({
            type: "sellToCristina",
            slotIndex: selectedSlotIndex,
          }),
        );
      }
      // Диалог оставляем открытым — после ответа сервера инвентарь обновится
    };
  }

  // === КНОПКИ ===
  function createButtons() {
    if (buttonsContainer) return;

    buttonsContainer = document.createElement("div");
    buttonsContainer.className = "cristina-buttons-container";

    const configs = [
      { className: "cristina-talk-btn", action: openTalkDialog },
      { className: "cristina-buy-btn", action: openBuyDialog },
      { className: "cristina-sell-btn", action: openSellDialog },
    ];

    configs.forEach((cfg) => {
      const btn = document.createElement("div");
      btn.className = "cristina-button " + cfg.className;
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
    const screenX =
      CRISTINA_CONFIG.x - cameraX + CRISTINA_CONFIG.displayWidth / 2;
    const screenY = CRISTINA_CONFIG.y - cameraY - 150;
    buttonsContainer.style.left = `${screenX * zoom}px`;
    buttonsContainer.style.top = `${screenY * zoom}px`;
  }

  // === PROXIMITY ===
  function checkProximity() {
    const me = players.get(myId);
    const currentWorldId = window.worldSystem?.currentWorldId;

    if (
      !me ||
      me.worldId !== CRISTINA_CONFIG.worldId ||
      me.health <= 0 ||
      currentWorldId !== CRISTINA_CONFIG.worldId
    ) {
      if (isNear) {
        isNear = false;
        removeButtons();
        closeDialog();
      }
      return;
    }

    const dx =
      me.x + 35 - (CRISTINA_CONFIG.x + CRISTINA_CONFIG.displayWidth / 2);
    const dy =
      me.y + 35 - (CRISTINA_CONFIG.y + CRISTINA_CONFIG.displayHeight / 2);
    const dist = Math.hypot(dx, dy);
    const nowNear = dist < CRISTINA_CONFIG.interactionRadius;

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

  // === API ===
  function setMet(met) {
    isMet = !!met;
    if (isNear) {
      if (isMet) createButtons();
      else removeButtons();
    }
  }

  function getRenderData() {
    return {
      id: "cristina",
      type: "npc",

      x: CRISTINA_CONFIG.x,
      y: CRISTINA_CONFIG.y,
      worldId: CRISTINA_CONFIG.worldId,

      sprite,

      frame: currentFrame,
      row: currentRow,

      frameCount: CRISTINA_CONFIG.framesPerRow,
      frameWidth: CRISTINA_CONFIG.frameWidth,
      frameHeight: CRISTINA_CONFIG.frameHeight,

      displayWidth: CRISTINA_CONFIG.displayWidth + 10,
      displayHeight: CRISTINA_CONFIG.displayHeight + 10,

      visualType: "billboard",
    };
  }

  window.cristinaNpc = {
    initialize,
    update,
    draw,

    getPosition() {
      return { x: CRISTINA_CONFIG.x, y: CRISTINA_CONFIG.y };
    },

    getRenderData,

    drawSprite(camX, camY) {
      drawSprite(camX, camY);
    },

    checkProximity,
    setMet,
    setCristinaMet: setMet,
    openSellDialog,
    getConfig: () => ({ ...CRISTINA_CONFIG }),
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
      "cristina",
      window.cristinaNpc,
    );
  }
})();
