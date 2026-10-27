// droneSystem.js
// Три корпоративных дрона-шпиона в мире 0. Максимально лёгкие и плавные.
// Оптимизация: cap deltaTime, while для кадров, минимум операций в цикле.

window.droneSystem = (function () {
  const WORLD_ID = 0;
  const SPRITE_W = 70;
  const SPRITE_H = 70;
  const DRONE_FLIGHT_ELEVATION_3D = 700;
  const TOTAL_FRAMES = 13;
  const FRAME_MS = 120;
  const MAX_DELTA_TIME = 500; // Кап для dt — предотвращает догонялки и дёрганья

  let sprite = null;
  let drones = [];
  let initialized = false;

  // Кэшируем размер мира 0
  let worldSize = { w: 2800, h: 2800 };

  const updateWorldSize = () => {
    try {
      const ws = window.worldSystem;
      if (ws?.getWorldById) {
        const w = ws.getWorldById(WORLD_ID);
        if (w?.w && w?.h) worldSize = { w: w.w, h: w.h };
      } else if (ws?.worlds?.[WORLD_ID]) {
        const w = ws.worlds[WORLD_ID];
        if (w?.w && w?.h) worldSize = { w: w.w, h: w.h };
      }
    } catch (_) {}
  };

  const getRandomTarget = () => {
    const m = 400;
    return {
      x: m + Math.random() * (worldSize.w - 2 * m),
      y: m + Math.random() * (worldSize.h - 2 * m),
    };
  };

  const createDrone = (startX, startY) => {
    const t = getRandomTarget();
    return {
      x: startX,
      y: startY,
      tx: t.x,
      ty: t.y,
      speed: 0.22 + Math.random() * 0.04,
      frame: Math.floor(Math.random() * TOTAL_FRAMES),
      ft: Math.random() * FRAME_MS,
      hover: 0,
      hoverDur: 3000 + Math.random() * 5000,
      state: Math.random() > 0.5 ? 1 : 0, // 0 = moving, 1 = hovering
    };
  };

  const initialize = (img) => {
    if (initialized) return;
    sprite = img;
    updateWorldSize();

    drones = [
      createDrone(1740, 568),
      createDrone(800, 1100),
      createDrone(800, 2600),
    ];

    initialized = true;
  };

  const update = (dt) => {
    if (!initialized || drones.length === 0) return;
    if (!window.worldSystem || window.worldSystem.currentWorldId !== WORLD_ID)
      return;

    // Капим deltaTime — ключ к плавности после сворачивания вкладки
    dt = Math.min(dt, MAX_DELTA_TIME);

    // Редко обновляем размер мира
    if (Math.random() < 0.001) updateWorldSize();

    for (let i = 0; i < drones.length; i++) {
      const d = drones[i];

      // Анимация кадров — используем while, чтобы не догонять пропущенное время
      d.ft += dt;
      while (d.ft >= FRAME_MS) {
        d.ft -= FRAME_MS;
        d.frame = (d.frame + 1) % TOTAL_FRAMES;
      }

      // Состояние зависания
      if (d.state === 1) {
        d.hover += dt;
        if (d.hover >= d.hoverDur) {
          d.state = 0;
          d.hover = 0;
          const t = getRandomTarget();
          d.tx = t.x;
          d.ty = t.y;
        }
        continue;
      }

      // Движение к цели
      const dx = d.tx - d.x;
      const dy = d.ty - d.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 8) {
        d.x = d.tx;
        d.y = d.ty;
        d.state = 1;
        d.hover = 0;
        d.hoverDur = 3000 + Math.random() * 5000;
        continue;
      }

      // Нормализованное движение с capped dt — плавно даже после паузы
      const move = (d.speed * dt) / dist;
      d.x += dx * move;
      d.y += dy * move;
    }
  };

  const draw = () => {
    if (!initialized || !sprite?.complete) return;
    if (!window.worldSystem || window.worldSystem.currentWorldId !== WORLD_ID)
      return;

    const cam = window.movementSystem.getCamera();
    const offsetX = -cam.x - SPRITE_W / 2;
    const offsetY = -cam.y - SPRITE_H / 2;

    for (let i = 0; i < drones.length; i++) {
      const d = drones[i];
      const sx = d.x + offsetX;
      const sy = d.y + offsetY;

      ctx.drawImage(
        sprite,
        d.frame * SPRITE_W,
        0,
        SPRITE_W,
        SPRITE_H,
        sx | 0,
        sy | 0,
        SPRITE_W,
        SPRITE_H,
      );
    }
  };

  function getRenderData(index) {
    if (!Number.isInteger(index)) {
      return null;
    }

    if (
      !initialized ||
      !window.worldSystem ||
      window.worldSystem.currentWorldId !== WORLD_ID ||
      !sprite?.complete ||
      sprite.naturalWidth <= 0 ||
      sprite.naturalHeight <= 0
    ) {
      return null;
    }

    const drone = drones[index];

    if (!drone || !Number.isFinite(drone.x) || !Number.isFinite(drone.y)) {
      return null;
    }

    return {
      id: `drone_${index}`,
      type: "npc",
      visualType: "billboard",
      elevation: DRONE_FLIGHT_ELEVATION_3D,

      x: drone.x - SPRITE_W / 2,
      y: drone.y - SPRITE_H / 2,

      worldId: WORLD_ID,

      sprite,

      frame: drone.frame,
      row: 0,

      frameCount: TOTAL_FRAMES,
      frameWidth: SPRITE_W,
      frameHeight: SPRITE_H,

      displayWidth: SPRITE_W,
      displayHeight: SPRITE_H,
    };
  }

  return {
    initialize,
    update,
    draw,
    getRenderData,
    isInitialized: () => initialized,
  };
})();

(function registerDroneVisualProviders() {
  "use strict";

  function registerDrones3D() {
    const scene = window.sceneEntitySystem;
    const droneSystem = window.droneSystem;

    if (
      typeof scene?.registerNPCVisualProvider !== "function" ||
      typeof scene?.getRegisteredNPCIds !== "function" ||
      typeof droneSystem?.getRenderData !== "function"
    ) {
      console.error("[Drone3D] Required visual provider API is unavailable.");

      return false;
    }

    const registered = new Set(scene.getRegisteredNPCIds());

    const DRONE_COUNT = 3;

    for (let i = 0; i < DRONE_COUNT; i++) {
      const id = `drone_${i}`;

      if (registered.has(id)) {
        continue;
      }

      // ВАЖНО:
      // Copilot реализовал реестр, принимающий ОБЪЕКТ
      // с методом getRenderData(), а не функцию.
      const success = scene.registerNPCVisualProvider(id, {
        getRenderData() {
          return droneSystem.getRenderData(i);
        },
      });

      if (!success) {
        console.error(`[Drone3D] Failed to register ${id}`);
      }
    }

    const droneIds = scene
      .getRegisteredNPCIds()
      .filter((id) => id.startsWith("drone_"));

    console.log("[Drone3D] Registered:", droneIds);

    return droneIds.length === DRONE_COUNT;
  }

  if (!registerDrones3D()) {
    window.addEventListener("load", registerDrones3D, { once: true });
  }
})();
