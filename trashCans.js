// trashCans.js — ИСПРАВЛЕНО + доработано под сервер

const TRASH_POSITIONS = [
  { x: 730, y: 3860 },
  { x: 2200, y: 1005 },
  { x: 3480, y: 3665 },
  { x: 4070, y: 935 },
  { x: 1777, y: 1005 },
  { x: 1331, y: 2170 },
];

const TRASH_CONFIG = {
  FRAME_COUNT: 13,
  FRAME_SIZE: 70,
  FRAME_DURATION: 250,
  INTERACTION_RADIUS_SQ: 3000,
};

let trashSprite = null;
let trashSpriteReady = false;
let globalTrashTime = 0;

let currentTrashIndex = -1;
let trashDialog = null;
window._trashJustOpenedAt = 0;
const TRASH_SUCCESS_COOLDOWN_MS = 4500;

window.trashCansState = Array(6)
  .fill(null)
  .map(() => ({
    guessed: false,
    isOpened: false,
  }));

function initializeTrashCans(sprite) {
  trashSprite = sprite;
  trashSpriteReady = sprite?.complete;
}

function updateTrashCans(deltaTime) {
  if (window.worldSystem.currentWorldId !== 0) {
    closeTrashDialog();
    return;
  }
  globalTrashTime += deltaTime;

  const me = players.get(myId);
  if (!me || window.worldSystem.currentWorldId !== 0) {
    closeTrashDialog();
    return;
  }

  let nearest = -1;
  let minDistSq = Infinity;

  TRASH_POSITIONS.forEach((pos, idx) => {
    const dx = me.x - pos.x;
    const dy = me.y - pos.y;
    const d2 = dx * dx + dy * dy;

    if (d2 < minDistSq) {
      minDistSq = d2;
      nearest = idx;
    }

    if (d2 <= TRASH_CONFIG.INTERACTION_RADIUS_SQ) {
      // Не пытаемся открыть, если только что успешно угадали
      if (
        window._trashJustOpenedAt &&
        Date.now() - window._trashJustOpenedAt < TRASH_SUCCESS_COOLDOWN_MS
      ) {
        // пропускаем
      } else if (currentTrashIndex !== idx) {
        openTrashDialog(idx);
      }
    }
  });

  if (minDistSq > TRASH_CONFIG.INTERACTION_RADIUS_SQ) {
    closeTrashDialog();
  }
}

function openTrashDialog(index) {
  if (window.worldSystem.currentWorldId !== 0) return;

  // Не открываем диалог сразу после успешного угадывания
  if (
    window._trashJustOpenedAt &&
    Date.now() - window._trashJustOpenedAt < TRASH_SUCCESS_COOLDOWN_MS
  ) {
    return;
  }

  if (currentTrashIndex === index && trashDialog) return;
  closeTrashDialog();

  currentTrashIndex = index;

  trashDialog = document.createElement("div");
  trashDialog.id = "trashCanDialog";
  trashDialog.className = "trash-dialog open";

  trashDialog.innerHTML = `
    <div class="trash-header"></div>
    
    <div class="trash-card-area">
      <div class="card-back" id="cardBack">?</div>
    </div>

    <div class="trash-suits">
      <button class="suit-btn spades"   data-suit="spades"></button>
      <button class="suit-btn hearts"   data-suit="hearts"></button>
      <button class="suit-btn diamonds" data-suit="diamonds"></button>
      <button class="suit-btn clubs"    data-suit="clubs"></button>
    </div>

    <div class="trash-message" id="trashMessage"></div>
  `;

  document.body.appendChild(trashDialog);
  document.body.classList.add("trash-dialog-active");
  showNotification(`Угадаешь масть?`, "#b3ff00");

  trashDialog.querySelectorAll(".suit-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const suit = btn.dataset.suit;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "trashGuess",
            trashIndex: currentTrashIndex,
            suit,
          }),
        );
      }
    });
  });

  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "getTrashState",
        trashIndex: currentTrashIndex,
      }),
    );
  }
}

function closeTrashDialog() {
  if (trashDialog) {
    trashDialog.remove();
    trashDialog = null;
  }
  document.body.classList.remove("trash-dialog-active");
  currentTrashIndex = -1;
}

