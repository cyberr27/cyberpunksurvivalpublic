// regeneration.js

window.regenerationSystem = {
  interval: null,
  lastDamageTime: 0,
  REGEN_DELAY_AFTER_DAMAGE: 30000,

  getEffectiveRegenLevel(me) {
    if (!me) return 0;

    const base =
      Number(me.skills?.find((s) => s && Number(s.id) === 2)?.level || 0) || 0;

    let bonus = 0;
    if (Array.isArray(me.inventory)) {
      for (const slot of me.inventory) {
        if (!slot || !slot.type) continue;
        const cfg =
          typeof ITEM_CONFIG !== "undefined" ? ITEM_CONFIG[slot.type] : null;
        if (cfg?.skillBonus && Number(cfg.skillBonus.skillId) === 2) {
          bonus += Number(cfg.skillBonus.value) || 0;
        }
      }
    }

    return Math.min(30, base + bonus);
  },

  start() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.interval = setInterval(() => {
      const now = Date.now();

      if (now - this.lastDamageTime < this.REGEN_DELAY_AFTER_DAMAGE) {
        return;
      }

      const me = players.get(myId);
      if (!me || me.health <= 0) return;

      const currentMaxHealth = me.maxStats?.health || 100;
      if (me.health >= currentMaxHealth) return;

      // ← КРИТИЧНОЕ ИСПРАВЛЕНИЕ: надёжная проверка навыка
      const effectiveLevel = this.getEffectiveRegenLevel(me);

      if (effectiveLevel < 1) {
        this.stop();
        return;
      }

      // 1 HP за каждый effective level (точно как на сервере)
      let heal = effectiveLevel;

      if (heal <= 0) return;

      const missing = currentMaxHealth - me.health;
      heal = Math.min(heal, missing);

      if (heal <= 0) return;

      if (ws?.readyState !== WebSocket.OPEN) return;

      sendWhenReady(
        ws,
        JSON.stringify({
          type: "requestRegeneration",
          amount: heal,
          currentHealth: me.health,
          skillLevel: effectiveLevel,
        }),
      );
    }, 30000);
  },

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  },

  resetTimerOnDamage() {
    this.lastDamageTime = Date.now();
  },

  tryAutoStart() {
    const me = players.get(myId);
    if (!me) return;

    if (this.getEffectiveRegenLevel(me) >= 1) {
      this.start();
    }
  },
};

window.addEventListener("load", () => {
  const checkInterval = setInterval(() => {
    if (
      window.myId &&
      players.has(window.myId) &&
      ws?.readyState === WebSocket.OPEN
    ) {
      window.regenerationSystem.tryAutoStart();
      clearInterval(checkInterval);
    }
  }, 1000);
});

// Дополнительная защита — запускаем при получении полного состояния игрока
window.addEventListener("regenerationCheck", () => {
  if (window.myId && players.has(window.myId)) {
    window.regenerationSystem.tryAutoStart();
  }
});
