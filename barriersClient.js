// public/barriersClient.js

window.barriersSystem = {
  barriers: new Map(), // worldId → array

  initialize() {
    // можно подписаться на событие смены мира, если захочешь
  },

  onBarriersSync(data) {
    this.barriers.set(data.worldId, data.barriers || []);
  },

  wouldCrossBarrier(prevX, prevY, newX, newY) {
    const barriers =
      this.barriers.get(window.worldSystem?.currentWorldId) || [];
    for (const b of barriers) {
      if (
        lineSegmentsIntersect(prevX, prevY, newX, newY, b.x1, b.y1, b.x2, b.y2)
      ) {
        return true;
      }
    }
    return false;
  },

  draw() {
    const ctx = window.ctx;
    if (!ctx) return;

    const cam = window.movementSystem?.getCamera?.() || { x: 0, y: 0 };
    const barriers =
      this.barriers.get(window.worldSystem?.currentWorldId) || [];

    ctx.save();
    ctx.strokeStyle = "rgba(255, 80, 80, 0.7)";
    ctx.lineWidth = 4;
    ctx.shadowColor = "red";
    ctx.shadowBlur = 8;

    for (const b of barriers) {
      ctx.beginPath();
      ctx.moveTo(b.x1 - cam.x, b.y1 - cam.y);
      ctx.lineTo(b.x2 - cam.x, b.y2 - cam.y);
      ctx.stroke();
    }
    ctx.restore();
  },
};

function lineSegmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const den = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (den === 0) return false;
  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / den;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / den;
  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}
