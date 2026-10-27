const strongStrikeSystem = {
  BASE_MELEE_MIN: 5,
  BASE_MELEE_MAX: 10,

  /**
   * Возвращает текущий диапазон урона в ближнем бою
   * @returns {{ min: number, max: number }}
   */
  getCurrentMeleeDamageRange() {
    const me = players.get(myId);
    if (!me) return { min: this.BASE_MELEE_MIN, max: this.BASE_MELEE_MAX };

    // 1. Бонус от уровня (уже есть в levelSystem)
    const levelBonus = window.levelSystem?.meleeDamageBonus || 0;

    // 2. Бонус от навыка "Сильный удар" (id = 1)
    let skillBonus = 0;
    if (me.skills) {
      const strongStrike = me.skills.find((s) => s.id === 1);
      skillBonus = strongStrike ? strongStrike.level : 0;
    }

    // 3. Бонус от экипировки (оружие + offhand, только melee)
    let equipMin = 0;
    let equipMax = 0;

    ["weapon", "offhand"].forEach((slotName) => {
      const item = window.equipmentSystem?.equipmentSlots?.[slotName];
      if (!item) return;

      const config = window.equipmentSystem?.EQUIPMENT_CONFIG?.[item.type];
      if (!config || config.effect?.range) return; // игнорируем дальнобойное

      const dmg = config.effect?.damage;
      if (dmg && typeof dmg === "object") {
        equipMin += dmg.min || 0;
        equipMax += dmg.max || 0;
      }
    });

    // Итоговый расчёт
    const finalMin = this.BASE_MELEE_MIN + levelBonus + skillBonus + equipMin;
    const finalMax = this.BASE_MELEE_MAX + levelBonus + skillBonus + equipMax;

    return {
      min: Math.max(1, Math.floor(finalMin)), // минимум 1, чтобы не было 0
      max: Math.max(finalMin, Math.floor(finalMax)),
    };
  },

  /**
   * Возвращает строку для описания (для UI, тултипов и т.д.)
   */
  getBonusDescription() {
    const range = this.getCurrentMeleeDamageRange();
    const parts = [];

    if (window.levelSystem?.meleeDamageBonus > 0)
      parts.push(`+${window.levelSystem.meleeDamageBonus} от уровня`);

    const me = players.get(myId);
    if (me?.skills) {
      const skill = me.skills.find((s) => s.id === 1);
      if (skill?.level > 0)
        parts.push(`+${skill.level} от навыка "Сильный удар"`);
    }

    return parts.length > 0 ? parts.join(", ") : "Базовый урон";
  },

  initialize() {
    console.log("[StrongStrike] Система инициализирована");
    // Можно добавить слушатель на upgradeSkillResult, если захочешь перерасчёт
  },
};

window.strongStrikeSystem = strongStrikeSystem;
