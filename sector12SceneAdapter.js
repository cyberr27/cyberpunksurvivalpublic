(function () {
  "use strict";

  const bridge = window.engineSceneBridge;

  let localPlayerProvider = null;

  const EMPTY_WORLD_ARRAY = Object.freeze([]);

  function setLocalPlayerProvider(provider) {
    if (typeof provider !== "function") {
      return false;
    }

    localPlayerProvider = provider;
    return true;
  }

  if (!bridge) {
    console.error("[Sector12SceneAdapter] Engine scene bridge is unavailable.");
    return;
  }

  function buildSector12WorldScene() {
    const worldSceneSystem = window.worldSceneSystem;

    if (!worldSceneSystem) {
      return null;
    }

    const worldId = worldSceneSystem.getCurrentWorldId();

    if (worldId === null) {
      return null;
    }

    const world = worldSceneSystem.getWorldById(worldId);

    if (!world) {
      return null;
    }

    worldSceneSystem.ensureWorldLoaded(worldId);

    const tileSize = worldSceneSystem.getTileSize();

    return {
      worldId,

      world: {
        id: world.id,
        name: world.name,
        width: world.w,
        height: world.h,
      },

      tileSize,

      tileCount: {
        x: Math.floor(world.w / tileSize),
        y: Math.floor(world.h / tileSize),
      },

      layers: {
        background: {
          tiles: worldSceneSystem.getLayerTiles("background", worldId),
          parallaxX: 1.0,
          parallaxY: 1.0,
        },

        rocks: {
          tiles: worldSceneSystem.getLayerTiles("rocks", worldId),
          parallaxX: 0.5,
          parallaxY: 1.0,
        },

        vegetation: {
          tiles: worldSceneSystem.getLayerTiles("vegetation", worldId),
          parallaxX: 1.0,
          parallaxY: 1.0,
        },

        foreground: {
          tiles: worldSceneSystem.getLayerTiles("foreground", worldId),
          parallaxX: 1.0,
          parallaxY: 1.0,
        },

        clouds: {
          tiles: worldSceneSystem.getLayerTiles("clouds", worldId),
          parallaxX: 0.3,
          parallaxY: 0.3,
        },
      },

      staticGeometry: worldSceneSystem.getStaticGeometry(worldId),

      transitionZones: worldSceneSystem.getTransitionZones(worldId),
    };
  }

  const worldProvider = Object.freeze({
    getCurrentWorldId() {
      const worldSystem = window.worldSystem;

      if (!worldSystem) {
        return null;
      }

      const worldId = Number(worldSystem.currentWorldId);

      return Number.isInteger(worldId) ? worldId : null;
    },

    getWorldById(worldId) {
      const worldSystem = window.worldSystem;

      if (!worldSystem || !Number.isInteger(worldId)) {
        return null;
      }

      return worldSystem.worlds?.[worldId] || null;
    },

    getTileSize() {
      const tileSize = Number(window.worldSystem?.TILE_SIZE);

      return Number.isFinite(tileSize) && tileSize > 0 ? tileSize : 128;
    },

    ensureWorldLoaded(worldId) {
      const worldSystem = window.worldSystem;

      if (
        !worldSystem ||
        worldId === null ||
        !Number.isInteger(worldId) ||
        !worldSystem.worlds?.[worldId]
      ) {
        return false;
      }

      worldSystem.ensureTilesLoaded?.(worldId);

      return true;
    },

    getLayerTiles(layerName, worldId) {
      const worldSystem = window.worldSystem;

      if (!worldSystem || worldId === null || !Number.isInteger(worldId)) {
        return EMPTY_WORLD_ARRAY;
      }

      let layerStore = null;

      switch (layerName) {
        case "background":
          layerStore = worldSystem.bgTiles;
          break;

        case "rocks":
          layerStore = worldSystem.rocksTiles;
          break;

        case "vegetation":
          layerStore = worldSystem.vegetationTiles;
          break;

        case "foreground":
          layerStore = worldSystem.foregroundTiles;
          break;

        case "clouds":
          layerStore = worldSystem.cloudsTiles;
          break;

        default:
          return EMPTY_WORLD_ARRAY;
      }

      const tiles = layerStore?.[worldId];

      return Array.isArray(tiles) ? tiles : EMPTY_WORLD_ARRAY;
    },

    getTransitionZones(worldId) {
      const worldSystem = window.worldSystem;

      if (
        !worldSystem ||
        worldId === null ||
        !Array.isArray(worldSystem.transitionZones)
      ) {
        return EMPTY_WORLD_ARRAY;
      }

      return worldSystem.transitionZones.filter(
        (zone) => zone?.sourceWorldId === worldId,
      );
    },

    getStaticGeometry(worldId) {
      if (worldId === null || !Number.isInteger(worldId)) {
        return EMPTY_WORLD_ARRAY;
      }

      const staticGeometrySystem = window.staticGeometrySystem;

      if (
        !staticGeometrySystem ||
        typeof staticGeometrySystem.getGeometryForWorld !== "function"
      ) {
        return EMPTY_WORLD_ARRAY;
      }

      const geometry = staticGeometrySystem.getGeometryForWorld(worldId);

      return Array.isArray(geometry) ? geometry : EMPTY_WORLD_ARRAY;
    },

    getScene() {
      return buildSector12WorldScene();
    },
  });

  const adapter = Object.freeze({
    getWorldScene() {
      return buildSector12WorldScene();
    },

    getEntityScene() {
      return window.sceneEntitySystem?.getSceneSnapshot?.() ?? null;
    },

    ensureWorldLoaded(worldId) {
      return window.worldSceneSystem?.ensureWorldLoaded?.(worldId) === true;
    },

    normalizeVisualEntity(entity, category) {
      return (
        window.sceneEntitySystem?.normalizeVisualEntity?.(entity, category) ??
        null
      );
    },

    resolveEntityVisual(entity, rendererMode = "3d", options = {}) {
      return (
        window.sceneEntitySystem?.resolveEntityVisual?.(
          entity,
          rendererMode,
          options,
        ) ?? null
      );
    },

    getLocalPlayer() {
      return localPlayerProvider?.() ?? null;
    },

    getTargetableEnemies() {
      const enemies = window.enemySystem?.getEnemies?.();

      return enemies instanceof Map ? enemies : null;
    },

    getCameraWorld() {
      const worldSystem = window.worldSystem;
      const world = worldSystem?.getCurrentWorld?.();

      if (!world) {
        return null;
      }

      return {
        worldId: Number(worldSystem.currentWorldId),
        width: world.w,
        height: world.h,
      };
    },

    getCameraBoundaryConfig(worldId) {
      if (!Number.isInteger(worldId) || worldId !== 0) {
        return null;
      }

      return {
        enabled: true,
        worldMargin: 40,
        wallClearance: 20,
      };
    },

    getRenderCanvas(mode = "3d") {
      if (mode === "2d") {
        return document.getElementById("gameCanvas");
      }

      if (mode === "3d") {
        return document.getElementById("game3DCanvas");
      }

      return null;
    },

    getCameraViewport() {
      const movement = window.movementSystem;
      const camera = movement?.getCamera?.();
      const zoom = movement?.getZoom?.() || 1;

      const canvas2D = document.getElementById("gameCanvas");
      const canvas3D = document.getElementById("game3DCanvas");

      return {
        cameraX: camera?.x,
        cameraY: camera?.y,
        hasCamera: Boolean(camera && canvas2D),
        zoom,
        width: canvas2D?.width || canvas3D?.width || 1,
        height: canvas2D?.height || canvas3D?.height || 1,
        canvas2DWidth: canvas2D?.width,
        canvas2DHeight: canvas2D?.height,
      };
    },

    getCameraPlayerTarget(player) {
      if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y)) {
        return null;
      }

      const visualConfig = window.playerVisualConfig;

      if (
        !visualConfig ||
        typeof visualConfig.getGroundAnchor !== "function" ||
        typeof visualConfig.get !== "function"
      ) {
        return null;
      }

      const anchor = visualConfig.getGroundAnchor(player.x, player.y);
      const config = visualConfig.get();

      if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
        return null;
      }

      const targetHeight = config?.model3D?.targetHeight;

      if (!Number.isFinite(targetHeight) || targetHeight <= 0) {
        return null;
      }

      return {
        x: anchor.x,
        y: anchor.y,
        height: targetHeight * 0.5,
      };
    },

    changeCameraZoomByWheel(deltaY) {
      return window.movementSystem?.changeZoomByWheel?.(deltaY);
    },

    getPlayerVisualConfig() {
      return window.playerVisualConfig?.get?.() ?? null;
    },

    getPlayerGroundAnchor(gameX, gameY) {
      return window.playerVisualConfig?.getGroundAnchor?.(gameX, gameY) ?? null;
    },

    getAreaAimPreview() {
      const implants = window.implantsSystem;

      if (!implants?.aiming?.active) {
        return null;
      }

      const slotIndex = implants.aiming.slotIndex;
      const implant = implants.implantSlots?.[slotIndex];
      const config = implants.IMPLANT_CONFIG?.[implant?.type];

      if (!config || config.type !== "area") {
        return null;
      }

      const x = window.lastPointerWorldX;
      const y = window.lastPointerWorldY;

      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return null;
      }

      return {
        x,
        y,
        radius: Number.isFinite(config.radius) ? config.radius : 100,
      };
    },

    canCaptureGamePointer() {
      if (window.isInventoryOpen) {
        return false;
      }

      const active = document.activeElement;

      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable)
      ) {
        return false;
      }

      if (
        document.querySelector(
          ".npc-dialog.open, .neon-npc-dialog.neon-npc-dialog-open",
        )
      ) {
        return false;
      }

      return true;
    },
  });

  const worldSceneSystem = window.worldSceneSystem;

  if (
    !worldSceneSystem ||
    typeof worldSceneSystem.register !== "function" ||
    !worldSceneSystem.register(worldProvider)
  ) {
    console.error("[Sector12SceneAdapter] World provider registration failed.");
    return;
  }

  if (!bridge.register(adapter)) {
    console.error("[Sector12SceneAdapter] Scene adapter registration failed.");
    return;
  }

  window.sector12SceneAdapter = Object.freeze({
    ...adapter,
    setLocalPlayerProvider,
  });

  function registerSector12EntityProviders() {
    const entitySystem = window.sceneEntitySystem;

    if (
      !entitySystem ||
      typeof entitySystem.setEnemyProvider !== "function" ||
      typeof entitySystem.setItemProvider !== "function" ||
      typeof entitySystem.setBulletProvider !== "function" ||
      typeof entitySystem.setImplantProvider !== "function"
    ) {
      console.error(
        "[Sector12SceneAdapter] Entity provider API is unavailable.",
      );
      return;
    }

    const enemyProvider = Object.freeze({
      getEnemies() {
        return window.enemySystem?.getEnemies?.() ?? null;
      },

      getRenderData(enemy) {
        return window.enemySystem?.getRenderData?.(enemy) ?? null;
      },
    });

    const itemProvider = Object.freeze({
      getItems() {
        return window.worldItemRenderSystem?.getItems?.() ?? null;
      },

      getRenderData(item) {
        return window.worldItemRenderSystem?.getRenderData?.(item) ?? null;
      },
    });

    const bulletProvider = Object.freeze({
      getBullets() {
        return window.combatSystem?.getBullets?.() ?? null;
      },

      getBulletRenderData(bullet) {
        const combatSystem = window.combatSystem;

        return typeof combatSystem?.getBulletRenderData === "function"
          ? combatSystem.getBulletRenderData(bullet)
          : bullet;
      },
    });

    const implantProvider = Object.freeze({
      getProjectiles() {
        return window.implantRenderSystem?.getProjectiles?.() ?? null;
      },

      getLightningStrikes() {
        return window.implantRenderSystem?.getLightningStrikes?.() ?? null;
      },

      getTornadoStrikes() {
        return window.implantRenderSystem?.getTornadoStrikes?.() ?? null;
      },
    });

    const enemiesRegistered = entitySystem.setEnemyProvider(enemyProvider);
    const itemsRegistered = entitySystem.setItemProvider(itemProvider);
    const bulletsRegistered = entitySystem.setBulletProvider(bulletProvider);
    const implantsRegistered = entitySystem.setImplantProvider(implantProvider);

    if (
      !enemiesRegistered ||
      !itemsRegistered ||
      !bulletsRegistered ||
      !implantsRegistered
    ) {
      console.error(
        "[Sector12SceneAdapter] Entity provider registration failed.",
      );
    }
  }

  registerSector12EntityProviders();

  function registerSector12NPCVisualProviders() {
    const entitySystem = window.sceneEntitySystem;

    if (
      !entitySystem ||
      typeof entitySystem.registerNPCVisualProvider !== "function"
    ) {
      console.error(
        "[Sector12SceneAdapter] NPC visual registry is unavailable.",
      );
      return;
    }

    const npcProviders = [
      ["cristina", window.cristinaNpc],
      ["lina", window.linaNpc],
      ["viktor", window.viktorNpc],
      ["daniel", window.danielNpc],
      ["warman", window.warmanNpc],
      ["yuri", window.yuriSystem],
    ];

    for (const [id, provider] of npcProviders) {
      if (!provider || typeof provider.getRenderData !== "function") {
        continue;
      }

      if (entitySystem.getRegisteredNPCIds().includes(id)) {
        continue;
      }

      if (!entitySystem.registerNPCVisualProvider(id, provider)) {
        console.error(`[Sector12SceneAdapter] NPC registration failed: ${id}`);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      registerSector12NPCVisualProviders,
      { once: true },
    );
  } else {
    registerSector12NPCVisualProviders();
  }

  const toolsBridge = window.engineToolsBridge;

  if (toolsBridge) {
    const toolsAdapter = Object.freeze({
      getEditorRenderData() {
        return window.foundationEditor3D?.getRenderData?.() ?? null;
      },

      getPerformanceMonitor() {
        return window.editorPerformance3D ?? null;
      },
    });

    if (!toolsBridge.register(toolsAdapter)) {
      console.error(
        "[Sector12SceneAdapter] Tools adapter registration failed.",
      );
    }
  }
})();
