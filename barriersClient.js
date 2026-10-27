const BARRIER_COLLISION_RADIUS = 30;

window.barriersSystem = {
  /** @type {Map<number, Array<{x1:number,y1:number,x2:number,y2:number}>>} */
  barriers: new Map(),
  draftBarriers: new Map(),
  plannedDeletions: new Map(),
  serverRevisionByWorld: new Map(),
  pendingApplyRequest: null,

  // ─── Debug / live-edit layer (client-only) ─────────────────────────
  debug: {
    enabled: false,
    editMode: false,
    pendingPoint: null,
    showLabels: true,
  },

  normalizeBarrierList(list) {
    if (!Array.isArray(list)) return [];
    const result = [];

    for (const barrier of list) {
      if (
        !barrier ||
        !Number.isFinite(barrier.x1) ||
        !Number.isFinite(barrier.y1) ||
        !Number.isFinite(barrier.x2) ||
        !Number.isFinite(barrier.y2)
      ) {
        continue;
      }

      result.push({
        x1: barrier.x1,
        y1: barrier.y1,
        x2: barrier.x2,
        y2: barrier.y2,
      });
    }

    return result;
  },

  getServerBarriersForWorld(worldId) {
    return this.normalizeBarrierList(this.barriers.get(worldId) || []);
  },

  getLocalDraftForWorld(worldId) {
    return this.normalizeBarrierList(this.draftBarriers.get(worldId) || []);
  },

  getPlannedDeletionsForWorld(worldId) {
    return this.normalizeBarrierList(this.plannedDeletions.get(worldId) || []);
  },

  setLocalDraftForWorld(worldId, barriers) {
    const normalized = this.normalizeBarrierList(barriers);
    if (normalized.length === 0) {
      this.draftBarriers.delete(worldId);
      return [];
    }

    this.draftBarriers.set(worldId, normalized);
    return normalized;
  },

  setPlannedDeletionsForWorld(worldId, barriers) {
    const normalized = this.normalizeBarrierList(barriers);
    if (normalized.length === 0) {
      this.plannedDeletions.delete(worldId);
      return [];
    }

    this.plannedDeletions.set(worldId, normalized);
    return normalized;
  },

  clearLocalDraftForWorld(worldId) {
    this.draftBarriers.delete(worldId);
    this.plannedDeletions.delete(worldId);
  },

  barrierIdentity(barrier) {
    if (!barrier) return "";
    const a = `${barrier.x1},${barrier.y1}`;
    const b = `${barrier.x2},${barrier.y2}`;
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  },

  getEffectiveBarriersForWorld(worldId) {
    const server = this.getServerBarriersForWorld(worldId);
    const local = this.getLocalDraftForWorld(worldId);
    const plannedDeletions = this.getPlannedDeletionsForWorld(worldId);
    const removalSet = new Set(
      plannedDeletions.map((barrier) => this.barrierIdentity(barrier)),
    );

    const filteredServer = server.filter(
      (barrier) => !removalSet.has(this.barrierIdentity(barrier)),
    );

    if (local.length > 0) {
      return [...filteredServer, ...local];
    }

    return filteredServer;
  },

  initialize() {
    window.addEventListener("keydown", (e) => {
      if (!this.debug.enabled) return;

      if (e.key === "b" || e.key === "B") {
        if (
          window.isChatInputFocused ||
          document.activeElement === document.getElementById("chatInput")
        )
          return;
        this.debug.editMode = !this.debug.editMode;
        this.debug.pendingPoint = null;
        console.log(
          `[barriers] editMode = ${this.debug.editMode ? "ON (кликай две точки)" : "OFF"}`,
        );
      }

      if (e.key === "e" || e.key === "E") {
        if (
          window.isChatInputFocused ||
          document.activeElement === document.getElementById("chatInput")
        )
          return;
        this.exportCurrentWorld();
      }

      if (e.key === "c" || e.key === "C") {
        if (
          window.isChatInputFocused ||
          document.activeElement === document.getElementById("chatInput")
        )
          return;
        this.clearCurrentWorld();
      }

      if (e.key === "z" || e.key === "Z") {
        if (
          window.isChatInputFocused ||
          document.activeElement === document.getElementById("chatInput")
        )
          return;
        this.undoLastBarrier();
      }
    });

    const canvas = document.getElementById("gameCanvas");
    if (canvas) {
      canvas.addEventListener("mousedown", (e) => {
        if (!this.debug.enabled || !this.debug.editMode) return;
        if (e.button !== 0) return;

        const cam = window.movementSystem?.getCamera?.() || { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const worldX = cam.x + (e.clientX - rect.left);
        const worldY = cam.y + (e.clientY - rect.top);

        if (!this.debug.pendingPoint) {
          this.debug.pendingPoint = { x: worldX, y: worldY };
          console.log(
            `[barriers] первая точка: ${worldX.toFixed(0)}, ${worldY.toFixed(0)}`,
          );
        } else {
          const p1 = this.debug.pendingPoint;
          this.addLocalBarrier(p1.x, p1.y, worldX, worldY);
          this.debug.pendingPoint = null;
          console.log(
            `[barriers] добавлен отрезок → ${p1.x.toFixed(0)},${p1.y.toFixed(0)} → ${worldX.toFixed(0)},${worldY.toFixed(0)}`,
          );
        }
      });
    }
  },

  onBarriersSync(data) {
    if (
      !data ||
      !Number.isSafeInteger(data.worldId) ||
      !Array.isArray(data.barriers)
    ) {
      return;
    }

    const barriers = this.normalizeBarrierList(data.barriers);
    this.barriers.set(data.worldId, barriers);

    if (
      Number.isSafeInteger(data.revision) &&
      data.revision >= 0 &&
      typeof data.worldId === "number"
    ) {
      this.serverRevisionByWorld.set(data.worldId, data.revision);
    }
  },

  handleApplyResult(data) {
    if (!data || !Number.isSafeInteger(data.worldId)) {
      return false;
    }

    if (data.success === true) {
      this.clearLocalDraftForWorld(data.worldId);
      if (Number.isSafeInteger(data.revision) && data.revision >= 0) {
        this.serverRevisionByWorld.set(data.worldId, data.revision);
      }
      return true;
    }

    if (data.error === "REVISION_CONFLICT") {
      this.pendingApplyRequest = null;
      return true;
    }

    return false;
  },

  wouldCrossBarrier(prevX, prevY, newX, newY) {
    const worldId = window.worldSystem?.currentWorldId;
    const barriers = this.getEffectiveBarriersForWorld(worldId) || [];
    if (barriers.length === 0) return false;

    const radius = BARRIER_COLLISION_RADIUS;
    const steps = 6;

    for (let j = 0; j < barriers.length; j++) {
      const b = barriers[j];
      if (
        pointToSegmentDistance(prevX, prevY, b.x1, b.y1, b.x2, b.y2) <= radius
      ) {
        return true;
      }
    }

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const checkX = prevX + (newX - prevX) * t;
      const checkY = prevY + (newY - prevY) * t;

      for (let j = 0; j < barriers.length; j++) {
        const b = barriers[j];
        if (
          pointToSegmentDistance(checkX, checkY, b.x1, b.y1, b.x2, b.y2) <=
          radius
        ) {
          return true;
        }
      }
    }

    return false;
  },

  draw() {
    const ctx = window.ctx;
    if (!ctx) return;

    const cam = window.movementSystem?.getCamera?.() || { x: 0, y: 0 };
    const worldId = window.worldSystem?.currentWorldId;
    const barriers = this.getEffectiveBarriersForWorld(worldId);

    ctx.save();
    ctx.strokeStyle = this.debug.editMode
      ? "rgba(0, 255, 120, 0.9)"
      : "rgba(255, 60, 60, 0.85)";
    ctx.lineWidth = 4;
    ctx.shadowColor = this.debug.editMode ? "#00ff88" : "red";
    ctx.shadowBlur = 8;

    for (let i = 0; i < barriers.length; i++) {
      const b = barriers[i];
      ctx.beginPath();
      ctx.moveTo(b.x1 - cam.x, b.y1 - cam.y);
      ctx.lineTo(b.x2 - cam.x, b.y2 - cam.y);
      ctx.stroke();

      if (this.debug.showLabels) {
        ctx.fillStyle = "#fff";
        ctx.font = "11px monospace";
        ctx.shadowBlur = 0;
        const mx = (b.x1 + b.x2) / 2 - cam.x;
        const my = (b.y1 + b.y2) / 2 - cam.y;
        ctx.fillText(String(i), mx + 4, my - 4);
      }
    }

    if (this.debug.pendingPoint) {
      const p = this.debug.pendingPoint;
      ctx.fillStyle = "#00ff88";
      ctx.beginPath();
      ctx.arc(p.x - cam.x, p.y - cam.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },

  // ─── Helpers для live-edit ─────────────────────────────────────────

  addLocalBarrier(x1, y1, x2, y2) {
    const worldId = window.worldSystem?.currentWorldId ?? 0;
    const list = this.getLocalDraftForWorld(worldId);
    list.push({
      x1: Math.round(x1),
      y1: Math.round(y1),
      x2: Math.round(x2),
      y2: Math.round(y2),
    });
    this.setLocalDraftForWorld(worldId, list);
  },

  clearCurrentWorld() {
    const worldId = window.worldSystem?.currentWorldId ?? 0;
    this.draftBarriers.set(worldId, []);
    this.plannedDeletions.delete(worldId);
    console.log(`[barriers] cleared world ${worldId}`);
  },

  undoLastBarrier() {
    const worldId = window.worldSystem?.currentWorldId ?? 0;
    const list = this.getLocalDraftForWorld(worldId);
    if (list.length === 0) {
      console.log(`[barriers] нечего отменять (world ${worldId})`);
      return;
    }
    const removed = list.pop();
    this.setLocalDraftForWorld(worldId, list);
    console.log(
      `[barriers] undo last: ${removed.x1},${removed.y1} → ${removed.x2},${removed.y2} (осталось ${list.length})`,
    );
  },

  exportCurrentWorld() {
    const worldId = window.worldSystem?.currentWorldId ?? 0;
    const list = this.getEffectiveBarriersForWorld(worldId);
    const json = JSON.stringify(list, null, 2);
    console.log(`===== BARRIERS worldId=${worldId} =====`);
    console.log(json);
    console.log("Скопируй массив и вставь в OBSTACLES_BY_WORLD на сервере");
    try {
      navigator.clipboard?.writeText(json);
      console.log("(также скопировано в clipboard)");
    } catch (_) {}
    return list;
  },

  enableDebug() {
    this.debug.enabled = true;
    this.debug.editMode = false;
    console.log(
      "[barriers] DEBUG ON. Клавиши: B — рисовать, Z — undo last, E — export, C — clear all",
    );
  },

  disableDebug() {
    this.debug.enabled = false;
    this.debug.editMode = false;
    this.debug.pendingPoint = null;
    console.log("[barriers] DEBUG OFF");
  },

  getBarriersForCurrentWorld() {
    const currentWorldId = window.worldSystem?.currentWorldId;
    return this.getEffectiveBarriersForWorld(currentWorldId);
  },
};

/**
 * Distance from point to segment (identical to server).
 */
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    return Math.hypot(px - x1, py - y1);
  }

  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = x1 + t * dx;
  const projY = y1 + t * dy;

  return Math.hypot(px - projX, py - projY);
}

// Авто-инициализация
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.barriersSystem.initialize();
  });
} else {
  window.barriersSystem.initialize();
}
