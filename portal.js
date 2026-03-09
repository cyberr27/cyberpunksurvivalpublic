// portal.js — анимация портала в Неоновом городе

const PORTAL_CONFIG = {
  x: 2400,
  y: -20,
  worldId: 0,
  width: 200,
  height: 200,
  frameCount: 13,
  frameWidth: 200,
  frameHeight: 200,
  interactionRadius: 400,
  centerOffsetX: 100,
  centerOffsetY: 100,
};

let portalSprite = null;
let isPlayerNearPortal = false;
let portalFrame = 0;
let portalFrameTime = 0;

const PORTAL_FRAME_DURATION = 300;
const PORTAL_MAX_DELTA_CAP = 1000;

// Кэшируем часто используемые объекты с уникальными именами
let portal_worldSystem = null;
let portal_movementSystem = null;
let portal_canvas = null;
let portal_ctx = null;

function drawPortal(deltaTime) {
  // Ленивая инициализация кэша (один раз)
  if (!portal_worldSystem) {
    portal_worldSystem = window.worldSystem;
    portal_movementSystem = window.movementSystem;
    portal_canvas = canvas;
    portal_ctx = ctx;
  }

  if (portal_worldSystem.currentWorldId !== PORTAL_CONFIG.worldId) return;

  deltaTime = Math.min(deltaTime, PORTAL_MAX_DELTA_CAP);

  const camera = portal_movementSystem.getCamera();
  const screenX = PORTAL_CONFIG.x - camera.x;
  const screenY = PORTAL_CONFIG.y - camera.y;

  // Оптимизированная проверка видимости
  if (
    screenX <= -PORTAL_CONFIG.width ||
    screenX >= portal_canvas.width + PORTAL_CONFIG.width ||
    screenY <= -PORTAL_CONFIG.height ||
    screenY >= portal_canvas.height + PORTAL_CONFIG.height
  ) {
    return;
  }

  // Вычисляем srcX
  let srcX = 0;

  if (isPlayerNearPortal) {
    portalFrameTime += deltaTime;
    if (portalFrameTime >= PORTAL_FRAME_DURATION) {
      portalFrameTime -= PORTAL_FRAME_DURATION;
      portalFrame = (portalFrame + 1) % PORTAL_CONFIG.frameCount;
    }
    srcX = portalFrame * PORTAL_CONFIG.frameWidth;
  } else {
    portalFrame = 0;
    portalFrameTime = 0;
  }

  if (
    portalSprite &&
    portalSprite.complete &&
    portalSprite.naturalWidth !== 0
  ) {
    portal_ctx.drawImage(
      portalSprite,
      srcX,
      0,
      PORTAL_CONFIG.frameWidth,
      PORTAL_CONFIG.frameHeight,
      screenX,
      screenY,
      PORTAL_CONFIG.width,
      PORTAL_CONFIG.height,
    );
  } else {
    // Минимальная заглушка
    portal_ctx.fillStyle = "#ff00ff33";
    portal_ctx.fillRect(screenX, screenY, 200, 200);

    portal_ctx.strokeStyle = "#ff00ff";
    portal_ctx.lineWidth = 2;
    portal_ctx.strokeRect(screenX, screenY, 200, 200);
  }
}

function checkPortalProximity() {
  const me = players.get(myId);
  if (!me) return;

  if (
    me.worldId !== PORTAL_CONFIG.worldId ||
    window.worldSystem.currentWorldId !== PORTAL_CONFIG.worldId
  ) {
    if (isPlayerNearPortal) isPlayerNearPortal = false;
    return;
  }

  const centerX = PORTAL_CONFIG.x + PORTAL_CONFIG.centerOffsetX;
  const centerY = PORTAL_CONFIG.y + PORTAL_CONFIG.centerOffsetY;

  const dx = me.x + 35 - centerX;
  const dy = me.y + 35 - centerY;
  const distance = Math.hypot(dx, dy);

  const nowNear = distance <= PORTAL_CONFIG.interactionRadius;

  if (nowNear !== isPlayerNearPortal) {
    isPlayerNearPortal = nowNear;
    if (!nowNear) {
      portalFrame = 0;
      portalFrameTime = 0;
    }
  }
}

window.portalSystem = {
  initialize: (sprite) => {
    portalSprite = sprite;
    isPlayerNearPortal = false;
    portalFrame = 0;
    portalFrameTime = 0;

    // Для отладки (можно закомментировать позже)
    // console.log("[Portal] initialized", sprite ? "sprite ok" : "sprite missing");
  },
  draw: drawPortal,
  checkProximity: checkPortalProximity,
};
