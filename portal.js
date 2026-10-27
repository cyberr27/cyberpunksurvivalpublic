// portal.js — анимация портала в Неоновом городе

const PORTAL_CONFIG = {
  x: 2887,
  y: 200,
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

function updatePortalAnimation(deltaTime) {
  if (!portal_worldSystem) {
    portal_worldSystem = window.worldSystem;
    portal_movementSystem = window.movementSystem;
    portal_canvas = canvas;
    portal_ctx = ctx;
  }

  if (portal_worldSystem.currentWorldId !== PORTAL_CONFIG.worldId) return;

  deltaTime = Math.min(deltaTime, PORTAL_MAX_DELTA_CAP);

  if (isPlayerNearPortal) {
    portalFrameTime += deltaTime;
    if (portalFrameTime >= PORTAL_FRAME_DURATION) {
      portalFrameTime -= PORTAL_FRAME_DURATION;
      portalFrame = (portalFrame + 1) % PORTAL_CONFIG.frameCount;
    }
  } else {
    portalFrame = 0;
    portalFrameTime = 0;
  }
}

function drawPortalSprite(camX, camY) {
  if (!portal_worldSystem) {
    portal_worldSystem = window.worldSystem;
    portal_movementSystem = window.movementSystem;
    portal_canvas = canvas;
    portal_ctx = ctx;
  }

  if (portal_worldSystem.currentWorldId !== PORTAL_CONFIG.worldId) return;

  const screenX = PORTAL_CONFIG.x - camX;
  const screenY = PORTAL_CONFIG.y - camY;

  if (
    screenX <= -PORTAL_CONFIG.width ||
    screenX >= portal_canvas.width + PORTAL_CONFIG.width ||
    screenY <= -PORTAL_CONFIG.height ||
    screenY >= portal_canvas.height + PORTAL_CONFIG.height
  ) {
    return;
  }

  let srcX = 0;
  if (isPlayerNearPortal) {
    srcX = portalFrame * PORTAL_CONFIG.frameWidth;
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
    portal_ctx.fillStyle = "#ff00ff33";
    portal_ctx.fillRect(screenX, screenY, 200, 200);

    portal_ctx.strokeStyle = "#ff00ff";
    portal_ctx.lineWidth = 2;
    portal_ctx.strokeRect(screenX, screenY, 200, 200);
  }
}

function drawPortal(deltaTime) {
  updatePortalAnimation(deltaTime);
  const cam = window.movementSystem.getCamera();
  drawPortalSprite(cam.x, cam.y);
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

function getPortalRenderData() {
  if (window.worldSystem?.currentWorldId !== PORTAL_CONFIG.worldId) {
    return null;
  }

  if (
    !portalSprite?.complete ||
    portalSprite.naturalWidth <= 0 ||
    portalSprite.naturalHeight <= 0
  ) {
    return null;
  }

  // Полностью повторяем выбор кадра из drawPortalSprite().
  const frame = isPlayerNearPortal ? portalFrame : 0;

  return {
    id: "portal",
    type: "npc",
    visualType: "billboard",

    // Мировые координаты из оригинального portal.js.
    x: PORTAL_CONFIG.x,
    y: PORTAL_CONFIG.y,

    worldId: PORTAL_CONFIG.worldId,

    sprite: portalSprite,

    frame,
    row: 0,

    frameCount: PORTAL_CONFIG.frameCount,

    frameWidth: PORTAL_CONFIG.frameWidth,
    frameHeight: PORTAL_CONFIG.frameHeight,

    displayWidth: PORTAL_CONFIG.width,
    displayHeight: PORTAL_CONFIG.height,
  };
}

window.portalSystem = {
  initialize: (sprite) => {
    portalSprite = sprite;
    isPlayerNearPortal = false;
    portalFrame = 0;
    portalFrameTime = 0;
  },

  getRenderData: getPortalRenderData,

  getPosition() {
    return { x: PORTAL_CONFIG.x, y: PORTAL_CONFIG.y };
  },

  drawSprite(camX, camY) {
    drawPortalSprite(camX, camY);
  },

  updateAnimation(deltaTime) {
    updatePortalAnimation(deltaTime);
  },

  draw: drawPortal,
  checkProximity: checkPortalProximity,
};

(function registerPortalVisualProvider() {
  "use strict";

  function registerPortal3D() {
    const scene = window.sceneEntitySystem;
    const portal = window.portalSystem;

    if (
      typeof scene?.registerNPCVisualProvider !== "function" ||
      typeof scene?.getRegisteredNPCIds !== "function" ||
      typeof portal?.getRenderData !== "function"
    ) {
      return false;
    }

    const id = "portal";

    // Защита от повторной регистрации.
    if (scene.getRegisteredNPCIds().includes(id)) {
      return true;
    }

    // Регистрируем визуального провайдера.
    scene.registerNPCVisualProvider(id, {
      getRenderData() {
        return portal.getRenderData();
      },
    });

    // Проверяем фактическую регистрацию.
    const registered = scene.getRegisteredNPCIds().includes(id);

    if (registered) {
      console.log("[Portal3D] Visual provider registered successfully.");
    } else {
      console.error("[Portal3D] Failed to register visual provider.");
    }

    return registered;
  }

  // Первая попытка — сразу после выполнения файла.
  if (!registerPortal3D()) {
    // Повторная попытка после загрузки страницы.
    window.addEventListener("load", registerPortal3D, { once: true });
  }
})();
