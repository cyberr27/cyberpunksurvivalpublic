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

function createUpgradeButtons() {
  try {
    const statsEl = document.getElementById("stats");
    if (!statsEl) {
      setTimeout(createUpgradeButtons, 100);
      return;
    }

    // Удаляем старые кнопки
    const existingButtons = statsEl.querySelectorAll(".upgrade-btn");
    existingButtons.forEach((btn) => btn.remove());

    // Если нет очков — ничего не рисуем
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
        // Проверяем наличие очков на момент клика (для UX)
        if (upgradePoints <= 0) {
          console.warn("Нет доступных очков улучшения");
          return;
        }

        // Отправляем на сервер намерение потратить 1 очко именно в эту характеристику
        if (ws && ws.readyState === WebSocket.OPEN) {
          const payload = {
            type: "updateMaxStats",
          };

          // Только одно поле будет равно 1
          if (statType === "health") payload.deltaHealth = 1;
          if (statType === "energy") payload.deltaEnergy = 1;
          if (statType === "food") payload.deltaFood = 1;
          if (statType === "water") payload.deltaWater = 1;

          sendWhenReady(ws, JSON.stringify(payload));
        }

        // Оптимистично отключаем кнопку сразу (чтобы не было двойных кликов)
        // Но настоящая синхронизация произойдёт только после ответа сервера
        button.disabled = true;
        button.style.opacity = "0.5";
      });

      span.appendChild(button);
    });
  } catch (error) {
    console.error("Ошибка в createUpgradeButtons:", error);
  }
}

function updateUpgradeButtons() {
  try {
    const statsEl = document.getElementById("stats");
    if (!statsEl) {
      setTimeout(updateUpgradeButtons, 100);
      return;
    }

    // Всегда удаляем старые кнопки в любом случае
    const buttons = statsEl.querySelectorAll(".upgrade-btn");
    buttons.forEach((btn) => btn.remove());

    // Берём актуальное количество очков ИЗ ОБЪЕКТА ИГРОКА, а не из глобальной переменной
    const me = players.get(myId);
    const currentUpgradePoints = me?.upgradePoints ?? 0;

    // Если очков больше 0 — создаём кнопки
    if (currentUpgradePoints > 0) {
      createUpgradeButtons();
    }

    // Опционально: синхронизируем глобальную переменную (для совместимости со старым кодом)
    upgradePoints = currentUpgradePoints;
  } catch (error) {
    console.error("Ошибка в updateUpgradeButtons:", error);
  }
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

function setLevelData(
  level,
  xp,
  maxStatsData,
  upgradePointsData,
  skillPointsData,
) {
  try {
    currentLevel = level || 0;
    currentXP = xp || 0;
    upgradePoints = upgradePointsData || 0;
    xpToNextLevel = calculateXPToNextLevel(currentLevel);

    // НОВОЕ: принимаем и устанавливаем skillPoints, если пришло
    if (skillPointsData !== undefined && !isNaN(Number(skillPointsData))) {
      window.skillsSystem.skillPoints = Math.max(0, Number(skillPointsData));
    }

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

    // ВЫЧИСЛЯЕМ maxStats ИЗ UPGRADE (base 100 + upgrades, armor 0; equip добавится позже)
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
  } catch (error) {
    console.error("Ошибка в setLevelData:", error);
  }
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
    if (!me) return;

    if (isDroppedByPlayer) return;

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

    // Только визуал — сервер сам добавит XP
    showXPEffect(xpGained);

    // Сообщаем серверу, что подобрали предмет → он добавит XP
    if (ws.readyState === WebSocket.OPEN) {
      sendWhenReady(
        ws,
        JSON.stringify({
          type: "addXP",
          amount: xpGained,
          source: "item_" + itemType,
        }),
      );
    }
  } catch (error) {}
}

function handleQuestCompletion(rarity) {
  try {
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

    showXPEffect(xpGained);

    if (ws.readyState === WebSocket.OPEN) {
      sendWhenReady(
        ws,
        JSON.stringify({
          type: "addXP",
          amount: xpGained,
          source: "quest",
        }),
      );
    }
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
  updateLevelDisplay();
  updateStatsDisplay();
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
  meleeDamageBonus,
  updateLevelDisplay,
  showXPEffect,
  showLevelUpEffect,
  checkLevelUp,
};
