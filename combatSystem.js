// combatSystem.js - ИЗМЕНЁННЫЙ ПОЛНОСТЬЮ
const BULLET_SPEED = 10; // Скорость пули (пикселей за кадр)
const BULLET_SIZE = 5; // Размер пули
const ATTACK_COOLDOWN = 500; // Перезарядка атаки в миллисекундах
// BULLET_LIFETIME больше не используется напрямую, теперь срок жизни — по расстоянию
const BULLET_LIFETIME = 10000; // Для совместимости, но не используется для удаления
const BASE_MELEE_MIN_DAMAGE = 5; // Базовый мин. урон ближнего боя
const BASE_MELEE_MAX_DAMAGE = 10; // Базовый макс. урон ближнего боя
const MELEE_ATTACK_RANGE = 50; // Дальность атаки ближнего боя

let bullets = new Map(); // Хранилище пуль
let lastAttackTime = 0; // Время последней атаки

// Инициализация системы боя
function initializeCombatSystem() {
  const combatBtn = document.getElementById("combatBtn");
  combatBtn.addEventListener("click", (e) => {
    e.preventDefault();
    performAttack(); // Запускаем атаку при клике
  });

  let attackInterval = null;

  combatBtn.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault(); // Обязательно — чтобы не было скролла и контекстного меню
      performAttack(); // Первая атака сразу при касании

      // Запускаем повторяющиеся атаки при удержании
      if (attackInterval === null) {
        attackInterval = setInterval(() => {
          performAttack();
        }, ATTACK_COOLDOWN); // Повтор каждые 500 мс (как кулдаун)
      }
    },
    { passive: false },
  );

  combatBtn.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      if (attackInterval !== null) {
        clearInterval(attackInterval);
        attackInterval = null;
      }
    },
    { passive: false },
  );

  combatBtn.addEventListener(
    "touchcancel",
    (e) => {
      e.preventDefault();
      if (attackInterval !== null) {
        clearInterval(attackInterval);
        attackInterval = null;
      }
    },
    { passive: false },
  );

  // Дополнительно: для мыши тоже можно удерживать (бонус для десктопа)
  combatBtn.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return; // Только левая кнопка
    e.preventDefault();
    performAttack();

    if (attackInterval === null) {
      attackInterval = setInterval(() => {
        performAttack();
      }, ATTACK_COOLDOWN);
    }
  });

  combatBtn.addEventListener("mouseup", (e) => {
    if (attackInterval !== null) {
      clearInterval(attackInterval);
      attackInterval = null;
    }
  });

  combatBtn.addEventListener("mouseleave", () => {
    if (attackInterval !== null) {
      clearInterval(attackInterval);
      attackInterval = null;
    }
  });

  // Добавлено: обработчик пробела для атаки (глобально)
  window.addEventListener("keydown", (e) => {
    if (e.key === " " && !window.isInventoryOpen) {
      // Игнорируем, если инвентарь открыт, чтобы не мешать кнопкам
      e.preventDefault(); // Предотвращаем скролл страницы
      performAttack();
    }
  });
}

// Запуск анимации мигания кнопки при атаке на игрока
function triggerAttackAnimation() {
  const combatBtn = document.getElementById("combatBtn");
  combatBtn.classList.add("under-attack");
  setTimeout(() => {
    combatBtn.classList.remove("under-attack");
  }, 2000); // Анимация длится 2 секунды
}

