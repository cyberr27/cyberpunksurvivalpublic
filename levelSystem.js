// levelSystem.js

let currentLevel = 0;
let currentXP = 0;
let xpToNextLevel = 100;
let isInitialized = false;
let upgradePoints = 0;

// НОВОЕ: Бонус к melee damage от уровня (начинается с 0)
let meleeDamageBonus = 0;

let maxStats = {
  health: 100,
  energy: 100,
  food: 100,
  water: 100,
  armor: 0, // Базовое значение брони зависит только от экипировки
};

function createLevelDisplayElement() {
  try {
    let levelDisplay = document.getElementById("levelDisplay");
    if (!levelDisplay) {
      levelDisplay = document.createElement("div");
      levelDisplay.id = "levelDisplay";
      levelDisplay.className = "cyber-text level-display";
      if (document.body) {
        document.body.appendChild(levelDisplay);
      } else {
        setTimeout(createLevelDisplayElement, 100);
      }
    }
    return levelDisplay;
  } catch (error) {
    return null;
  }
}

function updateStatsDisplay() {
  try {
    const statsEl = document.getElementById("stats");
    if (!statsEl) {
      return;
    }
    const me = players.get(myId);
    if (!me) {
      return;
    }
    statsEl.innerHTML = `
  <span class="health">Здоровье: ${Math.min(me.health, me.maxStats.health)}/${
    me.maxStats.health
  }</span><br>
  <span class="energy">Энергия: ${Math.min(me.energy, me.maxStats.energy)}/${
    me.maxStats.energy
  }</span><br>
  <span class="food">Еда: ${Math.min(me.food, me.maxStats.food)}/${
    me.maxStats.food
  }</span><br>
  <span class="water">Вода: ${Math.min(me.water, me.maxStats.water)}/${
    me.maxStats.water
  }</span><br>
  <span class="armor">Броня: ${Math.min(me.armor, me.maxStats.armor)}/${
    me.maxStats.armor
  }</span>
`;
    updateUpgradeButtons();
  } catch (error) {}
}

function createUpgradeButtons() {
  try {
    const statsEl = document.getElementById("stats");
    if (!statsEl) {
      setTimeout(createUpgradeButtons, 100);
      return;
    }

    const existingButtons = statsEl.querySelectorAll(".upgrade-btn");
    existingButtons.forEach((btn) => btn.remove());

    if (upgradePoints <= 0) {
      return;
    }

    const statTypes = ["health", "energy", "food", "water"]; // Броня исключена
    const statElements = statsEl.querySelectorAll("span");

    statElements.forEach((span, index) => {
      const statType = statTypes[index];
      if (!statType) return;

      const button = document.createElement("button");
      button.className = "upgrade-btn";
      button.textContent = "+";
      button.style.marginLeft = "10px";
      button.style.fontSize = "14px";
      button.style.padding = "4px 8px";
      button.style.cursor = "pointer";

      button.addEventListener("click", () => {
        if (upgradePoints <= 0) {
          console.warn("Нет доступных очков улучшения");
          return;
        }

        upgradePoints--;

        // Увеличиваем upgrade-поле в window.levelSystem
        const upgradeField = `${statType}Upgrade`;
        window.levelSystem[upgradeField] =
          (window.levelSystem[upgradeField] || 0) + 1;

        // БАЗОВОЕ ЗНАЧЕНИЕ — 100, БРОНИ — 0
        const baseValue = statType === "armor" ? 0 : 100;
        maxStats[statType] = baseValue + window.levelSystem[upgradeField];
        window.levelSystem.maxStats[statType] = maxStats[statType];

        const me = players.get(myId);
        if (me) {
          me.maxStats[statType] = maxStats[statType];
          me[statType] = Math.min(
            me[statType] || baseValue,
            maxStats[statType],
          );
          me[upgradeField] = window.levelSystem[upgradeField]; // сохраняем в игроке
        }

        // НОВОЕ: Переприменяем эффекты экипировки к новому base + upgrades
        window.equipmentSystem.applyEquipmentEffects(me);

        updateStatsDisplay();

        if (ws.readyState === WebSocket.OPEN) {
          sendWhenReady(
            ws,
            JSON.stringify({
              type: "updateMaxStats",
              upgradePoints,
              healthUpgrade: window.levelSystem.healthUpgrade || 0,
              energyUpgrade: window.levelSystem.energyUpgrade || 0,
              foodUpgrade: window.levelSystem.foodUpgrade || 0,
              waterUpgrade: window.levelSystem.waterUpgrade || 0,
            }),
          );
        }
      });

      span.appendChild(button);
    });
  } catch (error) {}
}

