// regeneration.js

window.regenerationSystem = {
  interval: null,
  lastDamageTime: 0,
  REGEN_DELAY_AFTER_DAMAGE: 30000, // 30 секунд после урона

  // Запуск системы регенерации
  start() {
    if (this.interval) {
      clearInterval(this.interval);
    }

    this.interval = setInterval(() => {
      const now = Date.now();

      // Диагностика: почему не регенерируем
      if (now - this.lastDamageTime < this.REGEN_DELAY_AFTER_DAMAGE) {
        const secLeft = Math.ceil(
          (this.REGEN_DELAY_AFTER_DAMAGE - (now - this.lastDamageTime)) / 1000,
        );
        return;
      }

      const me = players.get(myId);
      if (!me) {
        return;
      }

      if (me.health <= 0) {
        return;
      }

      const currentMaxHealth = me.maxStats?.health || 100;

      if (me.health >= currentMaxHealth) {
        return;
      }

      // Проверка навыка
      const regSkill = me.skills?.find((s) => s.id === 2);
      if (!regSkill || regSkill.level < 1) {
        this.stop();
        return;
      }

      // Формула: 1% от базовых 100 hp за каждый уровень навыка
      const percent = regSkill.level * 1;
      const BASE_HP = 100;
      let heal = Math.floor((BASE_HP * percent) / 100);

      if (heal <= 0) {
        return;
      }

      // ← Здесь была главная ошибка — maxHp не был объявлен
      const missing = currentMaxHealth - me.health;
      heal = Math.min(heal, missing);

      if (heal <= 0) {
        return;
      }

      if (ws?.readyState !== WebSocket.OPEN) {
        console.warn("[Regen] WebSocket не открыт — запрос не отправлен");
        return;
      }

      sendWhenReady(
        ws,
        JSON.stringify({
          type: "requestRegeneration",
          amount: heal,
          currentHealth: me.health,
          skillLevel: regSkill.level,
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
    const now = Date.now();
    this.lastDamageTime = now;
  },

  // Вызывать один раз после загрузки данных игрока
  tryAutoStart() {
    const me = players.get(myId);
    if (!me) {
      return;
    }

    const hasRegenSkill = me.skills?.some((s) => s.id === 2 && s.level >= 1);
    if (hasRegenSkill) {
      this.start();
    }
  },
};

window.addEventListener("load", () => {
  const checkInterval = setInterval(() => {
    if (myId && players.has(myId) && ws?.readyState === WebSocket.OPEN) {
      window.regenerationSystem.tryAutoStart();
      clearInterval(checkInterval);
    }
  }, 1000);
});
