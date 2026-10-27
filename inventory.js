// inventory.js — вся логика инвентаря

// Глобальные переменные (доступны из code.js)
window.inventory = Array(20).fill(null);
let isInventoryOpen = false;
window.isInventoryOpen = false;
let selectedSlot = null;
let inventoryAtomTimer = null;
let isInventoryInitialized = false;

const ATOM_FRAME_DURATION_INVENTORY = 180;

// Инициализация инвентаря при старте игры
function initializeInventory() {
  if (isInventoryInitialized) return;

  const inventoryContainer = document.getElementById("inventoryContainer");
  if (!inventoryContainer) return;

  isInventoryInitialized = true;

  inventoryContainer.style.display = "none";

  const inventoryGrid = document.createElement("div");
  inventoryGrid.id = "inventoryGrid";
  inventoryContainer.insertBefore(
    inventoryGrid,
    document.getElementById("inventoryActions"),
  );

  // Создаём 20 слотов
  for (let i = 0; i < 20; i++) {
    const slot = document.createElement("div");
    slot.className = "inventory-slot";
    inventoryGrid.appendChild(slot);
  }

  // Кнопки действий
  const useBtn = document.getElementById("useBtn");
  const dropBtn = document.getElementById("dropBtn");

  useBtn.addEventListener("click", () => {
    if (selectedSlot !== null) {
      const item = window.inventory[selectedSlot];
      if (item && ITEM_CONFIG[item.type]) {
        if (ITEM_CONFIG[item.type].type) {
          window.equipmentSystem.equipItem(selectedSlot);
        } else {
          useItem(selectedSlot);
        }
      }
    }
  });

  dropBtn.addEventListener("click", () => {
    if (selectedSlot !== null) {
      dropItem(selectedSlot);
    }
  });

  // Кнопка инвентаря
  const inventoryBtn = document.getElementById("inventoryBtn");
  inventoryBtn.addEventListener("click", (e) => {
    e.preventDefault();
    toggleInventory();
  });

  // Инициализируем отображение
  updateInventoryDisplay();
}

function getItemDescriptionByType(type) {
  if (!type) return "";
  let desc = ITEM_CONFIG[type]?.description || "";
  if (window.i18n) {
    const tKey = "itemdesc_" + type;
    const translated = window.i18n.t(tKey);
    if (translated && translated !== tKey) desc = translated;
  }
  return desc;
}

function formatItemDescriptionHTML(type) {
  const raw = getItemDescriptionByType(type);
  if (!raw) return "";

  // Паттерны для RU и EN (знак + число + название стата)
  const STAT_PATTERNS = [
    // EN
    { re: /([+\-−]?\d+)\s*(health|max health)/gi, cls: "stat-health" },
    { re: /([+\-−]?\d+)\s*(energy|max energy)/gi, cls: "stat-energy" },
    { re: /([+\-−]?\d+)\s*(water|max water)/gi, cls: "stat-water" },
    { re: /([+\-−]?\d+)\s*(food|max food)/gi, cls: "stat-food" },
    { re: /([+\-−]?\d+)\s*(armor)/gi, cls: "stat-armor" },

    // RU
    {
      re: /([+\-−]?\d+)\s*(здоровья|к максимальному здоровью|здоровье)/gi,
      cls: "stat-health",
    },
    {
      re: /([+\-−]?\d+)\s*(энергии|к максимальной энергии|энергия)/gi,
      cls: "stat-energy",
    },
    {
      re: /([+\-−]?\d+)\s*(воды|к максимальной воде|вода)/gi,
      cls: "stat-water",
    },
    { re: /([+\-−]?\d+)\s*(еды|к максимальной еде|еда)/gi, cls: "stat-food" },
    { re: /([+\-−]?\d+)\s*(брони|к броне|броня)/gi, cls: "stat-armor" },
  ];

  let html = raw;

  // Экранируем HTML (строки контролируемые)
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Собираем все совпадения
  const matches = [];
  STAT_PATTERNS.forEach(({ re, cls }) => {
    let m;
    const regex = new RegExp(re.source, re.flags);
    while ((m = regex.exec(html)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        cls,
      });
    }
  });

  // Заменяем с конца, чтобы индексы не плыли
  matches.sort((a, b) => b.start - a.start);

  const used = [];
  for (const m of matches) {
    const overlap = used.some((u) => !(m.end <= u.start || m.start >= u.end));
    if (!overlap) {
      used.push(m);
      const span = `<span class="${m.cls}">${m.text}</span>`;
      html = html.slice(0, m.start) + span + html.slice(m.end);
    }
  }

  return `<span class="item-desc-text">${html}</span>`;
}

