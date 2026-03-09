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
      // Стрельба — берём первое найденное ranged оружие (приоритет weapon)
      const rangedItem = weaponItem && weaponRanged ? weaponItem : offhandItem;

      let range = ITEM_CONFIG[rangedItem.type]?.effect?.range || 500;
      let damage = ITEM_CONFIG[rangedItem.type]?.effect?.damage || 10;

      if (rangedItem.type === "plasma_rifle") {
        range = 700;
        damage = 50;
      }

      const bulletId = `bullet_${Date.now()}_${Math.random()}`;
      const angle = getPlayerAngle(me.direction);
      const startX = me.x + 20;
      const startY = me.y + 20;

      const bullet = {
        id: bulletId,
        x: startX,
        y: startY,
        vx: Math.cos(angle) * BULLET_SPEED,
        vy: Math.sin(angle) * BULLET_SPEED,
        damage: damage,
        range: range,
        ownerId: myId,
        spawnTime: Date.now(),
        worldId: currentWorldId,
        startX,
        startY,
        hitPlayers: new Set(),
        hitEnemies: new Set(),
      };

      bullets.set(bulletId, bullet);

      sendWhenReady(
        ws,
        JSON.stringify({
          type: "shoot",
          bulletId,
          x: bullet.x,
          y: bullet.y,
          vx: bullet.vx,
          vy: bullet.vy,
          damage: bullet.damage,
          range: bullet.range,
          ownerId: myId,
          worldId: currentWorldId,
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
            health: me.health,
            energy: me.energy,
            food: me.food,
            water: me.water,
            armor: me.armor,
            distanceTraveled: me.distanceTraveled,
            direction: me.direction,
            state: "attacking",
            attackFrame: 0,
            attackFrameTime: 0,
            worldId: currentWorldId,
          },
        }),
      );
    } else {
      // Ближний бой — используем универсальный расчёт из equipmentSystem (учитывает оба слота)
      const dmg = window.equipmentSystem.getCurrentMeleeDamage();
      const range = window.strongStrikeSystem.getCurrentMeleeDamageRange();
      const damage =
        Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      performMeleeAttack(damage, currentWorldId);
    }
  } else {
    // Кулаки — базовый урон + бонус уровня
    const range = window.strongStrikeSystem.getCurrentMeleeDamageRange();
    const damage =
      Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
    performMeleeAttack(damage, currentWorldId);
  }
}

// Выполнение атаки ближнего боя (ДОБАВЛЕНА ПРОВЕРКА ВРАГОВ)
function performMeleeAttack(damage, worldId) {
  const me = players.get(myId);
  let hit = false;

  // Проверка игроков
  players.forEach((player, id) => {
    if (id !== myId && player.health > 0 && player.worldId === worldId) {
      const dx = player.x - me.x;
      const dy = player.y - me.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= MELEE_ATTACK_RANGE) {
        hit = true;
        // Принудительно обновляем локально здоровье (для мгновенного отображения)
        player.health = Math.max(0, player.health - damage);
        players.set(id, player);

        sendWhenReady(
          ws,
          JSON.stringify({
            type: "attackPlayer",
            targetId: id,
            damage,
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
        // Принудительно обновляем здоровье мутанта локально
        enemy.health = Math.max(0, enemy.health - damage);
        enemies.set(enemyId, enemy);

        sendWhenReady(
          ws,
          JSON.stringify({
            type: "attackEnemy",
            targetId: enemyId,
            damage,
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
          health: me.health,
          energy: me.energy,
          food: me.food,
          water: me.water,
          armor: me.armor,
          distanceTraveled: me.distanceTraveled,
          direction: me.direction,
          state: me.state,
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

// Обновление пуль (БЕЗ ИЗМЕНЕНИЙ, но добавлена динамичная проверка врагов)
function updateBullets(deltaTime) {
  const currentTime = Date.now();
  const currentWorldId = window.worldSystem.currentWorldId;

  bullets.forEach((bullet, bulletId) => {
    if (bullet.worldId !== currentWorldId) return;
    bullet.x += bullet.vx * (deltaTime / 16.67);
    bullet.y += bullet.vy * (deltaTime / 16.67);

    // Проверка столкновений с игроками
    let hit = false;
    players.forEach((player, id) => {
      if (
        !hit &&
        id !== bullet.ownerId &&
        player.health > 0 &&
        player.worldId === currentWorldId
      ) {
        const dx = bullet.x - (player.x + 20);
        const dy = bullet.y - (player.y + 20);
        if (Math.sqrt(dx * dx + dy * dy) < 20) {
          sendWhenReady(
            ws,
            JSON.stringify({
              type: "attackPlayer",
              targetId: id,
              damage: bullet.damage,
              worldId: currentWorldId,
            }),
          );
          if (id === myId) triggerAttackAnimation();
          hit = true;
        }
      }
    });
    // Проверка столкновений с врагами
    enemies.forEach((enemy, id) => {
      if (!hit && enemy.health > 0 && enemy.worldId === currentWorldId) {
        const dx = bullet.x - (enemy.x + 35);
        const dy = bullet.y - (enemy.y + 35);
        if (Math.sqrt(dx * dx + dy * dy) < 35) {
          sendWhenReady(
            ws,
            JSON.stringify({
              type: "attackEnemy",
              targetId: id,
              damage: bullet.damage,
              worldId: currentWorldId,
            }),
          );
          hit = true;
        }
      }
    });
    // Удаляем пулю при первом попадании
    if (hit) {
      bullets.delete(bulletId);
      sendWhenReady(
        ws,
        JSON.stringify({
          type: "removeBullet",
          bulletId,
          worldId: currentWorldId,
        }),
      );
      return;
    }
    // Удаление пули только по расстоянию (жизнь = range)
    if (bullet.startX === undefined) bullet.startX = bullet.x;
    if (bullet.startY === undefined) bullet.startY = bullet.y;
    const dx = bullet.x - bullet.startX;
    const dy = bullet.y - bullet.startY;
    const distanceTraveled = Math.sqrt(dx * dx + dy * dy);
    if (distanceTraveled > bullet.range) {
      bullets.delete(bulletId);
      sendWhenReady(
        ws,
        JSON.stringify({
          type: "removeBullet",
          bulletId,
          worldId: currentWorldId,
        }),
      );
    }
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
  serverBullets.forEach((bullet) => {
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
  });
}

// Экспорт функций
window.combatSystem = {
  initialize: initializeCombatSystem,
  update: updateBullets,
  draw: drawBullets,
  syncBullets,
  resetAttackState: function () {
    const me = players.get(myId);
    if (me) {
      me.state = "idle";
      me.attackFrame = 0;
      me.attackFrameTime = 0;
    }
  },
};
