(function () {
  "use strict";

  const DEFAULT_TARGET_FPS = 60;
  const MAX_DELTA_TIME = 250;

  let updateCallback = null;
  let renderCallback = null;
  let profilerProvider = null;

  let targetFps = DEFAULT_TARGET_FPS;
  let frameInterval = 1000 / DEFAULT_TARGET_FPS;

  let running = false;
  let animationFrameId = null;

  let lastFrameTime = 0;
  let lastProcessedTime = 0;

  function normalizeTargetFps(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return DEFAULT_TARGET_FPS;
    }

    return Math.max(1, Math.min(240, numericValue));
  }

  function configure(options = {}) {
    if (running) {
      console.warn(
        "[GameLoopSystem] configure() ignored while loop is running.",
      );
      return false;
    }

    if (typeof options.update !== "function") {
      console.error("[GameLoopSystem] configure() requires update callback.");
      return false;
    }

    if (typeof options.render !== "function") {
      console.error("[GameLoopSystem] configure() requires render callback.");
      return false;
    }

    updateCallback = options.update;
    renderCallback = options.render;

    profilerProvider =
      typeof options.profilerProvider === "function"
        ? options.profilerProvider
        : null;

    targetFps = normalizeTargetFps(options.targetFps);
    frameInterval = 1000 / targetFps;

    return true;
  }

  function resetTiming() {
    lastFrameTime = 0;
    lastProcessedTime = 0;
  }

  function scheduleNextFrame() {
    animationFrameId = requestAnimationFrame(frame);
  }

  function frame(timestamp) {
    if (!running) {
      animationFrameId = null;
      return;
    }

    if (lastFrameTime === 0) {
      lastFrameTime = timestamp;
    }

    if (lastProcessedTime === 0) {
      lastProcessedTime = timestamp;
    }

    const elapsedSinceProcessedFrame = timestamp - lastProcessedTime;
    const frameTolerance = Math.min(1, frameInterval * 0.05);

    if (elapsedSinceProcessedFrame < frameInterval - frameTolerance) {
      scheduleNextFrame();
      return;
    }

    let deltaTime = timestamp - lastFrameTime;

    if (!Number.isFinite(deltaTime) || deltaTime < 0) {
      deltaTime = 0;
    }

    deltaTime = Math.min(deltaTime, MAX_DELTA_TIME);

    lastFrameTime = timestamp;
    lastProcessedTime = timestamp;

    let profiler = null;

    if (profilerProvider) {
      try {
        profiler = profilerProvider();
      } catch (error) {
        console.error("[GameLoopSystem] Profiler provider failed:", error);
      }
    }

    profiler?.beginFrame?.(timestamp);

    try {
      profiler?.beginUpdate?.();

      try {
        updateCallback(deltaTime);
      } finally {
        profiler?.endUpdate?.();
      }

      profiler?.beginGameRender?.();

      try {
        renderCallback(deltaTime);
      } finally {
        profiler?.endGameRender?.();
      }
    } catch (error) {
      console.error("[GameLoopSystem] Frame execution failed:", error);
    } finally {
      profiler?.endFrame?.();
    }

    scheduleNextFrame();
  }

  function start() {
    if (running) {
      return false;
    }

    if (
      typeof updateCallback !== "function" ||
      typeof renderCallback !== "function"
    ) {
      console.error("[GameLoopSystem] Cannot start before configure().");
      return false;
    }

    running = true;
    resetTiming();

    scheduleNextFrame();

    console.log(`[GameLoopSystem] Started. Target FPS: ${targetFps}`);

    return true;
  }

  function stop() {
    if (!running && animationFrameId === null) {
      return false;
    }

    running = false;

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    resetTiming();

    console.log("[GameLoopSystem] Stopped.");

    return true;
  }

  function restart() {
    stop();
    return start();
  }

  function isRunning() {
    return running;
  }

  function getState() {
    return Object.freeze({
      running,
      targetFps,
      frameInterval,
      animationFrameId,
      lastFrameTime,
      lastProcessedTime,
    });
  }

  window.gameLoopSystem = Object.freeze({
    configure,
    start,
    stop,
    restart,

    isRunning,
    getState,
  });
})();