function updateUpgradeButtons() {
  try {
    const statsEl = document.getElementById("stats");
    if (!statsEl) {
      setTimeout(updateUpgradeButtons, 100);
      return;
    }

    // Удаляем старые кнопки
    const buttons = statsEl.querySelectorAll(".upgrade-btn");
    buttons.forEach((btn) => btn.remove());

    // Создаём новые кнопки, если есть очки
    if (upgradePoints > 0) {
      createUpgradeButtons();
    } else {
    }
  } catch (error) {}
}

function initializeLevelSystem() {
  try {
    if (isInitialized) {
      return;
    }
    createLevelDisplayElement();
    isInitialized = true;
    updateLevelDisplay();
    updateStatsDisplay();
    updateUpgradeButtons();
  } catch (error) {}
}

function updateLevelDisplay() {
  try {
    let levelDisplay = document.getElementById("levelDisplay");
    if (!levelDisplay) {
      levelDisplay = createLevelDisplayElement();
    }
    if (levelDisplay) {
      levelDisplay.innerHTML = `Level: ${currentLevel} | xp : ${currentXP} / ${xpToNextLevel}`;
    } else {
      setTimeout(updateLevelDisplay, 100);
    }
  } catch (error) {}
}

function setLevelData(level, xp, maxStatsData, upgradePointsData) {
  try {
    currentLevel = level || 0;
    currentXP = xp || 0;
    upgradePoints = upgradePointsData || 0;
    xpToNextLevel = calculateXPToNextLevel(currentLevel);

    const me = players.get(myId);
    if (!me) {
      console.warn("Игрок не найден при setLevelData");
      return;
    }

    // ВОССТАНАВЛИВАЕМ UPGRADE ПОЛЯ ИЗ me
    window.levelSystem.healthUpgrade = me.healthUpgrade || 0;
    window.levelSystem.energyUpgrade = me.energyUpgrade || 0;
    window.levelSystem.foodUpgrade = me.foodUpgrade || 0;
    window.levelSystem.waterUpgrade = me.waterUpgrade || 0;

    // НОВОЕ: Устанавливаем бонус melee damage от текущего уровня (level = bonus)
    window.levelSystem.meleeDamageBonus = currentLevel;

    // ВЫЧИСЛЯЕМ maxStats ИЗ UPGRADE (base 100 + upgrades, armor 0; equip добавится позже в applyEquipmentEffects)
    maxStats = {
      health: 100 + window.levelSystem.healthUpgrade,
      energy: 100 + window.levelSystem.energyUpgrade,
      food: 100 + window.levelSystem.foodUpgrade,
      water: 100 + window.levelSystem.waterUpgrade,
      armor: 0, // Броня только от equip
    };

    window.levelSystem.maxStats = { ...maxStats };

    if (window.equipmentSystem && me) {
      window.equipmentSystem.applyEquipmentEffects(me);
    }

    if (!isInitialized) {
      initializeLevelSystem();
    }
    updateLevelDisplay();
    updateStatsDisplay();
    updateUpgradeButtons();
  } catch (error) {}
}

function calculateXPToNextLevel(level) {
  try {
    if (level >= 100) return 0;
    return 100 * Math.pow(2, level);
  } catch (error) {
    return 100;
  }
}

function handleItemPickup(itemType, isDroppedByPlayer) {
  try {
    const me = players.get(myId);
    if (!me) {
      return;
    }

    if (isDroppedByPlayer) {
      return;
    }

    const rarity = ITEM_CONFIG[itemType]?.rarity || 3;
    let xpGained;
    switch (rarity) {
      case 1:
        xpGained = 3;
        break;
      case 2:
        xpGained = 2;
        break;
      case 3:
        xpGained = 1;
        break;
      default:
        xpGained = 1;
    }

    currentXP += xpGained;
    checkLevelUp();

    if (ws.readyState === WebSocket.OPEN) {
      sendWhenReady(
        ws,
        JSON.stringify({
          type: "updateLevel",
          level: currentLevel,
          xp: currentXP,
          upgradePoints,
        }),
      );
    } else {
    }

    showXPEffect(xpGained);
  } catch (error) {}
}

