(function () {
  "use strict";

  let scripts = Object.freeze([]);
  let configured = false;
  let pending = null;

  const loaded = new Set();

  function configure(urls) {
    if (
      configured ||
      !Array.isArray(urls) ||
      urls.length === 0 ||
      !urls.every((url) => typeof url === "string" && url.trim().length > 0)
    ) {
      return false;
    }

    scripts = Object.freeze([...urls]);
    configured = true;

    return true;
  }

  function loadScript(url) {
    if (loaded.has(url)) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");

      script.src = url;
      script.async = false;

      script.onload = () => {
        loaded.add(url);
        resolve();
      };

      script.onerror = () => {
        script.remove();

        reject(new Error(`[Engine3DLoader] Failed to load ${url}`));
      };

      document.head.appendChild(script);
    });
  }

  function prepare() {
    if (!configured) {
      return Promise.reject(new Error("[Engine3DLoader] Not configured."));
    }

    if (!pending) {
      pending = (async () => {
        for (const url of scripts) {
          await loadScript(url);
        }
      })().catch((error) => {
        pending = null;
        throw error;
      });
    }

    return pending;
  }

  function isReady() {
    return configured && scripts.every((url) => loaded.has(url));
  }

  window.engine3DLoader = Object.freeze({
    configure,
    prepare,
    isReady,
  });
})();
