(function () {
  "use strict";

  const EMPTY_ARRAY = Object.freeze([]);

  let provider = null;

  function isValidProvider(candidate) {
    if (!candidate || typeof candidate !== "object") {
      return false;
    }

    const requiredMethods = [
      "getCurrentWorldId",
      "getWorldById",
      "getTileSize",
      "ensureWorldLoaded",
      "getLayerTiles",
      "getTransitionZones",
      "getStaticGeometry",
      "getScene",
    ];

    return requiredMethods.every(
      (method) => typeof candidate[method] === "function",
    );
  }

  function register(candidate) {
    if (!isValidProvider(candidate)) {
      console.error("[WorldSceneSystem] Invalid world provider.");
      return false;
    }

    if (provider && provider !== candidate) {
      console.error("[WorldSceneSystem] World provider already registered.");
      return false;
    }

    provider = candidate;
    return true;
  }

  function isReady() {
    return provider !== null;
  }

  function getCurrentWorldId() {
    return provider?.getCurrentWorldId() ?? null;
  }

  function getWorldById(worldId) {
    return provider?.getWorldById(worldId) ?? null;
  }

  function getCurrentWorld() {
    const worldId = getCurrentWorldId();

    if (worldId === null) {
      return null;
    }

    return getWorldById(worldId);
  }

  function getTileSize() {
    const tileSize = Number(provider?.getTileSize());

    return Number.isFinite(tileSize) && tileSize > 0 ? tileSize : 128;
  }

  function ensureWorldLoaded(worldId = getCurrentWorldId()) {
    if (!provider || worldId === null || !Number.isInteger(worldId)) {
      return false;
    }

    return provider.ensureWorldLoaded(worldId) === true;
  }

  function getLayerTiles(layerName, worldId = getCurrentWorldId()) {
    if (!provider || worldId === null || !Number.isInteger(worldId)) {
      return EMPTY_ARRAY;
    }

    const tiles = provider.getLayerTiles(layerName, worldId);

    return Array.isArray(tiles) ? tiles : EMPTY_ARRAY;
  }

  function getTransitionZones(worldId = getCurrentWorldId()) {
    if (!provider || worldId === null) {
      return EMPTY_ARRAY;
    }

    const zones = provider.getTransitionZones(worldId);

    return Array.isArray(zones) ? zones : EMPTY_ARRAY;
  }

  function getStaticGeometry(worldId = getCurrentWorldId()) {
    if (!provider || worldId === null || !Number.isInteger(worldId)) {
      return EMPTY_ARRAY;
    }

    const geometry = provider.getStaticGeometry(worldId);

    return Array.isArray(geometry) ? geometry : EMPTY_ARRAY;
  }

  function getScene() {
    return provider?.getScene() ?? null;
  }

  window.worldSceneSystem = Object.freeze({
    register,
    isReady,

    getCurrentWorldId,
    getCurrentWorld,
    getWorldById,

    getTileSize,

    ensureWorldLoaded,

    getLayerTiles,
    getTransitionZones,
    getStaticGeometry,

    getScene,
  });
})();
