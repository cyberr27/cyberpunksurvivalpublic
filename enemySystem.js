let enemies = new Map();
window.enemies = enemies;

// Конфиг типов врагов (заморожен для лучшей оптимизации)
const ENEMY_TYPES = Object.freeze({
  mutant: {
    size: 70,
    frames: 13,
    frameDuration: 110,
    maxHealth: 200,
    spriteKey: "mutantSprite",
    speed: 2,
    color: "#fbff00", // жёлто-зелёный для имени/типа
  },
  scorpion: {
    size: 70,
    frames: 13,
    frameDuration: 110,
    maxHealth: 250,
    spriteKey: "scorpionSprite",
    speed: 6,
    aggroRange: 300,
    attackCooldown: 1000,
    minDamage: 5,
    maxDamage: 10,
    color: "#00eaff", // голубой
  },
  blood_eye: {
    size: 70,
    frames: 13,
    frameDuration: 90,
    maxHealth: 300,
    spriteKey: "bloodEyeSprite",
    speed: 3.2,
    aggroRange: 300,
    attackCooldown: 2000,
    minDamage: 12,
    maxDamage: 18,
    color: "#ff0000",
  },
});

const ENEMY_VISUAL_CONFIG = Object.freeze({
  mutant: Object.freeze({
    mode: "billboard",
    model3D: null,
  }),

  scorpion: Object.freeze({
    mode: "billboard",
    model3D: null,
  }),

  blood_eye: Object.freeze({
    mode: "billboard",
    model3D: null,
  }),
});

// Цвета для полоски здоровья
const HP_COLORS = Object.freeze({
  low: "#8B0000",
  normal: "#ff0000",
  scorpion_low: "#005577",
  scorpion_normal: "#00eaff",
});

// ─── Вспомогательные константы ───────────────────────────────────────
const CULLING_MARGIN = 120;
const HITBOX_RADIUS_SQ = 40 * 40;
const MAX_DELTA_FOR_ANIMATION = 400; // мс — выше этого считаем "вкладка была свёрнута"
const ANIMATION_CATCHUP_THRESHOLD = 1200; // мс — если больше, вообще сбрасываем анимацию

// ─── Инициализация ───────────────────────────────────────────────────
function initializeEnemySystem() {}

// ─── Синхронизация врагов с сервера ──────────────────────────────────
function syncEnemies(serverEnemies) {
  if (window.selectedEnemyId) window.selectedEnemyId = null;

  const currentIds = new Set(enemies.keys());
  const incomingIds = new Set();

  for (const srv of serverEnemies) {
    const id = srv.id || srv.enemyId;
    if (!id) continue;

    incomingIds.add(id);

    if (srv.health <= 0) {
      enemies.delete(id);
      continue;
    }

    const type = srv.type || "mutant";
    const config = ENEMY_TYPES[type] || ENEMY_TYPES.mutant;

    let enemy = enemies.get(id);
    if (enemy) {
      enemy.x = Number(srv.x);
      enemy.y = Number(srv.y);
      enemy.health = Number(srv.health);
      enemy.direction = srv.direction || "down";
      enemy.state = srv.state || "idle";
      enemy.worldId = srv.worldId;
      enemy.walkFrame = 0;
      enemy.walkFrameTime = 0;
    } else {
      enemies.set(id, {
        id,
        x: Number(srv.x),
        y: Number(srv.y),
        health: Number(srv.health),
        maxHealth: config.maxHealth,
        direction: srv.direction || "down",
        state: srv.state || "idle",
        worldId: srv.worldId,
        type,
        walkFrame: 0,
        walkFrameTime: 0,
      });
    }
  }

  // Удаляем мобов, которых больше нет на сервере
  for (const id of currentIds) {
    if (!incomingIds.has(id)) {
      if (window.selectedEnemyId === id) window.selectedEnemyId = null;
      enemies.delete(id);
    }
  }
}

function handleEnemyDeath(enemyId) {
  if (window.selectedEnemyId === enemyId) {
    window.selectedEnemyId = null;
  }
  enemies.delete(enemyId);
}

function handleNewEnemy(enemyData) {
  if (enemyData.health <= 0) return;

  const type = enemyData.type || "mutant";
  const config = ENEMY_TYPES[type] || ENEMY_TYPES.mutant;

  enemies.set(enemyData.id, {
    ...enemyData,
    type,
    maxHealth: config.maxHealth,
    walkFrame: 0,
    walkFrameTime: 0,
  });
}

// ─── Обновление (только анимация) ─────────────────────────────────────
function updateEnemies(deltaTime) {
  const currentWorldId = window.worldSystem?.currentWorldId;
  if (currentWorldId === undefined) return;

  // Защита от огромных скачков времени (вкладка была свёрнута)
  let safeDelta = deltaTime;
  if (deltaTime > MAX_DELTA_FOR_ANIMATION) {
    safeDelta = MAX_DELTA_FOR_ANIMATION;
  }

  for (const enemy of enemies.values()) {
    if (enemy.worldId !== currentWorldId || enemy.health <= 0) continue;

    const config = ENEMY_TYPES[enemy.type] || ENEMY_TYPES.mutant;

    // ─── Обработка анимации ────────────────────────────────────────
    if (enemy.state === "walking" || enemy.state === "attacking") {
      enemy.walkFrameTime += safeDelta;

      // Если накопилось слишком много времени → резетим, чтобы не дёргалось
      if (enemy.walkFrameTime > ANIMATION_CATCHUP_THRESHOLD) {
        enemy.walkFrameTime = enemy.walkFrameTime % config.frameDuration;
        enemy.walkFrame = Math.floor(Math.random() * config.frames); // случайный кадр, чтобы не стояло на месте
      }

      // Обычный цикл кадров
      while (enemy.walkFrameTime >= config.frameDuration) {
        enemy.walkFrame = (enemy.walkFrame + 1) % config.frames;
        enemy.walkFrameTime -= config.frameDuration;
      }
    } else {
      // idle / dead / другие состояния → ресет анимации
      enemy.walkFrame = 0;
      enemy.walkFrameTime = 0;
    }
  }
}

