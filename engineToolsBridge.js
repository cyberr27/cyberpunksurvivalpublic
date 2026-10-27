(function () {
  "use strict";

  let provider = null;

  function register(candidate) {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      typeof candidate.getEditorRenderData !== "function" ||
      typeof candidate.getPerformanceMonitor !== "function"
    ) {
      console.error("[EngineToolsBridge] Invalid tools provider.");
      return false;
    }

    if (provider && provider !== candidate) {
      console.error("[EngineToolsBridge] Provider already registered.");
      return false;
    }

    provider = candidate;
    return true;
  }

  function isReady() {
    return provider !== null;
  }

  function getEditorRenderData() {
    return provider?.getEditorRenderData?.() ?? null;
  }

  function getPerformanceMonitor() {
    return provider?.getPerformanceMonitor?.() ?? null;
  }

  window.engineToolsBridge = Object.freeze({
    register,
    isReady,
    getEditorRenderData,
    getPerformanceMonitor,
  });
})();
