// madDoctor.js
// NPC madDoctor — отображение + анимация + знакомство + 3 кнопки + Банк крови
// 2 строки × 13 кадров 70×70, строка0 → строка1 → loop
// Senior-optimized: visibility pause, delta cap, zero alloc in hot path

(function () {
  "use strict";

  // === КОНФИГУРАЦИЯ ===
  const MAD_DOCTOR_CONFIG = {
    x: 2290,
    y: 3230,
    worldId: 0,
    interactionRadius: 50,

    frameWidth: 70,
    frameHeight: 70,
    framesPerRow: 13,

    displayWidth: 80,
    displayHeight: 90,

    rowSpeeds: {
      0: 120,
      1: 120,
    },
  };

  // Прайс (клиент только для отображения, сервер — источник правды)
  const MAD_DOCTOR_SHOP = [
    { type: "blood_pack", price: 10 },
    { type: "blood_syringe", price: 4 },
  ];

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

  const MAX_DELTA = 50;

  // === ИНИЦИАЛИЗАЦИЯ ===
  function initialize(spriteImage) {
    if (!spriteImage) {
      console.warn("[madDoctor] spriteImage is missing");
      return;
    }
    sprite = spriteImage;

    const canvas = document.getElementById("gameCanvas");
    if (canvas) ctx = canvas.getContext("2d");

    currentRow = 0;
    currentFrame = 0;
    frameTimer = 0;
    isMet = false;
    isNear = false;
    isDialogOpen = false;
    closeDialog();
    removeButtons();

    if (!registerMadDoctorVisual()) {
      console.warn("[madDoctor] NPC visual registration failed");
    }

    console.log("[madDoctor] initialized");
  }

  // === ОБНОВЛЕНИЕ АНИМАЦИИ ===
  function update(deltaTime) {
    if (document.hidden || !sprite || !sprite.complete) return;

    const dt = Math.min(deltaTime || 16.67, MAX_DELTA);
    frameTimer += dt;

    const speed = MAD_DOCTOR_CONFIG.rowSpeeds[currentRow] || 120;

    if (frameTimer >= speed) {
      frameTimer -= speed;
      currentFrame++;

      if (currentFrame >= MAD_DOCTOR_CONFIG.framesPerRow) {
        currentFrame = 0;
        currentRow = currentRow === 0 ? 1 : 0;
      }
    }

    checkProximity();
  }

  // === ОТРИСОВКА ===
  function drawSprite(camX, camY) {
    if (!sprite || !sprite.complete || !ctx) return;
    if (
      !window.worldSystem ||
      window.worldSystem.currentWorldId !== MAD_DOCTOR_CONFIG.worldId
    ) {
      return;
    }

    const screenX = MAD_DOCTOR_CONFIG.x - camX;
    const screenY = MAD_DOCTOR_CONFIG.y - camY;

    const margin = 120;
    if (
      screenX < -margin ||
      screenX > (window.innerWidth || 1920) + margin ||
      screenY < -margin ||
      screenY > (window.innerHeight || 1080) + margin
    ) {
      return;
    }

    const sx = currentFrame * MAD_DOCTOR_CONFIG.frameWidth;
    const sy = currentRow * MAD_DOCTOR_CONFIG.frameHeight;

    ctx.drawImage(
      sprite,
      sx,
      sy,
      MAD_DOCTOR_CONFIG.frameWidth,
      MAD_DOCTOR_CONFIG.frameHeight,
      screenX,
      screenY,
      MAD_DOCTOR_CONFIG.displayWidth,
      MAD_DOCTOR_CONFIG.displayHeight,
    );

    const label = isMet ? "Mad Doctor" : "?";
    const labelX = screenX + MAD_DOCTOR_CONFIG.displayWidth * 0.5;
    const labelY = screenY - 12;

    ctx.font = "13px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = isMet ? "#ff0000" : "#ffffff";
    ctx.fillText(label, labelX, labelY);

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
    dialogElement.className = "npc-dialog open mad-doctor-dialog";
    dialogElement.dataset.npc = "madDoctor-nodoc";
    dialogElement.style.backgroundImage = `url(madDoctorNoDoc.png)`;
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content"></div>
      <button class="mad-doctor-ok-btn" id="madDoctor-nodoc-ok"></button>
    `;

    document.body.appendChild(dialogElement);

    const okBtn = document.getElementById("madDoctor-nodoc-ok");
    if (okBtn) okBtn.onclick = () => closeDialog();
  }

  function openGreetingDialog() {
    if (isDialogOpen) return;
    isDialogOpen = true;
    document.body.classList.add("npc-dialog-active");

    dialogElement = document.createElement("div");
    dialogElement.className = "npc-dialog open mad-doctor-dialog";
    dialogElement.dataset.npc = "madDoctor-doc";
    dialogElement.style.backgroundImage = `url(madDoctorDoc.png)`;
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content"></div>
      <button class="mad-doctor-ok-btn" id="madDoctor-greeting-ok"></button>
    `;

    document.body.appendChild(dialogElement);

    const okBtn = document.getElementById("madDoctor-greeting-ok");
    if (okBtn) {
      okBtn.onclick = () => {
        if (typeof sendWhenReady === "function" && ws) {
          sendWhenReady(ws, JSON.stringify({ type: "meetMadDoctor" }));
        }
        closeDialog();
      };
    }
  }

  function openTalkDialog() {
    closeDialog();
    isDialogOpen = true;
    document.body.classList.add("npc-dialog-active");

    dialogElement = document.createElement("div");
    dialogElement.className = "npc-dialog open mad-doctor-dialog";
    dialogElement.dataset.npc = "madDoctor-talk";
    dialogElement.style.backgroundImage = `url(madDoctorTalk.png)`;
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content"></div>
      <button class="mad-doctor-ok-btn" id="madDoctor-talk-ok"></button>
    `;

    document.body.appendChild(dialogElement);

    const okBtn = document.getElementById("madDoctor-talk-ok");
    if (okBtn) okBtn.onclick = () => closeDialog();
  }

  // === БАНК КРОВИ (магазин как у Cristina) ===
  function openBloodBankDialog() {
    closeDialog();
    isDialogOpen = true;
    document.body.classList.add("npc-dialog-active");

    dialogElement = document.createElement("div");
    dialogElement.className =
      "npc-dialog open mad-doctor-dialog mad-doctor-shop-dialog";
    dialogElement.dataset.npc = "madDoctor-bloodbank";
    dialogElement.style.backgroundImage = `url(madDoctorBloodBank.png)`;
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content mad-doctor-shop-content">
        <div id="madDoctorShopGrid" class="mad-doctor-shop-grid"></div>
      </div>
      <div class="mad-doctor-shop-buttons">
        <button class="mad-doctor-buy-confirm-btn" id="madDoctor-shop-buy" disabled></button>
        <button class="mad-doctor-ok-btn" id="madDoctor-shop-close"></button>
      </div>
    `;

    document.body.appendChild(dialogElement);

    const grid = document.getElementById("madDoctorShopGrid");
    const buyBtn = document.getElementById("madDoctor-shop-buy");
    const closeBtn = document.getElementById("madDoctor-shop-close");

    if (closeBtn) closeBtn.onclick = () => closeDialog();

    let selectedItemType = null;

    MAD_DOCTOR_SHOP.forEach((entry) => {
      const cfg =
        typeof ITEM_CONFIG !== "undefined" ? ITEM_CONFIG[entry.type] : null;
      if (!cfg) return;

      const itemEl = document.createElement("div");
      itemEl.className = "mad-doctor-shop-item";
      itemEl.dataset.type = entry.type;

      let desc = cfg.description || entry.type;
      if (window.i18n) {
        const tKey = "itemdesc_" + entry.type;
        const translated = window.i18n.t(tKey);
        if (translated && translated !== tKey) desc = translated;
      }

      const imgSrc =
        (cfg.image && cfg.image.src) ||
        (typeof images !== "undefined" &&
          images[entry.type + "Image"] &&
          images[entry.type + "Image"].src) ||
        entry.type + ".png";

      itemEl.innerHTML = `
        <img src="${imgSrc}" alt="${entry.type}" width="48" height="48">
        <div class="mad-doctor-shop-item-info">
          <div class="mad-doctor-shop-item-name">${desc}</div>
          <div class="mad-doctor-shop-item-price">${entry.price} баляр</div>
        </div>
      `;

      itemEl.onclick = () => {
        grid.querySelectorAll(".mad-doctor-shop-item").forEach((el) => {
          el.classList.remove("selected");
        });
        itemEl.classList.add("selected");
        selectedItemType = entry.type;
        buyBtn.disabled = false;
      };

      grid.appendChild(itemEl);
    });

    buyBtn.onclick = () => {
      if (!selectedItemType) return;
      if (ws?.readyState === WebSocket.OPEN) {
        sendWhenReady(
          ws,
          JSON.stringify({
            type: "buyFromMadDoctor",
            itemType: selectedItemType,
          }),
        );
      }
    };
  }

  function openBloodDonationDialog() {
    closeDialog();
    isDialogOpen = true;
    document.body.classList.add("npc-dialog-active");

    dialogElement = document.createElement("div");
    dialogElement.className =
      "npc-dialog open mad-doctor-dialog mad-doctor-donation-dialog";
    dialogElement.dataset.npc = "madDoctor-blooddonation";
    dialogElement.style.backgroundImage = `url(madDoctorBloodDonation.png)`;
    dialogElement.style.backgroundSize = "cover";
    dialogElement.style.backgroundPosition = "center";

    dialogElement.innerHTML = `
      <div class="npc-dialog-content mad-doctor-donation-content">
        <div class="mad-doctor-donation-form">
          <label class="mad-doctor-donation-label" for="madDoctorDonationAmount">
          </label>
          <input
            type="number"
            id="madDoctorDonationAmount"
            class="mad-doctor-donation-input"
            value="10"
            min="10"
            step="10"
            inputmode="numeric"
          />
          <div class="mad-doctor-donation-hint">
          </div>
        </div>
      </div>
      <div class="mad-doctor-donation-buttons">
        <button class="mad-doctor-donate-btn" id="madDoctor-donate-confirm"></button>
        <button class="mad-doctor-cancel-btn" id="madDoctor-donate-cancel"></button>
      </div>
    `;

    document.body.appendChild(dialogElement);

    const amountInput = document.getElementById("madDoctorDonationAmount");
    const donateBtn = document.getElementById("madDoctor-donate-confirm");
    const cancelBtn = document.getElementById("madDoctor-donate-cancel");

    if (cancelBtn) cancelBtn.onclick = () => closeDialog();

    if (donateBtn) {
      donateBtn.onclick = () => {
        const raw = amountInput ? amountInput.value.trim() : "";
        const amount = Number(raw);

        // Клиентская валидация: целое, кратно 10, >= 10
        if (
          !Number.isFinite(amount) ||
          !Number.isInteger(amount) ||
          amount < 10 ||
          amount % 10 !== 0
        ) {
          if (typeof showNotification === "function") {
            showNotification(
              "Введите ровное десятичное число (10, 20, 30...)",
              "#ff5555",
            );
          }
          return;
        }

        if (ws?.readyState === WebSocket.OPEN) {
          sendWhenReady(
            ws,
            JSON.stringify({
              type: "donateBloodToMadDoctor",
              amount: amount,
            }),
          );
        }
      };
    }
  }

  // === КНОПКИ ===
  function createButtons() {
    if (buttonsContainer) return;

    buttonsContainer = document.createElement("div");
    buttonsContainer.className = "mad-doctor-buttons-container";

    const configs = [
      { className: "mad-doctor-talk-btn", action: openTalkDialog },
      { className: "mad-doctor-bloodbank-btn", action: openBloodBankDialog },
      {
        className: "mad-doctor-blooddonation-btn",
        action: openBloodDonationDialog,
      },
    ];

    configs.forEach((cfg) => {
      const btn = document.createElement("div");
      btn.className = "mad-doctor-button " + cfg.className;
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
      MAD_DOCTOR_CONFIG.x - cameraX + MAD_DOCTOR_CONFIG.displayWidth / 2;
    const screenY = MAD_DOCTOR_CONFIG.y - cameraY - 160;
    buttonsContainer.style.left = `${screenX * zoom}px`;
    buttonsContainer.style.top = `${screenY * zoom}px`;
  }

  // === PROXIMITY ===
  function checkProximity() {
    const me = players.get(myId);
    const currentWorldId = window.worldSystem?.currentWorldId;

    if (
      !me ||
      me.worldId !== MAD_DOCTOR_CONFIG.worldId ||
      me.health <= 0 ||
      currentWorldId !== MAD_DOCTOR_CONFIG.worldId
    ) {
      if (isNear) {
        isNear = false;
        removeButtons();
        closeDialog();
      }
      return;
    }

    const dx =
      me.x + 35 - (MAD_DOCTOR_CONFIG.x + MAD_DOCTOR_CONFIG.displayWidth / 2);
    const dy =
      me.y + 35 - (MAD_DOCTOR_CONFIG.y + MAD_DOCTOR_CONFIG.displayHeight / 2);
    const dist = Math.hypot(dx, dy);
    const nowNear = dist < MAD_DOCTOR_CONFIG.interactionRadius;

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
      if (isMet) {
        createButtons();
      } else {
        removeButtons();
      }
    }
  }

  const MAD_DOCTOR_SCENE_ID = "madDoctor";

  const madDoctorVisualProvider = Object.freeze({
    getRenderData() {
      if (
        !sprite ||
        !sprite.complete ||
        sprite.naturalWidth <= 0 ||
        sprite.naturalHeight <= 0
      ) {
        return null;
      }

      return {
        id: MAD_DOCTOR_SCENE_ID,
        type: "npc",
        worldId: MAD_DOCTOR_CONFIG.worldId,

        x: MAD_DOCTOR_CONFIG.x,
        y: MAD_DOCTOR_CONFIG.y,

        visual: {
          mode: "billboard",

          billboard: {
            sprite,

            frame: currentFrame,
            row: currentRow,
            frameCount: MAD_DOCTOR_CONFIG.framesPerRow,

            frameWidth: MAD_DOCTOR_CONFIG.frameWidth,
            frameHeight: MAD_DOCTOR_CONFIG.frameHeight,

            displayWidth: MAD_DOCTOR_CONFIG.displayWidth,
            displayHeight: MAD_DOCTOR_CONFIG.displayHeight,
          },
        },
      };
    },
  });

  function registerMadDoctorVisual() {
    const scene = window.sceneEntitySystem;

    if (!scene || typeof scene.registerNPCVisualProvider !== "function") {
      return false;
    }

    if (scene.getRegisteredNPCIds?.().includes(MAD_DOCTOR_SCENE_ID)) {
      return true;
    }

    return scene.registerNPCVisualProvider(
      MAD_DOCTOR_SCENE_ID,
      madDoctorVisualProvider,
    );
  }

  window.madDoctorSystem = {
    initialize,
    update,
    draw,

    getPosition() {
      return { x: MAD_DOCTOR_CONFIG.x, y: MAD_DOCTOR_CONFIG.y };
    },

    drawSprite(camX, camY) {
      drawSprite(camX, camY);
    },

    checkProximity,
    setMet,
    setMadDoctorMet: setMet,

    getConfig: () => ({ ...MAD_DOCTOR_CONFIG }),
    getState: () => ({
      isMet,
      isNear,
      currentRow,
      currentFrame,
    }),
  };
})();
