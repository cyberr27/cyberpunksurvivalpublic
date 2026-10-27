/**
 * Lina NPC System
 * World 0 only. Display + nameplate + meet + buttons (Talk/Buy/Sell stubs)
 * Sprite: 3 rows × 13 frames × 70×70
 */
(function () {
  "use strict";

  // ─── Tunable parameters ───────────────────────────────────────────────
  const LINA_CONFIG = {
    worldId: 0,
    x: 1501,
    y: 835,
    interactionRadius: 70,

    // Размер одного кадра в спрайт-листе (не менять)
    frameWidth: 70,
    frameHeight: 70,
    framesPerRow: 13,

    // Размер отображения на игровом поле
    displayWidth: 80,
    displayHeight: 80,

    // Frame duration (ms) for each row
    frameDurationRow0: 300,
    frameDurationRow1: 300,
    frameDurationRow2: 250,

    // Long phase durations (ms)
    phaseDurationRow0: 40_000,
    phaseDurationRow2: 40_000,

    // How many full loops of row 1 between the long phases
    row1LoopsBetween: 2,
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
    LINA_CONFIG.frameDurationRow0,
    LINA_CONFIG.frameDurationRow1,
    LINA_CONFIG.frameDurationRow2,
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
    if (worldId !== LINA_CONFIG.worldId) return;

    const dt = Math.min(deltaTime, 50);
    frameAccum += dt;

    const frameDur = ROW_DURATIONS[currentRow] || 100;

    while (frameAccum >= frameDur) {
      frameAccum -= frameDur;
      currentFrame = (currentFrame + 1) % LINA_CONFIG.framesPerRow;

      if (currentFrame === 0) {
        advancePhaseOnLoopComplete();
      }
    }
  }

  function advancePhaseOnLoopComplete() {
    if (phase === 1 || phase === 3) {
      phaseAccum += 1;
      if (phaseAccum >= LINA_CONFIG.row1LoopsBetween) {
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

    phaseAccum += deltaTime;
    const limit =
      phase === 0
        ? LINA_CONFIG.phaseDurationRow0
        : LINA_CONFIG.phaseDurationRow2;

    if (phaseAccum >= limit) {
      phaseAccum = 0;
      phase = (phase + 1) % 4;
      setRowForPhase();
    }
  }

  function draw() {
    if (!initialized || !sprite || !sprite.complete) return;

    const worldId = window.worldSystem?.currentWorldId;
    if (worldId !== LINA_CONFIG.worldId) return;

    const camera = window.movementSystem?.getCamera?.();
    if (!camera) return;

    const screenX = LINA_CONFIG.x - camera.x;
    const screenY = LINA_CONFIG.y - camera.y;

    const canvas = document.getElementById("gameCanvas");
    if (!canvas) return;
    const dw = LINA_CONFIG.displayWidth;
    const dh = LINA_CONFIG.displayHeight;
    if (
      screenX < -dw - 20 ||
      screenX > canvas.width + 20 ||
      screenY < -dh - 20 ||
      screenY > canvas.height + 20
    ) {
      return;
    }

    const sx = currentFrame * LINA_CONFIG.frameWidth;
    const sy = currentRow * LINA_CONFIG.frameHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      sprite,
      sx,
      sy,
      LINA_CONFIG.frameWidth,
      LINA_CONFIG.frameHeight,
      screenX,
      screenY,
      dw,
      dh,
    );

    // Nameplate
    const label = isMet ? "Lina" : "?";
    const labelX = screenX + dw * 0.5;
    const labelY = screenY - 12;

    ctx.font = "13px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = isMet ? "#ff9ecf" : "#ffffff";
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
    dialogElement.dataset.npc = "lina-nodoc";
    dialogElement.style.backgroundImage = "url(linaNoDoc.png)";
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content"></div>
      <button class="neon-btn-ok" id="lina-nodoc-ok"></button>
    `;

    document.body.appendChild(dialogElement);

    const okBtn = document.getElementById("lina-nodoc-ok");
    if (okBtn) okBtn.onclick = () => closeDialog();
  }

  function openGreetingDialog() {
    if (isDialogOpen) return;
    isDialogOpen = true;
    document.body.classList.add("npc-dialog-active");

    dialogElement = document.createElement("div");
    dialogElement.className = "npc-dialog open";
    dialogElement.dataset.npc = "lina-doc";
    dialogElement.style.backgroundImage = "url(linaDoc.png)";
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content"></div>
      <button class="neon-btn-ok" id="lina-greeting-ok"></button>
    `;

    document.body.appendChild(dialogElement);

    const okBtn = document.getElementById("lina-greeting-ok");
    if (okBtn) {
      okBtn.onclick = () => {
        if (typeof sendWhenReady === "function" && typeof ws !== "undefined") {
          sendWhenReady(ws, JSON.stringify({ type: "meetLina" }));
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
    dialogElement.dataset.npc = "lina-talk";
    dialogElement.style.backgroundImage = "url(linaTalk.png)";
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content">
        <div id="linaTalkTopics" class="lina-talk-topics"></div>
      </div>
      <button id="linaCloseTalkBtn" class="neon-btn-thimblerigger"></button>
    `;

    document.body.appendChild(dialogElement);

    const topicsContainer = document.getElementById("linaTalkTopics");
    const closeBtn = document.getElementById("linaCloseTalkBtn");

    const topics = [
      {
        title: "О себе",
        text: "Меня зовут Lina. Я собираю кристаллы и наноматериалы по всему Неоновому городу. То, что для других — мусор после рейдов, для меня — товар. Работаю честно, цены фиксированные.",
      },
      {
        title: "О материалах",
        text: "Синий, зелёный, красный, белый, жёлтый, хамелеон — все кристаллы на месте. Плюс наносплав и нанонить. Это то, что нужно для апгрейдов у Торестоса. Без них далеко не уйдёшь.",
      },
      {
        title: "О Неоновом городе",
        text: "Город светится, но под ногами — пепел. Корпорации качают ресурсы, сталкеры дерутся за крошки. Я просто нашла свою нишу: купить дёшево, продать по делу. Выживаю так же, как и ты.",
      },
      {
        title: "Советы сталкеру",
        text: "Не носи всё с собой — склад у Homeless дешевле потери. Следи за редкостью: чем выше rarity, тем дороже материал. И всегда оставляй место под баляры — без них здесь никто не разговаривает.",
      },
      {
        title: "Почему я этим занимаюсь?",
        text: "Потому что целые комплекты брони стоят как жизнь, а кристаллы — как шанс. Я беру мало и плачу честно. Если Торестос сделает из твоего хлама что-то сильное — значит, я тоже на своём месте.",
      },
      {
        title: "Надежда",
        text: "Иногда думаю: может, когда-нибудь неон погаснет, и мы увидим настоящие звёзды. Пока же я здесь — с сумкой кристаллов и открытой лавкой. Заходи, если понадобится материал.",
      },
    ];

    topics.forEach((topic) => {
      const div = document.createElement("div");
      div.className = "lina-talk-topic";
      div.innerHTML = `<strong class="lina-talk-topic-title">${topic.title}</strong>`;

      div.addEventListener("click", () => {
        topicsContainer.classList.add("hidden");

        const npcContent = dialogElement.querySelector(".npc-dialog-content");
        npcContent.innerHTML = `
          <div class="lina-fullscreen">
            <div class="lina-talk-text-content">${topic.text}</div>
          </div>
        `;
        closeBtn.onclick = () => showLinaTopics();
      });

      topicsContainer.appendChild(div);
    });

    function showLinaTopics() {
      const npcContent = dialogElement.querySelector(".npc-dialog-content");
      npcContent.innerHTML = `<div id="linaTalkTopics" class="lina-talk-topics"></div>`;

      const newTopicsContainer = document.getElementById("linaTalkTopics");
      topics.forEach((topic) => {
        const div = document.createElement("div");
        div.className = "lina-talk-topic";
        div.innerHTML = `<strong class="lina-talk-topic-title">${topic.title}</strong>`;
        div.addEventListener("click", () => {
          newTopicsContainer.classList.add("hidden");
          npcContent.innerHTML = `
            <div class="lina-fullscreen">
              <div class="lina-talk-text-content">${topic.text}</div>
            </div>
          `;
          closeBtn.onclick = () => showLinaTopics();
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
    dialogElement.className = "npc-dialog open lina-shop-dialog";
    dialogElement.dataset.npc = "lina-buy";
    dialogElement.style.backgroundImage = "url(linaBuy.png)";
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content lina-shop-content">
        <div id="linaShopGrid" class="lina-shop-grid"></div>
      </div>
      <div class="lina-shop-buttons">
        <input
          type="number"
          id="lina-buy-qty"
          class="lina-buy-qty-input"
          min="1"
          max="99"
          value="1"
          disabled
          hidden
        />
        <button class="lina-buy-confirm-btn" id="lina-shop-buy" disabled></button>
        <button class="neon-btn-ok" id="lina-shop-close"></button>
      </div>
    `;

    document.body.appendChild(dialogElement);

    const grid = document.getElementById("linaShopGrid");
    const buyBtn = document.getElementById("lina-shop-buy");
    const closeBtn = document.getElementById("lina-shop-close");
    const qtyInput = document.getElementById("lina-buy-qty");

    if (closeBtn) closeBtn.onclick = () => closeDialog();

    let selectedItemType = null;

    // Материалы для Торестоса (порядок как в ТЗ)
    const LINA_ITEMS = [
      "blue_crystal",
      "green_crystal",
      "red_crystal",
      "white_crystal",
      "yellow_crystal",
      "chameleon_crystal",
      "nanoalloy",
      "nanofilament",
    ];

    function getPrice(rarity) {
      if (rarity === 3) return 3;
      if (rarity === 2) return 6;
      if (rarity === 1) return 9;
      return 0;
    }

    // Сетка 2 колонки × 4 строки (8 предметов)
    const column1 = document.createElement("div");
    column1.className = "lina-shop-column";
    const column2 = document.createElement("div");
    column2.className = "lina-shop-column";

    LINA_ITEMS.forEach((type, idx) => {
      const cfg = typeof ITEM_CONFIG !== "undefined" ? ITEM_CONFIG[type] : null;
      if (!cfg) return;

      const price = getPrice(cfg.rarity);
      const itemEl = document.createElement("div");
      itemEl.className = "lina-shop-item";
      itemEl.dataset.type = type;

      let desc = cfg.description || type;
      if (window.i18n) {
        const tKey = "itemdesc_" + type;
        const translated = window.i18n.t(tKey);
        if (translated && translated !== tKey) desc = translated;
      }

      const imgSrc =
        cfg.image?.src ||
        (typeof images !== "undefined" && images[type + "Image"]?.src) ||
        type + ".png";

      itemEl.innerHTML = `
        <img src="${imgSrc}" alt="${type}" width="40" height="40">
        <div class="lina-shop-item-info">
          <div class="lina-shop-item-name">${desc}</div>
          <div class="lina-shop-item-price">${price} баляр</div>
        </div>
      `;

      itemEl.onclick = () => {
        grid.querySelectorAll(".lina-shop-item").forEach((el) => {
          el.classList.remove("selected");
        });
        itemEl.classList.add("selected");
        selectedItemType = type;
        buyBtn.disabled = false;

        // Показываем поле количества, сбрасываем в 1
        if (qtyInput) {
          qtyInput.hidden = false;
          qtyInput.disabled = false;
          qtyInput.value = "1";
        }
      };

      if (idx < 4) column1.appendChild(itemEl);
      else column2.appendChild(itemEl);
    });

    grid.appendChild(column1);
    grid.appendChild(column2);

    buyBtn.onclick = () => {
      if (!selectedItemType) return;

      // Клиент только предлагает quantity — сервер всё перепроверит
      let qty = 1;
      if (qtyInput) {
        const raw = Number(qtyInput.value);
        if (Number.isFinite(raw) && raw >= 1) {
          qty = Math.min(99, Math.floor(raw));
        }
        qtyInput.value = String(qty); // нормализуем отображение
      }

      if (typeof sendWhenReady === "function" && typeof ws !== "undefined") {
        sendWhenReady(
          ws,
          JSON.stringify({
            type: "buyFromLina",
            itemType: selectedItemType,
            quantity: qty,
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
    dialogElement.className = "npc-dialog open lina-sell-dialog";
    dialogElement.dataset.npc = "lina-sell";
    dialogElement.style.backgroundImage = "url(linaSell.png)";
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content lina-sell-content">
        <div id="linaSellGrid" class="lina-sell-grid"></div>
      </div>
      <div class="lina-sell-buttons">
        <button class="lina-sell-confirm-btn" id="lina-sell-confirm" disabled></button>
        <input
          type="number"
          id="lina-sell-qty"
          class="lina-sell-qty-input"
          min="1"
          max="99"
          value="1"
          disabled
          hidden
        />
        <button class="neon-btn-ok" id="lina-sell-close"></button>
      </div>
    `;

    document.body.appendChild(dialogElement);

    const grid = document.getElementById("linaSellGrid");
    const sellBtn = document.getElementById("lina-sell-confirm");
    const closeBtn = document.getElementById("lina-sell-close");
    const qtyInput = document.getElementById("lina-sell-qty");

    if (closeBtn) closeBtn.onclick = () => closeDialog();

    let selectedSlotIndex = null;

    const LINA_SELL_ITEMS = [
      "blue_crystal",
      "green_crystal",
      "red_crystal",
      "white_crystal",
      "yellow_crystal",
      "chameleon_crystal",
      "nanoalloy",
      "nanofilament",
      "mutant_bone",
      "scorpion_sting",
      "tears_of_a_bloody_eye",
    ];

    // Рисуем инвентарь (20 слотов)
    const inv = (typeof inventory !== "undefined" ? inventory : []) || [];
    for (let i = 0; i < 20; i++) {
      const slot = document.createElement("div");
      slot.className = "lina-sell-slot";
      slot.dataset.index = i;

      const item = inv[i];
      if (item) {
        const cfg =
          typeof ITEM_CONFIG !== "undefined" ? ITEM_CONFIG[item.type] : null;
        const img = document.createElement("img");
        img.src =
          cfg?.image?.src ||
          (typeof images !== "undefined" && images[item.type]?.src) ||
          item.type + ".png";
        img.width = 40;
        img.height = 40;
        slot.appendChild(img);

        if (item.quantity > 1) {
          const qty = document.createElement("div");
          qty.className = "lina-sell-qty";
          qty.textContent = item.quantity;
          slot.appendChild(qty);
        }
      }

      slot.onclick = () => {
        grid.querySelectorAll(".lina-sell-slot").forEach((el) => {
          el.classList.remove("selected");
        });
        slot.classList.add("selected");
        selectedSlotIndex = i;

        const itemType = inv[i]?.type;
        const isSellable = itemType && LINA_SELL_ITEMS.includes(itemType);
        sellBtn.disabled = !isSellable;

        if (qtyInput) {
          if (isSellable) {
            qtyInput.hidden = false;
            qtyInput.disabled = false;
            qtyInput.value = "1";
            // max = реальный стек (удобство UX, сервер всё равно перепроверит)
            const stackQty = Math.max(1, inv[i]?.quantity || 1);
            qtyInput.max = String(Math.min(99, stackQty));
          } else {
            qtyInput.hidden = true;
            qtyInput.disabled = true;
            qtyInput.value = "1";
          }
        }
      };

      grid.appendChild(slot);
    }

    // Кнопка Продать
    sellBtn.onclick = () => {
      if (selectedSlotIndex === null) return;
      const item = inv[selectedSlotIndex];
      if (!item || !LINA_SELL_ITEMS.includes(item.type)) return;

      // Клиент предлагает quantity; сервер — источник правды
      let qty = 1;
      if (qtyInput) {
        const raw = Number(qtyInput.value);
        if (Number.isFinite(raw) && raw >= 1) {
          qty = Math.min(99, Math.floor(raw));
        }
        qtyInput.value = String(qty);
      }

      const serverQty = Math.max(1, Number(item.quantity) || 1);
      if (qty > serverQty) {
        if (typeof showNotification === "function") {
          showNotification(
            "Не хватает материалов! Введи правильное число!",
            "#ff4444",
          );
        }
        return; // не отправляем на сервер
      }

      if (typeof sendWhenReady === "function" && typeof ws !== "undefined") {
        sendWhenReady(
          ws,
          JSON.stringify({
            type: "sellToLina",
            slotIndex: selectedSlotIndex,
            quantity: qty,
          }),
        );
      }
    };
  }

  // ─── Buttons ──────────────────────────────────────────────────────────
  function createButtons() {
    if (buttonsContainer) return;

    buttonsContainer = document.createElement("div");
    buttonsContainer.className = "lina-buttons-container";

    const configs = [
      { className: "lina-talk-btn", action: openTalkDialog },
      { className: "lina-buy-btn", action: openBuyDialog },
      { className: "lina-sell-btn", action: openSellDialog },
    ];

    configs.forEach((cfg) => {
      const btn = document.createElement("div");
      btn.className = "lina-button " + cfg.className;
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
    const screenX = LINA_CONFIG.x - cameraX + LINA_CONFIG.displayWidth / 2;
    const screenY = LINA_CONFIG.y - cameraY - 150;
    buttonsContainer.style.left = `${screenX * zoom}px`;
    buttonsContainer.style.top = `${screenY * zoom}px`;
  }

  // ─── Proximity ────────────────────────────────────────────────────────
  function checkProximity() {
    const me = typeof players !== "undefined" ? players.get(myId) : null;
    const currentWorldId = window.worldSystem?.currentWorldId;

    if (
      !me ||
      me.worldId !== LINA_CONFIG.worldId ||
      me.health <= 0 ||
      currentWorldId !== LINA_CONFIG.worldId
    ) {
      if (isNear) {
        isNear = false;
        removeButtons();
        closeDialog();
      }
      return;
    }

    const dx = me.x + 35 - (LINA_CONFIG.x + LINA_CONFIG.displayWidth / 2);
    const dy = me.y + 35 - (LINA_CONFIG.y + LINA_CONFIG.displayHeight / 2);
    const dist = Math.hypot(dx, dy);
    const nowNear = dist < LINA_CONFIG.interactionRadius;

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

    if (window.worldSystem.currentWorldId !== LINA_CONFIG.worldId) {
      return null;
    }

    return {
      id: "lina",
      type: "npc",
      x: LINA_CONFIG.x,
      y: LINA_CONFIG.y,
      worldId: LINA_CONFIG.worldId,
      sprite,
      frame: currentFrame,
      row: currentRow,
      frameCount: LINA_CONFIG.framesPerRow,
      frameWidth: LINA_CONFIG.frameWidth,
      frameHeight: LINA_CONFIG.frameHeight,
      displayWidth: LINA_CONFIG.displayWidth,
      displayHeight: LINA_CONFIG.displayHeight,
      visualType: "billboard",
    };
  }

  window.linaNpc = {
    initialize,
    update: tick,

    /** Возвращает текущую мировую позицию (для depth-sort) */
    getPosition() {
      return { x: LINA_CONFIG.x, y: LINA_CONFIG.y };
    },

    getRenderData,

    /** Чистый draw — вызывается из code.js после сортировки */
    drawSprite(camX, camY) {
      if (!initialized || !sprite || !sprite.complete) return;

      const worldId = window.worldSystem?.currentWorldId;
      if (worldId !== LINA_CONFIG.worldId) return;

      const screenX = LINA_CONFIG.x - camX;
      const screenY = LINA_CONFIG.y - camY;

      const canvas = document.getElementById("gameCanvas");
      if (!canvas) return;
      const dw = LINA_CONFIG.displayWidth;
      const dh = LINA_CONFIG.displayHeight;
      if (
        screenX < -dw - 20 ||
        screenX > canvas.width + 20 ||
        screenY < -dh - 20 ||
        screenY > canvas.height + 20
      ) {
        return;
      }

      const sx = currentFrame * LINA_CONFIG.frameWidth;
      const sy = currentRow * LINA_CONFIG.frameHeight;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        sprite,
        sx,
        sy,
        LINA_CONFIG.frameWidth,
        LINA_CONFIG.frameHeight,
        screenX,
        screenY,
        dw,
        dh,
      );

      // Nameplate
      const label = isMet ? "Lina" : "?";
      const labelX = screenX + dw * 0.5;
      const labelY = screenY - 12;

      ctx.font = "13px Arial";
      ctx.textAlign = "center";
      ctx.fillStyle = isMet ? "#ff9ecf" : "#ffffff";
      ctx.fillText(label, labelX, labelY);

      // Buttons follow camera
      updateButtonsPosition(camX, camY);
    },

    /** Старый draw оставляем для совместимости */
    draw() {
      const camera = window.movementSystem?.getCamera?.();
      if (!camera) return;
      this.drawSprite(camera.x, camera.y);
    },

    checkProximity,
    setMet,
    setLinaMet: setMet,
    config: LINA_CONFIG,
    resetAnimation,
    openSellDialog,
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
    window.sceneEntitySystem.registerNPCVisualProvider("lina", window.linaNpc);
  }
})();
