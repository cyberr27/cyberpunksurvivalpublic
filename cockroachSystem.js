// cockroachSystem.js
// Оптимизированный до предела: пул объектов, минимум аллокаций, минимум CPU
// Тараканы во всех мирах (0,1,2), спавнятся при входе, удаляются при выходе

const COCKROACH_COUNT = 33;
const COCKROACH_SIZE = 10;
const NORMAL_SPEED = 0.5;
const SCARED_SPEED = 2.8;
const SCARE_RANGE_SQ = 50 * 50; // квадрат радиуса — экономим Math.sqrt
const PANIC_DURATION = 800;
const FRAME_DURATION = 80;

let cockroachSprite = null;
let currentWorldId = -1;

// Пул тараканов — один раз создаём массив фиксированного размера
const pool = new Array(COCKROACH_COUNT);
for (let i = 0; i < COCKROACH_COUNT; i++) {
  pool[i] = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    frame: 0,
    frameTime: 0,
    panicTimer: 0,
    active: false, // флаг активности
  };
}

let activeCount = 0;

const COCKROACH_VISUAL_ID = "sector12:cockroaches";
const COCKROACH_FRAME_SIZE = 70;
const COCKROACH_SPRITE_FORWARD_OFFSET = -Math.PI / 2;

const cockroachVisualProviders = new Array(COCKROACH_COUNT);

for (let i = 0; i < COCKROACH_COUNT; i++) {
  const index = i;

  cockroachVisualProviders[i] = Object.freeze({
    getRenderData() {
      const c = pool[index];

      if (
        !c.active ||
        activeCount === 0 ||
        currentWorldId < 0 ||
        !cockroachSprite?.complete ||
        cockroachSprite.naturalWidth <= 0 ||
        cockroachSprite.naturalHeight <= 0
      ) {
        return null;
      }

      return {
        id: `${COCKROACH_VISUAL_ID}:${index}`,
        type: "npc",
        worldId: currentWorldId,

        x: c.x - COCKROACH_SIZE * 0.5,
        y: c.y - COCKROACH_SIZE * 0.5,

        elevation: 0,

        visual: {
          mode: "billboard",

          billboard: {
            sprite: cockroachSprite,

            orientation: {
              mode: "velocity",
              vx: c.vx,
              vy: c.vy,
              angleOffset: COCKROACH_SPRITE_FORWARD_OFFSET,
            },

            frame: c.frame,
            row: 0,
            frameCount: 13,

            frameWidth: COCKROACH_FRAME_SIZE,
            frameHeight: COCKROACH_FRAME_SIZE,

            displayWidth: COCKROACH_SIZE,
            displayHeight: COCKROACH_SIZE,
          },
        },
      };
    },
  });
}

function registerCockroachVisuals() {
  const scene = window.sceneEntitySystem;

  if (
    !scene ||
    typeof scene.registerNPCVisualProvider !== "function" ||
    typeof scene.getRegisteredNPCIds !== "function"
  ) {
    return false;
  }

  const registeredIds = new Set(scene.getRegisteredNPCIds());

  for (let i = 0; i < COCKROACH_COUNT; i++) {
    const id = `${COCKROACH_VISUAL_ID}:${i}`;

    if (registeredIds.has(id)) {
      continue;
    }

    if (!scene.registerNPCVisualProvider(id, cockroachVisualProviders[i])) {
      return false;
    }
  }

  return true;
}

