//rendererSystem.setMode("3d")

(function () {
  "use strict";

  const EXPERIMENTAL_3D = {
    enabled: false,
    gl: null,
    canvas: null,
    program: null,
    uniforms: null,
    attributeLocations: null,

    groundTile: null,
    cube: null,
    editorBarrierMeshes: null,
    billboard: null,
    bulletNormal: null,
    bulletHighDamage: null,
    axes: null,

    implantAimCircle: null,

    groundTextures: new Map(),
    groundChunks: new Map(),
    groundChunkEnabled: true,
    groundChunkDrawCalls: 0,
    groundFallbackDrawCalls: 0,
    groundTextureWorldId: -1,

    playerTextures: {
      walking: null,
      attack: null,
    },

    playerTextureImages: {
      walking: null,
      attack: null,
    },

    enemyTextures: new Map(),
    enemyTextureImages: new Map(),

    itemTextures: new Map(),
    itemTextureImages: new Map(),

    implantTextures: new Map(),
    implantTextureImages: new Map(),

    modelAssets: new Map(),

    playerJointTextures: new Map(),

    yaw: -Math.PI / 2,
    pitch: 0.52,
    distance: 280,

    MIN_CAMERA_DISTANCE: 140,
    MAX_CAMERA_DISTANCE: 1200,

    FOV_Y: (60 * Math.PI) / 180,
    NEAR: 0.1,
    FAR: 5000,

    target: [0, 0, 0],
    position: [0, 0, 0],

    orbiting: false,

    lastPointer: {
      x: 0,
      y: 0,
    },

    lastFrameTime: 0,

    GROUND_TEXTURE_Y: 0,
    GROUND_TILE_PADDING: 5,
    MAX_GROUND_TILE_RADIUS: 18,
  };

  const GROUND_CHUNK_TILES = 4;
  const GROUND_CHUNK_MAX_TILE_PIXELS = 512;

  const GROUND_CHUNK_DIAGNOSTICS = {
    hits: 0,
    builds: 0,
    notReady: 0,
    replacements: 0,
    lastReport: performance.now(),
  };

  const GLTF_LIGHTING = Object.freeze({
    ambient: 0.78,
    directional: 0.22,
    direction: [0.39, 0.868, 0.304],
  });

  const GLTF_MATERIAL_LIGHTING = {
    mode: "legacy",
    metallicRoughnessTextureUnit: 3,
    normalTextureUnit: 4,
    emissiveTextureUnit: 5,
  };

  const DEBUG_PLAYER_GL_ERRORS = false;

  const SHADOW_CONFIG = Object.freeze({
    enabled: true,
    mapSize: 1024,
    textureUnit: 2,
    radius: 450,
    lightDistance: 700,
    depthRange: 1600,
    strength: 0.42,
    bias: 0.0015,
    cacheStep: 64,
  });

  const SHADOW_MAP = {
    gl: null,
    framebuffer: null,
    depthTexture: null,
    vao: null,
    program: null,
    locations: null,
    lightMatrix: null,
    ready: false,
    failed: false,
    depthPassReady: false,
    drawCalls: 0,
    cacheKey: null,
    cacheHits: 0,
    cacheMisses: 0,
  };

  const GPU_TIMER_CONFIG = Object.freeze({
    sampleEveryFrames: 8,
    maxPendingQueries: 3,
  });

  function getRenderCanvas(mode = "3d") {
    return window.engineSceneBridge?.getRenderCanvas?.(mode) ?? null;
  }

  function getEditorRenderData() {
    return window.engineToolsBridge?.getEditorRenderData?.() ?? null;
  }

  function getPerformanceMonitor() {
    return window.engineToolsBridge?.getPerformanceMonitor?.() ?? null;
  }

  const GPU_TIMER = {
    gl: null,
    extension: null,
    supported: false,
    activeQuery: null,
    pendingQueries: [],
    currentFrame: null,
    frameCounter: 0,
    samples: 0,
    lastMs: null,
    lastStagesMs: {},
    disjointCount: 0,
  };

  function deleteGpuTimerFrame(gl, frame) {
    if (!gl || !frame) return;

    for (const entry of frame.queries) {
      if (entry.query) gl.deleteQuery(entry.query);
    }

    frame.queries.length = 0;
  }

  function resetGpuTimer(gl = null) {
    const previousGl = GPU_TIMER.gl;

    if (previousGl) {
      if (GPU_TIMER.activeQuery) {
        if (!previousGl.isContextLost() && GPU_TIMER.extension) {
          try {
            previousGl.endQuery(GPU_TIMER.extension.TIME_ELAPSED_EXT);
          } catch (_) {}
        }
        GPU_TIMER.activeQuery = null;
      }

      deleteGpuTimerFrame(previousGl, GPU_TIMER.currentFrame);

      for (const frame of GPU_TIMER.pendingQueries) {
        deleteGpuTimerFrame(previousGl, frame);
      }
    }

    GPU_TIMER.gl = gl;
    GPU_TIMER.extension =
      gl && !gl.isContextLost()
        ? gl.getExtension("EXT_disjoint_timer_query_webgl2")
        : null;

    GPU_TIMER.supported = Boolean(GPU_TIMER.extension);
    GPU_TIMER.activeQuery = null;
    GPU_TIMER.pendingQueries.length = 0;
    GPU_TIMER.currentFrame = null;
    GPU_TIMER.frameCounter = 0;
    GPU_TIMER.samples = 0;
    GPU_TIMER.lastMs = null;
    GPU_TIMER.lastStagesMs = {};
    GPU_TIMER.disjointCount = 0;

    getPerformanceMonitor()?.setGpuTimerSupported?.(GPU_TIMER.supported);
    getPerformanceMonitor()?.setGpuStages?.({});
  }

  function discardGpuTimerResults() {
    const gl = GPU_TIMER.gl;

    if (!gl) return;

    deleteGpuTimerFrame(gl, GPU_TIMER.currentFrame);

    for (const frame of GPU_TIMER.pendingQueries) {
      deleteGpuTimerFrame(gl, frame);
    }

    GPU_TIMER.activeQuery = null;
    GPU_TIMER.currentFrame = null;
    GPU_TIMER.pendingQueries.length = 0;
    GPU_TIMER.lastMs = null;
    GPU_TIMER.lastStagesMs = {};
    GPU_TIMER.disjointCount++;

    getPerformanceMonitor()?.setGpuStages?.({});
  }

  function pollGpuTimer() {
    const gl = GPU_TIMER.gl;
    const extension = GPU_TIMER.extension;

    if (!gl || !extension || gl.isContextLost()) return;

    if (gl.getParameter(extension.GPU_DISJOINT_EXT)) {
      discardGpuTimerResults();
      return;
    }

    while (GPU_TIMER.pendingQueries.length > 0) {
      const frame = GPU_TIMER.pendingQueries[0];

      let ready = true;

      for (const entry of frame.queries) {
        if (!gl.getQueryParameter(entry.query, gl.QUERY_RESULT_AVAILABLE)) {
          ready = false;
          break;
        }
      }

      if (!ready) break;

      if (gl.getParameter(extension.GPU_DISJOINT_EXT)) {
        discardGpuTimerResults();
        return;
      }

      const stages = Object.create(null);
      let totalMs = 0;
      let valid = true;

      for (const entry of frame.queries) {
        const nanoseconds = gl.getQueryParameter(entry.query, gl.QUERY_RESULT);

        const milliseconds = nanoseconds / 1000000;

        if (!Number.isFinite(milliseconds) || milliseconds < 0) {
          valid = false;
          break;
        }

        stages[entry.name] = (stages[entry.name] ?? 0) + milliseconds;

        totalMs += milliseconds;
      }

      if (gl.getParameter(extension.GPU_DISJOINT_EXT)) {
        discardGpuTimerResults();
        return;
      }

      GPU_TIMER.pendingQueries.shift();
      deleteGpuTimerFrame(gl, frame);

      if (!valid) continue;

      GPU_TIMER.lastMs = totalMs;
      GPU_TIMER.lastStagesMs = { ...stages };
      GPU_TIMER.samples++;

      getPerformanceMonitor()?.setGpuFrameTime?.(totalMs);
      getPerformanceMonitor()?.setGpuStages?.(stages);
    }
  }

  function beginGpuTimer() {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl) return;

    if (GPU_TIMER.gl !== gl) {
      resetGpuTimer(gl);
    }

    if (!GPU_TIMER.supported || gl.isContextLost()) return;

    GPU_TIMER.frameCounter++;

    if (
      GPU_TIMER.frameCounter % GPU_TIMER_CONFIG.sampleEveryFrames !== 0 ||
      GPU_TIMER.pendingQueries.length >= GPU_TIMER_CONFIG.maxPendingQueries ||
      GPU_TIMER.currentFrame
    ) {
      return;
    }

    GPU_TIMER.currentFrame = {
      queries: [],
    };
  }

  function beginGpuStage(name) {
    const gl = GPU_TIMER.gl;
    const extension = GPU_TIMER.extension;
    const frame = GPU_TIMER.currentFrame;

    if (
      !gl ||
      !extension ||
      !frame ||
      GPU_TIMER.activeQuery ||
      gl.isContextLost()
    ) {
      return;
    }

    const query = gl.createQuery();

    if (!query) return;

    try {
      gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
    } catch (error) {
      gl.deleteQuery(query);
      throw error;
    }

    const entry = { name, query };

    frame.queries.push(entry);
    GPU_TIMER.activeQuery = entry;
  }

  function endGpuStage() {
    const gl = GPU_TIMER.gl;
    const extension = GPU_TIMER.extension;
    const entry = GPU_TIMER.activeQuery;

    if (!entry) return;

    GPU_TIMER.activeQuery = null;

    if (!gl || !extension || gl.isContextLost()) return;

    gl.endQuery(extension.TIME_ELAPSED_EXT);
  }

  function endGpuTimer() {
    const gl = GPU_TIMER.gl;
    const frame = GPU_TIMER.currentFrame;

    if (!frame) return;

    if (GPU_TIMER.activeQuery) {
      endGpuStage();
    }

    GPU_TIMER.currentFrame = null;

    if (!gl || gl.isContextLost()) {
      if (gl) deleteGpuTimerFrame(gl, frame);
      return;
    }

    if (frame.queries.length === 0) {
      deleteGpuTimerFrame(gl, frame);
      return;
    }

    GPU_TIMER.pendingQueries.push(frame);
  }

  const STATIC_MODEL_CULLING = {
    enabled: true,
    worldId: 0,
    planes: null,
  };

  const STATIC_MODEL_LOD = {
    enabled: true,
    hysteresis: 35,
    states: new Map(),
    switches: 0,
  };

  const STATIC_MODEL_FRAME = {
    prepared: false,
    worldId: null,
    source: null,
    objects: [],
  };

  const PLAYER_WALK_FRAME_WIDTH = 120;
  const PLAYER_WALK_FRAME_HEIGHT = 120;
  const PLAYER_WALK_FRAME_COUNT = 16;

  const PLAYER_ATTACK_FRAME_WIDTH = 120;
  const PLAYER_ATTACK_FRAME_HEIGHT = 120;
  const PLAYER_ATTACK_FRAME_COUNT = 13;

  const PLAYER_VISUAL =
    window.engineSceneBridge?.getPlayerVisualConfig?.() ?? null;

  if (!PLAYER_VISUAL) {
    throw new Error(
      "[3D Renderer] Player visual configuration is unavailable.",
    );
  }

  const BULLET_CHEST_HEIGHT_RATIO = 0.55;

  const BULLET_RENDER_HEIGHT =
    PLAYER_VISUAL.model3D.targetHeight * BULLET_CHEST_HEIGHT_RATIO;

  const PLAYER_MODEL_AXIS_ROTATION_X = PLAYER_VISUAL.model3D.axisRotationX;
  const PLAYER_MODEL_YAW_OFFSET = PLAYER_VISUAL.model3D.yawOffset;
  const PLAYER_MODEL_ENABLE_SKINNING = PLAYER_VISUAL.model3D.enableSkinning;

  const ENEMY_RENDER_Y = 1.25;
  const VACUUM_RENDER_Y_OFFSET = -15;

  const ENEMY_RENDER_WIDTH = 70;
  const ENEMY_RENDER_HEIGHT = 70;

  const ENEMY_CENTER_OFFSET_X = 35;
  const ENEMY_FEET_OFFSET_Z = 70;

  const EDITOR_BARRIER_HEIGHT = 2;
  const EDITOR_BARRIER_WIDTH = 3.5;
  const EDITOR_FOUNDATION_WIDTH = 3;
  const EDITOR_JOIN_TOLERANCE = 1.5;
  const EDITOR_JOIN_TOLERANCE_SQ =
    EDITOR_JOIN_TOLERANCE * EDITOR_JOIN_TOLERANCE;
  const EDITOR_IDENTITY_MATRIX = new Float32Array([
    1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
  ]);

  const ITEM_RENDER_Y = 1.0;

  const ITEM_RENDER_WIDTH = 20;
  const ITEM_RENDER_HEIGHT = 20;

  const ITEM_CENTER_OFFSET_X = 10;
  const ITEM_FEET_OFFSET_Z = 20;

  const ATOM_RENDER_WIDTH = 50;
  const ATOM_RENDER_HEIGHT = 50;

  const ATOM_CENTER_OFFSET_X = 25;
  const ATOM_FEET_OFFSET_Z = 50;

  const FIREBALL_FRAME_WIDTH = 32;
  const FIREBALL_FRAME_HEIGHT = 32;
  const FIREBALL_FRAME_COUNT = 12;
  const FIREBALL_FRAME_DURATION = 60;

  const FIREBALL_RENDER_WIDTH = 32;
  const FIREBALL_RENDER_HEIGHT = 32;
  const FIREBALL_RENDER_Y = 10;

  const TORNADO_FRAME_WIDTH = 200;
  const TORNADO_FRAME_HEIGHT = 200;
  const TORNADO_FRAME_COUNT = 13;
  const TORNADO_FRAME_DURATION = 120;

  const TORNADO_RENDER_WIDTH = 220;
  const TORNADO_RENDER_HEIGHT = 150;
  const TORNADO_RENDER_Y = 1.25;

  const LIGHTNING_FRAME_WIDTH = 64;
  const LIGHTNING_FRAME_HEIGHT = 256;
  const LIGHTNING_FRAME_COUNT = 13;
  const LIGHTNING_FRAME_DURATION = 120;

  const LIGHTNING_RENDER_WIDTH = 92;
  const LIGHTNING_RENDER_HEIGHT = 265;
  const LIGHTNING_RENDER_Y = 1.25;

  const PLAYER_DIRECTION_VECTORS = Object.freeze({
    up: [0, -1],
    "up-right": [1, -1],
    right: [1, 0],
    "down-right": [1, 1],
    down: [0, 1],
    "down-left": [-1, 1],
    left: [-1, 0],
    "up-left": [-1, -1],
  });

  const orbitPlayerFacing = new Map();

  const ORBIT_FACING_MIN_DISTANCE = 0.001;
  const ORBIT_FACING_MAX_FRAME_DISTANCE = 100;

  function getOrbitMovementDirection(playerState) {
    if (!playerState || playerState.playerId == null) {
      return playerState?.direction || "down";
    }

    const playerId = playerState.playerId;
    const x = playerState.x;
    const y = playerState.y;

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return playerState.direction || "down";
    }

    let cached = orbitPlayerFacing.get(playerId);

    if (!cached) {
      cached = {
        x,
        y,
        direction: playerState.direction || "down",
      };

      orbitPlayerFacing.set(playerId, cached);

      return cached.direction;
    }

    const dx = x - cached.x;
    const dy = y - cached.y;

    cached.x = x;
    cached.y = y;

    const distance = Math.hypot(dx, dy);

    // Стоим на месте — сохраняем последнее направление.
    if (distance <= ORBIT_FACING_MIN_DISTANCE) {
      return cached.direction;
    }

    // Резкая смена координат (телепорт/смена мира) не должна
    // восприниматься как направление обычной ходьбы.
    if (distance > ORBIT_FACING_MAX_FRAME_DISTANCE) {
      cached.direction = playerState.direction || cached.direction;
      return cached.direction;
    }

    const angle = Math.atan2(dy, dx);

    const directions = [
      "right",
      "down-right",
      "down",
      "down-left",
      "left",
      "up-left",
      "up",
      "up-right",
    ];

    const normalizedAngle = (angle + Math.PI * 2) % (Math.PI * 2);

    const directionIndex =
      Math.floor((normalizedAngle + Math.PI / 8) / (Math.PI / 4)) % 8;

    cached.direction = directions[directionIndex];

    return cached.direction;
  }

  const SCREEN_DIRECTION_ORDER = Object.freeze([
    "right",
    "down-right",
    "down",
    "down-left",
    "left",
    "up-left",
    "up",
    "up-right",
  ]);

  const PLAYER_SPRITE_ROW_INDEX = Object.freeze({
    down: 0,
    "down-right": 1,
    right: 2,
    "up-right": 3,
    up: 4,
    "up-left": 5,
    left: 6,
    "down-left": 7,
  });

  const Vec3 = {
    subtract(a, b) {
      return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    },

    cross(a, b) {
      return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ];
    },

    normalize(vec) {
      const len = Math.hypot(vec[0], vec[1], vec[2]);

      if (len < 0.000001) {
        return [0, 0, 0];
      }

      return [vec[0] / len, vec[1] / len, vec[2] / len];
    },

    dot(a, b) {
      return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    },
  };

  const Mat4 = {
    identity() {
      return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    },

    orthographic(left, right, bottom, top, near, far) {
      const width = right - left;
      const height = top - bottom;
      const depth = far - near;

      if (
        Math.abs(width) < 0.000001 ||
        Math.abs(height) < 0.000001 ||
        Math.abs(depth) < 0.000001
      ) {
        return this.identity();
      }

      return new Float32Array([
        2 / width,
        0,
        0,
        0,
        0,
        2 / height,
        0,
        0,
        0,
        0,
        -2 / depth,
        0,
        -(right + left) / width,
        -(top + bottom) / height,
        -(far + near) / depth,
        1,
      ]);
    },

    perspective(fovY, aspect, near, far) {
      const f = 1.0 / Math.tan(fovY / 2);
      const nf = 1 / (near - far);

      return new Float32Array([
        f / aspect,
        0,
        0,
        0,

        0,
        f,
        0,
        0,

        0,
        0,
        (far + near) * nf,
        -1,

        0,
        0,
        2 * far * near * nf,
        0,
      ]);
    },

    translation(x, y, z) {
      return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
    },

    scaling(x, y, z) {
      return new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);
    },

    rotationY(angle) {
      const c = Math.cos(angle);
      const s = Math.sin(angle);

      return new Float32Array([
        c,
        0,
        s,
        0,

        0,
        1,
        0,
        0,

        -s,
        0,
        c,
        0,

        0,
        0,
        0,
        1,
      ]);
    },

    rotationX(angle) {
      const c = Math.cos(angle);
      const s = Math.sin(angle);

      return new Float32Array([
        1,
        0,
        0,
        0,

        0,
        c,
        s,
        0,

        0,
        -s,
        c,
        0,

        0,
        0,
        0,
        1,
      ]);
    },

    fromQuaternion(x, y, z, w) {
      const x2 = x + x;
      const y2 = y + y;
      const z2 = z + z;

      const xx = x * x2;
      const xy = x * y2;
      const xz = x * z2;

      const yy = y * y2;
      const yz = y * z2;
      const zz = z * z2;

      const wx = w * x2;
      const wy = w * y2;
      const wz = w * z2;

      return new Float32Array([
        1 - (yy + zz),
        xy + wz,
        xz - wy,
        0,

        xy - wz,
        1 - (xx + zz),
        yz + wx,
        0,

        xz + wy,
        yz - wx,
        1 - (xx + yy),
        0,

        0,
        0,
        0,
        1,
      ]);
    },

    rotationZ(angle) {
      const c = Math.cos(angle);
      const s = Math.sin(angle);

      return new Float32Array([
        c,
        s,
        0,
        0,

        -s,
        c,
        0,
        0,

        0,
        0,
        1,
        0,

        0,
        0,
        0,
        1,
      ]);
    },

    multiply(a, b) {
      const out = new Float32Array(16);

      for (let col = 0; col < 4; col++) {
        for (let row = 0; row < 4; row++) {
          let value = 0;

          for (let k = 0; k < 4; k++) {
            value += a[k * 4 + row] * b[col * 4 + k];
          }

          out[col * 4 + row] = value;
        }
      }

      return out;
    },

    lookAt(eye, center, up) {
      const forward = Vec3.normalize(Vec3.subtract(center, eye));

      let right = Vec3.normalize(Vec3.cross(forward, up));

      if (
        Math.abs(right[0]) < 0.000001 &&
        Math.abs(right[1]) < 0.000001 &&
        Math.abs(right[2]) < 0.000001
      ) {
        right = [1, 0, 0];
      }

      const correctedUp = Vec3.normalize(Vec3.cross(right, forward));

      return new Float32Array([
        right[0],
        correctedUp[0],
        -forward[0],
        0,

        right[1],
        correctedUp[1],
        -forward[1],
        0,

        right[2],
        correctedUp[2],
        -forward[2],
        0,

        -Vec3.dot(right, eye),
        -Vec3.dot(correctedUp, eye),
        Vec3.dot(forward, eye),
        1,
      ]);
    },
  };

  function getBillboardFacingRotation3D(worldX, worldY, worldZ) {
    const cameraPosition = EXPERIMENTAL_3D.position;
    const cameraTarget = EXPERIMENTAL_3D.target;

    // Используем направление самой камеры,
    // а не положение отдельного объекта.
    const dx = cameraPosition[0] - cameraTarget[0];
    const dy = cameraPosition[1] - cameraTarget[1];
    const dz = cameraPosition[2] - cameraTarget[2];

    const horizontalDistance = Math.hypot(dx, dz);

    if (horizontalDistance < 0.000001) {
      return Mat4.rotationX(-Math.PI / 2);
    }

    const yaw = -Math.atan2(dx, dz);
    const pitch = -Math.atan2(dy, horizontalDistance);

    return Mat4.multiply(Mat4.rotationY(yaw), Mat4.rotationX(pitch));
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);

      console.error("[3D] Shader compile error\n", info, "\nSource:\n", source);

      gl.deleteShader(shader);

      return null;
    }

    return shader;
  }

  function createProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);

    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) {
      return null;
    }

    const program = gl.createProgram();

    gl.attachShader(program, vertexShader);

    gl.attachShader(program, fragmentShader);

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);

      console.error("[3D] Program link error\n", info);

      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);

      return null;
    }

    gl.detachShader(program, vertexShader);

    gl.detachShader(program, fragmentShader);

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    return program;
  }

  function buildGroundTileMesh() {
    return {
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1]),

      colors: new Float32Array([
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      ]),

      uvs: new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]),

      indices: new Uint16Array([0, 1, 2, 1, 3, 2]),
    };
  }

  function buildCubeMesh() {
    const positions = new Float32Array([
      -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,

      -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1, -1,

      -1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1,

      1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1,

      -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1,

      -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1,
    ]);

    const faceColors = [
      [0.95, 0.15, 0.12, 1],
      [0.1, 0.7, 0.95, 1],
      [0.72, 0.22, 0.95, 1],
      [0.25, 0.95, 0.25, 1],
      [1.0, 0.85, 0.15, 1],
      [1.0, 0.45, 0.1, 1],
    ];

    const colors = [];
    const uvs = [];

    for (const color of faceColors) {
      for (let i = 0; i < 4; i++) {
        colors.push(...color);
      }

      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    }

    return {
      positions,

      colors: new Float32Array(colors),

      uvs: new Float32Array(uvs),

      indices: new Uint16Array([
        0, 1, 2, 0, 2, 3,

        4, 5, 6, 4, 6, 7,

        8, 9, 10, 8, 10, 11,

        12, 13, 14, 12, 14, 15,

        16, 17, 18, 16, 18, 19,

        20, 21, 22, 20, 22, 23,
      ]),
    };
  }

  function buildBillboardMesh() {
    return {
      positions: new Float32Array([
        -0.5, 0, 0, 0.5, 0, 0, -0.5, 1, 0, 0.5, 1, 0,
      ]),

      colors: new Float32Array([
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      ]),

      uvs: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),

      indices: new Uint16Array([0, 1, 2, 1, 3, 2]),
    };
  }

  function buildBulletMesh(color) {
    const [r, g, b, a] = color;

    const positions = new Float32Array([
      -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,

      -1, -1, -1, -1, 1, -1, 1, 1, -1, 1, -1, -1,

      -1, -1, 1, -1, 1, 1, -1, 1, -1, -1, -1, -1,

      1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1, 1,

      -1, 1, 1, 1, 1, 1, 1, 1, -1, -1, 1, -1,

      -1, -1, 1, -1, -1, -1, 1, -1, -1, 1, -1, 1,
    ]);

    const colors = new Float32Array(24 * 4);

    for (let i = 0; i < 24; i++) {
      const offset = i * 4;

      colors[offset] = r;
      colors[offset + 1] = g;
      colors[offset + 2] = b;
      colors[offset + 3] = a;
    }

    const uvs = new Float32Array(24 * 2);

    const indices = new Uint16Array([
      0, 1, 2, 0, 2, 3,

      4, 5, 6, 4, 6, 7,

      8, 9, 10, 8, 10, 11,

      12, 13, 14, 12, 14, 15,

      16, 17, 18, 16, 18, 19,

      20, 21, 22, 20, 22, 23,
    ]);

    return {
      positions,
      colors,
      uvs,
      indices,
    };
  }

  function buildImplantAimCircleMesh(segments = 96) {
    const safeSegments = Math.max(16, Math.floor(segments));

    const positions = new Float32Array(safeSegments * 3);

    const colors = new Float32Array(safeSegments * 4);

    for (let i = 0; i < safeSegments; i++) {
      const angle = (i / safeSegments) * Math.PI * 2;

      const positionOffset = i * 3;

      positions[positionOffset] = Math.cos(angle);

      positions[positionOffset + 1] = 0;

      positions[positionOffset + 2] = Math.sin(angle);

      const colorOffset = i * 4;

      colors[colorOffset] = 0.78;
      colors[colorOffset + 1] = 0.78;
      colors[colorOffset + 2] = 0.78;
      colors[colorOffset + 3] = 0.9;
    }

    return {
      positions,
      colors,
      count: safeSegments,
    };
  }

  function buildAxesMesh() {
    return {
      positions: new Float32Array([
        0, 0, 0, 120, 0, 0,

        0, 0, 0, 0, 120, 0,

        0, 0, 0, 0, 0, 120,
      ]),

      colors: new Float32Array([
        1, 0, 0, 1, 1, 0, 0, 1,

        0, 1, 0, 1, 0, 1, 0, 1,

        0, 0.45, 1, 1, 0, 0.45, 1, 1,
      ]),

      count: 6,
    };
  }

  function bindMesh(gl, mesh) {
    gl.bindVertexArray(null);

    const posBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);

    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);

    const colorBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);

    gl.bufferData(gl.ARRAY_BUFFER, mesh.colors, gl.STATIC_DRAW);

    const uvBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);

    gl.bufferData(
      gl.ARRAY_BUFFER,
      mesh.uvs || new Float32Array((mesh.positions.length / 3) * 2),
      gl.STATIC_DRAW,
    );

    const indexBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

    return {
      posBuffer,
      colorBuffer,
      uvBuffer,
      indexBuffer,
      count: mesh.indices.length,
    };
  }

  function createEditorRibbonMesh(gl) {
    const posBuffer = gl.createBuffer();

    if (!posBuffer) {
      return null;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, 0, gl.DYNAMIC_DRAW);

    return {
      gl,
      posBuffer,
      vertexCount: 0,
      capacityBytes: 0,
      sourceCoordinates: new Float64Array(0),
    };
  }

  function bindGltfPrimitive(gl, primitive) {
    if (!gl || !primitive || !primitive.positions || !primitive.indices) {
      return null;
    }

    gl.bindVertexArray(null);

    const posBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);

    gl.bufferData(gl.ARRAY_BUFFER, primitive.positions, gl.STATIC_DRAW);

    let normalBuffer = null;

    if (
      primitive.normals &&
      primitive.normals.length === primitive.positions.length
    ) {
      normalBuffer = gl.createBuffer();

      gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);

      gl.bufferData(
        gl.ARRAY_BUFFER,
        primitive.normals instanceof Float32Array
          ? primitive.normals
          : new Float32Array(primitive.normals),
        gl.STATIC_DRAW,
      );
    }

    const colorBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);

    gl.bufferData(gl.ARRAY_BUFFER, primitive.colors, gl.STATIC_DRAW);

    const uvBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);

    gl.bufferData(gl.ARRAY_BUFFER, primitive.uvs, gl.STATIC_DRAW);

    let jointBuffer = null;
    let weightBuffer = null;

    if (primitive.joints && primitive.weights) {
      jointBuffer = gl.createBuffer();

      gl.bindBuffer(gl.ARRAY_BUFFER, jointBuffer);

      gl.bufferData(gl.ARRAY_BUFFER, primitive.joints, gl.STATIC_DRAW);

      const gpuWeights =
        primitive.weights instanceof Float32Array
          ? primitive.weights
          : new Float32Array(primitive.weights);

      weightBuffer = gl.createBuffer();

      gl.bindBuffer(gl.ARRAY_BUFFER, weightBuffer);

      gl.bufferData(gl.ARRAY_BUFFER, gpuWeights, gl.STATIC_DRAW);
    }

    const indexBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, primitive.indices, gl.STATIC_DRAW);

    let indexType = null;

    if (primitive.indices instanceof Uint32Array) {
      indexType = gl.UNSIGNED_INT;
    } else if (primitive.indices instanceof Uint16Array) {
      indexType = gl.UNSIGNED_SHORT;
    } else if (primitive.indices instanceof Uint8Array) {
      indexType = gl.UNSIGNED_BYTE;
    } else {
      console.error(
        "[3D] Unsupported glTF index array type.",
        primitive.indices,
      );

      return null;
    }

    return {
      gl,
      vao: null,
      skinnedVao: null,

      posBuffer,
      normalBuffer,
      colorBuffer,
      uvBuffer,
      hasTexCoord0: primitive.hasTexCoord0 === true,

      jointBuffer,
      weightBuffer,

      jointComponentType:
        primitive.joints instanceof Uint8Array
          ? gl.UNSIGNED_BYTE
          : primitive.joints instanceof Uint16Array
            ? gl.UNSIGNED_SHORT
            : null,

      indexBuffer,

      count: primitive.indices.length,

      indexType,

      isSkinned: Boolean(jointBuffer) && Boolean(weightBuffer),

      material: primitive.material,
    };
  }

  const gltfBaseColorTextureCache = new WeakMap();

  function getOrCreateGltfBaseColorTexture(image) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !image) {
      return null;
    }

    const cached = gltfBaseColorTextureCache.get(image);

    if (cached?.gl === gl) {
      return cached.texture;
    }

    const texture = createTextureFromBitmap(image);

    if (!texture) {
      return null;
    }

    gltfBaseColorTextureCache.set(image, {
      gl,
      texture,
    });

    return texture;
  }

  const gltfMetallicRoughnessTextureCache = new WeakMap();

  function getOrCreateGltfMetallicRoughnessTexture(image) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !image) {
      return null;
    }

    const cached = gltfMetallicRoughnessTextureCache.get(image);

    if (cached?.gl === gl) {
      return cached.texture;
    }

    const previousActiveTexture = gl.getParameter(gl.ACTIVE_TEXTURE);

    let texture = null;

    try {
      gl.activeTexture(
        gl.TEXTURE0 + GLTF_MATERIAL_LIGHTING.metallicRoughnessTextureUnit,
      );

      texture = createTextureFromBitmap(image);
    } finally {
      gl.activeTexture(previousActiveTexture);
    }

    if (!texture) {
      return null;
    }

    gltfMetallicRoughnessTextureCache.set(image, {
      gl,
      texture,
    });

    return texture;
  }

  function bindGltfMetallicRoughnessTexture(material) {
    const gl = EXPERIMENTAL_3D.gl;
    const uniforms = EXPERIMENTAL_3D.uniforms;

    const enabled =
      GLTF_MATERIAL_LIGHTING.mode === "pbr" &&
      Boolean(material?.metallicRoughnessImage);

    const texture = enabled
      ? getOrCreateGltfMetallicRoughnessTexture(material.metallicRoughnessImage)
      : null;

    gl.activeTexture(
      gl.TEXTURE0 + GLTF_MATERIAL_LIGHTING.metallicRoughnessTextureUnit,
    );

    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.uniform1i(
      uniforms.metallicRoughnessTexture,
      GLTF_MATERIAL_LIGHTING.metallicRoughnessTextureUnit,
    );

    gl.uniform1i(uniforms.hasMetallicRoughnessTexture, texture ? 1 : 0);

    gl.activeTexture(gl.TEXTURE0);
  }

  const gltfNormalTextureCache = new WeakMap();

  function getOrCreateGltfNormalTexture(image) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !image) {
      return null;
    }

    const cached = gltfNormalTextureCache.get(image);

    if (cached?.gl === gl) {
      return cached.texture;
    }

    const previousActiveTexture = gl.getParameter(gl.ACTIVE_TEXTURE);
    let texture = null;

    try {
      gl.activeTexture(gl.TEXTURE0 + GLTF_MATERIAL_LIGHTING.normalTextureUnit);

      texture = createTextureFromBitmap(image);
    } finally {
      gl.activeTexture(previousActiveTexture);
    }

    if (!texture) {
      return null;
    }

    gltfNormalTextureCache.set(image, {
      gl,
      texture,
    });

    return texture;
  }

  function bindGltfNormalTexture(material, hasTexCoord0) {
    const gl = EXPERIMENTAL_3D.gl;
    const uniforms = EXPERIMENTAL_3D.uniforms;

    const enabled =
      GLTF_MATERIAL_LIGHTING.mode === "pbr" &&
      hasTexCoord0 === true &&
      Boolean(material?.normalImage);

    const texture = enabled
      ? getOrCreateGltfNormalTexture(material.normalImage)
      : null;

    gl.activeTexture(gl.TEXTURE0 + GLTF_MATERIAL_LIGHTING.normalTextureUnit);

    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.uniform1i(
      uniforms.normalTexture,
      GLTF_MATERIAL_LIGHTING.normalTextureUnit,
    );

    gl.uniform1i(uniforms.hasNormalTexture, texture ? 1 : 0);

    gl.uniform1f(
      uniforms.normalScale,
      Number.isFinite(material?.normalScale)
        ? Math.max(0, material.normalScale)
        : 1,
    );

    gl.activeTexture(gl.TEXTURE0);
  }

  const gltfEmissiveTextureCache = new WeakMap();

  function getOrCreateGltfEmissiveTexture(image) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !image || gl.isContextLost()) {
      return null;
    }

    const cached = gltfEmissiveTextureCache.get(image);

    if (cached?.gl === gl) {
      return cached.texture;
    }

    const previousActiveTexture = gl.getParameter(gl.ACTIVE_TEXTURE);
    let texture = null;

    try {
      gl.activeTexture(
        gl.TEXTURE0 + GLTF_MATERIAL_LIGHTING.emissiveTextureUnit,
      );

      texture = createTextureFromBitmap(image);
    } finally {
      gl.activeTexture(previousActiveTexture);
    }

    if (!texture) {
      return null;
    }

    gltfEmissiveTextureCache.set(image, {
      gl,
      texture,
    });

    return texture;
  }

  function bindGltfEmissiveTexture(material, hasTexCoord0) {
    const gl = EXPERIMENTAL_3D.gl;
    const uniforms = EXPERIMENTAL_3D.uniforms;

    const factor = material?.emissiveFactor || [0, 0, 0];

    const enabled = GLTF_MATERIAL_LIGHTING.mode === "pbr";

    const hasEmission = enabled && factor.some((value) => value > 0);

    const texture =
      hasEmission && hasTexCoord0 === true && material?.emissiveImage
        ? getOrCreateGltfEmissiveTexture(material.emissiveImage)
        : null;

    gl.activeTexture(gl.TEXTURE0 + GLTF_MATERIAL_LIGHTING.emissiveTextureUnit);

    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.uniform1i(
      uniforms.emissiveTexture,
      GLTF_MATERIAL_LIGHTING.emissiveTextureUnit,
    );

    gl.uniform1i(uniforms.hasEmissiveTexture, texture ? 1 : 0);

    gl.uniform3f(
      uniforms.emissiveFactor,
      hasEmission ? factor[0] : 0,
      hasEmission ? factor[1] : 0,
      hasEmission ? factor[2] : 0,
    );

    gl.activeTexture(gl.TEXTURE0);
  }

  function createGltfGpuMaterial(material) {
    if (!material) {
      return {
        baseColorTexture: null,
        doubleSided: false,
        alphaMode: "OPAQUE",
        alphaCutoff: 0.5,
        baseColorFactor: [1, 1, 1, 1],
        normalImage: null,
        normalScale: 1,
        metallicRoughnessImage: null,
        metallicFactor: 1,
        roughnessFactor: 1,
        emissiveFactor: [0, 0, 0],
        emissiveImage: null,
      };
    }

    return {
      baseColorTexture: getOrCreateGltfBaseColorTexture(
        material.baseColorImage,
      ),

      doubleSided: material.doubleSided === true,

      alphaMode: ["OPAQUE", "MASK", "BLEND"].includes(material.alphaMode)
        ? material.alphaMode
        : "OPAQUE",

      alphaCutoff: Number.isFinite(material.alphaCutoff)
        ? Math.max(0, Math.min(1, material.alphaCutoff))
        : 0.5,

      normalImage: material.normalImage || null,

      normalScale: Number.isFinite(material.normalScale)
        ? Math.max(0, material.normalScale)
        : 1,

      metallicRoughnessImage: material.metallicRoughnessImage || null,

      baseColorFactor:
        Array.isArray(material.baseColorFactor) &&
        material.baseColorFactor.length === 4 &&
        material.baseColorFactor.every(Number.isFinite)
          ? material.baseColorFactor.map((value) =>
              Math.max(0, Math.min(1, value)),
            )
          : [1, 1, 1, 1],

      metallicFactor: Number.isFinite(material.metallicFactor)
        ? Math.max(0, Math.min(1, material.metallicFactor))
        : 1,

      roughnessFactor: Number.isFinite(material.roughnessFactor)
        ? Math.max(0, Math.min(1, material.roughnessFactor))
        : 1,

      emissiveFactor:
        Array.isArray(material.emissiveFactor) &&
        material.emissiveFactor.length === 3 &&
        material.emissiveFactor.every(Number.isFinite)
          ? material.emissiveFactor.map((value) =>
              Math.max(0, Math.min(1, value)),
            )
          : [0, 0, 0],

      emissiveImage: material.emissiveImage || null,
    };
  }

  function createGltfGpuAsset(asset) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !asset) {
      return null;
    }

    const meshes = asset.meshes.map((mesh) => {
      const primitives = mesh.primitives
        .map((primitive) => {
          const gpuPrimitive = bindGltfPrimitive(gl, primitive);

          if (!gpuPrimitive) {
            return null;
          }

          return {
            ...gpuPrimitive,

            material: createGltfGpuMaterial(primitive.material),
          };
        })
        .filter(Boolean);

      return {
        name: mesh.name,
        primitives,
      };
    });

    const bounds = calculateGltfAssetBounds(asset);

    return {
      sourceAsset: asset,

      meshes,

      bounds,
    };
  }

  function getOrCreateGltfGpuAsset(assetUrl) {
    const gltfAssetSystem3D = window.gltfAssetSystem3D;

    if (!gltfAssetSystem3D || typeof assetUrl !== "string" || !assetUrl) {
      return null;
    }

    const cached = EXPERIMENTAL_3D.modelAssets.get(assetUrl);

    if (cached) {
      return cached;
    }

    const asset = gltfAssetSystem3D.get(assetUrl);

    if (!asset) {
      if (gltfAssetSystem3D.getStatus(assetUrl) === "missing") {
        gltfAssetSystem3D.preload(assetUrl);
      }

      return null;
    }

    const gpuAsset = createGltfGpuAsset(asset);

    if (!gpuAsset) {
      return null;
    }

    EXPERIMENTAL_3D.modelAssets.set(assetUrl, gpuAsset);

    console.log(`[3D] GPU model created: ${assetUrl}`);

    return gpuAsset;
  }

  function buildGltfNodeLocalMatrix(transform) {
    if (Array.isArray(transform?.matrix) && transform.matrix.length === 16) {
      return new Float32Array(transform.matrix);
    }

    const translation = Array.isArray(transform?.translation)
      ? transform.translation
      : [0, 0, 0];

    const rotation = Array.isArray(transform?.rotation)
      ? transform.rotation
      : [0, 0, 0, 1];

    const scale = Array.isArray(transform?.scale) ? transform.scale : [1, 1, 1];

    const translationMatrix = Mat4.translation(
      translation[0] || 0,
      translation[1] || 0,
      translation[2] || 0,
    );

    const rotationMatrix = Mat4.fromQuaternion(
      rotation[0] || 0,
      rotation[1] || 0,
      rotation[2] || 0,
      Number.isFinite(rotation[3]) ? rotation[3] : 1,
    );

    const scaleMatrix = Mat4.scaling(
      Number.isFinite(scale[0]) ? scale[0] : 1,

      Number.isFinite(scale[1]) ? scale[1] : 1,

      Number.isFinite(scale[2]) ? scale[2] : 1,
    );

    return Mat4.multiply(
      Mat4.multiply(translationMatrix, rotationMatrix),
      scaleMatrix,
    );
  }

  function transformPointByMat4(matrix, x, y, z) {
    return [
      matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],

      matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],

      matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
    ];
  }

  function calculateGltfNodeBounds(asset, nodeIndex, parentMatrix, bounds) {
    const node = asset?.nodes?.[nodeIndex];

    if (!node) {
      return;
    }

    const localMatrix = buildGltfNodeLocalMatrix(node.transform);

    const nodeMatrix = Mat4.multiply(parentMatrix, localMatrix);

    if (Number.isInteger(node.mesh)) {
      const mesh = asset.meshes?.[node.mesh];

      if (mesh) {
        for (const primitive of mesh.primitives || []) {
          const positions = primitive?.positions;

          if (!positions) {
            continue;
          }

          for (let i = 0; i + 2 < positions.length; i += 3) {
            const transformed = transformPointByMat4(
              nodeMatrix,
              positions[i],
              positions[i + 1],
              positions[i + 2],
            );

            const x = transformed[0];
            const y = transformed[1];
            const z = transformed[2];

            if (
              !Number.isFinite(x) ||
              !Number.isFinite(y) ||
              !Number.isFinite(z)
            ) {
              continue;
            }

            bounds.minX = Math.min(bounds.minX, x);
            bounds.minY = Math.min(bounds.minY, y);
            bounds.minZ = Math.min(bounds.minZ, z);

            bounds.maxX = Math.max(bounds.maxX, x);
            bounds.maxY = Math.max(bounds.maxY, y);
            bounds.maxZ = Math.max(bounds.maxZ, z);
          }
        }
      }
    }

    for (const childIndex of node.children || []) {
      calculateGltfNodeBounds(asset, childIndex, nodeMatrix, bounds);
    }
  }

  function calculateGltfAssetBounds(asset) {
    if (!asset) {
      return null;
    }

    const bounds = {
      minX: Infinity,
      minY: Infinity,
      minZ: Infinity,

      maxX: -Infinity,
      maxY: -Infinity,
      maxZ: -Infinity,
    };

    const identity = Mat4.identity();

    for (const rootNodeIndex of asset.rootNodes || []) {
      calculateGltfNodeBounds(asset, rootNodeIndex, identity, bounds);
    }

    if (
      !Number.isFinite(bounds.minX) ||
      !Number.isFinite(bounds.minY) ||
      !Number.isFinite(bounds.minZ) ||
      !Number.isFinite(bounds.maxX) ||
      !Number.isFinite(bounds.maxY) ||
      !Number.isFinite(bounds.maxZ)
    ) {
      return null;
    }

    return Object.freeze({
      minX: bounds.minX,
      minY: bounds.minY,
      minZ: bounds.minZ,

      maxX: bounds.maxX,
      maxY: bounds.maxY,
      maxZ: bounds.maxZ,

      width: bounds.maxX - bounds.minX,

      height: bounds.maxY - bounds.minY,

      depth: bounds.maxZ - bounds.minZ,
    });
  }

  function getPlayerModelBounds(gpuAsset) {
    const bounds = gpuAsset?.bounds;

    if (!bounds) {
      return null;
    }

    const height = bounds.maxZ - bounds.minZ;

    const width = bounds.maxX - bounds.minX;

    const depth = bounds.maxY - bounds.minY;

    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      !Number.isFinite(depth) ||
      width <= 0 ||
      height <= 0 ||
      depth <= 0
    ) {
      return null;
    }

    return {
      width,
      height,
      depth,

      minY: bounds.minZ,

      maxY: bounds.maxZ,

      sourceBounds: bounds,
    };
  }

  const transparentGltfDrawQueue = [];

  let transparentGltfViewMatrix = null;
  let transparentGltfSequence = 0;

  function getGltfAlphaMode(material) {
    if (material?.alphaMode === "MASK") return 1;
    if (material?.alphaMode === "BLEND") return 2;
    return 0;
  }

  function applyGltfMaterialUniforms(material, hasTexCoord0 = false) {
    const gl = EXPERIMENTAL_3D.gl;
    const uniforms = EXPERIMENTAL_3D.uniforms;

    const factor = material?.baseColorFactor || [1, 1, 1, 1];

    gl.uniform1i(uniforms.alphaMode, getGltfAlphaMode(material));
    gl.uniform1f(uniforms.alphaCutoff, material?.alphaCutoff ?? 0.5);

    gl.uniform4f(
      uniforms.baseColorFactor,
      factor[0],
      factor[1],
      factor[2],
      factor[3],
    );

    const usePbr = GLTF_MATERIAL_LIGHTING.mode === "pbr";

    gl.uniform1i(uniforms.usePbr, usePbr ? 1 : 0);

    gl.uniform1f(
      uniforms.metallicFactor,
      Number.isFinite(material?.metallicFactor) ? material.metallicFactor : 1,
    );

    gl.uniform1f(
      uniforms.roughnessFactor,
      Number.isFinite(material?.roughnessFactor) ? material.roughnessFactor : 1,
    );

    bindGltfMetallicRoughnessTexture(material);
    bindGltfNormalTexture(material, hasTexCoord0);
    bindGltfEmissiveTexture(material, hasTexCoord0);
  }

  function restoreLegacyMaterialUniforms() {
    const gl = EXPERIMENTAL_3D.gl;
    const uniforms = EXPERIMENTAL_3D.uniforms;

    gl.uniform1i(uniforms.alphaMode, 3);
    gl.uniform1f(uniforms.alphaCutoff, 0.5);
    gl.uniform4f(uniforms.baseColorFactor, 1, 1, 1, 1);

    gl.uniform1i(uniforms.usePbr, 0);
    gl.uniform1i(uniforms.hasMetallicRoughnessTexture, 0);
    gl.uniform1f(uniforms.metallicFactor, 1);
    gl.uniform1f(uniforms.roughnessFactor, 1);

    gl.uniform1i(uniforms.hasNormalTexture, 0);
    gl.uniform1f(uniforms.normalScale, 1);

    gl.uniform1i(uniforms.hasEmissiveTexture, 0);
    gl.uniform3f(uniforms.emissiveFactor, 0, 0, 0);
  }

  function getGltfCameraDepth(modelMatrix) {
    const view = transparentGltfViewMatrix;

    if (!view) return 0;

    const x = modelMatrix[12];
    const y = modelMatrix[13];
    const z = modelMatrix[14];

    return -(view[2] * x + view[6] * y + view[10] * z + view[14]);
  }

  function queueTransparentGltfDraw(modelMatrix, draw) {
    transparentGltfDrawQueue.push({
      depth: getGltfCameraDepth(modelMatrix),
      sequence: transparentGltfSequence++,
      draw,
    });
  }

  function flushTransparentGltfDrawQueue() {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || transparentGltfDrawQueue.length === 0) {
      transparentGltfDrawQueue.length = 0;
      transparentGltfViewMatrix = null;
      return;
    }

    transparentGltfDrawQueue.sort(
      (a, b) => b.depth - a.depth || a.sequence - b.sequence,
    );

    try {
      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(false);

      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(
        gl.SRC_ALPHA,
        gl.ONE_MINUS_SRC_ALPHA,
        gl.ONE,
        gl.ONE_MINUS_SRC_ALPHA,
      );

      for (const entry of transparentGltfDrawQueue) {
        entry.draw();
      }
    } finally {
      transparentGltfDrawQueue.length = 0;
      transparentGltfViewMatrix = null;

      gl.depthMask(true);
      gl.enable(gl.DEPTH_TEST);

      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.BLEND);
      gl.disable(gl.CULL_FACE);

      restoreLegacyMaterialUniforms();
    }
  }

  function setGltfLighting(enabled) {
    const gl = EXPERIMENTAL_3D.gl;

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.useLighting, enabled ? 1 : 0);
  }

  function drawGltfPrimitive3D(primitive, modelMatrix, deferred = false) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !primitive) {
      return;
    }

    const material = primitive.material || null;
    const alphaMode = getGltfAlphaMode(material);

    if (alphaMode === 2 && !deferred) {
      queueTransparentGltfDraw(modelMatrix, () => {
        drawGltfPrimitive3D(primitive, modelMatrix, true);
      });
      return;
    }

    const texture = material?.baseColorTexture || null;

    const previousCull = gl.isEnabled(gl.CULL_FACE);
    const previousBlend = gl.isEnabled(gl.BLEND);

    try {
      if (material?.doubleSided) {
        gl.disable(gl.CULL_FACE);
      }

      if (alphaMode !== 2) {
        gl.disable(gl.BLEND);
      } else {
        gl.enable(gl.BLEND);
      }

      applyGltfMaterialUniforms(material, primitive.hasTexCoord0);
      setGltfLighting(Boolean(primitive.normalBuffer));

      if (texture) {
        gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 1);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(EXPERIMENTAL_3D.uniforms.texture, 0);
        gl.uniform4f(EXPERIMENTAL_3D.uniforms.uvRect, 0, 0, 1, 1);
      } else {
        gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 0);
        gl.bindTexture(gl.TEXTURE_2D, null);
      }

      gl.uniform1i(EXPERIMENTAL_3D.uniforms.useSkinning, 0);

      const vao = getOrCreateGltfVao(primitive);

      if (vao) {
        gl.bindVertexArray(vao);

        const attributes = EXPERIMENTAL_3D.attributeLocations;

        if (attributes.normal >= 0 && !primitive.normalBuffer) {
          gl.vertexAttrib3f(attributes.normal, 0, 1, 0);
        }

        if (attributes.joints >= 0) {
          gl.vertexAttribI4ui(attributes.joints, 0, 0, 0, 0);
        }

        if (attributes.weights >= 0) {
          gl.vertexAttrib4f(attributes.weights, 1, 0, 0, 0);
        }
      } else {
        bindIndexedMeshForDraw(primitive);
      }

      gl.uniformMatrix4fv(EXPERIMENTAL_3D.uniforms.model, false, modelMatrix);

      trackedDrawElements(
        gl.TRIANGLES,
        primitive.count,
        primitive.indexType,
        0,
      );
    } finally {
      gl.bindVertexArray(null);

      restoreLegacyMaterialUniforms();
      setGltfLighting(false);

      if (previousCull) {
        gl.enable(gl.CULL_FACE);
      } else {
        gl.disable(gl.CULL_FACE);
      }

      if (previousBlend) {
        gl.enable(gl.BLEND);
      } else {
        gl.disable(gl.BLEND);
      }
    }
  }

  function drawGltfNode3D(gpuAsset, nodeIndex, parentMatrix) {
    const asset = gpuAsset?.sourceAsset;

    const node = asset?.nodes?.[nodeIndex];

    if (!node) {
      return;
    }

    const localMatrix = buildGltfNodeLocalMatrix(node.transform);

    const worldMatrix = Mat4.multiply(parentMatrix, localMatrix);

    if (Number.isInteger(node.mesh)) {
      const mesh = gpuAsset.meshes?.[node.mesh];

      if (mesh) {
        for (const primitive of mesh.primitives) {
          drawGltfPrimitive3D(primitive, worldMatrix, false);
        }
      }
    }

    for (const childIndex of node.children || []) {
      drawGltfNode3D(gpuAsset, childIndex, worldMatrix);
    }
  }

  function extractStaticModelFrustumPlanes(projection, view) {
    const matrix = Mat4.multiply(projection, view);
    const planes = [];

    for (const [sign, axis] of [
      [1, 0],
      [-1, 0],
      [1, 1],
      [-1, 1],
      [1, 2],
      [-1, 2],
    ]) {
      const plane = [
        matrix[3] + sign * matrix[axis],
        matrix[7] + sign * matrix[axis + 4],
        matrix[11] + sign * matrix[axis + 8],
        matrix[15] + sign * matrix[axis + 12],
      ];

      const length = Math.hypot(plane[0], plane[1], plane[2]);

      if (!Number.isFinite(length) || length < 1e-8) {
        return null;
      }

      planes.push(plane.map((value) => value / length));
    }

    return planes;
  }

  const STATIC_MODEL_BOUNDS_CACHE = new WeakMap();

  function getStaticModelWorldBounds(geometry, gpuAsset) {
    const bounds = gpuAsset?.bounds;

    if (!bounds || !geometry) {
      return null;
    }

    const cacheable = Object.isFrozen(geometry);

    if (cacheable) {
      const cached = STATIC_MODEL_BOUNDS_CACHE.get(geometry);

      if (cached?.gpuAsset === gpuAsset) {
        return cached.worldBounds;
      }
    }

    const values = [
      bounds.minX,
      bounds.minY,
      bounds.minZ,
      bounds.maxX,
      bounds.maxY,
      bounds.maxZ,
      geometry.x,
      geometry.y,
    ];

    if (!values.every(Number.isFinite)) {
      return null;
    }

    const scaleX = Number.isFinite(geometry.scaleX) ? geometry.scaleX : 1;

    const scaleY = Number.isFinite(geometry.scaleY) ? geometry.scaleY : 1;

    const scaleZ = Number.isFinite(geometry.scaleZ) ? geometry.scaleZ : 1;

    const rotation = Number.isFinite(geometry.rotation) ? geometry.rotation : 0;

    const baseHeight = Number.isFinite(geometry.baseHeight)
      ? geometry.baseHeight
      : 0;

    const groundOffset = Number.isFinite(geometry.groundOffset)
      ? geometry.groundOffset
      : 0;

    const groundAlignmentOffset =
      geometry.groundAlign !== false ? -bounds.minY * scaleY : 0;

    const renderPosition = window.coordinateSystem3D?.gameToRenderPosition?.(
      geometry.x,
      geometry.y,
      baseHeight + groundOffset + groundAlignmentOffset,
    );

    if (!renderPosition) {
      return null;
    }

    const matrix = Mat4.multiply(
      Mat4.multiply(
        Mat4.translation(
          renderPosition[0],
          renderPosition[1],
          renderPosition[2],
        ),
        Mat4.rotationY(rotation),
      ),
      Mat4.scaling(scaleX, scaleY, scaleZ),
    );

    const centerX = (bounds.minX + bounds.maxX) * 0.5;
    const centerY = (bounds.minY + bounds.maxY) * 0.5;
    const centerZ = (bounds.minZ + bounds.maxZ) * 0.5;

    const halfX = (bounds.maxX - bounds.minX) * 0.5;
    const halfY = (bounds.maxY - bounds.minY) * 0.5;
    const halfZ = (bounds.maxZ - bounds.minZ) * 0.5;

    const center = [
      matrix[0] * centerX +
        matrix[4] * centerY +
        matrix[8] * centerZ +
        matrix[12],
      matrix[1] * centerX +
        matrix[5] * centerY +
        matrix[9] * centerZ +
        matrix[13],
      matrix[2] * centerX +
        matrix[6] * centerY +
        matrix[10] * centerZ +
        matrix[14],
    ];

    const extents = [
      Math.abs(matrix[0]) * halfX +
        Math.abs(matrix[4]) * halfY +
        Math.abs(matrix[8]) * halfZ,
      Math.abs(matrix[1]) * halfX +
        Math.abs(matrix[5]) * halfY +
        Math.abs(matrix[9]) * halfZ,
      Math.abs(matrix[2]) * halfX +
        Math.abs(matrix[6]) * halfY +
        Math.abs(matrix[10]) * halfZ,
    ];

    if (![...center, ...extents].every(Number.isFinite)) {
      return null;
    }

    const worldBounds = { center, extents };

    if (cacheable) {
      STATIC_MODEL_BOUNDS_CACHE.set(geometry, {
        gpuAsset,
        worldBounds,
      });
    }

    return worldBounds;
  }

  function isStaticModelOutsideFrustum(bounds, planes) {
    if (!bounds || !planes) {
      return false;
    }

    const { center, extents } = bounds;

    for (const plane of planes) {
      const distance =
        plane[0] * center[0] +
        plane[1] * center[1] +
        plane[2] * center[2] +
        plane[3];

      const radius =
        Math.abs(plane[0]) * extents[0] +
        Math.abs(plane[1]) * extents[1] +
        Math.abs(plane[2]) * extents[2];

      if (distance + radius < -0.001) {
        return true;
      }
    }

    return false;
  }

  const STATIC_MODEL_DRAW_COST_CACHE = new WeakMap();

  function getStaticModelDrawCost(gpuAsset) {
    if (!gpuAsset?.sourceAsset) {
      return { drawCalls: 0, triangles: 0 };
    }

    const cached = STATIC_MODEL_DRAW_COST_CACHE.get(gpuAsset);

    if (cached) {
      return cached;
    }

    const asset = gpuAsset.sourceAsset;
    const result = { drawCalls: 0, triangles: 0 };

    function visit(nodeIndex) {
      const node = asset.nodes?.[nodeIndex];

      if (!node) return;

      if (Number.isInteger(node.mesh)) {
        const mesh = gpuAsset.meshes?.[node.mesh];

        for (const primitive of mesh?.primitives ?? []) {
          if (!Number.isFinite(primitive.count)) continue;

          result.drawCalls++;
          result.triangles += Math.floor(primitive.count / 3);
        }
      }

      for (const childIndex of node.children ?? []) {
        visit(childIndex);
      }
    }

    for (const rootIndex of asset.rootNodes ?? []) {
      visit(rootIndex);
    }

    STATIC_MODEL_DRAW_COST_CACHE.set(gpuAsset, result);

    return result;
  }

  function getStaticModelLodDistance(geometry) {
    const camera = EXPERIMENTAL_3D.position;

    if (!Array.isArray(camera) || camera.length !== 3) {
      return null;
    }

    const gpuAsset = getOrCreateGltfGpuAsset(geometry.assetUrl);

    if (!gpuAsset) {
      return null;
    }

    const bounds = getStaticModelWorldBounds(geometry, gpuAsset);

    if (!bounds) {
      return null;
    }

    const dx = Math.max(
      0,
      Math.abs(camera[0] - bounds.center[0]) - bounds.extents[0],
    );

    const dy = Math.max(
      0,
      Math.abs(camera[1] - bounds.center[1]) - bounds.extents[1],
    );

    const dz = Math.max(
      0,
      Math.abs(camera[2] - bounds.center[2]) - bounds.extents[2],
    );

    return Math.hypot(dx, dy, dz);
  }

  function getStaticModelLodIndex(geometry, distance) {
    const levels = geometry.lodLevels;

    const key = `${geometry.worldId}:${geometry.id}`;

    let state = STATIC_MODEL_LOD.states.get(key);

    if (!state || state.sourceAssetUrl !== geometry.assetUrl) {
      state = {
        index: 0,
        distance: null,
        activeAssetUrl: geometry.assetUrl,
        requestedIndex: 0,
        sourceAssetUrl: geometry.assetUrl,
        renderSource: null,
        renderAssetUrl: null,
        renderObject: null,
      };

      STATIC_MODEL_LOD.states.set(key, state);
    }

    if (!STATIC_MODEL_LOD.enabled || !Number.isFinite(distance)) {
      state.distance = distance;
      state.requestedIndex = 0;
      return 0;
    }

    let next = state.index;
    const margin = STATIC_MODEL_LOD.hysteresis;

    while (
      next < levels.length - 1 &&
      distance >= levels[next + 1].distance + margin
    ) {
      next++;
    }

    while (next > 0 && distance < levels[next].distance - margin) {
      next--;
    }

    state.distance = distance;
    state.requestedIndex = next;

    return next;
  }

  function getCachedStaticLodGeometry(geometry, state) {
    if (
      state.renderSource === geometry &&
      state.renderAssetUrl === state.activeAssetUrl &&
      state.renderObject
    ) {
      return state.renderObject;
    }

    const renderObject =
      state.activeAssetUrl === geometry.assetUrl
        ? geometry
        : {
            ...geometry,
            assetUrl: state.activeAssetUrl,
          };

    state.renderSource = geometry;
    state.renderAssetUrl = state.activeAssetUrl;
    state.renderObject = renderObject;

    return renderObject;
  }

  function resolveStaticModelLod(geometry) {
    if (!Array.isArray(geometry.lodLevels) || geometry.lodLevels.length < 2) {
      return geometry;
    }

    const levels = geometry.lodLevels;
    const key = `${geometry.worldId}:${geometry.id}`;
    const distance = getStaticModelLodDistance(geometry);

    const targetIndex = getStaticModelLodIndex(geometry, distance);
    const state = STATIC_MODEL_LOD.states.get(key);

    if (!state) {
      return geometry;
    }

    const assets = window.gltfAssetSystem3D;

    if (!assets) {
      return geometry;
    }

    const targetUrl = levels[targetIndex].assetUrl;

    if (assets.getStatus(targetUrl) === "missing") {
      assets.preload(targetUrl);
    }

    let selectedIndex = targetIndex;

    if (!assets.get(targetUrl)) {
      const previousIndex = levels.findIndex(
        (level) => level.assetUrl === state.activeAssetUrl,
      );

      if (previousIndex >= 0 && assets.get(levels[previousIndex].assetUrl)) {
        selectedIndex = previousIndex;
      } else {
        const availableIndex = levels.findIndex((level) =>
          Boolean(assets.get(level.assetUrl)),
        );

        selectedIndex = availableIndex >= 0 ? availableIndex : 0;
      }
    }

    const selectedUrl = levels[selectedIndex].assetUrl;

    if (selectedUrl !== state.activeAssetUrl) {
      if (assets.get(selectedUrl)) {
        state.activeAssetUrl = selectedUrl;
        state.index = selectedIndex;
        STATIC_MODEL_LOD.switches++;
      }
    }

    return getCachedStaticLodGeometry(geometry, state);
  }

  function shouldCullStaticModel(geometry, planes) {
    if (!STATIC_MODEL_CULLING.enabled || !planes) {
      return false;
    }

    const gpuAsset = getOrCreateGltfGpuAsset(geometry.assetUrl);

    if (!gpuAsset) {
      return false;
    }

    const bounds = getStaticModelWorldBounds(geometry, gpuAsset);

    if (!isStaticModelOutsideFrustum(bounds, planes)) {
      return false;
    }

    const cost = getStaticModelDrawCost(gpuAsset);

    getPerformanceMonitor()?.recordCulledBuilding?.(
      geometry.id,
      cost.drawCalls,
      cost.triangles,
    );

    return true;
  }

  function drawStaticModel3D(geometry) {
    const coordinateSystem3D = window.coordinateSystem3D;

    if (
      !geometry ||
      geometry.visible === false ||
      !coordinateSystem3D ||
      typeof geometry.assetUrl !== "string"
    ) {
      return;
    }

    const gpuAsset = getOrCreateGltfGpuAsset(geometry.assetUrl);

    if (!gpuAsset) {
      return;
    }

    const baseHeight = Number.isFinite(geometry.baseHeight)
      ? geometry.baseHeight
      : 0;

    const groundOffset = Number.isFinite(geometry.groundOffset)
      ? geometry.groundOffset
      : 0;

    const scaleY = Number.isFinite(geometry.scaleY) ? geometry.scaleY : 1;

    let groundAlignmentOffset = 0;

    if (
      geometry.groundAlign !== false &&
      Number.isFinite(gpuAsset.bounds?.minY)
    ) {
      groundAlignmentOffset = -gpuAsset.bounds.minY * scaleY;
    }

    const finalRenderHeight = baseHeight + groundAlignmentOffset + groundOffset;

    const renderPosition = coordinateSystem3D.gameToRenderPosition(
      geometry.x,
      geometry.y,
      finalRenderHeight,
    );

    if (!renderPosition) {
      return;
    }

    const translation = Mat4.translation(
      renderPosition[0],
      renderPosition[1],
      renderPosition[2],
    );

    const rotation = Mat4.rotationY(
      Number.isFinite(geometry.rotation) ? geometry.rotation : 0,
    );

    const scale = Mat4.scaling(
      Number.isFinite(geometry.scaleX) ? geometry.scaleX : 1,

      scaleY,

      Number.isFinite(geometry.scaleZ) ? geometry.scaleZ : 1,
    );

    const instanceMatrix = Mat4.multiply(
      Mat4.multiply(translation, rotation),
      scale,
    );

    for (const rootNodeIndex of gpuAsset.sourceAsset.rootNodes) {
      drawGltfNode3D(gpuAsset, rootNodeIndex, instanceMatrix);
    }
  }

  function bindLineMesh(gl, mesh) {
    const posBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);

    gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);

    const colorBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);

    gl.bufferData(gl.ARRAY_BUFFER, mesh.colors, gl.STATIC_DRAW);

    return {
      posBuffer,
      colorBuffer,
      count: mesh.count,
    };
  }

  function deleteGroundTextureCache() {
    const gl = EXPERIMENTAL_3D.gl;

    if (gl) {
      for (const entry of EXPERIMENTAL_3D.groundTextures.values()) {
        if (entry?.texture) {
          gl.deleteTexture(entry.texture);
        }
      }
    }

    if (gl) {
      for (const entry of EXPERIMENTAL_3D.groundChunks.values()) {
        if (entry?.texture) {
          gl.deleteTexture(entry.texture);
        }
      }
    }

    EXPERIMENTAL_3D.groundChunks.clear();

    EXPERIMENTAL_3D.groundTextures.clear();
  }

  function ensureGroundTextureWorld(worldId) {
    if (EXPERIMENTAL_3D.groundTextureWorldId === worldId) {
      return;
    }

    deleteGroundTextureCache();

    EXPERIMENTAL_3D.groundTextureWorldId = worldId;

    console.log(`[3D] Ground texture cache switched to world ${worldId}.`);
  }

  function createTextureFromImage(image) {
    const gl = EXPERIMENTAL_3D.gl;

    if (
      !gl ||
      !image ||
      !image.complete ||
      image.naturalWidth <= 0 ||
      image.naturalHeight <= 0
    ) {
      return null;
    }

    const texture = gl.createTexture();

    if (!texture) {
      return null;
    }

    const previousFlipY = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
    const previousPremultiplyAlpha = gl.getParameter(
      gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
    );
    const previousTexture = gl.getParameter(gl.TEXTURE_BINDING_2D);

    try {
      gl.bindTexture(gl.TEXTURE_2D, texture);

      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image,
      );

      gl.generateMipmap(gl.TEXTURE_2D);

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR,
      );

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } finally {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, previousFlipY);

      gl.pixelStorei(
        gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
        previousPremultiplyAlpha,
      );

      gl.bindTexture(gl.TEXTURE_2D, previousTexture);
    }

    return texture;
  }

  function createTextureFromBitmap(bitmap) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !bitmap) {
      return null;
    }

    const texture = gl.createTexture();

    if (!texture) {
      return null;
    }

    const previousFlipY = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
    const previousPremultiplyAlpha = gl.getParameter(
      gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
    );
    const previousTexture = gl.getParameter(gl.TEXTURE_BINDING_2D);

    try {
      gl.bindTexture(gl.TEXTURE_2D, texture);

      // glTF UV convention expects the image data in the
      // orientation defined by the glTF texture coordinates.
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        bitmap,
      );

      gl.generateMipmap(gl.TEXTURE_2D);

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR,
      );

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    } finally {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, previousFlipY);

      gl.pixelStorei(
        gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
        previousPremultiplyAlpha,
      );

      gl.bindTexture(gl.TEXTURE_2D, previousTexture);
    }

    return texture;
  }

  function getOrCreatePlayerTexture(kind, image) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || (kind !== "walking" && kind !== "attack")) {
      return null;
    }

    if (
      !image ||
      !image.complete ||
      image.naturalWidth <= 0 ||
      image.naturalHeight <= 0
    ) {
      return null;
    }

    if (
      EXPERIMENTAL_3D.playerTextures[kind] &&
      EXPERIMENTAL_3D.playerTextureImages[kind] === image
    ) {
      return EXPERIMENTAL_3D.playerTextures[kind];
    }

    if (EXPERIMENTAL_3D.playerTextures[kind]) {
      gl.deleteTexture(EXPERIMENTAL_3D.playerTextures[kind]);
    }

    const texture = createTextureFromImage(image);

    if (!texture) {
      return null;
    }

    EXPERIMENTAL_3D.playerTextures[kind] = texture;

    EXPERIMENTAL_3D.playerTextureImages[kind] = image;

    return texture;
  }

  function getOrCreateEnemyTexture(type, image) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !type) {
      return null;
    }

    if (
      !image ||
      !image.complete ||
      image.naturalWidth <= 0 ||
      image.naturalHeight <= 0
    ) {
      return null;
    }

    const cachedTexture = EXPERIMENTAL_3D.enemyTextures.get(type);
    const cachedImage = EXPERIMENTAL_3D.enemyTextureImages.get(type);

    if (cachedTexture && cachedImage === image) {
      return cachedTexture;
    }

    if (cachedTexture) {
      gl.deleteTexture(cachedTexture);
    }

    const texture = createTextureFromImage(image);

    if (!texture) {
      return null;
    }

    EXPERIMENTAL_3D.enemyTextures.set(type, texture);
    EXPERIMENTAL_3D.enemyTextureImages.set(type, image);

    return texture;
  }

  function getOrCreateItemTexture(type, image) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !type) {
      return null;
    }

    if (
      !image ||
      !image.complete ||
      image.naturalWidth <= 0 ||
      image.naturalHeight <= 0
    ) {
      return null;
    }

    const cachedTexture = EXPERIMENTAL_3D.itemTextures.get(type);

    const cachedImage = EXPERIMENTAL_3D.itemTextureImages.get(type);

    if (cachedTexture && cachedImage === image) {
      return cachedTexture;
    }

    if (cachedTexture) {
      gl.deleteTexture(cachedTexture);
    }

    const texture = createTextureFromImage(image);

    if (!texture) {
      return null;
    }

    EXPERIMENTAL_3D.itemTextures.set(type, texture);
    EXPERIMENTAL_3D.itemTextureImages.set(type, image);

    return texture;
  }

  function getOrCreateImplantTexture(key, image) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !key) {
      return null;
    }

    if (
      !image ||
      !image.complete ||
      image.naturalWidth <= 0 ||
      image.naturalHeight <= 0
    ) {
      return null;
    }

    const cachedTexture = EXPERIMENTAL_3D.implantTextures.get(key);
    const cachedImage = EXPERIMENTAL_3D.implantTextureImages.get(key);

    if (cachedTexture && cachedImage === image) {
      return cachedTexture;
    }

    if (cachedTexture) {
      gl.deleteTexture(cachedTexture);
    }

    const texture = createTextureFromImage(image);

    if (!texture) {
      return null;
    }

    EXPERIMENTAL_3D.implantTextures.set(key, texture);
    EXPERIMENTAL_3D.implantTextureImages.set(key, image);

    return texture;
  }

  function getPlayerSpriteAssets() {
    if (typeof images === "undefined" || !images) {
      return null;
    }

    return {
      walking: images.playerWalkingSprite || null,

      attack: images.playerAttackSprite || null,
    };
  }

  function getOrCreateGroundTexture(worldId, tileX, tileY, image) {
    const key = `${worldId}:${tileX}:${tileY}`;

    const cached = EXPERIMENTAL_3D.groundTextures.get(key);

    if (cached?.texture) {
      return cached.texture;
    }

    if (
      !image ||
      !image.complete ||
      image.naturalWidth <= 0 ||
      image.naturalHeight <= 0
    ) {
      return null;
    }

    const texture = createTextureFromImage(image);

    if (!texture) {
      return null;
    }

    EXPERIMENTAL_3D.groundTextures.set(key, {
      texture,
    });

    return texture;
  }

  function createGroundChunkTexture(canvas) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !canvas) {
      return null;
    }

    const texture = gl.createTexture();

    if (!texture) {
      return null;
    }

    const previousTexture = gl.getParameter(gl.TEXTURE_BINDING_2D);
    const previousFlipY = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
    const previousPremultiplyAlpha = gl.getParameter(
      gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
    );

    let success = false;

    try {
      gl.bindTexture(gl.TEXTURE_2D, texture);

      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        canvas,
      );

      gl.generateMipmap(gl.TEXTURE_2D);

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR,
      );

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      success = true;
    } catch (error) {
      console.error("[3D] Ground chunk texture upload failed.", error);
    } finally {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, previousFlipY);

      gl.pixelStorei(
        gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,
        previousPremultiplyAlpha,
      );

      gl.bindTexture(gl.TEXTURE_2D, previousTexture);
    }

    if (!success) {
      gl.deleteTexture(texture);
      return null;
    }

    return texture;
  }

  function getOrCreateGroundChunk(worldId, chunkX, chunkY, tiles) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !tiles?.length) {
      return null;
    }

    const startX = chunkX * GROUND_CHUNK_TILES;
    const startY = chunkY * GROUND_CHUNK_TILES;

    const cacheKey = `${worldId}:${chunkX}:${chunkY}`;
    const cachedChunk = EXPERIMENTAL_3D.groundChunks.get(cacheKey);

    if (
      cachedChunk?.texture &&
      cachedChunk.images.length === GROUND_CHUNK_TILES * GROUND_CHUNK_TILES
    ) {
      const cachedImages = cachedChunk.images;
      let unchanged = true;
      let index = 0;

      for (let y = 0; y < GROUND_CHUNK_TILES && unchanged; y++) {
        const row = tiles[startY + y];

        if (!row) {
          unchanged = false;
          break;
        }

        for (let x = 0; x < GROUND_CHUNK_TILES; x++) {
          const image = row[startX + x];

          if (
            image !== cachedImages[index] ||
            !image?.complete ||
            image.naturalWidth <= 0 ||
            image.naturalHeight <= 0
          ) {
            unchanged = false;
            break;
          }

          index++;
        }
      }

      if (unchanged) {
        GROUND_CHUNK_DIAGNOSTICS.hits++;
        return cachedChunk;
      }
    }

    const tileImages = [];
    let tilePixels = 1;

    for (let localY = 0; localY < GROUND_CHUNK_TILES; localY++) {
      for (let localX = 0; localX < GROUND_CHUNK_TILES; localX++) {
        const image = tiles[startY + localY]?.[startX + localX];

        if (
          !image ||
          !image.complete ||
          image.naturalWidth <= 0 ||
          image.naturalHeight <= 0
        ) {
          GROUND_CHUNK_DIAGNOSTICS.notReady++;
          return null;
        }

        tileImages.push(image);

        tilePixels = Math.max(
          tilePixels,
          image.naturalWidth,
          image.naturalHeight,
        );
      }
    }

    if (cachedChunk?.texture) {
      GROUND_CHUNK_DIAGNOSTICS.replacements++;
    }

    if (cachedChunk?.texture) {
      gl.deleteTexture(cachedChunk.texture);
      EXPERIMENTAL_3D.groundChunks.delete(cacheKey);
    }

    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

    const maxTilePixels = Math.min(
      GROUND_CHUNK_MAX_TILE_PIXELS,
      Math.floor(maxTextureSize / GROUND_CHUNK_TILES),
    );

    if (maxTilePixels < 1) {
      return null;
    }

    tilePixels = Math.min(tilePixels, maxTilePixels);

    const canvas = document.createElement("canvas");

    canvas.width = tilePixels * GROUND_CHUNK_TILES;
    canvas.height = tilePixels * GROUND_CHUNK_TILES;

    const ctx = canvas.getContext("2d", { alpha: true });

    if (!ctx) {
      return null;
    }

    for (let i = 0; i < tileImages.length; i++) {
      const localX = i % GROUND_CHUNK_TILES;
      const localY = Math.floor(i / GROUND_CHUNK_TILES);

      ctx.drawImage(
        tileImages[i],
        localX * tilePixels,
        localY * tilePixels,
        tilePixels,
        tilePixels,
      );
    }

    const texture = createGroundChunkTexture(canvas);

    if (!texture) {
      return null;
    }

    const entry = {
      texture,
      images: tileImages,
    };

    GROUND_CHUNK_DIAGNOSTICS.builds++;

    EXPERIMENTAL_3D.groundChunks.set(cacheKey, entry);

    return entry;
  }

  function ensureBgTilesRequested(worldId) {
    return window.engineSceneBridge?.ensureWorldLoaded?.(worldId) === true;
  }

  function drawBgGroundTiles(playerGameX, playerGameY, worldScene = null) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !EXPERIMENTAL_3D.groundTile) {
      return;
    }

    const scene =
      worldScene ?? window.engineSceneBridge?.getWorldScene() ?? null;

    if (!scene) {
      return;
    }

    const worldId = scene.worldId;

    ensureGroundTextureWorld(worldId);

    ensureBgTilesRequested(worldId);

    const tiles = scene.layers.background.tiles;

    if (!tiles || !tiles.length) {
      return;
    }

    const tileSize = scene.tileSize;

    const tilesY = tiles.length;

    const tilesX = tiles[0]?.length || 0;

    if (!tilesX || !tilesY) {
      return;
    }

    // Выбираем тайлы по реальной области видимости камеры,
    // а не только по расстоянию от игрока.

    let startX;
    let endX;
    let startY;
    let endY;

    const isIsometric = window.cameraSystem3D?.getMode?.() === "isometric";

    if (isIsometric) {
      const canvas2D = getRenderCanvas("2d");

      const zoom = window.engineSceneBridge?.getCameraViewport?.()?.zoom || 1;

      const viewportWidth = (canvas2D?.width || gl.canvas.width) / zoom;

      const viewportHeight = (canvas2D?.height || gl.canvas.height) / zoom;

      const pitch = EXPERIMENTAL_3D.pitch;

      const sinPitch = Math.max(0.000001, Math.abs(Math.sin(pitch)));

      // Ортографическая область на горизонтальной земле.
      const halfWidth = viewportWidth / 2;
      const halfDepth = viewportHeight / (2 * sinPitch);

      const cameraCenterX = EXPERIMENTAL_3D.target[0];
      const cameraCenterY = EXPERIMENTAL_3D.target[2];

      // Дополнительный тайл для защиты от пограничных
      // ошибок округления и видимых стыков.
      const padding = tileSize;

      const left = cameraCenterX - halfWidth - padding;
      const right = cameraCenterX + halfWidth + padding;

      const top = cameraCenterY - halfDepth - padding;
      const bottom = cameraCenterY + halfDepth + padding;

      startX = Math.max(0, Math.floor(left / tileSize));

      endX = Math.min(tilesX - 1, Math.ceil(right / tileSize));

      startY = Math.max(0, Math.floor(top / tileSize));

      endY = Math.min(tilesY - 1, Math.ceil(bottom / tileSize));
    } else {
      const canvas = EXPERIMENTAL_3D.canvas || gl.canvas;
      const rect = canvas.getBoundingClientRect();

      const origin = EXPERIMENTAL_3D.position;
      const forward = Vec3.normalize(
        Vec3.subtract(EXPERIMENTAL_3D.target, origin),
      );
      const right = Vec3.normalize(Vec3.cross(forward, [0, 1, 0]));
      const up = Vec3.normalize(Vec3.cross(right, forward));

      const aspect = rect.width / Math.max(1, rect.height);
      const tanHalfFov = Math.tan(EXPERIMENTAL_3D.FOV_Y / 2);

      const groundY = EXPERIMENTAL_3D.GROUND_TEXTURE_Y;
      const maxDistance = Math.min(
        EXPERIMENTAL_3D.FAR,
        Math.hypot(tilesX * tileSize, tilesY * tileSize) +
          EXPERIMENTAL_3D.MAX_CAMERA_DISTANCE,
      );

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      const coordinateSystem = window.coordinateSystem3D;

      for (let sy = -1; sy <= 1; sy += 0.5) {
        for (let sx = -1; sx <= 1; sx += 0.5) {
          const direction = Vec3.normalize([
            forward[0] +
              right[0] * sx * aspect * tanHalfFov +
              up[0] * sy * tanHalfFov,

            forward[1] +
              right[1] * sx * aspect * tanHalfFov +
              up[1] * sy * tanHalfFov,

            forward[2] +
              right[2] * sx * aspect * tanHalfFov +
              up[2] * sy * tanHalfFov,
          ]);

          let distance = maxDistance;

          if (direction[1] < -0.000001) {
            distance = Math.min(
              maxDistance,
              Math.max(0, (groundY - origin[1]) / direction[1]),
            );
          }

          const renderX = origin[0] + direction[0] * distance;
          const renderZ = origin[2] + direction[2] * distance;

          const point = coordinateSystem?.renderToGamePosition?.(
            renderX,
            groundY,
            renderZ,
          );

          if (
            !point ||
            !Number.isFinite(point.x) ||
            !Number.isFinite(point.y)
          ) {
            continue;
          }

          minX = Math.min(minX, point.x);
          maxX = Math.max(maxX, point.x);
          minY = Math.min(minY, point.y);
          maxY = Math.max(maxY, point.y);
        }
      }

      minX = Math.min(minX, playerGameX);
      maxX = Math.max(maxX, playerGameX);
      minY = Math.min(minY, playerGameY);
      maxY = Math.max(maxY, playerGameY);

      const padding = tileSize;

      startX = clamp(Math.floor((minX - padding) / tileSize), 0, tilesX - 1);

      endX = clamp(Math.ceil((maxX + padding) / tileSize), 0, tilesX - 1);

      startY = clamp(Math.floor((minY - padding) / tileSize), 0, tilesY - 1);

      endY = clamp(Math.ceil((maxY + padding) / tileSize), 0, tilesY - 1);
    }

    const receiveShadow =
      SHADOW_CONFIG.enabled &&
      SHADOW_MAP.ready &&
      SHADOW_MAP.depthPassReady &&
      SHADOW_MAP.drawCalls > 0 &&
      SHADOW_MAP.lightMatrix !== null;

    if (receiveShadow) {
      gl.activeTexture(gl.TEXTURE0 + SHADOW_CONFIG.textureUnit);

      gl.bindTexture(gl.TEXTURE_2D, SHADOW_MAP.depthTexture);

      gl.uniformMatrix4fv(
        EXPERIMENTAL_3D.uniforms.shadowLightMatrix,
        false,
        SHADOW_MAP.lightMatrix,
      );
    }

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.receiveShadow, receiveShadow ? 1 : 0);

    const localPlayer = getLocalPlayer();

    const anchor = localPlayer
      ? window.engineSceneBridge?.getPlayerGroundAnchor?.(
          localPlayer.x,
          localPlayer.y,
        )
      : null;

    const shadowPosition = anchor
      ? window.coordinateSystem3D?.gameToRenderPosition?.(
          anchor.x,
          anchor.y,
          EXPERIMENTAL_3D.GROUND_TEXTURE_Y,
        )
      : null;

    const localShadowEnabled =
      Boolean(shadowPosition) && shadowPosition.every(Number.isFinite);

    gl.uniform1i(
      EXPERIMENTAL_3D.uniforms.localPlayerShadow,
      localShadowEnabled ? 1 : 0,
    );

    if (localShadowEnabled) {
      gl.uniform2f(
        EXPERIMENTAL_3D.uniforms.localPlayerShadowCenter,
        shadowPosition[0],
        shadowPosition[2],
      );

      gl.uniform2f(EXPERIMENTAL_3D.uniforms.localPlayerShadowRadius, 19, 12);

      gl.uniform1f(EXPERIMENTAL_3D.uniforms.localPlayerShadowStrength, 0.38);
    }

    gl.activeTexture(gl.TEXTURE0);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.texture, 0);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 1);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.useSkinning, 0);

    gl.uniform4f(EXPERIMENTAL_3D.uniforms.uvRect, 0, 0, 1, 1);

    bindIndexedMeshForDraw(EXPERIMENTAL_3D.groundTile);

    EXPERIMENTAL_3D.groundChunkDrawCalls = 0;
    EXPERIMENTAL_3D.groundFallbackDrawCalls = 0;

    const coordinateSystem3D = window.coordinateSystem3D;

    function drawGroundQuad(x, y, width, height, texture) {
      if (!texture || !coordinateSystem3D) {
        return;
      }

      const renderPosition = coordinateSystem3D.gameToRenderPosition(
        x * tileSize,
        y * tileSize,
        EXPERIMENTAL_3D.GROUND_TEXTURE_Y,
      );

      if (!renderPosition) {
        return;
      }

      const model = Mat4.multiply(
        Mat4.translation(
          renderPosition[0],
          renderPosition[1],
          renderPosition[2],
        ),
        Mat4.scaling(width * tileSize, 1, height * tileSize),
      );

      gl.bindTexture(gl.TEXTURE_2D, texture);

      gl.uniformMatrix4fv(EXPERIMENTAL_3D.uniforms.model, false, model);

      trackedDrawElements(
        gl.TRIANGLES,
        EXPERIMENTAL_3D.groundTile.count,
        gl.UNSIGNED_SHORT,
        0,
      );
    }

    const firstChunkX = Math.floor(startX / GROUND_CHUNK_TILES);
    const lastChunkX = Math.floor(endX / GROUND_CHUNK_TILES);

    const firstChunkY = Math.floor(startY / GROUND_CHUNK_TILES);
    const lastChunkY = Math.floor(endY / GROUND_CHUNK_TILES);

    for (let chunkY = firstChunkY; chunkY <= lastChunkY; chunkY++) {
      for (let chunkX = firstChunkX; chunkX <= lastChunkX; chunkX++) {
        const chunkStartX = chunkX * GROUND_CHUNK_TILES;
        const chunkStartY = chunkY * GROUND_CHUNK_TILES;

        const chunkEndX = Math.min(
          tilesX - 1,
          chunkStartX + GROUND_CHUNK_TILES - 1,
        );

        const chunkEndY = Math.min(
          tilesY - 1,
          chunkStartY + GROUND_CHUNK_TILES - 1,
        );

        const fullChunk =
          chunkEndX - chunkStartX + 1 === GROUND_CHUNK_TILES &&
          chunkEndY - chunkStartY + 1 === GROUND_CHUNK_TILES;

        const chunk =
          EXPERIMENTAL_3D.groundChunkEnabled && fullChunk
            ? getOrCreateGroundChunk(worldId, chunkX, chunkY, tiles)
            : null;

        if (chunk?.texture) {
          drawGroundQuad(
            chunkStartX,
            chunkStartY,
            GROUND_CHUNK_TILES,
            GROUND_CHUNK_TILES,
            chunk.texture,
          );

          EXPERIMENTAL_3D.groundChunkDrawCalls++;

          continue;
        }

        for (let y = chunkStartY; y <= chunkEndY; y++) {
          for (let x = chunkStartX; x <= chunkEndX; x++) {
            const image = tiles[y]?.[x];

            const texture = getOrCreateGroundTexture(worldId, x, y, image);

            if (!texture) {
              continue;
            }

            drawGroundQuad(x, y, 1, 1, texture);

            EXPERIMENTAL_3D.groundFallbackDrawCalls++;
          }
        }
      }
    }

    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 0);
    gl.uniform1i(EXPERIMENTAL_3D.uniforms.receiveShadow, 0);
    gl.uniform1i(EXPERIMENTAL_3D.uniforms.localPlayerShadow, 0);

    if (receiveShadow) {
      gl.activeTexture(gl.TEXTURE0 + SHADOW_CONFIG.textureUnit);

      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE0);
    }
  }

  function destroyShadowMap() {
    const gl = SHADOW_MAP.gl || EXPERIMENTAL_3D.gl;

    if (gl && SHADOW_MAP.vao) {
      gl.deleteVertexArray(SHADOW_MAP.vao);
    }

    if (gl && SHADOW_MAP.program) {
      gl.deleteProgram(SHADOW_MAP.program);
    }

    SHADOW_MAP.vao = null;
    SHADOW_MAP.program = null;
    SHADOW_MAP.locations = null;
    SHADOW_MAP.lightMatrix = null;
    SHADOW_MAP.depthPassReady = false;
    SHADOW_MAP.drawCalls = 0;
    SHADOW_MAP.cacheKey = null;
    SHADOW_MAP.cacheHits = 0;
    SHADOW_MAP.cacheMisses = 0;

    if (gl) {
      if (SHADOW_MAP.framebuffer) {
        gl.deleteFramebuffer(SHADOW_MAP.framebuffer);
      }

      if (SHADOW_MAP.depthTexture) {
        gl.deleteTexture(SHADOW_MAP.depthTexture);
      }
    }

    SHADOW_MAP.gl = null;
    SHADOW_MAP.framebuffer = null;
    SHADOW_MAP.depthTexture = null;
    SHADOW_MAP.ready = false;
  }

  function ensureShadowMap() {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !SHADOW_CONFIG.enabled || SHADOW_MAP.failed) {
      return false;
    }

    if (SHADOW_MAP.ready && SHADOW_MAP.gl === gl) {
      return true;
    }

    destroyShadowMap();

    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

    if (maxTextureSize < SHADOW_CONFIG.mapSize) {
      SHADOW_MAP.failed = true;
      console.warn("[3D Shadow] Texture size is not supported.");
      return false;
    }

    const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    const previousActiveTexture = gl.getParameter(gl.ACTIVE_TEXTURE);

    gl.activeTexture(gl.TEXTURE0 + SHADOW_CONFIG.textureUnit);

    const previousTexture = gl.getParameter(gl.TEXTURE_BINDING_2D);

    let framebuffer = null;
    let depthTexture = null;
    let complete = false;

    try {
      depthTexture = gl.createTexture();
      framebuffer = gl.createFramebuffer();

      if (!depthTexture || !framebuffer) {
        return false;
      }

      gl.bindTexture(gl.TEXTURE_2D, depthTexture);

      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.DEPTH_COMPONENT24,
        SHADOW_CONFIG.mapSize,
        SHADOW_CONFIG.mapSize,
        0,
        gl.DEPTH_COMPONENT,
        gl.UNSIGNED_INT,
        null,
      );

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.DEPTH_ATTACHMENT,
        gl.TEXTURE_2D,
        depthTexture,
        0,
      );

      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);

      complete =
        gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;

      if (!complete) {
        console.warn("[3D Shadow] Framebuffer is incomplete.");
        return false;
      }

      SHADOW_MAP.gl = gl;
      SHADOW_MAP.framebuffer = framebuffer;
      SHADOW_MAP.depthTexture = depthTexture;
      SHADOW_MAP.ready = true;

      console.log(
        `[3D Shadow] Depth map ${SHADOW_CONFIG.mapSize}x${SHADOW_CONFIG.mapSize} ready.`,
      );

      return true;
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);

      gl.bindTexture(gl.TEXTURE_2D, previousTexture);
      gl.activeTexture(previousActiveTexture);

      if (!complete) {
        if (framebuffer) {
          gl.deleteFramebuffer(framebuffer);
        }

        if (depthTexture) {
          gl.deleteTexture(depthTexture);
        }

        SHADOW_MAP.failed = true;
      }
    }
  }

  function ensureShadowDepthProgram() {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !SHADOW_MAP.ready) {
      return false;
    }

    if (SHADOW_MAP.depthPassReady && SHADOW_MAP.program) {
      return true;
    }

    const vertexSource = `#version 300 es
    precision highp float;

    in vec3 aPosition;
    in vec2 aTexCoord;

    uniform mat4 uLightMatrix;
    uniform mat4 uModel;

    out vec2 vTexCoord;

    void main() {
      vTexCoord = aTexCoord;
      gl_Position = uLightMatrix * uModel * vec4(aPosition, 1.0);
    }
  `;

    const fragmentSource = `#version 300 es
    precision highp float;

    in vec2 vTexCoord;

    uniform bool uAlphaMask;
    uniform bool uHasTexture;
    uniform sampler2D uBaseTexture;
    uniform float uAlphaCutoff;
    uniform float uBaseAlpha;

    void main() {
      if (uAlphaMask) {
        float alpha = uBaseAlpha;

        if (uHasTexture) {
          alpha *= texture(uBaseTexture, vTexCoord).a;
        }

        if (alpha < uAlphaCutoff) {
          discard;
        }
      }
    }
  `;

    const program = createProgram(gl, vertexSource, fragmentSource);

    if (!program) {
      SHADOW_MAP.failed = true;
      return false;
    }

    SHADOW_MAP.program = program;

    SHADOW_MAP.locations = {
      position: gl.getAttribLocation(program, "aPosition"),
      texCoord: gl.getAttribLocation(program, "aTexCoord"),
      lightMatrix: gl.getUniformLocation(program, "uLightMatrix"),
      model: gl.getUniformLocation(program, "uModel"),
      alphaMask: gl.getUniformLocation(program, "uAlphaMask"),
      hasTexture: gl.getUniformLocation(program, "uHasTexture"),
      baseTexture: gl.getUniformLocation(program, "uBaseTexture"),
      alphaCutoff: gl.getUniformLocation(program, "uAlphaCutoff"),
      baseAlpha: gl.getUniformLocation(program, "uBaseAlpha"),
    };

    SHADOW_MAP.depthPassReady = true;

    return true;
  }

  function ensureResources() {
    if (EXPERIMENTAL_3D.gl) {
      if (SHADOW_CONFIG.enabled && !SHADOW_MAP.ready && !SHADOW_MAP.failed) {
        ensureShadowMap();
      }

      return true;
    }

    const canvas = getRenderCanvas("3d");

    if (!canvas) {
      console.warn(
        "[3D] Canvas #game3DCanvas not found. Falling back to 2D renderer.",
      );

      return false;
    }

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: true,
    });

    if (!gl) {
      console.warn("[3D] WebGL2 not available. Falling back to 2D renderer.");

      return false;
    }

    const vertexSource = `#version 300 es
  precision highp float;
  precision highp int;

  in vec3 aPosition;
   in vec3 aNormal;
in vec4 aColor;
in vec2 aTexCoord;

in uvec4 aJoints;
in vec4 aWeights;

  uniform mat4 uProjection;
  uniform mat4 uView;
  uniform mat4 uModel;
    uniform bool uUseLighting;

  uniform bool uUseSkinning;
  uniform sampler2D uJointTexture;

  out vec4 vColor;
out vec2 vTexCoord;
out vec3 vWorldNormal;
out vec3 vWorldPosition;

  mat4 getJointMatrix(int jointIndex) {
    return mat4(
      texelFetch(
        uJointTexture,
        ivec2(0, jointIndex),
        0
      ),

      texelFetch(
        uJointTexture,
        ivec2(1, jointIndex),
        0
      ),

      texelFetch(
        uJointTexture,
        ivec2(2, jointIndex),
        0
      ),

      texelFetch(
        uJointTexture,
        ivec2(3, jointIndex),
        0
      )
    );
  }

  void main() {
    vColor = aColor;
    vTexCoord = aTexCoord;

     vec4 localPosition =
      vec4(aPosition, 1.0);

    vec3 localNormal = aNormal;

    if (uUseSkinning) {
  // JOINTS_0 arrives as an integer vertex attribute.
  // No float conversion is involved.
  uvec4 joints = aJoints;

  mat4 skinMatrix =
    getJointMatrix(int(joints.x)) *
      aWeights.x +
    getJointMatrix(int(joints.y)) *
      aWeights.y +
    getJointMatrix(int(joints.z)) *
      aWeights.z +
    getJointMatrix(int(joints.w)) *
      aWeights.w;

  localPosition =
    skinMatrix *
    localPosition;

   if (uUseLighting) {
    localNormal = mat3(skinMatrix) * localNormal;
  }
}

  vWorldNormal = vec3(0.0, 1.0, 0.0);

  if (uUseLighting) {
    mat3 normalMatrix = transpose(inverse(mat3(uModel)));
    vWorldNormal = normalize(normalMatrix * localNormal);
  }

  vec4 worldPosition = uModel * localPosition;

vWorldPosition = worldPosition.xyz;

gl_Position =
  uProjection *
  uView *
  worldPosition;
  }
`;

    const fragmentSource = `#version 300 es
      precision highp float;

      in vec4 vColor;
in vec2 vTexCoord;
in vec3 vWorldNormal;
in vec3 vWorldPosition;

      uniform bool uUseTexture;
      uniform sampler2D uTexture;
      uniform vec4 uUvRect;

      uniform int uAlphaMode;
      uniform float uAlphaCutoff;
      uniform vec4 uBaseColorFactor;
        uniform bool uUseLighting;
      uniform vec3 uLightDirection;
      uniform float uAmbientLight;
      uniform float uDirectionalLight;

      uniform bool uUsePbr;
uniform bool uHasMetallicRoughnessTexture;
uniform sampler2D uMetallicRoughnessTexture;
uniform float uMetallicFactor;
uniform float uRoughnessFactor;
uniform vec3 uCameraPosition;

uniform bool uHasNormalTexture;
uniform sampler2D uNormalTexture;
uniform float uNormalScale;

uniform bool uHasEmissiveTexture;
uniform sampler2D uEmissiveTexture;
uniform vec3 uEmissiveFactor;

uniform bool uReceiveShadow;
uniform sampler2D uShadowMap;
uniform mat4 uShadowLightMatrix;
uniform float uShadowStrength;
uniform float uShadowBias;

uniform bool uLocalPlayerShadow;
uniform vec2 uLocalPlayerShadowCenter;
uniform vec2 uLocalPlayerShadowRadius;
uniform float uLocalPlayerShadowStrength;

out vec4 fragColor;

float calculateLocalPlayerShadow(vec3 worldPosition) {
  vec2 offset =
    (worldPosition.xz - uLocalPlayerShadowCenter) /
    uLocalPlayerShadowRadius;

  float distanceSquared = dot(offset, offset);

  return 1.0 - smoothstep(0.15, 1.0, distanceSquared);
}

float calculateGroundShadow(vec3 worldPosition) {
  vec4 lightPosition =
    uShadowLightMatrix * vec4(worldPosition, 1.0);

  if (lightPosition.w <= 0.0) {
    return 0.0;
  }

  vec3 projected =
    lightPosition.xyz / lightPosition.w;

  projected = projected * 0.5 + 0.5;

  if (
    projected.x <= 0.0 ||
    projected.x >= 1.0 ||
    projected.y <= 0.0 ||
    projected.y >= 1.0 ||
    projected.z <= 0.0 ||
    projected.z >= 1.0
  ) {
    return 0.0;
  }

  float closestDepth =
    texture(uShadowMap, projected.xy).r;

  return projected.z - uShadowBias > closestDepth
    ? 1.0
    : 0.0;
}

vec3 calculateMappedNormal(
  vec3 worldNormal,
  vec3 worldPosition,
  vec2 uv
) {
  vec3 n = normalize(worldNormal);

  if (!uHasNormalTexture) {
    return n;
  }

  vec3 dpdx = dFdx(worldPosition);
  vec3 dpdy = dFdy(worldPosition);

  vec2 duvdx = dFdx(uv);
  vec2 duvdy = dFdy(uv);

  float determinant =
    duvdx.x * duvdy.y -
    duvdx.y * duvdy.x;

  if (abs(determinant) < 0.00000001) {
    return n;
  }

  vec3 tangent =
    (dpdx * duvdy.y - dpdy * duvdx.y) /
    determinant;

  tangent -= n * dot(n, tangent);

  float tangentLength = length(tangent);

  if (tangentLength < 0.000001) {
    return n;
  }

  tangent /= tangentLength;

  vec3 bitangent =
    cross(n, tangent) *
    (determinant < 0.0 ? -1.0 : 1.0);

  vec3 mapped = texture(uNormalTexture, uv).xyz * 2.0 - 1.0;

  mapped.xy *= uNormalScale;

  return normalize(
    tangent * mapped.x +
    bitangent * mapped.y +
    n * mapped.z
  );
}

vec3 srgbToLinear(vec3 srgb) {
  vec3 c = clamp(srgb, 0.0, 1.0);

  vec3 low = c / 12.92;

  vec3 high = pow(
    (c + 0.055) / 1.055,
    vec3(2.4)
  );

  return mix(
    low,
    high,
    step(vec3(0.04045), c)
  );
}

vec3 linearToSrgb(vec3 linearColor) {
  vec3 c = max(linearColor, vec3(0.0));

  vec3 low = c * 12.92;

  vec3 high =
    1.055 * pow(c, vec3(1.0 / 2.4)) -
    0.055;

  return mix(
    low,
    high,
    step(vec3(0.0031308), c)
  );
}

vec3 calculateEmissive(vec2 uv) {
  vec3 emission = uEmissiveFactor;

  if (uHasEmissiveTexture) {
    vec3 sampledEmission = texture(uEmissiveTexture, uv).rgb;

    emission *= srgbToLinear(sampledEmission);
  }

  return emission;
}

const float PBR_PI = 3.141592653589793;

vec3 pbrFresnelSchlick(float cosTheta, vec3 f0) {
  float factor = pow(1.0 - clamp(cosTheta, 0.0, 1.0), 5.0);
  return f0 + (1.0 - f0) * factor;
}

float pbrDistributionGGX(
  vec3 normal,
  vec3 halfway,
  float roughness
) {
  float alpha = roughness * roughness;
  float alphaSquared = alpha * alpha;

  float ndh = max(dot(normal, halfway), 0.0);
  float ndhSquared = ndh * ndh;

  float denominator =
    ndhSquared * (alphaSquared - 1.0) + 1.0;

  return alphaSquared /
    max(PBR_PI * denominator * denominator, 0.000001);
}

float pbrGeometrySchlickGGX(float ndv, float roughness) {
  float k = (roughness + 1.0);
  k = (k * k) / 8.0;

  return ndv / max(ndv * (1.0 - k) + k, 0.000001);
}

float pbrGeometrySmith(
  vec3 normal,
  vec3 viewDirection,
  vec3 lightDirection,
  float roughness
) {
  float ndv = max(dot(normal, viewDirection), 0.0);
  float ndl = max(dot(normal, lightDirection), 0.0);

  return
    pbrGeometrySchlickGGX(ndv, roughness) *
    pbrGeometrySchlickGGX(ndl, roughness);
}

vec3 calculatePbrLighting(
  vec3 baseColor,
  vec3 normal,
  vec3 worldPosition,
  vec2 uv
) {
  float metallic = clamp(uMetallicFactor, 0.0, 1.0);
  float roughness = clamp(uRoughnessFactor, 0.0, 1.0);

  if (uHasMetallicRoughnessTexture) {
    vec4 packed = texture(uMetallicRoughnessTexture, uv);

    roughness *= packed.g;
    metallic *= packed.b;
  }

  roughness = clamp(roughness, 0.045, 1.0);

  vec3 n = normalize(normal);
  vec3 l = normalize(uLightDirection);
  vec3 v = normalize(uCameraPosition - worldPosition);

  vec3 h = normalize(v + l);

  float ndl = max(dot(n, l), 0.0);
  float ndv = max(dot(n, v), 0.0);
  float hdotv = max(dot(h, v), 0.0);

  vec3 f0 = mix(vec3(0.04), baseColor, metallic);

  vec3 fresnel = pbrFresnelSchlick(hdotv, f0);

  float distribution =
    pbrDistributionGGX(n, h, roughness);

  float geometry =
    pbrGeometrySmith(n, v, l, roughness);

  vec3 specular =
    (distribution * geometry * fresnel) /
    max(4.0 * ndv * ndl, 0.0001);

  vec3 diffuseWeight =
    (vec3(1.0) - fresnel) * (1.0 - metallic);

  vec3 diffuse =
    diffuseWeight * baseColor / PBR_PI;

  vec3 direct =
    (diffuse + specular) *
    uDirectionalLight *
    ndl;

  vec3 ambient =
    baseColor *
    (1.0 - metallic) *
    uAmbientLight;

  return ambient + direct;
}

      void main() {
        vec4 color = vColor;

                if (uUseTexture) {
          vec2 atlasUv =
            uUvRect.xy +
            vTexCoord * uUvRect.zw;

          vec4 sampledColor = texture(uTexture, atlasUv);

          if (uUsePbr) {
            sampledColor.rgb = srgbToLinear(sampledColor.rgb);
          }

          color *= sampledColor;
        }

        color *= uBaseColorFactor;

        if (uAlphaMode == 1) {
          if (color.a < uAlphaCutoff) {
            discard;
          }

          color.a = 1.0;
        } else if (uAlphaMode == 2) {
          if (color.a <= 0.001) {
            discard;
          }
        } else if (uAlphaMode == 3) {
          if (color.a <= 0.01) {
            discard;
          }
        } else {
          color.a = 1.0;
        }

                       if (uUseLighting) {
          vec3 normal = normalize(vWorldNormal);

          if (uUsePbr) {
            normal = calculateMappedNormal(
              normal,
              vWorldPosition,
              vTexCoord
            );

            color.rgb = calculatePbrLighting(
              color.rgb,
              normal,
              vWorldPosition,
              vTexCoord
            );
          } else {
            float diffuse = max(
              dot(normal, normalize(uLightDirection)),
              0.0
            );

            float brightness =
              uAmbientLight +
              uDirectionalLight * diffuse;

            color.rgb *= brightness;
          }
        }

        if (uReceiveShadow) {
  float shadow = calculateGroundShadow(vWorldPosition);

  color.rgb *= 1.0 - shadow * uShadowStrength;
}

                        if (uLocalPlayerShadow) {
          float localShadow =
            calculateLocalPlayerShadow(vWorldPosition);

          color.rgb *=
            1.0 - localShadow * uLocalPlayerShadowStrength;
        }

        if (uUsePbr) {
          color.rgb += calculateEmissive(vTexCoord);
          color.rgb = linearToSrgb(color.rgb);
        }

        fragColor = color;
      }
    `;

    const program = createProgram(gl, vertexSource, fragmentSource);

    if (!program) {
      console.error("[3D] WebGL2 shader program failed to compile/link.");

      return false;
    }

    const positionLoc = gl.getAttribLocation(program, "aPosition");

    const normalLoc = gl.getAttribLocation(program, "aNormal");

    const colorLoc = gl.getAttribLocation(program, "aColor");

    const texCoordLoc = gl.getAttribLocation(program, "aTexCoord");

    const jointsLoc = gl.getAttribLocation(program, "aJoints");

    const weightsLoc = gl.getAttribLocation(program, "aWeights");

    if (positionLoc < 0 || colorLoc < 0 || texCoordLoc < 0) {
      console.error("[3D] Required shader attributes were not found.");

      gl.deleteProgram(program);

      return false;
    }

    EXPERIMENTAL_3D.canvas = canvas;

    EXPERIMENTAL_3D.gl = gl;

    EXPERIMENTAL_3D.program = program;

    EXPERIMENTAL_3D.uniforms = {
      projection: gl.getUniformLocation(program, "uProjection"),

      view: gl.getUniformLocation(program, "uView"),

      model: gl.getUniformLocation(program, "uModel"),

      useTexture: gl.getUniformLocation(program, "uUseTexture"),

      texture: gl.getUniformLocation(program, "uTexture"),

      uvRect: gl.getUniformLocation(program, "uUvRect"),

      alphaMode: gl.getUniformLocation(program, "uAlphaMode"),
      alphaCutoff: gl.getUniformLocation(program, "uAlphaCutoff"),
      baseColorFactor: gl.getUniformLocation(program, "uBaseColorFactor"),
      useLighting: gl.getUniformLocation(program, "uUseLighting"),
      lightDirection: gl.getUniformLocation(program, "uLightDirection"),
      ambientLight: gl.getUniformLocation(program, "uAmbientLight"),
      directionalLight: gl.getUniformLocation(program, "uDirectionalLight"),

      usePbr: gl.getUniformLocation(program, "uUsePbr"),
      hasMetallicRoughnessTexture: gl.getUniformLocation(
        program,
        "uHasMetallicRoughnessTexture",
      ),
      metallicRoughnessTexture: gl.getUniformLocation(
        program,
        "uMetallicRoughnessTexture",
      ),
      metallicFactor: gl.getUniformLocation(program, "uMetallicFactor"),
      roughnessFactor: gl.getUniformLocation(program, "uRoughnessFactor"),
      cameraPosition: gl.getUniformLocation(program, "uCameraPosition"),

      hasNormalTexture: gl.getUniformLocation(program, "uHasNormalTexture"),
      normalTexture: gl.getUniformLocation(program, "uNormalTexture"),
      normalScale: gl.getUniformLocation(program, "uNormalScale"),

      hasEmissiveTexture: gl.getUniformLocation(program, "uHasEmissiveTexture"),
      emissiveTexture: gl.getUniformLocation(program, "uEmissiveTexture"),
      emissiveFactor: gl.getUniformLocation(program, "uEmissiveFactor"),

      receiveShadow: gl.getUniformLocation(program, "uReceiveShadow"),
      shadowMap: gl.getUniformLocation(program, "uShadowMap"),
      shadowLightMatrix: gl.getUniformLocation(program, "uShadowLightMatrix"),
      shadowStrength: gl.getUniformLocation(program, "uShadowStrength"),
      shadowBias: gl.getUniformLocation(program, "uShadowBias"),
      localPlayerShadow: gl.getUniformLocation(program, "uLocalPlayerShadow"),
      localPlayerShadowCenter: gl.getUniformLocation(
        program,
        "uLocalPlayerShadowCenter",
      ),
      localPlayerShadowRadius: gl.getUniformLocation(
        program,
        "uLocalPlayerShadowRadius",
      ),
      localPlayerShadowStrength: gl.getUniformLocation(
        program,
        "uLocalPlayerShadowStrength",
      ),

      useSkinning: gl.getUniformLocation(program, "uUseSkinning"),

      jointTexture: gl.getUniformLocation(program, "uJointTexture"),
    };

    EXPERIMENTAL_3D.attributeLocations = {
      position: positionLoc,
      normal: normalLoc,

      color: colorLoc,

      texCoord: texCoordLoc,

      joints: jointsLoc,

      weights: weightsLoc,
    };

    EXPERIMENTAL_3D.groundTile = bindMesh(gl, buildGroundTileMesh());

    EXPERIMENTAL_3D.cube = bindMesh(gl, buildCubeMesh());

    const existingBarrierMesh = createEditorRibbonMesh(gl);
    const foundationMesh = createEditorRibbonMesh(gl);

    if (existingBarrierMesh && foundationMesh) {
      EXPERIMENTAL_3D.editorBarrierMeshes = {
        gl,
        existing: existingBarrierMesh,
        foundation: foundationMesh,
      };
    } else {
      if (existingBarrierMesh) {
        gl.deleteBuffer(existingBarrierMesh.posBuffer);
      }

      if (foundationMesh) {
        gl.deleteBuffer(foundationMesh.posBuffer);
      }

      EXPERIMENTAL_3D.editorBarrierMeshes = null;
      console.error("[3D] Failed to allocate foundation editor buffers.");
    }

    EXPERIMENTAL_3D.billboard = bindMesh(gl, buildBillboardMesh());

    EXPERIMENTAL_3D.bulletNormal = bindMesh(
      gl,
      buildBulletMesh([1.0, 0.22, 0.12, 1.0]),
    );

    EXPERIMENTAL_3D.bulletHighDamage = bindMesh(
      gl,
      buildBulletMesh([0.0, 0.92, 1.0, 1.0]),
    );

    EXPERIMENTAL_3D.axes = bindLineMesh(gl, buildAxesMesh());

    EXPERIMENTAL_3D.implantAimCircle = bindLineMesh(
      gl,
      buildImplantAimCircleMesh(96),
    );

    gl.enable(gl.DEPTH_TEST);

    gl.depthFunc(gl.LEQUAL);

    gl.enable(gl.BLEND);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.disable(gl.CULL_FACE);

    gl.clearColor(0.015, 0.018, 0.022, 1.0);

    gl.useProgram(program);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.useSkinning, 0);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.useLighting, 0);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.receiveShadow, 0);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.localPlayerShadow, 0);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.shadowMap, SHADOW_CONFIG.textureUnit);

    gl.uniform1f(
      EXPERIMENTAL_3D.uniforms.shadowStrength,
      SHADOW_CONFIG.strength,
    );

    gl.uniform1f(EXPERIMENTAL_3D.uniforms.shadowBias, SHADOW_CONFIG.bias);

    gl.uniform3fv(
      EXPERIMENTAL_3D.uniforms.lightDirection,
      GLTF_LIGHTING.direction,
    );

    gl.uniform1f(EXPERIMENTAL_3D.uniforms.ambientLight, GLTF_LIGHTING.ambient);

    gl.uniform1f(
      EXPERIMENTAL_3D.uniforms.directionalLight,
      GLTF_LIGHTING.directional,
    );

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.alphaMode, 3);
    gl.uniform1f(EXPERIMENTAL_3D.uniforms.alphaCutoff, 0.5);
    gl.uniform4f(EXPERIMENTAL_3D.uniforms.baseColorFactor, 1, 1, 1, 1);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.usePbr, 0);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.hasMetallicRoughnessTexture, 0);

    gl.uniform1i(
      EXPERIMENTAL_3D.uniforms.metallicRoughnessTexture,
      GLTF_MATERIAL_LIGHTING.metallicRoughnessTextureUnit,
    );

    gl.uniform1f(EXPERIMENTAL_3D.uniforms.metallicFactor, 1);
    gl.uniform1f(EXPERIMENTAL_3D.uniforms.roughnessFactor, 1);
    gl.uniform1i(EXPERIMENTAL_3D.uniforms.hasNormalTexture, 0);

    gl.uniform1i(
      EXPERIMENTAL_3D.uniforms.normalTexture,
      GLTF_MATERIAL_LIGHTING.normalTextureUnit,
    );

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.hasEmissiveTexture, 0);

    gl.uniform1i(
      EXPERIMENTAL_3D.uniforms.emissiveTexture,
      GLTF_MATERIAL_LIGHTING.emissiveTextureUnit,
    );

    gl.uniform3f(EXPERIMENTAL_3D.uniforms.emissiveFactor, 0, 0, 0);

    if (SHADOW_CONFIG.enabled) {
      ensureShadowMap();
    }

    console.log("[3D] WebGL2 renderer initialized.");

    console.log("[3D] BG tile ground texture pipeline enabled.");

    console.log("[3D] Player billboard atlas pipeline enabled.");

    console.log(
      "[3D] Controls: RMB drag = orbit, mouse wheel = camera distance.",
    );

    return true;
  }

  function getCanvasSize() {
    const canvas = EXPERIMENTAL_3D.canvas || getRenderCanvas("3d");

    if (!canvas) {
      return {
        width: 1280,
        height: 720,
        dpr: 1,
      };
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const width = Math.max(
      1,
      Math.floor((canvas.clientWidth || window.innerWidth) * dpr),
    );

    const height = Math.max(
      1,
      Math.floor((canvas.clientHeight || window.innerHeight) * dpr),
    );

    return {
      width,
      height,
      dpr,
    };
  }

  function resizeCanvas() {
    const canvas = EXPERIMENTAL_3D.canvas || getRenderCanvas("3d");

    if (!canvas) {
      return;
    }

    const { width, height } = getCanvasSize();

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function getLocalPlayer() {
    return window.engineSceneBridge?.getLocalPlayer?.() ?? null;
  }

  function updateCameraFromPlayer() {
    const me = getLocalPlayer();

    const cameraSystem = window.cameraSystem3D;

    if (cameraSystem && typeof cameraSystem.updateFromPlayer === "function") {
      const cameraState = cameraSystem.updateFromPlayer(me);

      if (
        cameraState &&
        Array.isArray(cameraState.target) &&
        Array.isArray(cameraState.position)
      ) {
        EXPERIMENTAL_3D.yaw = cameraState.yaw;

        EXPERIMENTAL_3D.pitch = cameraState.pitch;

        EXPERIMENTAL_3D.distance = cameraState.distance;

        EXPERIMENTAL_3D.target = [
          cameraState.target[0],
          cameraState.target[1],
          cameraState.target[2],
        ];

        EXPERIMENTAL_3D.position = [
          cameraState.position[0],
          cameraState.position[1],
          cameraState.position[2],
        ];

        return;
      }
    }

    const targetX = me ? me.x : 0;
    const targetY = 18;
    const targetZ = me ? me.y : 0;

    EXPERIMENTAL_3D.target = [targetX, targetY, targetZ];

    const horizontalDistance =
      Math.cos(EXPERIMENTAL_3D.pitch) * EXPERIMENTAL_3D.distance;

    const cameraX =
      targetX + Math.cos(EXPERIMENTAL_3D.yaw) * horizontalDistance;

    const cameraY =
      targetY + Math.sin(EXPERIMENTAL_3D.pitch) * EXPERIMENTAL_3D.distance + 40;

    const cameraZ =
      targetZ + Math.sin(EXPERIMENTAL_3D.yaw) * horizontalDistance;

    EXPERIMENTAL_3D.position = [cameraX, cameraY, cameraZ];
  }

  function getScreenRay3D(clientX, clientY) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return null;
    }

    const canvas = EXPERIMENTAL_3D.canvas || getRenderCanvas("3d");

    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return null;
    }

    updateCameraFromPlayer();

    if (window.cameraSystem3D?.getMode?.() === "isometric") {
      const canvas2D = getRenderCanvas("2d");

      const zoom = window.engineSceneBridge?.getCameraViewport?.()?.zoom || 1;

      const viewportWidth = (canvas2D?.width || canvas.width) / zoom;

      const viewportHeight = (canvas2D?.height || canvas.height) / zoom;

      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;

      const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;

      const cameraPosition = EXPERIMENTAL_3D.position;
      const cameraTarget = EXPERIMENTAL_3D.target;

      const forward = Vec3.normalize(
        Vec3.subtract(cameraTarget, cameraPosition),
      );

      const right = Vec3.normalize(Vec3.cross(forward, [0, 1, 0]));

      const up = Vec3.normalize(Vec3.cross(right, forward));

      // Ортографическая камера: лучи параллельны,
      // но имеют разные точки начала.
      const origin = [
        cameraPosition[0] +
          right[0] * ndcX * viewportWidth * 0.5 +
          up[0] * ndcY * viewportHeight * 0.5,

        cameraPosition[1] +
          right[1] * ndcX * viewportWidth * 0.5 +
          up[1] * ndcY * viewportHeight * 0.5,

        cameraPosition[2] +
          right[2] * ndcX * viewportWidth * 0.5 +
          up[2] * ndcY * viewportHeight * 0.5,
      ];

      return {
        origin,
        direction: forward,
      };
    }

    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;

    const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;

    const aspect = rect.width / rect.height;

    const tanHalfFov = Math.tan(EXPERIMENTAL_3D.FOV_Y / 2);

    const origin = [...EXPERIMENTAL_3D.position];

    const forward = Vec3.normalize(
      Vec3.subtract(EXPERIMENTAL_3D.target, origin),
    );

    const right = Vec3.normalize(Vec3.cross(forward, [0, 1, 0]));

    if (
      Math.abs(right[0]) < 0.000001 &&
      Math.abs(right[1]) < 0.000001 &&
      Math.abs(right[2]) < 0.000001
    ) {
      return null;
    }

    const up = Vec3.normalize(Vec3.cross(right, forward));

    const direction = Vec3.normalize([
      forward[0] +
        right[0] * ndcX * aspect * tanHalfFov +
        up[0] * ndcY * tanHalfFov,

      forward[1] +
        right[1] * ndcX * aspect * tanHalfFov +
        up[1] * ndcY * tanHalfFov,

      forward[2] +
        right[2] * ndcX * aspect * tanHalfFov +
        up[2] * ndcY * tanHalfFov,
    ]);

    return {
      origin,
      direction,
    };
  }

  function intersectRaySphere3D(
    rayOrigin,
    rayDirection,
    sphereCenter,
    sphereRadius,
  ) {
    const ox = rayOrigin[0] - sphereCenter[0];

    const oy = rayOrigin[1] - sphereCenter[1];

    const oz = rayOrigin[2] - sphereCenter[2];

    const b =
      ox * rayDirection[0] + oy * rayDirection[1] + oz * rayDirection[2];

    const c = ox * ox + oy * oy + oz * oz - sphereRadius * sphereRadius;

    const discriminant = b * b - c;

    if (discriminant < 0) {
      return null;
    }

    const sqrtDiscriminant = Math.sqrt(discriminant);

    const tNear = -b - sqrtDiscriminant;

    const tFar = -b + sqrtDiscriminant;

    if (tNear >= 0) {
      return tNear;
    }

    if (tFar >= 0) {
      return tFar;
    }

    return null;
  }

  function pickEnemy3D(clientX, clientY) {
    if (!EXPERIMENTAL_3D.enabled) {
      return null;
    }

    const ray = getScreenRay3D(clientX, clientY);

    if (!ray) {
      return null;
    }

    const sceneBridge = window.engineSceneBridge;

    if (!sceneBridge?.isReady?.()) {
      return null;
    }

    const enemies = sceneBridge.getTargetableEnemies?.();

    if (!(enemies instanceof Map)) {
      return null;
    }

    const currentWorldId = sceneBridge.getWorldId?.();

    if (currentWorldId === null || currentWorldId === undefined) {
      return null;
    }

    let bestEnemyId = null;
    let bestDistance = Infinity;

    enemies.forEach((enemy, enemyId) => {
      if (
        !enemy ||
        enemy.worldId !== currentWorldId ||
        Number(enemy.health) <= 0 ||
        !Number.isFinite(enemy.x) ||
        !Number.isFinite(enemy.y)
      ) {
        return;
      }

      const sphereCenter = window.coordinateSystem3D?.gameToRenderPosition?.(
        enemy.x + ENEMY_CENTER_OFFSET_X,
        enemy.y + ENEMY_FEET_OFFSET_Z,
        ENEMY_RENDER_Y + ENEMY_RENDER_HEIGHT * 0.5,
      );

      if (!sphereCenter) {
        return;
      }

      const sphereRadius =
        Math.max(ENEMY_RENDER_WIDTH, ENEMY_RENDER_HEIGHT) * 0.55;

      const hitDistance = intersectRaySphere3D(
        ray.origin,
        ray.direction,
        sphereCenter,
        sphereRadius,
      );

      if (hitDistance !== null && hitDistance < bestDistance) {
        bestDistance = hitDistance;
        bestEnemyId = enemyId;
      }
    });

    return bestEnemyId;
  }

  function screenToWorld(clientX, clientY) {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return null;
    }

    const canvas = EXPERIMENTAL_3D.canvas || getRenderCanvas("3d");

    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return null;
    }

    updateCameraFromPlayer();

    if (window.cameraSystem3D?.getMode?.() === "isometric") {
      const ray = getScreenRay3D(clientX, clientY);

      if (!ray || Math.abs(ray.direction[1]) < 0.000001) {
        return null;
      }

      const groundY = EXPERIMENTAL_3D.GROUND_TEXTURE_Y;

      const t = (groundY - ray.origin[1]) / ray.direction[1];

      if (!Number.isFinite(t) || t < 0) {
        return null;
      }

      const renderX = ray.origin[0] + ray.direction[0] * t;

      const renderZ = ray.origin[2] + ray.direction[2] * t;

      const gamePosition = window.coordinateSystem3D?.renderToGamePosition?.(
        renderX,
        groundY,
        renderZ,
      );

      if (
        !gamePosition ||
        !Number.isFinite(gamePosition.x) ||
        !Number.isFinite(gamePosition.y)
      ) {
        return null;
      }

      return {
        x: gamePosition.x,
        y: gamePosition.y,
      };
    }

    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;

    const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;

    const aspect = rect.width / rect.height;

    const tanHalfFov = Math.tan(EXPERIMENTAL_3D.FOV_Y / 2);

    const origin = EXPERIMENTAL_3D.position;

    const forward = Vec3.normalize(
      Vec3.subtract(EXPERIMENTAL_3D.target, origin),
    );

    const right = Vec3.normalize(Vec3.cross(forward, [0, 1, 0]));

    if (
      Math.abs(right[0]) < 0.000001 &&
      Math.abs(right[1]) < 0.000001 &&
      Math.abs(right[2]) < 0.000001
    ) {
      return null;
    }

    const up = Vec3.normalize(Vec3.cross(right, forward));

    const direction = Vec3.normalize([
      forward[0] +
        right[0] * ndcX * aspect * tanHalfFov +
        up[0] * ndcY * tanHalfFov,

      forward[1] +
        right[1] * ndcX * aspect * tanHalfFov +
        up[1] * ndcY * tanHalfFov,

      forward[2] +
        right[2] * ndcX * aspect * tanHalfFov +
        up[2] * ndcY * tanHalfFov,
    ]);

    const groundY = EXPERIMENTAL_3D.GROUND_TEXTURE_Y;

    if (Math.abs(direction[1]) < 0.000001) {
      return null;
    }

    const t = (groundY - origin[1]) / direction[1];

    if (!Number.isFinite(t) || t < 0) {
      return null;
    }

    const renderX = origin[0] + direction[0] * t;
    const renderZ = origin[2] + direction[2] * t;

    if (!Number.isFinite(renderX) || !Number.isFinite(renderZ)) {
      return null;
    }

    const gamePosition = window.coordinateSystem3D?.renderToGamePosition?.(
      renderX,
      groundY,
      renderZ,
    );

    if (!gamePosition) {
      return null;
    }

    return {
      x: gamePosition.x,
      y: gamePosition.y,
    };
  }

  function getShouldCaptureMouse() {
    return window.engineSceneBridge?.canCaptureGamePointer?.() === true;
  }

  function attachInputHandlers() {
    const canvas = getRenderCanvas("3d");

    if (!canvas) {
      return false;
    }

    const cameraSystem = window.cameraSystem3D;

    if (
      !cameraSystem ||
      typeof cameraSystem.attachInputHandlers !== "function"
    ) {
      console.error("[3D] cameraSystem3D is unavailable.");

      return false;
    }

    return cameraSystem.attachInputHandlers(canvas, {
      canCaptureInput: getShouldCaptureMouse,
    });
  }

  function setEnabled(nextEnabled) {
    EXPERIMENTAL_3D.enabled = Boolean(nextEnabled);

    if (!EXPERIMENTAL_3D.enabled) {
      window.cameraSystem3D?.cancelInteraction?.();

      if (EXPERIMENTAL_3D.canvas) {
        EXPERIMENTAL_3D.canvas.style.display = "none";
      }

      return true;
    }

    if (ensureResources()) {
      resizeCanvas();
      attachInputHandlers();

      console.log("[3D] Experimental renderer ENABLED.");

      return true;
    }

    EXPERIMENTAL_3D.enabled = false;

    window.cameraSystem3D?.cancelInteraction?.();

    if (EXPERIMENTAL_3D.canvas) {
      EXPERIMENTAL_3D.canvas.style.display = "none";
    }

    console.error("[3D] Experimental renderer failed to initialize.");

    return false;
  }

  function getOrCreateGltfVao(primitive, skinned = false) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !primitive || primitive.gl !== gl) {
      return null;
    }

    const key = skinned ? "skinnedVao" : "vao";

    if (primitive[key]) {
      return primitive[key];
    }

    const attributes = EXPERIMENTAL_3D.attributeLocations;

    if (
      !attributes ||
      attributes.position < 0 ||
      attributes.color < 0 ||
      attributes.texCoord < 0
    ) {
      return null;
    }

    if (
      skinned &&
      (attributes.joints < 0 ||
        attributes.weights < 0 ||
        !primitive.jointBuffer ||
        !primitive.weightBuffer ||
        !primitive.jointComponentType)
    ) {
      return null;
    }

    const vao = gl.createVertexArray();

    if (!vao) {
      return null;
    }

    const previousVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
    const previousArrayBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);

    try {
      gl.bindVertexArray(vao);

      gl.bindBuffer(gl.ARRAY_BUFFER, primitive.posBuffer);
      gl.enableVertexAttribArray(attributes.position);
      gl.vertexAttribPointer(attributes.position, 3, gl.FLOAT, false, 0, 0);

      if (attributes.normal >= 0) {
        if (primitive.normalBuffer) {
          gl.bindBuffer(gl.ARRAY_BUFFER, primitive.normalBuffer);
          gl.enableVertexAttribArray(attributes.normal);
          gl.vertexAttribPointer(attributes.normal, 3, gl.FLOAT, false, 0, 0);
        } else {
          gl.disableVertexAttribArray(attributes.normal);
        }
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, primitive.colorBuffer);
      gl.enableVertexAttribArray(attributes.color);
      gl.vertexAttribPointer(attributes.color, 4, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, primitive.uvBuffer);
      gl.enableVertexAttribArray(attributes.texCoord);
      gl.vertexAttribPointer(attributes.texCoord, 2, gl.FLOAT, false, 0, 0);

      if (attributes.joints >= 0) {
        if (skinned) {
          gl.bindBuffer(gl.ARRAY_BUFFER, primitive.jointBuffer);
          gl.enableVertexAttribArray(attributes.joints);
          gl.vertexAttribIPointer(
            attributes.joints,
            4,
            primitive.jointComponentType,
            0,
            0,
          );
        } else {
          gl.disableVertexAttribArray(attributes.joints);
        }
      }

      if (attributes.weights >= 0) {
        if (skinned) {
          gl.bindBuffer(gl.ARRAY_BUFFER, primitive.weightBuffer);
          gl.enableVertexAttribArray(attributes.weights);
          gl.vertexAttribPointer(attributes.weights, 4, gl.FLOAT, false, 0, 0);
        } else {
          gl.disableVertexAttribArray(attributes.weights);
        }
      }

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, primitive.indexBuffer);

      primitive[key] = vao;

      return vao;
    } finally {
      gl.bindVertexArray(previousVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, previousArrayBuffer);
    }
  }

  function bindIndexedMeshForDraw(mesh) {
    const gl = EXPERIMENTAL_3D.gl;

    gl.bindVertexArray(null);

    if (!mesh.normalBuffer) {
      setGltfLighting(false);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posBuffer);

    gl.enableVertexAttribArray(EXPERIMENTAL_3D.attributeLocations.position);

    gl.vertexAttribPointer(
      EXPERIMENTAL_3D.attributeLocations.position,
      3,
      gl.FLOAT,
      false,
      0,
      0,
    );

    const normalLoc = EXPERIMENTAL_3D.attributeLocations.normal;

    if (normalLoc >= 0) {
      if (mesh.normalBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
        gl.enableVertexAttribArray(normalLoc);
        gl.vertexAttribPointer(normalLoc, 3, gl.FLOAT, false, 0, 0);
      } else {
        gl.disableVertexAttribArray(normalLoc);
        gl.vertexAttrib3f(normalLoc, 0, 1, 0);
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.colorBuffer);

    gl.enableVertexAttribArray(EXPERIMENTAL_3D.attributeLocations.color);

    gl.vertexAttribPointer(
      EXPERIMENTAL_3D.attributeLocations.color,
      4,
      gl.FLOAT,
      false,
      0,
      0,
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uvBuffer);

    gl.enableVertexAttribArray(EXPERIMENTAL_3D.attributeLocations.texCoord);

    gl.vertexAttribPointer(
      EXPERIMENTAL_3D.attributeLocations.texCoord,
      2,
      gl.FLOAT,
      false,
      0,
      0,
    );

    const jointsLoc = EXPERIMENTAL_3D.attributeLocations?.joints;

    const weightsLoc = EXPERIMENTAL_3D.attributeLocations?.weights;

    if (Number.isInteger(jointsLoc) && jointsLoc >= 0) {
      gl.disableVertexAttribArray(jointsLoc);

      gl.vertexAttribI4ui(jointsLoc, 0, 0, 0, 0);
    }

    if (Number.isInteger(weightsLoc) && weightsLoc >= 0) {
      gl.disableVertexAttribArray(weightsLoc);

      gl.vertexAttrib4f(weightsLoc, 1, 0, 0, 0);
    }

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
  }

  function drawIndexedMesh(mesh, modelMatrix) {
    const gl = EXPERIMENTAL_3D.gl;

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.useSkinning, 0);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 0);

    gl.uniform4f(EXPERIMENTAL_3D.uniforms.uvRect, 0, 0, 1, 1);

    bindIndexedMeshForDraw(mesh);

    gl.uniformMatrix4fv(EXPERIMENTAL_3D.uniforms.model, false, modelMatrix);

    trackedDrawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }

  function drawStaticBox3D(geometry) {
    const gl = EXPERIMENTAL_3D.gl;
    const cube = EXPERIMENTAL_3D.cube;
    const coordinateSystem3D = window.coordinateSystem3D;

    if (!gl || !cube || !coordinateSystem3D || !geometry) {
      return;
    }

    if (geometry.visible === false) {
      return;
    }

    if (
      !Number.isFinite(geometry.x) ||
      !Number.isFinite(geometry.y) ||
      !Number.isFinite(geometry.width) ||
      !Number.isFinite(geometry.depth) ||
      !Number.isFinite(geometry.height)
    ) {
      return;
    }

    if (geometry.width <= 0 || geometry.depth <= 0 || geometry.height <= 0) {
      return;
    }

    const baseHeight = Number.isFinite(geometry.baseHeight)
      ? geometry.baseHeight
      : 0;

    const rotation = Number.isFinite(geometry.rotation) ? geometry.rotation : 0;

    const centerHeight = baseHeight + geometry.height * 0.5;

    const renderPosition = coordinateSystem3D.gameToRenderPosition(
      geometry.x,
      geometry.y,
      centerHeight,
    );

    if (!renderPosition) {
      return;
    }

    const translation = Mat4.translation(
      renderPosition[0],
      renderPosition[1],
      renderPosition[2],
    );

    const rotationMatrix = Mat4.rotationY(rotation);

    const scale = Mat4.scaling(
      geometry.width * 0.5,
      geometry.height * 0.5,
      geometry.depth * 0.5,
    );

    const translationRotation = Mat4.multiply(translation, rotationMatrix);

    const model = Mat4.multiply(translationRotation, scale);

    drawIndexedMesh(cube, model);
  }

  function updateEditorRibbonMesh(mesh, segments, width, controlPoints = []) {
    if (!mesh || mesh.gl !== EXPERIMENTAL_3D.gl) {
      return;
    }

    const coordinateCount = segments.length * 4 + controlPoints.length * 2;
    let coordinatesChanged = mesh.sourceCoordinates.length !== coordinateCount;

    if (!coordinatesChanged) {
      let coordinateIndex = 0;

      for (const segment of segments) {
        const x1 = Number.isFinite(segment?.x1) ? segment.x1 : NaN;
        const y1 = Number.isFinite(segment?.y1) ? segment.y1 : NaN;
        const x2 = Number.isFinite(segment?.x2) ? segment.x2 : NaN;
        const y2 = Number.isFinite(segment?.y2) ? segment.y2 : NaN;

        if (
          !Object.is(mesh.sourceCoordinates[coordinateIndex++], x1) ||
          !Object.is(mesh.sourceCoordinates[coordinateIndex++], y1) ||
          !Object.is(mesh.sourceCoordinates[coordinateIndex++], x2) ||
          !Object.is(mesh.sourceCoordinates[coordinateIndex++], y2)
        ) {
          coordinatesChanged = true;
          break;
        }
      }

      for (const point of controlPoints) {
        if (coordinatesChanged) {
          break;
        }

        const x = Number.isFinite(point?.x) ? point.x : NaN;
        const y = Number.isFinite(point?.y) ? point.y : NaN;

        if (
          !Object.is(mesh.sourceCoordinates[coordinateIndex++], x) ||
          !Object.is(mesh.sourceCoordinates[coordinateIndex++], y)
        ) {
          coordinatesChanged = true;
        }
      }
    }

    if (!coordinatesChanged) {
      return;
    }

    const sourceCoordinates = new Float64Array(coordinateCount);
    const vertices = [];
    const endpoints = [];
    let coordinateIndex = 0;

    for (const segment of segments) {
      const x1 = Number.isFinite(segment?.x1) ? segment.x1 : NaN;
      const y1 = Number.isFinite(segment?.y1) ? segment.y1 : NaN;
      const x2 = Number.isFinite(segment?.x2) ? segment.x2 : NaN;
      const y2 = Number.isFinite(segment?.y2) ? segment.y2 : NaN;

      sourceCoordinates[coordinateIndex++] = x1;
      sourceCoordinates[coordinateIndex++] = y1;
      sourceCoordinates[coordinateIndex++] = x2;
      sourceCoordinates[coordinateIndex++] = y2;

      if (
        !Number.isFinite(x1) ||
        !Number.isFinite(y1) ||
        !Number.isFinite(x2) ||
        !Number.isFinite(y2)
      ) {
        continue;
      }

      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.hypot(dx, dy);

      if (length < 0.001) {
        continue;
      }

      const offsetX = (-dy / length) * (width * 0.5);
      const offsetY = (dx / length) * (width * 0.5);

      const p1Left = window.coordinateSystem3D?.gameToRenderPosition?.(
        x1 + offsetX,
        y1 + offsetY,
        EDITOR_BARRIER_HEIGHT,
      );
      const p1Right = window.coordinateSystem3D?.gameToRenderPosition?.(
        x1 - offsetX,
        y1 - offsetY,
        EDITOR_BARRIER_HEIGHT,
      );
      const p2Left = window.coordinateSystem3D?.gameToRenderPosition?.(
        x2 + offsetX,
        y2 + offsetY,
        EDITOR_BARRIER_HEIGHT,
      );
      const p2Right = window.coordinateSystem3D?.gameToRenderPosition?.(
        x2 - offsetX,
        y2 - offsetY,
        EDITOR_BARRIER_HEIGHT,
      );

      if (!p1Left || !p1Right || !p2Left || !p2Right) {
        continue;
      }

      vertices.push(
        ...p1Left,
        ...p1Right,
        ...p2Left,
        ...p1Right,
        ...p2Right,
        ...p2Left,
      );

      endpoints.push({ x: x1, y: y1 }, { x: x2, y: y2 });
    }

    for (const point of controlPoints) {
      sourceCoordinates[coordinateIndex++] = Number.isFinite(point?.x)
        ? point.x
        : NaN;
      sourceCoordinates[coordinateIndex++] = Number.isFinite(point?.y)
        ? point.y
        : NaN;
    }

    const jointGroups = [];

    for (const endpoint of endpoints) {
      let matchingGroup = null;

      for (const group of jointGroups) {
        const belongsToGroup = group.endpoints.every((member) => {
          const dx = endpoint.x - member.x;
          const dy = endpoint.y - member.y;
          return dx * dx + dy * dy <= EDITOR_JOIN_TOLERANCE_SQ;
        });

        if (belongsToGroup) {
          matchingGroup = group;
          break;
        }
      }

      if (matchingGroup) {
        matchingGroup.endpoints.push(endpoint);
      } else {
        jointGroups.push({ endpoints: [endpoint] });
      }
    }

    for (const group of jointGroups) {
      if (group.endpoints.length < 2) {
        continue;
      }

      let centerX = 0;
      let centerY = 0;

      for (const endpoint of group.endpoints) {
        centerX += endpoint.x;
        centerY += endpoint.y;
      }

      centerX /= group.endpoints.length;
      centerY /= group.endpoints.length;

      let maxDistanceSq = 0;

      for (const endpoint of group.endpoints) {
        const dx = endpoint.x - centerX;
        const dy = endpoint.y - centerY;
        maxDistanceSq = Math.max(maxDistanceSq, dx * dx + dy * dy);
      }

      const center = window.coordinateSystem3D?.gameToRenderPosition?.(
        centerX,
        centerY,
        EDITOR_BARRIER_HEIGHT,
      );

      if (!center) {
        continue;
      }

      const radius = width * 0.5 + Math.sqrt(maxDistanceSq);
      const slices = 12;

      for (let i = 0; i < slices; i++) {
        const angle0 = (i / slices) * Math.PI * 2;
        const angle1 = ((i + 1) / slices) * Math.PI * 2;

        vertices.push(
          center[0],
          center[1],
          center[2],
          center[0] + Math.cos(angle0) * radius,
          center[1],
          center[2] + Math.sin(angle0) * radius,
          center[0] + Math.cos(angle1) * radius,
          center[1],
          center[2] + Math.sin(angle1) * radius,
        );
      }
    }

    for (const point of controlPoints) {
      if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
        continue;
      }

      const center = window.coordinateSystem3D?.gameToRenderPosition?.(
        point.x,
        point.y,
        EDITOR_BARRIER_HEIGHT,
      );

      if (!center) {
        continue;
      }

      const radius = width * 0.8;
      const slices = 12;

      for (let i = 0; i < slices; i++) {
        const angle0 = (i / slices) * Math.PI * 2;
        const angle1 = ((i + 1) / slices) * Math.PI * 2;

        vertices.push(
          center[0],
          center[1],
          center[2],
          center[0] + Math.cos(angle0) * radius,
          center[1],
          center[2] + Math.sin(angle0) * radius,
          center[0] + Math.cos(angle1) * radius,
          center[1],
          center[2] + Math.sin(angle1) * radius,
        );
      }
    }

    mesh.sourceCoordinates = sourceCoordinates;
    mesh.vertexCount = vertices.length / 3;

    if (vertices.length === 0) {
      return;
    }

    const positions = new Float32Array(vertices);
    const byteLength = positions.byteLength;
    const gl = mesh.gl;

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posBuffer);

    if (byteLength > mesh.capacityBytes) {
      mesh.capacityBytes = Math.max(256, 2 ** Math.ceil(Math.log2(byteLength)));
      gl.bufferData(gl.ARRAY_BUFFER, mesh.capacityBytes, gl.DYNAMIC_DRAW);
    }

    gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
  }

  function drawEditorRibbonMesh(mesh, color) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !mesh || mesh.gl !== gl || mesh.vertexCount === 0) {
      return;
    }
    gl.bindVertexArray(null);

    const attributes = EXPERIMENTAL_3D.attributeLocations;

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 0);
    gl.uniform1i(EXPERIMENTAL_3D.uniforms.useSkinning, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.uniform4f(EXPERIMENTAL_3D.uniforms.uvRect, 0, 0, 1, 1);
    gl.uniformMatrix4fv(
      EXPERIMENTAL_3D.uniforms.model,
      false,
      EDITOR_IDENTITY_MATRIX,
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posBuffer);
    gl.enableVertexAttribArray(attributes.position);
    gl.vertexAttribPointer(attributes.position, 3, gl.FLOAT, false, 0, 0);

    gl.disableVertexAttribArray(attributes.color);
    gl.vertexAttrib4f(attributes.color, color[0], color[1], color[2], 1);

    gl.disableVertexAttribArray(attributes.texCoord);
    gl.vertexAttrib2f(attributes.texCoord, 0, 0);

    if (attributes.joints >= 0) {
      gl.disableVertexAttribArray(attributes.joints);
      gl.vertexAttribI4ui(attributes.joints, 0, 0, 0, 0);
    }

    if (attributes.weights >= 0) {
      gl.disableVertexAttribArray(attributes.weights);
      gl.vertexAttrib4f(attributes.weights, 1, 0, 0, 0);
    }

    trackedDrawArrays(gl.TRIANGLES, 0, mesh.vertexCount);
  }

  function drawFoundationEditor3D() {
    const data = getEditorRenderData();

    if (!data) {
      return;
    }

    const meshes = EXPERIMENTAL_3D.editorBarrierMeshes;

    if (!meshes || meshes.gl !== EXPERIMENTAL_3D.gl) {
      return;
    }

    const existingBarriers = Array.isArray(data.existingBarriers)
      ? data.existingBarriers
      : [];
    const foundationSegments = Array.isArray(data.segments)
      ? data.segments
      : [];

    updateEditorRibbonMesh(
      meshes.existing,
      existingBarriers,
      EDITOR_BARRIER_WIDTH,
    );
    updateEditorRibbonMesh(
      meshes.foundation,
      foundationSegments,
      EDITOR_FOUNDATION_WIDTH,
      Array.isArray(data.points) ? data.points : [],
    );

    const gl = EXPERIMENTAL_3D.gl;
    const depthTestEnabled = gl.isEnabled(gl.DEPTH_TEST);
    const depthWriteEnabled = gl.getParameter(gl.DEPTH_WRITEMASK);

    try {
      // Debug contours intentionally overlay the building and ground,
      // without changing the depth buffer used by subsequent world draws.
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false);

      drawEditorRibbonMesh(meshes.existing, [1.0, 0.58, 0.12]);
      drawEditorRibbonMesh(meshes.foundation, [0.12, 0.95, 0.55]);
    } finally {
      if (depthTestEnabled) {
        gl.enable(gl.DEPTH_TEST);
      } else {
        gl.disable(gl.DEPTH_TEST);
      }

      gl.depthMask(depthWriteEnabled);
    }
  }

  function buildShadowLightMatrix(center) {
    const direction = Vec3.normalize(GLTF_LIGHTING.direction);

    const eye = [
      center[0] + direction[0] * SHADOW_CONFIG.lightDistance,
      center[1] + direction[1] * SHADOW_CONFIG.lightDistance,
      center[2] + direction[2] * SHADOW_CONFIG.lightDistance,
    ];

    const view = Mat4.lookAt(eye, center, [0, 1, 0]);

    const r = SHADOW_CONFIG.radius;

    const projection = Mat4.orthographic(
      -r,
      r,
      -r,
      r,
      1,
      SHADOW_CONFIG.depthRange,
    );

    return Mat4.multiply(projection, view);
  }

  function drawShadowPrimitive(primitive, modelMatrix) {
    const gl = EXPERIMENTAL_3D.gl;
    const loc = SHADOW_MAP.locations;

    if (!primitive?.posBuffer || !primitive.indexBuffer) {
      return;
    }

    const material = primitive.material;
    const alphaMode = material?.alphaMode ?? "OPAQUE";

    if (alphaMode === "BLEND") {
      return;
    }

    const previousCull = gl.isEnabled(gl.CULL_FACE);

    if (material?.doubleSided) {
      gl.disable(gl.CULL_FACE);
    }

    try {
      gl.bindBuffer(gl.ARRAY_BUFFER, primitive.posBuffer);
      gl.enableVertexAttribArray(loc.position);
      gl.vertexAttribPointer(loc.position, 3, gl.FLOAT, false, 0, 0);

      const masked = alphaMode === "MASK";
      const texture = masked ? material?.baseColorTexture : null;

      gl.uniform1i(loc.alphaMask, masked ? 1 : 0);
      gl.uniform1i(loc.hasTexture, texture ? 1 : 0);
      gl.uniform1f(loc.alphaCutoff, material?.alphaCutoff ?? 0.5);
      gl.uniform1f(loc.baseAlpha, material?.baseColorFactor?.[3] ?? 1);

      if (loc.texCoord >= 0) {
        if (masked && texture && primitive.uvBuffer) {
          gl.bindBuffer(gl.ARRAY_BUFFER, primitive.uvBuffer);
          gl.enableVertexAttribArray(loc.texCoord);
          gl.vertexAttribPointer(loc.texCoord, 2, gl.FLOAT, false, 0, 0);
        } else {
          gl.disableVertexAttribArray(loc.texCoord);
          gl.vertexAttrib2f(loc.texCoord, 0, 0);
        }
      }

      if (texture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
      }

      gl.uniformMatrix4fv(loc.model, false, modelMatrix);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, primitive.indexBuffer);

      gl.drawElements(gl.TRIANGLES, primitive.count, primitive.indexType, 0);

      SHADOW_MAP.drawCalls++;
    } finally {
      if (previousCull) {
        gl.enable(gl.CULL_FACE);
      } else {
        gl.disable(gl.CULL_FACE);
      }
    }
  }

  function drawShadowGltfNode(gpuAsset, nodeIndex, parentMatrix) {
    const node = gpuAsset.sourceAsset.nodes?.[nodeIndex];

    if (!node) {
      return;
    }

    const localMatrix = buildGltfNodeLocalMatrix(node.transform);
    const worldMatrix = Mat4.multiply(parentMatrix, localMatrix);

    if (Number.isInteger(node.mesh)) {
      const mesh = gpuAsset.meshes?.[node.mesh];

      for (const primitive of mesh?.primitives ?? []) {
        if (!primitive.isSkinned) {
          drawShadowPrimitive(primitive, worldMatrix);
        }
      }
    }

    for (const childIndex of node.children ?? []) {
      drawShadowGltfNode(gpuAsset, childIndex, worldMatrix);
    }
  }

  function drawShadowStaticModel(geometry, gpuAsset) {
    const bounds = gpuAsset.bounds;

    const scaleX = Number.isFinite(geometry.scaleX) ? geometry.scaleX : 1;
    const scaleY = Number.isFinite(geometry.scaleY) ? geometry.scaleY : 1;
    const scaleZ = Number.isFinite(geometry.scaleZ) ? geometry.scaleZ : 1;

    const groundAlignmentOffset =
      geometry.groundAlign !== false && Number.isFinite(bounds?.minY)
        ? -bounds.minY * scaleY
        : 0;

    const height =
      (Number.isFinite(geometry.baseHeight) ? geometry.baseHeight : 0) +
      (Number.isFinite(geometry.groundOffset) ? geometry.groundOffset : 0) +
      groundAlignmentOffset;

    const position = window.coordinateSystem3D?.gameToRenderPosition?.(
      geometry.x,
      geometry.y,
      height,
    );

    if (!position) {
      return;
    }

    const modelMatrix = Mat4.multiply(
      Mat4.multiply(
        Mat4.translation(position[0], position[1], position[2]),
        Mat4.rotationY(
          Number.isFinite(geometry.rotation) ? geometry.rotation : 0,
        ),
      ),
      Mat4.scaling(scaleX, scaleY, scaleZ),
    );

    for (const rootIndex of gpuAsset.sourceAsset.rootNodes ?? []) {
      drawShadowGltfNode(gpuAsset, rootIndex, modelMatrix);
    }
  }

  function resolveStaticShadowCaster(entry) {
    const source = entry.source;
    const renderObject = entry.renderObject;

    if (source?.type !== "model") {
      return null;
    }

    const levels = Array.isArray(source.lodLevels) ? source.lodLevels : null;

    if (levels?.length) {
      const assets = window.gltfAssetSystem3D;

      for (let i = levels.length - 1; i >= 0; i--) {
        const assetUrl = levels[i]?.assetUrl;

        if (
          typeof assetUrl !== "string" ||
          !assetUrl ||
          !assets?.get?.(assetUrl)
        ) {
          continue;
        }

        const gpuAsset = getOrCreateGltfGpuAsset(assetUrl);

        if (gpuAsset) {
          return {
            geometry: source,
            gpuAsset,
            assetUrl,
          };
        }
      }
    }

    const assetUrl = renderObject?.assetUrl;
    const gpuAsset = EXPERIMENTAL_3D.modelAssets.get(assetUrl);

    if (!gpuAsset) {
      return null;
    }

    return {
      geometry: renderObject,
      gpuAsset,
      assetUrl,
    };
  }

  function getStaticShadowCacheKey(center) {
    const step = SHADOW_CONFIG.cacheStep;

    const snappedX = Math.round(center[0] / step) * step;
    const snappedZ = Math.round(center[2] / step) * step;

    const shadowCenter = [snappedX, center[1], snappedZ];

    const parts = [STATIC_MODEL_FRAME.worldId, snappedX, center[1], snappedZ];

    for (const entry of STATIC_MODEL_FRAME.objects) {
      if (entry.source.type !== "model") {
        continue;
      }

      const caster = resolveStaticShadowCaster(entry);

      const geometry = caster?.geometry ?? entry.source;

      parts.push(
        geometry.id,
        caster?.assetUrl ?? "",
        geometry.x,
        geometry.y,
        geometry.rotation,
        geometry.scaleX,
        geometry.scaleY,
        geometry.scaleZ,
        geometry.baseHeight,
        geometry.groundOffset,
        geometry.groundAlign,
      );
    }

    return {
      key: parts.join("|"),
      center: shadowCenter,
    };
  }

  function renderStaticShadowDepthPass() {
    const gl = EXPERIMENTAL_3D.gl;

    if (
      !gl ||
      !SHADOW_MAP.ready ||
      !ensureShadowDepthProgram() ||
      !STATIC_MODEL_FRAME.prepared
    ) {
      return;
    }

    const center = EXPERIMENTAL_3D.target;

    if (!center || !center.every(Number.isFinite)) {
      return;
    }

    const cache = getStaticShadowCacheKey(center);

    if (SHADOW_MAP.cacheKey === cache.key) {
      SHADOW_MAP.cacheHits++;
      return;
    }

    if (!SHADOW_MAP.vao) {
      SHADOW_MAP.vao = gl.createVertexArray();

      if (!SHADOW_MAP.vao) {
        return;
      }
    }

    const previousVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);

    const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    const previousViewport = gl.getParameter(gl.VIEWPORT);
    const previousProgram = gl.getParameter(gl.CURRENT_PROGRAM);
    const previousActiveTexture = gl.getParameter(gl.ACTIVE_TEXTURE);
    const previousArrayBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
    const previousElementBuffer = gl.getParameter(
      gl.ELEMENT_ARRAY_BUFFER_BINDING,
    );

    const previousDepthTest = gl.isEnabled(gl.DEPTH_TEST);
    const previousBlend = gl.isEnabled(gl.BLEND);
    const previousCull = gl.isEnabled(gl.CULL_FACE);
    const previousPolygonOffset = gl.isEnabled(gl.POLYGON_OFFSET_FILL);

    const previousDepthMask = gl.getParameter(gl.DEPTH_WRITEMASK);
    const previousColorMask = gl.getParameter(gl.COLOR_WRITEMASK);
    const previousDepthFunc = gl.getParameter(gl.DEPTH_FUNC);
    const previousPolygonFactor = gl.getParameter(gl.POLYGON_OFFSET_FACTOR);
    const previousPolygonUnits = gl.getParameter(gl.POLYGON_OFFSET_UNITS);

    gl.activeTexture(gl.TEXTURE0);
    const previousTexture0 = gl.getParameter(gl.TEXTURE_BINDING_2D);

    SHADOW_MAP.drawCalls = 0;

    try {
      SHADOW_MAP.lightMatrix = buildShadowLightMatrix(cache.center);

      gl.bindFramebuffer(gl.FRAMEBUFFER, SHADOW_MAP.framebuffer);
      gl.viewport(0, 0, SHADOW_CONFIG.mapSize, SHADOW_CONFIG.mapSize);

      gl.colorMask(false, false, false, false);
      gl.depthMask(true);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS);
      gl.disable(gl.BLEND);
      gl.enable(gl.CULL_FACE);

      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(1.5, 2.0);

      gl.clearDepth(1);
      gl.clear(gl.DEPTH_BUFFER_BIT);

      gl.useProgram(SHADOW_MAP.program);
      gl.bindVertexArray(SHADOW_MAP.vao);

      const loc = SHADOW_MAP.locations;

      gl.uniformMatrix4fv(loc.lightMatrix, false, SHADOW_MAP.lightMatrix);

      gl.uniform1i(loc.baseTexture, 0);

      const radius = SHADOW_CONFIG.radius;
      const shadowCenter = cache.center;

      for (const entry of STATIC_MODEL_FRAME.objects) {
        if (entry.source.type !== "model") {
          continue;
        }

        const caster = resolveStaticShadowCaster(entry);

        if (!caster) {
          continue;
        }

        const { geometry, gpuAsset } = caster;

        const bounds = getStaticModelWorldBounds(geometry, gpuAsset);

        if (!bounds) {
          continue;
        }

        const dx = Math.max(
          0,
          Math.abs(bounds.center[0] - shadowCenter[0]) - bounds.extents[0],
        );

        const dz = Math.max(
          0,
          Math.abs(bounds.center[2] - shadowCenter[2]) - bounds.extents[2],
        );

        if (Math.hypot(dx, dz) > radius * 1.5) {
          continue;
        }

        drawShadowStaticModel(geometry, gpuAsset);
      }

      SHADOW_MAP.cacheKey = cache.key;
      SHADOW_MAP.cacheMisses++;
    } finally {
      gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
      gl.viewport(...previousViewport);

      gl.bindVertexArray(previousVao);
      gl.useProgram(previousProgram);

      gl.bindBuffer(gl.ARRAY_BUFFER, previousArrayBuffer);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, previousElementBuffer);

      gl.bindTexture(gl.TEXTURE_2D, previousTexture0);
      gl.activeTexture(previousActiveTexture);

      gl.colorMask(...previousColorMask);
      gl.depthMask(previousDepthMask);
      gl.depthFunc(previousDepthFunc);

      gl.polygonOffset(previousPolygonFactor, previousPolygonUnits);

      if (previousDepthTest) gl.enable(gl.DEPTH_TEST);
      else gl.disable(gl.DEPTH_TEST);

      if (previousBlend) gl.enable(gl.BLEND);
      else gl.disable(gl.BLEND);

      if (previousCull) gl.enable(gl.CULL_FACE);
      else gl.disable(gl.CULL_FACE);

      if (previousPolygonOffset) gl.enable(gl.POLYGON_OFFSET_FILL);
      else gl.disable(gl.POLYGON_OFFSET_FILL);
    }
  }

  function prepareStaticModelFrame(worldScene = null) {
    const scene =
      worldScene ?? window.engineSceneBridge?.getWorldScene() ?? null;

    STATIC_MODEL_FRAME.prepared = true;
    STATIC_MODEL_FRAME.worldId = scene?.worldId ?? null;
    STATIC_MODEL_FRAME.source = scene;
    STATIC_MODEL_FRAME.objects.length = 0;

    if (!scene) {
      return STATIC_MODEL_FRAME.objects;
    }

    const geometry = scene.staticGeometry ?? [];

    if (!Array.isArray(geometry)) {
      return STATIC_MODEL_FRAME.objects;
    }

    for (const object of geometry) {
      if (!object || object.visible === false) {
        continue;
      }

      const renderObject =
        object.type === "model" ? resolveStaticModelLod(object) : object;

      STATIC_MODEL_FRAME.objects.push({
        source: object,
        renderObject,
      });
    }

    return STATIC_MODEL_FRAME.objects;
  }

  function drawStaticGeometry3D(worldScene = null) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !EXPERIMENTAL_3D.cube) {
      return;
    }

    const scene =
      worldScene ?? window.engineSceneBridge?.getWorldScene() ?? null;

    if (!scene) {
      return;
    }

    const geometry =
      STATIC_MODEL_FRAME.prepared && STATIC_MODEL_FRAME.source === scene
        ? STATIC_MODEL_FRAME.objects
        : prepareStaticModelFrame(scene);

    if (geometry.length === 0) {
      return;
    }

    const cullingPlanes =
      STATIC_MODEL_CULLING.enabled &&
      scene.worldId === STATIC_MODEL_CULLING.worldId
        ? STATIC_MODEL_CULLING.planes
        : null;

    for (const entry of geometry) {
      const object = entry.source;
      const renderObject = entry.renderObject;

      if (
        object.type === "model" &&
        cullingPlanes &&
        shouldCullStaticModel(renderObject, cullingPlanes)
      ) {
        continue;
      }

      if (object.type === "model") {
        getPerformanceMonitor()?.recordVisibleBuilding?.();
      }

      switch (object.type) {
        case "box":
          drawStaticBox3D(object);
          break;

        case "model": {
          const profiler = getPerformanceMonitor();

          profiler?.beginBuilding?.(object.id);

          try {
            drawStaticModel3D(renderObject);
          } finally {
            profiler?.endBuilding?.();
          }

          break;
        }

        default:
          break;
      }
    }

    // Static geometry сейчас не использует texture.
    // Оставляем WebGL state в ожидаемом состоянии
    // для следующих render passes.

    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 0);

    gl.uniform4f(EXPERIMENTAL_3D.uniforms.uvRect, 0, 0, 1, 1);
  }

  function drawAxes(modelMatrix) {
    const gl = EXPERIMENTAL_3D.gl;
    gl.bindVertexArray(null);

    const axes = EXPERIMENTAL_3D.axes;

    if (!axes) {
      return;
    }

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, axes.posBuffer);

    gl.enableVertexAttribArray(EXPERIMENTAL_3D.attributeLocations.position);

    gl.vertexAttribPointer(
      EXPERIMENTAL_3D.attributeLocations.position,
      3,
      gl.FLOAT,
      false,
      0,
      0,
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, axes.colorBuffer);

    gl.enableVertexAttribArray(EXPERIMENTAL_3D.attributeLocations.color);

    gl.vertexAttribPointer(
      EXPERIMENTAL_3D.attributeLocations.color,
      4,
      gl.FLOAT,
      false,
      0,
      0,
    );

    gl.disableVertexAttribArray(EXPERIMENTAL_3D.attributeLocations.texCoord);

    gl.vertexAttrib2f(EXPERIMENTAL_3D.attributeLocations.texCoord, 0, 0);

    gl.uniformMatrix4fv(EXPERIMENTAL_3D.uniforms.model, false, modelMatrix);

    trackedDrawArrays(gl.LINES, 0, axes.count);
  }

  function normalizeDirectionName(direction) {
    return Object.prototype.hasOwnProperty.call(
      PLAYER_DIRECTION_VECTORS,
      direction,
    )
      ? direction
      : "down";
  }

  function getCameraRelativePlayerDirection(direction) {
    const normalizedDirection = normalizeDirectionName(direction);
    const facing = PLAYER_DIRECTION_VECTORS[normalizedDirection];

    let forwardX = EXPERIMENTAL_3D.target[0] - EXPERIMENTAL_3D.position[0];

    let forwardZ = EXPERIMENTAL_3D.target[2] - EXPERIMENTAL_3D.position[2];

    const forwardLength = Math.hypot(forwardX, forwardZ);

    if (forwardLength < 0.000001) {
      return normalizedDirection;
    }

    forwardX /= forwardLength;
    forwardZ /= forwardLength;

    const rightX = -forwardZ;
    const rightZ = forwardX;

    const screenX = facing[0] * rightX + facing[1] * rightZ;

    const screenForward = facing[0] * forwardX + facing[1] * forwardZ;

    const atlasX = screenX;
    const atlasY = -screenForward;

    const angle = Math.atan2(atlasY, atlasX);

    const octant = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;

    return SCREEN_DIRECTION_ORDER[octant];
  }

  function getPlayerAtlasFrame(player) {
    const isDead = Number(player?.health) <= 0;

    const effectiveState = isDead ? "idle" : player?.state || "idle";

    const screenDirection = getCameraRelativePlayerDirection(
      player?.direction || "down",
    );

    const rowIndex = PLAYER_SPRITE_ROW_INDEX[screenDirection] ?? 0;

    if (effectiveState === "attacking") {
      const rawFrame = Number.isFinite(player?.attackFrame)
        ? Math.floor(player.attackFrame)
        : 0;

      const frame = clamp(rawFrame, 0, PLAYER_ATTACK_FRAME_COUNT - 1);

      return {
        kind: "attack",
        frame,
        rowIndex,
        frameWidth: PLAYER_ATTACK_FRAME_WIDTH,
        frameHeight: PLAYER_ATTACK_FRAME_HEIGHT,
      };
    }

    const rawFrame =
      effectiveState === "walking" && Number.isFinite(player?.frame)
        ? Math.floor(player.frame)
        : 0;

    const frame =
      ((rawFrame % PLAYER_WALK_FRAME_COUNT) + PLAYER_WALK_FRAME_COUNT) %
      PLAYER_WALK_FRAME_COUNT;

    return {
      kind: "walking",
      frame,
      rowIndex,
      frameWidth: PLAYER_WALK_FRAME_WIDTH,
      frameHeight: PLAYER_WALK_FRAME_HEIGHT,
    };
  }

  function drawPlayerBillboard3D(player, spriteAssets) {
    const gl = EXPERIMENTAL_3D.gl;

    if (
      !gl ||
      !player ||
      !EXPERIMENTAL_3D.billboard ||
      !Number.isFinite(player.x) ||
      !Number.isFinite(player.y)
    ) {
      return;
    }

    const atlasFrame = getPlayerAtlasFrame(player);

    let image = spriteAssets?.[atlasFrame.kind] || null;

    let texture = getOrCreatePlayerTexture(atlasFrame.kind, image);

    if (!texture && atlasFrame.kind === "attack") {
      image = spriteAssets?.walking || null;

      texture = getOrCreatePlayerTexture("walking", image);

      if (texture) {
        atlasFrame.kind = "walking";

        atlasFrame.frame = 0;

        atlasFrame.frameWidth = PLAYER_WALK_FRAME_WIDTH;

        atlasFrame.frameHeight = PLAYER_WALK_FRAME_HEIGHT;
      }
    }

    if (!texture || !image || !image.naturalWidth || !image.naturalHeight) {
      return;
    }

    const sourceX = atlasFrame.frame * atlasFrame.frameWidth;

    const sourceY = atlasFrame.rowIndex * atlasFrame.frameHeight;

    if (
      sourceX < 0 ||
      sourceY < 0 ||
      sourceX + atlasFrame.frameWidth > image.naturalWidth ||
      sourceY + atlasFrame.frameHeight > image.naturalHeight
    ) {
      return;
    }

    const uOffset = sourceX / image.naturalWidth;

    const uScale = atlasFrame.frameWidth / image.naturalWidth;

    const vScale = atlasFrame.frameHeight / image.naturalHeight;

    const vOffset =
      1 - (sourceY + atlasFrame.frameHeight) / image.naturalHeight;

    const visualAnchor =
      window.engineSceneBridge?.getPlayerGroundAnchor?.(player.x, player.y) ??
      null;

    if (!visualAnchor) {
      return;
    }

    const renderPosition = window.coordinateSystem3D?.gameToRenderPosition?.(
      visualAnchor.x,
      visualAnchor.y,
      PLAYER_VISUAL.billboard3D.elevation,
    );

    if (!renderPosition) {
      return;
    }

    const worldX = renderPosition[0];
    const worldY = renderPosition[1];
    const worldZ = renderPosition[2];

    const translation = Mat4.translation(worldX, worldY, worldZ);

    const rotation = getBillboardFacingRotation3D(worldX, worldY, worldZ);

    const scale = Mat4.scaling(
      PLAYER_VISUAL.billboard3D.width,
      PLAYER_VISUAL.billboard3D.height,
      1,
    );

    const model = Mat4.multiply(Mat4.multiply(translation, rotation), scale);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 1);

    gl.activeTexture(gl.TEXTURE0);

    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.texture, 0);

    gl.uniform4f(
      EXPERIMENTAL_3D.uniforms.uvRect,
      uOffset,
      vOffset,
      uScale,
      vScale,
    );

    bindIndexedMeshForDraw(EXPERIMENTAL_3D.billboard);

    gl.uniformMatrix4fv(EXPERIMENTAL_3D.uniforms.model, false, model);

    trackedDrawElements(
      gl.TRIANGLES,
      EXPERIMENTAL_3D.billboard.count,
      gl.UNSIGNED_SHORT,
      0,
    );
  }

  function drawEnemyBillboard3D(enemyRenderData) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !enemyRenderData || !EXPERIMENTAL_3D.billboard) {
      return;
    }

    const { type, x, y, health, frame, frameCount, frameSize, sprite } =
      enemyRenderData;

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(health) ||
      health <= 0
    ) {
      return;
    }

    if (
      !sprite ||
      !sprite.complete ||
      sprite.naturalWidth <= 0 ||
      sprite.naturalHeight <= 0
    ) {
      return;
    }

    const safeFrameSize =
      Number.isFinite(frameSize) && frameSize > 0 ? frameSize : 70;

    const safeFrameCount =
      Number.isFinite(frameCount) && frameCount > 0
        ? Math.floor(frameCount)
        : 1;

    const normalizedFrame =
      ((Math.floor(frame || 0) % safeFrameCount) + safeFrameCount) %
      safeFrameCount;

    const sourceX = normalizedFrame * safeFrameSize;
    const sourceY = 0;

    if (
      sourceX < 0 ||
      sourceX + safeFrameSize > sprite.naturalWidth ||
      safeFrameSize > sprite.naturalHeight
    ) {
      return;
    }

    const texture = getOrCreateEnemyTexture(type, sprite);

    if (!texture) {
      return;
    }

    const uOffset = sourceX / sprite.naturalWidth;
    const uScale = safeFrameSize / sprite.naturalWidth;

    const vScale = safeFrameSize / sprite.naturalHeight;

    const vOffset = 1 - (sourceY + safeFrameSize) / sprite.naturalHeight;

    const renderPosition = window.coordinateSystem3D?.gameToRenderPosition?.(
      x + ENEMY_CENTER_OFFSET_X,
      y + ENEMY_FEET_OFFSET_Z,
      ENEMY_RENDER_Y,
    );

    if (!renderPosition) {
      return;
    }

    const worldX = renderPosition[0];
    const worldY = renderPosition[1];
    const worldZ = renderPosition[2];

    const translation = Mat4.translation(worldX, worldY, worldZ);

    const rotation = getBillboardFacingRotation3D(worldX, worldY, worldZ);

    const scale = Mat4.scaling(ENEMY_RENDER_WIDTH, ENEMY_RENDER_HEIGHT, 1);

    const model = Mat4.multiply(Mat4.multiply(translation, rotation), scale);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 1);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.texture, 0);

    gl.uniform4f(
      EXPERIMENTAL_3D.uniforms.uvRect,
      uOffset,
      vOffset,
      uScale,
      vScale,
    );

    bindIndexedMeshForDraw(EXPERIMENTAL_3D.billboard);

    gl.uniformMatrix4fv(EXPERIMENTAL_3D.uniforms.model, false, model);

    trackedDrawElements(
      gl.TRIANGLES,
      EXPERIMENTAL_3D.billboard.count,
      gl.UNSIGNED_SHORT,
      0,
    );
  }

  function drawNPCBillboard3D(npc) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !npc || !EXPERIMENTAL_3D.billboard) {
      return;
    }

    const {
      id,
      x,
      y,
      sprite,
      frame,
      row,
      frameCount,
      frameWidth,
      frameHeight,
      displayWidth,
      displayHeight,
      orientation,
    } = npc;

    if (
      !id ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !sprite ||
      !sprite.complete ||
      sprite.naturalWidth <= 0 ||
      sprite.naturalHeight <= 0
    ) {
      return;
    }

    const safeFrameWidth =
      Number.isFinite(frameWidth) && frameWidth > 0 ? frameWidth : 70;

    const safeFrameHeight =
      Number.isFinite(frameHeight) && frameHeight > 0 ? frameHeight : 70;

    const safeFrameCount =
      Number.isFinite(frameCount) && frameCount > 0
        ? Math.floor(frameCount)
        : 1;

    const safeFrame =
      ((Math.floor(frame || 0) % safeFrameCount) + safeFrameCount) %
      safeFrameCount;

    const safeRow = Math.max(0, Math.floor(row || 0));

    const sourceX = safeFrame * safeFrameWidth;
    const sourceY = safeRow * safeFrameHeight;

    if (
      sourceX + safeFrameWidth > sprite.naturalWidth ||
      sourceY + safeFrameHeight > sprite.naturalHeight
    ) {
      return;
    }

    // Переиспользуем существующий WebGL-кэш текстур.
    // Отдельный ключ исключает конфликт с типами врагов.
    const texture = getOrCreateEnemyTexture(`npc:${id}`, sprite);

    if (!texture) {
      return;
    }

    const uOffset = sourceX / sprite.naturalWidth;
    const uScale = safeFrameWidth / sprite.naturalWidth;

    const vOffset = 1 - (sourceY + safeFrameHeight) / sprite.naturalHeight;

    const vScale = safeFrameHeight / sprite.naturalHeight;

    const width =
      Number.isFinite(displayWidth) && displayWidth > 0
        ? displayWidth
        : safeFrameWidth;

    const height =
      Number.isFinite(displayHeight) && displayHeight > 0
        ? displayHeight
        : safeFrameHeight;

    const elevation =
      Number.isFinite(npc.elevation) && npc.elevation >= 0
        ? npc.elevation
        : 1.25;

    const heightOffset = id === "vacuum" ? VACUUM_RENDER_Y_OFFSET : 0;

    const finalElevation = elevation + heightOffset;

    const renderPosition = window.coordinateSystem3D?.gameToRenderPosition?.(
      x + width * 0.5,
      y + height,
      finalElevation,
    );

    if (!renderPosition) {
      return;
    }

    const [worldX, worldY, worldZ] = renderPosition;

    const translation = Mat4.translation(worldX, worldY, worldZ);

    const faceCameraRotation = getBillboardFacingRotation3D(
      worldX,
      worldY,
      worldZ,
    );

    const scale = Mat4.scaling(width, height, 1);

    let model = Mat4.multiply(
      Mat4.multiply(translation, faceCameraRotation),
      scale,
    );

    if (orientation?.mode === "velocity") {
      const vx = orientation.vx;
      const vy = orientation.vy;

      if (
        Number.isFinite(vx) &&
        Number.isFinite(vy) &&
        vx * vx + vy * vy > 0.000000000001
      ) {
        const angleOffset = Number.isFinite(orientation.angleOffset)
          ? orientation.angleOffset
          : 0;

        const angle = getProjectileBillboardAngle3D(vx, vy) + angleOffset;

        const pivotToCenter = Mat4.translation(0, height * 0.5, 0);
        const pivotFromCenter = Mat4.translation(0, -height * 0.5, 0);

        const centeredRotation = Mat4.multiply(
          Mat4.multiply(pivotToCenter, Mat4.rotationZ(angle)),
          pivotFromCenter,
        );

        model = Mat4.multiply(
          Mat4.multiply(translation, faceCameraRotation),
          Mat4.multiply(centeredRotation, scale),
        );
      }
    }

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 1);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.texture, 0);

    gl.uniform4f(
      EXPERIMENTAL_3D.uniforms.uvRect,
      uOffset,
      vOffset,
      uScale,
      vScale,
    );

    bindIndexedMeshForDraw(EXPERIMENTAL_3D.billboard);

    gl.uniformMatrix4fv(EXPERIMENTAL_3D.uniforms.model, false, model);

    trackedDrawElements(
      gl.TRIANGLES,
      EXPERIMENTAL_3D.billboard.count,
      gl.UNSIGNED_SHORT,
      0,
    );
  }

  function drawNPCModel3D(entity, modelConfig) {
    const coordinateSystem = window.coordinateSystem3D;

    if (
      !EXPERIMENTAL_3D.gl ||
      !coordinateSystem ||
      !modelConfig ||
      typeof modelConfig.assetUrl !== "string" ||
      !Number.isFinite(entity.x) ||
      !Number.isFinite(entity.y)
    ) {
      return false;
    }

    const gpuAsset = getOrCreateGltfGpuAsset(modelConfig.assetUrl);

    if (!gpuAsset) {
      return false;
    }

    const scale =
      Number.isFinite(modelConfig.scale) && modelConfig.scale > 0
        ? modelConfig.scale
        : 1;

    const rotationY = Number.isFinite(modelConfig.rotationY)
      ? modelConfig.rotationY
      : 0;

    const groundOffset = Number.isFinite(modelConfig.groundOffset)
      ? modelConfig.groundOffset
      : 0;

    const billboard = entity.visual?.billboard;

    const width =
      Number.isFinite(billboard?.displayWidth) && billboard.displayWidth > 0
        ? billboard.displayWidth
        : 70;

    const height =
      Number.isFinite(billboard?.displayHeight) && billboard.displayHeight > 0
        ? billboard.displayHeight
        : 70;

    const centerX = entity.x + width * 0.5;
    const feetY = entity.y + height;

    const bounds = gpuAsset.bounds;

    const groundAlignment =
      modelConfig.groundAlign !== false && Number.isFinite(bounds?.minY)
        ? -bounds.minY * scale
        : 0;

    const renderHeight =
      (Number.isFinite(entity.height) ? entity.height : 0) +
      groundAlignment +
      groundOffset;

    const position = coordinateSystem.gameToRenderPosition(
      centerX,
      feetY,
      renderHeight,
    );

    if (!position) {
      return false;
    }

    const translation = Mat4.translation(position[0], position[1], position[2]);

    const rotation = Mat4.rotationY(rotationY);

    const scaling = Mat4.scaling(scale, scale, scale);

    const modelMatrix = Mat4.multiply(
      Mat4.multiply(translation, rotation),
      scaling,
    );

    for (const rootNodeIndex of gpuAsset.sourceAsset.rootNodes) {
      drawGltfNode3D(gpuAsset, rootNodeIndex, modelMatrix);
    }

    return true;
  }

  function drawNPCs3D(scene = null) {
    const sceneBridge = window.engineSceneBridge;

    if (
      !sceneBridge ||
      typeof sceneBridge.normalizeVisualEntity !== "function" ||
      typeof sceneBridge.resolveEntityVisual !== "function"
    ) {
      return;
    }

    const npcs = scene?.npcs ?? sceneBridge.getEntities?.("npcs");

    if (!Array.isArray(npcs) || npcs.length === 0) {
      return;
    }

    const currentWorldId =
      scene?.worldId ?? sceneBridge.getEntityScene?.()?.worldId;

    for (const source of npcs) {
      const entity = sceneBridge.normalizeVisualEntity(source, "npc");

      if (!entity || entity.worldId !== currentWorldId) {
        continue;
      }

      const resolved = sceneBridge.resolveEntityVisual(entity, "3d", {
        isModelReady(assetUrl) {
          return Boolean(getOrCreateGltfGpuAsset(assetUrl));
        },
      });

      if (!resolved || resolved.representation === "hidden") {
        continue;
      }

      if (resolved.representation === "model3d") {
        const rendered = drawNPCModel3D(entity, resolved.model3D);

        if (rendered) {
          continue;
        }
      }

      const billboard = entity.visual?.billboard;

      if (!billboard) {
        continue;
      }

      drawNPCBillboard3D({
        id: entity.id,
        x: entity.x,
        y: entity.y,
        ...billboard,
        elevation: entity.elevation,
      });
    }

    const gl = EXPERIMENTAL_3D.gl;

    if (gl) {
      gl.bindTexture(gl.TEXTURE_2D, null);

      gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 0);

      gl.uniform4f(EXPERIMENTAL_3D.uniforms.uvRect, 0, 0, 1, 1);
    }
  }

  function drawEnemies3D(scene = null) {
    const sceneBridge = window.engineSceneBridge;

    if (
      !sceneBridge ||
      typeof sceneBridge.normalizeVisualEntity !== "function" ||
      typeof sceneBridge.resolveEntityVisual !== "function"
    ) {
      return;
    }

    const enemies = scene?.enemies ?? sceneBridge.getEntities?.("enemies");

    if (!Array.isArray(enemies) || enemies.length === 0) {
      return;
    }

    const currentWorldId =
      scene?.worldId ?? sceneBridge.getEntityScene?.()?.worldId;

    for (const source of enemies) {
      if (
        !source ||
        !Number.isFinite(source.x) ||
        !Number.isFinite(source.y) ||
        !Number.isFinite(source.health) ||
        source.health <= 0
      ) {
        continue;
      }

      const entity = sceneBridge.normalizeVisualEntity(source, "enemy");

      if (!entity || entity.worldId !== currentWorldId) {
        continue;
      }

      const resolved = sceneBridge.resolveEntityVisual(entity, "3d", {
        isModelReady(assetUrl) {
          return Boolean(getOrCreateGltfGpuAsset(assetUrl));
        },
      });

      if (!resolved || resolved.representation === "hidden") {
        continue;
      }

      if (resolved.representation === "model3d") {
        const rendered = drawNPCModel3D(entity, resolved.model3D);

        if (rendered) {
          continue;
        }
      }

      drawEnemyBillboard3D(source);
    }

    const gl = EXPERIMENTAL_3D.gl;

    if (gl) {
      gl.bindTexture(gl.TEXTURE_2D, null);

      gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 0);

      gl.uniform4f(EXPERIMENTAL_3D.uniforms.uvRect, 0, 0, 1, 1);
    }
  }

  function drawWorldItemBillboard3D(itemRenderData) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !itemRenderData || !EXPERIMENTAL_3D.billboard) {
      return;
    }

    const { type, x, y, image, isAnimated, frame, frameWidth, frameHeight } =
      itemRenderData;

    if (
      typeof type !== "string" ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return;
    }

    if (
      !image ||
      !image.complete ||
      image.naturalWidth <= 0 ||
      image.naturalHeight <= 0
    ) {
      return;
    }

    const texture = getOrCreateItemTexture(type, image);

    if (!texture) {
      return;
    }

    let sourceX = 0;
    let sourceY = 0;

    let sourceWidth = image.naturalWidth;
    let sourceHeight = image.naturalHeight;

    let renderWidth = ITEM_RENDER_WIDTH;
    let renderHeight = ITEM_RENDER_HEIGHT;

    let centerOffsetX = ITEM_CENTER_OFFSET_X;
    let feetOffsetZ = ITEM_FEET_OFFSET_Z;

    if (
      isAnimated &&
      Number.isFinite(frameWidth) &&
      Number.isFinite(frameHeight) &&
      frameWidth > 0 &&
      frameHeight > 0
    ) {
      const totalFrames = Math.max(
        1,
        Math.floor(image.naturalWidth / frameWidth),
      );

      const normalizedFrame =
        ((Math.floor(frame || 0) % totalFrames) + totalFrames) % totalFrames;

      sourceX = normalizedFrame * frameWidth;
      sourceY = 0;

      sourceWidth = frameWidth;
      sourceHeight = frameHeight;

      renderWidth = ATOM_RENDER_WIDTH;
      renderHeight = ATOM_RENDER_HEIGHT;

      centerOffsetX = ATOM_CENTER_OFFSET_X;
      feetOffsetZ = ATOM_FEET_OFFSET_Z;
    }

    if (
      sourceX < 0 ||
      sourceY < 0 ||
      sourceX + sourceWidth > image.naturalWidth ||
      sourceY + sourceHeight > image.naturalHeight
    ) {
      return;
    }

    const uOffset = sourceX / image.naturalWidth;
    const uScale = sourceWidth / image.naturalWidth;

    const vScale = sourceHeight / image.naturalHeight;

    const vOffset = 1 - (sourceY + sourceHeight) / image.naturalHeight;

    const renderPosition = window.coordinateSystem3D?.gameToRenderPosition?.(
      x + centerOffsetX,
      y + feetOffsetZ,
      ITEM_RENDER_Y,
    );

    if (!renderPosition) {
      return;
    }

    const worldX = renderPosition[0];
    const worldY = renderPosition[1];
    const worldZ = renderPosition[2];

    const translation = Mat4.translation(worldX, worldY, worldZ);

    const rotation = getBillboardFacingRotation3D(worldX, worldY, worldZ);

    const scale = Mat4.scaling(renderWidth, renderHeight, 1);

    const model = Mat4.multiply(Mat4.multiply(translation, rotation), scale);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 1);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.texture, 0);

    gl.uniform4f(
      EXPERIMENTAL_3D.uniforms.uvRect,
      uOffset,
      vOffset,
      uScale,
      vScale,
    );

    bindIndexedMeshForDraw(EXPERIMENTAL_3D.billboard);

    gl.uniformMatrix4fv(EXPERIMENTAL_3D.uniforms.model, false, model);

    trackedDrawElements(
      gl.TRIANGLES,
      EXPERIMENTAL_3D.billboard.count,
      gl.UNSIGNED_SHORT,
      0,
    );
  }

  function drawWorldItems3D(scene = null) {
    const renderItems =
      scene?.items ?? window.engineSceneBridge?.getEntities?.("items");

    if (!Array.isArray(renderItems) || renderItems.length === 0) {
      return;
    }

    for (const renderData of renderItems) {
      if (!renderData) {
        continue;
      }

      if (!Number.isFinite(renderData.x) || !Number.isFinite(renderData.y)) {
        continue;
      }

      drawWorldItemBillboard3D(renderData);
    }

    const gl = EXPERIMENTAL_3D.gl;

    if (gl) {
      gl.bindTexture(gl.TEXTURE_2D, null);

      gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 0);

      gl.uniform4f(EXPERIMENTAL_3D.uniforms.uvRect, 0, 0, 1, 1);
    }
  }

  function getProjectileBillboardAngle3D(vx, vy) {
    if (!Number.isFinite(vx) || !Number.isFinite(vy)) {
      return 0;
    }

    const velocityLength = Math.hypot(vx, vy);

    if (velocityLength < 0.000001) {
      return 0;
    }

    const worldVelocity = window.coordinateSystem3D?.gameToRenderVector?.(
      vx / velocityLength,
      vy / velocityLength,
      0,
    );

    if (!worldVelocity) {
      return 0;
    }

    const forward = Vec3.normalize(
      Vec3.subtract(EXPERIMENTAL_3D.target, EXPERIMENTAL_3D.position),
    );

    const right = Vec3.normalize(Vec3.cross(forward, [0, 1, 0]));

    if (
      Math.abs(right[0]) < 0.000001 &&
      Math.abs(right[1]) < 0.000001 &&
      Math.abs(right[2]) < 0.000001
    ) {
      return 0;
    }

    const screenUp = Vec3.normalize(Vec3.cross(right, forward));

    const screenDirectionX = Vec3.dot(worldVelocity, right);

    const screenDirectionY = Vec3.dot(worldVelocity, screenUp);

    if (
      Math.abs(screenDirectionX) < 0.000001 &&
      Math.abs(screenDirectionY) < 0.000001
    ) {
      return 0;
    }

    return Math.atan2(screenDirectionY, screenDirectionX);
  }

  function drawImplantAnimatedBillboard3D({
    textureKey,
    image,
    x,
    y,
    frame,
    frameWidth,
    frameHeight,
    renderWidth,
    renderHeight,
    renderY,
    rotationInPlane = 0,
  }) {
    const gl = EXPERIMENTAL_3D.gl;

    if (
      !gl ||
      !EXPERIMENTAL_3D.billboard ||
      !textureKey ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(frame) ||
      !Number.isFinite(frameWidth) ||
      !Number.isFinite(frameHeight) ||
      frameWidth <= 0 ||
      frameHeight <= 0
    ) {
      return;
    }

    if (
      !image ||
      !image.complete ||
      image.naturalWidth <= 0 ||
      image.naturalHeight <= 0
    ) {
      return;
    }

    const texture = getOrCreateImplantTexture(textureKey, image);

    if (!texture) {
      return;
    }

    const availableFrames = Math.max(
      1,
      Math.floor(image.naturalWidth / frameWidth),
    );

    const normalizedFrame =
      ((Math.floor(frame) % availableFrames) + availableFrames) %
      availableFrames;

    const sourceX = normalizedFrame * frameWidth;
    const sourceY = 0;

    if (
      sourceX < 0 ||
      sourceY < 0 ||
      sourceX + frameWidth > image.naturalWidth ||
      sourceY + frameHeight > image.naturalHeight
    ) {
      return;
    }

    const uOffset = sourceX / image.naturalWidth;
    const uScale = frameWidth / image.naturalWidth;

    const vScale = frameHeight / image.naturalHeight;

    const vOffset = 1 - (sourceY + frameHeight) / image.naturalHeight;

    const renderPosition = window.coordinateSystem3D?.gameToRenderPosition?.(
      x,
      y,
      renderY,
    );

    if (!renderPosition) {
      return;
    }

    const worldX = renderPosition[0];
    const worldY = renderPosition[1];
    const worldZ = renderPosition[2];

    const translation = Mat4.translation(worldX, worldY, worldZ);

    const faceCameraRotation = getBillboardFacingRotation3D(
      worldX,
      worldY,
      worldZ,
    );

    const inPlaneRotation = Mat4.rotationZ(rotationInPlane);

    const scale = Mat4.scaling(renderWidth, renderHeight, 1);

    const faceAndRotate = Mat4.multiply(faceCameraRotation, inPlaneRotation);

    const model = Mat4.multiply(
      Mat4.multiply(translation, faceAndRotate),
      scale,
    );

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 1);

    gl.activeTexture(gl.TEXTURE0);

    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.texture, 0);

    gl.uniform4f(
      EXPERIMENTAL_3D.uniforms.uvRect,
      uOffset,
      vOffset,
      uScale,
      vScale,
    );

    bindIndexedMeshForDraw(EXPERIMENTAL_3D.billboard);

    gl.uniformMatrix4fv(EXPERIMENTAL_3D.uniforms.model, false, model);

    trackedDrawElements(
      gl.TRIANGLES,
      EXPERIMENTAL_3D.billboard.count,
      gl.UNSIGNED_SHORT,
      0,
    );
  }

  function drawImplantProjectiles3D(scene = null) {
    const projectiles =
      scene?.implantProjectiles ??
      window.engineSceneBridge?.getEntities?.("implantProjectiles");

    if (!Array.isArray(projectiles) || projectiles.length === 0) {
      return;
    }

    if (typeof images === "undefined" || !images) {
      return;
    }

    const now = Date.now();

    for (const projectile of projectiles) {
      if (
        !projectile ||
        !Number.isFinite(projectile.x) ||
        !Number.isFinite(projectile.y)
      ) {
        continue;
      }

      if (projectile.type === "fireball") {
        const frame =
          Math.floor(now / FIREBALL_FRAME_DURATION) % FIREBALL_FRAME_COUNT;

        const rotationInPlane = getProjectileBillboardAngle3D(
          Number(projectile.vx) || 0,
          Number(projectile.vy) || 0,
        );

        drawImplantAnimatedBillboard3D({
          textureKey: "fireball",
          image: images.fireballSprite,

          x: projectile.x,
          y: projectile.y,

          frame,

          frameWidth: FIREBALL_FRAME_WIDTH,
          frameHeight: FIREBALL_FRAME_HEIGHT,

          renderWidth: FIREBALL_RENDER_WIDTH,
          renderHeight: FIREBALL_RENDER_HEIGHT,
          renderY: FIREBALL_RENDER_Y,

          rotationInPlane,
        });

        continue;
      }

      if (projectile.type === "violent_tornado") {
        const elapsed =
          now -
          (Number.isFinite(projectile.spawnTime) ? projectile.spawnTime : now);

        const frame =
          Math.floor(elapsed / TORNADO_FRAME_DURATION) % TORNADO_FRAME_COUNT;

        drawImplantAnimatedBillboard3D({
          textureKey: "violent_tornado",
          image: images.violentTornadoSprite,

          x: projectile.x,
          y: projectile.y,

          frame,

          frameWidth: TORNADO_FRAME_WIDTH,
          frameHeight: TORNADO_FRAME_HEIGHT,

          renderWidth: TORNADO_RENDER_WIDTH,
          renderHeight: TORNADO_RENDER_HEIGHT,
          renderY: TORNADO_RENDER_Y,
        });
      }
    }

    const gl = EXPERIMENTAL_3D.gl;

    if (gl) {
      gl.bindTexture(gl.TEXTURE_2D, null);

      gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 0);

      gl.uniform4f(EXPERIMENTAL_3D.uniforms.uvRect, 0, 0, 1, 1);
    }
  }

  function drawLightningStrikes3D(scene = null) {
    const strikes =
      scene?.effects?.lightning ??
      window.engineSceneBridge?.getEntityScene()?.effects?.lightning;

    if (!Array.isArray(strikes) || strikes.length === 0) {
      return;
    }

    if (typeof images === "undefined" || !images?.lightningSprite) {
      return;
    }

    const now = Date.now();

    for (const strike of strikes) {
      if (!strike || !Number.isFinite(strike.x) || !Number.isFinite(strike.y)) {
        continue;
      }

      const frameDuration =
        Number.isFinite(strike.frameDuration) && strike.frameDuration > 0
          ? strike.frameDuration
          : LIGHTNING_FRAME_DURATION;

      const elapsed =
        now - (Number.isFinite(strike.spawnTime) ? strike.spawnTime : now);

      const totalLifetime = LIGHTNING_FRAME_COUNT * frameDuration + 400;

      if (elapsed < 0 || elapsed > totalLifetime) {
        continue;
      }

      const frame = Math.min(
        LIGHTNING_FRAME_COUNT - 1,
        Math.floor(elapsed / frameDuration),
      );

      drawImplantAnimatedBillboard3D({
        textureKey: "lightning",
        image: images.lightningSprite,

        x: strike.x,
        y: strike.y,

        frame,

        frameWidth: LIGHTNING_FRAME_WIDTH,
        frameHeight: LIGHTNING_FRAME_HEIGHT,

        renderWidth: LIGHTNING_RENDER_WIDTH,
        renderHeight: LIGHTNING_RENDER_HEIGHT,
        renderY: LIGHTNING_RENDER_Y,
      });
    }

    const gl = EXPERIMENTAL_3D.gl;

    if (gl) {
      gl.bindTexture(gl.TEXTURE_2D, null);

      gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 0);

      gl.uniform4f(EXPERIMENTAL_3D.uniforms.uvRect, 0, 0, 1, 1);
    }
  }

  function drawTornadoStrikes3D(scene = null) {
    const strikes =
      scene?.effects?.tornado ??
      window.engineSceneBridge?.getEntityScene()?.effects?.tornado;

    if (!Array.isArray(strikes) || strikes.length === 0) {
      return;
    }

    if (typeof images === "undefined" || !images?.tornadoSprite) {
      return;
    }

    const now = Date.now();

    for (const strike of strikes) {
      if (!strike || !Number.isFinite(strike.x) || !Number.isFinite(strike.y)) {
        continue;
      }

      const frameDuration =
        Number.isFinite(strike.frameDuration) && strike.frameDuration > 0
          ? strike.frameDuration
          : TORNADO_FRAME_DURATION;

      const elapsed =
        now - (Number.isFinite(strike.spawnTime) ? strike.spawnTime : now);

      const totalLifetime = TORNADO_FRAME_COUNT * frameDuration + 300;

      if (elapsed < 0 || elapsed > totalLifetime) {
        continue;
      }

      const frame = Math.min(
        TORNADO_FRAME_COUNT - 1,
        Math.floor(elapsed / frameDuration),
      );

      drawImplantAnimatedBillboard3D({
        textureKey: "tornado",
        image: images.tornadoSprite,

        x: strike.x,
        y: strike.y,

        frame,

        frameWidth: TORNADO_FRAME_WIDTH,
        frameHeight: TORNADO_FRAME_HEIGHT,

        renderWidth: TORNADO_RENDER_WIDTH,
        renderHeight: TORNADO_RENDER_HEIGHT,
        renderY: TORNADO_RENDER_Y,
      });
    }

    const gl = EXPERIMENTAL_3D.gl;

    if (gl) {
      gl.bindTexture(gl.TEXTURE_2D, null);

      gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 0);

      gl.uniform4f(EXPERIMENTAL_3D.uniforms.uvRect, 0, 0, 1, 1);
    }
  }

  function drawImplantAimIndicator3D() {
    const gl = EXPERIMENTAL_3D.gl;
    gl.bindVertexArray(null);

    const aimCircle = EXPERIMENTAL_3D.implantAimCircle;

    if (!gl || !aimCircle) {
      return;
    }

    const preview = window.engineSceneBridge?.getAreaAimPreview?.();

    if (!preview) {
      return;
    }

    const aimX = preview.x;
    const aimY = preview.y;
    const radius = preview.radius;

    const translation = Mat4.translation(
      aimX,
      EXPERIMENTAL_3D.GROUND_TEXTURE_Y + 0.35,
      aimY,
    );

    const scale = Mat4.scaling(radius, 1, radius);

    const model = Mat4.multiply(translation, scale);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 0);

    gl.uniform4f(EXPERIMENTAL_3D.uniforms.uvRect, 0, 0, 1, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, aimCircle.posBuffer);

    gl.enableVertexAttribArray(EXPERIMENTAL_3D.attributeLocations.position);

    gl.vertexAttribPointer(
      EXPERIMENTAL_3D.attributeLocations.position,
      3,
      gl.FLOAT,
      false,
      0,
      0,
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, aimCircle.colorBuffer);

    gl.enableVertexAttribArray(EXPERIMENTAL_3D.attributeLocations.color);

    gl.vertexAttribPointer(
      EXPERIMENTAL_3D.attributeLocations.color,
      4,
      gl.FLOAT,
      false,
      0,
      0,
    );

    gl.disableVertexAttribArray(EXPERIMENTAL_3D.attributeLocations.texCoord);

    gl.vertexAttrib2f(EXPERIMENTAL_3D.attributeLocations.texCoord, 0, 0);

    gl.uniformMatrix4fv(EXPERIMENTAL_3D.uniforms.model, false, model);

    trackedDrawArrays(gl.LINE_LOOP, 0, aimCircle.count);
  }

  function drawImplantEffects3D(scene = null) {
    drawImplantAimIndicator3D();

    drawImplantProjectiles3D(scene);
    drawLightningStrikes3D(scene);
    drawTornadoStrikes3D(scene);
  }

  function getOrCreatePlayerJointTexture(playerId) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl) {
      return null;
    }

    let entry = EXPERIMENTAL_3D.playerJointTextures.get(playerId);

    if (entry?.texture) {
      return entry;
    }

    const texture = gl.createTexture();

    if (!texture) {
      return null;
    }

    entry = {
      texture,
      jointCount: 0,
    };

    EXPERIMENTAL_3D.playerJointTextures.set(playerId, entry);

    return entry;
  }

  function uploadPlayerJointMatrices(playerId, matrices) {
    const gl = EXPERIMENTAL_3D.gl;

    if (
      !gl ||
      !(matrices instanceof Float32Array) ||
      matrices.length === 0 ||
      matrices.length % 16 !== 0
    ) {
      return null;
    }

    const jointCount = matrices.length / 16;

    const entry = getOrCreatePlayerJointTexture(playerId);

    if (!entry) {
      return null;
    }

    const previousFlipY = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);

    try {
      gl.activeTexture(gl.TEXTURE1);

      gl.bindTexture(gl.TEXTURE_2D, entry.texture);

      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      if (entry.jointCount === jointCount) {
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          0,
          0,
          4,
          jointCount,
          gl.RGBA,
          gl.FLOAT,
          matrices,
        );
      } else {
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA32F,
          4,
          jointCount,
          0,
          gl.RGBA,
          gl.FLOAT,
          matrices,
        );
      }

      entry.jointCount = jointCount;
    } finally {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, previousFlipY);
    }

    return entry.texture;
  }

  function bindSkinnedPrimitiveForDraw(primitive) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !primitive) {
      return false;
    }

    const attributes = EXPERIMENTAL_3D.attributeLocations;

    if (
      attributes.joints < 0 ||
      attributes.weights < 0 ||
      !primitive.jointBuffer ||
      !primitive.weightBuffer ||
      !primitive.jointComponentType
    ) {
      return false;
    }

    const vao = getOrCreateGltfVao(primitive, true);

    if (vao) {
      gl.bindVertexArray(vao);

      if (attributes.normal >= 0 && !primitive.normalBuffer) {
        gl.vertexAttrib3f(attributes.normal, 0, 1, 0);
      }

      return true;
    }

    bindIndexedMeshForDraw(primitive);

    gl.bindBuffer(gl.ARRAY_BUFFER, primitive.jointBuffer);
    gl.enableVertexAttribArray(attributes.joints);
    gl.vertexAttribIPointer(
      attributes.joints,
      4,
      primitive.jointComponentType,
      0,
      0,
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, primitive.weightBuffer);
    gl.enableVertexAttribArray(attributes.weights);
    gl.vertexAttribPointer(attributes.weights, 4, gl.FLOAT, false, 0, 0);

    return true;
  }

  function getPlayerModelRotation(direction) {
    const vector =
      PLAYER_DIRECTION_VECTORS[direction] || PLAYER_DIRECTION_VECTORS.down;

    const renderVector = window.coordinateSystem3D?.gameToRenderVector?.(
      vector[0],
      vector[1],
      0,
    );

    if (!renderVector) {
      return 0;
    }

    return -Math.atan2(renderVector[0], renderVector[2]);
  }

  function drawSkinnedPlayerPrimitive3D({
    primitive,
    modelMatrix,
    playerId,
    jointMatrices,
    deferred = false,
  }) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl || !primitive || !jointMatrices) {
      return false;
    }

    const alphaMode = getGltfAlphaMode(primitive.material);

    if (alphaMode === 2 && !deferred) {
      queueTransparentGltfDraw(modelMatrix, () => {
        drawSkinnedPlayerPrimitive3D({
          primitive,
          modelMatrix,
          playerId,
          jointMatrices,
          deferred: true,
        });
      });

      return true;
    }

    if (!bindSkinnedPrimitiveForDraw(primitive)) {
      console.error("[3D][PLAYER] Failed to bind skinned primitive.", {
        playerId,
        primitive,
      });

      return false;
    }

    const jointTexture = uploadPlayerJointMatrices(playerId, jointMatrices);

    if (!jointTexture) {
      gl.bindVertexArray(null);

      console.error("[3D][PLAYER] Failed to upload joint matrices.", {
        playerId,

        jointMatrixLength: jointMatrices?.length,
      });

      return false;
    }

    const material = primitive.material || null;

    const texture = material?.baseColorTexture || null;

    const previousBlend = gl.isEnabled(gl.BLEND);

    applyGltfMaterialUniforms(material, primitive.hasTexCoord0);

    setGltfLighting(Boolean(primitive.normalBuffer));

    if (alphaMode === 2) {
      gl.enable(gl.BLEND);
    } else {
      gl.disable(gl.BLEND);
    }

    // ------------------------------------------------------------
    // SKINNING
    // ------------------------------------------------------------

    gl.uniform1i(
      EXPERIMENTAL_3D.uniforms.useSkinning,
      PLAYER_MODEL_ENABLE_SKINNING ? 1 : 0,
    );

    if (PLAYER_MODEL_ENABLE_SKINNING) {
      gl.activeTexture(gl.TEXTURE1);

      gl.bindTexture(gl.TEXTURE_2D, jointTexture);

      gl.uniform1i(EXPERIMENTAL_3D.uniforms.jointTexture, 1);
    }

    // ------------------------------------------------------------
    // MATERIAL
    // ------------------------------------------------------------

    if (texture) {
      gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 1);

      gl.activeTexture(gl.TEXTURE0);

      gl.bindTexture(gl.TEXTURE_2D, texture);

      gl.uniform1i(EXPERIMENTAL_3D.uniforms.texture, 0);
    } else {
      gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 0);
    }

    gl.uniform4f(EXPERIMENTAL_3D.uniforms.uvRect, 0, 0, 1, 1);

    gl.uniformMatrix4fv(EXPERIMENTAL_3D.uniforms.model, false, modelMatrix);

    if (DEBUG_PLAYER_GL_ERRORS) {
      for (let i = 0; i < 16; i++) {
        if (gl.getError() === gl.NO_ERROR) break;
      }
    }

    trackedDrawElements(gl.TRIANGLES, primitive.count, primitive.indexType, 0);

    const drawError = DEBUG_PLAYER_GL_ERRORS ? gl.getError() : gl.NO_ERROR;

    gl.bindVertexArray(null);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.useSkinning, 0);

    restoreLegacyMaterialUniforms();

    setGltfLighting(false);

    if (previousBlend) {
      gl.enable(gl.BLEND);
    } else {
      gl.disable(gl.BLEND);
    }

    if (drawError !== gl.NO_ERROR) {
      console.error("[3D][PLAYER] WebGL drawElements failed.", {
        playerId,
        error: drawError,
        primitiveCount: primitive.count,
        indexType: primitive.indexType,
        jointCount: jointMatrices.length / 16,
      });

      return false;
    }

    return true;
  }

  function drawPlayerModel3D(playerState) {
    const coordinateSystem3D = window.coordinateSystem3D;

    if (!playerState || !coordinateSystem3D) {
      return false;
    }

    const gpuAsset = getOrCreateGltfGpuAsset(playerState.assetUrl);

    if (!gpuAsset) {
      return false;
    }

    const playerBounds = getPlayerModelBounds(gpuAsset);

    if (!playerBounds) {
      console.error("[3D][PLAYER] Invalid player GLB bounds.", {
        assetUrl: playerState.assetUrl,

        bounds: gpuAsset.bounds,
      });

      return false;
    }

    // ============================================================
    // SCALE
    // ============================================================

    const targetHeight = PLAYER_VISUAL.model3D.targetHeight;

    const modelScale = targetHeight / playerBounds.height;

    if (!Number.isFinite(modelScale) || modelScale <= 0) {
      console.error("[3D][PLAYER] Invalid model scale.", {
        targetHeight,

        playerHeight: playerBounds.height,

        modelScale,
      });

      return false;
    }

    const groundOffset = -playerBounds.minY * modelScale;

    const visualAnchor =
      window.engineSceneBridge?.getPlayerGroundAnchor?.(
        playerState.x,
        playerState.y,
      ) ?? null;

    if (!visualAnchor) {
      return false;
    }

    const visualGameX = visualAnchor.x;
    const visualGameY = visualAnchor.y;

    const renderPosition = coordinateSystem3D.gameToRenderPosition(
      visualGameX,
      visualGameY,
      groundOffset,
    );

    if (
      !renderPosition ||
      !Number.isFinite(renderPosition[0]) ||
      !Number.isFinite(renderPosition[1]) ||
      !Number.isFinite(renderPosition[2])
    ) {
      console.error("[3D][PLAYER] Invalid render position.", {
        gameX: playerState.x,

        gameY: playerState.y,

        groundOffset,

        renderPosition,
      });

      return false;
    }

    // ============================================================
    // INSTANCE TRANSFORM
    // ============================================================

    const translation = Mat4.translation(
      renderPosition[0],
      renderPosition[1],
      renderPosition[2],
    );

    const gameplayRotation = getPlayerModelRotation(playerState.direction);

    const facingRotation = Mat4.rotationY(
      gameplayRotation + PLAYER_MODEL_YAW_OFFSET,
    );

    const axisCorrection = Mat4.rotationX(PLAYER_MODEL_AXIS_ROTATION_X);

    const scale = Mat4.scaling(modelScale, modelScale, modelScale);

    const instanceMatrix = Mat4.multiply(
      Mat4.multiply(Mat4.multiply(translation, facingRotation), axisCorrection),
      scale,
    );

    // ============================================================
    // DRAW SKINNED MESH NODES
    // ============================================================

    let renderedPrimitiveCount = 0;

    let attemptedPrimitiveCount = 0;

    for (
      let nodeIndex = 0;
      nodeIndex < playerState.asset.nodes.length;
      nodeIndex++
    ) {
      const node = playerState.asset.nodes[nodeIndex];

      if (!Number.isInteger(node.mesh)) {
        continue;
      }

      const mesh = gpuAsset.meshes[node.mesh];

      if (!mesh) {
        continue;
      }

      const nodeWorld = playerState.pose.worldMatrices[nodeIndex];

      if (!nodeWorld) {
        continue;
      }

      // Node transform stays inside the corrected
      // player instance transform.
      const modelMatrix = Mat4.multiply(instanceMatrix, nodeWorld);

      let jointMatrices = null;

      if (Number.isInteger(node.skin)) {
        jointMatrices = playerState.getSkinMatrices(nodeIndex, node.skin);
      }

      for (
        let primitiveIndex = 0;
        primitiveIndex < mesh.primitives.length;
        primitiveIndex++
      ) {
        const primitive = mesh.primitives[primitiveIndex];

        if (!jointMatrices || !primitive.isSkinned) {
          continue;
        }

        attemptedPrimitiveCount++;

        const rendered = drawSkinnedPlayerPrimitive3D({
          primitive,

          modelMatrix,

          playerId: playerState.playerId,

          jointMatrices,
        });

        if (rendered) {
          renderedPrimitiveCount++;
        }
      }
    }

    if (attemptedPrimitiveCount === 0) {
      console.error(
        "[3D][PLAYER] No skinned primitives were eligible for rendering.",
        {
          playerId: playerState.playerId,

          nodes: playerState.asset.nodes?.length,

          meshes: gpuAsset.meshes?.length,

          skins: playerState.asset.skins?.length,
        },
      );

      return false;
    }

    if (renderedPrimitiveCount === 0) {
      console.error("[3D][PLAYER] All skinned primitive draws failed.", {
        playerId: playerState.playerId,

        attemptedPrimitiveCount,
      });

      return false;
    }

    return true;
  }

  function drawPlayers3D(scene = null, deltaTime = 0) {
    const scenePlayers =
      scene?.players ?? window.engineSceneBridge?.getEntities?.("players");

    if (!Array.isArray(scenePlayers) || scenePlayers.length === 0) {
      return;
    }

    const spriteAssets = getPlayerSpriteAssets();

    const playerSystem3D = window.playerSystem3D;

    let modelStates = [];

    try {
      modelStates =
        playerSystem3D?.updateScene?.(scenePlayers, deltaTime) || [];
    } catch (error) {
      console.error("[3D][PLAYER] playerSystem3D.updateScene failed.", error);

      modelStates = [];
    }

    const modelStateById = new Map();

    for (const modelState of modelStates) {
      if (!modelState) {
        continue;
      }

      modelStateById.set(modelState.playerId, modelState);
    }

    for (const renderData of scenePlayers) {
      if (!renderData) {
        continue;
      }

      const modelState = modelStateById.get(renderData.id);

      let modelRendered = false;

      if (modelState) {
        try {
          const isOrbitMode = window.cameraSystem3D?.getMode?.() === "orbit";

          // Не мутируем состояние playerSystem3D.
          // В isometric передаём исходную модель без изменений.
          let visualModelState = modelState;

          if (isOrbitMode) {
            const movementDirection = getOrbitMovementDirection(modelState);

            visualModelState = {
              ...modelState,
              direction: movementDirection,
            };
          }

          modelRendered = drawPlayerModel3D(visualModelState);
        } catch (error) {
          console.error("[3D][PLAYER] drawPlayerModel3D failed.", {
            playerId: renderData.id,

            error,
          });

          modelRendered = false;
        }
      }

      if (!modelRendered) {
        const player = renderData.source;

        if (player && spriteAssets) {
          drawPlayerBillboard3D(player, spriteAssets);
        }
      }
      const activePlayerIds = new Set(
        scenePlayers
          .filter((player) => player && player.id != null)
          .map((player) => player.id),
      );

      for (const playerId of orbitPlayerFacing.keys()) {
        if (!activePlayerIds.has(playerId)) {
          orbitPlayerFacing.delete(playerId);
        }
      }
    }

    // ============================================================
    // RESTORE GLOBAL WEBGL STATE
    // ============================================================

    const gl = EXPERIMENTAL_3D.gl;

    if (!gl) {
      return;
    }

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.useSkinning, 0);

    gl.activeTexture(gl.TEXTURE1);

    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.activeTexture(gl.TEXTURE0);

    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.uniform1i(EXPERIMENTAL_3D.uniforms.useTexture, 0);

    gl.uniform4f(EXPERIMENTAL_3D.uniforms.uvRect, 0, 0, 1, 1);
  }

  function drawBullets3D(scene = null) {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl) {
      return;
    }

    const bullets =
      scene?.bullets ?? window.engineSceneBridge?.getEntities?.("bullets");

    if (!Array.isArray(bullets) || bullets.length === 0) {
      return;
    }

    for (const bullet of bullets) {
      if (
        !bullet ||
        !Number.isFinite(bullet.x) ||
        !Number.isFinite(bullet.y) ||
        !Number.isFinite(bullet.vx) ||
        !Number.isFinite(bullet.vy)
      ) {
        continue;
      }

      const velocityLength = Math.hypot(bullet.vx, bullet.vy);

      if (velocityLength < 0.000001) {
        continue;
      }

      const renderDirection = window.coordinateSystem3D?.gameToRenderVector?.(
        bullet.vx / velocityLength,
        bullet.vy / velocityLength,
        0,
      );

      const bulletPosition = window.coordinateSystem3D?.gameToRenderPosition?.(
        bullet.x,
        bullet.y,
        BULLET_RENDER_HEIGHT,
      );

      if (!renderDirection || !bulletPosition) {
        continue;
      }

      const dirX = renderDirection[0];
      const dirZ = renderDirection[2];

      const bulletTranslation = Mat4.translation(
        bulletPosition[0],
        bulletPosition[1],
        bulletPosition[2],
      );

      const bulletAngle = -Math.atan2(dirX, dirZ);

      const bulletRotation = Mat4.rotationY(bulletAngle);

      const bulletScale = Mat4.scaling(1.6, 1.6, 5.5);

      const bulletTR = Mat4.multiply(bulletTranslation, bulletRotation);

      const bulletMatrix = Mat4.multiply(bulletTR, bulletScale);

      const bulletMesh =
        Number(bullet.damage) >= 50
          ? EXPERIMENTAL_3D.bulletHighDamage
          : EXPERIMENTAL_3D.bulletNormal;

      if (!bulletMesh) {
        continue;
      }

      drawIndexedMesh(bulletMesh, bulletMatrix);
    }
  }

  function getActiveProjection3D() {
    const gl = EXPERIMENTAL_3D.gl;

    if (!gl) {
      return null;
    }

    const isIsometric = window.cameraSystem3D?.getMode?.() === "isometric";

    if (!isIsometric) {
      return Mat4.perspective(
        EXPERIMENTAL_3D.FOV_Y,
        gl.canvas.width / Math.max(1, gl.canvas.height),
        EXPERIMENTAL_3D.NEAR,
        EXPERIMENTAL_3D.FAR,
      );
    }

    const canvas2D = getRenderCanvas("2d");

    // Эталонные размеры 2D viewport в игровых пикселях.
    const viewportWidth = canvas2D?.width || gl.canvas.clientWidth;
    const viewportHeight = canvas2D?.height || gl.canvas.clientHeight;

    const zoom = window.engineSceneBridge?.getCameraViewport?.()?.zoom || 1;

    const halfWidth = viewportWidth / (2 * zoom);
    const halfHeight = viewportHeight / (2 * zoom);

    return Mat4.orthographic(
      -halfWidth,
      halfWidth,
      -halfHeight,
      halfHeight,
      0.1,
      5000,
    );
  }

  function getActiveView3D() {
    return Mat4.lookAt(
      EXPERIMENTAL_3D.position,
      EXPERIMENTAL_3D.target,
      [0, 1, 0],
    );
  }

  function profileRendererStage(name, callback) {
    const monitor = getPerformanceMonitor();

    monitor?.beginRendererStage?.(name);

    try {
      beginGpuStage(name);

      try {
        return callback();
      } finally {
        endGpuStage();
      }
    } finally {
      monitor?.endRendererStage?.(name);
    }
  }

  function trackedDrawElements(mode, count, type, offset) {
    const gl = EXPERIMENTAL_3D.gl;

    getPerformanceMonitor()?.recordDraw?.(mode, count);

    gl.drawElements(mode, count, type, offset);
  }

  function trackedDrawArrays(mode, first, count) {
    const gl = EXPERIMENTAL_3D.gl;

    getPerformanceMonitor()?.recordDraw?.(mode, count);

    gl.drawArrays(mode, first, count);
  }

  function render(deltaTime) {
    if (!EXPERIMENTAL_3D.enabled) {
      return;
    }

    if (!ensureResources()) {
      setEnabled(false);
      return;
    }

    attachInputHandlers();
    resizeCanvas();

    const gl = EXPERIMENTAL_3D.gl;

    getPerformanceMonitor()?.beginRender?.();

    if (GPU_TIMER.gl !== gl) {
      resetGpuTimer(gl);
    }

    pollGpuTimer();

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    updateCameraFromPlayer();

    const projection = getActiveProjection3D();

    if (!projection) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      return;
    }

    const view = getActiveView3D();

    const bloom = window.bloomSystem3D;

    const bloomActive =
      bloom?.begin(gl, gl.canvas.width, gl.canvas.height) === true;

    if (!bloomActive) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    beginGpuTimer();

    try {
      transparentGltfDrawQueue.length = 0;
      transparentGltfSequence = 0;
      transparentGltfViewMatrix = view;

      gl.enable(gl.DEPTH_TEST);
      gl.depthMask(true);
      gl.enable(gl.BLEND);

      STATIC_MODEL_CULLING.planes = STATIC_MODEL_CULLING.enabled
        ? extractStaticModelFrustumPlanes(projection, view)
        : null;

      gl.useProgram(EXPERIMENTAL_3D.program);

      setGltfLighting(false);

      gl.uniformMatrix4fv(
        EXPERIMENTAL_3D.uniforms.projection,
        false,
        projection,
      );

      gl.uniformMatrix4fv(EXPERIMENTAL_3D.uniforms.view, false, view);

      gl.uniform3fv(
        EXPERIMENTAL_3D.uniforms.cameraPosition,
        EXPERIMENTAL_3D.position,
      );

      const me = getLocalPlayer();

      const playerGameX = me ? me.x : 200;
      const playerGameY = me ? me.y : 200;

      const worldScene = window.engineSceneBridge?.getWorldScene() ?? null;

      const scene = window.engineSceneBridge?.getEntityScene() ?? null;

      profileRendererStage("scenePreparation", () => {
        prepareStaticModelFrame(worldScene);
      });

      if (SHADOW_CONFIG.enabled && SHADOW_MAP.ready) {
        profileRendererStage("shadowPass", () => {
          renderStaticShadowDepthPass();
        });
      }

      profileRendererStage("ground", () => {
        drawBgGroundTiles(playerGameX, playerGameY, worldScene);
      });

      profileRendererStage("staticGeometry", () => {
        drawStaticGeometry3D(worldScene);
      });

      profileRendererStage("foundationEditor", () => {
        drawFoundationEditor3D();
      });

      profileRendererStage("worldItems", () => {
        drawWorldItems3D(scene);
      });

      profileRendererStage("enemies", () => {
        drawEnemies3D(scene);
      });

      profileRendererStage("npcs", () => {
        drawNPCs3D(scene);
      });

      profileRendererStage("players", () => {
        drawPlayers3D(scene, deltaTime);
      });

      profileRendererStage("bullets", () => {
        drawBullets3D(scene);
      });

      profileRendererStage("implantEffects", () => {
        drawImplantEffects3D(scene);
      });

      profileRendererStage("transparentGltf", () => {
        flushTransparentGltfDrawQueue();
      });
    } finally {
      try {
        if (bloomActive) {
          profileRendererStage("bloom", () => {
            bloom.finish();
          });
        }
      } finally {
        endGpuTimer();
        getPerformanceMonitor()?.endRender?.();
      }
    }

    EXPERIMENTAL_3D.lastFrameTime = deltaTime || 0;
  }

  window.staticModelLOD3D = Object.freeze({
    isEnabled() {
      return STATIC_MODEL_LOD.enabled;
    },

    setEnabled(enabled) {
      if (typeof enabled !== "boolean") {
        return false;
      }

      STATIC_MODEL_LOD.enabled = enabled;

      if (!enabled) {
        STATIC_MODEL_LOD.states.clear();
      }

      return true;
    },

    getStats() {
      const models = [];

      for (const [key, state] of STATIC_MODEL_LOD.states) {
        models.push({
          key,
          index: state.index,
          requestedIndex: state.requestedIndex,
          distance: state.distance,
          assetUrl: state.activeAssetUrl,
        });
      }

      return {
        enabled: STATIC_MODEL_LOD.enabled,
        switches: STATIC_MODEL_LOD.switches,
        models,
      };
    },
  });

  window.staticModelCulling3D = Object.freeze({
    isEnabled() {
      return STATIC_MODEL_CULLING.enabled;
    },

    setEnabled(enabled) {
      if (typeof enabled !== "boolean") {
        return false;
      }

      STATIC_MODEL_CULLING.enabled = enabled;

      if (!enabled) {
        STATIC_MODEL_CULLING.planes = null;
      }

      return true;
    },
  });

  window.vanilla3DRenderer = {
    setMaterialLightingMode(mode) {
      if (mode !== "legacy" && mode !== "pbr") {
        return false;
      }

      GLTF_MATERIAL_LIGHTING.mode = mode;

      return true;
    },

    getMaterialLightingMode() {
      return GLTF_MATERIAL_LIGHTING.mode;
    },

    getGpuTimerState() {
      return {
        supported: GPU_TIMER.supported,
        active: Boolean(GPU_TIMER.activeQuery),
        pending: GPU_TIMER.pendingQueries.length,
        samples: GPU_TIMER.samples,
        lastMs: GPU_TIMER.lastMs,
        stagesMs: { ...GPU_TIMER.lastStagesMs },
        disjointCount: GPU_TIMER.disjointCount,
        sampleEveryFrames: GPU_TIMER_CONFIG.sampleEveryFrames,
        maxPendingQueries: GPU_TIMER_CONFIG.maxPendingQueries,
      };
    },

    getShadowState() {
      return {
        enabled: SHADOW_CONFIG.enabled,
        ready: SHADOW_MAP.ready,
        failed: SHADOW_MAP.failed,
        mapSize: SHADOW_CONFIG.mapSize,
        hasContext: Boolean(EXPERIMENTAL_3D.gl),
        hasFramebuffer: Boolean(SHADOW_MAP.framebuffer),
        hasDepthTexture: Boolean(SHADOW_MAP.depthTexture),
        depthPassReady: SHADOW_MAP.depthPassReady,
        drawCalls: SHADOW_MAP.drawCalls,
        hasLightMatrix: Boolean(SHADOW_MAP.lightMatrix),
        cacheHits: SHADOW_MAP.cacheHits,
        cacheMisses: SHADOW_MAP.cacheMisses,
        cacheActive: SHADOW_MAP.cacheKey !== null,
      };
    },
    getState() {
      const cameraState = window.cameraSystem3D?.getState?.();

      return {
        enabled: EXPERIMENTAL_3D.enabled,

        cameraMode: cameraState?.mode ?? "orbit",

        yaw: cameraState?.yaw ?? EXPERIMENTAL_3D.yaw,

        pitch: cameraState?.pitch ?? EXPERIMENTAL_3D.pitch,

        distance: cameraState?.distance ?? EXPERIMENTAL_3D.distance,

        minDistance: EXPERIMENTAL_3D.MIN_CAMERA_DISTANCE,

        maxDistance: EXPERIMENTAL_3D.MAX_CAMERA_DISTANCE,

        target: [...EXPERIMENTAL_3D.target],

        position: [...EXPERIMENTAL_3D.position],

        groundTextureCount: EXPERIMENTAL_3D.groundTextures.size,

        groundChunkEnabled: EXPERIMENTAL_3D.groundChunkEnabled,

        groundChunkCount: EXPERIMENTAL_3D.groundChunks.size,

        groundChunkDrawCalls: EXPERIMENTAL_3D.groundChunkDrawCalls,

        groundFallbackDrawCalls: EXPERIMENTAL_3D.groundFallbackDrawCalls,

        groundTextureWorldId: EXPERIMENTAL_3D.groundTextureWorldId,

        hasWalkingPlayerTexture: Boolean(
          EXPERIMENTAL_3D.playerTextures.walking,
        ),

        hasAttackPlayerTexture: Boolean(EXPERIMENTAL_3D.playerTextures.attack),
      };
    },

    setGroundChunksEnabled(enabled) {
      if (typeof enabled !== "boolean") {
        return false;
      }

      EXPERIMENTAL_3D.groundChunkEnabled = enabled;

      return true;
    },

    setEnabled(nextEnabled) {
      return setEnabled(nextEnabled);
    },

    setCameraMode(mode) {
      return window.cameraSystem3D?.setMode?.(mode) ?? false;
    },

    getCameraMode() {
      return window.cameraSystem3D?.getMode?.() ?? "orbit";
    },

    screenToWorld,

    pickEnemy(clientX, clientY) {
      return pickEnemy3D(clientX, clientY);
    },

    render,

    resetCamera() {
      const cameraSystem = window.cameraSystem3D;

      if (cameraSystem && typeof cameraSystem.reset === "function") {
        return cameraSystem.reset();
      }

      // Defensive fallback.
      EXPERIMENTAL_3D.yaw = -Math.PI / 2;
      EXPERIMENTAL_3D.pitch = 0.52;
      EXPERIMENTAL_3D.distance = 280;

      console.log("[3D] Camera reset.");

      return true;
    },

    clearGroundTextureCache() {
      deleteGroundTextureCache();
    },
  };
})();
