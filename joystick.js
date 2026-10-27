// joystick.js
(function () {
  "use strict";

  const isMobile = window.innerWidth < 768 || "ontouchstart" in window;

  let joystickContainer = null;
  let outer = null;
  let inner = null;

  let centerX = 0;
  let centerY = 0;

  // Текущие "сырые" значения от touch
  let rawDx = 0;
  let rawDy = 0;

  // Сглаженные значения, которые отдаём наружу
  let smoothedDx = 0;
  let smoothedDy = 0;

  // Флаг активности (держим чуть дольше после отпускания)
  let isActive = false;
  let lastTouchTime = 0;
  const ACTIVITY_HOLD_MS = 120; // сколько миллисекунд считать джойстик активным после touchend

  let initialized = false;

  const radius = 60;
  const innerRadius = 30;
  const DEADZONE = 0.1; // минимальный порог ввода
  const SMOOTH_FACTOR = 0.25; // чем меньше — тем плавнее (0.15–0.3 оптимально)

  function initialize() {
    if (!isMobile || initialized) return;
    initialized = true;

    joystickContainer = document.createElement("div");
    joystickContainer.id = "joystickContainer";
    joystickContainer.className = "joystick-container";
    document.body.appendChild(joystickContainer);

    outer = document.createElement("div");
    outer.className = "joystick-outer";
    joystickContainer.appendChild(outer);

    inner = document.createElement("div");
    inner.className = "joystick-inner";
    outer.appendChild(inner);

    centerX = radius;
    centerY = radius;

    resetInnerPosition();

    outer.addEventListener("touchstart", onTouchStart, { passive: false });
    outer.addEventListener("touchmove", onTouchMove, { passive: false });
    outer.addEventListener("touchend", onTouchEnd, { passive: false });
    outer.addEventListener("touchcancel", onTouchEnd, { passive: false });
  }

  function onTouchStart(e) {
    e.preventDefault();
    isActive = true;
    lastTouchTime = Date.now();
    onTouchMove(e);
  }

  function onTouchMove(e) {
    if (!isActive) return;
    e.preventDefault();

    const touch = e.touches[0];
    const rect = outer.getBoundingClientRect();

    let x = touch.clientX - rect.left;
    let y = touch.clientY - rect.top;

    const offsetX = x - centerX;
    const offsetY = y - centerY;

    const distSq = offsetX * offsetX + offsetY * offsetY;
    const radiusSq = radius * radius;

    if (distSq > radiusSq) {
      const dist = Math.sqrt(distSq);
      const scale = radius / dist;
      x = centerX + offsetX * scale;
      y = centerY + offsetY * scale;
    }

    inner.style.left = x - innerRadius + "px";
    inner.style.top = y - innerRadius + "px";

    // Сохраняем "сырые" значения
    rawDx = (x - centerX) / radius;
    rawDy = (y - centerY) / radius;

    // Применяем deadzone
    const magnitude = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
    if (magnitude < DEADZONE) {
      rawDx = 0;
      rawDy = 0;
    }

    lastTouchTime = Date.now();
  }

  function onTouchEnd(e) {
    e.preventDefault();
    // Не сбрасываем сразу — держим активность ещё ACTIVITY_HOLD_MS
    rawDx = 0;
    rawDy = 0;
    resetInnerPosition();
  }

  function resetInnerPosition() {
    if (!inner) return;
    inner.style.left = centerX - innerRadius + "px";
    inner.style.top = centerY - innerRadius + "px";
  }

  // Вызывается каждый кадр из movementSystem.update()
  function updateSmoothing() {
    const now = Date.now();
    const stillActive = now - lastTouchTime < ACTIVITY_HOLD_MS;

    if (stillActive || rawDx !== 0 || rawDy !== 0) {
      isActive = true;

      // Линейная интерполяция (lerp) к текущему raw значению
      smoothedDx += (rawDx - smoothedDx) * SMOOTH_FACTOR;
      smoothedDy += (rawDy - smoothedDy) * SMOOTH_FACTOR;
    } else {
      // Плавно возвращаем к нулю, когда совсем отпустили
      smoothedDx += (0 - smoothedDx) * SMOOTH_FACTOR;
      smoothedDy += (0 - smoothedDy) * SMOOTH_FACTOR;

      if (Math.abs(smoothedDx) < 0.001) smoothedDx = 0;
      if (Math.abs(smoothedDy) < 0.001) smoothedDy = 0;

      if (smoothedDx === 0 && smoothedDy === 0) {
        isActive = false;
      }
    }
  }

  function getDirection() {
    updateSmoothing(); // вызываем каждый раз при запросе направления
    return { dx: smoothedDx, dy: smoothedDy, active: isActive };
  }

  window.joystickSystem = {
    initialize,
    getDirection,
    isMobile,
  };
})();
