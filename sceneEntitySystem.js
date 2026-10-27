(function () {
  "use strict";

  const EMPTY_ARRAY = Object.freeze([]);

  let playerProvider = null;
  let enemyProvider = null;
  let itemProvider = null;
  let bulletProvider = null;
  let implantProvider = null;

  function setPlayerProvider(provider) {
    if (provider !== null && typeof provider !== "function") {
      console.error(
        "[SceneEntitySystem] Player provider must be a function or null.",
      );

      return false;
    }

    playerProvider = provider;

    return true;
  }

  function setEnemyProvider(provider) {
    if (
      provider !== null &&
      (!provider ||
        typeof provider.getEnemies !== "function" ||
        typeof provider.getRenderData !== "function")
    ) {
      console.error("[SceneEntitySystem] Invalid enemy provider.");
      return false;
    }

    enemyProvider = provider;
    return true;
  }

  function setItemProvider(provider) {
    if (
      provider !== null &&
      (!provider ||
        typeof provider.getItems !== "function" ||
        typeof provider.getRenderData !== "function")
    ) {
      console.error("[SceneEntitySystem] Invalid item provider.");
      return false;
    }

    itemProvider = provider;
    return true;
  }

  function setBulletProvider(provider) {
    if (
      provider !== null &&
      (!provider || typeof provider.getBullets !== "function")
    ) {
      console.error("[SceneEntitySystem] Invalid bullet provider.");
      return false;
    }

    bulletProvider = provider;
    return true;
  }

  function setImplantProvider(provider) {
    if (
      provider !== null &&
      (!provider ||
        typeof provider.getProjectiles !== "function" ||
        typeof provider.getLightningStrikes !== "function" ||
        typeof provider.getTornadoStrikes !== "function")
    ) {
      console.error("[SceneEntitySystem] Invalid implant provider.");
      return false;
    }

    implantProvider = provider;
    return true;
  }

  function getCurrentWorldId() {
    const worldId = window.worldSceneSystem?.getCurrentWorldId?.();

    return Number.isInteger(worldId) ? worldId : null;
  }

  function belongsToWorld(entity, worldId) {
    if (!entity) {
      return false;
    }

    // Если entity пока не содержит worldId,
    // не уничтожаем совместимость со старым кодом.
    if (entity.worldId === undefined || entity.worldId === null) {
      return true;
    }

    return entity.worldId === worldId;
  }

  // ------------------------------------------------------------
  // PLAYERS
  // ------------------------------------------------------------

  function getPlayerSource() {
    if (typeof playerProvider !== "function") {
      return null;
    }

    const source = playerProvider();

    return source instanceof Map ? source : null;
  }

  function getPlayers(worldId = getCurrentWorldId()) {
    const source = getPlayerSource();

    if (!(source instanceof Map) || worldId === null) {
      return EMPTY_ARRAY;
    }

    const result = [];

    source.forEach((player, id) => {
      if (!player || !belongsToWorld(player, worldId)) {
        return;
      }

      result.push({
        id: player.id ?? id,

        x: Number(player.x),
        y: Number(player.y),

        worldId: player.worldId,

        health: Number(player.health),

        direction: player.direction || "down",
        state: player.state || "idle",

        frame: Number.isFinite(player.frame) ? Math.floor(player.frame) : 0,

        attackFrame: Number.isFinite(player.attackFrame)
          ? Math.floor(player.attackFrame)
          : 0,

        source: player,
      });
    });

    return result;
  }

  function getEnemies(worldId = getCurrentWorldId()) {
    const sourceProvider = enemyProvider;

    if (!sourceProvider || worldId === null) {
      return EMPTY_ARRAY;
    }

    const source = sourceProvider.getEnemies();

    if (!(source instanceof Map)) {
      return EMPTY_ARRAY;
    }

    const result = [];

    source.forEach((enemy) => {
      if (!enemy || !belongsToWorld(enemy, worldId)) {
        return;
      }

      const renderData = sourceProvider.getRenderData(enemy);

      if (!renderData) {
        return;
      }

      if (!Number.isFinite(renderData.x) || !Number.isFinite(renderData.y)) {
        return;
      }

      result.push(renderData);
    });

    return result;
  }

  const NPC_VISUAL_PROVIDERS = new Map();

  function registerNPCVisualProvider(id, provider) {
    if (typeof id !== "string" || !id.trim()) {
      return false;
    }

    if (!provider || typeof provider.getRenderData !== "function") {
      return false;
    }

    const uniqueId = id.trim();

    if (NPC_VISUAL_PROVIDERS.has(uniqueId)) {
      return false;
    }

    NPC_VISUAL_PROVIDERS.set(uniqueId, provider);

    return true;
  }

  function unregisterNPCVisualProvider(id) {
    if (typeof id !== "string") {
      return false;
    }

    return NPC_VISUAL_PROVIDERS.delete(id);
  }

  function getRegisteredNPCIds() {
    return Array.from(NPC_VISUAL_PROVIDERS.keys());
  }

  function getNPCs(worldId = getCurrentWorldId()) {
    if (worldId === null) {
      return EMPTY_ARRAY;
    }

    const result = [];

    for (const provider of NPC_VISUAL_PROVIDERS.values()) {
      if (!provider || typeof provider.getRenderData !== "function") {
        continue;
      }

      try {
        const renderData = provider.getRenderData();

        if (
          !renderData ||
          !belongsToWorld(renderData, worldId) ||
          !Number.isFinite(renderData.x) ||
          !Number.isFinite(renderData.y)
        ) {
          continue;
        }

        result.push(renderData);
      } catch (error) {
        console.error(
          "[SceneEntitySystem] NPC visual provider failed:",
          provider,
          error,
        );
      }
    }

    return result;
  }

  function getItems(worldId = getCurrentWorldId()) {
    const sourceProvider = itemProvider;

    if (!sourceProvider || worldId === null) {
      return EMPTY_ARRAY;
    }

    const source = sourceProvider.getItems();

    if (!(source instanceof Map)) {
      return EMPTY_ARRAY;
    }

    const result = [];

    source.forEach((item, itemId) => {
      if (!item || !belongsToWorld(item, worldId)) {
        return;
      }

      const renderData = sourceProvider.getRenderData(item);

      if (!renderData) {
        return;
      }

      if (!Number.isFinite(renderData.x) || !Number.isFinite(renderData.y)) {
        return;
      }

      result.push({
        ...renderData,
        itemId,
        id: itemId,
      });
    });

    return result;
  }

  function getBullets(worldId = getCurrentWorldId()) {
    const sourceProvider = bulletProvider;

    if (!sourceProvider || worldId === null) {
      return EMPTY_ARRAY;
    }

    const source = sourceProvider.getBullets();

    if (!(source instanceof Map)) {
      return EMPTY_ARRAY;
    }

    const result = [];

    source.forEach((bullet) => {
      if (!bullet || !belongsToWorld(bullet, worldId)) {
        return;
      }

      const renderData =
        typeof sourceProvider.getBulletRenderData === "function"
          ? sourceProvider.getBulletRenderData(bullet)
          : bullet;

      if (!renderData) {
        return;
      }

      if (!Number.isFinite(renderData.x) || !Number.isFinite(renderData.y)) {
        return;
      }

      result.push(renderData);
    });

    return result;
  }

  function getImplantProjectiles(worldId = getCurrentWorldId()) {
    const sourceProvider = implantProvider;

    if (!sourceProvider || worldId === null) {
      return EMPTY_ARRAY;
    }

    const source = sourceProvider.getProjectiles();

    if (!Array.isArray(source)) {
      return EMPTY_ARRAY;
    }

    return source.filter((projectile) => {
      if (!projectile) {
        return false;
      }

      if (!Number.isFinite(projectile.x) || !Number.isFinite(projectile.y)) {
        return false;
      }

      return belongsToWorld(projectile, worldId);
    });
  }

  function getLightningStrikes(worldId = getCurrentWorldId()) {
    const source = implantProvider?.getLightningStrikes();

    if (!Array.isArray(source) || worldId === null) {
      return EMPTY_ARRAY;
    }

    return source.filter(
      (strike) =>
        strike &&
        Number.isFinite(strike.x) &&
        Number.isFinite(strike.y) &&
        belongsToWorld(strike, worldId),
    );
  }

  function getTornadoStrikes(worldId = getCurrentWorldId()) {
    const source = implantProvider?.getTornadoStrikes();

    if (!Array.isArray(source) || worldId === null) {
      return EMPTY_ARRAY;
    }

    return source.filter(
      (strike) =>
        strike &&
        Number.isFinite(strike.x) &&
        Number.isFinite(strike.y) &&
        belongsToWorld(strike, worldId),
    );
  }

  const VISUAL_MODES = Object.freeze({
    BILLBOARD: "billboard",
    MODEL_3D: "model3d",
    HIDDEN: "hidden",
  });

  function normalizeVisualEntity(source, category) {
    if (!source || typeof source !== "object") {
      return null;
    }

    if (
      source.id === undefined ||
      source.id === null ||
      !Number.isFinite(source.x) ||
      !Number.isFinite(source.y)
    ) {
      return null;
    }

    const worldId = Number(source.worldId);

    if (!Number.isInteger(worldId)) {
      return null;
    }

    const requestedMode =
      source.visual?.mode ?? source.visualType ?? VISUAL_MODES.BILLBOARD;

    const mode = Object.values(VISUAL_MODES).includes(requestedMode)
      ? requestedMode
      : VISUAL_MODES.BILLBOARD;

    const positive = (value, fallback) =>
      Number.isFinite(value) && value > 0 ? value : fallback;

    const nonNegativeInteger = (value, fallback = 0) =>
      Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;

    const frameSize = positive(source.frameSize, 70);

    const legacyBillboard = {
      sprite: source.sprite ?? null,

      frame: nonNegativeInteger(source.frame),
      row: nonNegativeInteger(source.row),

      frameCount: positive(source.frameCount, 1),

      frameWidth: positive(source.frameWidth, frameSize),
      frameHeight: positive(source.frameHeight, frameSize),

      displayWidth: positive(
        source.displayWidth,
        positive(source.width, frameSize),
      ),

      displayHeight: positive(
        source.displayHeight,
        positive(source.height, frameSize),
      ),
    };

    const billboard = {
      ...legacyBillboard,
      ...(source.visual?.billboard ?? {}),
    };

    // Ограничиваем кадр доступным количеством.
    billboard.frameCount = Math.max(
      1,
      Math.floor(positive(billboard.frameCount, 1)),
    );

    billboard.frame = Math.min(
      billboard.frameCount - 1,
      nonNegativeInteger(billboard.frame),
    );

    billboard.row = nonNegativeInteger(billboard.row);

    const orientation = billboard.orientation;

    if (orientation?.mode === "velocity") {
      billboard.orientation = {
        mode: "velocity",
        vx: Number.isFinite(orientation.vx) ? orientation.vx : 0,
        vy: Number.isFinite(orientation.vy) ? orientation.vy : 0,
        angleOffset: Number.isFinite(orientation.angleOffset)
          ? orientation.angleOffset
          : 0,
      };
    } else {
      billboard.orientation = null;
    }

    return {
      id: source.id,
      type: category,
      subtype: source.type ?? null,

      worldId,

      x: source.x,
      y: source.y,

      elevation:
        Number.isFinite(source.elevation) && source.elevation >= 0
          ? source.elevation
          : Number.isFinite(source.renderHeight)
            ? source.renderHeight
            : 0,

      height: Number.isFinite(source.renderHeight) ? source.renderHeight : 0,

      direction: source.direction ?? "down",
      state: source.state ?? "idle",

      visual: {
        mode,

        billboard,

        model3D: source.visual?.model3D ?? null,
      },
    };
  }

  function normalizeVisualCollection(collection, category) {
    if (!Array.isArray(collection)) {
      return [];
    }

    const result = [];

    for (const entity of collection) {
      const normalized = normalizeVisualEntity(entity, category);

      if (normalized) {
        result.push(normalized);
      }
    }

    return result;
  }

  function resolveEntityVisual(entity, rendererMode = "3d", options = {}) {
    if (!entity || !entity.visual) {
      return null;
    }

    const visual = entity.visual;
    const billboard = visual.billboard ?? null;

    // 2D всегда использует существующий sprite pipeline.
    if (rendererMode === "2d") {
      return {
        entityId: entity.id,
        rendererMode: "2d",
        representation: "sprite2d",
        billboard,
        model3D: null,
        fallbackUsed: false,
      };
    }

    if (rendererMode !== "3d") {
      return null;
    }

    if (visual.mode === VISUAL_MODES.HIDDEN) {
      return {
        entityId: entity.id,
        rendererMode: "3d",
        representation: "hidden",
        billboard: null,
        model3D: null,
        fallbackUsed: false,
      };
    }

    if (visual.mode === VISUAL_MODES.MODEL_3D) {
      const model = visual.model3D;

      const assetUrl =
        typeof model?.assetUrl === "string" ? model.assetUrl.trim() : "";

      // Фактическую готовность GLB проверяет загрузчик.
      // Resolver только принимает результат проверки.
      const isModelReady =
        typeof options.isModelReady === "function" &&
        assetUrl.length > 0 &&
        options.isModelReady(assetUrl, entity) === true;

      if (isModelReady) {
        return {
          entityId: entity.id,
          rendererMode: "3d",
          representation: "model3d",
          billboard: null,
          model3D: model,
          fallbackUsed: false,
        };
      }

      return {
        entityId: entity.id,
        rendererMode: "3d",
        representation: "billboard",
        billboard,
        model3D: null,
        fallbackUsed: true,
      };
    }

    return {
      entityId: entity.id,
      rendererMode: "3d",
      representation: "billboard",
      billboard,
      model3D: null,
      fallbackUsed: false,
    };
  }

  function resolveVisualScene(rendererMode = "3d", options = {}) {
    const scene = getVisualSceneSnapshot();

    const resolveCollection = (collection) =>
      collection.map((entity) => ({
        ...entity,
        resolvedVisual: resolveEntityVisual(entity, rendererMode, options),
      }));

    return {
      worldId: scene.worldId,
      rendererMode,

      enemies: resolveCollection(scene.enemies),
      npcs: resolveCollection(scene.npcs),
    };
  }

  function getVisualSceneSnapshot() {
    const snapshot = getSceneSnapshot();

    return {
      worldId: snapshot.worldId,

      enemies: normalizeVisualCollection(snapshot.enemies, "enemy"),

      npcs: normalizeVisualCollection(snapshot.npcs, "npc"),
    };
  }

  // ------------------------------------------------------------
  // FULL SCENE SNAPSHOT
  // ------------------------------------------------------------

  function getSceneSnapshot() {
    const worldId = getCurrentWorldId();

    if (worldId === null) {
      return {
        worldId: null,

        players: EMPTY_ARRAY,
        enemies: EMPTY_ARRAY,
        npcs: EMPTY_ARRAY,
        items: EMPTY_ARRAY,
        bullets: EMPTY_ARRAY,
        implantProjectiles: EMPTY_ARRAY,

        effects: {
          lightning: EMPTY_ARRAY,
          tornado: EMPTY_ARRAY,
        },
      };
    }

    return {
      worldId,

      players: getPlayers(worldId),
      enemies: getEnemies(worldId),
      npcs: getNPCs(worldId),
      items: getItems(worldId),
      bullets: getBullets(worldId),

      implantProjectiles: getImplantProjectiles(worldId),

      effects: {
        lightning: getLightningStrikes(worldId),
        tornado: getTornadoStrikes(worldId),
      },
    };
  }

  window.sceneEntitySystem = Object.freeze({
    setPlayerProvider,
    setEnemyProvider,
    setItemProvider,
    setBulletProvider,
    setImplantProvider,

    registerNPCVisualProvider,
    unregisterNPCVisualProvider,
    getRegisteredNPCIds,

    getCurrentWorldId,

    getPlayers,
    getEnemies,
    getNPCs,
    getItems,
    getBullets,

    getImplantProjectiles,
    getLightningStrikes,
    getTornadoStrikes,

    getSceneSnapshot,

    VISUAL_MODES,
    normalizeVisualEntity,
    getVisualSceneSnapshot,

    // Universal visual resolver — stage 10.2
    resolveEntityVisual,
    resolveVisualScene,
  });
})();
