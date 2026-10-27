// lights.js — обновлённая версия с поддержкой динамических огней (бочка и т.д.)

let lights = []; // Глобальный массив источников света

// Инициализация статичных огней Неонового Города
function initializeLights() {
  lights.length = 0;

  if (window.worldSystem.currentWorldId !== 0) {
    return; // Только в мире 0 (Неоновый Город)
  }

  const neonCityLights = [
    {
      x: 3428,
      y: 803,
      color: "rgba(0, 4, 255, 0.64)",
      radius: 1000,
      baseRadius: 1000,
      pulseSpeed: 0.002,
    },
    {
      x: 1536,
      y: 1953,
      color: "rgba(255, 0, 17, 0.53)",
      radius: 1000,
      baseRadius: 1000,
      pulseSpeed: 0.002,
    },
    {
      x: 546,
      y: 2332,
      color: "rgba(225, 0, 255, 0.49)",
      radius: 900,
      baseRadius: 900,
      pulseSpeed: 0.002,
    },
    {
      x: 2000,
      y: 550,
      color: "rgba(0, 110, 255, 0.56)",
      radius: 1250,
      baseRadius: 1250,
      pulseSpeed: 0.002,
    },
    {
      x: 2034,
      y: 2905,
      color: "rgba(0, 255, 98, 0.54)",
      radius: 1100,
      baseRadius: 1100,
      pulseSpeed: 0.002,
    },
    {
      x: 2850,
      y: 1991,
      color: "rgba(208, 0, 255, 0.64)",
      radius: 950,
      baseRadius: 950,
      pulseSpeed: 0.002,
    },
    {
      x: 650,
      y: 3450,
      color: "rgba(0, 17, 255, 0.31)",
      radius: 1500,
      baseRadius: 1500,
      pulseSpeed: 0.002,
    },
    {
      x: 3286,
      y: 3255,
      color: "rgba(191, 255, 0, 0.47)",
      radius: 1000,
      baseRadius: 1000,
      pulseSpeed: 0.002,
    },
    {
      x: 590,
      y: 750,
      color: "rgba(234, 255, 0, 0.66)",
      radius: 950,
      baseRadius: 950,
      pulseSpeed: 0.002,
    },
  ];

  lights.push(...neonCityLights);
}

// Отрисовка всех огней
function drawLights(deltaTime) {
  // Рисуем ВСЕ огни, даже если не в мире 0 — потому что бочка может быть везде может
  // (но если хочешь — оставь проверку, просто убери её, чтобы бочка светила)

  lights.forEach((light) => {
    // Пульсация
    const pulse =
      Math.sin(Date.now() * (light.pulseSpeed || 0.001)) *
      (light.pulseAmplitude || 50);
    const currentRadius = (light.baseRadius || light.radius) + pulse;

    // Мерцание (flicker)
    let alpha = parseFloat(light.color.split(",")[3] || 0.4);
    if (light.flicker) {
      alpha += (Math.random() - 0.5) * 0.15;
      alpha = Math.max(0.2, Math.min(0.1, alpha));
    }

    const screenX = light.x - window.movementSystem.getCamera().x;
    const screenY = light.y - window.movementSystem.getCamera().y;

    if (
      screenX + currentRadius > -100 &&
      screenX - currentRadius < canvas.width + 100 &&
      screenY + currentRadius > -100 &&
      screenY - currentRadius < canvas.height + 100
    ) {
      const gradient = ctx.createRadialGradient(
        screenX,
        screenY,
        0,
        screenX,
        screenY,
        currentRadius,
      );
      const colorWithAlpha = light.color.replace(/[\d\.]+\)$/, `${alpha})`);
      gradient.addColorStop(0, colorWithAlpha);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(screenX, screenY, currentRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// === НОВЫЕ МЕТОДЫ ДЛЯ ДИНАМИЧЕСКИХ ОГНЕЙ (бочка, факелы и т.д.) ===

function addLight(lightData) {
  // Удаляем старый, если уже был с таким id
  lights = lights.filter((l) => l.id !== lightData.id);
  lights.push({
    ...lightData,
    baseRadius: lightData.radius,
    pulseAmplitude: lightData.pulseAmplitude || 0,
    pulseSpeed: lightData.pulseSpeed || 0.001,
    flicker: lightData.flicker || false,
  });
}

function hasLight(id) {
  return lights.some((light) => light.id === id);
}

function updateLightPosition(id, x, y) {
  const light = lights.find((l) => l.id === id);
  if (light) {
    light.x = x;
    light.y = y;
  }
}

function removeLight(id) {
  lights = lights.filter((l) => l.id !== id);
}

// Сброс при смене мира
function resetLights(worldId) {
  // Удаляем только динамические огни (у которых есть id)
  lights = lights.filter((l) => !l.id);
  if (worldId === 0) {
    initializeLights();
  }
}

// Экспорт
window.lightsSystem = {
  initialize: initializeLights,
  draw: drawLights,
  reset: resetLights,
  addLight,
  hasLight,
  updateLightPosition,
  removeLight,
};
