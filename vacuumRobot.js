// vacuumRobot.js — Оптимизированная версия (2026)
// Три робота-пылесоса: ВАКУУМ-9000, 9001, 9002
// Минимальная нагрузка на CPU и память + защита от больших дельт

window.vacuumRobotSystem = (function () {
  const DIALOG_RANGE_SQ = 400; // 20×20 px
  const REWARD_DURATION = 100; // ms ожидания на точке перед следующей
  const MAX_DELTA = 200; // максимальный шаг времени (защита от "догонки")

  // Один спрайт для всех
  let sharedSprite = null;

  // Данные роботов — компактно
  const robots = [
    {
      name: "ВАКУУМ-9000",
      photo: "vacuum_photo.png",
      path: [
        { x: 2299, y: 111 },
        { x: 1955, y: 1174 },
        { x: 2607, y: 1626 },
        { x: 1991, y: 2222 },
        { x: 1212, y: 1489 },
        { x: 2299, y: 111 },
      ],
      x: 2299,
      y: 111,
    },
    {
      name: "ВАКУУМ-9001",
      photo: "vacuum_photo2.png",
      path: [
        { x: 66, y: 2727 },
        { x: 1212, y: 2323 },
        { x: 1212, y: 1489 },
        { x: 111, y: 1391 },
        { x: 260, y: 400 },
        { x: 1191, y: 882 },
        { x: 1164, y: 2468 },
        { x: 66, y: 2727 },
      ],
      x: 66,
      y: 2727,
    },
  ].map((data, i) => ({
    ...data,
    id: i,
    width: 70,
    height: 70,
    speed: 0.09,
    frame: 0,
    frameTime: 0,
    currentTarget: 1,
    state: "moving", // moving | waiting
    waitTimer: 0,
    dialogShown: false,
    dialogEl: null,
    worldId: 0,
  }));

  // Кэш игрока — обновляем только при необходимости
  let meCache = null;
  let lastWorldId = -1;

  // Один диалог на всех
  let dialogElement = null;
  let currentRobot = null;

  function ensureDialog() {
    if (dialogElement) return;

    dialogElement = document.createElement("div");
    dialogElement.className = "npc-dialog";
    dialogElement.style.display = "none";
    dialogElement.innerHTML = `
      <div class="npc-dialog-header">
        <img class="npc-photo" id="vacuumPhoto">
        <h2 class="npc-title" id="vacuumName"></h2>
      </div>
      <div class="npc-dialog-content">
        <div class="npc-text fullscreen">
          *жужж... жужжит угрожающе и сканирует тебя красным лучом*<br><br>
          «ЧИСТОТА — ЭТО ПОРЯДОК.<br>
          Я УБИРАЮ МУСОР. ЛЮБОЙ.<br><br>
          НЕ СТОЙ НА ПУТИ, ПАНК.<br>
          ИЛИ СТАНЕШЬ ПЫЛЬЮ В МОЁМ БАКЕ.»
        </div>
      </div>
      <button class="neon-btn vacuum-close-btn">ПОНЯЛ, УХОЖУ</button>
    `;

    const btn = dialogElement.querySelector(".vacuum-close-btn");
    btn.onclick = () => giveRewardAndClose(currentRobot);

    document.body.appendChild(dialogElement);
  }

  function showDialog(robot) {
    if (robot.dialogShown) return;
    ensureDialog();
    dialogElement.querySelector("#vacuumPhoto").src = robot.photo;
    dialogElement.querySelector("#vacuumName").textContent = robot.name;
    dialogElement.style.display = "flex";
    robot.dialogShown = true;
    currentRobot = robot;
  }

  function hideDialog() {
    if (dialogElement) dialogElement.style.display = "none";
    if (currentRobot) {
      currentRobot.dialogShown = false;
      currentRobot = null;
    }
  }

  function giveRewardAndClose(robot) {
    hideDialog();

    const me = players.get(myId);
    if (!me || me.worldId !== 0) return;

    const level = me.level || 0;
    const chance = level < 2 ? 0.05 : level < 5 ? 0.1 : 1 / 9;

    if (Math.random() < chance) {
      let slot = me.inventory.findIndex((i) => i && i.type === "balyary");
      const isNew = slot === -1;
      if (isNew) slot = me.inventory.findIndex((i) => i === null);
      if (slot === -1) return;

      const qty = isNew ? 1 : (me.inventory[slot].quantity || 0) + 1;

      if (ws?.readyState === WebSocket.OPEN) {
        sendWhenReady(
          ws,
          JSON.stringify({
            type: "vacuumBalyaryReward",
            slot,
            quantity: qty,
            isNewStack: isNew,
          }),
        );
      }

      // Локальное обновление
      if (isNew) {
        me.inventory[slot] = { type: "balyary", quantity: 1 };
      } else {
        me.inventory[slot].quantity = qty;
      }

      // ─── Вот здесь добавляем уведомление ───
      if (window.showNotification) {
        window.showNotification(
          `${robot.name} оставил тебе 1 баляр!`,
          "#00ff88",
        );
      }

      // Обновляем инвентарь на экране
      if (window.updateInventoryDisplay) {
        window.updateInventoryDisplay();
      }
    }
  }

  function isNearPlayer(robot) {
    if (!meCache || meCache.worldId !== 0) return false;
    const dx = meCache.x + 35 - (robot.x + 35);
    const dy = meCache.y + 35 - (robot.y + 35);
    return dx * dx + dy * dy <= DIALOG_RANGE_SQ;
  }

  function moveToTarget(robot, tx, ty, dt) {
    const dx = tx - robot.x;
    const dy = ty - robot.y;
    const distSq = dx * dx + dy * dy;

    if (distSq < 9) {
      // ~3 пикселя
      robot.x = tx;
      robot.y = ty;
      robot.state = "waiting";
      robot.waitTimer = 0;
      return;
    }

    const dist = Math.sqrt(distSq);
    const move = robot.speed * dt;
    robot.x += (dx / dist) * move;
    robot.y += (dy / dist) * move;
  }

  function update(deltaTime) {
    const currentWorld = window.worldSystem?.currentWorldId ?? -1;

    // Смена мира → чистим кэш и диалог
    if (currentWorld !== lastWorldId) {
      lastWorldId = currentWorld;
      meCache = null;
      hideDialog();
      if (currentWorld !== 0) return;
    }

    if (currentWorld !== 0) return;

    // Обновляем кэш игрока только если нужно
    if (!meCache || meCache.id !== myId) {
      meCache = players.get(myId);
    }

    // Защита от огромных дельт (вкладка была свёрнута)
    const safeDelta = Math.min(deltaTime, MAX_DELTA);

    for (const r of robots) {
      // Анимация кадров (независимо от движения)
      r.frameTime += safeDelta;
      if (r.frameTime >= 83) {
        r.frameTime -= 83;
        r.frame = (r.frame + 1) % 13;
      }

      // Логика состояния
      if (r.state === "waiting") {
        r.waitTimer += safeDelta;
        if (r.waitTimer >= REWARD_DURATION) {
          r.currentTarget = (r.currentTarget + 1) % r.path.length;
          r.state = "moving";
        }
      } else {
        const target = r.path[r.currentTarget];
        moveToTarget(r, target.x, target.y, safeDelta);
      }

      // Проверка близости и диалог — только если игрок существует
      if (meCache) {
        if (isNearPlayer(r)) {
          showDialog(r);
        } else if (r.dialogShown) {
          hideDialog();
        }
      }
    }
  }

  function draw() {
    if (window.worldSystem?.currentWorldId !== 0) return;

    const cam = window.movementSystem.getCamera();
    const cw = canvas.width + 200;
    const ch = canvas.height + 200;

    for (const r of robots) {
      const sx = r.x - cam.x;
      const sy = r.y - cam.y;

      if (sx < -100 || sx > cw || sy < -100 || sy > ch) continue;

      if (sharedSprite?.complete) {
        ctx.drawImage(sharedSprite, r.frame * 70, 0, 70, 70, sx, sy, 70, 70);
      } else {
        ctx.fillStyle = "#00ff44";
        ctx.fillRect(sx, sy, 70, 70);
        ctx.fillStyle = "#000";
        ctx.font = "12px Arial";
        ctx.fillText(r.name, sx + 8, sy + 40);
      }

      // Подсветка при приближении (только если диалог активен)
      if (r.dialogShown) {
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 8]);
        ctx.strokeRect(sx - 10, sy - 10, 90, 90);
        ctx.setLineDash([]);
      }
    }
  }

  function initialize(sprite9000, sprite9001, sprite9002) {
    sharedSprite =
      sprite9000 || sprite9001 || sprite9002 || images.vacuumRobotSprite;

    // Сброс состояний
    robots.forEach((r, i) => {
      r.x = r.path[0].x;
      r.y = r.path[0].y;
      r.currentTarget = 1;
      r.state = "moving";
      r.frame = 0;
      r.frameTime = 0;
      r.waitTimer = 0;
      r.dialogShown = false;
    });

    // Сброс кэша
    meCache = null;
    lastWorldId = -1;
  }

  return {
    initialize,
    update,
    draw,
    hideDialog,
  };
})();
