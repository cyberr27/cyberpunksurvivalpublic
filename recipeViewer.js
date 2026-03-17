// recipeViewer.js — просмотр рецептов (оптимизировано 2025)

const RECIPE_DIALOG_CLASS = "recipe-dialog";
const RECIPE_ACTIVE_CLASS = "recipe-dialog-active";

const RECIPE_BACKGROUNDS = {
  recipe_torn_equipment: "recipe_torn_equipment.png",
  recipe_chameleon_equipment: "recipe_chameleon_equipment.png",
  // дефолтный фон задаётся ниже
};

function showRecipeDialog(itemType) {
  if (!ITEM_CONFIG[itemType]?.description) {
    showNotification("Рецепт повреждён...", "#ff4444");
    return;
  }

  // Удаляем старый диалог, если открыт
  document.querySelector(`.${RECIPE_DIALOG_CLASS}`)?.remove();

  const bg = RECIPE_BACKGROUNDS[itemType] || "recipe_bg.png";

  const dialog = document.createElement("div");
  dialog.className = RECIPE_DIALOG_CLASS;
  dialog.style.backgroundImage = `url(${bg})`;

  // Кнопка закрытия
  const closeBtn = document.createElement("button");
  closeBtn.className = "recipe-neon-btn";
  closeBtn.textContent = "x";

  const closeArea = document.createElement("div");
  closeArea.className = "recipe-close-area";
  closeArea.appendChild(closeBtn);

  dialog.appendChild(closeArea);

  document.body.appendChild(dialog);

  // Открываем
  requestAnimationFrame(() => dialog.classList.add("open"));

  // Блокируем прокрутку
  document.body.classList.add(RECIPE_ACTIVE_CLASS);

  // ─── Закрытие ───────────────────────────────────────
  const close = () => {
    dialog.classList.remove("open");
    setTimeout(() => {
      dialog.remove();
      document.body.classList.remove(RECIPE_ACTIVE_CLASS);
    }, 320);
  };

  closeBtn.onclick = close;

  // Клик вне контента
  dialog.onclick = (e) => {
    if (e.target === dialog) close();
  };

  // Esc
  const onEsc = (e) => {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", onEsc);
    }
  };
  document.addEventListener("keydown", onEsc);
}

// Подключаем стили один раз
if (!document.querySelector('link[href="recipeViewerStyle.css"]')) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "recipeViewerStyle.css";
  document.head.appendChild(link);
}