// Переключение инвентаря
function toggleInventory() {
  isInventoryOpen = !isInventoryOpen;
  window.isInventoryOpen = isInventoryOpen;

  const me = players.get(myId);
  const isMobile = window.innerWidth <= 500;

  // На мобилке закрываем экипировку, если открыта
  if (isMobile && isInventoryOpen && window.equipmentSystem?.isEquipmentOpen) {
    window.equipmentSystem.toggleEquipment();
  }

  const inventoryContainer = document.getElementById("inventoryContainer");
  inventoryContainer.style.display = isInventoryOpen ? "grid" : "none";

  const inventoryBtn = document.getElementById("inventoryBtn");
  inventoryBtn.classList.toggle("active", isInventoryOpen);

  if (isInventoryOpen) {
    // Запуск анимации атомов в инвентаре
    if (!inventoryAtomTimer) {
      inventoryAtomTimer = setInterval(() => {
        updateAtomAnimationsInInventory();
      }, ATOM_FRAME_DURATION_INVENTORY);
    }
    updateInventoryDisplay();
  } else {
    // Очистка
    if (inventoryAtomTimer) {
      clearInterval(inventoryAtomTimer);
      inventoryAtomTimer = null;
    }
    document.getElementById("inventoryScreen").innerHTML = "";
    selectedSlot = null;
    document.getElementById("useBtn").disabled = true;
    document.getElementById("dropBtn").disabled = true;
    window.atomAnimations = [];
  }
}

// Обновление анимации атомов только в инвентаре
function updateAtomAnimationsInInventory() {
  if (!window.atomAnimations) return;
  window.atomAnimations.forEach((anim) => {
    if (
      window.inventory[anim.slotIndex] &&
      window.inventory[anim.slotIndex].type === "atom"
    ) {
      anim.ctx.clearRect(0, 0, 40, 40);
      if (ITEM_CONFIG["atom"]?.image?.complete) {
        anim.ctx.drawImage(
          ITEM_CONFIG["atom"].image,
          window.atomFrame * 50,
          0,
          50,
          50,
          0,
          0,
          40,
          40,
        );
      }
    }
  });
}

// Выбор слота
function selectSlot(slotIndex, slotElement) {
  if (!window.inventory[slotIndex]) return;

  const screen = document.getElementById("inventoryScreen");
  const useBtn = document.getElementById("useBtn");
  const dropBtn = document.getElementById("dropBtn");

  if (selectedSlot === slotIndex) {
    selectedSlot = null;
    screen.innerHTML = "";
    useBtn.disabled = true;
    dropBtn.disabled = true;
    return;
  }

  selectedSlot = slotIndex;
  screen.innerHTML = formatItemDescriptionHTML(
    window.inventory[slotIndex].type,
  );

  const itemType = window.inventory[slotIndex].type;
  const config = ITEM_CONFIG[itemType];

  const isNonUsableStackable =
    itemType === "balyary" ||
    itemType === "blue_crystal" ||
    itemType === "green_crystal" ||
    itemType === "red_crystal" ||
    itemType === "white_crystal" ||
    itemType === "yellow_crystal" ||
    itemType === "chameleon_crystal" ||
    itemType === "nanofilament" ||
    itemType === "nanoalloy";

  useBtn.disabled =
    isNonUsableStackable || !!config?.balyary || !config?.effect;
  dropBtn.disabled = false;
}

// Использование предмета
function useItem(slotIndex) {
  const item = window.inventory[slotIndex];
  if (!item || !ITEM_CONFIG[item.type]) return;

  const me = players.get(myId);
  if (!me) return;

  // ─── НОВОЕ: если это рецепт → показываем диалог ───
  if (item.type.startsWith("recipe_") && item.type.includes("_equipment")) {
    showRecipeDialog(item.type);
    return; // ничего больше не делаем
  } else if (window.equipmentSystem.EQUIPMENT_CONFIG[item.type]) {
    // ─── Обычная логика экипировки ───
    window.equipmentSystem.equipItem(slotIndex);
    selectedSlot = null;
    document.getElementById("useBtn").disabled = true;
    document.getElementById("dropBtn").disabled = true;
    document.getElementById("inventoryScreen").innerHTML = "";
    updateStatsDisplay();
    updateInventoryDisplay();
    return;
  }

  if (
    item.type === "balyary" ||
    item.type === "blue_crystal" ||
    item.type === "green_crystal" ||
    item.type === "red_crystal" ||
    item.type === "white_crystal" ||
    item.type === "yellow_crystal" ||
    item.type === "chameleon_crystal" ||
    item.type === "nanofilament" ||
    item.type === "nanoalloy"
  )
    return;

  // Клиент только просит сервер использовать предмет — эффекты и удаление делает сервер
  sendWhenReady(
    ws,
    JSON.stringify({
      type: "useItem",
      slotIndex,
    }),
  );

  // Отключаем кнопку, чтобы избежать двойного клика, пока ждём ответа
  document.getElementById("useBtn").disabled = true;
}

