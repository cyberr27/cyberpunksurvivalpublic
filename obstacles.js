// obstacles.js

// Формат: { worldId: number, x1, y1, x2, y2 }
window.obstacles = [];

// Очень простая функция проверки пересечения двух отрезков
// (используется и на клиенте, и на сервере — копия будет в двух местах)
function segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (denom === 0) return false; // параллельны

  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

// Для отладки на клиенте — рисуем красные линии
function drawObstacles(ctx, cameraX, cameraY, worldId) {
  ctx.save();
  ctx.strokeStyle = "red";
  ctx.lineWidth = 5;
  ctx.globalAlpha = 0.7;

  window.obstacles.forEach((obs) => {
    if (obs.worldId !== worldId) return;

    const sx1 = obs.x1 - cameraX;
    const sy1 = obs.y1 - cameraY;
    const sx2 = obs.x2 - cameraX;
    const sy2 = obs.y2 - cameraY;

    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    ctx.lineTo(sx2, sy2);
    ctx.stroke();
  });

  ctx.restore();
}

window.obstaclesSystem = {
  draw: drawObstacles,
  // Позже можно добавить getObstaclesForWorld(worldId) и т.д.
};
