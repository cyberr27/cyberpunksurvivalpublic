(function () {
  let isMoving = false;
  let targetX = 0;
  let targetY = 0;

  const baseSpeed = 65;
  let speedBonus = 0;
  function getWorldSize() {
    const w = window.worldSystem?.getCurrentWorld?.();
    return {
      width: w?.w ?? 2688,
      height: w?.h ?? 2688,
    };
  }

  const camera = { x: 0, y: 0, targetX: 0, targetY: 0, lerpFactor: 0.1 };
  let zoom = 1;
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 2;
  const ZOOM_STEP = 0.1;

  function changeZoomByWheel(deltaY) {
    if (!Number.isFinite(deltaY) || deltaY === 0) {
      return zoom;
    }

    const direction = deltaY < 0 ? 1 : -1;

    zoom = Math.max(
      MIN_ZOOM,
      Math.min(
        MAX_ZOOM,
        Math.round((zoom + direction * ZOOM_STEP) * 1000) / 1000,
      ),
    );

    return zoom;
  }

  const ANIMATION_FRAME_DURATION = 80; // 80 ms на walking-кадр → 12.5 fps
  const WALK_FRAME_COUNT = 16;

  // Старую атаку пока не меняем:
  // playerSprite.png по-прежнему содержит 13 кадров атаки.
  const ATTACK_FRAME_COUNT = 13;
  const ATTACK_FRAME_DURATION = 500 / ATTACK_FRAME_COUNT;

  const sendInterval = 100;
  let lastSendTime = 0;

  // Кэш DOM
  const canvas = document.getElementById("gameCanvas");
  const game3DCanvas = document.getElementById("game3DCanvas");
  const inventoryContainer = document.getElementById("inventoryContainer");
  const getInventoryRect = () => inventoryContainer.getBoundingClientRect();

  function getKeyboardDirectionVector() {
    const inputVector = window.inputSystem?.getKeyboardMovementVector?.();

    if (
      !inputVector ||
      !Number.isFinite(inputVector.dx) ||
      !Number.isFinite(inputVector.dy)
    ) {
      return {
        dx: 0,
        dy: 0,
      };
    }

    return inputVector;
  }

  function updateFacingFromKeyboard(me, dx, dy) {
    if (!me || me.health <= 0) return false;

    // Противоположные клавиши взаимно компенсируются.
    if (dx === 0 && dy === 0) return false;

    const newDirection = getDirection(dx, dy, me);

    if (newDirection === me.direction) {
      return false;
    }

    me.direction = newDirection;

    return true;
  }

  function initializeMovement() {
    if (!window.inputSystem) {
      console.error("[MovementSystem] inputSystem is unavailable.");

      return false;
    }

    if (!window.rendererSystem?.set2DScreenToWorldProvider) {
      console.error(
        "[MovementSystem] rendererSystem 2D projection API is unavailable.",
      );

      return false;
    }

    window.rendererSystem.set2DScreenToWorldProvider(screenToWorld2D);

    window.inputSystem.initialize();

    window.inputSystem.on("pointerdown", handlePointerDown);

    window.inputSystem.on("pointermove", handlePointerMove);

    window.inputSystem.on("pointerup", handlePointerUp);

    if (!window.inputSystem.isMobile) {
      window.inputSystem.on("touchstart", handleTouchStart);

      window.inputSystem.on("touchmove", handleTouchMove);

      window.inputSystem.on("touchend", handleTouchEnd);
    }

    // 2D canvas использует общий эталон масштаба.
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        changeZoomByWheel(e.deltaY);
      },
      {
        passive: false,
      },
    );

    return true;
  }

  function handlePointerDown(e) {
    if (e.button !== 0) return;

    if (!canStartMovement(e.clientX, e.clientY)) {
      return;
    }

    if (!updateTarget(e.clientX, e.clientY)) {
      return;
    }

    isMoving = true;
  }

  function handlePointerMove(e) {
    if (isMoving) {
      updateTarget(e.clientX, e.clientY);
    }
  }

  function handlePointerUp(e) {
    if (e.button === 0) stopMovement();
  }

  function handleTouchStart(e) {
    e.originalEvent?.preventDefault?.();

    if (!canStartMovement(e.clientX, e.clientY)) {
      return;
    }

    isMoving = true;

    updateTarget(e.clientX, e.clientY);
  }

  function handleTouchMove(e) {
    e.originalEvent?.preventDefault?.();

    if (isMoving) {
      updateTarget(e.clientX, e.clientY);
    }
  }

  function handleTouchEnd(e) {
    e.originalEvent?.preventDefault?.();

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
    const worldPosition = screenToWorld(clientX, clientY);

    if (
      !worldPosition ||
      !Number.isFinite(worldPosition.x) ||
      !Number.isFinite(worldPosition.y)
    ) {
      return false;
    }

    targetX = worldPosition.x;
    targetY = worldPosition.y;

    return true;
  }

  function screenToWorld2D(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return null;
    }

    const canvasX = (clientX - rect.left) * (canvas.width / rect.width);

    const canvasY = (clientY - rect.top) * (canvas.height / rect.height);

    return {
      x: camera.x + canvasX / zoom,
      y: camera.y + canvasY / zoom,
    };
  }

  function screenToWorld(clientX, clientY) {
    if (window.rendererSystem?.screenToWorld) {
      return window.rendererSystem.screenToWorld(clientX, clientY);
    }

    return screenToWorld2D(clientX, clientY);
  }

  function stopMovement() {
    isMoving = false;
  }

  function movePlayer(dx, dy, deltaTime, me, currentTime, tolerance = 0) {
    const distance = Math.hypot(dx, dy);
    if (distance <= tolerance) return false;

    const effectiveBaseSpeed = baseSpeed + (speedBonus || 0);
    const moveSpeed = effectiveBaseSpeed * (deltaTime / 1000);
    let moveX = (dx / distance) * moveSpeed;
    let moveY = (dy / distance) * moveSpeed;

    const prevX = me.x;
    const prevY = me.y;

    let newX = prevX + moveX;
    let newY = prevY + moveY;

    const blockedFull =
      window.barriersSystem?.wouldCrossBarrier?.(prevX, prevY, newX, newY) ===
      true;

    if (blockedFull) {
      // Try horizontal only
      const slideX = prevX + moveX;
      const slideY = prevY;
      const blockedX =
        window.barriersSystem?.wouldCrossBarrier?.(
          prevX,
          prevY,
          slideX,
          slideY,
        ) === true;

      if (!blockedX) {
        newX = slideX;
        newY = slideY;
      } else {
        // Try vertical only
        const slideX2 = prevX;
        const slideY2 = prevY + moveY;
        const blockedY =
          window.barriersSystem?.wouldCrossBarrier?.(
            prevX,
            prevY,
            slideX2,
            slideY2,
          ) === true;

        if (!blockedY) {
          newX = slideX2;
          newY = slideY2;
        } else {
          // Fully blocked — no movement this frame
          return false;
        }
      }
    }

    // Двигаемся
    me.x = newX;
    me.y = newY;

    // Границы мира
    const size = getWorldSize();
    const worldMargin = 40;

    const worldMinX = worldMargin;
    const worldMinY = worldMargin;

    const worldMaxX = Math.max(worldMinX, size.width - worldMargin);

    const worldMaxY = Math.max(worldMinY, size.height - worldMargin);

    me.x = Math.max(worldMinX, Math.min(worldMaxX, me.x));

    me.y = Math.max(worldMinY, Math.min(worldMaxY, me.y));

    if (me.state !== "attacking" && me.state !== "dying") {
      me.state = "walking";
    }

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

    if (me && typeof me.speedBonus === "number") {
      speedBonus = me.speedBonus;
    }

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

    // Определяем актуальное направление клавиатуры.
    const keyboardDirection = getKeyboardDirectionVector();

    const facingInputMode =
      window.inputSystem?.getFacingInputMode?.() || "keyboard";

    if (facingInputMode === "mouse") {
      updateFacingFromPointer(me);
    } else {
      updateFacingFromKeyboard(me, keyboardDirection.dx, keyboardDirection.dy);
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
      const { dx, dy } = keyboardDirection;

      if (dx || dy) {
        if (movePlayer(dx, dy, deltaTime, me, currentTime, 0)) {
          movedThisFrame = true;
        }
      }
    }

    // 3. Джойстик
    if (window.inputSystem?.isMobile && !movedThisFrame) {
      const joy = window.inputSystem.getJoystickMovementVector();

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
      me.frameTime = (me.frameTime || 0) + deltaTime;
      while (me.frameTime >= ANIMATION_FRAME_DURATION) {
        me.frameTime -= ANIMATION_FRAME_DURATION;
        me.frame = (me.frame + 1) % WALK_FRAME_COUNT;
      }
      me.state = "walking"; // гарантируем состояние
    } else if (me.state === "walking" && !movedThisFrame) {
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

    if (currentTime - lastSendTime >= sendInterval) {
      sendMovementUpdate(me);
      lastSendTime = currentTime;
    }

    updateCamera(me);
  }

  function getDirection(normX, normY, player) {
    if (Math.abs(normX) < 0.01 && Math.abs(normY) < 0.01) {
      return player.direction || "down";
    }

    const angle = Math.atan2(normY, normX) * (180 / Math.PI);

    const directions = [
      "right",
      "down-right",
      "down",
      "down-left",
      "left",
      "up-left",
      "up",
      "up-right",
    ];

    const normalizedAngle = (angle + 360) % 360;

    const directionIndex = Math.floor((normalizedAngle + 22.5) / 45) % 8;

    return directions[directionIndex];
  }

  function updateFacingFromPointer(me) {
    if (window.inputSystem?.isMobile || !me || me.health <= 0) {
      return false;
    }

    const pointerWorld = window.inputSystem?.getPointerWorld?.({
      refresh: true,
    });

    if (
      !pointerWorld ||
      !Number.isFinite(pointerWorld.x) ||
      !Number.isFinite(pointerWorld.y)
    ) {
      return false;
    }

    const centerX = me.x + 35;
    const centerY = me.y + 35;

    const dx = pointerWorld.x - centerX;

    const dy = pointerWorld.y - centerY;

    if (Math.hypot(dx, dy) < 8) {
      return false;
    }

    const newDirection = getDirection(dx, dy, me);

    if (newDirection === me.direction) {
      return false;
    }

    me.direction = newDirection;

    return true;
  }

  function sendMovementUpdate(player) {
    if (!player || player.health <= 0) return;

    sendWhenReady(
      ws,
      JSON.stringify({
        type: "move",
        x: player.x,
        y: player.y,
        direction: player.direction,
        state: player.state,
        frame: player.frame,
        attackFrame: player.attackFrame || 0,
        attackFrameTime: player.attackFrameTime || 0,
      }),
    );
  }

  function updateCamera(player) {
    const hw = canvas.width / (2 * zoom);
    const hh = canvas.height / (2 * zoom);

    camera.targetX = player.x - hw;
    camera.targetY = player.y - hh;

    camera.x += (camera.targetX - camera.x) * camera.lerpFactor;
    camera.y += (camera.targetY - camera.y) * camera.lerpFactor;

    const size = getWorldSize();
    camera.x = Math.max(
      0,
      Math.min(camera.x, size.width - canvas.width / zoom),
    );
    camera.y = Math.max(
      0,
      Math.min(camera.y, size.height - canvas.height / zoom),
    );
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
    getZoom: () => zoom,
    changeZoomByWheel,
    screenToWorld,
    stopMovement,
    isPlayerMoving: () => {
      const me = players.get(myId);
      return me ? me.state === "walking" || me.state === "attacking" : false;
    },
    drawDebug: drawDebugObstacles,
  };
})();