// Выброс предмета
function dropItem(slotIndex) {
  const item = window.inventory[slotIndex];
  if (!item) return;

  const me = players.get(myId);
  const screen = document.getElementById("inventoryScreen");
  const useBtn = document.getElementById("useBtn");
  const dropBtn = document.getElementById("dropBtn");

  if (ITEM_CONFIG[item.type]?.stackable) {
    if ((item.quantity || 1) === 1) {
      sendWhenReady(
        ws,
        JSON.stringify({
          type: "dropItem",
          slotIndex,
          quantity: 1,
        }),
      );

      window.inventory[slotIndex] = null;
      selectedSlot = null;
      useBtn.disabled = true;
      dropBtn.disabled = true;
      screen.innerHTML = "";
      updateInventoryDisplay();
      return;
    }

    // build stackable drop form using i18n
    const form = document.createElement("div");
    form.className = "balyary-drop-form";

    const q = document.createElement("p");
    q.className = "cyber-text";
    q.textContent = window.i18n
      ? window.i18n.t("stackable_drop_question")
      : "Сколько выкинуть?";
    form.appendChild(q);

    // === ИСПРАВЛЕНИЕ: убрали дубликат 'input' ===
    let dropInput = document.getElementById("stackableAmount");
    if (!dropInput) {
      dropInput = document.createElement("input");
      dropInput.type = "number";
      dropInput.id = "stackableAmount";
      dropInput.className = "cyber-input";
      dropInput.min = 1;
      dropInput.max = item.quantity || 1;
      dropInput.placeholder = window.i18n
        ? window.i18n.t("stackable_amount_placeholder")
        : "0";
      dropInput.autofocus = true;
      form.appendChild(dropInput);
    } else {
      form.appendChild(dropInput);
    }

    const err = document.createElement("p");
    err.id = "stackableError";
    err.className = "error-text";
    form.appendChild(err);

    screen.innerHTML = "";
    screen.appendChild(form);

    const errorEl = document.getElementById("stackableError");

    requestAnimationFrame(() => {
      dropInput.focus();
      dropInput.select();
    });

    dropInput.addEventListener("input", () => {
      dropInput.value = dropInput.value.replace(/[^0-9]/g, "");
    });

    useBtn.disabled = false;
    dropBtn.disabled = true;

    const confirmDrop = () => {
      const amount = parseInt(dropInput.value) || 0;
      const currentQuantity = item.quantity || 1;

      if (amount <= 0) {
        errorEl.textContent = window.i18n
          ? window.i18n.t("stackable_error_invalid")
          : "Введи нормальное число!";
        return;
      }
      if (amount > currentQuantity) {
        const name = window.i18n
          ? window.i18n.translateItemName(item.type)
          : item.type;
        errorEl.textContent = window.i18n
          ? window.i18n.t("stackable_error_not_enough", { item: name })
          : "Не хватает " + item.type + "!";
        return;
      }

      sendWhenReady(
        ws,
        JSON.stringify({
          type: "dropItem",
          slotIndex,
          quantity: amount,
        }),
      );

      if (amount === currentQuantity) {
        window.inventory[slotIndex] = null;
      } else {
        window.inventory[slotIndex].quantity -= amount;
      }

      useBtn.disabled = true;
      dropBtn.disabled = true;
      useBtn.onclick = () => useItem(slotIndex);
      selectedSlot = null;
      screen.innerHTML = "";
      updateInventoryDisplay();
    };

    dropInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmDrop();
      }
    });

    useBtn.onclick = (e) => {
      e.preventDefault();
      confirmDrop();
    };
  } else {
    sendWhenReady(
      ws,
      JSON.stringify({
        type: "dropItem",
        slotIndex,
        quantity: 1,
      }),
    );

    window.inventory[slotIndex] = null;
    selectedSlot = null;
    useBtn.disabled = true;
    dropBtn.disabled = true;
    screen.innerHTML = "";
    updateInventoryDisplay();
  }
}

