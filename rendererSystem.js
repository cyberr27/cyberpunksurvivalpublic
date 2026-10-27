//rendererSystem.setMode("2d")
//rendererSystem.setMode("3d")

(function () {
  "use strict";

  const RENDERER_MODE = Object.freeze({
    TWO_D: "2d",
    THREE_D: "3d",
  });

  let activeMode = RENDERER_MODE.TWO_D;
  let transitionToken = 0;

  let screenToWorld2DProvider = null;

  function set2DScreenToWorldProvider(provider) {
    if (provider !== null && typeof provider !== "function") {
      console.error(
        "[RendererSystem] 2D screenToWorld provider must be a function.",
      );

      return false;
    }

    screenToWorld2DProvider = provider;

    return true;
  }

  function normalizeMode(mode) {
    return mode === RENDERER_MODE.THREE_D
      ? RENDERER_MODE.THREE_D
      : RENDERER_MODE.TWO_D;
  }

  function getMode() {
    return activeMode;
  }

  function is2D() {
    return activeMode === RENDERER_MODE.TWO_D;
  }

  function is3D() {
    return activeMode === RENDERER_MODE.THREE_D;
  }

  function getActiveCanvas() {
    return window.engineSceneBridge?.getRenderCanvas?.(getMode()) ?? null;
  }

  function syncCanvasVisibility() {
    const gameCanvas =
      window.engineSceneBridge?.getRenderCanvas?.("2d") ?? null;
    const game3DCanvas =
      window.engineSceneBridge?.getRenderCanvas?.("3d") ?? null;

    if (gameCanvas) {
      gameCanvas.style.display = is2D() ? "block" : "none";
    }

    if (game3DCanvas) {
      game3DCanvas.style.display = is3D() ? "block" : "none";
    }
  }

  function applyMode(mode) {
    const requestedMode = normalizeMode(mode);

    if (requestedMode === RENDERER_MODE.THREE_D) {
      const renderer3D = window.vanilla3DRenderer;

      if (!renderer3D || typeof renderer3D.setEnabled !== "function") {
        console.error(
          "[RendererSystem] 3D renderer is unavailable. Falling back to 2D.",
        );

        activeMode = RENDERER_MODE.TWO_D;

        syncCanvasVisibility();

        return false;
      }

      renderer3D.setEnabled(true);

      const rendererState = renderer3D.getState?.();

      if (!rendererState?.enabled) {
        console.error(
          "[RendererSystem] 3D renderer failed to initialize. Falling back to 2D.",
        );

        activeMode = RENDERER_MODE.TWO_D;

        renderer3D.setEnabled(false);
        syncCanvasVisibility();

        return false;
      }

      activeMode = RENDERER_MODE.THREE_D;

      syncCanvasVisibility();

      return true;
    }

    activeMode = RENDERER_MODE.TWO_D;

    window.vanilla3DRenderer?.setEnabled?.(false);

    syncCanvasVisibility();

    return true;
  }

  function setMode(mode) {
    const requestedMode = normalizeMode(mode);

    if (requestedMode === RENDERER_MODE.TWO_D) {
      ++transitionToken;
    }

    if (requestedMode === activeMode) {
      return applyMode(requestedMode);
    }

    const previousMode = activeMode;

    if (!applyMode(requestedMode)) {
      return false;
    }

    window.dispatchEvent(
      new CustomEvent("rendererModeChanged", {
        detail: {
          previousMode,
          mode: activeMode,
        },
      }),
    );

    console.log(
      `[RendererSystem] Renderer switched: ${previousMode} -> ${activeMode}`,
    );

    return true;
  }

  async function setModeAsync(mode) {
    const requestedMode = normalizeMode(mode);
    const token = ++transitionToken;

    if (requestedMode === RENDERER_MODE.TWO_D) {
      return setMode(requestedMode);
    }

    try {
      const loader = window.engine3DLoader;

      if (!loader || typeof loader.prepare !== "function") {
        throw new Error("3D loader is unavailable.");
      }

      await loader.prepare();

      if (token !== transitionToken) {
        return false;
      }

      if (!window.engineConfig?.applyDeferredGraphics?.()) {
        throw new Error("Could not apply 3D graphics settings.");
      }

      if (token !== transitionToken) {
        return false;
      }

      return setMode(requestedMode);
    } catch (error) {
      console.error("[RendererSystem] 3D preparation failed:", error);

      if (token === transitionToken) {
        setMode(RENDERER_MODE.TWO_D);
      }

      return false;
    }
  }

  function render(deltaTime, render2D) {
    if (is3D()) {
      const renderer3D = window.vanilla3DRenderer;

      if (!renderer3D || typeof renderer3D.render !== "function") {
        console.error(
          "[RendererSystem] Active 3D renderer has no render() method.",
        );

        setMode(RENDERER_MODE.TWO_D);

        if (typeof render2D === "function") {
          render2D(deltaTime);
        }

        return;
      }

      renderer3D.render(deltaTime);
      return;
    }

    if (typeof render2D === "function") {
      render2D(deltaTime);
    }
  }

  function screenToWorld3D(clientX, clientY) {
    if (!is3D()) {
      return null;
    }

    const renderer3D = window.vanilla3DRenderer;

    if (!renderer3D || typeof renderer3D.screenToWorld !== "function") {
      return null;
    }

    const worldPosition = renderer3D.screenToWorld(clientX, clientY);

    if (
      !worldPosition ||
      !Number.isFinite(worldPosition.x) ||
      !Number.isFinite(worldPosition.y)
    ) {
      return null;
    }

    return worldPosition;
  }

  function screenToWorld(clientX, clientY) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return null;
    }

    if (is3D()) {
      return screenToWorld3D(clientX, clientY);
    }

    if (typeof screenToWorld2DProvider !== "function") {
      return null;
    }

    const worldPosition = screenToWorld2DProvider(clientX, clientY);

    if (
      !worldPosition ||
      !Number.isFinite(worldPosition.x) ||
      !Number.isFinite(worldPosition.y)
    ) {
      return null;
    }

    return worldPosition;
  }

  function get3DState() {
    if (!is3D()) {
      return null;
    }

    return window.vanilla3DRenderer?.getState?.() ?? null;
  }

  function transformMovementVector(inputX, inputY) {
    if (!Number.isFinite(inputX) || !Number.isFinite(inputY)) {
      return {
        dx: 0,
        dy: 0,
      };
    }

    if (!is3D()) {
      return {
        dx: inputX,
        dy: inputY,
      };
    }

    if (get3DCameraMode() === "isometric") {
      return {
        dx: inputX,
        dy: inputY,
      };
    }

    const cameraState = get3DState();

    const position = cameraState?.position;
    const target = cameraState?.target;

    if (
      !Array.isArray(position) ||
      !Array.isArray(target) ||
      !Number.isFinite(position[0]) ||
      !Number.isFinite(position[2]) ||
      !Number.isFinite(target[0]) ||
      !Number.isFinite(target[2])
    ) {
      return {
        dx: inputX,
        dy: inputY,
      };
    }

    let forwardRenderX = target[0] - position[0];
    let forwardRenderZ = target[2] - position[2];

    const forwardLength = Math.hypot(forwardRenderX, forwardRenderZ);

    if (forwardLength < 0.000001) {
      return {
        dx: inputX,
        dy: inputY,
      };
    }

    forwardRenderX /= forwardLength;
    forwardRenderZ /= forwardLength;

    const rightRenderX = -forwardRenderZ;
    const rightRenderZ = forwardRenderX;

    const forwardInput = -inputY;
    const rightInput = inputX;

    let movementRenderX =
      forwardRenderX * forwardInput + rightRenderX * rightInput;

    let movementRenderZ =
      forwardRenderZ * forwardInput + rightRenderZ * rightInput;

    const length = Math.hypot(movementRenderX, movementRenderZ);

    if (length > 0.000001) {
      movementRenderX /= length;
      movementRenderZ /= length;
    }

    const gameVector = window.coordinateSystem3D?.renderToGameVector?.(
      movementRenderX,
      0,
      movementRenderZ,
    );

    if (!gameVector) {
      return {
        dx: inputX,
        dy: inputY,
      };
    }

    return {
      dx: gameVector.dx,
      dy: gameVector.dy,
    };
  }

  function set3DCameraMode(mode) {
    const renderer3D = window.vanilla3DRenderer;

    if (!renderer3D || typeof renderer3D.setCameraMode !== "function") {
      console.error(
        "[RendererSystem] Active 3D renderer has no camera mode API.",
      );

      return false;
    }

    return renderer3D.setCameraMode(mode);
  }

  function get3DCameraMode() {
    const renderer3D = window.vanilla3DRenderer;

    if (!renderer3D || typeof renderer3D.getCameraMode !== "function") {
      return null;
    }

    return renderer3D.getCameraMode();
  }

  function pickEnemy(clientX, clientY) {
    if (!is3D()) {
      return null;
    }

    const renderer3D = window.vanilla3DRenderer;

    if (!renderer3D || typeof renderer3D.pickEnemy !== "function") {
      return null;
    }

    return renderer3D.pickEnemy(clientX, clientY);
  }

  function initialize() {
    const engineConfig = window.engineConfig;

    const startupMode =
      engineConfig?.getStartupRenderer?.() ?? RENDERER_MODE.TWO_D;

    activeMode = RENDERER_MODE.TWO_D;
    applyMode(RENDERER_MODE.TWO_D);

    if (engineConfig && !engineConfig.initialize()) {
      console.error("[RendererSystem] Engine configuration failed.");
    }

    if (startupMode === RENDERER_MODE.THREE_D) {
      void setModeAsync(RENDERER_MODE.THREE_D);
    }

    console.log(`[RendererSystem] Initialized in "${activeMode}" mode.`);
  }

  window.rendererSystem = Object.freeze({
    MODES: RENDERER_MODE,

    initialize,
    setMode,
    setModeAsync,

    getMode,
    is2D,
    is3D,

    getActiveCanvas,

    render,

    set2DScreenToWorldProvider,

    screenToWorld,
    screenToWorld3D,

    transformMovementVector,

    get3DState,

    set3DCameraMode,
    get3DCameraMode,

    pickEnemy,
  });

  function initializeRendererSystem() {
    window.rendererSystem.initialize();
  }

  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    initializeRendererSystem();
  } else {
    window.addEventListener("DOMContentLoaded", initializeRendererSystem, {
      once: true,
    });
  }
})();
