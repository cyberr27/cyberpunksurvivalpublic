// misterTwister.js — улучшено обновление баланса в реальном времени

const MISTER_TWISTER_POS = {
  x: 1172,
  y: 3620,
  width: 70,
  height: 100,
};

const CONFIG = {
  frameCount: 13,
  frameWidth: 70,
  frameHeight: 100,
  animationDuration: 5000,
  pauseDuration: 10000,
  interactionRadiusSq: 4900,
};

const SLOT_SPRITE = {
  src: "mister_twister_slot_sprite.png",
  frameWidth: 70,
  frameHeight: 70,
  frameCount: 10,
};

let sprite = null;
let slotSprite = null;
let spriteReady = false;
let slotSpriteReady = false;
let animationStart = 0;
let isMenuOpen = false;
let menuElement = null;
let wasInRangeLastFrame = false;

let isSpinning = false;

function initializeMisterTwister() {
  sprite = new Image();
  sprite.src = "mister_twister.png";
  sprite.onload = () => {
    spriteReady = true;
  };

  slotSprite = new Image();
  slotSprite.src = SLOT_SPRITE.src;
  slotSprite.onload = () => {
    slotSpriteReady = true;
  };

  animationStart = performance.now();
}

function checkMisterTwisterProximity() {
  if (window.worldSystem.currentWorldId !== 0) {
    if (isMenuOpen) hideTwisterMenu();
    wasInRangeLastFrame = false;
    return;
  }

  const me = players.get(myId);
  if (!me) return;

  const dx = me.x + 35 - (MISTER_TWISTER_POS.x + 35);
  const dy = me.y + 50 - (MISTER_TWISTER_POS.y + 50);

  const nowInRange = dx * dx + dy * dy < CONFIG.interactionRadiusSq;

  if (nowInRange !== wasInRangeLastFrame) {
    nowInRange ? showTwisterMenu() : hideTwisterMenu();
  }

  wasInRangeLastFrame = nowInRange;
}

function updateLocalBalanceDisplay(count = null) {
  if (!isMenuOpen) return;

  const el = document.getElementById("twister-balance");
  if (!el) return;

  let realCount;

  if (count !== null) {
    realCount = count;
  } else {
    // Сначала пытаемся взять из глобального инвентаря (самый надёжный источник)
    const invCount =
      window.inventory?.find((s) => s?.type === "balyary")?.quantity || 0;
    if (invCount > 0) {
      realCount = invCount;
    } else {
      // fallback — из локального объекта игрока
      const me = players.get(myId);
      realCount =
        me?.inventory?.find((s) => s?.type === "balyary")?.quantity || 0;
    }
  }

  el.textContent = realCount;
  el.dataset.count = realCount;
}

function showTwisterMenu() {
  if (isMenuOpen) return;
  isMenuOpen = true;

  menuElement = document.createElement("div");
  menuElement.className = "npc-dialog open twister-full-window";

  menuElement.innerHTML = `
    <div class="npc-dialog-content-mt" style="overflow: hidden;">
      <!-- Скрытый элемент баланса — нужен для логики, визуально не показывается -->
      <span id="twister-balance" style="display:none;" data-count="0">0</span>

      <div class="digital-slots">
        <div class="digital-reel" id="reel1"><canvas width="70" height="70"></canvas></div>
        <div class="digital-reel" id="reel2"><canvas width="70" height="70"></canvas></div>
        <div class="digital-reel" id="reel3"><canvas width="70" height="70"></canvas></div>
      </div>

      <button class="spin-button-mt" id="twister-spin-btn"></button>

      <p id="twister-result"></p>
    </div>

    <div class="bonus-lights" id="bonus-lights">
      <div class="bonus-light bonus-light-0"></div>
      <div class="bonus-light bonus-light-1"></div>
      <div class="bonus-light bonus-light-2"></div>
      <div class="bonus-light bonus-light-3"></div>
      <div class="bonus-light bonus-light-4"></div>
      <div class="bonus-light bonus-light-5"></div>
      <div class="bonus-light bonus-light-6"></div>
      <div class="bonus-light bonus-light-7"></div>
      <div class="bonus-light bonus-light-8"></div>
      <div class="bonus-light bonus-light-9"></div>
      <div class="bonus-light bonus-light-10"></div>
    </div>
  `;

  document.body.appendChild(menuElement);

  // Перехватываем обновление инвентаря глобально
  const original = window.inventorySystem.updateInventoryDisplay;
  window.inventorySystem.updateInventoryDisplay = function (...args) {
    original.apply(this, args);
    if (isMenuOpen) updateLocalBalanceDisplay();
  };

  updateLocalBalanceDisplay();

  document
    .getElementById("twister-spin-btn")
    ?.addEventListener("click", handleTwisterSpin);

  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "twister", subtype: "getState" }));
  }
}

function hideTwisterMenu() {
  if (!isMenuOpen) return;
  isMenuOpen = false;
  menuElement?.remove();
  menuElement = null;
  isSpinning = false;
}

