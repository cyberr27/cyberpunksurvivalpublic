(function () {
  "use strict";

  const openButton = document.getElementById("rendererModeBtn");
  const dialog = document.getElementById("rendererModeDialog");
  const toggle = document.getElementById("renderer3DToggle");
  const cancelButton = document.getElementById("rendererModeCancelBtn");
  const status = document.getElementById("rendererModeStatus");

  const settingsPanel = document.getElementById("rendererGraphicsSettings");

  const pbrToggle = document.getElementById("rendererPbrToggle");

  const bloomToggle = document.getElementById("rendererBloomToggle");

  const bloomIntensity = document.getElementById("rendererBloomIntensity");

  const bloomValue = document.getElementById("rendererBloomValue");

  const lodToggle = document.getElementById("rendererLodToggle");

  const cullingToggle = document.getElementById("rendererCullingToggle");

  const resetButton = document.getElementById("rendererGraphicsResetBtn");

  const requiredElements = [
    openButton,
    dialog,
    toggle,
    cancelButton,
    status,
    settingsPanel,
    pbrToggle,
    bloomToggle,
    bloomIntensity,
    bloomValue,
    lodToggle,
    cullingToggle,
    resetButton,
  ];

  if (requiredElements.some((element) => !element)) {
    console.error("[RendererModeDialog] Required dialog elements are missing.");

    return;
  }

  function getConfig() {
    return window.engineConfig;
  }

  function showError(message) {
    status.textContent = message || "Не удалось применить настройки графики.";
  }

  function clearStatus() {
    status.textContent = "";
  }

  function syncToggle() {
    const is3D = window.rendererSystem?.is3D?.() === true;

    toggle.checked = is3D;
    settingsPanel.hidden = !is3D;
  }

  function syncGraphicsSettings() {
    const engineConfig = getConfig();

    if (!engineConfig) {
      return;
    }

    const settings = engineConfig.get();

    pbrToggle.checked = settings.materialLighting === "pbr";

    bloomToggle.checked = settings.bloomEnabled === true;

    bloomIntensity.value = String(settings.bloomIntensity);

    bloomValue.value = Number(settings.bloomIntensity).toFixed(2);

    bloomIntensity.disabled = !settings.bloomEnabled;

    lodToggle.checked = settings.staticLod === true;

    cullingToggle.checked = settings.staticCulling === true;
  }

  function syncAll() {
    syncToggle();
    syncGraphicsSettings();
  }

  function applySetting(key, value) {
    const engineConfig = getConfig();

    if (!engineConfig || !engineConfig.isInitialized?.()) {
      showError("Система настроек графики недоступна.");

      syncGraphicsSettings();
      return false;
    }

    const success = engineConfig.set(key, value);

    if (!success) {
      showError("Не удалось применить настройку: " + key);
    } else {
      clearStatus();
    }

    syncGraphicsSettings();

    return success;
  }

  openButton.addEventListener("click", () => {
    syncAll();
    clearStatus();

    if (!dialog.open) {
      dialog.showModal();
    }
  });

  cancelButton.addEventListener("click", () => {
    dialog.close();
  });

  let switchingMode = false;

  toggle.addEventListener("change", async () => {
    if (switchingMode) {
      return;
    }

    const renderer = window.rendererSystem;
    const requestedEnabled = toggle.checked;
    const requestedMode = requestedEnabled ? "3d" : "2d";
    const engineConfig = getConfig();

    if (!renderer?.setModeAsync) {
      showError("Режим отображения недоступен.");
      syncAll();
      return;
    }

    switchingMode = true;
    toggle.disabled = true;

    status.textContent = requestedEnabled
      ? "Загрузка 3D..."
      : "Переключение...";

    try {
      const changed = engineConfig?.isInitialized?.()
        ? await engineConfig.setAsync("renderer", requestedMode)
        : await renderer.setModeAsync(requestedMode);

      if (!changed || renderer.is3D() !== requestedEnabled) {
        showError("Не удалось переключить режим отображения.");
      } else {
        clearStatus();
      }
    } catch (error) {
      console.error("[RendererModeDialog] Mode change failed:", error);

      showError("Не удалось переключить режим отображения.");
    } finally {
      switchingMode = false;
      toggle.disabled = false;
      syncAll();
    }
  });

  pbrToggle.addEventListener("change", () => {
    applySetting("materialLighting", pbrToggle.checked ? "pbr" : "legacy");
  });

  bloomToggle.addEventListener("change", () => {
    applySetting("bloomEnabled", bloomToggle.checked);
  });

  bloomIntensity.addEventListener("input", () => {
    bloomValue.value = Number(bloomIntensity.value).toFixed(2);
  });

  bloomIntensity.addEventListener("change", () => {
    const value = Number(bloomIntensity.value);

    applySetting("bloomIntensity", value);
  });

  lodToggle.addEventListener("change", () => {
    applySetting("staticLod", lodToggle.checked);
  });

  cullingToggle.addEventListener("change", () => {
    applySetting("staticCulling", cullingToggle.checked);
  });

  resetButton.addEventListener("click", () => {
    const engineConfig = getConfig();

    if (!engineConfig || !engineConfig.resetGraphics?.()) {
      showError("Не удалось сбросить настройки графики.");

      syncGraphicsSettings();
      return;
    }

    clearStatus();
    syncGraphicsSettings();
  });

  dialog.addEventListener("close", () => {
    syncAll();
    clearStatus();
  });

  window.addEventListener("rendererModeChanged", syncAll);

  syncAll();
})();
