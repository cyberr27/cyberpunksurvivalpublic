// equipmentSystem.js - ИЗМЕНЁННЫЙ ПОЛНОСТЬЮ
// equipmentSystem.js

const equipmentSystem = {
  isEquipmentOpen: false,
  isInitialized: false,
  equipmentSlots: {
    head: null,
    chest: null,
    belt: null,
    pants: null,
    boots: null,
    weapon: null,
    offhand: null,
    gloves: null,
  },

  EQUIPMENT_TYPES: {
    headgear: "head",
    armor: "chest",
    belt: "belt",
    pants: "pants",
    boots: "boots",
    weapon: "weapon",
    gloves: "gloves",
  },

  BASE_MELEE_MIN: 5,
  BASE_MELEE_MAX: 10,

  getCurrentMeleeDamage: function () {
    const levelBonus = window.levelSystem.meleeDamageBonus || 0;

    // НОВЫЙ БОНУС: от уровня навыка "Сильный удар" (id: 1)
    const me = players.get(myId);
    let skillBonus = 0;
    if (me && me.skills) {
      const strongStrike = me.skills.find((s) => s.id === 1);
      skillBonus = strongStrike ? strongStrike.level : 0;
    }

    // Итоговый бонус = бонус от уровня + бонус от навыка
    const totalBonus = levelBonus + skillBonus;

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
    const dmg = this.getCurrentMeleeDamage();
    const currentStr = `${dmg.min}-${dmg.max}`;
    const displayEl = document.getElementById("damageDisplay");
    if (displayEl) {
      displayEl.textContent = `Урон: ${currentStr}`;
      displayEl.style.color =
        this.equipmentSlots.weapon !== null ||
        this.equipmentSlots.offhand !== null
          ? "lime"
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
    },
    nano_armor: {
      type: "armor",
      effect: { armor: 20, health: 10 },
      description: "Нано-броня: +20 брони, +10 здоровья",
      rarity: 4,
      image: new Image(),
      level: 5,
    },
    tactical_belt: {
      type: "belt",
      effect: { armor: 5, food: 5 },
      description: "Тактический пояс: +5 брони, +5 еды",
      rarity: 4,
      image: new Image(),
      level: 5,
    },
    cyber_pants: {
      type: "pants",
      effect: { armor: 10, water: 5 },
      description: "Киберштаны: +10 брони, +5 воды",
      rarity: 4,
      image: new Image(),
      level: 5,
    },
    speed_boots: {
      type: "boots",
      effect: { armor: 5, energy: 10 },
      description: "Скоростные ботинки: +5 брони, +10 энергии",
      rarity: 4,
      image: new Image(),
      level: 5,
    },
    tech_gloves: {
      type: "gloves",
      effect: { armor: 5, energy: 5 },
      description: "Технические перчатки: +5 брони, +5 энергии",
      rarity: 4,
      image: new Image(),
      level: 5,
    },
    plasma_rifle: {
      type: "weapon",
      effect: { damage: 50, range: 200 },
      description: "Плазменная винтовка: +15 урона, дальнобойная",
      rarity: 4,
      image: new Image(),
      hands: "twohanded",
      level: 0,
    },
    knuckles: {
      type: "weapon",
      effect: { damage: { min: 3, max: 7 } },
      description: "Кастет: 3-7 урона в ближнем бою",
      rarity: 4,
      image: new Image(),
      hands: "onehanded",
      level: 2,
    },
    knife: {
      type: "weapon",
      effect: { damage: { min: 4, max: 6 } },
      description: "Нож: 4-6 урона в ближнем бою",
      rarity: 4,
      image: new Image(),
      hands: "onehanded",
      level: 3,
    },
    nano_absorbing_knife: {
      type: "weapon",
      effect: { damage: { min: 6, max: 9 } },
      description: "Нож: 6-9 урона в ближнем бою",
      rarity: 4,
      image: new Image(),
      hands: "onehanded",
      level: 3,
    },
    bat: {
      type: "weapon",
      effect: { damage: { min: 5, max: 10 } },
      description: "Бита: 5-10 урона в ближнем бою",
      rarity: 4,
      image: new Image(),
      hands: "onehanded",
      level: 4,
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
    },

    torn_cap_of_thirst: {
      type: "headgear",
      effect: { armor: 5, water: 5 },
      description: "Порванная кепка жажды: +5 к максимальной воде, +5 к броне",
      rarity: 4,
      collection: "Torn Thirst",
      image: new Image(),
      level: 0,
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
    },
    torn_belt_of_thirst: {
      type: "belt",
      effect: { armor: 3, water: 7 },
      description: "Порванный пояс жажды: +7 к максимальной воде, +3 к броне",
      rarity: 4,
      collection: "Torn Thirst",
      image: new Image(),
      level: 0,
    },
    torn_pants_of_thirst: {
      type: "pants",
      effect: { armor: 7, water: 6 },
      description: "Порванные штаны жажды: +6 к максимальной воде, +7 к броне",
      rarity: 4,
      collection: "Torn Thirst",
      image: new Image(),
      level: 0,
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
    },

    white_void_cap: {
      type: "headgear",
      effect: {},
      description: "Белая кепка Пустоты — чистый лист для будущих улучшений",
      rarity: 4,
      collection: "White Void",
      image: new Image(),
      level: 0,
    },
    white_void_t_shirt: {
      type: "armor",
      effect: {},
      description: "Белая футболка Пустоты — чистый лист для будущих улучшений",
      rarity: 4,
      collection: "White Void",
      image: new Image(),
      level: 0,
    },
    white_void_gloves: {
      type: "gloves",
      effect: {},
      description: "Белые перчатки Пустоты — чистый лист для будущих улучшений",
      rarity: 4,
      collection: "White Void",
      image: new Image(),
      level: 0,
    },
    white_void_belt: {
      type: "belt",
      effect: {},
      description: "Белый пояс Пустоты — чистый лист для будущих улучшений",
      rarity: 4,
      collection: "White Void",
      image: new Image(),
      level: 0,
    },
    white_void_pants: {
      type: "pants",
      effect: {},
      description: "Белые штаны Пустоты — чистый лист для будущих улучшений",
      rarity: 4,
      collection: "White Void",
      image: new Image(),
      level: 0,
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
    },
  },

  canEquipItem: function (itemType, playerLevel) {
    const config = this.EQUIPMENT_CONFIG[itemType];
    if (!config || config.level === undefined) return true; // если нет level — можно
    return playerLevel >= config.level;
  },

  initialize: function () {
    if (this.isInitialized) return;

    // === ВОССТАНОВЛЕНА СТАРАЯ ЗАГРУЗКА ИЗОБРАЖЕНИЙ ===
    Object.keys(this.EQUIPMENT_CONFIG).forEach((key) => {
      this.EQUIPMENT_CONFIG[key].image.src = `${key}.png`;
    });

    // === СОЗДАНИЕ КНОПКИ ЭКИПИРОВКИ (как было у тебя) ===
    const equipmentBtn = document.createElement("img");
    equipmentBtn.id = "equipmentBtn";
    equipmentBtn.className = "cyber-btn-img";
    equipmentBtn.src = "images/equipment.png";
    equipmentBtn.alt = "Equipment";
    equipmentBtn.style.position = "absolute";
    equipmentBtn.style.right = "10px";
    document.getElementById("gameContainer").appendChild(equipmentBtn);

    // === СОЗДАНИЕ КОНТЕЙНЕРА И ГРИДА ===
    const equipmentContainer = document.createElement("div");
    equipmentContainer.id = "equipmentContainer";
    equipmentContainer.style.display = "none";
    equipmentContainer.innerHTML = `
      <div id="equipmentGrid"></div>
      <div id="damageDisplay">Урон: 5-10</div>
    `;
    document.getElementById("gameContainer").appendChild(equipmentContainer);

    this.setupEquipmentGrid();

    // Обработчик кнопки
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
      { name: "head", label: "Головной убор" },
      { name: "chest", label: "Броня" },
      { name: "belt", label: "Пояс" },
      { name: "pants", label: "Штаны" },
      { name: "boots", label: "Обувь" },
      { name: "weapon", label: "Оружие (основная рука)" },
      { name: "offhand", label: "Оружие (вторая рука)" },
      { name: "gloves", label: "Перчатки" },
    ];
    slots.forEach((slotInfo) => {
      const slotEl = document.createElement("div");
      slotEl.className = `equipment-slot ${slotInfo.name}-slot`;
      slotEl.style.gridArea = slotInfo.name;
      slotEl.title = slotInfo.label;
      // Двойной клик / двойной тап для снятия
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
    Object.keys(this.equipmentSlots).forEach((slotName) => {
      const slotEl = document.querySelector(`.${slotName}-slot`);
      if (slotEl) {
        slotEl.innerHTML = "";
        let item = this.equipmentSlots[slotName];
        if (item && this.EQUIPMENT_CONFIG[item.type]) {
          const img = this.EQUIPMENT_CONFIG[item.type].image.cloneNode();
          img.style.width = "100%";
          img.style.height = "100%";
          img.title = this.EQUIPMENT_CONFIG[item.type].description;
          slotEl.appendChild(img);
        }
        if (
          slotName === "offhand" &&
          this.equipmentSlots.weapon &&
          this.equipmentSlots.offhand === null
        ) {
          const mainWeapon = this.equipmentSlots.weapon;
          const config = this.EQUIPMENT_CONFIG[mainWeapon.type];
          if (config && config.hands === "twohanded") {
            const img = config.image.cloneNode();
            img.style.width = "100%";
            img.style.height = "100%";
            img.title = config.description + " (занимает обе руки)";
            slotEl.innerHTML = ""; // очищаем
            slotEl.appendChild(img);
            return;
          }
        }
      }
    });
    this.updateDamageDisplay();
  },

  pendingEquip: null,
  pendingUnequip: null,

  equipItem: function (slotIndex) {
    if (slotIndex === null || slotIndex === undefined) return;

    const item = inventory[slotIndex];
    if (!item || !this.EQUIPMENT_CONFIG[item.type]) return;

    const config = this.EQUIPMENT_CONFIG[item.type];
    if (!config.type) return;

    // === ПРОВЕРКА УРОВНЯ НА КЛИЕНТЕ ===
    const me = players.get(myId);
    if (me && !this.canEquipItem(item.type, me.level || 0)) {
      showNotification(
        `Требуется уровень ${config.level} для экипировки ${
          config.description || item.type
        }`,
      );
      return;
    }

    let slotName = this.EQUIPMENT_TYPES[config.type] || null;

    // Специальная логика для оружия
    if (config.type === "weapon") {
      if (config.hands === "twohanded") {
        // Двуручное — только в weapon, и offhand должен быть свободен
        if (this.equipmentSlots.offhand !== null) {
          showNotification(
            "Снимите предмет со второй руки для двуручного оружия",
          );
          return;
        }
        slotName = "weapon";
      } else if (config.hands === "onehanded") {
        const currentWeapon = this.equipmentSlots.weapon;

        // Самое важное изменение ↓
        if (currentWeapon) {
          const currentConfig = this.EQUIPMENT_CONFIG[currentWeapon.type];
          if (currentConfig?.hands === "twohanded") {
            // Если сейчас двуручное → заменяем именно в weapon
            slotName = "weapon";
          } else {
            // Обычная логика для одноручных
            if (this.equipmentSlots.offhand === null) {
              slotName = "offhand"; // свободна вторая рука → ставим туда
            } else {
              slotName = "weapon"; // вторая занята → заменяем основное
            }
          }
        } else {
          // Нет оружия вообще → в основную руку
          slotName = "weapon";
        }
      }
    } else {
      slotName = this.EQUIPMENT_TYPES[config.type];
    }

    if (!slotName) return;

    const oldItem = this.equipmentSlots[slotName];

    if (oldItem) {
      inventory[slotIndex] = {
        type: oldItem.type,
        itemId: oldItem.itemId,
      };
    } else {
      inventory[slotIndex] = null;
    }

    this.pendingEquip = {
      slotIndex,
      item: { ...item },
      slotName,
      oldItem,
    };

    // Локально экипируем (оптимистично)
    this.equipmentSlots[slotName] = { type: item.type, itemId: item.itemId };

    if (oldItem) {
      const oldConfig = this.EQUIPMENT_CONFIG[oldItem.type];
      if (oldConfig?.hands === "twohanded") {
        this.equipmentSlots.offhand = null;
      }
    }

    if (config.hands === "twohanded") {
      this.equipmentSlots.offhand = null;
    }
    inventory[slotIndex] = null;
    this.updateEquipmentDisplay();
    this.applyEquipmentEffects(me);

    if (ws.readyState === WebSocket.OPEN) {
      sendWhenReady(
        ws,
        JSON.stringify({
          type: "equipItem",
          slotIndex,
          slotName,
          equipment: this.equipmentSlots,
          maxStats: { ...me.maxStats },
          stats: {
            health: me.health,
            energy: me.energy,
            food: me.food,
            water: me.water,
            armor: me.armor,
          },
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

    const me = players.get(myId);
    if (!me) return;

    // ── Определяем, какой слот реально содержит оружие ────────
    let realSlotToUnequip = slotName;

    // Если нажали на offhand, а там визуально двуручное оружие (т.е. null, но weapon — двуручное)
    if (slotName === "offhand" && this.equipmentSlots.offhand === null) {
      const mainWeapon = this.equipmentSlots.weapon;
      if (mainWeapon) {
        const config = this.EQUIPMENT_CONFIG[mainWeapon.type];
        if (config && config.hands === "twohanded") {
          realSlotToUnequip = "weapon"; // будем снимать из weapon!
        }
      }
    }

    const item = this.equipmentSlots[realSlotToUnequip];
    if (!item) return; // ничего нет → выходим

    const freeSlot = inventory.findIndex((s) => s === null);
    if (freeSlot === -1) {
      showNotification("Инвентарь полон! Освободите место для снятия.");
      return;
    }

    this.pendingUnequip = {
      slotName: realSlotToUnequip, // !!! важно — настоящий слот
      visualSlot: slotName, // для удобства отката, если нужно
      item: { ...item },
      freeSlot,
    };

    // Локально снимаем
    this.equipmentSlots[realSlotToUnequip] = null;

    // Если снимали двуручное — визуально очищаем и offhand
    if (this.EQUIPMENT_CONFIG[item.type]?.hands === "twohanded") {
      this.equipmentSlots.offhand = null;
    }

    inventory[freeSlot] = { type: item.type, itemId: item.itemId };

    this.updateEquipmentDisplay();
    this.applyEquipmentEffects(me);

    if (ws.readyState === WebSocket.OPEN) {
      sendWhenReady(
        ws,
        JSON.stringify({
          type: "unequipItem",
          slotName: realSlotToUnequip, // !!! отправляем настоящий слот
          inventorySlot: freeSlot,
          itemId: item.itemId,
          // equipment отправляем уже обновлённое
          equipment: { ...this.equipmentSlots },
          maxStats: { ...me.maxStats },
          stats: {
            health: me.health,
            energy: me.energy,
            food: me.food,
            water: me.water,
            armor: me.armor,
          },
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