function handleTwisterSpin() {
  if (isSpinning) return;

  const balance =
    Number(document.getElementById("twister-balance")?.dataset.count) || 0;
  if (balance < 1) {
    if (typeof window.showNotification === "function") {
      window.showNotification("Недостаточно баляров!", "#ff6666");
    }
    return;
  }

  isSpinning = true;
  const btn = document.getElementById("twister-spin-btn");
  btn.disabled = true;

  const resultEl = document.getElementById("twister-result");
  resultEl.textContent = "";
  resultEl.style.color = "#e0e0e0";

  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "twister", subtype: "spin" }));
  }
}

function animateReels(finalFrames, winAmount = 0, isBonusWin = false) {
  if (!slotSpriteReady || !slotSprite?.complete) {
    if (typeof window.showNotification === "function") {
      window.showNotification("Ошибка спрайта...", "#ff6666");
    }
    isSpinning = false;
    document.getElementById("twister-spin-btn").disabled = false;
    return;
  }

  const canvases = [
    document.querySelector("#reel1 canvas"),
    document.querySelector("#reel2 canvas"),
    document.querySelector("#reel3 canvas"),
  ];

  const ctxs = canvases.map((c) => c.getContext("2d"));

  const TOTAL_DURATION = 5000;
  const SLOWDOWN_FROM = 3200;
  const BASE_SPEED = 0.32;

  let start = performance.now();

  function drawOneReel(ctx, elapsed) {
    ctx.clearRect(0, 0, 70, 70);

    let speed = BASE_SPEED;
    if (elapsed > SLOWDOWN_FROM) {
      const t = (elapsed - SLOWDOWN_FROM) / (TOTAL_DURATION - SLOWDOWN_FROM);
      speed *= 1 - t * 0.94;
    }

    const pos = (elapsed * speed) % SLOT_SPRITE.frameCount;
    const frame = Math.floor(pos);

    ctx.drawImage(
      slotSprite,
      frame * SLOT_SPRITE.frameWidth,
      0,
      SLOT_SPRITE.frameWidth,
      SLOT_SPRITE.frameHeight,
      0,
      0,
      70,
      70,
    );
  }

  function loop() {
    const elapsed = performance.now() - start;

    ctxs.forEach((ctx) => drawOneReel(ctx, elapsed));

    if (elapsed < TOTAL_DURATION) {
      requestAnimationFrame(loop);
    } else {
      // Финальная отрисовка
      ctxs.forEach((ctx, i) => {
        ctx.clearRect(0, 0, 70, 70);
        ctx.drawImage(
          slotSprite,
          finalFrames[i] * SLOT_SPRITE.frameWidth,
          0,
          SLOT_SPRITE.frameWidth,
          SLOT_SPRITE.frameHeight,
          0,
          0,
          70,
          70,
        );
      });

      const resultEl = document.getElementById("twister-result");

      // В окне всегда только число
      resultEl.textContent = winAmount > 0 ? winAmount : "0";
      resultEl.style.color = "#ff0000";

      // Все текстовые сообщения — только через showNotification
      if (winAmount > 0 && typeof window.showNotification === "function") {
        if (isBonusWin) {
          window.showNotification(
            `БОЛЬШОЙ ДЖЕКПОТ! +${winAmount} баляров!`,
            "#ffff00",
          );
        } else {
          window.showNotification(`${winAmount} баляров!`, "#ffff00");
        }
      }

      isSpinning = false;
      const btn = document.getElementById("twister-spin-btn");
      if (btn) btn.disabled = false;

      // Обновляем баланс сразу после остановки барабанов
      updateLocalBalanceDisplay();
    }
  }

  requestAnimationFrame(loop);
}

function updateTwisterState(data) {
  if (!isMenuOpen) return;

  console.log("[Twister CLIENT] Получен state:", data);

  // Баланс — всегда обновляем, если пришёл
  if (data.balance !== undefined) {
    const el = document.getElementById("twister-balance");
    if (el) {
      el.textContent = data.balance;
      el.dataset.count = data.balance;
    }
    // Дополнительно синхронизируем глобальный инвентарь, если меню открыто
    if (isMenuOpen) {
      updateLocalBalanceDisplay(data.balance);
    }
  }

  // Бонус-лампочки
  const points = Math.min(11, data.bonusPoints ?? 0);

  for (let i = 0; i < 11; i++) {
    const el = document.querySelector(`.bonus-light-${i}`);
    if (el) el.classList.remove("active");
  }

  for (let i = 0; i < points; i++) {
    const el = document.querySelector(`.bonus-light-${i}`);
    if (el) el.classList.add("active");
  }

  const resultEl = document.getElementById("twister-result");

  if (data.error) {
    if (typeof window.showNotification === "function") {
      window.showNotification(data.error, "#ff6666");
    }
    // В окне ничего не пишем — оставляем чистое / предыдущее число
    isSpinning = false;
    const btn = document.getElementById("twister-spin-btn");
    if (btn) btn.disabled = false;
    return;
  }

  if (data.shouldAnimate && data.symbols) {
    const match = data.symbols.match(/^(\d)\s+(\d)\s+(\d)$/);
    if (match) {
      const frames = [Number(match[1]), Number(match[2]), Number(match[3])];
      const win = Number(data.winAmount) || 0;
      const isBonus = data.subtype === "bonusWin";
      animateReels(frames, win, isBonus);
    }
  } else if (!data.shouldAnimate) {
    resultEl.textContent = "";
  }
}