// Выполнение атаки
function performAttack() {
  const me = players.get(myId);
  if (!me || me.health <= 0) return;

  if (window.worldSystem?.currentWorldId === 0) {
    showNotification("Not in the city!", "#ff4444");
    return;
  }

  const currentTime = Date.now();
  if (currentTime - lastAttackTime < ATTACK_COOLDOWN) return;

  lastAttackTime = currentTime;

  // Устанавливаем state атаки и сбрасываем кадры
  me.state = "attacking";
  me.attackFrame = 0;
  me.attackFrameTime = 0;
  me.frame = 0; // Сбрасываем walk-frame, чтобы не конфликтовать

  const currentWorldId = window.worldSystem.currentWorldId;

  // Бонус от уровня
  const levelBonus = window.levelSystem.meleeDamageBonus || 0;

  // Проверяем наличие любого оружия в weapon ИЛИ offhand
  const weaponItem = me.equipment?.weapon;
  const offhandItem = me.equipment?.offhand;

  const hasWeapon =
    weaponItem && ITEM_CONFIG[weaponItem.type]?.type === "weapon";
  const hasOffhand =
    offhandItem && ITEM_CONFIG[offhandItem.type]?.type === "weapon";

  const hasAnyWeapon = hasWeapon || hasOffhand;

  if (hasAnyWeapon) {
    // Проверяем, есть ли хотя бы одно дальнобойное оружие
    const weaponRanged =
      hasWeapon && !!ITEM_CONFIG[weaponItem.type]?.effect?.range;
    const offhandRanged =
      hasOffhand && !!ITEM_CONFIG[offhandItem.type]?.effect?.range;
    const isRanged = weaponRanged || offhandRanged;

    if (isRanged) {
      let aimX;
      let aimY;

      const pointerWorld =
        window.inputSystem?.getPointerWorld?.({
          refresh: true,
        }) || null;

      if (
        pointerWorld &&
        Number.isFinite(pointerWorld.x) &&
        Number.isFinite(pointerWorld.y)
      ) {
        aimX = pointerWorld.x;
        aimY = pointerWorld.y;
      } else {
        // Управление без валидного pointer остаётся
        // через текущее направление персонажа.
        const angle = getPlayerAngle(me.direction);

        aimX = me.x + 20 + Math.cos(angle) * 100;

        aimY = me.y + 20 + Math.sin(angle) * 100;
      }

      sendWhenReady(
        ws,
        JSON.stringify({
          type: "shoot",
          aimX,
          aimY,
        }),
      );

      sendWhenReady(
        ws,
        JSON.stringify({
          type: "update",
          player: {
            id: myId,
            x: me.x,
            y: me.y,
            direction: me.direction,
            state: "attacking",
            attackFrame: 0,
            attackFrameTime: 0,
            worldId: currentWorldId,
          },
        }),
      );
    } else {
      // Ближний бой — используем универсальный расчёт из equipmentSystem
      const dmgRange = window.equipmentSystem.getCurrentMeleeDamage();
      const damage =
        Math.floor(Math.random() * (dmgRange.max - dmgRange.min + 1)) +
        dmgRange.min;
      performMeleeAttack(damage, currentWorldId);
    }
  } else {
    // Кулаки — базовый урон + бонус уровня
    const range = window.equipmentSystem.getCurrentMeleeDamage();
    const damage =
      Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    performMeleeAttack(damage, currentWorldId);
  }
}

// Выполнение атаки ближнего боя (ДОБАВЛЕНА ПРОВЕРКА ВРАГОВ)
function performMeleeAttack(damage, worldId) {
  const me = players.get(myId);
  if (worldId === 0 || window.worldSystem?.currentWorldId === 0) {
    showNotification("Not in the city!", "#ff4444");
    return false;
  }
  if (!me) return false;

  let hit = false;

  // Проверка игроков
  players.forEach((player, id) => {
    if (id !== myId && player.health > 0 && player.worldId === worldId) {
      const dx = player.x - me.x;
      const dy = player.y - me.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= MELEE_ATTACK_RANGE) {
        hit = true;

        sendWhenReady(
          ws,
          JSON.stringify({
            type: "attackPlayer",
            targetId: id,
            worldId,
          }),
        );

        // Если попали по текущему игроку — анимация получения урона
        if (id === myId) {
          triggerAttackAnimation();
        }
      }
    }
  });

  // Проверка врагов
  enemies.forEach((enemy, enemyId) => {
    if (enemy.health > 0 && enemy.worldId === worldId) {
      const dx = enemy.x - me.x;
      const dy = enemy.y - me.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= MELEE_ATTACK_RANGE) {
        hit = true;

        sendWhenReady(
          ws,
          JSON.stringify({
            type: "attackEnemy",
            targetId: enemyId,
            worldId,
          }),
        );
      }
    }
  });

  if (hit) {
    sendWhenReady(
      ws,
      JSON.stringify({
        type: "update",
        player: {
          id: myId,
          x: me.x,
          y: me.y,
          direction: me.direction,
          state: "attacking", // явно
          attackFrame: me.attackFrame || 0,
          attackFrameTime: me.attackFrameTime || 0,
          frame: me.frame,
          worldId,
        },
      }),
    );
  }

  return hit;
}

