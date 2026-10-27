(function () {
  "use strict";

  const CONFIG = {
    sprite2D: {
      referenceSize: 90,
      walking: {
        drawHeightReduction: 25,
      },
      attack: {
        drawHeightReduction: 25,
      },
    },

    billboard3D: {
      width: 120,
      height: 95,
      elevation: 1.25,
    },

    model3D: {
      targetHeight: 85,
      axisRotationX: -Math.PI / 2,
      yawOffset: 0,
      enableSkinning: true,

      assetUrl: "models/player.glb",

      resolveAnimation(player) {
        if (Number(player?.health) <= 0) {
          return {
            name: "Walking",
            playing: false,
            loop: false,
          };
        }

        if (player?.state === "attacking") {
          return {
            name: "Punching",
            playing: true,
            loop: false,
          };
        }

        if (player?.state === "walking") {
          return {
            name: "Walking",
            playing: true,
            loop: true,
          };
        }

        return {
          name: "Walking",
          playing: false,
          loop: false,
        };
      },
    },

    // Визуальная калибровка относительно игровых X/Y.
    // Это НЕ смещение серверных координат.
    groundAnchor: {
      x: 45,
      y: 65,
    },
  };

  function get() {
    return CONFIG;
  }

  function getGroundAnchor(gameX, gameY) {
    if (!Number.isFinite(gameX) || !Number.isFinite(gameY)) {
      return null;
    }

    return {
      x: gameX + CONFIG.groundAnchor.x,
      y: gameY + CONFIG.groundAnchor.y,
    };
  }

  window.playerVisualConfig = Object.freeze({
    get,
    getGroundAnchor,
  });
})();