function handleQuestCompletion(rarity) {
  try {
    const me = players.get(myId);
    if (!me) {
      return;
    }

    let xpGained;
    switch (rarity) {
      case 1:
        xpGained = 3;
        break;
      case 2:
        xpGained = 2;
        break;
      case 3:
        xpGained = 1;
        break;
      default:
        xpGained = 1;
    }

    currentXP += xpGained;
    checkLevelUp();

    if (ws.readyState === WebSocket.OPEN) {
      sendWhenReady(
        ws,
        JSON.stringify({
          type: "updateLevel",
          level: currentLevel,
          xp: currentXP,
          upgradePoints,
        }),
      );
    } else {
    }

    showXPEffect(xpGained);
  } catch (error) {}
}

function handleEnemyKill(data) {
  try {
    // Полная синхронизация с сервера
    currentLevel = data.level;
    currentXP = data.xp;
    xpToNextLevel = data.xpToNextLevel;
    upgradePoints = data.upgradePoints;

    // НОВОЕ: Синхронизируем бонус melee damage от уровня
    window.levelSystem.meleeDamageBonus = currentLevel;

    const me = players.get(myId);
    if (me) {
      me.level = currentLevel;
      me.xp = currentXP;
      me.upgradePoints = upgradePoints;
    }

    showXPEffect(data.xpGained);
    updateLevelDisplay();
    updateStatsDisplay();
    updateUpgradeButtons();
  } catch (error) {
    console.error("Ошибка в handleEnemyKill:", error);
  }
}

function checkLevelUp() {
  try {
    while (currentXP >= xpToNextLevel && currentLevel < 100) {
      currentLevel++;
      currentXP -= xpToNextLevel;
      xpToNextLevel = calculateXPToNextLevel(currentLevel);
      upgradePoints += 10;

      // НОВОЕ: +3 очка навыков при каждом уровне
      const skillPointsEarned = 3;
      window.skillsSystem.skillPoints =
        (window.skillsSystem.skillPoints || 0) + skillPointsEarned;

      // НОВОЕ: Увеличиваем бонус melee damage на +1 при level up
      window.levelSystem.meleeDamageBonus += 1;

      showLevelUpEffect();
      updateUpgradeButtons();

      // Обновляем отображение очков навыков, если окно навыков открыто
      if (window.skillsSystem?.updateSkillPointsDisplay) {
        window.skillsSystem.updateSkillPointsDisplay();
      }

      if (ws.readyState === WebSocket.OPEN) {
        sendWhenReady(
          ws,
          JSON.stringify({
            type: "updateLevel",
            level: currentLevel,
            xp: currentXP,
            upgradePoints,
            skillPoints: window.skillsSystem.skillPoints,
          }),
        );
      }

      // Показываем уведомление о полученных очках навыков
      showNotification(`+${skillPointsEarned} очков навыков!`, "#ffaa00");
    }

    updateLevelDisplay();
    updateStatsDisplay();
  } catch (error) {
    console.error("Ошибка в checkLevelUp:", error);
  }
}

function showXPEffect(xpGained) {
  try {
    const effect = document.createElement("div");
    effect.className = "xp-effect cyber-text";
    effect.textContent = `+${xpGained} XP`;
    effect.style.position = "absolute";
    effect.style.left = "50px";
    effect.style.bottom = "100px";
    document.body.appendChild(effect);

    setTimeout(() => {
      effect.style.transition = "all 1s ease-out";
      effect.style.transform = "translateY(-50px)";
      effect.style.opacity = "0";
    }, 10);

    setTimeout(() => effect.remove(), 1000);
  } catch (error) {}
}

function showLevelUpEffect() {
  try {
    const effect = document.createElement("div");
    effect.className = "level-up-effect cyber-text";
    effect.textContent = `LEVEL UP! ${currentLevel}`;
    effect.style.position = "absolute";
    effect.style.left = "50%";
    effect.style.top = "50%";
    effect.style.transform = "translate(-50%, -50%)";
    effect.style.fontSize = "48px";
    effect.style.textShadow = "0 0 10px #00ffff, 0 0 20px #00ffff";
    document.body.appendChild(effect);

    setTimeout(() => {
      effect.style.transition = "all 1s ease-out";
      effect.style.opacity = "0";
      effect.style.transform = "translate(-50%, -70%) scale(1.2)";
    }, 10);

    setTimeout(() => effect.remove(), 1000);
  } catch (error) {}
}

window.levelSystem = {
  initialize: initializeLevelSystem,
  setLevelData,
  handleItemPickup,
  handleQuestCompletion,
  maxStats,
  updateUpgradeButtons,
  handleEnemyKill,
  // НОВОЕ: Экспортируем бонус для доступа из других систем
  meleeDamageBonus,
};
