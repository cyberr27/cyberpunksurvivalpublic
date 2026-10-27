// bonfireSystem.js — ультра-лёгкая версия (меньше памяти, меньше CPU, те же костры)

window.bonfireSystem = (function () {
  let bonfireImage = null;

  // Позиции костров (x, y) — центр костра = +35/+35
  const BONFIRES = [
    { x: 4040, y: 600 },
    { x: 3143, y: 1056 },
    { x: 2181, y: 4017 },
    { x: 236, y: 2918 },
    { x: 4016, y: 2309 },
  ];

  const FRAME_W = 70;
  const FRAME_H = 70;
  const TOTAL_FRAMES = 13;
  const FRAME_DURATION = 110; // ms на кадр

  // Один глобальный таймер + смещение фазы через простую формулу
  let globalTime = 0;

  // Кэшируем ссылки, чтобы не создавать объекты каждый кадр
  let lightsSystem = null;
  let cam = null;

  function initialize(sprite) {
    bonfireImage = sprite;
    lightsSystem = window.lightsSystem;

    if (window.worldSystem.currentWorldId !== 0) {
      return;
    }

    // Добавляем свет только один раз
    BONFIRES.forEach((b, i) => {
      const id = `bonfire_light_${i}`;
      if (!lightsSystem.hasLight(id)) {
        lightsSystem.addLight({
          id,
          x: b.x + 35,
          y: b.y + 35,
          color: "rgba(255,180,0,0.28)",
          radius: 135,
          pulseSpeed: 0.0017 + i * 0.0003, // разные скорости пульсации
          pulseAmplitude: 28,
          flicker: true,
        });
      }
    });
  }

  function update(deltaTime) {
    if (window.worldSystem.currentWorldId !== 0) return;
    if (!bonfireImage) return;
    globalTime += deltaTime;
  }

  function draw() {
    if (window.worldSystem.currentWorldId !== 0) return;
    if (!bonfireImage?.complete) return;

    // Кэшируем часто используемые значения один раз за кадр
    cam ??= window.movementSystem.getCamera();
    const camX = cam.x;
    const camY = cam.y;
    const canvasW = canvas.width;
    const canvasH = canvas.height;

    // Предвычисляем границы видимости (с небольшим буфером)
    const left = camX - 100;
    const right = camX + canvasW + 100;
    const top = camY - 100;
    const bottom = camY + canvasH + 100;

    let time = globalTime;

    BONFIRES.forEach((b, i) => {
      const screenX = b.x - camX;
      const screenY = b.y - camY;

      // Очень быстрый отсев невидимых костров
      if (
        screenX < -100 ||
        screenX > canvasW + 100 ||
        screenY < -100 ||
        screenY > canvasH + 100
      )
        return;

      // Смещение фазы без создания лишних объектов
      const frameIndex =
        Math.floor((time + i * 1234.567) / FRAME_DURATION) % TOTAL_FRAMES;

      ctx.drawImage(
        bonfireImage,
        frameIndex * FRAME_W, // sx
        0, // sy
        FRAME_W,
        FRAME_H, // sWidth, sHeight
        screenX | 0, // округление через побитовое И — быстрее Math.round
        screenY | 0,
        FRAME_W,
        FRAME_H,
      );
    });
  }

  function getBonfires() {
    return BONFIRES;
  }

  // ============================================================
  // 3D BILLBOARD VISUAL ADAPTER
  // ============================================================
  // Возвращает данные конкретной бочки для общего 3D-рендерера.
  // Не изменяет состояние анимации и не загружает текстуры.
  function getRenderData(index) {
    if (!Number.isInteger(index)) {
      return null;
    }

    const bonfire = BONFIRES[index];

    if (!bonfire) {
      return null;
    }

    if (
      window.worldSystem?.currentWorldId !== 0 ||
      !bonfireImage?.complete ||
      bonfireImage.naturalWidth <= 0 ||
      bonfireImage.naturalHeight <= 0
    ) {
      return null;
    }

    const frameIndex =
      Math.floor((globalTime + index * 1234.567) / FRAME_DURATION) %
      TOTAL_FRAMES;

    return {
      id: `bonfire_${index}`,
      type: "npc",
      visualType: "billboard",

      x: bonfire.x,
      y: bonfire.y,
      worldId: 0,

      sprite: bonfireImage,

      frame: frameIndex,
      row: 0,

      frameCount: TOTAL_FRAMES,
      frameWidth: FRAME_W,
      frameHeight: FRAME_H,

      displayWidth: FRAME_W,
      displayHeight: FRAME_H,
    };
  }

  function drawSprite(camX, camY, index) {
    if (window.worldSystem.currentWorldId !== 0) return;
    if (!bonfireImage?.complete) return;

    const b = BONFIRES[index];
    if (!b) return;

    const screenX = b.x - camX;
    const screenY = b.y - camY;

    if (
      screenX < -100 ||
      screenX > canvas.width + 100 ||
      screenY < -100 ||
      screenY > canvas.height + 100
    ) {
      return;
    }

    const frameIndex =
      Math.floor((globalTime + index * 1234.567) / FRAME_DURATION) %
      TOTAL_FRAMES;

    ctx.drawImage(
      bonfireImage,
      frameIndex * FRAME_W,
      0,
      FRAME_W,
      FRAME_H,
      screenX | 0,
      screenY | 0,
      FRAME_W,
      FRAME_H,
    );
  }

  return {
    initialize,
    update,
    draw,
    getBonfires,
    getRenderData,
    drawSprite,
  };
})();

// ============================================================
// BONFIRE 3D VISUAL PROVIDER REGISTRATION
// ============================================================

(function () {
  "use strict";

  function registerBonfires3D() {
    const scene = window.sceneEntitySystem;
    const bonfires = window.bonfireSystem;

    if (
      typeof scene?.registerNPCVisualProvider !== "function" ||
      typeof scene?.getRegisteredNPCIds !== "function" ||
      typeof bonfires?.getRenderData !== "function" ||
      typeof bonfires?.getBonfires !== "function"
    ) {
      console.error(
        "[Bonfire3D] Cannot register bonfires: required API is missing.",
      );
      return false;
    }

    const registered = new Set(scene.getRegisteredNPCIds());

    const count = bonfires.getBonfires().length;

    for (let i = 0; i < count; i++) {
      const id = `bonfire_${i}`;

      if (registered.has(id)) {
        continue;
      }

      const registeredSuccessfully = scene.registerNPCVisualProvider(id, {
        getRenderData() {
          return bonfires.getRenderData(i);
        },
      });

      if (!registeredSuccessfully) {
        console.error(`[Bonfire3D] Failed to register visual provider: ${id}`);
      }
    }

    console.log(
      "[Bonfire3D] Registered:",
      scene.getRegisteredNPCIds().filter((id) => id.startsWith("bonfire_")),
    );

    return true;
  }

  // Если система уже загружена — регистрируем сразу.
  // Если нет — повторяем после завершения загрузки страницы.
  if (!registerBonfires3D()) {
    window.addEventListener("load", registerBonfires3D, { once: true });
  }
})();
