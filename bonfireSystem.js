// bonfireSystem.js — ультра-лёгкая версия (меньше памяти, меньше CPU, те же костры)

window.bonfireSystem = (function () {
  let bonfireImage = null;

  // Позиции костров (x, y) — центр костра = +35/+35
  const BONFIRES = [
    { x: 650, y: 40 },
    { x: 1900, y: 287 },
    { x: 30, y: 1628 },
    { x: 2020, y: 2730 },
    { x: 2720, y: 340 },
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

  return { initialize, update, draw };
})();
