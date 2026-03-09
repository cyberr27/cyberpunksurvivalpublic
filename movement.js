(function () {
  let isMoving = false;
  let targetX = 0;
  let targetY = 0;

  const baseSpeed = 65;
  const worldWidth = 2800;
  const worldHeight = 2800;
  const worldMaxX = worldWidth - 40;
  const worldMaxY = worldHeight - 40;

  const camera = { x: 0, y: 0, targetX: 0, targetY: 0, lerpFactor: 0.1 };

  const ANIMATION_FRAME_DURATION = 80; // ms → ~12.5 fps анимация
  const WALK_FRAME_COUNT = 13;
  const ATTACK_FRAME_COUNT = 13; // должно быть определено где-то глобально, если нет — задай
  const ATTACK_FRAME_DURATION = 500 / ATTACK_FRAME_COUNT;

  const sendInterval = 100;
  let lastSendTime = 0;

  let keys = {};
  const isMobile = window.joystickSystem
    ? window.joystickSystem.isMobile
    : false;

  // Кэш DOM
  const canvas = document.getElementById("gameCanvas");
  const inventoryContainer = document.getElementById("inventoryContainer");
  const getInventoryRect = () => inventoryContainer.getBoundingClientRect();

  function initializeMovement() {
    if (isMobile && window.joystickSystem) {
      window.joystickSystem.initialize();
    }

    canvas.addEventListener("mousedown", handlePointerDown);
    canvas.addEventListener("mousemove", handlePointerMove);
    canvas.addEventListener("mouseup", handlePointerUp);

    if (!isMobile) {
      canvas.addEventListener("touchstart", handleTouchStart, {
        passive: false,
      });
      canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
      canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
    }

    window.addEventListener(
      "keydown",
      (e) => (keys[e.key.toLowerCase()] = true),
    );
    window.addEventListener(
      "keyup",
      (e) => (keys[e.key.toLowerCase()] = false),
    );
  }

  function handlePointerDown(e) {
    if (e.button !== 0) return;
    if (!canStartMovement(e.clientX, e.clientY)) return;
    isMoving = true;
    updateTarget(e.clientX, e.clientY);
  }

  function handlePointerMove(e) {
    if (isMoving) updateTarget(e.clientX, e.clientY);
  }

  function handlePointerUp(e) {
    if (e.button === 0) stopMovement();
  }

  function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    if (!canStartMovement(touch.clientX, touch.clientY)) return;
    isMoving = true;
    updateTarget(touch.clientX, touch.clientY);
  }

  function handleTouchMove(e) {
    e.preventDefault();
    if (isMoving) {
      const touch = e.touches[0];
      updateTarget(touch.clientX, touch.clientY);
    }
  }

  function handleTouchEnd(e) {
    e.preventDefault();
    stopMovement();
  }

  function canStartMovement(clientX, clientY) {
    const me = players.get(myId);
    if (!me || me.health <= 0) return false;

    if (window.isInventoryOpen) {
      const rect = getInventoryRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return false;
      }
    }
    return true;
  }

  function updateTarget(clientX, clientY) {
    targetX = clientX + camera.x;
    targetY = clientY + camera.y;
  }

  function stopMovement() {
    isMoving = false;
  }

  // ─── Проверка пересечения отрезков (для препятствий) ────────────────
  function segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (denom === 0) return false;
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  }

  function movePlayer(dx, dy, deltaTime, me, currentTime, tolerance = 0) {
    const distance = Math.hypot(dx, dy);
    if (distance <= tolerance) return false;

    const moveSpeed = baseSpeed * (deltaTime / 1000);
    let moveX = (dx / distance) * moveSpeed;
    let moveY = (dy / distance) * moveSpeed;

    const prevX = me.x;
    const prevY = me.y;

    const newX = prevX + moveX;
    const newY = prevY + moveY;

    // Проверка препятствий
    let blocked = false;
    if (window.obstacles) {
      for (const obs of window.obstacles) {
        if (obs.worldId !== me.worldId) continue;
        if (
          segmentsIntersect(
            prevX,
            prevY,
            newX,
            newY,
            obs.x1,
            obs.y1,
            obs.x2,
            obs.y2,
          )
        ) {
          blocked = true;
          break;
        }
      }
    }

    if (blocked) {
      return false; // не двигаемся
    }

    // Двигаемся
    me.x = newX;
    me.y = newY;

    // Границы мира
    me.x = Math.max(0, Math.min(worldMaxX, me.x));
    me.y = Math.max(0, Math.min(worldMaxY, me.y));

    if (me.state !== "attacking" && me.state !== "dying") {
      me.state = "walking";
    }

    me.direction = getDirection(dx / distance, dy / distance, me);

    // Взаимодействия (один раз за тик)
    window.npcSystem?.checkNPCProximity?.();
    window.jackSystem?.checkJackProximity?.();
    window.npcSystem?.checkQuestCompletion?.();
    window.vendingMachine?.checkProximity?.();
    window.checkCollisions?.();

    if (currentTime - lastSendTime >= sendInterval) {
      sendMovementUpdate(me);
      lastSendTime = currentTime;
    }

    return true;
  }

  function updateMovement(deltaTime) {
    const me = players.get(myId);
    if (!me) return;

    const currentTime = Date.now();

    // Смерть
    if (me.health <= 0) {
      me.state = "idle";
      me.frame = 0;
      me.frameTime = 0;

      if (currentTime - lastSendTime >= sendInterval) {
        sendMovementUpdate(me);
        lastSendTime = currentTime;
      }
      updateCamera(me);
      return;
    }

    let movedThisFrame = false;

    // 1. Клик / тач по карте
    if (isMoving) {
      const dx = targetX - me.x;
      const dy = targetY - me.y;
      if (movePlayer(dx, dy, deltaTime, me, currentTime, 5)) {
        movedThisFrame = true;
      } else {
        isMoving = false; // цель достигнута или заблокирована
      }
    }

    // 2. Клавиатура (если не идём по клику)
    if (!movedThisFrame) {
      let dx = 0,
        dy = 0;
      if (keys.w || keys.arrowup) dy -= 1;
      if (keys.s || keys.arrowdown) dy += 1;
      if (keys.a || keys.arrowleft) dx -= 1;
      if (keys.d || keys.arrowright) dx += 1;

      if (dx || dy) {
        if (movePlayer(dx, dy, deltaTime, me, currentTime, 0)) {
          movedThisFrame = true;
        }
      }
    }

    // 3. Джойстик
    if (isMobile && window.joystickSystem && !movedThisFrame) {
      const joy = window.joystickSystem.getDirection();
      if (joy.active && (Math.abs(joy.dx) > 0.05 || Math.abs(joy.dy) > 0.05)) {
        if (
          movePlayer(joy.dx * 100, joy.dy * 100, deltaTime, me, currentTime, 0)
        ) {
          movedThisFrame = true;
        }
      }
    }

    // Анимация ходьбы
    if (movedThisFrame && me.state !== "attacking" && me.state !== "dying") {
      const prevDir = me.direction;
      // direction уже обновлён в movePlayer

      me.frameTime = (me.frameTime || 0) + deltaTime;
      while (me.frameTime >= ANIMATION_FRAME_DURATION) {
        me.frameTime -= ANIMATION_FRAME_DURATION;
        me.frame = (me.frame + 1) % WALK_FRAME_COUNT;
      }
    } else if (me.state === "walking") {
      me.state = "idle";
      me.frame = 0;
      me.frameTime = 0;
      sendMovementUpdate(me);
      lastSendTime = currentTime;
    }

    // Атака (анимация)
    if (me.state === "attacking") {
      me.attackFrameTime = (me.attackFrameTime || 0) + deltaTime;
      while (me.attackFrameTime >= ATTACK_FRAME_DURATION) {
        me.attackFrameTime -= ATTACK_FRAME_DURATION;
        me.attackFrame = (me.attackFrame || 0) + 1;
        if (me.attackFrame >= ATTACK_FRAME_COUNT) {
          me.attackFrame = 0;
          me.attackFrameTime = 0;
          me.state = movedThisFrame ? "walking" : "idle";
          sendMovementUpdate(me);
          lastSendTime = currentTime;
        }
      }

      // Чаще отправляем прогресс атаки
      if (currentTime - lastSendTime >= 80) {
        sendMovementUpdate(me);
        lastSendTime = currentTime;
      }
    }

    updateCamera(me);
  }

  function getDirection(normX, normY, player) {
    const angle = Math.atan2(normY, normX) * (180 / Math.PI);
    const curDir = player.direction || "down";

    const prevAngles = {
      right: 0,
      "down-right": 45,
      down: 90,
      "up-left": 135,
      left: 180,
      "down-left": -135,
      up: -90,
      "up-right": -45,
    };

    const prev = prevAngles[curDir] || 0;
    let diff = angle - prev;
    while (diff > 180) diff -= 360;
    while (diff <= -180) diff += 360;

    if (Math.abs(diff) < 20) return curDir;

    if (angle > -22.5 && angle <= 22.5) return "right";
    if (angle > 22.5 && angle <= 67.5) return "down-right";
    if (angle > 67.5 && angle <= 112.5) return "up";
    if (angle > 112.5 && angle <= 157.5) return "up-left";
    if (angle > 157.5 || angle <= -157.5) return "left";
    if (angle > -157.5 && angle <= -112.5) return "down-left";
    if (angle > -112.5 && angle <= -67.5) return "down";
    return "up-right";
  }

  function sendMovementUpdate(player) {
    if (!player || player.health <= 0) return;

    sendWhenReady(
      ws,
      JSON.stringify({
        type: "move",
        x: player.x,
        y: player.y,
        energy: player.energy,
        food: player.food,
        water: player.water,
        armor: player.armor,
        direction: player.direction,
        state: player.state,
        frame: player.frame,
        attackFrame: player.attackFrame || 0,
        attackFrameTime: player.attackFrameTime || 0,
      }),
    );
  }

  function updateCamera(player) {
    const hw = canvas.width / 2;
    const hh = canvas.height / 2;

    camera.targetX = player.x - hw;
    camera.targetY = player.y - hh;

    camera.x += (camera.targetX - camera.x) * camera.lerpFactor;
    camera.y += (camera.targetY - camera.y) * camera.lerpFactor;

    camera.x = Math.max(0, Math.min(camera.x, worldWidth - canvas.width));
    camera.y = Math.max(0, Math.min(camera.y, worldHeight - canvas.height));
  }

  function getCamera() {
    return camera;
  }

  // ─── Отладка препятствий (вызывается из code.js → draw) ─────────────
  function drawDebugObstacles() {
    if (!window.obstaclesSystem?.draw || !ctx) return;
    const cam = getCamera();
    window.obstaclesSystem.draw(
      ctx,
      cam.x,
      cam.y,
      players.get(myId)?.worldId || 0,
    );
  }

  window.movementSystem = {
    initialize: initializeMovement,
    update: updateMovement,
    getCamera,
    isPlayerMoving: () => {
      const me = players.get(myId);
      return me ? me.state === "walking" || me.state === "attacking" : false;
    },
    drawDebug: drawDebugObstacles, // если хочешь вызывать отдельно
  };
})();
