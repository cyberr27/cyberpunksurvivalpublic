const worldSystem = {
  // Миры (с кэшированием изображений)
  worlds: [
    { id: 0, w: 4096, h: 4096, name: "Неоновый Город" },
    { id: 1, w: 2688, h: 2688, name: "Пустоши" },
    { id: 2, w: 2688, h: 2688, name: "Токсичные Джунгли" },
    { id: 3, w: 2688, h: 2688, name: "Тренировочная арена" },
    { id: 4, w: 2688, h: 2688, name: "Арена" },
  ].map((w) => ({
    ...w,
  })),

  currentWorldId: 0,
  transitionZones: [],

  // Кэш для оптимизации
  _imageCache: new Map(),
  _transitionPool: [],
  _syncCache: { timestamp: 0, needsSync: true },
  _drawCache: {
    zonesToDraw: [],
    lastCamera: { x: 0, y: 0 },
    batchData: null,
  },

  // === TILEMAP ===
  TILE_SIZE: 128,

  // fallback-значения (используются только для clouds / foreground)
  VEGETATION_TILES_X: 32,
  VEGETATION_TILES_Y: 32,
  vegetationTiles: {},

  FOREGROUND_TILES_X: 32,
  FOREGROUND_TILES_Y: 32,
  foregroundTiles: {},

  ROCKS_TILES_X: 32,
  ROCKS_TILES_Y: 32,
  rocksTiles: {},

  BG_TILES_X: 32,
  BG_TILES_Y: 32,
  bgTiles: {},

  CLOUDS_TILES_X: 15,
  CLOUDS_TILES_Y: 15,
  cloudsTiles: {},

  // Флаги, что мир уже полностью загружен (чтобы не грузить повторно)
  _tilesLoaded: {},

  // Возвращает реальное количество тайлов для конкретного мира
  getTileCount(worldId) {
    const world = this.worlds[worldId];
    if (!world) return { x: 0, y: 0 };
    return {
      x: Math.floor(world.w / this.TILE_SIZE),
      y: Math.floor(world.h / this.TILE_SIZE),
    };
  },

  /**
   * Ленивая загрузка всех слоёв для указанного мира.
   * Безопасно вызывать сколько угодно раз — повторно не грузит.
   */
  ensureTilesLoaded(worldId) {
    if (worldId == null || !this.worlds[worldId]) return;
    if (this._tilesLoaded[worldId]) return;

    this._tilesLoaded[worldId] = true;

    this.loadVegetationTiles(worldId);
    this.loadRocksTiles(worldId);
    this.loadBgTiles(worldId);
    this.loadCloudsTiles(worldId);

    // Foreground существует только в Неоновом Городе
    if (worldId === 0 || worldId === 4) {
      this.loadForegroundTiles(worldId);
    }
  },

  initialize() {
    // Только зоны перехода. Тайлы грузятся лениво при логине / смене мира.
    // Радиус должен совпадать с серверной валидацией, иначе клиент и сервер
    // начинают трактовать границу одного и того же перехода по-разному.
    this.createTransitionZone(2947, 258, 60, 1, 0);
    this.createTransitionZone(2620, 245, 60, 0, 1);
    this.createTransitionZone(380, 2620, 60, 2, 1);
    this.createTransitionZone(100, 2442, 60, 1, 2);
    this.createTransitionZone(2431, 63, 60, 0, 3);
    this.createTransitionZone(1344, 1518, 60, 0, 4);
  },

  loadVegetationTiles(worldId) {
    // Уже есть — не грузим повторно
    if (this.vegetationTiles[worldId]?.length) return;

    const { x: tilesX, y: tilesY } = this.getTileCount(worldId);
    const tiles = [];
    let loaded = 0;
    const total = tilesX * tilesY;

    for (let y = 0; y < tilesY; y++) {
      tiles[y] = [];
      for (let x = 0; x < tilesX; x++) {
        const img = new Image();
        img.src = `tiles/vegetation/${worldId}/tile_${x}_${y}.png`;
        tiles[y][x] = img;

        img.onload = img.onerror = () => {
          loaded++;
          if (loaded === total) {
            console.log(
              `[worldSystem] Vegetation tiles loaded for world ${worldId}: ${total}`,
            );
          }
        };
      }
    }

    this.vegetationTiles[worldId] = tiles;
  },

  drawVegetationTiles(cameraX, cameraY) {
    const worldId = this.currentWorldId;
    const tiles = this.vegetationTiles[worldId];
    if (!tiles || !tiles.length) return;

    const tilesY = tiles.length;
    const tilesX = tiles[0]?.length || 0;

    const tileSize = this.TILE_SIZE;
    const viewLeft = cameraX;
    const viewTop = cameraY;
    const viewRight = cameraX + canvas.width;
    const viewBottom = cameraY + canvas.height;

    const startX = Math.max(0, Math.floor(viewLeft / tileSize) - 1);
    const endX = Math.min(tilesX - 1, Math.ceil(viewRight / tileSize) + 1);
    const startY = Math.max(0, Math.floor(viewTop / tileSize) - 1);
    const endY = Math.min(tilesY - 1, Math.ceil(viewBottom / tileSize) + 1);

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const tile = tiles[y]?.[x];
        if (!tile || !tile.complete) continue;

        const worldX = x * tileSize;
        const worldY = y * tileSize;
        const screenX = worldX - cameraX;
        const screenY = worldY - cameraY;

        ctx.drawImage(tile, screenX, screenY, tileSize, tileSize);
      }
    }
  },

  loadForegroundTiles(worldId) {
    // Только для мира 0 и 4
    if (worldId !== 0 && worldId !== 4) return;
    if (this.foregroundTiles[worldId]?.length) return;

    // Мир 0 — 32×32, мир 4 (Арена) — 21×21 = 441
    let tilesX, tilesY;
    if (worldId === 4) {
      const count = this.getTileCount(worldId);
      tilesX = count.x;
      tilesY = count.y;
    } else {
      tilesX = this.FOREGROUND_TILES_X;
      tilesY = this.FOREGROUND_TILES_Y;
    }

    const tiles = [];
    let loaded = 0;
    const total = tilesX * tilesY;

    for (let y = 0; y < tilesY; y++) {
      tiles[y] = [];
      for (let x = 0; x < tilesX; x++) {
        const img = new Image();
        img.src = `tiles/foreground/${worldId}/tile_${x}_${y}.png`;
        tiles[y][x] = img;

        img.onload = img.onerror = () => {
          loaded++;
          if (loaded === total) {
            console.log(
              `[worldSystem] Foreground tiles loaded for world ${worldId}: ${total}`,
            );
          }
        };
      }
    }

    this.foregroundTiles[worldId] = tiles;
  },

  drawForegroundTiles(cameraX, cameraY) {
    const worldId = this.currentWorldId;
    if (worldId !== 0 && worldId !== 4) return;

    const tiles = this.foregroundTiles[worldId];
    if (!tiles || !tiles.length) return;

    const tilesY = tiles.length;
    const tilesX = tiles[0]?.length || 0;

    const tileSize = this.TILE_SIZE;
    const viewLeft = cameraX;
    const viewTop = cameraY;
    const viewRight = cameraX + canvas.width;
    const viewBottom = cameraY + canvas.height;

    const startX = Math.max(0, Math.floor(viewLeft / tileSize) - 1);
    const endX = Math.min(tilesX - 1, Math.ceil(viewRight / tileSize) + 1);
    const startY = Math.max(0, Math.floor(viewTop / tileSize) - 1);
    const endY = Math.min(tilesY - 1, Math.ceil(viewBottom / tileSize) + 1);

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const tile = tiles[y]?.[x];
        if (!tile || !tile.complete) continue;

        const worldX = x * tileSize;
        const worldY = y * tileSize;
        const screenX = worldX - cameraX;
        const screenY = worldY - cameraY;

        ctx.drawImage(tile, screenX, screenY, tileSize, tileSize);
      }
    }
  },

  loadRocksTiles(worldId) {
    if (this.rocksTiles[worldId]?.length) return;

    const { x: tilesX, y: tilesY } = this.getTileCount(worldId);
    const tiles = [];
    let loaded = 0;
    const total = tilesX * tilesY;

    for (let y = 0; y < tilesY; y++) {
      tiles[y] = [];
      for (let x = 0; x < tilesX; x++) {
        const img = new Image();
        img.src = `tiles/rocks/${worldId}/tile_${x}_${y}.png`;
        tiles[y][x] = img;

        img.onload = img.onerror = () => {
          loaded++;
          if (loaded === total) {
            console.log(
              `[worldSystem] Rocks tiles loaded for world ${worldId}: ${total}`,
            );
          }
        };
      }
    }

    this.rocksTiles[worldId] = tiles;
  },

  drawRocksTiles(cameraX, cameraY) {
    const worldId = this.currentWorldId;
    const tiles = this.rocksTiles[worldId];
    if (!tiles || !tiles.length) return;

    const tilesY = tiles.length;
    const tilesX = tiles[0]?.length || 0;

    // Параллакс только по X (0.5).
    // По Y — полный follow камеры (1.0), чтобы слой не залипал
    // и не ехал с игроком до низа карты.
    const parallaxX = 0.5;
    const parallaxY = 1.0;
    const camX = cameraX * parallaxX;
    const camY = cameraY * parallaxY;

    const tileSize = this.TILE_SIZE;
    const viewLeft = camX;
    const viewTop = camY;
    const viewRight = camX + canvas.width;
    const viewBottom = camY + canvas.height;

    const startX = Math.max(0, Math.floor(viewLeft / tileSize) - 1);
    const endX = Math.min(tilesX - 1, Math.ceil(viewRight / tileSize) + 1);
    const startY = Math.max(0, Math.floor(viewTop / tileSize) - 1);
    const endY = Math.min(tilesY - 1, Math.ceil(viewBottom / tileSize) + 1);

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const tile = tiles[y]?.[x];
        if (!tile || !tile.complete) continue;

        const worldX = x * tileSize;
        const worldY = y * tileSize;
        const screenX = worldX - camX;
        const screenY = worldY - camY;

        ctx.drawImage(tile, screenX, screenY, tileSize, tileSize);
      }
    }
  },

  loadBgTiles(worldId) {
    if (this.bgTiles[worldId]?.length) return;

    const { x: tilesX, y: tilesY } = this.getTileCount(worldId);
    const tiles = [];
    let loaded = 0;
    const total = tilesX * tilesY;

    for (let y = 0; y < tilesY; y++) {
      tiles[y] = [];
      for (let x = 0; x < tilesX; x++) {
        const img = new Image();
        img.src = `tiles/bg/${worldId}/tile_${x}_${y}.png`;
        tiles[y][x] = img;

        img.onload = img.onerror = () => {
          loaded++;
          if (loaded === total) {
            console.log(
              `[worldSystem] BG tiles loaded for world ${worldId}: ${total}`,
            );
          }
        };
      }
    }

    this.bgTiles[worldId] = tiles;
  },

  drawBgTiles(cameraX, cameraY) {
    const worldId = this.currentWorldId;
    const tiles = this.bgTiles[worldId];
    if (!tiles || !tiles.length) return;

    const tilesY = tiles.length;
    const tilesX = tiles[0]?.length || 0;

    // Параллакс как было (groundSpeed = 1.0)
    const parallax = 1.0;
    const camX = cameraX * parallax;
    const camY = cameraY * parallax;

    const tileSize = this.TILE_SIZE;
    const viewLeft = camX;
    const viewTop = camY;
    const viewRight = camX + canvas.width;
    const viewBottom = camY + canvas.height;

    const startX = Math.max(0, Math.floor(viewLeft / tileSize) - 1);
    const endX = Math.min(tilesX - 1, Math.ceil(viewRight / tileSize) + 1);
    const startY = Math.max(0, Math.floor(viewTop / tileSize) - 1);
    const endY = Math.min(tilesY - 1, Math.ceil(viewBottom / tileSize) + 1);

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const tile = tiles[y]?.[x];
        if (!tile || !tile.complete) continue;

        const worldX = x * tileSize;
        const worldY = y * tileSize;
        const screenX = worldX - camX;
        const screenY = worldY - camY;

        ctx.drawImage(tile, screenX, screenY, tileSize, tileSize);
      }
    }
  },

  loadCloudsTiles(worldId) {
    if (this.cloudsTiles[worldId]?.length) return;

    const tiles = [];
    let loaded = 0;
    const total = this.CLOUDS_TILES_X * this.CLOUDS_TILES_Y;

    for (let y = 0; y < this.CLOUDS_TILES_Y; y++) {
      tiles[y] = [];
      for (let x = 0; x < this.CLOUDS_TILES_X; x++) {
        const img = new Image();
        img.src = `tiles/clouds/${worldId}/tile_${x}_${y}.png`;
        tiles[y][x] = img;

        img.onload = img.onerror = () => {
          loaded++;
          if (loaded === total) {
            console.log(
              `[worldSystem] Clouds tiles loaded for world ${worldId}: ${total}`,
            );
          }
        };
      }
    }

    this.cloudsTiles[worldId] = tiles;
  },

  drawCloudsTiles(cameraX, cameraY) {
    const worldId = this.currentWorldId;
    const tiles = this.cloudsTiles[worldId];
    if (!tiles || !tiles.length) return;

    const tilesY = tiles.length;
    const tilesX = tiles[0]?.length || 0;

    // Параллакс как было (cloudsSpeed = 0.3)
    const parallax = 0.3;
    const camX = cameraX * parallax;
    const camY = cameraY * parallax;

    const tileSize = this.TILE_SIZE;
    const viewLeft = camX;
    const viewTop = camY;
    const viewRight = camX + canvas.width;
    const viewBottom = camY + canvas.height;

    const startX = Math.max(0, Math.floor(viewLeft / tileSize) - 1);
    const endX = Math.min(tilesX - 1, Math.ceil(viewRight / tileSize) + 1);
    const startY = Math.max(0, Math.floor(viewTop / tileSize) - 1);
    const endY = Math.min(tilesY - 1, Math.ceil(viewBottom / tileSize) + 1);

    for (let y = startY; y <= endY; y++) {
      for (let x = startX; x <= endX; x++) {
        const tile = tiles[y]?.[x];
        if (!tile || !tile.complete) continue;

        const worldX = x * tileSize;
        const worldY = y * tileSize;
        const screenX = worldX - camX;
        const screenY = worldY - camY;

        ctx.drawImage(tile, screenX, screenY, tileSize, tileSize);
      }
    }
  },

  createTransitionZone(x, y, r, target, source) {
    if (r <= 0 || ![target, source].every((id) => this.worlds[id])) return;

    const zone = this._transitionPool.pop() || {};
    zone.x = x;
    zone.y = y;
    zone.radius = r;
    zone.radius2 = r * r;
    zone.targetWorldId = target;
    zone.sourceWorldId = source;
    this.transitionZones.push(zone);
  },

  checkTransitionZones(px, py) {
    if (!players.has(myId)) return;

    const zones = this.transitionZones;
    const current = this.currentWorldId;
    const len = zones.length;

    for (let i = 0; i < len; i++) {
      const z = zones[i];
      if (z.sourceWorldId !== current) continue;

      const dx = px - z.x;
      const dy = py - z.y;
      if (dx * dx + dy * dy < z.radius2) {
        sendWhenReady(
          ws,
          JSON.stringify({
            type: "worldTransition",
            targetWorldId: z.targetWorldId,
            x: px,
            y: py,
          }),
        );
        return;
      }
    }
  },

  switchWorld(targetId, player, newX, newY) {
    if (targetId === this.currentWorldId || !this.worlds[targetId]) return;

    // === ЛЕНИВАЯ ЗАГРУЗКА ТАЙЛОВ НОВОГО МИРА ===
    this.ensureTilesLoaded(targetId);

    const prev = this.worlds[this.currentWorldId];
    const next = this.worlds[targetId];

    // Сохраняем позицию
    player.prevWorldX = player.x;
    player.prevWorldY = player.y;
    player.prevWorldId = this.currentWorldId;

    // Определяем позицию в новом мире
    if (newX !== undefined && newY !== undefined) {
      player.x = newX;
      player.y = newY;
    } else {
      const saved = player.worldPositions?.[targetId];
      player.x = saved?.x ?? next.w >> 1;
      player.y = saved?.y ?? next.h >> 1;
    }

    // Сохраняем
    (player.worldPositions ??= {})[targetId] = { x: player.x, y: player.y };
    player.worldId = targetId;
    this.currentWorldId = targetId;

    // Синхронизируем локальный baseline с авторитетной точкой спавна.
    player.lastConfirmedPosition = { x: player.x, y: player.y };
    player.lastMoveTime = Date.now();
    player.positionHistory = [];

    // Очистка игроков ОДИН РАЗ
    if (myId) {
      const keep = new Map();
      players.forEach((p, id) => {
        if (id === myId || p.worldId === targetId) {
          keep.set(id, { ...p, frameTime: 0 });
        }
      });
      players.clear();
      keep.forEach((p, id) => players.set(id, p));
    }

    window.lightsSystem.reset(targetId);
    this._syncCache.needsSync = true;

    if (window.soundSystem) {
      window.soundSystem.setWorld(targetId);
    }

    this.showTransitionEffect();
  },

  syncPlayers() {
    if (!myId || !ws || ws.readyState !== WebSocket.OPEN) return;

    const now = performance.now();
    if (now - this._syncCache.timestamp < 5000 && !this._syncCache.needsSync) {
      return;
    }

    this._syncCache.timestamp = now;
    this._syncCache.needsSync = false;

    let hasOthers = false;
    for (const [id, p] of players) {
      if (id !== myId && p.worldId === this.currentWorldId) {
        hasOthers = true;
        break;
      }
    }

    if (!hasOthers) {
      sendWhenReady(
        ws,
        JSON.stringify({
          type: "syncPlayers",
          worldId: this.currentWorldId,
        }),
      );
    }
  },

  getCurrentWorld() {
    return this.worlds[this.currentWorldId];
  },

  showTransitionEffect() {
    const el = document.createElement("div");
    Object.assign(el.style, {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      background: "rgba(0,0,0,0)",
      zIndex: "1000",
      transition: "background 1s",
      pointerEvents: "none",
    });
    document.body.appendChild(el);

    requestAnimationFrame(() => (el.style.background = "rgba(0,0,0,1)"));
    setTimeout(() => (el.style.background = "rgba(0,0,0,0)"), 1000);
    setTimeout(() => el.remove(), 2000);
  },

  drawTransitionZones() {
    if (!window.movementSystem?.getCamera) return;

    const cam = window.movementSystem.getCamera();
    const cache = this._drawCache;

    if (
      Math.abs(cam.x - cache.lastCamera.x) > 50 ||
      Math.abs(cam.y - cache.lastCamera.y) > 50 ||
      cache.zonesToDraw.length === 0
    ) {
      cache.lastCamera = { x: cam.x, y: cam.y };
      cache.zonesToDraw.length = 0;

      const viewLeft = cam.x;
      const viewRight = cam.x + canvas.width;
      const viewTop = cam.y;
      const viewBottom = cam.y + canvas.height;

      for (const z of this.transitionZones) {
        if (z.sourceWorldId !== this.currentWorldId) continue;

        const zoneLeft = z.x - z.radius;
        const zoneRight = z.x + z.radius;
        const zoneTop = z.y - z.radius;
        const zoneBottom = z.y + z.radius;

        if (
          zoneRight >= viewLeft &&
          zoneLeft <= viewRight &&
          zoneBottom >= viewTop &&
          zoneTop <= viewBottom
        ) {
          const screenX = z.x - cam.x;
          const screenY = z.y - cam.y;
          cache.zonesToDraw.push(screenX, screenY, z.radius);
        }
      }

      if (cache.zonesToDraw.length) {
        cache.batchData ??= [];
        const data = cache.batchData;
        data.length = 0;
        for (let i = 0; i < cache.zonesToDraw.length; i += 3) {
          const x = cache.zonesToDraw[i];
          const y = cache.zonesToDraw[i + 1];
          const r = cache.zonesToDraw[i + 2];
          data.push(x - r, y - r, x + r, y - r, x + r, y + r, x - r, y + r);
        }
      }
    }

    if (!cache.batchData?.length) return;

    const ctx2 = ctx;
    ctx2.strokeStyle = "rgba(0,255,255,0.5)";
    ctx2.fillStyle = "rgba(0,255,255,0.2)";
    ctx2.lineWidth = 3;

    for (let i = 0; i < cache.zonesToDraw.length; i += 3) {
      const screenX = cache.zonesToDraw[i];
      const screenY = cache.zonesToDraw[i + 1];
      const radius = cache.zonesToDraw[i + 2];

      ctx2.beginPath();
      ctx2.arc(screenX, screenY, radius, 0, Math.PI * 2);
      ctx2.fill();
      ctx2.stroke();
    }
  },
};

window.worldSystem = worldSystem;
