(function () {
  "use strict";

  const BUILDING_ID = "s12-medcore";
  const WORLD_ID = 0;
  const MODEL_URL = "models/s12Medcore_LOD0.glb";

  const LOD_LEVELS = Object.freeze([
    Object.freeze({
      assetUrl: MODEL_URL,
      distance: 0,
    }),
    Object.freeze({
      assetUrl: "models/s12Medcore_LOD1.glb",
      distance: 450,
    }),
    Object.freeze({
      assetUrl: "models/s12Medcore_LOD2.glb",
      distance: 900,
    }),
  ]);

  const DEFAULT_PLACEMENT = Object.freeze({
    x: 2296,
    y: 2043,
    rotation: 0,
    scale: 500,
    scaleX: 500,
    scaleY: 500,
    scaleZ: 500,
    baseHeight: 0,
  });

  let placement = { ...DEFAULT_PLACEMENT };

  function register() {
    const geometrySystem = window.staticGeometrySystem;

    if (!geometrySystem?.addModel) {
      console.error("[S12Medcore] staticGeometrySystem unavailable.");
      return false;
    }

    const descriptor = geometrySystem.addModel({
      id: BUILDING_ID,
      worldId: WORLD_ID,
      assetUrl: MODEL_URL,
      lodLevels: LOD_LEVELS,

      x: placement.x,
      y: placement.y,

      rotation: placement.rotation,
      scale: placement.scale,
      scaleX: placement.scaleX,
      scaleY: placement.scaleY,
      scaleZ: placement.scaleZ,
      baseHeight: placement.baseHeight,

      visible: true,
      tag: BUILDING_ID,
      groundAlign: true,
    });

    return Boolean(descriptor);
  }

  function setPlacement(changes = {}) {
    if (!changes || typeof changes !== "object") {
      return false;
    }

    const next = { ...placement };

    for (const key of Object.keys(DEFAULT_PLACEMENT)) {
      if (!Object.prototype.hasOwnProperty.call(changes, key)) {
        continue;
      }

      const value = changes[key];

      if (!Number.isFinite(value)) {
        console.error("[S12Medcore] Invalid parameter:", key, value);
        return false;
      }

      if (
        (key === "scale" ||
          key === "scaleX" ||
          key === "scaleY" ||
          key === "scaleZ") &&
        (value < 1 || value > 5000)
      ) {
        return false;
      }

      next[key] = value;
    }

    if (Object.prototype.hasOwnProperty.call(changes, "scale")) {
      for (const axis of ["scaleX", "scaleY", "scaleZ"]) {
        if (!Object.prototype.hasOwnProperty.call(changes, axis)) {
          next[axis] = next.scale;
        }
      }
    }

    const previous = placement;
    placement = next;

    if (!register()) {
      placement = previous;
      return false;
    }

    return true;
  }

  function getPlacement() {
    return { ...placement };
  }

  window.s12Medcore3D = Object.freeze({
    register,
    setPlacement,
    getPlacement,
  });
})();