const cockroachSystem = {
  initialize(spriteImage) {
    cockroachSprite = spriteImage;

    if (!registerCockroachVisuals()) {
      console.warn("[CockroachSystem] Visual registration failed");
    }
  },

  spawnCockroachesForCurrentWorld() {
    const world = window.worldSystem.getCurrentWorld();
    if (!world) return;

    currentWorldId = window.worldSystem.currentWorldId;
    activeCount = 0;

    const w = world.w - 160;
    const h = world.h - 160;
    const baseX = 80;
    const baseY = 80;

    for (let i = 0; i < COCKROACH_COUNT; i++) {
      const c = pool[i];
      c.x = baseX + Math.random() * w;
      c.y = baseY + Math.random() * h;
      c.vx = (Math.random() - 0.5) * NORMAL_SPEED * 2;
      c.vy = (Math.random() - 0.5) * NORMAL_SPEED * 2;
      c.frame = Math.floor(Math.random() * 13);
      c.frameTime = 0;
      c.panicTimer = 0;
      c.active = true;
      activeCount++;
    }
  },

  update(deltaTime) {
    if (!cockroachSprite?.complete) return;

    const worldId = window.worldSystem.currentWorldId;
    if (worldId !== currentWorldId) {
      this.spawnCockroachesForCurrentWorld();
      return;
    }

    if (activeCount === 0) return;

    const me = players.get(myId);
    if (!me) return;

    const playerCX = me.x + 35;
    const playerCY = me.y + 35;
    const world = window.worldSystem.getCurrentWorld();

    const invDt = deltaTime / 16;
    const scareSpeed = SCARED_SPEED;
    const normalSpeed = NORMAL_SPEED * 2;

    for (let i = 0; i < COCKROACH_COUNT; i++) {
      const c = pool[i];
      if (!c.active) continue;

      // === Проверка паники ===
      const dx = playerCX - c.x;
      const dy = playerCY - c.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < SCARE_RANGE_SQ) {
        const angle = Math.atan2(dy, dx);
        c.vx = -Math.cos(angle) * scareSpeed;
        c.vy = -Math.sin(angle) * scareSpeed;
        c.panicTimer = PANIC_DURATION;
      } else if (c.panicTimer > 0) {
        c.panicTimer -= deltaTime;
        if (c.panicTimer <= 0) {
          // Возвращаемся к случайному блужданию
          c.vx = (Math.random() - 0.5) * normalSpeed;
          c.vy = (Math.random() - 0.5) * normalSpeed;
        }
      } else if (Math.random() < 0.005) {
        // Редкая смена направления в спокойном состоянии
        c.vx = (Math.random() - 0.5) * normalSpeed;
        c.vy = (Math.random() - 0.5) * normalSpeed;
      }

      // === Движение ===
      c.x += c.vx * invDt;
      c.y += c.vy * invDt;

      // Отскок от стен
      if (c.x <= 60 || c.x >= world.w - 60) c.vx *= -1;
      if (c.y <= 60 || c.y >= world.h - 60) c.vy *= -1;

      // Кламп (на всякий)
      c.x = Math.max(60, Math.min(world.w - 60, c.x));
      c.y = Math.max(60, Math.min(world.h - 60, c.y));

      // Анимация только при быстром движении
      if (Math.abs(c.vx) > 2 || Math.abs(c.vy) > 2) {
        c.frameTime += deltaTime;
        if (c.frameTime >= FRAME_DURATION) {
          c.frameTime = 0;
          c.frame = (c.frame + 1) % 13;
        }
      }
    }
  },

  draw() {
    if (activeCount === 0 || !cockroachSprite?.complete) return;

    const camera = window.movementSystem.getCamera();
    const camX = camera.x;
    const camY = camera.y;
    const screenW = canvas.width;
    const screenH = canvas.height;

    for (let i = 0; i < COCKROACH_COUNT; i++) {
      const c = pool[i];
      if (!c.active) continue;

      const screenX = c.x - camX - COCKROACH_SIZE / 2;
      const screenY = c.y - camY - COCKROACH_SIZE / 2;

      // Жёсткий culling
      if (
        screenX < -60 ||
        screenX > screenW + 60 ||
        screenY < -60 ||
        screenY > screenH + 60
      )
        continue;

      ctx.drawImage(
        cockroachSprite,
        c.frame * 70,
        0,
        70,
        70,
        screenX,
        screenY,
        COCKROACH_SIZE,
        COCKROACH_SIZE,
      );
    }
  },
};

window.cockroachSystem = cockroachSystem;
