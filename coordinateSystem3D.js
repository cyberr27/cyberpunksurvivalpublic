(function () {
  "use strict";

  const AXES = Object.freeze({
    GAME_X_TO_RENDER: "x",
    GAME_Y_TO_RENDER: "z",
    HEIGHT_TO_RENDER: "y",
  });

  function isFiniteNumber(value) {
    return Number.isFinite(value);
  }

  // ============================================================
  // POSITION
  // ============================================================

  function gameToRenderPosition(gameX, gameY, height = 0) {
    if (
      !isFiniteNumber(gameX) ||
      !isFiniteNumber(gameY) ||
      !isFiniteNumber(height)
    ) {
      return null;
    }

    return [gameX, height, gameY];
  }

  function renderToGamePosition(renderX, renderY, renderZ) {
    if (
      !isFiniteNumber(renderX) ||
      !isFiniteNumber(renderY) ||
      !isFiniteNumber(renderZ)
    ) {
      return null;
    }

    return {
      x: renderX,
      y: renderZ,
      height: renderY,
    };
  }

  // ============================================================
  // VECTOR
  // ============================================================

  function gameToRenderVector(gameX, gameY, height = 0) {
    if (
      !isFiniteNumber(gameX) ||
      !isFiniteNumber(gameY) ||
      !isFiniteNumber(height)
    ) {
      return null;
    }

    return [gameX, height, gameY];
  }

  function renderToGameVector(renderX, renderY, renderZ) {
    if (
      !isFiniteNumber(renderX) ||
      !isFiniteNumber(renderY) ||
      !isFiniteNumber(renderZ)
    ) {
      return null;
    }

    return {
      dx: renderX,
      dy: renderZ,
      height: renderY,
    };
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  window.coordinateSystem3D = Object.freeze({
    AXES,

    gameToRenderPosition,
    renderToGamePosition,

    gameToRenderVector,
    renderToGameVector,
  });
})();
