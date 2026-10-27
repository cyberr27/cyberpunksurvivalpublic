// soundSystem.js
const soundSystem = {
  ambient: null,
  currentWorldId: null,
  isReady: false,
  volume: 0.35, // можно потом вынести в настройки

  // Путь относительно корня проекта (рядом с image/)
  AMBIENT_MAP: {
    1: "sound/Desert.mp3", // Пустоши
    0: "sound/City.mp3", // Город
  },

  initialize() {
    // Создаём один Audio-элемент на всё время жизни игры
    this.ambient = new Audio();
    this.ambient.loop = true;
    this.ambient.volume = this.volume;
    this.ambient.preload = "auto";

    // Обработка ошибок загрузки
    this.ambient.addEventListener("error", (e) => {
      console.warn("[soundSystem] Не удалось загрузить ambient:", e);
    });

    this.isReady = true;
    console.log("[soundSystem] Инициализирован");
  },

  /**
   * Главный метод — вызывается при любой смене мира
   * @param {number} worldId
   */
  setWorld(worldId) {
    if (!this.isReady) return;

    // Если мир не изменился — ничего не делаем
    if (this.currentWorldId === worldId) return;

    this.currentWorldId = worldId;

    const src = this.AMBIENT_MAP[worldId];

    if (src) {
      // Нужен ambient
      if (this.ambient.src !== src && !this.ambient.src.endsWith(src)) {
        this.ambient.src = src;
        this.ambient.load();
      }

      // Пытаемся играть (браузеры требуют user-gesture, но после логина уже есть)
      const playPromise = this.ambient.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          // Автоплей заблокирован — пробуем ещё раз при следующем взаимодействии
          console.warn(
            "[soundSystem] Autoplay blocked, will retry on interaction:",
            err.message,
          );
        });
      }
    } else {
      // Мир без ambient — останавливаем
      this.stop();
    }
  },

  stop() {
    if (!this.ambient) return;
    this.ambient.pause();
    this.ambient.currentTime = 0;
  },

  // На случай, если нужно принудительно обновить громкость
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.ambient) this.ambient.volume = this.volume;
  },
};

window.soundSystem = soundSystem;
