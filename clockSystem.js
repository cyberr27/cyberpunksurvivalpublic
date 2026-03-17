// clockSystem.js — УЛЬТРА-ОПТИМИЗИРОВАННАЯ ВЕРСИЯ (минимальное потребление CPU/памяти)

const clockSystem = {
  clocks: [
    { x: 870, y: 2050, worldId: 0 },
    { x: 1975, y: 120, worldId: 0 },
  ],

  sprite: null,
  dialog: null,
  isOpen: false,
  lastUpdate: 0,

  // Инициализация — один раз
  initialize(spriteImage) {
    if (this.sprite) return; // уже инициализировано
    this.sprite = spriteImage || window.images?.oclocSprite;
    this._createDialog();
  },

  _createDialog() {
    if (this.dialog) return;

    const div = document.createElement("div");
    div.id = "clockDialog";
    div.className = "npc-dialog";
    div.style.display = "none";

    div.innerHTML = `
      <div class="npc-dialog-header"><div class="npc-title">ХРОНОМЕТР</div></div>
      <div class="npc-dialog-content" style="display:flex;flex-direction:column;justify-content:center;align-items:center;gap:25px;padding:30px 20px;flex:1;">
        <div id="clockTime" style="font-size:52px;letter-spacing:5px;color:#00ffff;text-shadow:0 0 20px #00ffff;">88:88</div>
        <div id="clockDate" style="font-size:28px;color:#00ff88;text-shadow:0 0 12px #00ff88;">88.88.8888</div>
      </div>`;

    document.body.appendChild(div);
    this.dialog = div;
    this.timeEl = div.querySelector("#clockTime");
    this.dateEl = div.querySelector("#clockDate");
  },

  // Открытие диалога + запуск обновления только при открытии
  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.dialog.style.display = "flex";
    this.lastUpdate = 0; // сброс кэша времени
    this._updateTime(); // мгновенное обновление
  },

  // Закрытие без лишних действий
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.dialog.style.display = "none";
  },

  // Обновление времени только когда диалог открыт и прошло ≥ 500 мс
  _updateTime() {
    const now = Date.now();
    if (now - this.lastUpdate < 500) return; // максимум 2 раза в секунду
    this.lastUpdate = now;

    const d = new Date();
    const futureYear = d.getFullYear() + 200;

    const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes(),
    ).padStart(2, "0")}`;
    const dateStr = `${String(d.getDate()).padStart(2, "0")}.${String(
      d.getMonth() + 1,
    ).padStart(2, "0")}.${futureYear}`;

    this.timeEl.textContent = timeStr;
    this.dateEl.textContent = dateStr;
  },

  // Проверка дистанции — максимально быстрая (без корней, без лишних переменных)
  _isNearClock(meX, meY, currentWorldId) {
    for (const c of this.clocks) {
      if (c.worldId !== currentWorldId) continue;
      const dx = meX + 35 - c.x;
      const dy = meY + 35 - c.y;
      if (dx * dx + dy * dy < 2500) return true; // 50² = 2500
    }
    return false;
  },

  // Основной апдейт — вызывается каждый кадр, но почти ничего не делает
  update(deltaTime) {
    if (!myId || !players.has(myId)) {
      if (this.isOpen) this.close();
      return;
    }

    const me = players.get(myId);
    if (!me || me.health <= 0) {
      if (this.isOpen) this.close();
      return;
    }

    const near = this._isNearClock(
      me.x,
      me.y,
      window.worldSystem?.currentWorldId ?? 0,
    );

    if (near && !this.isOpen) this.open();
    else if (!near && this.isOpen) this.close();
    else if (this.isOpen) this._updateTime(); // только если открыт
  },

  // Отрисовка — только видимые часы, без лишних проверок
  draw() {
    if (!this.sprite?.complete) return;

    const cam = window.movementSystem?.getCamera?.() || { x: 0, y: 0 };
    const worldId = window.worldSystem?.currentWorldId ?? 0;
    const now = performance.now();
    const frame = Math.floor(now / 120) % 13;

    for (const c of this.clocks) {
      if (c.worldId !== worldId) continue;

      const sx = c.x - cam.x - 35;
      const sy = c.y - cam.y - 65;

      ctx.drawImage(this.sprite, frame * 70, 0, 70, 70, sx, sy, 70, 70);
    }
  },
};

// Авто-инициализация без setInterval и утечек
(() => {
  window.clockSystem = clockSystem;

  const init = () => {
    if (window.images?.oclocSprite) {
      clockSystem.initialize(window.images.oclocSprite);
      return true;
    }
    return false;
  };

  if (!init()) {
    const observer = new MutationObserver(() => {
      if (init()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
