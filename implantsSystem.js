const implantsSystem = {
  isInitialized: false,
  pendingProjectileRequests: new Map(),

  // Главный массив слотов — синхронизируется с equipment.implant1..4
  implantSlots: [null, null, null, null],

  lastUseTime: [0, 0, 0, 0],
  getCurrentCooldownMs: function () {
    const player = players.get(myId);
    if (!player) return 60000;

    const base =
      Number(player.skills?.find((s) => s && Number(s.id) === 8)?.level || 0) ||
      0;

    let bonus = 0;
    if (Array.isArray(player.inventory)) {
      for (const slot of player.inventory) {
        if (!slot || !slot.type) continue;
        const cfg =
          typeof ITEM_CONFIG !== "undefined" ? ITEM_CONFIG[slot.type] : null;
        if (cfg?.skillBonus && Number(cfg.skillBonus.skillId) === 8) {
          bonus += Number(cfg.skillBonus.value) || 0;
        }
      }
    }

    const reduction = Math.min(30, base + bonus);
    return Math.max(30000, 60000 - reduction * 1000);
  },
  // Возвращает дополнительную дальность по скиллу id=9 (10px за уровень)
  getRangeBonusFromSkill: function () {
    const player = players.get(myId);
    if (!player) return 0;

    const base =
      Number(player.skills?.find((s) => s && Number(s.id) === 9)?.level || 0) ||
      0;

    let bonus = 0;
    if (Array.isArray(player.inventory)) {
      for (const slot of player.inventory) {
        if (!slot || !slot.type) continue;
        const cfg =
          typeof ITEM_CONFIG !== "undefined" ? ITEM_CONFIG[slot.type] : null;
        if (cfg?.skillBonus && Number(cfg.skillBonus.skillId) === 9) {
          bonus += Number(cfg.skillBonus.value) || 0;
        }
      }
    }

    return Math.min(30, base + bonus) * 10; // 10 px per effective level
  },
  aiming: null,

  IMPLANT_CONFIG: {
    fireball_implant: {
      name: "Огненный шар",
      description: "Запускает огненный шар (25-50 урона)",
      hotbarImage: null,
      sprite: null,
      type: "projectile",
      damageMin: 25,
      damageMax: 50,
      speed: 8,
      animationFrames: 12,
      frameDuration: 60,
    },
    lightning_implant: {
      name: "Молния",
      description: "Наносит молнией большой урон по выбранной цели (40-70)",
      hotbarImage: null,
      sprite: null,
      inventoryImage: null,
      type: "lightning",
      damageMin: 40,
      damageMax: 70,
      range: 300,
      animationFrames: 13,
      frameDuration: 120,
    },
    tornado_implant: {
      name: "Торнадо",
      description: "Вызывается торнадо, наносящий урон по области (35-65)",
      hotbarImage: null,
      sprite: null,
      inventoryImage: null,
      type: "area",
      damageMin: 35,
      damageMax: 65,
      radius: 100,
      animationFrames: 13,
      frameDuration: 120,
    },
    violent_tornado_implant: {
      name: "Разрушительный торнадо",
      description:
        "Разрушительный торнадо — активный имплант (30-60 урона, дальность 300px)",
      hotbarImage: null,
      sprite: null,
      inventoryImage: null,
      type: "projectile", // важно — чтобы useImplant шёл по ветке projectile
      damageMin: 30,
      damageMax: 60,
      speed: 8 / 3,
      radius: 100,
      animationFrames: 13,
      frameDuration: 120,
    },
  },

  initialize: function () {
    if (this.isInitialized) return;

    this.IMPLANT_CONFIG.fireball_implant.hotbarImage = images.fireballHotBar;
    this.IMPLANT_CONFIG.fireball_implant.sprite = images.fireballSprite;
    this.IMPLANT_CONFIG.fireball_implant.image = images.fireballImplant;
    // lightning images (may be undefined if not loaded yet)
    if (this.IMPLANT_CONFIG.lightning_implant) {
      this.IMPLANT_CONFIG.lightning_implant.hotbarImage =
        images.lightningHotBar;
      this.IMPLANT_CONFIG.lightning_implant.sprite = images.lightningSprite;
      this.IMPLANT_CONFIG.lightning_implant.inventoryImage =
        images.lightningImplant;
      this.IMPLANT_CONFIG.lightning_implant.image = images.lightningImplant;
    }
    if (this.IMPLANT_CONFIG.tornado_implant) {
      this.IMPLANT_CONFIG.tornado_implant.hotbarImage = images.tornadoHotBar;
      this.IMPLANT_CONFIG.tornado_implant.sprite = images.tornadoSprite;
      this.IMPLANT_CONFIG.tornado_implant.inventoryImage =
        images.tornadoImplant;
      this.IMPLANT_CONFIG.tornado_implant.image = images.tornadoImplant;
    }
    if (this.IMPLANT_CONFIG.violent_tornado_implant) {
      this.IMPLANT_CONFIG.violent_tornado_implant.hotbarImage =
        images.violentTornadoHotBar;
      this.IMPLANT_CONFIG.violent_tornado_implant.sprite =
        images.violentTornadoSprite;
      this.IMPLANT_CONFIG.violent_tornado_implant.inventoryImage =
        images.violentTornadoImplant;
      this.IMPLANT_CONFIG.violent_tornado_implant.image =
        images.violentTornadoImplant;
    }

    this.createHotbarUI();
    this.setupKeyboard();

    this.isInitialized = true;
    console.log("✅ Implants System initialized");
  },

  // Создаём панель хотбара имплантов + фон + онлайн
  createHotbarUI: function () {
    // Если уже создан — не дублируем
    if (document.getElementById("implantHotbarContainer")) return;

    const hotbarContainer = document.createElement("div");
    hotbarContainer.id = "implantHotbarContainer";

    // Контейнер теперь реальный блок с фоном (позиционирование и размер — в CSS)
    hotbarContainer.style.pointerEvents = "none"; // клики только у слотов

    for (let i = 0; i < 4; i++) {
      const slot = document.createElement("div");
      slot.id = `implantHotbar${i}`;
      slot.className = `implant-hotbar-slot implant-hotbar-${i}`;

      // минимальные инлайн-стили (остальное в CSS)
      slot.style.display = "flex";
      slot.style.alignItems = "center";
      slot.style.justifyContent = "center";
      slot.style.cursor = "pointer";
      slot.style.pointerEvents = "auto";
      slot.style.fontSize = "28px";
      slot.style.color = "#00ffff";
      slot.style.textShadow = "0 0 10px #00ffff";
      slot.style.transition = "all 0.2s";
      slot.textContent = (i + 1).toString();

      slot.addEventListener("click", () => this.useImplant(i));
      slot.addEventListener("touchstart", (e) => {
        e.preventDefault();
        this.useImplant(i);
      });

      hotbarContainer.appendChild(slot);
    }

    // Переносим онлайн внутрь панели, чтобы он жил относительно фона
    const onlineEl = document.getElementById("onlineCount");
    if (onlineEl) {
      hotbarContainer.appendChild(onlineEl);
    }

    const gameContainer = document.getElementById("gameContainer");
    if (gameContainer) {
      gameContainer.appendChild(hotbarContainer);
    }
  },

  setupKeyboard: function () {
    document.addEventListener("keydown", (e) => {
      // Не активируем импланты, пока игрок печатает в чате
      if (
        window.isChatInputFocused ||
        document.activeElement === document.getElementById("chatInput") ||
        document.activeElement === document.getElementById("stackableAmount")
      ) {
        return;
      }

      if (e.key >= "1" && e.key <= "4") {
        const slotIndex = parseInt(e.key) - 1;
        // Не блокируем, если открыт инвентарь/экипировка — как ты просил
        this.useImplant(slotIndex);
      }
    });
  },

  // Экипировать имплант из инвентаря (автоматически в первый свободный слот)
  equipImplant: function (inventorySlotIndex) {
    const item = window.inventory ? window.inventory[inventorySlotIndex] : null;
    if (
      !item ||
      typeof item.type !== "string" ||
      !item.type.endsWith("_implant")
    ) {
      showNotification("Это не имплант!", "#ff4444");
      return false;
    }

    const freeSlot = this.implantSlots.findIndex((slot) => slot === null);
    if (freeSlot === -1) {
      showNotification(
        "Все 4 слота имплантов заняты! Снимите ненужный.",
        "#ffaa00",
      );
      return false;
    }

    // Экипируем
    this.implantSlots[freeSlot] = {
      type: item.type,
      itemId: item.itemId || Date.now().toString(),
    };

    // Убираем из инвентаря
    if (window.inventory) window.inventory[inventorySlotIndex] = null;

    this.updateHotbarDisplay();

    // Отправляем на сервер
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendWhenReady(
        ws,
        JSON.stringify({
          type: "equipItem",
          slotIndex: inventorySlotIndex,
          slotName: `implant${freeSlot + 1}`,
        }),
      );
    }

    const name = this.IMPLANT_CONFIG[item.type]?.name || "Имплант";
    showNotification(`${name} экипирован в слот ${freeSlot + 1}`, "#00ffcc");
    return true;
  },

  // Снять имплант
  unequipImplant: function (implantSlotIndex) {
    if (implantSlotIndex < 0 || implantSlotIndex > 3) return;
    const implant = this.implantSlots[implantSlotIndex];
    if (!implant) return;

    const freeInvSlot = window.inventory
      ? window.inventory.findIndex((s) => s === null)
      : -1;
    if (freeInvSlot === -1) {
      showNotification("Инвентарь полон!", "#ff4444");
      return;
    }

    if (window.inventory) {
      window.inventory[freeInvSlot] = {
        type: implant.type,
        itemId: implant.itemId,
      };
    }

    this.implantSlots[implantSlotIndex] = null;
    this.updateHotbarDisplay();

    if (ws && ws.readyState === WebSocket.OPEN) {
      sendWhenReady(
        ws,
        JSON.stringify({
          type: "unequipItem",
          slotName: `implant${implantSlotIndex + 1}`,
          inventorySlot: freeInvSlot,
        }),
      );
    }

    showNotification(
      `Имплант снят из слота ${implantSlotIndex + 1}`,
      "#ffaa00",
    );
  },

  syncFromEquipment: function (equipment) {
    for (let i = 1; i <= 4; i++) {
      const slotKey = `implant${i}`;
      this.implantSlots[i - 1] = equipment[slotKey]
        ? { ...equipment[slotKey] }
        : null;
    }
    this.updateHotbarDisplay();
  },

  getAimWorldPosition: function (me) {
    if (!me) {
      return null;
    }

    const pointerWorld = window.inputSystem?.getPointerWorld?.({
      refresh: true,
    });

    if (
      pointerWorld &&
      Number.isFinite(pointerWorld.x) &&
      Number.isFinite(pointerWorld.y)
    ) {
      return pointerWorld;
    }

    const viewportCenter = window.inputSystem?.getViewportCenterWorld?.();

    if (
      viewportCenter &&
      Number.isFinite(viewportCenter.x) &&
      Number.isFinite(viewportCenter.y)
    ) {
      return viewportCenter;
    }

    const direction = this.getDirectionVector(me.direction);

    return {
      x: me.x + 35 + direction.x * 100,
      y: me.y + 20 + direction.y * 100,
    };
  },

  // Использовать имплант (по клавише или клику)
  useImplant: function (slotIndex) {
    if (window.worldSystem?.currentWorldId === 0) {
      this.aiming = null;
      showNotification("Not in the city!", "#ff4444");
      return;
    }

    const implant = this.implantSlots[slotIndex];
    if (!implant) {
      showNotification("Слот пуст!", "#ff4444");
      return;
    }

    const now = Date.now();
    const currentCooldown = this.getCurrentCooldownMs();

    if (now - this.lastUseTime[slotIndex] < currentCooldown) {
      const remaining = Math.ceil(
        (currentCooldown - (now - this.lastUseTime[slotIndex])) / 1000,
      );
      showNotification(`Кулдаун: ${remaining} сек`, "#ff8800");
      return;
    }

    const config = this.IMPLANT_CONFIG[implant.type];
    if (!config) return;

    const me = players.get(myId);
    if (!me) return;

    if (config.type === "projectile") {
      // === ПРОЕКТАЙЛ (fireball) ===
      const aimWorld = this.getAimWorldPosition(me);

      if (!aimWorld) {
        return;
      }

      const aimXLocal = aimWorld.x;
      const aimYLocal = aimWorld.y;

      const dx = aimXLocal - (me.x + 35);
      const dy = aimYLocal - (me.y + 20);
      const speed = config.speed || 8;
      let vx = dx,
        vy = dy;
      const len = Math.hypot(vx, vy);

      if (len > 0) {
        vx = (vx / len) * speed;
        vy = (vy / len) * speed;
      } else {
        vx = speed;
        vy = 0;
      }

      // === Правильный maxDistance как на сервере ===
      let playerRangeBonus = 0;
      try {
        playerRangeBonus =
          Number(me.skills?.find((s) => s.id === 9)?.level || 0) * 10;
      } catch (e) {}
      const maxDistance = 300 + playerRangeBonus;

      const projectileId = `imp_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;

      if (!ws || ws.readyState !== WebSocket.OPEN) {
        showNotification("Нет соединения с сервером", "#ff4444");
        return;
      }

      this.pendingProjectileRequests.set(projectileId, slotIndex);

      if (window.implantProjectiles) {
        window.implantProjectiles.push({
          id: projectileId,
          clientProjectileId: projectileId,
          serverConfirmed: false,
          x: me.x + 35,
          y: me.y + 20,
          vx: vx,
          vy: vy,
          type:
            implant.type === "violent_tornado_implant"
              ? "violent_tornado"
              : "fireball",
          ownerId: myId,
          traveled: 0,
          maxDistance: maxDistance,
          spawnTime: Date.now(),
          isOwn: true,
          baseVx: vx,
          baseVy: vy,
          perpX: len > 0 ? -vy / len : 0,
          perpY: len > 0 ? vx / len : 0,
          waveAmplitude: implant.type === "violent_tornado_implant" ? 10 : 0,
          waveFreq: implant.type === "violent_tornado_implant" ? 0.025 : 0,
          lastWaveOffset: 0,
        });
      }

      // Отправляем на сервер
      if (ws && ws.readyState === WebSocket.OPEN) {
        this.lastUseTime[slotIndex] = Date.now(); // локальный UX
        sendWhenReady(
          ws,
          JSON.stringify({
            type: "useImplant",
            implantSlotIndex: slotIndex,
            clientProjectileId: projectileId,
            aimX: aimXLocal,
            aimY: aimYLocal,
          }),
        );
      }
    } else if (config.type === "lightning") {
      const target = this.getSelectedTarget();
      if (!target) {
        showNotification("Нет выбранной цели!", "#ff4444");
        return;
      }

      const dx = (target.x || 0) - me.x;
      const dy = (target.y || 0) - me.y;
      const dist = Math.hypot(dx, dy);
      const bonus = this.getRangeBonusFromSkill();
      if (dist > (config.range || 300) + bonus) {
        showNotification("Цель слишком далеко!", "#ff4444");
        return;
      }

      if (ws && ws.readyState === WebSocket.OPEN) {
        this.lastUseTime[slotIndex] = Date.now();
        sendWhenReady(
          ws,
          JSON.stringify({
            type: "useImplant",
            implantSlotIndex: slotIndex,
            targetType: target.type,
            targetId: target.id,
          }),
        );
      }
    } else if (config.type === "area") {
      if (
        this.aiming &&
        this.aiming.active &&
        this.aiming.slotIndex === slotIndex
      ) {
        this.aiming = null;
        showNotification("Режим прицеливания отменён", "#ffaa00");
        return;
      }
      this.aiming = { slotIndex: slotIndex, active: true };
      showNotification(
        "Режим прицеливания: кликните по полю, чтобы применить",
        "#00ccff",
      );
      return;
    }

    showNotification(`Использован: ${config.name}`, "#ff4400");
  },

  updateHotbarDisplay: function () {
    for (let i = 0; i < 4; i++) {
      const el = document.getElementById(`implantHotbar${i}`);
      if (!el) continue;

      el.innerHTML = "";
      const implant = this.implantSlots[i];

      if (implant && this.IMPLANT_CONFIG[implant.type]) {
        const cfg = this.IMPLANT_CONFIG[implant.type];
        const img = document.createElement("img");
        img.src = cfg.hotbarImage ? cfg.hotbarImage.src : "fireballHotBar.png";
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "contain";
        el.appendChild(img);
        el.style.opacity = "1";
      } else {
        el.textContent = (i + 1).toString();
        el.style.opacity = "0.45";
      }
    }
  },

  getDirectionVector: function (direction) {
    const vectors = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
      "up-left": { x: -0.7071, y: -0.7071 },
      "up-right": { x: 0.7071, y: -0.7071 },
      "down-left": { x: -0.7071, y: 0.7071 },
      "down-right": { x: 0.7071, y: 0.7071 },
    };
    return vectors[direction] || { x: 1, y: 0 };
  },

  // Возвращает выбранную цель: сначала игроки (tradeSystem), затем выбранный моб (window.selectedEnemyId)
  getSelectedTarget: function () {
    // Приоритет: выбранный враг
    if (window.selectedEnemyId) {
      const en = window.enemies?.get(window.selectedEnemyId);
      if (en && en.health > 0) {
        return {
          type: "enemy",
          id: window.selectedEnemyId,
          x: en.x,
          y: en.y,
          worldId: en.worldId,
        };
      }
      if (en && en.health > 0) {
        return { type: "enemy", id: window.selectedEnemyId, x: en.x, y: en.y };
      } else {
        window.selectedEnemyId = null; // если моб умер — сразу снимаем
      }
    }

    // Затем выбранный игрок для торговли
    if (window.tradeSystem && window.tradeSystem.selectedPlayerId) {
      const pid = window.tradeSystem.selectedPlayerId;
      const p = players.get(pid);
      if (p && p.health > 0) {
        return { type: "player", id: pid, x: p.x, y: p.y, worldId: p.worldId };
      }
    }

    return null;
  },

  selectEnemy: function (enemyId) {
    const enemy = window.enemies?.get(enemyId);
    if (!enemy || enemy.health <= 0) {
      console.warn("[implantsSystem] Enemy not found or dead:", enemyId);
      return false;
    }

    const me = players.get(myId);
    if (!me) return false;

    const dist = Math.hypot(enemy.x - me.x, enemy.y - me.y);
    if (dist > 650) {
      showNotification("Враг слишком далеко", "#ff6666");
      return false;
    }

    window.selectedEnemyId = enemyId; // Гарантированно устанавливаем
    showNotification(`Цель: ${enemy.type.toUpperCase()}`, "#00ffcc");
    return true;
  },

  // Проверка готовности Lightning (для UI)
  isLightningReady: function () {
    const slot = this.implantSlots.findIndex(
      (s) => s?.type === "lightning_implant",
    );
    if (slot === -1) return false;
    return Date.now() - this.lastUseTime[slot] >= this.COOLDOWN_MS;
  },

  isAimInRange: function (aimX, aimY, maxRange = 300) {
    const me = players.get(myId);
    if (!me) return false;
    const dx = aimX - (me.x + 35);
    const dy = aimY - (me.y + 20);
    const bonus = this.getRangeBonusFromSkill();
    return Math.hypot(dx, dy) <= maxRange + bonus;
  },
};

// Экспорт
window.implantsSystem = implantsSystem;