function handleTwisterMessage(data) {
  switch (data.subtype) {
    case "state":
    case "spinResult":
    case "bonusWin":
      updateTwisterState(data);
      break;
    default:
      console.warn("Неизвестный подтип twister:", data.subtype);
  }
}

function drawMisterTwister() {
  if (window.worldSystem.currentWorldId !== 0) return;
  if (!spriteReady || !sprite?.complete) return;

  const cam = window.movementSystem.getCamera();
  const sx = MISTER_TWISTER_POS.x - cam.x;
  const sy = MISTER_TWISTER_POS.y - cam.y;

  if (
    sx + 100 < 0 ||
    sx > canvas.width + 40 ||
    sy + 140 < 0 ||
    sy > canvas.height + 40
  )
    return;

  const now = performance.now();
  const cycle = CONFIG.animationDuration + CONFIG.pauseDuration;
  const t = (now - animationStart) % cycle;

  let frame = 0;
  if (t < CONFIG.animationDuration) {
    frame = Math.floor((t * CONFIG.frameCount) / CONFIG.animationDuration);
  }

  ctx.drawImage(
    sprite,
    frame * CONFIG.frameWidth,
    0,
    CONFIG.frameWidth,
    CONFIG.frameHeight,
    sx,
    sy,
    MISTER_TWISTER_POS.width + 10,
    MISTER_TWISTER_POS.height + 10,
  );
}

function getMisterTwisterRenderData() {
  if (
    window.worldSystem?.currentWorldId !== 0 ||
    !spriteReady ||
    !sprite?.complete ||
    sprite.naturalWidth <= 0 ||
    sprite.naturalHeight <= 0
  ) {
    return null;
  }

  // Используем ту же формулу анимации,
  // что и в оригинальном drawMisterTwister().
  const now = performance.now();

  const cycle = CONFIG.animationDuration + CONFIG.pauseDuration;

  const t = (now - animationStart) % cycle;

  let frame = 0;

  if (t < CONFIG.animationDuration) {
    frame = Math.floor((t * CONFIG.frameCount) / CONFIG.animationDuration);
  }

  // Защита от выхода за границы спрайт-листа.
  frame = Math.max(0, Math.min(CONFIG.frameCount - 1, frame));

  return {
    id: "misterTwister",
    type: "npc",
    visualType: "billboard",

    // Те же координаты, что используются
    // в оригинальной 2D-отрисовке.
    x: MISTER_TWISTER_POS.x,
    y: MISTER_TWISTER_POS.y,

    worldId: 0,

    sprite,

    frame,
    row: 0,

    frameCount: CONFIG.frameCount,
    frameWidth: CONFIG.frameWidth,
    frameHeight: CONFIG.frameHeight,

    displayWidth: MISTER_TWISTER_POS.width + 10,
    displayHeight: MISTER_TWISTER_POS.height + 10,
  };
}

window.misterTwister = {
  initialize: initializeMisterTwister,
  checkProximity: checkMisterTwisterProximity,
  draw: drawMisterTwister,

  // Данные для общего 3D billboard-рендерера.
  getRenderData: getMisterTwisterRenderData,

  hideMenu: hideTwisterMenu,
  handleMessage: handleTwisterMessage,
};

(function registerMisterTwisterVisualProvider() {
  "use strict";

  function registerMisterTwister3D() {
    const scene = window.sceneEntitySystem;
    const twister = window.misterTwister;

    if (
      typeof scene?.registerNPCVisualProvider !== "function" ||
      typeof scene?.getRegisteredNPCIds !== "function" ||
      typeof twister?.getRenderData !== "function"
    ) {
      console.error(
        "[MisterTwister3D] Required visual provider API is unavailable.",
      );

      return false;
    }

    const id = "misterTwister";

    // Не допускаем повторной регистрации.
    if (scene.getRegisteredNPCIds().includes(id)) {
      return true;
    }

    // ВАЖНО: реестр Copilot принимает объект,
    // содержащий метод getRenderData().
    const success = scene.registerNPCVisualProvider(id, {
      getRenderData() {
        return twister.getRenderData();
      },
    });

    if (!success) {
      console.error("[MisterTwister3D] Failed to register visual provider.");
      return false;
    }

    console.log("[MisterTwister3D] Visual provider registered successfully.");

    return true;
  }

  // Регистрируем сразу, если реестр доступен.
  if (!registerMisterTwister3D()) {
    window.addEventListener("load", registerMisterTwister3D, { once: true });
  }
})();
