(function () {
  "use strict";

  let provider = null;

  function isValidProvider(candidate) {
    return (
      candidate !== null &&
      typeof candidate === "object" &&
      typeof candidate.getWorldScene === "function" &&
      typeof candidate.getEntityScene === "function"
    );
  }

  function register(candidate) {
    if (!isValidProvider(candidate)) {
      console.error("[EngineSceneBridge] Invalid scene provider.");
      return false;
    }

    if (provider && provider !== candidate) {
      console.error(
        "[EngineSceneBridge] A scene provider is already registered.",
      );
      return false;
    }

    provider = candidate;
    return true;
  }

  function getWorldScene() {
    return provider?.getWorldScene() ?? null;
  }

  function ensureWorldLoaded(worldId) {
    if (!provider || typeof provider.ensureWorldLoaded !== "function") {
      return false;
    }

    return provider.ensureWorldLoaded(worldId) === true;
  }

  function getEntityScene() {
    return provider?.getEntityScene() ?? null;
  }

  function isReady() {
    return provider !== null;
  }

  function getWorldId() {
    return getWorldScene()?.worldId ?? null;
  }

  function getWorldLayers() {
    return getWorldScene()?.layers ?? null;
  }

  function getStaticGeometry() {
    return getWorldScene()?.staticGeometry ?? null;
  }

  function getTransitionZones() {
    return getWorldScene()?.transitionZones ?? null;
  }

  function getEntities(category) {
    const scene = getEntityScene();

    if (!scene || !Object.prototype.hasOwnProperty.call(scene, category)) {
      return null;
    }

    const entities = scene[category];

    return Array.isArray(entities) ? entities : null;
  }

  function normalizeVisualEntity(entity, category) {
    if (!provider || typeof provider.normalizeVisualEntity !== "function") {
      return null;
    }

    return provider.normalizeVisualEntity(entity, category);
  }

  function resolveEntityVisual(entity, rendererMode = "3d", options = {}) {
    if (!provider || typeof provider.resolveEntityVisual !== "function") {
      return null;
    }

    return provider.resolveEntityVisual(entity, rendererMode, options);
  }

  function getLocalPlayer() {
    return provider?.getLocalPlayer?.() ?? null;
  }

  function getTargetableEnemies() {
    return provider?.getTargetableEnemies?.() ?? null;
  }

  function getCameraWorld() {
    return provider?.getCameraWorld?.() ?? null;
  }

  function getCameraBoundaryConfig(worldId) {
    return provider?.getCameraBoundaryConfig?.(worldId) ?? null;
  }

  function getCameraViewport() {
    return provider?.getCameraViewport?.() ?? null;
  }

  function getRenderCanvas(mode = "3d") {
    return provider?.getRenderCanvas?.(mode) ?? null;
  }

  function getCameraPlayerTarget(player) {
    return provider?.getCameraPlayerTarget?.(player) ?? null;
  }

  function changeCameraZoomByWheel(deltaY) {
    return provider?.changeCameraZoomByWheel?.(deltaY);
  }

  function getPlayerVisualConfig() {
    return provider?.getPlayerVisualConfig?.() ?? null;
  }

  function getPlayerGroundAnchor(gameX, gameY) {
    return provider?.getPlayerGroundAnchor?.(gameX, gameY) ?? null;
  }

  function getAreaAimPreview() {
    return provider?.getAreaAimPreview?.() ?? null;
  }

  function canCaptureGamePointer() {
    if (!provider || typeof provider.canCaptureGamePointer !== "function") {
      return false;
    }

    return provider.canCaptureGamePointer() === true;
  }

  window.engineSceneBridge = Object.freeze({
    register,
    getWorldScene,
    getEntityScene,
    ensureWorldLoaded,
    getWorldId,
    getWorldLayers,
    getStaticGeometry,
    getTransitionZones,
    getEntities,
    normalizeVisualEntity,
    resolveEntityVisual,
    getLocalPlayer,
    getTargetableEnemies,
    getCameraWorld,
    getCameraBoundaryConfig,
    getCameraViewport,
    getRenderCanvas,
    getCameraPlayerTarget,
    changeCameraZoomByWheel,
    getPlayerVisualConfig,
    getPlayerGroundAnchor,
    getAreaAimPreview,
    canCaptureGamePointer,
    isReady,
  });
})();