function drawTrashCanSprite(camX, camY, index) {
  if (window.worldSystem.currentWorldId !== 0) return;
  if (!trashSpriteReady || !trashSprite?.complete) return;

  const pos = TRASH_POSITIONS[index];
  if (!pos) return;

  const { x, y } = pos;
  const sx = (x - camX) | 0;
  const sy = (y - camY) | 0;

  // простой куллинг
  if (
    sx < -100 ||
    sx > canvas.width + 100 ||
    sy < -100 ||
    sy > canvas.height + 100
  ) {
    return;
  }

  const state = window.trashCansState[index] || {};
  const isOpened = state.isOpened === true || state.guessed === true;

  const frame = isOpened
    ? 0
    : Math.floor(
        (globalTrashTime + index * 987) / TRASH_CONFIG.FRAME_DURATION,
      ) % TRASH_CONFIG.FRAME_COUNT;

  ctx.drawImage(
    trashSprite,
    frame * TRASH_CONFIG.FRAME_SIZE,
    0,
    TRASH_CONFIG.FRAME_SIZE,
    TRASH_CONFIG.FRAME_SIZE,
    sx - 20,
    sy - 25,
    40,
    50,
  );
}

function drawTrashCans(ctx) {
  if (window.worldSystem.currentWorldId !== 0) return;
  if (!trashSpriteReady || !trashSprite?.complete) return;

  const cam = window.movementSystem.getCamera();
  for (let i = 0; i < TRASH_POSITIONS.length; i++) {
    drawTrashCanSprite(cam.x, cam.y, i);
  }
}

function getTrashCanRenderData(index) {
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= TRASH_POSITIONS.length ||
    window.worldSystem?.currentWorldId !== 0 ||
    !trashSpriteReady ||
    !trashSprite?.complete ||
    trashSprite.naturalWidth <= 0 ||
    trashSprite.naturalHeight <= 0
  ) {
    return null;
  }

  const pos = TRASH_POSITIONS[index];

  const state = window.trashCansState[index] || {};

  const isOpened = state.isOpened === true || state.guessed === true;

  // Полностью повторяем анимацию из drawTrashCanSprite().
  const frame = isOpened
    ? 0
    : Math.floor(
        (globalTrashTime + index * 987) / TRASH_CONFIG.FRAME_DURATION,
      ) % TRASH_CONFIG.FRAME_COUNT;

  return {
    id: `trashCan_${index}`,
    type: "npc",
    visualType: "billboard",

    // В оригинале drawSprite() смещает изображение
    // на 20 px влево и на 25 px вверх.
    x: pos.x - 20,
    y: pos.y - 25,

    worldId: 0,

    sprite: trashSprite,

    frame,
    row: 0,

    frameCount: TRASH_CONFIG.FRAME_COUNT,
    frameWidth: TRASH_CONFIG.FRAME_SIZE,
    frameHeight: TRASH_CONFIG.FRAME_SIZE,

    // Размеры оригинальной 2D-отрисовки.
    displayWidth: 40,
    displayHeight: 50,
  };
}

window.trashCansSystem = {
  initialize: initializeTrashCans,
  update: updateTrashCans,
  draw: drawTrashCans,

  // Данные для общего WebGL2 billboard-рендерера.
  getRenderData: getTrashCanRenderData,

  getTrashPositions() {
    return TRASH_POSITIONS;
  },

  drawSprite(camX, camY, index) {
    drawTrashCanSprite(camX, camY, index);
  },
};

(function registerTrashCansVisualProviders() {
  "use strict";

  function registerTrashCans3D() {
    const scene = window.sceneEntitySystem;
    const trash = window.trashCansSystem;

    if (
      typeof scene?.registerNPCVisualProvider !== "function" ||
      typeof scene?.getRegisteredNPCIds !== "function" ||
      typeof trash?.getRenderData !== "function"
    ) {
      console.error(
        "[TrashCans3D] Required visual provider API is unavailable.",
      );
      return false;
    }

    const registeredIds = scene.getRegisteredNPCIds();

    let allRegistered = true;

    for (let i = 0; i < TRASH_POSITIONS.length; i++) {
      const id = `trashCan_${i}`;

      // Защита от повторной регистрации.
      if (registeredIds.includes(id)) {
        continue;
      }

      // ВАЖНО: сохраняем индекс конкретной мусорки.
      const index = i;

      const success = scene.registerNPCVisualProvider(id, {
        getRenderData() {
          return trash.getRenderData(index);
        },
      });

      if (!success) {
        console.error(`[TrashCans3D] Failed to register ${id}.`);
        allRegistered = false;
      }
    }

    if (allRegistered) {
      console.log(
        `[TrashCans3D] Registered ${TRASH_POSITIONS.length} trash cans.`,
      );
    }

    return allRegistered;
  }

  if (!registerTrashCans3D()) {
    window.addEventListener("load", registerTrashCans3D, { once: true });
  }
})();
