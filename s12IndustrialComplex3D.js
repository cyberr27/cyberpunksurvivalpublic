(function () {
  "use strict";

  const BUILDING_ID = "s12-industrial-complex";
  const WORLD_ID = 0;
  const MODEL_URL = "models/s12IndustrialComplex_LOD0.glb";

  const LOD_LEVELS = Object.freeze([
    Object.freeze({
      assetUrl: MODEL_URL,
      distance: 0,
    }),
    Object.freeze({
      assetUrl: "models/s12IndustrialComplex_LOD1.glb",
      distance: 450,
    }),
    Object.freeze({
      assetUrl: "models/s12IndustrialComplex_LOD2.glb",
      distance: 900,
    }),
  ]);

  const DEFAULT_PLACEMENT = Object.freeze({
    x: 1000,
    y: 3100,
    rotation: 0,
    scale: 900,
    scaleX: 900,
    scaleY: 900,
    scaleZ: 900,
    baseHeight: 0,
  });

  let placement = { ...DEFAULT_PLACEMENT };

  function register() {
    const geometrySystem = window.staticGeometrySystem;

    if (!geometrySystem?.addModel) {
      console.error("[S12IndustrialComplex] staticGeometrySystem unavailable.");
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
        console.error("[S12IndustrialComplex] Invalid parameter:", key, value);
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

  window.s12IndustrialComplex3D = Object.freeze({
    register,
    setPlacement,
    getPlacement,
  });
})();
