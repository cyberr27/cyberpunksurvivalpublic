(function () {
  "use strict";

  const CAMERA_MODE = Object.freeze({
    ORBIT: "orbit",
    ISOMETRIC: "isometric",
  });

  const DEFAULTS = Object.freeze({
    ORBIT_YAW: -Math.PI / 2,
    ORBIT_PITCH: 0.52,
    ORBIT_DISTANCE: 280,

    ISOMETRIC_YAW: Math.PI / 2,
    ISOMETRIC_PITCH: (45 * Math.PI) / 180,
    ISOMETRIC_DISTANCE: 420,

    MIN_DISTANCE: 140,
    MAX_DISTANCE: 1200,

    TARGET_HEIGHT: 18,
    CAMERA_HEIGHT_OFFSET: 40,

    ORBIT_YAW_SPEED: 0.005,
    ORBIT_PITCH_SPEED: 0.003,
    ZOOM_SPEED: 0.18,

    MIN_ORBIT_PITCH: 0.12,
    MAX_ORBIT_PITCH: 1.15,
  });

  let activeMode = CAMERA_MODE.ORBIT;

  const orbitState = {
    yaw: DEFAULTS.ORBIT_YAW,
    pitch: DEFAULTS.ORBIT_PITCH,
    distance: DEFAULTS.ORBIT_DISTANCE,
  };

  const isometricState = {
    yaw: DEFAULTS.ISOMETRIC_YAW,
    pitch: DEFAULTS.ISOMETRIC_PITCH,
    distance: DEFAULTS.ISOMETRIC_DISTANCE,
  };

  const resolvedState = {
    target: [0, 0, 0],
    position: [0, 0, 0],
  };

  const interactionState = {
    orbiting: false,

    lastPointerX: 0,
    lastPointerY: 0,
  };

  let inputBound = false;
  let inputCanvas = null;
  let canCaptureInputCallback = null;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function applyOrbitWorldBoundary(position, target) {
    if (!Array.isArray(position) || !Array.isArray(target)) {
      return;
    }

    const bridge = window.engineSceneBridge;
    const world = bridge?.getCameraWorld?.();

    if (
      !world ||
      !Number.isFinite(world.width) ||
      !Number.isFinite(world.height)
    ) {
      return;
    }

    const boundary = bridge?.getCameraBoundaryConfig?.(world.worldId);

    if (!boundary || boundary.enabled !== true) {
      return;
    }

    const worldMargin = Number(boundary.worldMargin);
    const wallClearance = Number(boundary.wallClearance);

    if (!Number.isFinite(worldMargin) || !Number.isFinite(wallClearance)) {
      return;
    }

    const margin = worldMargin + wallClearance;

    const minX = margin;
    const minZ = margin;

    const maxX = Math.max(minX, world.width - margin);
    const maxZ = Math.max(minZ, world.height - margin);

    if (
      !Number.isFinite(position[0]) ||
      !Number.isFinite(position[1]) ||
      !Number.isFinite(position[2])
    ) {
      return;
    }

    position[0] = clamp(position[0], minX, maxX);
    position[2] = clamp(position[2], minZ, maxZ);
  }

  function clampCameraCenterToWorld(
    desiredCenter,
    visibleHalfExtent,
    worldExtent,
  ) {
    if (
      !Number.isFinite(desiredCenter) ||
      !Number.isFinite(visibleHalfExtent) ||
      !Number.isFinite(worldExtent) ||
      worldExtent <= 0
    ) {
      return desiredCenter;
    }

    if (visibleHalfExtent * 2 >= worldExtent) {
      return worldExtent / 2;
    }

    return clamp(
      desiredCenter,
      visibleHalfExtent,
      worldExtent - visibleHalfExtent,
    );
  }

  function normalizeMode(mode) {
    return mode === CAMERA_MODE.ISOMETRIC
      ? CAMERA_MODE.ISOMETRIC
      : CAMERA_MODE.ORBIT;
  }

  function getModeState() {
    return activeMode === CAMERA_MODE.ISOMETRIC ? isometricState : orbitState;
  }

  function getMode() {
    return activeMode;
  }

  function getOrbitPlayerTarget(player) {
    return window.engineSceneBridge?.getCameraPlayerTarget?.(player) ?? null;
  }

  function isOrbit() {
    return activeMode === CAMERA_MODE.ORBIT;
  }

  function isIsometric() {
    return activeMode === CAMERA_MODE.ISOMETRIC;
  }

  function cancelInteraction() {
    interactionState.orbiting = false;
  }

  function setMode(mode) {
    const nextMode = normalizeMode(mode);

    if (nextMode === activeMode) {
      return true;
    }

    const previousMode = activeMode;

    activeMode = nextMode;

    // Нельзя продолжать старый RMB drag после смены camera mode.
    cancelInteraction();

    window.dispatchEvent(
      new CustomEvent("camera3DModeChanged", {
        detail: {
          previousMode,
          mode: activeMode,
        },
      }),
    );

    console.log(
      `[CameraSystem3D] Camera mode switched: ${previousMode} -> ${activeMode}`,
    );

    return true;
  }

  function updateFromPlayer(player) {
    const state = getModeState();

    const gameX = player && Number.isFinite(player.x) ? player.x : 0;
    const gameY = player && Number.isFinite(player.y) ? player.y : 0;

    const coordinateSystem = window.coordinateSystem3D;

    if (!coordinateSystem?.gameToRenderPosition) {
      return getState();
    }

    if (isIsometric()) {
      const viewport = window.engineSceneBridge?.getCameraViewport?.();

      const zoom = viewport?.zoom || 1;

      const camera2D = viewport?.hasCamera
        ? { x: viewport.cameraX, y: viewport.cameraY }
        : null;

      const canvas2D =
        viewport?.canvas2DWidth && viewport?.canvas2DHeight
          ? {
              width: viewport.canvas2DWidth,
              height: viewport.canvas2DHeight,
            }
          : null;

      const desiredCenterX =
        camera2D && canvas2D ? camera2D.x + canvas2D.width / (2 * zoom) : gameX;

      const desiredCenterY =
        camera2D && canvas2D
          ? camera2D.y + canvas2D.height / (2 * zoom)
          : gameY;

      const world = window.engineSceneBridge?.getCameraWorld?.();

      const worldWidth = world?.width;
      const worldHeight = world?.height;

      const viewportWidth = (viewport?.width || 1) / zoom;
      const viewportHeight = (viewport?.height || 1) / zoom;

      // По X поворота карты нет, поэтому ширина не меняется.
      const visibleHalfWidth = viewportWidth / 2;

      // Наклон увеличивает видимую глубину участка земли.
      // Защищаемся от деления на ноль.
      const sinPitch = Math.max(0.000001, Math.sin(isometricState.pitch));

      const visibleHalfDepth = viewportHeight / (2 * sinPitch);

      // Ограничиваем центр с учётом реальной видимой
      // области земли, а не только 2D viewport.
      const centerX = clampCameraCenterToWorld(
        desiredCenterX,
        visibleHalfWidth,
        worldWidth,
      );

      const centerY = clampCameraCenterToWorld(
        desiredCenterY,
        visibleHalfDepth,
        worldHeight,
      );

      resolvedState.target[0] = centerX;
      resolvedState.target[1] = 0;
      resolvedState.target[2] = centerY;

      const cameraDistance = 1000;
      const elevation = isometricState.pitch;

      resolvedState.position[0] = centerX;
      resolvedState.position[1] = Math.sin(elevation) * cameraDistance;
      resolvedState.position[2] =
        centerY + Math.cos(elevation) * cameraDistance;

      applyOrbitWorldBoundary(resolvedState.position, resolvedState.target);

      return getState();
    }

    const visualTarget = getOrbitPlayerTarget(player);

    // Если визуальная конфигурация недоступна,
    // сохраняем прежнее поведение камеры.
    const orbitGameX = visualTarget ? visualTarget.x : gameX;
    const orbitGameY = visualTarget ? visualTarget.y : gameY;

    const orbitTargetHeight = visualTarget
      ? visualTarget.height
      : DEFAULTS.TARGET_HEIGHT;

    const targetPosition = coordinateSystem.gameToRenderPosition(
      orbitGameX,
      orbitGameY,
      orbitTargetHeight,
    );

    if (!targetPosition) {
      return getState();
    }

    const targetX = targetPosition[0];
    const targetY = targetPosition[1];
    const targetZ = targetPosition[2];

    resolvedState.target[0] = targetX;
    resolvedState.target[1] = targetY;
    resolvedState.target[2] = targetZ;

    const horizontalDistance = Math.cos(state.pitch) * state.distance;

    resolvedState.position[0] =
      targetX + Math.cos(state.yaw) * horizontalDistance;

    resolvedState.position[1] =
      targetY +
      Math.sin(state.pitch) * state.distance +
      DEFAULTS.CAMERA_HEIGHT_OFFSET;

    resolvedState.position[2] =
      targetZ + Math.sin(state.yaw) * horizontalDistance;

    applyOrbitWorldBoundary(resolvedState.position, resolvedState.target);

    return getState();
  }

  function getState() {
    const state = getModeState();

    return {
      mode: activeMode,
      projection: isIsometric() ? "orthographic" : "perspective",

      yaw: state.yaw,
      pitch: state.pitch,
      distance: state.distance,

      minDistance: DEFAULTS.MIN_DISTANCE,
      maxDistance: DEFAULTS.MAX_DISTANCE,

      target: [
        resolvedState.target[0],
        resolvedState.target[1],
        resolvedState.target[2],
      ],

      position: [
        resolvedState.position[0],
        resolvedState.position[1],
        resolvedState.position[2],
      ],

      orbiting: activeMode === CAMERA_MODE.ORBIT && interactionState.orbiting,
    };
  }

  // ============================================================
  // RESET
  // ============================================================

  function resetOrbit() {
    orbitState.yaw = DEFAULTS.ORBIT_YAW;
    orbitState.pitch = DEFAULTS.ORBIT_PITCH;
    orbitState.distance = DEFAULTS.ORBIT_DISTANCE;
  }

  function resetIsometric() {
    isometricState.yaw = DEFAULTS.ISOMETRIC_YAW;
    isometricState.pitch = DEFAULTS.ISOMETRIC_PITCH;
    isometricState.distance = DEFAULTS.ISOMETRIC_DISTANCE;
  }

  function reset() {
    cancelInteraction();

    if (activeMode === CAMERA_MODE.ISOMETRIC) {
      resetIsometric();
    } else {
      resetOrbit();
    }

    console.log(`[CameraSystem3D] "${activeMode}" camera reset.`);

    return true;
  }

  // ============================================================
  // INPUT
  // ============================================================

  function canCaptureInput() {
    if (typeof canCaptureInputCallback === "function") {
      return canCaptureInputCallback() === true;
    }

    return true;
  }

  function handleContextMenu(event) {
    event.preventDefault();
  }

  function handleMouseDown(event) {
    if (event.button !== 2) {
      return;
    }

    // ISOMETRIC не должен свободно вращаться RMB.
    if (!isOrbit()) {
      return;
    }

    if (!canCaptureInput()) {
      return;
    }

    event.preventDefault();

    interactionState.orbiting = true;

    interactionState.lastPointerX = event.clientX;
    interactionState.lastPointerY = event.clientY;
  }

  function handleMouseUp(event) {
    if (event.button === 2 || interactionState.orbiting) {
      cancelInteraction();
    }
  }

  function handleMouseMove(event) {
    if (!isOrbit()) {
      cancelInteraction();
      return;
    }

    if (!interactionState.orbiting || !canCaptureInput()) {
      return;
    }

    const dx = event.clientX - interactionState.lastPointerX;

    const dy = event.clientY - interactionState.lastPointerY;

    interactionState.lastPointerX = event.clientX;
    interactionState.lastPointerY = event.clientY;

    orbitState.yaw -= dx * DEFAULTS.ORBIT_YAW_SPEED;

    orbitState.pitch = clamp(
      orbitState.pitch + dy * DEFAULTS.ORBIT_PITCH_SPEED,

      DEFAULTS.MIN_ORBIT_PITCH,
      DEFAULTS.MAX_ORBIT_PITCH,
    );
  }

  function handleWheel(event) {
    if (!canCaptureInput()) {
      return;
    }

    event.preventDefault();

    if (isIsometric()) {
      window.engineSceneBridge?.changeCameraZoomByWheel?.(event.deltaY);
      return;
    }

    // В orbit сохраняем прежнее приближение камеры.
    orbitState.distance = clamp(
      orbitState.distance + event.deltaY * DEFAULTS.ZOOM_SPEED,
      DEFAULTS.MIN_DISTANCE,
      DEFAULTS.MAX_DISTANCE,
    );
  }

  function handleWindowBlur() {
    cancelInteraction();
  }

  function attachInputHandlers(canvas, options = {}) {
    if (!canvas) {
      return false;
    }

    if (typeof options.canCaptureInput === "function") {
      canCaptureInputCallback = options.canCaptureInput;
    }

    // Один cameraSystem3D не должен навешивать
    // обработчики несколько раз.
    if (inputBound && inputCanvas === canvas) {
      return true;
    }

    // На текущем этапе game3DCanvas один и постоянный.
    // Если когда-нибудь renderer начнет заменять canvas,
    // это будет отдельная lifecycle-задача.
    if (inputBound && inputCanvas !== canvas) {
      console.warn(
        "[CameraSystem3D] Input is already bound to another canvas.",
      );

      return false;
    }

    inputCanvas = canvas;
    inputBound = true;

    canvas.addEventListener("contextmenu", handleContextMenu);

    canvas.addEventListener("mousedown", handleMouseDown);

    canvas.addEventListener("mousemove", handleMouseMove);

    canvas.addEventListener("wheel", handleWheel, {
      passive: false,
    });

    window.addEventListener("mouseup", handleMouseUp);

    window.addEventListener("blur", handleWindowBlur);

    return true;
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  window.cameraSystem3D = Object.freeze({
    MODES: CAMERA_MODE,

    setMode,
    getMode,

    isOrbit,
    isIsometric,

    updateFromPlayer,
    getState,

    reset,
    cancelInteraction,

    attachInputHandlers,
  });
})();
