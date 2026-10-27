(function () {
  "use strict";

  const WORLD_ID = 0;
  const WALL_TAG = "sector12-perimeter-wall";

  const MODEL_HIGH = "models/sector12PerimeterWall_high.png.glb";
  const MODEL_MEDIUM = "models/sector12PerimeterWall_medium.png.glb";

  const MODEL_LENGTH = 1.865;
  const MODEL_HEIGHT = 0.82;
  const MODEL_DEPTH = 0.302;

  const CONFIG = Object.freeze({
    worldId: WORLD_ID,
    segmentLength: 1024,
    wallHeight: 800,
    wallDepth: 400,
    outsideGap: 1,
    baseHeight: 0,
    enabled: true,
  });

  const LOD_LEVELS = Object.freeze([
    Object.freeze({
      assetUrl: MODEL_HIGH,
      distance: 0,
    }),
    Object.freeze({
      assetUrl: MODEL_MEDIUM,
      distance: 450,
    }),
  ]);

  function getWorldSize() {
    const world = window.worldSystem?.worlds?.find(
      (item) => item.id === WORLD_ID,
    );

    if (
      !world ||
      !Number.isFinite(world.w) ||
      !Number.isFinite(world.h) ||
      world.w <= 0 ||
      world.h <= 0
    ) {
      return null;
    }

    return {
      width: world.w,
      height: world.h,
    };
  }

  function createSegment(id, x, y, rotation, length) {
    return window.staticGeometrySystem.addModel({
      id,
      worldId: WORLD_ID,
      assetUrl: MODEL_HIGH,
      lodLevels: LOD_LEVELS,
      x,
      y,
      rotation,
      scaleX: length / MODEL_LENGTH,
      scaleY: CONFIG.wallHeight / MODEL_HEIGHT,
      scaleZ: CONFIG.wallDepth / MODEL_DEPTH,
      baseHeight: CONFIG.baseHeight,
      visible: true,
      tag: WALL_TAG,
    });
  }

  function registerSide(side, startX, startY, endX, endY) {
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.hypot(dx, dy);

    if (!Number.isFinite(length) || length <= 0) {
      return 0;
    }

    const count = Math.ceil(length / CONFIG.segmentLength);
    const stepX = dx / count;
    const stepY = dy / count;
    const segmentLength = length / count;

    const baseRotation = -Math.atan2(dy, dx);

    const rotation =
      side === "east" || side === "west"
        ? baseRotation + Math.PI
        : baseRotation;

    let registered = 0;

    for (let i = 0; i < count; i++) {
      const x = startX + stepX * (i + 0.5);
      const y = startY + stepY * (i + 0.5);

      const id = `sector12-perimeter-${side}-${i}`;

      const descriptor = createSegment(id, x, y, rotation, segmentLength);

      if (!descriptor) {
        return -1;
      }

      registered++;
    }

    return registered;
  }

  function register() {
    if (!CONFIG.enabled) {
      return false;
    }

    if (!window.staticGeometrySystem?.addModel) {
      return false;
    }

    const world = getWorldSize();

    if (!world) {
      return false;
    }

    const offset = CONFIG.wallDepth / 2 + CONFIG.outsideGap;
    const inwardShift = 100;

    const left = -offset + inwardShift;
    const right = world.width + offset - inwardShift;
    const top = -offset + inwardShift;
    const bottom = world.height + offset - inwardShift;
    const sides = [
      ["north", left, top, right, top],
      ["east", right, top, right, bottom],
      ["south", right, bottom, left, bottom],
      ["west", left, bottom, left, top],
    ];

    let total = 0;

    for (const [side, x1, y1, x2, y2] of sides) {
      const count = registerSide(side, x1, y1, x2, y2);

      if (count < 0) {
        console.error("[Perimeter] Registration failed:", side);
        return false;
      }

      total += count;
    }

    console.log(`[Perimeter] Registered ${total} wall sections.`);

    return true;
  }

  window.sector12PerimeterWall3D = Object.freeze({
    register,
    getConfig: () => ({ ...CONFIG }),
  });
})();
