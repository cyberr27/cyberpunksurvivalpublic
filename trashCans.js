// trashCans.js — ИСПРАВЛЕНО + доработано под сервер

const TRASH_POSITIONS = [
  { x: 950, y: 2200 },
  { x: 50, y: 2400 },
  { x: 760, y: 252 },
  { x: 1400, y: 581 },
  { x: 2550, y: 2640 },
  { x: 1450, y: 1600 },
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
      if (currentTrashIndex !== idx) {
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

  if (currentTrashIndex === index && trashDialog) return;
  closeTrashDialog();

  currentTrashIndex = index;

  trashDialog = document.createElement("div");
  trashDialog.id = "trashCanDialog";
  trashDialog.className = "trash-dialog open";

  trashDialog.innerHTML = `
    <div class="trash-header">Мусорный бак #${index + 1}</div>
    
    <div class="trash-card-area">
      <div class="card-back" id="cardBack">?</div>
    </div>

    <div class="trash-suits">
      <button class="suit-btn spades"   data-suit="spades"></button>
      <button class="suit-btn hearts"   data-suit="hearts"></button>
      <button class="suit-btn diamonds" data-suit="diamonds"></button>
      <button class="suit-btn clubs"    data-suit="clubs"></button>
    </div>

    <div class="trash-message" id="trashMessage">Угадай масть, чтобы открыть!</div>
  `;

  document.body.appendChild(trashDialog);
  document.body.classList.add("trash-dialog-active");

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

function drawTrashCans(ctx) {
  if (window.worldSystem.currentWorldId !== 0) return;
  if (!trashSpriteReady || !trashSprite?.complete) return;

  const cam = window.movementSystem.getCamera();
  const left = cam.x - 100;
  const right = cam.x + canvas.width + 100;
  const top = cam.y - 100;
  const bottom = cam.y + canvas.height + 100;

  const t = globalTrashTime;

  TRASH_POSITIONS.forEach((pos, i) => {
    const { x, y } = pos;
    if (x < left || x > right || y < top || y > bottom) return;

    const sx = (x - cam.x) | 0;
    const sy = (y - cam.y) | 0;

    const state = window.trashCansState[i] || {};
    const isOpened = state.isOpened === true || state.guessed === true;

    const frame = isOpened
      ? 0
      : Math.floor((t + i * 987) / TRASH_CONFIG.FRAME_DURATION) %
        TRASH_CONFIG.FRAME_COUNT;

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
  });
}

window.trashCansSystem = {
  initialize: initializeTrashCans,
  update: updateTrashCans,
  draw: drawTrashCans,
};
