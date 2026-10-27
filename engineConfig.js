(function () {
  "use strict";

  const STORAGE_KEY = "sector12.engine.graphics.v1";
  const STORAGE_VERSION = 1;

  const defaults = Object.freeze({
    renderer: "2d",
    materialLighting: "legacy",
    bloomEnabled: true,
    bloomIntensity: 0.42,
    staticCulling: true,
    staticLod: true,
  });

  const GRAPHICS_KEYS = Object.freeze([
    "materialLighting",
    "bloomEnabled",
    "bloomIntensity",
    "staticCulling",
    "staticLod",
  ]);

  const config = { ...defaults };

  let initialized = false;

  function validate(key, value) {
    switch (key) {
      case "renderer":
        return value === "2d" || value === "3d";

      case "materialLighting":
        return value === "legacy" || value === "pbr";

      case "bloomEnabled":
      case "staticCulling":
      case "staticLod":
        return typeof value === "boolean";

      case "bloomIntensity":
        return Number.isFinite(value) && value >= 0 && value <= 2;

      default:
        return false;
    }
  }

  function readStorage() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return null;
      }

      const saved = JSON.parse(raw);

      if (
        !saved ||
        typeof saved !== "object" ||
        Array.isArray(saved) ||
        saved.version !== STORAGE_VERSION ||
        !saved.settings ||
        typeof saved.settings !== "object" ||
        Array.isArray(saved.settings)
      ) {
        return null;
      }

      return saved.settings;
    } catch (error) {
      console.warn("[EngineConfig] Could not read saved settings.", error);

      return null;
    }
  }

  function restoreSavedValues() {
    const saved = readStorage();

    if (!saved) {
      return;
    }

    for (const key of Object.keys(defaults)) {
      if (
        Object.prototype.hasOwnProperty.call(saved, key) &&
        validate(key, saved[key])
      ) {
        config[key] = saved[key];
      }
    }
  }

  function get() {
    return Object.freeze({
      ...config,
      renderer: window.rendererSystem?.getMode?.() ?? config.renderer,
    });
  }

  function save() {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: STORAGE_VERSION,
          settings: get(),
        }),
      );

      return true;
    } catch (error) {
      console.warn("[EngineConfig] Could not save settings.", error);

      return false;
    }
  }

  function applySetting(key, value) {
    if (key !== "renderer" && !window.engine3DLoader?.isReady?.()) {
      return true;
    }

    switch (key) {
      case "renderer":
        return window.rendererSystem?.setMode?.(value) === true;

      case "materialLighting":
        return (
          window.vanilla3DRenderer?.setMaterialLightingMode?.(value) === true
        );

      case "bloomEnabled":
        return window.bloomSystem3D?.setEnabled?.(value) === true;

      case "bloomIntensity":
        return window.bloomSystem3D?.setIntensity?.(value) === true;

      case "staticCulling":
        return window.staticModelCulling3D?.setEnabled?.(value) === true;

      case "staticLod":
        return window.staticModelLOD3D?.setEnabled?.(value) === true;

      default:
        return false;
    }
  }

  function applyDeferredGraphics() {
    if (!window.engine3DLoader?.isReady?.()) {
      return false;
    }

    for (const key of GRAPHICS_KEYS) {
      if (!applySetting(key, config[key])) {
        return false;
      }
    }

    return true;
  }

  async function setAsync(key, value) {
    if (key !== "renderer") {
      return set(key, value);
    }

    if (!validate(key, value) || !initialized) {
      return false;
    }

    const changed = await window.rendererSystem?.setModeAsync?.(value);

    if (changed !== true) {
      return false;
    }

    config.renderer = value;
    save();

    return true;
  }

  function set(key, value) {
    if (!validate(key, value)) {
      console.error("[EngineConfig] Invalid setting:", key, value);

      return false;
    }

    if (!initialized) {
      if (key === "renderer") {
        console.warn("[EngineConfig] Renderer is not initialized yet.");

        return false;
      }

      config[key] = value;
      return true;
    }

    if (!applySetting(key, value)) {
      console.error("[EngineConfig] Could not apply setting:", key, value);

      return false;
    }

    config[key] = value;
    save();

    return true;
  }

  function configure(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      return false;
    }

    const entries = Object.entries(options);

    if (!entries.every(([key, value]) => validate(key, value))) {
      console.error("[EngineConfig] Invalid configuration.");

      return false;
    }

    if (!initialized) {
      return false;
    }

    const previous = get();
    const applied = [];

    for (const [key, value] of entries) {
      if (key === "renderer") {
        continue;
      }

      if (!applySetting(key, value)) {
        for (const rollbackKey of applied.reverse()) {
          applySetting(rollbackKey, previous[rollbackKey]);
        }

        return false;
      }

      applied.push(key);
    }

    if (Object.prototype.hasOwnProperty.call(options, "renderer")) {
      if (!applySetting("renderer", options.renderer)) {
        for (const rollbackKey of applied.reverse()) {
          applySetting(rollbackKey, previous[rollbackKey]);
        }

        return false;
      }
    }

    Object.assign(config, options);
    save();

    return true;
  }

  function initialize() {
    if (initialized) {
      return true;
    }

    const applied = [];

    for (const key of GRAPHICS_KEYS) {
      if (!applySetting(key, config[key])) {
        for (const rollbackKey of applied.reverse()) {
          applySetting(rollbackKey, defaults[rollbackKey]);
        }

        console.error("[EngineConfig] Initialization failed:", key);

        return false;
      }

      applied.push(key);
    }

    initialized = true;

    console.log("[EngineConfig] Initialized.", get());

    return true;
  }

  function resetGraphics() {
    const options = {};

    for (const key of GRAPHICS_KEYS) {
      options[key] = defaults[key];
    }

    return configure(options);
  }

  function reset() {
    return configure(defaults);
  }

  restoreSavedValues();

  window.addEventListener("rendererModeChanged", () => {
    if (!initialized) {
      return;
    }

    config.renderer = window.rendererSystem?.getMode?.() ?? config.renderer;

    save();
  });

  window.engineConfig = Object.freeze({
    get,
    set,
    setAsync,
    applyDeferredGraphics,
    configure,
    initialize,
    reset,
    resetGraphics,

    getStartupRenderer() {
      return config.renderer;
    },
    getDefaults() {
      return defaults;
    },
    isInitialized() {
      return initialized;
    },
  });
})();
