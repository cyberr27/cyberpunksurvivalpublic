(function () {
  "use strict";

  const GEOMETRY_TYPES = Object.freeze({
    BOX: "box",
    MODEL: "model",
  });

  const EMPTY_ARRAY = Object.freeze([]);

  let nextGeneratedId = 1;

  // worldId -> Map<geometryId, descriptor>
  const geometryByWorld = new Map();

  // ============================================================
  // VALIDATION
  // ============================================================

  function isFiniteNumber(value) {
    return Number.isFinite(value);
  }

  function normalizeWorldId(worldId) {
    const numericWorldId = Number(worldId);

    return Number.isInteger(numericWorldId) && numericWorldId >= 0
      ? numericWorldId
      : null;
  }

  function normalizeId(id) {
    if (typeof id === "string" && id.trim()) {
      return id.trim();
    }

    if (Number.isFinite(id)) {
      return String(id);
    }

    return `static-geometry-${nextGeneratedId++}`;
  }

  function normalizePositiveNumber(value, fallback) {
    const numericValue = Number(value);

    return Number.isFinite(numericValue) && numericValue > 0
      ? numericValue
      : fallback;
  }

  function normalizeFiniteNumber(value, fallback = 0) {
    const numericValue = Number(value);

    return Number.isFinite(numericValue) ? numericValue : fallback;
  }

  // ============================================================
  // WORLD STORAGE
  // ============================================================

  function getWorldStore(worldId, createIfMissing = false) {
    const normalizedWorldId = normalizeWorldId(worldId);

    if (normalizedWorldId === null) {
      return null;
    }

    let store = geometryByWorld.get(normalizedWorldId);

    if (!store && createIfMissing) {
      store = new Map();

      geometryByWorld.set(normalizedWorldId, store);
    }

    return store || null;
  }

  function getCurrentWorldId() {
    const worldSceneSystem = window.worldSceneSystem;

    if (
      worldSceneSystem &&
      typeof worldSceneSystem.getCurrentWorldId === "function"
    ) {
      const worldId = worldSceneSystem.getCurrentWorldId();

      return normalizeWorldId(worldId);
    }

    const worldId = Number(window.worldSystem?.currentWorldId);

    return Number.isInteger(worldId) && worldId >= 0 ? worldId : null;
  }

  // ============================================================
  // BOX DESCRIPTOR
  // ============================================================

  function createBoxDescriptor(options = {}) {
    const worldId = normalizeWorldId(options.worldId);

    if (worldId === null) {
      console.warn(
        "[StaticGeometry] addBox rejected: invalid worldId.",
        options.worldId,
      );

      return null;
    }

    const x = Number(options.x);
    const y = Number(options.y);

    if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
      console.warn(
        "[StaticGeometry] addBox rejected: x/y must be finite numbers.",
        options,
      );

      return null;
    }

    const descriptor = {
      id: normalizeId(options.id),

      type: GEOMETRY_TYPES.BOX,

      worldId,

      x,
      y,

      baseHeight: normalizeFiniteNumber(options.baseHeight, 0),

      groundAlign: options.groundAlign !== false,

      groundOffset: normalizeFiniteNumber(options.groundOffset, 0),

      // Gameplay/world rotation around vertical axis.
      rotation: normalizeFiniteNumber(options.rotation, 0),

      visible: options.visible !== false,

      // Optional semantic metadata.
      tag:
        typeof options.tag === "string" && options.tag.trim()
          ? options.tag.trim()
          : null,

      userData:
        options.userData && typeof options.userData === "object"
          ? options.userData
          : null,
    };

    return Object.freeze(descriptor);
  }

  function normalizeLodLevels(levels, baseAssetUrl) {
    if (!Array.isArray(levels) || levels.length === 0) {
      return null;
    }

    if (levels.length > 8) {
      return null;
    }

    const result = [];

    for (const level of levels) {
      if (!level || typeof level !== "object") {
        return null;
      }

      const assetUrl =
        typeof level.assetUrl === "string" ? level.assetUrl.trim() : "";

      const distance = Number(level.distance);

      if (!assetUrl || !Number.isFinite(distance) || distance < 0) {
        return null;
      }

      result.push(Object.freeze({ assetUrl, distance }));
    }

    if (result[0].assetUrl !== baseAssetUrl || result[0].distance !== 0) {
      return null;
    }

    for (let i = 1; i < result.length; i++) {
      if (result[i].distance <= result[i - 1].distance) {
        return null;
      }
    }

    if (new Set(result.map((level) => level.assetUrl)).size !== result.length) {
      return null;
    }

    return Object.freeze(result);
  }

  function createModelDescriptor(options = {}) {
    const worldId = normalizeWorldId(options.worldId);

    if (worldId === null) {
      console.warn(
        "[StaticGeometry] addModel rejected: invalid worldId.",
        options.worldId,
      );

      return null;
    }

    const x = Number(options.x);
    const y = Number(options.y);

    if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
      console.warn(
        "[StaticGeometry] addModel rejected: x/y must be finite numbers.",
        options,
      );

      return null;
    }

    const assetUrl =
      typeof options.assetUrl === "string" ? options.assetUrl.trim() : "";

    if (!assetUrl) {
      console.warn(
        "[StaticGeometry] addModel rejected: assetUrl is required.",
        options,
      );

      return null;
    }

    const uniformScale = normalizePositiveNumber(options.scale, 1);

    const lodLevels =
      options.lodLevels == null
        ? null
        : normalizeLodLevels(options.lodLevels, assetUrl);

    if (options.lodLevels != null && !lodLevels) {
      console.warn(
        "[StaticGeometry] addModel rejected: invalid lodLevels.",
        options.id,
      );

      return null;
    }

    const descriptor = {
      id: normalizeId(options.id),

      type: GEOMETRY_TYPES.MODEL,

      worldId,

      assetUrl,

      lodLevels,

      // Gameplay position.
      x,
      y,

      // Vertical render offset from ground.
      baseHeight: normalizeFiniteNumber(options.baseHeight, 0),

      // Gameplay/world rotation around vertical axis.
      rotation: normalizeFiniteNumber(options.rotation, 0),

      // Model-space scale.
      scaleX: normalizePositiveNumber(options.scaleX, uniformScale),

      scaleY: normalizePositiveNumber(options.scaleY, uniformScale),

      scaleZ: normalizePositiveNumber(options.scaleZ, uniformScale),

      visible: options.visible !== false,

      tag:
        typeof options.tag === "string" && options.tag.trim()
          ? options.tag.trim()
          : null,

      userData:
        options.userData && typeof options.userData === "object"
          ? options.userData
          : null,
    };

    return Object.freeze(descriptor);
  }

  // ============================================================
  // PUBLIC MUTATION API
  // ============================================================

  function addBox(options = {}) {
    const descriptor = createBoxDescriptor(options);

    if (!descriptor) {
      return null;
    }

    const store = getWorldStore(descriptor.worldId, true);

    store.set(descriptor.id, descriptor);

    return descriptor;
  }

  function addModel(options = {}) {
    const descriptor = createModelDescriptor(options);

    if (!descriptor) {
      return null;
    }

    const store = getWorldStore(descriptor.worldId, true);

    store.set(descriptor.id, descriptor);

    return descriptor;
  }

  function remove(id, worldId = getCurrentWorldId()) {
    const normalizedWorldId = normalizeWorldId(worldId);

    if (normalizedWorldId === null) {
      return false;
    }

    const store = getWorldStore(normalizedWorldId, false);

    if (!store) {
      return false;
    }

    const removed = store.delete(String(id));

    if (store.size === 0) {
      geometryByWorld.delete(normalizedWorldId);
    }

    return removed;
  }

  function clearWorld(worldId = getCurrentWorldId()) {
    const normalizedWorldId = normalizeWorldId(worldId);

    if (normalizedWorldId === null) {
      return false;
    }

    return geometryByWorld.delete(normalizedWorldId);
  }

  function clearAll() {
    geometryByWorld.clear();

    return true;
  }

  // ============================================================
  // PUBLIC READ API
  // ============================================================

  function getGeometryForWorld(worldId = getCurrentWorldId()) {
    const normalizedWorldId = normalizeWorldId(worldId);

    if (normalizedWorldId === null) {
      return EMPTY_ARRAY;
    }

    const store = getWorldStore(normalizedWorldId, false);

    if (!store || store.size === 0) {
      return EMPTY_ARRAY;
    }

    return Array.from(store.values());
  }

  function getCurrentWorldGeometry() {
    return getGeometryForWorld(getCurrentWorldId());
  }

  function getById(id, worldId = getCurrentWorldId()) {
    const normalizedWorldId = normalizeWorldId(worldId);

    if (normalizedWorldId === null) {
      return null;
    }

    const store = getWorldStore(normalizedWorldId, false);

    if (!store) {
      return null;
    }

    return store.get(String(id)) || null;
  }

  function getCount(worldId = getCurrentWorldId()) {
    const normalizedWorldId = normalizeWorldId(worldId);

    if (normalizedWorldId === null) {
      return 0;
    }

    return getWorldStore(normalizedWorldId, false)?.size || 0;
  }

  // ============================================================
  // DEBUG / DEVELOPMENT HELPERS
  // ============================================================

  function addTestBox({
    worldId = getCurrentWorldId(),
    x,
    y,
    width = 80,
    depth = 80,
    height = 100,
    rotation = 0,
  } = {}) {
    return addBox({
      id: `debug-box-${Date.now()}`,

      type: GEOMETRY_TYPES.BOX,

      worldId,

      x,
      y,

      width,
      depth,
      height,

      baseHeight: 0,

      rotation,

      tag: "debug",
    });
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  window.staticGeometrySystem = Object.freeze({
    GEOMETRY_TYPES,

    addBox,
    addModel,

    remove,
    clearWorld,
    clearAll,

    getById,
    getGeometryForWorld,
    getCurrentWorldGeometry,
    getCount,

    addTestBox,
  });
})();
