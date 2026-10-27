window.vacuumRobotSystem = (function () {
  const DIALOG_RANGE_SQ = 50 * 50;

  const VISUAL_CONFIG = Object.freeze({
    mode3D: "model3d",

    model3D: Object.freeze({
      assetUrl: "models/vacuum_robot.glb",
      scale: 1,
      rotationY: 0,
      groundOffset: 0,
      groundAlign: true,
    }),
  });

  let sharedSprite = null;

  // Один робот — позиция теперь только с сервера
  const robot = {
    name: "ВАКУУМ-9000",
    photo: "vacuum_photo.png",
    x: 85,
    y: 111,
    frame: 0,
    state: "moving",
    dialogShown: false,
    width: 70,
    height: 70,

    // === Серверная позиция — единственный источник правды ===
    targetX: 85,
    targetY: 111,
  };

  let lastWorldId = -1;
  let dialogElement = null;
  let currentRobot = null;

  function ensureDialog() {
    if (dialogElement) return;

    dialogElement = document.createElement("div");
    // Добавляем специфический класс, чтобы стили из vacuumRobot.css
    // не затронули другие .npc-dialog
    dialogElement.className = "npc-dialog vacuum-robot-dialog";
    dialogElement.style.display = "none";
    dialogElement.innerHTML = `
      <button class="vacuum-close-btn">Нажми!</button>
    `;

    dialogElement.querySelector(".vacuum-close-btn").onclick = () =>
      requestVacuumReward();
    document.body.appendChild(dialogElement);
  }

  function showDialog() {
    if (robot.dialogShown) return;
    ensureDialog();
    dialogElement.style.display = "flex";
    robot.dialogShown = true;
    currentRobot = robot;
  }

  function hideDialog() {
    if (dialogElement) dialogElement.style.display = "none";
    robot.dialogShown = false;
    currentRobot = null;
  }

  function requestVacuumReward() {
    hideDialog();
    const me = players.get(myId);
    if (!me || me.worldId !== 0) return;

    if (ws?.readyState === WebSocket.OPEN) {
      sendWhenReady(
        ws,
        JSON.stringify({
          type: "requestVacuumReward",
          robotId: 0,
        }),
      );
    }
  }

  function isNearPlayer(me) {
    if (!me || me.worldId !== 0) return false;
    const dx = me.x + 35 - (robot.x + 35);
    const dy = me.y + 35 - (robot.y + 35);
    return dx * dx + dy * dy <= DIALOG_RANGE_SQ;
  }

  function applyServerUpdate(data) {
    if (typeof data.x === "number") {
      robot.targetX = data.x;
      robot.x = data.x;
    }
    if (typeof data.y === "number") {
      robot.targetY = data.y;
      robot.y = data.y;
    }
    if (typeof data.frame === "number") robot.frame = data.frame;
    if (data.state) robot.state = data.state;
  }

  function update(deltaTime) {
    const currentWorld = window.worldSystem?.currentWorldId ?? -1;

    if (currentWorld !== lastWorldId) {
      lastWorldId = currentWorld;
      hideDialog();
      if (currentWorld !== 0) return;
    }

    if (currentWorld !== 0) return;

    const me = players.get(myId);

    // Диалог
    if (me) {
      if (isNearPlayer(me)) {
        showDialog();
      } else if (robot.dialogShown) {
        hideDialog();
      }
    }
  }

  function drawSprite(camX, camY) {
    if (window.worldSystem?.currentWorldId !== 0) return;

    const cw = canvas.width + 200;
    const ch = canvas.height + 200;

    const sx = robot.x - camX;
    const sy = robot.y - camY;

    if (sx < -100 || sx > cw || sy < -100 || sy > ch) return;

    if (sharedSprite?.complete) {
      ctx.drawImage(sharedSprite, robot.frame * 70, 0, 70, 70, sx, sy, 70, 70);
    } else {
      ctx.fillStyle = "#00ff44";
      ctx.fillRect(sx, sy, 70, 70);
      ctx.fillStyle = "#000";
      ctx.font = "12px Arial";
      ctx.fillText(robot.name, sx + 8, sy + 40);
    }

    if (robot.dialogShown) {
      ctx.strokeStyle = "#00ffff";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.strokeRect(sx - 10, sy - 10, 90, 90);
      ctx.setLineDash([]);
    }
  }

  function draw() {
    const cam = window.movementSystem.getCamera();
    drawSprite(cam.x, cam.y);
  }

  function getRenderData() {
    if (window.worldSystem?.currentWorldId !== 0) {
      return null;
    }

    if (!Number.isFinite(robot.x) || !Number.isFinite(robot.y)) {
      return null;
    }

    const frameCount = 13;
    const frameWidth = 70;
    const frameHeight = 70;

    const frame = Number.isFinite(robot.frame)
      ? Math.max(0, Math.min(frameCount - 1, Math.floor(robot.frame)))
      : 0;

    const spriteReady =
      sharedSprite?.complete === true &&
      sharedSprite.naturalWidth > 0 &&
      sharedSprite.naturalHeight > 0;

    const billboard = {
      sprite: spriteReady ? sharedSprite : null,

      frame,
      row: 0,
      frameCount,

      frameWidth,
      frameHeight,

      displayWidth: robot.width,
      displayHeight: robot.height,
    };

    return {
      id: "vacuum",
      type: "npc",
      visualType: "billboard",

      x: robot.x,
      y: robot.y,
      worldId: 0,

      sprite: billboard.sprite,

      frame: billboard.frame,
      row: billboard.row,
      frameCount: billboard.frameCount,

      frameWidth: billboard.frameWidth,
      frameHeight: billboard.frameHeight,

      displayWidth: billboard.displayWidth,
      displayHeight: billboard.displayHeight,

      visual: {
        mode: VISUAL_CONFIG.mode3D,

        billboard,

        model3D: {
          ...VISUAL_CONFIG.model3D,
        },
      },
    };
  }

  function initialize(sprite9000) {
    sharedSprite = sprite9000 || images.vacuumRobotSprite;
    robot.x = 85;
    robot.y = 111;
    robot.targetX = 85;
    robot.targetY = 111;
    robot.frame = 0;
    robot.state = "moving";
    robot.dialogShown = false;
    lastWorldId = -1;
  }

  return {
    initialize,
    update,
    draw,
    getRenderData,

    getPosition() {
      return { x: robot.x, y: robot.y };
    },

    drawSprite(camX, camY) {
      drawSprite(camX, camY);
    },

    hideDialog,
    applyServerUpdate,
  };
})();

(function registerVacuumRobotVisualProvider() {
  "use strict";

  function registerVacuum3D() {
    const scene = window.sceneEntitySystem;
    const vacuum = window.vacuumRobotSystem;

    if (
      typeof scene?.registerNPCVisualProvider !== "function" ||
      typeof scene?.getRegisteredNPCIds !== "function" ||
      typeof vacuum?.getRenderData !== "function"
    ) {
      return false;
    }

    const id = "vacuum";

    // Исключаем повторную регистрацию.
    if (scene.getRegisteredNPCIds().includes(id)) {
      return true;
    }

    scene.registerNPCVisualProvider(id, {
      getRenderData() {
        return vacuum.getRenderData();
      },
    });

    const registered = scene.getRegisteredNPCIds().includes(id);

    if (registered) {
      console.log("[Vacuum3D] Visual provider registered successfully.");
    } else {
      console.error("[Vacuum3D] Visual provider registration failed.");
    }

    return registered;
  }

  if (!registerVacuum3D()) {
    window.addEventListener("load", registerVacuum3D, { once: true });
  }
})();