// Обновление отображения инвентаря
function updateInventoryDisplay() {
  const inventoryGrid = document.getElementById("inventoryGrid");
  const inventoryScreen = document.getElementById("inventoryScreen");
  const useBtn = document.getElementById("useBtn");
  const dropBtn = document.getElementById("dropBtn");

  if (!inventoryGrid || !inventoryScreen) return;

  const me = players.get(myId);
  if (me?.inventory) {
    window.inventory = me.inventory.map((slot) => (slot ? { ...slot } : null));
  }

  const isStackableFormActive =
    selectedSlot !== null &&
    window.inventory[selectedSlot] &&
    ITEM_CONFIG[window.inventory[selectedSlot].type]?.stackable &&
    inventoryScreen.querySelector(".balyary-drop-form");

  if (!isStackableFormActive) {
    inventoryScreen.innerHTML = "";
    if (selectedSlot !== null && window.inventory[selectedSlot]) {
      inventoryScreen.innerHTML = formatItemDescriptionHTML(
        window.inventory[selectedSlot].type,
      );
    }
  }

  inventoryGrid.innerHTML = "";
  window.atomAnimations = [];

  window.inventory.forEach((item, i) => {
    const slot = document.createElement("div");
    slot.className = "inventory-slot";
    slot.dataset.index = i;
    inventoryGrid.appendChild(slot);

    if (item) {
      if (item.type === "atom") {
        const canvas = document.createElement("canvas");
        canvas.width = 40;
        canvas.height = 40;
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        const ctx = canvas.getContext("2d");
        slot.appendChild(canvas);

        window.atomAnimations.push({ ctx, slotIndex: i });

        if (ITEM_CONFIG["atom"]?.image?.complete) {
          ctx.drawImage(
            ITEM_CONFIG["atom"].image,
            window.atomFrame * 50,
            0,
            50,
            50,
            0,
            0,
            40,
            40,
          );
        }

        if (item.quantity > 1) {
          const q = document.createElement("div");
          q.textContent = item.quantity;
          q.style.position = "absolute";
          q.style.top = "0";
          q.style.right = "0";
          q.style.color = "#00ffff";
          q.style.fontSize = "14px";
          q.style.textShadow = "0 0 5px rgba(0, 255, 255, 0.7)";
          slot.appendChild(q);
        }
      } else {
        const img = document.createElement("img");
        img.src = ITEM_CONFIG[item.type]?.image?.src || "";
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.pointerEvents = "none";
        slot.appendChild(img);

        if (ITEM_CONFIG[item.type]?.stackable && item.quantity > 1) {
          const q = document.createElement("div");
          q.textContent = item.quantity;
          q.style.position = "absolute";
          q.style.top = "0";
          q.style.right = "0";
          q.style.color = "#00ffff";
          q.style.fontSize = "14px";
          q.style.textShadow = "0 0 5px rgba(0, 255, 255, 0.7)";
          slot.appendChild(q);
        }
      }

      slot.onmouseover = () => {
        if (
          window.inventory[i] &&
          selectedSlot !== i &&
          !isStackableFormActive
        ) {
          inventoryScreen.innerHTML = formatItemDescriptionHTML(
            window.inventory[i].type,
          );
        }
      };

      slot.onmouseout = () => {
        if (selectedSlot === null || isStackableFormActive) return;
        inventoryScreen.innerHTML = window.inventory[selectedSlot]
          ? formatItemDescriptionHTML(window.inventory[selectedSlot].type)
          : "";
      };

      slot.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectSlot(i, slot);
      };
    }
  });

  if (useBtn && dropBtn) {
    useBtn.disabled = selectedSlot === null || !window.inventory[selectedSlot];
    dropBtn.disabled = selectedSlot === null || !window.inventory[selectedSlot];
  }

  // Динамическое обновление бейджей скиллов при изменении инвентаря (талисманы)
  if (window.skillsSystem?.isSkillsOpen) {
    window.skillsSystem.updateSkillsDisplay();
  }
}

// Экспортируем функции для использования в code.js
window.inventorySystem = {
  initialize: initializeInventory,
  toggleInventory,
  updateInventoryDisplay,
  useItem,
  dropItem,
  selectSlot,
};