// Получение угла поворота игрока (БЕЗ ИЗМЕНЕНИЙ)
function getPlayerAngle(direction) {
  switch (direction) {
    case "up":
      return -Math.PI / 2;
    case "down":
      return Math.PI / 2;
    case "left":
      return Math.PI;
    case "right":
      return 0;
    default:
      return 0;
  }
}

function updateBullets(deltaTime) {
  const currentWorldId = window.worldSystem.currentWorldId;

  bullets.forEach((bullet, bulletId) => {
    if (bullet.worldId !== currentWorldId) {
      bullets.delete(bulletId);
      return;
    }

    // Только визуальное движение.
    // Клиент не определяет попадание и не наносит урон.
    bullet.x += bullet.vx * (deltaTime / 16.67);
    bullet.y += bullet.vy * (deltaTime / 16.67);
  });
}

// Отрисовка пуль (БЕЗ ИЗМЕНЕНИЙ)
function drawBullets() {
  const currentWorldId = window.worldSystem.currentWorldId;
  bullets.forEach((bullet) => {
    if (bullet.worldId !== currentWorldId) return;
    const screenX = bullet.x - window.movementSystem.getCamera().x;
    const screenY = bullet.y - window.movementSystem.getCamera().y;
    // Красивая анимация: ядро + свечение + хвост
    // Хвост (трейл)
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = bullet.damage >= 50 ? "#00eaff" : "#ff4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(screenX, screenY);
    ctx.lineTo(screenX - bullet.vx * 3, screenY - bullet.vy * 3);
    ctx.stroke();
    ctx.restore();
    // Градиентное ядро
    const grad = ctx.createRadialGradient(
      screenX,
      screenY,
      0.5,
      screenX,
      screenY,
      BULLET_SIZE * 1.5,
    );
    grad.addColorStop(0, bullet.damage >= 50 ? "#00eaff" : "#fffbe0");
    grad.addColorStop(0.5, bullet.damage >= 50 ? "#00eaffcc" : "#ff4444cc");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(screenX, screenY, BULLET_SIZE * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.shadowColor = bullet.damage >= 50 ? "#00eaff" : "#ff4444";
    ctx.shadowBlur = bullet.damage >= 50 ? 18 : 10;
    ctx.fill();
    ctx.restore();
    // Ядро
    ctx.save();
    ctx.beginPath();
    ctx.arc(screenX, screenY, BULLET_SIZE / 2, 0, Math.PI * 2);
    ctx.fillStyle = bullet.damage >= 50 ? "#00eaff" : "#fffbe0";
    ctx.shadowColor = bullet.damage >= 50 ? "#00eaff" : "#fffbe0";
    ctx.shadowBlur = bullet.damage >= 50 ? 8 : 4;
    ctx.fill();
    ctx.restore();
  });
}

// Синхронизация пуль с сервером (БЕЗ ИЗМЕНЕНИЙ)
function syncBullets(serverBullets) {
  bullets.clear();

  if (!Array.isArray(serverBullets)) return;

  for (const bullet of serverBullets) {
    if (bullet.worldId !== window.worldSystem.currentWorldId) {
      continue;
    }

    bullets.set(bullet.id, {
      id: bullet.id,
      x: bullet.x,
      y: bullet.y,
      vx: bullet.vx,
      vy: bullet.vy,
      damage: bullet.damage,
      range: bullet.range,
      ownerId: bullet.ownerId,
      spawnTime: bullet.spawnTime,
      worldId: bullet.worldId,
    });
  }
}

window.combatSystem = {
  initialize: initializeCombatSystem,
  update: updateBullets,
  draw: drawBullets,
  syncBullets,

  getBullets() {
    return bullets;
  },

  getBulletRenderData(bullet) {
    if (!bullet) {
      return null;
    }

    const x = Number(bullet.x);
    const y = Number(bullet.y);
    const vx = Number(bullet.vx);
    const vy = Number(bullet.vy);

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(vx) ||
      !Number.isFinite(vy)
    ) {
      return null;
    }

    return {
      id: bullet.id ?? null,

      x,
      y,

      vx,
      vy,

      damage: Number(bullet.damage) || 0,
      range: Number(bullet.range) || 0,

      ownerId: bullet.ownerId ?? null,
      spawnTime: Number(bullet.spawnTime) || 0,

      worldId: bullet.worldId,
    };
  },

  resetAttackState: function () {
    const me = players.get(myId);
    if (me) {
      me.state = "idle";
      me.attackFrame = 0;
      me.attackFrameTime = 0;
    }
  },
};
