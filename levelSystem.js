// levelSystem.js

let currentLevel = 0;
let currentXP = 0;
let xpToNextLevel = 100;
let isInitialized = false;
let upgradePoints = 0;
let isUpgradeRequestPending = false;
let meleeDamageBonus = 0;

let maxStats = {
  health: 100,
  energy: 100,
  food: 100,
  water: 100,
  armor: 0,
};

function createLevelDisplayElement() {
  try {
    let levelDisplay = document.getElementById("levelDisplay");
    if (!levelDisplay) {
      levelDisplay = document.createElement("div");
      levelDisplay.id = "levelDisplay";
      levelDisplay.className = "cyber-text level-display";
      if (document.body) document.body.appendChild(levelDisplay);
      else setTimeout(createLevelDisplayElement, 100);
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

    if (upgradePoints <= 0) {
      statsEl.querySelectorAll(".upgrade-btn").forEach((btn) => btn.remove());
      return;
    }

    // === НОВОЕ: создаём 4 кнопки с индивидуальными классами ===
    const statTypes = ["health", "energy", "food", "water"];

    statTypes.forEach((statType) => {
      const existingButton = statsEl.querySelector(`.upgrade-btn-${statType}`);
      if (existingButton) return;

      const button = document.createElement("button");
      button.className = `upgrade-btn upgrade-btn-${statType}`;
      button.textContent = "+";
      button.dataset.stat = statType;

      button.style.cursor = "pointer";
      button.style.fontSize = "14px";
      button.style.padding = "4px 8px";

      button.addEventListener("click", () => {
        if (upgradePoints <= 0 || isUpgradeRequestPending) return;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        const payload = { type: "updateMaxStats" };
        if (statType === "health") payload.deltaHealth = 1;
        if (statType === "energy") payload.deltaEnergy = 1;
        if (statType === "food") payload.deltaFood = 1;
        if (statType === "water") payload.deltaWater = 1;

        isUpgradeRequestPending = true;
        updateUpgradeButtons();
        try {
          sendWhenReady(ws, JSON.stringify(payload));
        } catch (error) {
          isUpgradeRequestPending = false;
          updateUpgradeButtons();
          console.error("Не удалось отправить запрос улучшения:", error);
        }
      });

      statsEl.appendChild(button);
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

    const me = players.get(myId);
    const currentUpgradePoints = me?.upgradePoints ?? 0;
    upgradePoints = currentUpgradePoints;

    if (currentUpgradePoints > 0) createUpgradeButtons();
    else
      statsEl.querySelectorAll(".upgrade-btn").forEach((btn) => btn.remove());

    statsEl.querySelectorAll(".upgrade-btn").forEach((btn) => {
      btn.disabled = isUpgradeRequestPending;
      btn.style.opacity = isUpgradeRequestPending ? "0.5" : "1";
    });
  } catch (error) {}
}

function completeUpgradeRequest() {
  isUpgradeRequestPending = false;
  updateUpgradeButtons();
}

function initializeLevelSystem() {
  if (isInitialized) return;
  createLevelDisplayElement();
  isInitialized = true;
  updateLevelDisplay();
  updateStatsDisplay();
  updateUpgradeButtons();
}

function updateLevelDisplay() {
  try {
    let levelDisplay = document.getElementById("levelDisplay");
    if (!levelDisplay) levelDisplay = createLevelDisplayElement();
    if (levelDisplay) {
      levelDisplay.innerHTML = `Level: ${currentLevel} | xp : ${currentXP} / ${xpToNextLevel}`;
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

    if (skillPointsData !== undefined) {
      window.skillsSystem.skillPoints = Math.max(0, Number(skillPointsData));
    }

    const me = players.get(myId);
    if (me) {
      window.levelSystem.healthUpgrade = me.healthUpgrade || 0;
      window.levelSystem.energyUpgrade = me.energyUpgrade || 0;
      window.levelSystem.foodUpgrade = me.foodUpgrade || 0;
      window.levelSystem.waterUpgrade = me.waterUpgrade || 0;
      window.levelSystem.meleeDamageBonus = currentLevel;
    }

    maxStats = {
      health: 100 + (window.levelSystem.healthUpgrade || 0),
      energy: 100 + (window.levelSystem.energyUpgrade || 0),
      food: 100 + (window.levelSystem.foodUpgrade || 0),
      water: 100 + (window.levelSystem.waterUpgrade || 0),
      armor: 0,
    };

    window.levelSystem.maxStats = { ...maxStats };

    if (window.equipmentSystem && me) {
      window.equipmentSystem.applyEquipmentEffects(me);
    }

    if (!isInitialized) initializeLevelSystem();
    updateLevelDisplay();
    updateStatsDisplay();
    updateUpgradeButtons();
  } catch (error) {}
}

function calculateXPToNextLevel(level) {
  if (level >= 100) return 0;
  return 100 * Math.pow(2, level);
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

// УДАЛЯЕМ handleItemPickup и handleQuestCompletion — они больше не нужны

window.levelSystem = {
  initialize: initializeLevelSystem,
  setLevelData,
  maxStats,
  updateUpgradeButtons,
  completeUpgradeRequest,
  updateLevelDisplay,
  showXPEffect,
  showLevelUpEffect,
};