function drawEnemySprite(enemy, camX, camY) {
  if (
    enemy.worldId !== window.worldSystem?.currentWorldId ||
    enemy.health <= 0
  ) {
    return;
  }

  const config = ENEMY_TYPES[enemy.type] || ENEMY_TYPES.mutant;
  const { size } = config;

  const screenX = enemy.x - camX;
  const screenY = enemy.y - camY - 20;

  // Куллинг
  if (
    screenX < -size - CULLING_MARGIN ||
    screenX > canvas.width + size + CULLING_MARGIN ||
    screenY < -size - CULLING_MARGIN ||
    screenY > canvas.height + size + CULLING_MARGIN
  ) {
    return;
  }

  const sprite = images[config.spriteKey];
  const sourceX = (enemy.walkFrame * 70) | 0;

  if (sprite?.complete && sprite.width >= 910) {
    ctx.drawImage(sprite, sourceX, 0, 70, 70, screenX, screenY, 70, 70);
  } else {
    // fallback
    ctx.fillStyle = enemy.type === "scorpion" ? "#00eaff" : "purple";
    ctx.fillRect(screenX, screenY, 70, 70);
    ctx.fillStyle = enemy.type === "scorpion" ? "#003344" : "red";
    ctx.font = "30px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      enemy.type === "scorpion" ? "S" : "M",
      screenX + 35,
      screenY + 50,
    );
  }

  // Полоска здоровья
  const hpPercent = Math.max(0, enemy.health / enemy.maxHealth);
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(screenX + 5, screenY - 15, 60, 10);

  const isScorpion = enemy.type === "scorpion";
  const hpColor =
    hpPercent > 0.3
      ? isScorpion
        ? HP_COLORS.scorpion_normal
        : HP_COLORS.normal
      : isScorpion
        ? HP_COLORS.scorpion_low
        : HP_COLORS.low;

  ctx.fillStyle = hpColor;
  ctx.fillRect(screenX + 5, screenY - 15, 60 * hpPercent, 10);

  // Текст здоровья + тип
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  ctx.strokeStyle = "black";
  ctx.lineWidth = 3;

  const hpText = Math.floor(enemy.health);
  ctx.strokeText(hpText, screenX + 35, screenY - 7);
  ctx.fillStyle = "white";
  ctx.fillText(hpText, screenX + 35, screenY - 7);

  ctx.font = "10px Arial";
  ctx.fillStyle = config.color;
  ctx.fillText(enemy.type, screenX + 35, screenY + 80);
}

function drawEnemies() {
  const currentWorldId = window.worldSystem?.currentWorldId;
  if (currentWorldId === undefined) return;

  const camera = window.movementSystem?.getCamera?.();
  if (!camera) return;

  ctx.save();
  for (const enemy of enemies.values()) {
    drawEnemySprite(enemy, camera.x, camera.y);
  }
  ctx.restore();
}

window.enemySystem = Object.freeze({
  initialize: initializeEnemySystem,
  syncEnemies,
  handleEnemyDeath,
  handleNewEnemy,
  update: updateEnemies,
  draw: drawEnemies,

  getEnemies() {
    return enemies;
  },

  getRenderData(enemy) {
    if (!enemy) {
      return null;
    }

    const config = ENEMY_TYPES[enemy.type] || ENEMY_TYPES.mutant;

    const visualConfig =
      ENEMY_VISUAL_CONFIG[enemy.type] || ENEMY_VISUAL_CONFIG.mutant;

    const sprite =
      typeof images !== "undefined" ? images[config.spriteKey] || null : null;

    return {
      id: enemy.id,

      type: enemy.type || "mutant",

      x: Number(enemy.x),
      y: Number(enemy.y),

      worldId: enemy.worldId,

      health: Number(enemy.health),
      maxHealth: Number(enemy.maxHealth || config.maxHealth),

      direction: enemy.direction || "down",
      state: enemy.state || "idle",

      frame: Number.isFinite(enemy.walkFrame) ? Math.floor(enemy.walkFrame) : 0,

      frameCount: config.frames,
      frameSize: config.size,

      sprite,

      visual: {
        mode: visualConfig.mode,

        model3D: visualConfig.model3D,

        billboard: {
          sprite,

          frame: Number.isFinite(enemy.walkFrame)
            ? Math.floor(enemy.walkFrame)
            : 0,

          row: 0,

          frameCount: config.frames,

          frameWidth: config.size,
          frameHeight: config.size,

          displayWidth: config.size,
          displayHeight: config.size,
        },
      },
    };
  },

  drawSprite(enemy, camX, camY) {
    drawEnemySprite(enemy, camX, camY);
  },

  cleanupAllEnemies: function () {
    if (window.selectedEnemyId) window.selectedEnemyId = null;
    enemies.clear();
  },
});
