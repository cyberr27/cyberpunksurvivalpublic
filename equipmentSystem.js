const equipmentSystem = {
  isEquipmentOpen: false,
  isInitialized: false,

  // === ДОБАВЛЕНЫ 4 СЛОТА ИМПЛАНТОВ ===
  equipmentSlots: {
    head: null,
    chest: null,
    belt: null,
    pants: null,
    boots: null,
    weapon: null,
    offhand: null,
    gloves: null,
    implant1: null,
    implant2: null,
    implant3: null,
    implant4: null,
  },

  EQUIPMENT_TYPES: {
    headgear: "head",
    armor: "chest",
    belt: "belt",
    pants: "pants",
    boots: "boots",
    weapon: "weapon",
    gloves: "gloves",
    implant: null,
  },

  BASE_MELEE_MIN: 5,
  BASE_MELEE_MAX: 10,

  getCurrentMeleeDamage: function () {
    const levelBonus = window.levelSystem.meleeDamageBonus || 0;

    // Бонус от навыка "Сильный удар"
    const me = players.get(myId);
    let strongStrikeBonus = 0;
    if (me && me.skills) {
      const strongStrike = me.skills.find((s) => s.id === 1);
      strongStrikeBonus = strongStrike ? strongStrike.level : 0;
    }

    // Итоговый бонус = уровень + навык
    const totalBonus = levelBonus + strongStrikeBonus;

    let min = this.BASE_MELEE_MIN + totalBonus;
    let max = this.BASE_MELEE_MAX + totalBonus;

    // Суммируем от weapon и offhand, если !range (melee)
    ["weapon", "offhand"].forEach((slotName) => {
      const weaponSlot = this.equipmentSlots[slotName];
      if (!weaponSlot || !this.EQUIPMENT_CONFIG[weaponSlot.type]) return;

      const config = this.EQUIPMENT_CONFIG[weaponSlot.type];
      if (config.effect.range) return; // Игнор ranged

      const dmgEffect = config.effect.damage;
      if (
        dmgEffect &&
        typeof dmgEffect === "object" &&
        dmgEffect.min !== undefined &&
        dmgEffect.max !== undefined
      ) {
        min += dmgEffect.min;
        max += dmgEffect.max;
      }
    });

    return { min, max };
  },

  updateDamageDisplay: function () {
    let dmg;
    if (
      window.strongStrikeSystem &&
      typeof window.strongStrikeSystem.getCurrentMeleeDamageRange === "function"
    ) {
      const range = window.strongStrikeSystem.getCurrentMeleeDamageRange();
      dmg = { min: range.min, max: range.max };
    } else {
      dmg = this.getCurrentMeleeDamage();
    }

    const currentStr = `${dmg.min}-${dmg.max}`;
    const displayEl = document.getElementById("damageDisplay");
    if (displayEl) {
      displayEl.textContent = currentStr;
      displayEl.style.color =
        this.equipmentSlots.weapon !== null ||
        this.equipmentSlots.offhand !== null
          ? "red"
          : "#ffaa00";
    }
  },

  EQUIPMENT_CONFIG: {
    cyber_helmet: {
      type: "headgear",
      effect: { armor: 10, energy: 5 },
      description: "Кибершлем: +10 брони, +5 энергии",
      rarity: 4,
      image: new Image(),
      level: 5,
      canBeAutoSpawned: false,
      canDropFromEnemy: false,
    },
    nano_armor: {
      type: "armor",
      effect: { armor: 20, health: 10 },
      description: "Нано-броня: +20 брони, +10 здоровья",
      rarity: 4,
      image: new Image(),
      level: 5,
      canBeAutoSpawned: false,
      canDropFromEnemy: false,
    },
    tactical_belt: {
      type: "belt",
      effect: { armor: 5, food: 5 },
      description: "Тактический пояс: +5 брони, +5 еды",
      rarity: 4,
      image: new Image(),
      level: 5,
      canBeAutoSpawned: false,
      canDropFromEnemy: false,
    },
    cyber_pants: {
      type: "pants",
      effect: { armor: 10, water: 5 },
      description: "Киберштаны: +10 брони, +5 воды",
      rarity: 4,
      image: new Image(),
      level: 5,
      canBeAutoSpawned: false,
      canDropFromEnemy: false,
    },
    speed_boots: {
      type: "boots",
      effect: { armor: 5, energy: 10 },
      description: "Скоростные ботинки: +5 брони, +10 энергии",
      rarity: 4,
      image: new Image(),
      level: 5,
      canBeAutoSpawned: false,
      canDropFromEnemy: false,
    },
    tech_gloves: {
      type: "gloves",
      effect: { armor: 5, energy: 5 },
      description: "Технические перчатки: +5 брони, +5 энергии",
      rarity: 4,
      image: new Image(),
      level: 5,
      canBeAutoSpawned: false,
      canDropFromEnemy: false,
    },
    plasma_rifle: {
      type: "weapon",
      effect: { damage: 50, range: 200 },
      description: "Плазменная винтовка: +15 урона, дальнобойная",
      rarity: 4,
      image: new Image(),
      hands: "twohanded",
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: false,
    },
    knuckles: {
      type: "weapon",
      effect: { damage: { min: 3, max: 7 } },
      description: "Кастет: 3-7 урона в ближнем бою",
      rarity: 4,
      image: new Image(),
      hands: "onehanded",
      level: 2,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    knife: {
      type: "weapon",
      effect: { damage: { min: 4, max: 6 } },
      description: "Нож: 4-6 урона в ближнем бою",
      rarity: 4,
      image: new Image(),
      hands: "onehanded",
      level: 3,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    nano_absorbing_knife: {
      type: "weapon",
      effect: { damage: { min: 6, max: 9 } },
      description: "Нож: 6-9 урона в ближнем бою",
      rarity: 4,
      image: new Image(),
      hands: "onehanded",
      level: 3,
      canBeAutoSpawned: false,
      canDropFromEnemy: false,
    },
    bat: {
      type: "weapon",
      effect: { damage: { min: 5, max: 10 } },
      description: "Бита: 5-10 урона в ближнем бою",
      rarity: 4,
      image: new Image(),
      hands: "onehanded",
      level: 4,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    torn_baseball_cap_of_health: {
      type: "headgear",
      effect: { armor: 5, health: 5 },
      description:
        "Порванная кепка здоровья: +5 к максимальному здоровью и броне",
      rarity: 4,
      collection: "Torn Health",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    torn_health_t_shirt: {
      type: "armor",
      effect: { armor: 10, health: 10 },
      description:
        "Порванная футболка здоровья: +10 к максимальному здоровью, +10 к броне",
      rarity: 4,
      collection: "Torn Health",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    torn_health_gloves: {
      type: "gloves",
      effect: { armor: 5, health: 3 },
      description:
        "Порванные перчатки здоровья: +3 к максимальному здоровью, +5 к броне",
      rarity: 4,
      collection: "Torn Health",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    torn_belt_of_health: {
      type: "belt",
      effect: { armor: 3, health: 7 },
      description:
        "Порванный пояс здоровья: +7 к максимальному здоровью, +3 к броне",
      rarity: 4,
      collection: "Torn Health",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    torn_pants_of_health: {
      type: "pants",
      effect: { armor: 7, health: 6 },
      description:
        "Порванные штаны здоровья: +6 к максимальному здоровью, +7 к броне",
      rarity: 4,
      collection: "Torn Health",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    torn_health_sneakers: {
      type: "boots",
      effect: { armor: 5, health: 4 },
      description:
        "Порванные кроссовки здоровья: +4 к максимальному здоровью, +5 к броне",
      rarity: 4,
      collection: "Torn Health",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },

    torn_energy_cap: {
      type: "headgear",
      effect: { armor: 5, energy: 5 },
      description:
        "Порванная кепка энергии: +5 к максимальной энергии, +5 к броне",
      rarity: 4,
      collection: "Torn Energy",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    torn_energy_t_shirt: {
      type: "armor",
      effect: { armor: 10, energy: 10 },
      description:
        "Порванная футболка энергии: +10 к максимальной энергии, +10 к броне",
      rarity: 4,
      collection: "Torn Energy",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    torn_gloves_of_energy: {
      type: "gloves",
      effect: { armor: 5, energy: 3 },
      description:
        "Порванные перчатки энергии: +3 к максимальной энергии, +5 к броне",
      rarity: 4,
      collection: "Torn Energy",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    torn_energy_belt: {
      type: "belt",
      effect: { armor: 3, energy: 7 },
      description:
        "Порванный пояс энергии: +7 к максимальной энергии, +3 к броне",
      rarity: 4,
      collection: "Torn Energy",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    torn_pants_of_energy: {
      type: "pants",
      effect: { armor: 7, energy: 6 },
      description:
        "Порванные штаны энергии: +6 к максимальной энергии, +7 к броне",
      rarity: 4,
      collection: "Torn Energy",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    torn_sneakers_of_energy: {
      type: "boots",
      effect: { armor: 5, energy: 4 },
      description:
        "Порванные кроссовки энергии: +4 к максимальной энергии, +5 к броне",
      rarity: 4,
      collection: "Torn Energy",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },

    torn_cap_of_gluttony: {
      type: "headgear",
      effect: { armor: 5, food: 5 },
      description:
        "Порванная кепка обжорства: +5 к максимальной еде, +5 к броне",
      rarity: 4,
      collection: "Torn Gluttony",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    torn_t_shirt_of_gluttony: {
      type: "armor",
      effect: { armor: 10, food: 10 },
      description:
        "Порванная футболка обжорства: +10 к максимальной еде, +10 к броне",
      rarity: 4,
      collection: "Torn Gluttony",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    torn_gloves_of_gluttony: {
      type: "gloves",
      effect: { armor: 5, food: 3 },
      description:
        "Порванные перчатки обжорства: +3 к максимальной еде, +5 к броне",
      rarity: 4,
      collection: "Torn Gluttony",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    torn_belt_of_gluttony: {
      type: "belt",
      effect: { armor: 3, food: 7 },
      description:
        "Порванный пояс обжорства: +7 к максимальной еде, +3 к броне",
      rarity: 4,
      collection: "Torn Gluttony",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    torn_pants_of_gluttony: {
      type: "pants",
      effect: { armor: 7, food: 6 },
      description:
        "Порванные штаны обжорства: +6 к максимальной еде, +7 к броне",
      rarity: 4,
      collection: "Torn Gluttony",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    torn_sneakers_of_gluttony: {
      type: "boots",
      effect: { armor: 5, food: 4 },
      description:
        "Порванные кроссовки обжорства: +4 к максимальной еде, +5 к броне",
      rarity: 4,
      collection: "Torn Gluttony",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },

    torn_cap_of_thirst: {
      type: "headgear",
      effect: { armor: 5, water: 5 },
      description: "Порванная кепка жажды: +5 к максимальной воде, +5 к броне",
      rarity: 4,
      collection: "Torn Thirst",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    torn_t_shirt_of_thirst: {
      type: "armor",
      effect: { armor: 10, water: 10 },
      description:
        "Порванная футболка жажды: +10 к максимальной воде, +10 к броне",
      rarity: 4,
      collection: "Torn Thirst",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    torn_gloves_of_thirst: {
      type: "gloves",
      effect: { armor: 5, water: 3 },
      description:
        "Порванные перчатки жажды: +3 к максимальной воде, +5 к броне",
      rarity: 4,
      collection: "Torn Thirst",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    torn_belt_of_thirst: {
      type: "belt",
      effect: { armor: 3, water: 7 },
      description: "Порванный пояс жажды: +7 к максимальной воде, +3 к броне",
      rarity: 4,
      collection: "Torn Thirst",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    torn_pants_of_thirst: {
      type: "pants",
      effect: { armor: 7, water: 6 },
      description: "Порванные штаны жажды: +6 к максимальной воде, +7 к броне",
      rarity: 4,
      collection: "Torn Thirst",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    torn_sneakers_of_thirst: {
      type: "boots",
      effect: { armor: 5, water: 4 },
      description:
        "Порванные кроссовки жажды: +4 к максимальной воде, +5 к броне",
      rarity: 4,
      collection: "Torn Thirst",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    nanofabric_health_cap: {
      type: "headgear",
      effect: { armor: 10, health: 15 },
      description:
        "Нанофабриковая кепка здоровья: +15 к максимальному здоровью, +10 брони",
      rarity: 4,
      collection: "Nanofabric Health",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    energy_cap_made_of_nanofabric: {
      type: "headgear",
      effect: { armor: 10, energy: 15 },
      description:
        "Кепка энергии из нанофабрики: +15 к максимальной энергии, +10 брони",
      rarity: 4,
      collection: "Nanofabric Energy",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    thirst_cap_made_of_nanofabric: {
      type: "headgear",
      effect: { armor: 10, water: 15 },
      description:
        "Кепка жажды из нанофабрики: +15 к максимальной воде, +10 брони",
      rarity: 4,
      collection: "Nanofabric Thirst",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    gluttony_cap_made_of_nanofabric: {
      type: "headgear",
      effect: { armor: 10, food: 15 },
      description:
        "Кепка обжорства из нанофабрики: +15 к максимальной еде, +10 брони",
      rarity: 4,
      collection: "Nanofabric Gluttony",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },

    nanofiber_health_t_shirt: {
      type: "armor",
      effect: { armor: 20, health: 30 },
      description:
        "Нанофибровая футболка здоровья: +30 к максимальному здоровью, +20 брони",
      rarity: 4,
      collection: "Nanofabric Health",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    energy_t_shirt_made_of_nanofiber: {
      type: "armor",
      effect: { armor: 20, energy: 30 },
      description:
        "Футболка энергии из нанофибры: +30 к максимальной энергии, +20 брони",
      rarity: 4,
      collection: "Nanofabric Energy",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    nanofiber_thirst_t_shirt: {
      type: "armor",
      effect: { armor: 20, water: 30 },
      description:
        "Футболка жажды из нанофибры: +30 к максимальной воде, +20 брони",
      rarity: 4,
      collection: "Nanofabric Thirst",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    gluttony_t_shirt_made_of_nanofiber: {
      type: "armor",
      effect: { armor: 20, food: 30 },
      description:
        "Футболка обжорства из нанофибры: +30 к максимальной еде, +20 брони",
      rarity: 4,
      collection: "Nanofabric Gluttony",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },

    nanofiber_health_gloves: {
      type: "gloves",
      effect: { armor: 10, health: 12 },
      description:
        "Нанофибровые перчатки здоровья: +12 к максимальному здоровью, +10 брони",
      rarity: 4,
      collection: "Nanofabric Health",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    nanofiber_energy_gloves: {
      type: "gloves",
      effect: { armor: 10, energy: 12 },
      description:
        "Перчатки энергии из нанофибры: +12 к максимальной энергии, +10 брони",
      rarity: 4,
      collection: "Nanofabric Energy",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    nanofiber_thirst_gloves: {
      type: "gloves",
      effect: { armor: 10, water: 12 },
      description:
        "Перчатки жажды из нанофибры: +12 к максимальной воде, +10 брони",
      rarity: 4,
      collection: "Nanofabric Thirst",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    gluttony_gloves_made_of_nanofiber: {
      type: "gloves",
      effect: { armor: 10, food: 12 },
      description:
        "Перчатки обжорства из нанофибры: +12 к максимальной еде, +10 брони",
      rarity: 4,
      collection: "Nanofabric Gluttony",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },

    nanofiber_health_belt: {
      type: "belt",
      effect: { armor: 10, health: 21 },
      description:
        "Нанофибровый пояс здоровья: +21 к максимальному здоровью, +10 брони",
      rarity: 4,
      collection: "Nanofabric Health",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    nanofiber_energy_belt: {
      type: "belt",
      effect: { armor: 10, energy: 21 },
      description:
        "Пояс энергии из нанофибры: +21 к максимальной энергии, +10 брони",
      rarity: 4,
      collection: "Nanofabric Energy",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    nanofiber_thirst_belt: {
      type: "belt",
      effect: { armor: 10, water: 21 },
      description:
        "Пояс жажды из нанофибры: +21 к максимальной воде, +10 брони",
      rarity: 4,
      collection: "Nanofabric Thirst",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    nanofiber_gluttony_belt: {
      type: "belt",
      effect: { armor: 10, food: 21 },
      description:
        "Пояс обжорства из нанофибры: +21 к максимальной еде, +10 брони",
      rarity: 4,
      collection: "Nanofabric Gluttony",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },

    nanofiber_health_pants: {
      type: "pants",
      effect: { armor: 15, health: 18 },
      description:
        "Нанофибровые штаны здоровья: +18 к максимальному здоровью, +15 брони",
      rarity: 4,
      collection: "Nanofabric Health",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    nanofiber_energy_pants: {
      type: "pants",
      effect: { armor: 15, energy: 18 },
      description:
        "Штаны энергии из нанофибры: +18 к максимальной энергии, +15 брони",
      rarity: 4,
      collection: "Nanofabric Energy",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    nanofiber_thirst_pants: {
      type: "pants",
      effect: { armor: 15, water: 18 },
      description:
        "Штаны жажды из нанофибры: +18 к максимальной воде, +15 брони",
      rarity: 4,
      collection: "Nanofabric Thirst",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    gluttony_pants_made_of_nanofiber: {
      type: "pants",
      effect: { armor: 15, food: 18 },
      description:
        "Штаны обжорства из нанофибры: +18 к максимальной еде, +15 брони",
      rarity: 4,
      collection: "Nanofabric Gluttony",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },

    healthy_sneakers_made_of_nanofiber: {
      type: "boots",
      effect: { armor: 10, health: 24 },
      description:
        "Кроссовки здоровья из нанофибры: +24 к максимальному здоровью, +10 брони",
      rarity: 4,
      collection: "Nanofabric Health",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    energy_sneakers_made_of_nanofiber: {
      type: "boots",
      effect: { armor: 10, energy: 24 },
      description:
        "Кроссовки энергии из нанофибры: +24 к максимальной энергии, +10 брони",
      rarity: 4,
      collection: "Nanofabric Energy",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    nanofiber_thirst_sneakers: {
      type: "boots",
      effect: { armor: 10, water: 24 },
      description:
        "Кроссовки жажды из нанофибры: +24 к максимальной воде, +10 брони",
      rarity: 4,
      collection: "Nanofabric Thirst",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    gluttony_sneakers_made_of_nanofiber: {
      type: "boots",
      effect: { armor: 10, food: 24 },
      description:
        "Кроссовки обжорства из нанофибры: +24 к максимальной еде, +10 брони",
      rarity: 4,
      collection: "Nanofabric Gluttony",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    chameleon_belt: {
      type: "belt",
      effect: { armor: 12, health: 14, energy: 7, food: 7, water: 7 },
      description:
        "Хамелеон пояс: +12 брони, +14 здоровья, +7 энергии, +7 еды, +7 воды",
      rarity: 4,
      collection: "Light Chameleon",
      image: new Image(),
      level: 5,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    chameleon_cap: {
      type: "headgear",
      effect: { armor: 15, health: 10, energy: 5, food: 5, water: 5 },
      description:
        "Хамелеон кепка: +15 брони, +10 здоровья, +5 энергии, +5 еды, +5 воды",
      rarity: 4,
      collection: "Light Chameleon",
      image: new Image(),
      level: 5,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    chameleon_gloves: {
      type: "gloves",
      effect: { armor: 20, health: 6, energy: 3, food: 3, water: 3 },
      description:
        "Хамелеон перчатки: +20 брони, +6 здоровья, +3 энергии, +3 еды, +3 воды",
      rarity: 4,
      collection: "Light Chameleon",
      image: new Image(),
      level: 5,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    chameleon_pants: {
      type: "pants",
      effect: { armor: 21, health: 12, energy: 6, food: 6, water: 6 },
      description:
        "Хамелеон штаны: +21 брони, +12 здоровья, +6 энергии, +6 еды, +6 воды",
      rarity: 4,
      collection: "Light Chameleon",
      image: new Image(),
      level: 5,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    chameleon_sneakers: {
      type: "boots",
      effect: { armor: 15, health: 8, energy: 4, food: 4, water: 4 },
      description:
        "Хамелеон кроссовки: +15 брони, +8 здоровья, +4 энергии, +4 еды, +4 воды",
      rarity: 4,
      collection: "Light Chameleon",
      image: new Image(),
      level: 5,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    chameleon_t_shirt: {
      type: "armor",
      effect: { armor: 30, health: 20, energy: 10, food: 10, water: 10 },
      description:
        "Хамелеон футболка: +30 брони, +20 здоровья, +10 энергии, +10 еды, +10 воды",
      rarity: 4,
      collection: "Light Chameleon",
      image: new Image(),
      level: 5,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },

    whole_chameleon_cap: {
      type: "headgear",
      effect: { armor: 20, health: 20, energy: 8, food: 8, water: 8 },
      description:
        "Целостная кепка хамелеона: +20 брони, +20 здоровья, +8 к остальным статам",
      rarity: 4,
      collection: "Whole Chameleon",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    whole_chameleon_t_shirt: {
      type: "armor",
      effect: { armor: 40, health: 27, energy: 13, food: 13, water: 13 },
      description:
        "Целостная футболка хамелеона: +40 брони, +27 здоровья, +13 к остальным статам",
      rarity: 4,
      collection: "Whole Chameleon",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    whole_chameleon_gloves: {
      type: "gloves",
      effect: { armor: 30, health: 12, energy: 5, food: 5, water: 5 },
      description:
        "Целостные перчатки хамелеона: +30 брони, +12 здоровья, +5 к остальным статам",
      rarity: 4,
      collection: "Whole Chameleon",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    whole_chameleon_belt: {
      type: "belt",
      effect: { armor: 20, health: 20, energy: 8, food: 8, water: 8 },
      description:
        "Целостный пояс хамелеона: +20 брони, +20 здоровья, +8 к остальным статам",
      rarity: 4,
      collection: "Whole Chameleon",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    whole_chameleon_pants: {
      type: "pants",
      effect: { armor: 25, health: 15, energy: 7, food: 7, water: 7 },
      description:
        "Целостные штаны хамелеона: +25 брони, +15 здоровья, +7 к остальным статам",
      rarity: 4,
      collection: "Whole Chameleon",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    whole_chameleon_sneakers: {
      type: "boots",
      effect: { armor: 20, health: 15, energy: 8, food: 8, water: 8 },
      description:
        "Целостные кроссовки хамелеона: +20 брони, +15 здоровья, +8 к остальным статам",
      rarity: 4,
      collection: "Whole Chameleon",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },

    white_void_cap: {
      type: "headgear",
      effect: {},
      description: "Белая кепка Пустоты — чистый лист для будущих улучшений",
      rarity: 4,
      collection: "White Void",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    white_void_t_shirt: {
      type: "armor",
      effect: {},
      description: "Белая футболка Пустоты — чистый лист для будущих улучшений",
      rarity: 4,
      collection: "White Void",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    white_void_gloves: {
      type: "gloves",
      effect: {},
      description: "Белые перчатки Пустоты — чистый лист для будущих улучшений",
      rarity: 4,
      collection: "White Void",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    white_void_belt: {
      type: "belt",
      effect: {},
      description: "Белый пояс Пустоты — чистый лист для будущих улучшений",
      rarity: 4,
      collection: "White Void",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    white_void_pants: {
      type: "pants",
      effect: {},
      description: "Белые штаны Пустоты — чистый лист для будущих улучшений",
      rarity: 4,
      collection: "White Void",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    white_void_sneakers: {
      type: "boots",
      effect: {},
      description:
        "Белые кроссовки Пустоты — чистый лист для будущих улучшений",
      rarity: 4,
      collection: "White Void",
      image: new Image(),
      level: 0,
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    fireball_implant: {
      type: "implant",
      description: "Огненный шар — активный имплант (25-50 урона)",
      rarity: 8,
      image: new Image(),
      level: 0,
      effect: {},
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    lightning_implant: {
      type: "implant",
      description: "Молния — активный имплант (40-70 урона)",
      rarity: 8,
      image: new Image(),
      level: 0,
      effect: {},
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
    tornado_implant: {
      type: "implant",
      description: "Торнадо — активный имплант (60-100 урона)",
      rarity: 8,
      image: new Image(),
      level: 0,
      effect: {},
      canBeAutoSpawned: false,
      canDropFromEnemy: true,
    },
  },

  canEquipItem: function (itemType, playerLevel) {
    const config = this.EQUIPMENT_CONFIG[itemType];
    if (!config || config.level === undefined) return true;
    return playerLevel >= config.level;
  },

  initialize: function () {
    if (this.isInitialized) return;

    Object.keys(this.EQUIPMENT_CONFIG).forEach((key) => {
      const config = this.EQUIPMENT_CONFIG[key];

      if (key === "fireball_implant" || key === "lightning_implant") {
        // Специально для имплантов — берём из уже загруженного в code.js
        const imgKey =
          key === "fireball_implant" ? "fireballImplant" : "lightningImplant";
        if (images[imgKey] && images[imgKey].complete) {
          config.image = images[imgKey];
        } else {
          config.image = new Image();
          config.image.src =
            key === "fireball_implant"
              ? "fireballImplant.png"
              : "lightningImplant.png";
        }
      } else if (images[key]) {
        // Для всей остальной экипировки — используем уже загруженные изображения
        config.image = images[key];
      } else {
        // Обычная загрузка для старых предметов (на всякий случай)
        config.image = new Image();
        config.image.src = `${key}.png`;
      }
    });

    const equipmentBtn = document.createElement("img");
    equipmentBtn.id = "equipmentBtn";
    equipmentBtn.className = "cyber-btn-img";
    equipmentBtn.src = "images/equipment.png";
    equipmentBtn.alt = window.i18n
      ? window.i18n.t("alt_equipment")
      : "Equipment";
    equipmentBtn.style.position = "absolute";
    equipmentBtn.style.right = "10px";
    document.getElementById("gameContainer").appendChild(equipmentBtn);

    const equipmentContainer = document.createElement("div");
    equipmentContainer.id = "equipmentContainer";
    equipmentContainer.style.display = "none";
    equipmentContainer.innerHTML = `
      <div id="equipmentGrid"></div>
      <div id="damageDisplay"></div>
    `;
    document.getElementById("gameContainer").appendChild(equipmentContainer);

    this.setupEquipmentGrid();

    equipmentBtn.addEventListener("click", (e) => {
      e.preventDefault();
      this.toggleEquipment();
    });

    this.isInitialized = true;
    this.updateDamageDisplay();
  },

  setupEquipmentGrid: function () {
    const equipmentGrid = document.getElementById("equipmentGrid");
    equipmentGrid.style.display = "grid";

    // === ВОЗВРАЩАЕМ ОРИГИНАЛЬНОЕ ПОЗИЦИОНИРОВАНИЕ СЛОТОВ (как было до имплантов) ===
    equipmentGrid.style.gridTemplateAreas = `
      ". head ."
      "gloves chest weapon"
      "offhand belt ."
      ". pants ."
      ". boots ."
    `;

    equipmentGrid.style.gap = "8px";
    equipmentGrid.style.padding = "10px";

    const slots = [
      { name: "head", labelKey: "slot_head", defaultLabel: "Головной убор" },
      { name: "chest", labelKey: "slot_chest", defaultLabel: "Броня" },
      { name: "belt", labelKey: "slot_belt", defaultLabel: "Пояс" },
      { name: "pants", labelKey: "slot_pants", defaultLabel: "Штаны" },
      { name: "boots", labelKey: "slot_boots", defaultLabel: "Обувь" },
      {
        name: "weapon",
        labelKey: "slot_weapon",
        defaultLabel: "Оружие (основная рука)",
      },
      {
        name: "offhand",
        labelKey: "slot_offhand",
        defaultLabel: "Вторая рука",
      },
      { name: "gloves", labelKey: "slot_gloves", defaultLabel: "Перчатки" },
      // === НОВЫЕ СЛОТЫ ИМПЛАНТОВ (создаются, но без grid-area в шаблоне) ===
      // Позиционирование имплантов сделаешь сам в CSS позже
      { name: "implant1", label: "Имплант 1" },
      { name: "implant2", label: "Имплант 2" },
      { name: "implant3", label: "Имплант 3" },
      { name: "implant4", label: "Имплант 4" },
    ];

    slots.forEach((slotInfo) => {
      const slotEl = document.createElement("div");
      slotEl.className = `equipment-slot ${slotInfo.name}-slot`;
      slotEl.style.gridArea = slotInfo.name; // всё равно ставим, на случай если потом добавишь grid-area в CSS
      // локализованная подсказка
      if (window.i18n && slotInfo.labelKey) {
        if (slotInfo.name.startsWith("implant")) {
          // implant1..4 -> {n}
          const n = slotInfo.name.replace(/[^0-9]/g, "") || "";
          slotEl.title = window.i18n.t("slot_implant", { n });
        } else {
          slotEl.title = window.i18n.t(slotInfo.labelKey);
        }
      } else {
        slotEl.title = slotInfo.defaultLabel || slotInfo.label;
      }

      slotEl.addEventListener("dblclick", () =>
        this.unequipItem(slotInfo.name),
      );

      let lastTouchTime = 0;
      let tooltipTimeout;
      slotEl.addEventListener("touchstart", (e) => {
        e.preventDefault();
        const now = Date.now();
        if (now - lastTouchTime < 300) {
          this.unequipItem(slotInfo.name);
          if (tooltipTimeout) clearTimeout(tooltipTimeout);
        } else {
          tooltipTimeout = setTimeout(() => {
            slotEl.classList.add("show-tooltip");
            setTimeout(() => slotEl.classList.remove("show-tooltip"), 3000);
          }, 300);
        }
        lastTouchTime = now;
      });

      equipmentGrid.appendChild(slotEl);
    });

    // Обновление переводов при смене языка
    const self = this;
    function refreshEquipmentTranslations() {
      // titles
      slots.forEach((slotInfo) => {
        const el = document.querySelector(`.${slotInfo.name}-slot`);
        if (!el) return;
        if (window.i18n && slotInfo.labelKey) {
          if (slotInfo.name.startsWith("implant")) {
            const n = slotInfo.name.replace(/[^0-9]/g, "") || "";
            el.title = window.i18n.t("slot_implant", { n });
          } else {
            el.title = window.i18n.t(slotInfo.labelKey);
          }
        }
      });

      // damage label
      const dmgEl = document.getElementById("damageDisplay");
      if (dmgEl) {
        self.updateDamageDisplay();
      }
    }

    window.addEventListener("languageChanged", function () {
      refreshEquipmentTranslations();
      // также обновим содержимое (title'ы у предметов)
      self.updateEquipmentDisplay();
    });
  },

  toggleEquipment: function () {
    this.isEquipmentOpen = !this.isEquipmentOpen;
    const isMobile = window.innerWidth <= 500;
    if (isMobile && this.isEquipmentOpen && window.isInventoryOpen) {
      window.inventorySystem.toggleInventory();
    }
    const container = document.getElementById("equipmentContainer");
    container.style.display = this.isEquipmentOpen ? "block" : "none";
    const btn = document.getElementById("equipmentBtn");
    btn.classList.toggle("active", this.isEquipmentOpen);
    if (this.isEquipmentOpen) this.updateEquipmentDisplay();
  },

  updateEquipmentDisplay: function () {
    // Обычные слоты
    Object.keys(this.equipmentSlots).forEach((slotName) => {
      if (slotName.startsWith("implant")) return; // импланты обрабатываем отдельно ниже

      const slotEl = document.querySelector(`.${slotName}-slot`);
      if (slotEl) {
        slotEl.innerHTML = "";
        let item = this.equipmentSlots[slotName];

        if (
          slotName === "offhand" &&
          !item &&
          this.equipmentSlots.weapon &&
          this.EQUIPMENT_CONFIG[this.equipmentSlots.weapon.type]?.hands ===
            "twohanded"
        ) {
          const ghost = this.equipmentSlots.weapon;
          if (ghost && this.EQUIPMENT_CONFIG[ghost.type]) {
            const img = this.EQUIPMENT_CONFIG[ghost.type].image.cloneNode();
            img.style.width = "100%";
            img.style.height = "100%";
            // локализация описания с суффиксом занятости двуручным
            let desc = this.EQUIPMENT_CONFIG[ghost.type].description || "";
            if (window.i18n) {
              const tKey = "itemdesc_" + ghost.type;
              const translated = window.i18n.t(tKey);
              if (translated !== tKey) desc = translated;
              desc += window.i18n.t("occupied_twohand_suffix");
            } else {
              desc += " (занято двуручным оружием)";
            }
            img.title = desc;
            slotEl.appendChild(img);
          }
          return;
        }

        if (item && this.EQUIPMENT_CONFIG[item.type]) {
          const img = this.EQUIPMENT_CONFIG[item.type].image.cloneNode();
          img.style.width = "100%";
          img.style.height = "100%";
          // локализуем описание, если есть перевод, иначе используем config.description
          let desc = this.EQUIPMENT_CONFIG[item.type].description || "";
          if (window.i18n) {
            const tKey = "itemdesc_" + item.type;
            const translated = window.i18n.t(tKey);
            if (translated !== tKey) desc = translated;
          }
          img.title = desc;
          slotEl.appendChild(img);
        }
      }
    });

    // === ОТРИСОВКА ИМПЛАНТОВ ===
    for (let i = 1; i <= 4; i++) {
      const slotName = `implant${i}`;
      const slotEl = document.querySelector(`.${slotName}-slot`);
      if (!slotEl) continue;

      slotEl.innerHTML = "";
      const item = this.equipmentSlots[slotName];

      if (item && window.implantsSystem?.IMPLANT_CONFIG[item.type]) {
        const cfg = window.implantsSystem.IMPLANT_CONFIG[item.type];

        const img = document.createElement("img");

        // Приоритет: сначала из implantsSystem, потом из глобального images
        if (cfg.image && cfg.image.src) {
          img.src = cfg.image.src;
        } else if (images.fireballImplant) {
          img.src = images.fireballImplant.src;
        } else {
          img.src = "fireballImplant.png";
        }

        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "contain";
        slotEl.appendChild(img);
      }
    }

    this.updateDamageDisplay();
  },

  pendingEquip: null,
  pendingUnequip: null,

  equipItem: function (slotIndex) {
    if (slotIndex === null || slotIndex === undefined) return;

    const item = inventory[slotIndex];
    if (!item) return;

    const isImplant =
      typeof item.type === "string" && item.type.endsWith("_implant");

    // ====================== ЛОГИКА ИМПЛАНТОВ ======================
    if (isImplant) {
      // Ищем первый свободный слот имплантов
      let targetSlot = null;
      for (let i = 1; i <= 4; i++) {
        if (!this.equipmentSlots[`implant${i}`]) {
          targetSlot = `implant${i}`;
          break;
        }
      }

      if (!targetSlot) {
        showNotification(
          window.i18n
            ? window.i18n.t("implants_full")
            : "Все слоты имплантов заняты! Снимите ненужный.",
          "#ffaa00",
        );
        return;
      }

      const oldItem = this.equipmentSlots[targetSlot];

      if (oldItem) {
        inventory[slotIndex] = { type: oldItem.type, itemId: oldItem.itemId };
      } else {
        inventory[slotIndex] = null;
      }

      this.equipmentSlots[targetSlot] = {
        type: item.type,
        itemId: item.itemId || Date.now().toString(),
      };

      this.updateEquipmentDisplay();
      updateInventoryDisplay();

      if (ws && ws.readyState === WebSocket.OPEN) {
        sendWhenReady(
          ws,
          JSON.stringify({
            type: "equipItem",
            slotIndex: slotIndex,
            slotName: targetSlot, // implant1, implant2 и т.д.
          }),
        );
      }

      showNotification(
        window.i18n
          ? window.i18n.t("implant_equipped", { slot: targetSlot })
          : `Имплант экипирован в слот ${targetSlot}`,
        "#00ffcc",
      );
      if (
        window.implantsSystem &&
        typeof window.implantsSystem.syncFromEquipment === "function"
      ) {
        window.implantsSystem.syncFromEquipment(this.equipmentSlots);
      }
      return;
    }

    // ====================== ОРИГИНАЛЬНАЯ ЛОГИКА ДЛЯ ОБЫЧНОЙ ЭКИПИРОВКИ ======================
    // (всё что было раньше — остаётся без изменений)

    const config = this.EQUIPMENT_CONFIG[item.type];
    if (!config || !config.type) return;

    // Проверка уровня
    const me = players.get(myId);
    if (me && !this.canEquipItem(item.type, me.level || 0)) {
      showNotification(
        window.i18n
          ? window.i18n.t("requires_level", { level: config.level })
          : `Требуется уровень ${config.level} для экипировки`,
        "#ff4444",
      );
      return;
    }

    let slotName = this.EQUIPMENT_TYPES[config.type] || null;

    if (config.type === "weapon") {
      if (config.hands === "twohanded") {
        if (this.equipmentSlots.offhand !== null) {
          showNotification(
            window.i18n
              ? window.i18n.t("remove_offhand_for_twohand")
              : "Снимите предмет со второй руки для двуручного оружия",
          );
          return;
        }
        slotName = "weapon";
      } else if (config.hands === "onehanded") {
        const currentWeapon = this.equipmentSlots.weapon;
        if (currentWeapon) {
          const currentConfig = this.EQUIPMENT_CONFIG[currentWeapon.type];
          if (currentConfig?.hands === "twohanded") {
            slotName = "weapon";
          } else {
            slotName =
              this.equipmentSlots.offhand === null ? "offhand" : "weapon";
          }
        } else {
          slotName = "weapon";
        }
      }
    } else {
      slotName = this.EQUIPMENT_TYPES[config.type];
    }

    if (!slotName) return;

    const oldItem = this.equipmentSlots[slotName];

    if (oldItem) {
      inventory[slotIndex] = { type: oldItem.type, itemId: oldItem.itemId };
    } else {
      inventory[slotIndex] = null;
    }

    this.pendingEquip = {
      slotIndex,
      item: { ...item },
      slotName,
      oldItem,
    };

    this.equipmentSlots[slotName] = { type: item.type, itemId: item.itemId };

    if (oldItem && this.EQUIPMENT_CONFIG[oldItem.type]?.hands === "twohanded") {
      this.equipmentSlots.offhand = null;
    }
    if (config.hands === "twohanded") {
      this.equipmentSlots.offhand = null;
    }

    inventory[slotIndex] = null;
    this.updateEquipmentDisplay();
    this.applyEquipmentEffects(me);

    if (ws && ws.readyState === WebSocket.OPEN) {
      sendWhenReady(
        ws,
        JSON.stringify({
          type: "equipItem",
          slotIndex,
          slotName,
        }),
      );
    }

    selectedSlot = null;
    document.getElementById("useBtn").disabled = true;
    document.getElementById("dropBtn").disabled = true;
    updateInventoryDisplay();
    updateStatsDisplay();
  },

  unequipItem: function (slotName) {
    if (!slotName) return;

    const me = players.get(myId);
    if (!me) return;

    // ====================== ЛОГИКА СНЯТИЯ ИМПЛАНТОВ ======================
    if (["implant1", "implant2", "implant3", "implant4"].includes(slotName)) {
      const item = this.equipmentSlots[slotName];
      if (!item) return;

      const freeSlot = inventory.findIndex((s) => s === null);
      if (freeSlot === -1) {
        showNotification(
          window.i18n
            ? window.i18n.t("inventory_full")
            : "Инвентарь полон! Освободите место.",
          "#ff4444",
        );
        return;
      }

      inventory[freeSlot] = { type: item.type, itemId: item.itemId };
      this.equipmentSlots[slotName] = null;

      this.updateEquipmentDisplay();
      updateInventoryDisplay();

      if (
        window.implantsSystem &&
        typeof window.implantsSystem.syncFromEquipment === "function"
      ) {
        window.implantsSystem.syncFromEquipment(this.equipmentSlots);
      }

      if (ws && ws.readyState === WebSocket.OPEN) {
        sendWhenReady(
          ws,
          JSON.stringify({
            type: "unequipItem",
            slotName: slotName,
            inventorySlot: freeSlot,
            itemId: item.itemId,
          }),
        );
      }
      return;
    }

    // ====================== ОРИГИНАЛЬНАЯ ЛОГИКА ДЛЯ ОБЫЧНЫХ СЛОТОВ ======================
    if (
      ![
        "weapon",
        "offhand",
        "head",
        "chest",
        "belt",
        "pants",
        "boots",
        "gloves",
      ].includes(slotName)
    )
      return;

    let realSlotToUnequip = slotName;

    if (slotName === "offhand" && this.equipmentSlots.offhand === null) {
      const mainWeapon = this.equipmentSlots.weapon;
      if (mainWeapon) {
        const config = this.EQUIPMENT_CONFIG[mainWeapon.type];
        if (config && config.hands === "twohanded") {
          realSlotToUnequip = "weapon";
        }
      }
    }

    const item = this.equipmentSlots[realSlotToUnequip];
    if (!item) return;

    const freeSlot = inventory.findIndex((s) => s === null);
    if (freeSlot === -1) {
      showNotification("Инвентарь полон! Освободите место для снятия.");
      return;
    }

    this.pendingUnequip = {
      slotName: realSlotToUnequip,
      visualSlot: slotName,
      item: { ...item },
      freeSlot,
    };

    this.equipmentSlots[realSlotToUnequip] = null;

    if (this.EQUIPMENT_CONFIG[item.type]?.hands === "twohanded") {
      this.equipmentSlots.offhand = null;
    }

    inventory[freeSlot] = { type: item.type, itemId: item.itemId };

    this.updateEquipmentDisplay();
    this.applyEquipmentEffects(me);

    if (ws && ws.readyState === WebSocket.OPEN) {
      sendWhenReady(
        ws,
        JSON.stringify({
          type: "unequipItem",
          slotName: realSlotToUnequip,
          inventorySlot: freeSlot,
          itemId: item.itemId,
        }),
      );
    }

    updateInventoryDisplay();
    updateStatsDisplay();
  },

  applyEquipmentEffects: function (player) {
    const baseStats = {
      health: 100 + (player.healthUpgrade || 0),
      energy: 100 + (player.energyUpgrade || 0),
      food: 100 + (player.foodUpgrade || 0),
      water: 100 + (player.waterUpgrade || 0),
      armor: 0,
    };

    const equippedItems = Object.values(this.equipmentSlots).filter(Boolean);
    const collectionSlots = [
      "head",
      "chest",
      "belt",
      "pants",
      "boots",
      "gloves",
    ];

    const collectionsInSlots = collectionSlots
      .map((slot) => this.equipmentSlots[slot])
      .filter((item) => item && this.EQUIPMENT_CONFIG[item.type]?.collection)
      .map((item) => this.EQUIPMENT_CONFIG[item.type].collection);

    const isFullCollection =
      collectionSlots.every(
        (slot) =>
          this.equipmentSlots[slot] &&
          this.EQUIPMENT_CONFIG[this.equipmentSlots[slot].type]?.collection,
      ) && new Set(collectionsInSlots).size === 1;

    const multiplier = isFullCollection ? 2 : 1;

    equippedItems.forEach((item) => {
      if (item && this.EQUIPMENT_CONFIG[item.type]) {
        const effect = this.EQUIPMENT_CONFIG[item.type].effect;
        if (effect.armor) baseStats.armor += effect.armor * multiplier;
        if (effect.health) baseStats.health += effect.health * multiplier;
        if (effect.energy) baseStats.energy += effect.energy * multiplier;
        if (effect.food) baseStats.food += effect.food * multiplier;
        if (effect.water) baseStats.water += effect.water * multiplier;
      }
    });

    player.maxStats = { ...baseStats };
    player.health = Math.min(player.health, player.maxStats.health);
    player.energy = Math.min(player.energy, player.maxStats.energy);
    player.food = Math.min(player.food, player.maxStats.food);
    player.water = Math.min(player.water, player.maxStats.water);
    player.armor = Math.min(player.armor, player.maxStats.armor);
  },

  syncEquipment: function (equipment) {
    const defaultEq = {
      head: null,
      chest: null,
      belt: null,
      pants: null,
      boots: null,
      weapon: null,
      offhand: null,
      gloves: null,
    };
    this.equipmentSlots = { ...defaultEq, ...equipment };
    const me = players.get(myId);
    if (me) {
      this.applyEquipmentEffects(me);
    }
    this.updateEquipmentDisplay();

    if (document.getElementById("equipmentGrid")) {
      this.updateEquipmentDisplay();
    } else {
      setTimeout(() => this.updateEquipmentDisplay(), 100);
    }
    updateStatsDisplay();
  },

  handleEquipFail: function (error) {
    if (!this.pendingEquip) return;

    const { slotIndex, item, slotName, oldItem, freeSlot } = this.pendingEquip;

    // Откатываем изменения
    inventory[slotIndex] = item;
    this.equipmentSlots[slotName] = oldItem;

    if (oldItem && freeSlot !== null) {
      inventory[freeSlot] = null;
    }

    const me = players.get(myId);
    if (me) {
      this.applyEquipmentEffects(me);
    }
    this.updateEquipmentDisplay();
    updateInventoryDisplay();
    updateStatsDisplay();

    // Вместо alert — уведомление
    showNotification(error);

    this.pendingEquip = null;
  },

  handleUnequipFail: function (error) {
    if (!this.pendingUnequip) return;

    const { slotName, item, freeSlot } = this.pendingUnequip;

    this.equipmentSlots[slotName] = item;
    inventory[freeSlot] = null;

    const me = players.get(myId);
    if (me) {
      this.applyEquipmentEffects(me);
    }
    this.updateEquipmentDisplay();
    updateInventoryDisplay();
    updateStatsDisplay();

    showNotification(error);

    this.pendingUnequip = null;
  },
};

window.equipmentSystem = equipmentSystem;
