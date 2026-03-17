// skills.js

window.skillsSystem = {
  isSkillsOpen: false,
  selectedSkillIndex: null,
  playerSkills: [],
  skillPoints: 0,

  // Список всех возможных навыков (фиксировано 10)
  skillTemplates: [
    {
      id: 1,
      code: "strongStrike",
      name: "Сильный удар",
      maxLevel: 27,
      description: "Увеличивает урон в ближнем бою",
    },
    {
      id: 2,
      code: "regeneration",
      name: "Регенерация",
      maxLevel: 27,
      description: "Пассивное восстановление здоровья вне боя",
    },
    {
      id: 3,
      code: "endurance",
      name: "Выносливость",
      maxLevel: 27,
      description: "Увеличивает максимальную энергию и снижает её расход",
    },
    {
      id: 4,
      code: "sharpshooter",
      name: "Меткий выстрел",
      maxLevel: 27,
      description: "Улучшает точность и урон дальнобойного оружия",
    },
    {
      id: 5,
      code: "stealth",
      name: "Скрытность",
      maxLevel: 27,
      description: "Снижает шанс быть замеченным врагами",
    },
    {
      id: 6,
      code: "technician",
      name: "Техник",
      maxLevel: 27,
      description: "Ускоряет ремонт и улучшает крафт",
    },
    {
      id: 7,
      code: "survival",
      name: "Выживание",
      maxLevel: 27,
      description: "Замедляет расход еды и воды",
    },
    {
      id: 8,
      code: "leadership",
      name: "Лидерство",
      maxLevel: 27,
      description: "Даёт бонусы союзникам поблизости",
    },
    {
      id: 9,
      code: "alchemy",
      name: "Алхимия",
      maxLevel: 27,
      description: "Увеличивает шанс получения редких ингредиентов",
    },
    {
      id: 10,
      code: "ironSkin",
      name: "Крепкая шкура",
      maxLevel: 27,
      description: "Снижает получаемый физический и энергетический урон",
    },
  ],

  initialize() {
    this.createGrid();
    document.getElementById("skillsBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      this.toggleSkills();
    });
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

    for (let i = 0; i < 10; i++) {
      const slot = document.createElement("div");
      slot.className = "skill-slot";
      slot.dataset.index = i;

      const template = this.skillTemplates[i];
      if (!template) continue;

      // Ищем навык игрока по id (1–10)
      const playerSkill = this.playerSkills.find((s) => s.id === template.id);

      // Всегда показываем нормальную иконку и название
      const img = document.createElement("img");
      img.src = `images/skills/${template.code}.png`;
      img.alt = template.name;
      slot.appendChild(img);

      const badge = document.createElement("div");
      badge.className = "level-badge";
      badge.textContent = `${playerSkill?.level || 0}/${template.maxLevel}`;
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
      <p style="margin-top:12px; color:#00ffcc; font-weight:bold;">
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
};

// Инициализация при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
  window.skillsSystem.initialize();
});
