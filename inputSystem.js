(function () {
  "use strict";

  const POINTER_MOVE_THRESHOLD = 2;

  let initialized = false;

  const keys = Object.create(null);

  const listeners = {
    pointerdown: new Set(),
    pointermove: new Set(),
    pointerup: new Set(),

    touchstart: new Set(),
    touchmove: new Set(),
    touchend: new Set(),
  };

  const pointerState = {
    clientX: null,
    clientY: null,

    canvasX: null,
    canvasY: null,

    worldX: null,
    worldY: null,

    lastMouseClientX: null,
    lastMouseClientY: null,

    facingInputMode: "keyboard",
  };

  const isMobile =
    window.joystickSystem?.isMobile === true ||
    window.innerWidth < 768 ||
    "ontouchstart" in window;

  function isTextInputFocused() {
    const activeElement = document.activeElement;

    return (
      window.isChatInputFocused === true ||
      activeElement === document.getElementById("chatInput") ||
      activeElement === document.getElementById("stackableAmount") ||
      activeElement === document.getElementById("balyaryAmount") ||
      activeElement?.tagName === "INPUT" ||
      activeElement?.tagName === "TEXTAREA" ||
      activeElement?.isContentEditable === true
    );
  }

  function isMovementKeyEvent(event) {
    if (!event) return false;

    const code = event.code;
    const key = typeof event.key === "string" ? event.key.toLowerCase() : "";

    return (
      code === "KeyW" ||
      code === "KeyA" ||
      code === "KeyS" ||
      code === "KeyD" ||
      code === "ArrowUp" ||
      code === "ArrowDown" ||
      code === "ArrowLeft" ||
      code === "ArrowRight" ||
      key === "w" ||
      key === "a" ||
      key === "s" ||
      key === "d" ||
      key === "arrowup" ||
      key === "arrowdown" ||
      key === "arrowleft" ||
      key === "arrowright"
    );
  }

  function setKeyState(event, pressed) {
    if (!event) return;

    const key = typeof event.key === "string" ? event.key.toLowerCase() : "";

    if (event.code) {
      keys[event.code] = pressed;
    }

    if (key) {
      keys[key] = pressed;
    }
  }

  function clearMovementKeys() {
    const movementKeys = [
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",

      "w",
      "a",
      "s",
      "d",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
    ];

    for (const key of movementKeys) {
      keys[key] = false;
    }
  }

  function handleKeyDown(event) {
    if (isTextInputFocused()) {
      return;
    }

    const wasPressed =
      Boolean(keys[event.code]) ||
      Boolean(
        typeof event.key === "string" ? keys[event.key.toLowerCase()] : false,
      );

    setKeyState(event, true);

    if (isMovementKeyEvent(event) && !wasPressed && !event.repeat) {
      pointerState.facingInputMode = "keyboard";
    }
  }

  function handleKeyUp(event) {
    setKeyState(event, false);
  }

  function handleWindowBlur() {
    clearMovementKeys();
  }

  function getActiveCanvas() {
    const rendererCanvas = window.rendererSystem?.getActiveCanvas?.();

    if (rendererCanvas) {
      return rendererCanvas;
    }

    return document.getElementById("gameCanvas");
  }

  function screenToWorld(clientX, clientY) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return null;
    }

    const worldPosition = window.rendererSystem?.screenToWorld?.(
      clientX,
      clientY,
    );

    if (
      !worldPosition ||
      !Number.isFinite(worldPosition.x) ||
      !Number.isFinite(worldPosition.y)
    ) {
      return null;
    }

    return {
      x: worldPosition.x,
      y: worldPosition.y,
    };
  }

  function updateCanvasCoordinates(clientX, clientY) {
    const activeCanvas = getActiveCanvas();

    if (!activeCanvas) {
      return false;
    }

    const rect = activeCanvas.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return false;
    }

    let canvasX = (clientX - rect.left) * (activeCanvas.width / rect.width);

    let canvasY = (clientY - rect.top) * (activeCanvas.height / rect.height);

    if (window.rendererSystem?.is2D?.() === true) {
      const zoom = window.movementSystem?.getZoom?.() || 1;

      canvasX /= zoom;
      canvasY /= zoom;
    }

    pointerState.canvasX = canvasX;
    pointerState.canvasY = canvasY;

    return true;
  }

  function syncLegacyPointerState() {
    window.lastPointerClientX = pointerState.clientX;

    window.lastPointerClientY = pointerState.clientY;

    window.lastPointerCanvasX = pointerState.canvasX;

    window.lastPointerCanvasY = pointerState.canvasY;

    if (Number.isFinite(pointerState.worldX)) {
      window.lastPointerWorldX = pointerState.worldX;
    }

    if (Number.isFinite(pointerState.worldY)) {
      window.lastPointerWorldY = pointerState.worldY;
    }
  }

  function updatePointer(clientX, clientY, options = {}) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return false;
    }

    pointerState.clientX = clientX;
    pointerState.clientY = clientY;

    updateCanvasCoordinates(clientX, clientY);

    const worldPosition = screenToWorld(clientX, clientY);

    if (
      worldPosition &&
      Number.isFinite(worldPosition.x) &&
      Number.isFinite(worldPosition.y)
    ) {
      pointerState.worldX = worldPosition.x;
      pointerState.worldY = worldPosition.y;
    }

    if (options.pointerType === "mouse") {
      if (
        pointerState.lastMouseClientX === null ||
        pointerState.lastMouseClientY === null
      ) {
        pointerState.lastMouseClientX = clientX;
        pointerState.lastMouseClientY = clientY;
      } else {
        const dx = clientX - pointerState.lastMouseClientX;

        const dy = clientY - pointerState.lastMouseClientY;

        if (Math.hypot(dx, dy) >= POINTER_MOVE_THRESHOLD) {
          pointerState.lastMouseClientX = clientX;
          pointerState.lastMouseClientY = clientY;

          pointerState.facingInputMode = "mouse";
        }
      }
    }

    syncLegacyPointerState();

    return Boolean(worldPosition);
  }

  function refreshPointerWorld() {
    if (
      !Number.isFinite(pointerState.clientX) ||
      !Number.isFinite(pointerState.clientY)
    ) {
      return null;
    }

    const worldPosition = screenToWorld(
      pointerState.clientX,
      pointerState.clientY,
    );

    if (!worldPosition) {
      return null;
    }

    pointerState.worldX = worldPosition.x;
    pointerState.worldY = worldPosition.y;

    syncLegacyPointerState();

    return {
      x: pointerState.worldX,
      y: pointerState.worldY,
    };
  }

  function getPointerClient() {
    if (
      !Number.isFinite(pointerState.clientX) ||
      !Number.isFinite(pointerState.clientY)
    ) {
      return null;
    }

    return {
      x: pointerState.clientX,
      y: pointerState.clientY,
    };
  }

  function getPointerCanvas() {
    if (
      !Number.isFinite(pointerState.canvasX) ||
      !Number.isFinite(pointerState.canvasY)
    ) {
      return null;
    }

    return {
      x: pointerState.canvasX,
      y: pointerState.canvasY,
    };
  }

  function getPointerWorld(options = {}) {
    if (options.refresh === true) {
      const refreshed = refreshPointerWorld();

      if (refreshed) {
        return refreshed;
      }
    }

    if (
      !Number.isFinite(pointerState.worldX) ||
      !Number.isFinite(pointerState.worldY)
    ) {
      return null;
    }

    return {
      x: pointerState.worldX,
      y: pointerState.worldY,
    };
  }

  function getViewportCenterWorld() {
    const activeCanvas = getActiveCanvas();

    if (!activeCanvas) {
      return null;
    }

    const rect = activeCanvas.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return null;
    }

    return screenToWorld(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
  }

  function getRawKeyboardVector() {
    let dx = 0;
    let dy = 0;

    const up = keys.KeyW || keys.w || keys.ArrowUp || keys.arrowup;

    const down = keys.KeyS || keys.s || keys.ArrowDown || keys.arrowdown;

    const left = keys.KeyA || keys.a || keys.ArrowLeft || keys.arrowleft;

    const right = keys.KeyD || keys.d || keys.ArrowRight || keys.arrowright;

    if (up) dy -= 1;
    if (down) dy += 1;
    if (left) dx -= 1;
    if (right) dx += 1;

    return { dx, dy };
  }

  function getKeyboardMovementVector() {
    const raw = getRawKeyboardVector();

    if (raw.dx === 0 && raw.dy === 0) {
      return {
        dx: 0,
        dy: 0,
      };
    }

    const transformed = window.rendererSystem?.transformMovementVector?.(
      raw.dx,
      raw.dy,
    );

    if (
      transformed &&
      Number.isFinite(transformed.dx) &&
      Number.isFinite(transformed.dy)
    ) {
      return transformed;
    }

    return raw;
  }

  function getJoystickMovementVector() {
    if (!isMobile || !window.joystickSystem?.getDirection) {
      return {
        dx: 0,
        dy: 0,
        active: false,
      };
    }

    const joystick = window.joystickSystem.getDirection();

    if (
      !joystick ||
      !Number.isFinite(joystick.dx) ||
      !Number.isFinite(joystick.dy)
    ) {
      return {
        dx: 0,
        dy: 0,
        active: false,
      };
    }

    if (!joystick.active) {
      return {
        dx: joystick.dx,
        dy: joystick.dy,
        active: false,
      };
    }

    const transformed = window.rendererSystem?.transformMovementVector?.(
      joystick.dx,
      joystick.dy,
    );

    if (
      transformed &&
      Number.isFinite(transformed.dx) &&
      Number.isFinite(transformed.dy)
    ) {
      return {
        dx: transformed.dx,
        dy: transformed.dy,
        active: true,
      };
    }

    return {
      dx: joystick.dx,
      dy: joystick.dy,
      active: true,
    };
  }

  function getFacingInputMode() {
    return pointerState.facingInputMode;
  }

  function isKeyDown(codeOrKey) {
    if (typeof codeOrKey !== "string") {
      return false;
    }

    return Boolean(keys[codeOrKey] || keys[codeOrKey.toLowerCase()]);
  }

  function emit(type, payload) {
    const eventListeners = listeners[type];

    if (!eventListeners) {
      return;
    }

    for (const listener of eventListeners) {
      try {
        listener(payload);
      } catch (error) {
        console.error(`[InputSystem] ${type} listener failed:`, error);
      }
    }
  }

  function on(type, listener) {
    const eventListeners = listeners[type];

    if (!eventListeners || typeof listener !== "function") {
      return () => {};
    }

    eventListeners.add(listener);

    return () => {
      eventListeners.delete(listener);
    };
  }

  function createPointerPayload(event, pointerType, clientX, clientY) {
    return {
      pointerType,

      button: typeof event.button === "number" ? event.button : 0,

      clientX,
      clientY,

      originalEvent: event,
    };
  }

  function handleMouseDown(event) {
    updatePointer(event.clientX, event.clientY, {
      pointerType: "mouse",
    });

    emit(
      "pointerdown",
      createPointerPayload(event, "mouse", event.clientX, event.clientY),
    );
  }

  function handleMouseMove(event) {
    updatePointer(event.clientX, event.clientY, {
      pointerType: "mouse",
    });

    emit(
      "pointermove",
      createPointerPayload(event, "mouse", event.clientX, event.clientY),
    );
  }

  function handleMouseUp(event) {
    updatePointer(event.clientX, event.clientY, {
      pointerType: "mouse",
    });

    emit(
      "pointerup",
      createPointerPayload(event, "mouse", event.clientX, event.clientY),
    );
  }

  function getPrimaryTouch(event) {
    return event.touches?.[0] || event.changedTouches?.[0] || null;
  }

  function handleTouchStart(event) {
    const touch = getPrimaryTouch(event);

    if (!touch) return;

    updatePointer(touch.clientX, touch.clientY, {
      pointerType: "touch",
    });

    emit(
      "touchstart",
      createPointerPayload(event, "touch", touch.clientX, touch.clientY),
    );
  }

  function handleTouchMove(event) {
    const touch = getPrimaryTouch(event);

    if (!touch) return;

    updatePointer(touch.clientX, touch.clientY, {
      pointerType: "touch",
    });

    emit(
      "touchmove",
      createPointerPayload(event, "touch", touch.clientX, touch.clientY),
    );
  }

  function handleTouchEnd(event) {
    const touch = getPrimaryTouch(event);

    const clientX = touch?.clientX ?? pointerState.clientX;

    const clientY = touch?.clientY ?? pointerState.clientY;

    emit("touchend", createPointerPayload(event, "touch", clientX, clientY));
  }

  function bindCanvas(canvas) {
    if (!canvas) {
      return;
    }

    canvas.addEventListener("mousedown", handleMouseDown);

    canvas.addEventListener("mousemove", handleMouseMove);

    canvas.addEventListener("mouseup", handleMouseUp);

    canvas.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });

    canvas.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });

    canvas.addEventListener("touchend", handleTouchEnd, {
      passive: false,
    });

    canvas.addEventListener("touchcancel", handleTouchEnd, {
      passive: false,
    });
  }

  function initialize() {
    if (initialized) {
      return true;
    }

    const gameCanvas = document.getElementById("gameCanvas");

    const game3DCanvas = document.getElementById("game3DCanvas");

    if (!gameCanvas) {
      console.error("[InputSystem] gameCanvas not found.");

      return false;
    }

    bindCanvas(gameCanvas);
    bindCanvas(game3DCanvas);

    window.addEventListener("keydown", handleKeyDown);

    window.addEventListener("keyup", handleKeyUp);

    window.addEventListener("blur", handleWindowBlur);

    if (isMobile && window.joystickSystem?.initialize) {
      window.joystickSystem.initialize();
    }

    initialized = true;

    console.log("[InputSystem] Initialized.");

    return true;
  }

  window.inputSystem = Object.freeze({
    initialize,

    on,

    updatePointer,
    refreshPointerWorld,

    screenToWorld,

    getPointerClient,
    getPointerCanvas,
    getPointerWorld,
    getViewportCenterWorld,

    getRawKeyboardVector,
    getKeyboardMovementVector,
    getJoystickMovementVector,

    getFacingInputMode,
    isKeyDown,

    getActiveCanvas,

    isMobile,
  });
})();
