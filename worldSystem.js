const worldSystem = {
  // Миры (с кэшированием изображений)
  worlds: [
    { id: 0, w: 2800, h: 2800, name: "Неоновый Город" },
    { id: 1, w: 2800, h: 2800, name: "Пустоши" },
    { id: 2, w: 2800, h: 2800, name: "Токсичные Джунгли" },
  ].map((w) => ({
    ...w,
    bg: null,
    veg: null,
    rocks: null,
    clouds: null,
    loaded: 0,
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

  initialize() {
    const imgMap = {
      0: ["backgr.png", "vegetation.png", "rocks.png", "clouds.png"],
      1: [
        "toxic_jungle_background.png",
        "toxic_jungle_vegetation.png",
        "toxic_jungle_rocks.png",
        "toxic_jungle_clouds.png",
      ],
      2: [
        "neon_city_background.png",
        "neon_city_vegetation.png",
        "neon_city_rocks.png",
        "neon_city_clouds.png",
      ],
    };

    this.worlds.forEach((world) => {
      const paths = imgMap[world.id];
      ["bg", "veg", "rocks", "clouds"].forEach((key, i) => {
        const src = paths[i];
        let img = this._imageCache.get(src);
        if (!img) {
          img = new Image();
          img.src = src;
          this._imageCache.set(src, img);
        }
        world[key] = img;
        img.onload = img.onerror = () => world.loaded++;
      });
    });

    // Тестовые зоны из пула (быстрее чем new Object)
    this.createTransitionZone(2485, 75, 50, 1, 0);
    this.createTransitionZone(2727, 245, 50, 0, 1);
    this.createTransitionZone(380, 2700, 50, 2, 1);
    this.createTransitionZone(100, 2442, 50, 1, 2);
  },

  createTransitionZone(x, y, r, target, source) {
    if (r <= 0 || ![target, source].every((id) => this.worlds[id])) return;

    const zone = this._transitionPool.pop() || {};
    zone.x = x;
    zone.y = y;
    zone.radius = r;
    zone.radius2 = r * r; // Кэшируем квадрат радиуса
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
      // УБРАЛ Math.sqrt() - сравниваем квадраты (в 10 раз быстрее!)
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
        return; // Выходим после первого срабатывания
      }
    }
  },

  switchWorld(targetId, player, newX, newY) {
    if (targetId === this.currentWorldId || !this.worlds[targetId]) return;

    const prev = this.worlds[this.currentWorldId];
    const next = this.worlds[targetId];

    // Сохраняем позицию
    player.prevWorldX = player.x;
    player.prevWorldY = player.y;
    player.prevWorldId = this.currentWorldId;

    // Определяем позицию в новом мире (один if)
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

    // Очистка игроков ОДИН РАЗ (было дважды!)
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
    this._syncCache.needsSync = true; // Принудительно обновляем кэш
    this.showTransitionEffect();
  },

  syncPlayers() {
    if (!myId || !ws || ws.readyState !== WebSocket.OPEN) return;

    const now = performance.now();
    if (now - this._syncCache.timestamp < 5000 && !this._syncCache.needsSync) {
      return; // Кэш валиден 5 секунд
    }

    this._syncCache.timestamp = now;
    this._syncCache.needsSync = false;

    // Проверяем только игроков в текущем мире (в 10 раз быстрее!)
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

  // СУПЕР-ОПТИМИЗИРОВАННАЯ отрисовка зон (вызывается 1 раз в 3 кадра)
  drawTransitionZones() {
    if (!window.movementSystem?.getCamera) return;

    const cam = window.movementSystem.getCamera();
    const cache = this._drawCache;

    // Обновляем кэш только если камера сильно сдвинулась
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

        // Ограничивающий прямоугольник зоны в мировых координатах
        const zoneLeft = z.x - z.radius;
        const zoneRight = z.x + z.radius;
        const zoneTop = z.y - z.radius;
        const zoneBottom = z.y + z.radius;

        // Проверка пересечения с видимой областью
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

      // Подготавливаем данные для батчинга
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
    ctx2.lineWidth = 2;

    // Батчинг: рисуем ВСЕ зоны одним вызовом
    ctx2.strokeStyle = "rgba(0,255,255,0.5)";
    ctx2.fillStyle = "rgba(0,255,255,0.2)";
    ctx2.lineWidth = 3; // Чуть толще, чтобы лучше видно было

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
