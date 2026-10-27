/**
 * Viktor NPC System
 * World 0 only. Display + nameplate + meet + buttons (Talk/Buy/Sell stubs)
 * Sprite: 3 rows × 13 frames × 70×70
 * Cycle: 20s row0 → 1× row1 → 20s row2 → 1× row1 → repeat
 * Tunable frame durations. Tab-safe delta clamping.
 */
(function () {
  "use strict";

  // ─── Tunable parameters ───────────────────────────────────────────────
  const VIKTOR_CONFIG = {
    worldId: 0,
    x: 2409,
    y: 830,
    interactionRadius: 50,

    frameWidth: 70,
    frameHeight: 70,
    framesPerRow: 13,

    displayWidth: 80,
    displayHeight: 90,

    frameDurationRow0: 220,
    frameDurationRow1: 180,
    frameDurationRow2: 220,

    phaseDurationRow0: 20_000,
    phaseDurationRow2: 20_000,

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

  // Animation
  let currentRow = 0;
  let currentFrame = 0;
  let frameAccum = 0;
  let phaseAccum = 0;
  let phase = 0; // 0=row0 long, 1=row1 once, 2=row2 long, 3=row1 once

  const ROW_DURATIONS = [
    VIKTOR_CONFIG.frameDurationRow0,
    VIKTOR_CONFIG.frameDurationRow1,
    VIKTOR_CONFIG.frameDurationRow2,
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

  function advancePhaseOnLoopComplete() {
    if (phase === 1 || phase === 3) {
      phaseAccum += 1;
      if (phaseAccum >= VIKTOR_CONFIG.row1LoopsBetween) {
        phaseAccum = 0;
        phase = (phase + 1) % 4;
        setRowForPhase();
      }
    }
  }

  function updateTimeBasedPhases(deltaTime) {
    if (phase !== 0 && phase !== 2) return;

    phaseAccum += deltaTime;
    const limit =
      phase === 0
        ? VIKTOR_CONFIG.phaseDurationRow0
        : VIKTOR_CONFIG.phaseDurationRow2;

    if (phaseAccum >= limit) {
      phaseAccum = 0;
      phase = (phase + 1) % 4;
      setRowForPhase();
    }
  }

  function update(deltaTime) {
    if (!initialized || !sprite || !sprite.complete) return;

    const worldId = window.worldSystem?.currentWorldId;
    if (worldId !== VIKTOR_CONFIG.worldId) return;

    const dt = Math.min(deltaTime, 50);

    frameAccum += dt;
    const frameDur = ROW_DURATIONS[currentRow] || 100;

    while (frameAccum >= frameDur) {
      frameAccum -= frameDur;
      currentFrame = (currentFrame + 1) % VIKTOR_CONFIG.framesPerRow;

      if (currentFrame === 0) {
        advancePhaseOnLoopComplete();
      }
    }

    updateTimeBasedPhases(dt);
  }

  function drawSprite(camX, camY) {
    if (!initialized || !sprite || !sprite.complete) return;

    const worldId = window.worldSystem?.currentWorldId;
    if (worldId !== VIKTOR_CONFIG.worldId) return;

    const screenX = VIKTOR_CONFIG.x - camX;
    const screenY = VIKTOR_CONFIG.y - camY;

    const canvas = document.getElementById("gameCanvas");
    if (!canvas) return;

    const dw = VIKTOR_CONFIG.displayWidth;
    const dh = VIKTOR_CONFIG.displayHeight;

    if (
      screenX < -dw - 20 ||
      screenX > canvas.width + 20 ||
      screenY < -dh - 20 ||
      screenY > canvas.height + 20
    ) {
      return;
    }

    const sx = currentFrame * VIKTOR_CONFIG.frameWidth;
    const sy = currentRow * VIKTOR_CONFIG.frameHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      sprite,
      sx,
      sy,
      VIKTOR_CONFIG.frameWidth,
      VIKTOR_CONFIG.frameHeight,
      screenX,
      screenY,
      dw,
      dh,
    );

    // Nameplate
    const label = isMet ? "Viktor" : "?";
    const labelX = screenX + dw * 0.5;
    const labelY = screenY - 12;

    ctx.font = "13px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = isMet ? "#7ec8ff" : "#ffffff";
    ctx.fillText(label, labelX, labelY);

    // Buttons follow camera
    updateButtonsPosition(camX, camY);
  }

  function draw() {
    const camera = window.movementSystem?.getCamera?.();
    if (!camera) return;
    drawSprite(camera.x, camera.y);
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
    dialogElement.dataset.npc = "viktor-nodoc";
    dialogElement.style.backgroundImage = "url(viktorNoDoc.png)";
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content"></div>
      <button class="neon-btn-ok" id="viktor-nodoc-ok"></button>
    `;

    document.body.appendChild(dialogElement);

    const okBtn = document.getElementById("viktor-nodoc-ok");
    if (okBtn) okBtn.onclick = () => closeDialog();
  }

  function openGreetingDialog() {
    if (isDialogOpen) return;
    isDialogOpen = true;
    document.body.classList.add("npc-dialog-active");

    dialogElement = document.createElement("div");
    dialogElement.className = "npc-dialog open";
    dialogElement.dataset.npc = "viktor-doc";
    dialogElement.style.backgroundImage = "url(viktorDoc.png)";
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content"></div>
      <button class="neon-btn-ok" id="viktor-greeting-ok"></button>
    `;

    document.body.appendChild(dialogElement);

    const okBtn = document.getElementById("viktor-greeting-ok");
    if (okBtn) {
      okBtn.onclick = () => {
        if (typeof sendWhenReady === "function" && typeof ws !== "undefined") {
          sendWhenReady(ws, JSON.stringify({ type: "meetViktor" }));
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
    dialogElement.dataset.npc = "viktor-talk";
    dialogElement.style.backgroundImage = "url(viktorTalk.png)";
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content">
        <div id="viktorTalkTopics" class="viktor-talk-topics"></div>
      </div>
      <button id="viktorCloseTalkBtn" class="neon-btn-thimblerigger"></button>
    `;

    document.body.appendChild(dialogElement);

    const topicsContainer = document.getElementById("viktorTalkTopics");
    const closeBtn = document.getElementById("viktorCloseTalkBtn");

    const topics = [
      {
        title: "О себе",
        text: "Меня зовут Viktor. Раньше работал на корпорацию — охрана, зачистки, ближний бой. Потом меня списали. Теперь я продаю то, чем сам когда-то пользовался. Кастеры, ножи, биты — всё проверено на себе.",
      },
      {
        title: "Об оружии",
        text: "Кастеры — быстро и жёстко. Нож — тихий и точный. Нанопоглощающий нож — уже серьёзнее, забирает часть энергии. Бита — когда нужно просто сломать. Выбирай под свой стиль, а не под моду.",
      },
      {
        title: "О Неоновом городе",
        text: "Город светится сверху и гниёт снизу. Здесь выживает тот, кто умеет бить первым и не светиться. Баляры решают многое, но кулак и сталь решают остальное.",
      },
      {
        title: "Советы сталкеру",
        text: "Не ходи голым. Даже простое оружие лучше пустых рук. Следи за дистанцией — ближний бой прощает одну ошибку. И никогда не показывай полный инвентарь незнакомцам.",
      },
      {
        title: "Почему именно это?",
        text: "Потому что целые пушки стоят как жизнь, а кастеры и ножи — как шанс. Я беру честно и выкупаю обратно дешевле. Если вернёшься живым — значит, выбор был правильным.",
      },
      {
        title: "Надежда",
        text: "Иногда думаю, что неон когда-нибудь погаснет. Пока же я здесь — с ящиком оружия и открытой лавкой. Заходи, если понадобится сталь. Или просто поговорить.",
      },
    ];

    topics.forEach((topic) => {
      const div = document.createElement("div");
      div.className = "viktor-talk-topic";
      div.innerHTML = `<strong class="viktor-talk-topic-title">${topic.title}</strong>`;

      div.addEventListener("click", () => {
        topicsContainer.classList.add("hidden");

        const npcContent = dialogElement.querySelector(".npc-dialog-content");
        npcContent.innerHTML = `
          <div class="viktor-fullscreen">
            <div class="viktor-talk-text-content">${topic.text}</div>
          </div>
        `;
        closeBtn.onclick = () => showViktorTopics();
      });

      topicsContainer.appendChild(div);
    });

    function showViktorTopics() {
      const npcContent = dialogElement.querySelector(".npc-dialog-content");
      npcContent.innerHTML = `<div id="viktorTalkTopics" class="viktor-talk-topics"></div>`;

      const newTopicsContainer = document.getElementById("viktorTalkTopics");
      topics.forEach((topic) => {
        const div = document.createElement("div");
        div.className = "viktor-talk-topic";
        div.innerHTML = `<strong class="viktor-talk-topic-title">${topic.title}</strong>`;
        div.addEventListener("click", () => {
          newTopicsContainer.classList.add("hidden");
          npcContent.innerHTML = `
            <div class="viktor-fullscreen">
              <div class="viktor-talk-text-content">${topic.text}</div>
            </div>
          `;
          closeBtn.onclick = () => showViktorTopics();
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
    dialogElement.className = "npc-dialog open viktor-shop-dialog";
    dialogElement.dataset.npc = "viktor-buy";
    dialogElement.style.backgroundImage = "url(viktorBuy.png)";
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
    <div class="npc-dialog-content viktor-shop-content">
      <div id="viktorShopGrid" class="viktor-shop-grid"></div>
    </div>
    <div class="viktor-shop-buttons">
      <button class="viktor-buy-confirm-btn" id="viktor-shop-buy" disabled></button>
      <button class="neon-btn-ok" id="viktor-shop-close"></button>
    </div>
  `;

    document.body.appendChild(dialogElement);

    const grid = document.getElementById("viktorShopGrid");
    const buyBtn = document.getElementById("viktor-shop-buy");
    const closeBtn = document.getElementById("viktor-shop-close");

    if (closeBtn) closeBtn.onclick = () => closeDialog();

    let selectedItemType = null;

    const VIKTOR_ITEMS = [
      { type: "knuckles", price: 70 },
      { type: "knife", price: 90 },
      { type: "nano_absorbing_knife", price: 150 },
      { type: "bat", price: 150 },
    ];

    // 2 колонки × 2 строки
    const column1 = document.createElement("div");
    column1.className = "viktor-shop-column";
    const column2 = document.createElement("div");
    column2.className = "viktor-shop-column";

    VIKTOR_ITEMS.forEach((entry, idx) => {
      const type = entry.type;
      const price = entry.price;
      const cfg = typeof ITEM_CONFIG !== "undefined" ? ITEM_CONFIG[type] : null;
      if (!cfg) return;

      const itemEl = document.createElement("div");
      itemEl.className = "viktor-shop-item";
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
      <div class="viktor-shop-item-info">
        <div class="viktor-shop-item-name">${desc}</div>
        <div class="viktor-shop-item-price">${price} баляр</div>
      </div>
    `;

      itemEl.onclick = () => {
        grid.querySelectorAll(".viktor-shop-item").forEach((el) => {
          el.classList.remove("selected");
        });
        itemEl.classList.add("selected");
        selectedItemType = type;
        buyBtn.disabled = false;
      };

      if (idx < 2) column1.appendChild(itemEl);
      else column2.appendChild(itemEl);
    });

    grid.appendChild(column1);
    grid.appendChild(column2);

    buyBtn.onclick = () => {
      if (!selectedItemType) return;
      if (typeof sendWhenReady === "function" && typeof ws !== "undefined") {
        sendWhenReady(
          ws,
          JSON.stringify({
            type: "buyFromViktor",
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
    dialogElement.className = "npc-dialog open viktor-sell-dialog";
    dialogElement.dataset.npc = "viktor-sell";
    dialogElement.style.backgroundImage = "url(viktorSell.png)";
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
    <div class="npc-dialog-content viktor-sell-content">
      <div id="viktorSellGrid" class="viktor-sell-grid"></div>
    </div>
    <div class="viktor-sell-buttons">
      <button class="viktor-sell-confirm-btn" id="viktor-sell-confirm" disabled></button>
      <button class="neon-btn-ok" id="viktor-sell-close"></button>
    </div>
  `;

    document.body.appendChild(dialogElement);

    const grid = document.getElementById("viktorSellGrid");
    const sellBtn = document.getElementById("viktor-sell-confirm");
    const closeBtn = document.getElementById("viktor-sell-close");

    if (closeBtn) closeBtn.onclick = () => closeDialog();

    let selectedSlotIndex = null;

    // Рисуем инвентарь (20 слотов)
    const inv = (typeof inventory !== "undefined" ? inventory : []) || [];
    for (let i = 0; i < 20; i++) {
      const slot = document.createElement("div");
      slot.className = "viktor-sell-slot";
      slot.dataset.index = i;

      const item = inv[i];
      if (item) {
        const cfg =
          typeof ITEM_CONFIG !== "undefined" ? ITEM_CONFIG[item.type] : null;
        const img = document.createElement("img");
        img.src =
          cfg?.image?.src ||
          (typeof images !== "undefined" && images[item.type + "Image"]?.src) ||
          item.type + ".png";
        img.width = 40;
        img.height = 40;
        slot.appendChild(img);

        if (item.quantity > 1) {
          const qty = document.createElement("div");
          qty.className = "viktor-sell-qty";
          qty.textContent = item.quantity;
          slot.appendChild(qty);
        }
      }

      slot.onclick = () => {
        grid.querySelectorAll(".viktor-sell-slot").forEach((el) => {
          el.classList.remove("selected");
        });
        slot.classList.add("selected");
        selectedSlotIndex = i;

        // Активируем кнопку только для оружия Viktor
        const itemType = inv[i]?.type;
        const isViktorWeapon =
          itemType === "knuckles" ||
          itemType === "knife" ||
          itemType === "nano_absorbing_knife" ||
          itemType === "bat";
        sellBtn.disabled = !isViktorWeapon;
      };

      grid.appendChild(slot);
    }

    // Кнопка Продать
    sellBtn.onclick = () => {
      if (selectedSlotIndex === null) return;
      const item = inv[selectedSlotIndex];
      if (
        !item ||
        !(
          item.type === "knuckles" ||
          item.type === "knife" ||
          item.type === "nano_absorbing_knife" ||
          item.type === "bat"
        )
      )
        return;

      if (typeof sendWhenReady === "function" && typeof ws !== "undefined") {
        sendWhenReady(
          ws,
          JSON.stringify({
            type: "sellToViktor",
            slotIndex: selectedSlotIndex,
          }),
        );
      }
      // Диалог оставляем открытым — после ответа сервера сетка обновится
    };
  }

  // ─── Buttons ──────────────────────────────────────────────────────────
  function createButtons() {
    if (buttonsContainer) return;

    buttonsContainer = document.createElement("div");
    buttonsContainer.className = "viktor-buttons-container";

    const configs = [
      { className: "viktor-talk-btn", action: openTalkDialog },
      { className: "viktor-buy-btn", action: openBuyDialog },
      { className: "viktor-sell-btn", action: openSellDialog },
    ];

    configs.forEach((cfg) => {
      const btn = document.createElement("div");
      btn.className = "viktor-button " + cfg.className;
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
    const screenX = VIKTOR_CONFIG.x - cameraX + VIKTOR_CONFIG.displayWidth / 2;
    const screenY = VIKTOR_CONFIG.y - cameraY - 150;
    buttonsContainer.style.left = `${screenX * zoom}px`;
    buttonsContainer.style.top = `${screenY * zoom}px`;
  }

  // ─── Proximity ────────────────────────────────────────────────────────
  function checkProximity() {
    const me = typeof players !== "undefined" ? players.get(myId) : null;
    const currentWorldId = window.worldSystem?.currentWorldId;

    if (
      !me ||
      me.worldId !== VIKTOR_CONFIG.worldId ||
      me.health <= 0 ||
      currentWorldId !== VIKTOR_CONFIG.worldId
    ) {
      if (isNear) {
        isNear = false;
        removeButtons();
        closeDialog();
      }
      return;
    }

    const dx = me.x + 35 - (VIKTOR_CONFIG.x + VIKTOR_CONFIG.displayWidth / 2);
    const dy = me.y + 35 - (VIKTOR_CONFIG.y + VIKTOR_CONFIG.displayHeight / 2);
    const dist = Math.hypot(dx, dy);
    const nowNear = dist < VIKTOR_CONFIG.interactionRadius;

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

    if (window.worldSystem.currentWorldId !== VIKTOR_CONFIG.worldId) {
      return null;
    }

    return {
      id: "viktor",
      type: "npc",
      x: VIKTOR_CONFIG.x,
      y: VIKTOR_CONFIG.y,
      worldId: VIKTOR_CONFIG.worldId,
      sprite,
      frame: currentFrame,
      row: currentRow,
      frameCount: VIKTOR_CONFIG.framesPerRow,
      frameWidth: VIKTOR_CONFIG.frameWidth,
      frameHeight: VIKTOR_CONFIG.frameHeight,
      displayWidth: VIKTOR_CONFIG.displayWidth,
      displayHeight: VIKTOR_CONFIG.displayHeight,
      visualType: "billboard",
    };
  }

  window.viktorNpc = {
    initialize,
    update,
    draw,

    getPosition() {
      return { x: VIKTOR_CONFIG.x, y: VIKTOR_CONFIG.y };
    },

    getRenderData,

    drawSprite(camX, camY) {
      drawSprite(camX, camY);
    },

    checkProximity,
    setMet,
    setViktorMet: setMet,
    config: VIKTOR_CONFIG,
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
    window.sceneEntitySystem.registerNPCVisualProvider(
      "viktor",
      window.viktorNpc,
    );
  }
})();
