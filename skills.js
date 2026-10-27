// skills.js

window.skillsSystem = {
  isSkillsOpen: false,
  isInitialized: false,
  selectedSkillIndex: null,
  playerSkills: [],
  skillPoints: 0,

  // Единый реестр навыков. Зарезервированные навыки пока не имеют эффектов.
  skillTemplates: [
    {
      id: 1,
      code: "strongStrike",
      name: "Сильный удар",
      maxLevel: 30,
      description: "Увеличивает урон в ближнем бою.",
    },
    {
      id: 2,
      code: "regeneration",
      name: "Регенерация",
      maxLevel: 30,
      description: "Пассивное восстановление здоровья вне боя.",
    },
    {
      id: 3,
      code: "endurance",
      name: "Выносливость",
      maxLevel: 30,
      description: "Снижает расход энергии при хотьбе.",
    },
    {
      id: 4,
      code: "ironstomach",
      name: "Железный желудок",
      maxLevel: 30,
      description: "Снижает расход воды и еды при хотьбе.",
    },
    {
      id: 5,
      code: "anomaly",
      name: "Стойкость к аномалиям",
      maxLevel: 30,
      description:
        "Увеличивает интервал между получением урона от аномальных зон.",
    },
    {
      id: 6,
      code: "criticalStrike",
      name: "Критический удар",
      maxLevel: 30,
      description: "Даёт шанс нанести критический урон в ближнем бою.",
    },
    {
      id: 7,
      code: "dodge",
      name: "Ловкий",
      maxLevel: 30,
      description: "Даёт шанс увернуться от атак в ближнем бою.",
    },
    {
      id: 8,
      code: "implantSync",
      name: "Имплантная Синхронизация",
      maxLevel: 30,
      description:
        "Снижает время перезарядки имплантов на 1 секунду за уровень.",
    },
    {
      id: 9,
      code: "implantRange",
      name: "Дальность имплантов",
      maxLevel: 30,
      description:
        "Увеличивает дальность применения имплантов на 10 пикселей за уровень.",
    },
    {
      id: 10,
      code: "speedBoost",
      name: "Быстрые Ноги",
      maxLevel: 30,
      description: "Увеличивает скорость движения на 1 пиксель за уровень.",
    },
    {
      id: 11,
      code: "recedingTarget",
      name: "Уходящая цель",
      maxLevel: 30,
      implemented: true,
      description:
        "Увеличивает дальность атаки огнестрельным оружием на 10 пикселей за уровень.",
    },

    ...Array.from({ length: 9 }, (_, index) => ({
      id: index + 12,
      code: null,
      name: `Навык ${index + 12}`,
      maxLevel: 30,
      implemented: false,
      description: "Навык зарезервирован для будущей игровой системы.",
    })),
  ],

  initialize() {
    if (this.isInitialized) return;

    this.createGrid();
    document.getElementById("skillsBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      this.toggleSkills();
    });
    this.isInitialized = true;
  },

  toggleSkills() {
    this.isSkillsOpen = !this.isSkillsOpen;

    const container = document.getElementById("skillsContainer");
    if (!container) return;

    container.style.display = this.isSkillsOpen ? "grid" : "none";

    // Закрываем другие окна на мобильных
    if (window.innerWidth <= 600) {
      if (this.isSkillsOpen) {
        if (window.isInventoryOpen) window.inventorySystem.toggleInventory();
        if (window.equipmentSystem?.isEquipmentOpen)
          window.equipmentSystem.toggleEquipment();
      }
    }

    if (this.isSkillsOpen) {
      this.updateSkillsDisplay();
    } else {
      this.selectedSkillIndex = null;
      document.getElementById("skillsDescription").innerHTML = "";
    }
  },

  createGrid() {
    const grid = document.getElementById("skillsGrid");
    if (!grid) return;

    grid.innerHTML = "";

    for (let i = 0; i < this.skillTemplates.length; i++) {
      const slot = document.createElement("div");
      slot.className = "skill-slot";
      slot.dataset.index = i;

      const template = this.skillTemplates[i];
      if (!template) continue;

      // Ищем навык игрока по ID из единого реестра
      const playerSkill = this.playerSkills.find((s) => s.id === template.id);

      if (template.code) {
        const img = document.createElement("img");
        img.src = `images/skills/${template.code}.png`;
        img.alt = template.name;
        slot.appendChild(img);
      } else {
        slot.classList.add("skill-slot-placeholder");
        slot.setAttribute("aria-label", template.name);
      }

      const badge = document.createElement("div");
      badge.className = "level-badge";

      // effective level = base + talisman bonus (cap 30)
      const baseLevel = playerSkill?.level || 0;
      let talismanBonus = 0;
      const me = typeof players !== "undefined" ? players.get(myId) : null;
      const inv = me?.inventory || window.inventory;
      if (Array.isArray(inv)) {
        for (const invSlot of inv) {
          if (!invSlot || !invSlot.type) continue;
          const cfg =
            typeof ITEM_CONFIG !== "undefined"
              ? ITEM_CONFIG[invSlot.type]
              : null;
          if (
            cfg?.skillBonus &&
            Number(cfg.skillBonus.skillId) === Number(template.id)
          ) {
            talismanBonus += Number(cfg.skillBonus.value) || 0;
          }
        }
      }
      const effectiveLevel = Math.min(30, baseLevel + talismanBonus);

      badge.textContent = `${effectiveLevel}/${template.maxLevel}`;
      if (talismanBonus > 0) {
        badge.style.color = "#00ff15"; // зелёный — есть бонус от талисмана
      }

      slot.appendChild(badge);

      // Если уровень 0 — можно слегка затемнить (опционально)
      if (!playerSkill || playerSkill.level === 0) {
        slot.style.opacity = "0.85"; // лёгкое затемнение для нулевых навыков
      }

      slot.addEventListener("click", () => this.selectSkill(i, slot));
      grid.appendChild(slot);
    }
  },

  selectSkill(index, slotElement) {
    const template = this.skillTemplates[index];
    if (!template) return;

    // Снимаем выделение со всех
    document
      .querySelectorAll(".skill-slot")
      .forEach((s) => s.classList.remove("active"));

    const playerSkill = this.playerSkills.find((s) => s.id === template.id);

    // Если кликнули на уже выбранный — снимаем выбор
    if (this.selectedSkillIndex === index) {
      this.selectedSkillIndex = null;
      document.getElementById("skillsDescription").innerHTML = "";
      return;
    }

    this.selectedSkillIndex = index;
    slotElement.classList.add("active");

    const desc = document.getElementById("skillsDescription");
    desc.innerHTML = `
      <h3>${template.name} (ур. ${playerSkill?.level || 0}/${template.maxLevel})</h3>
      <p>${template.description}</p>
      <p style="color:blue; font-weight:bold;">
        Доступно очков навыков: ${this.skillPoints}
      </p>
    `;
  },

  updateSkillsDisplay() {
    this.createGrid();

    if (this.selectedSkillIndex !== null) {
      const slot = document.querySelector(
        `.skill-slot[data-index="${this.selectedSkillIndex}"]`,
      );
      if (slot) slot.classList.add("active");
    }
  },

  // Вызывается из levelSystem после получения новых очков
  updateSkillPointsDisplay() {
    if (!this.isSkillsOpen) return;

    const desc = document.getElementById("skillsDescription");
    if (desc && this.selectedSkillIndex !== null) {
      const template = this.skillTemplates[this.selectedSkillIndex];
      const playerSkill = this.playerSkills.find((s) => s.id === template?.id);

      if (template) {
        desc.innerHTML = `
          <h3>${template.name} (ур. ${playerSkill?.level || 0}/${template.maxLevel})</h3>
          <p>${template.description}</p>
          <p style="margin-top:12px; color:#00ffcc; font-weight:bold;">
            Доступно очков навыков: ${this.skillPoints}
          </p>
        `;
      }
    }
  },

  updateDamageDisplayIfNeeded() {
    if (
      window.equipmentSystem &&
      typeof window.equipmentSystem.updateDamageDisplay === "function"
    ) {
      window.equipmentSystem.updateDamageDisplay();
    }
    if (
      window.strongStrikeSystem &&
      typeof window.strongStrikeSystem.getCurrentMeleeDamageRange === "function"
    ) {
      window.strongStrikeSystem.getCurrentMeleeDamageRange();
    }
  },
};

// Инициализация при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
  window.skillsSystem.initialize();
});
