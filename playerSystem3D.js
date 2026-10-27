(function () {
  "use strict";

  function getPlayerModelConfig() {
    const config = window.engineSceneBridge?.getPlayerVisualConfig?.()?.model3D;

    if (
      !config ||
      typeof config.assetUrl !== "string" ||
      !config.assetUrl.trim() ||
      typeof config.resolveAnimation !== "function"
    ) {
      return null;
    }

    return config;
  }

  const instances = new Map();

  const bindPoseCache = new WeakMap();

  const bindShapeCorrectionCache = new WeakMap();

  // ============================================================
  // MATRIX
  // ============================================================

  function identity() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }

  function multiply(a, b) {
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
  }

  function translation(x, y, z) {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]);
  }

  function scaling(x, y, z) {
    return new Float32Array([x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]);
  }

  function quaternionMatrix(x, y, z, w) {
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
  }

  function invert(a) {
    const out = new Float32Array(16);

    const a00 = a[0];
    const a01 = a[1];
    const a02 = a[2];
    const a03 = a[3];

    const a10 = a[4];
    const a11 = a[5];
    const a12 = a[6];
    const a13 = a[7];

    const a20 = a[8];
    const a21 = a[9];
    const a22 = a[10];
    const a23 = a[11];

    const a30 = a[12];
    const a31 = a[13];
    const a32 = a[14];
    const a33 = a[15];

    const b00 = a00 * a11 - a01 * a10;

    const b01 = a00 * a12 - a02 * a10;

    const b02 = a00 * a13 - a03 * a10;

    const b03 = a01 * a12 - a02 * a11;

    const b04 = a01 * a13 - a03 * a11;

    const b05 = a02 * a13 - a03 * a12;

    const b06 = a20 * a31 - a21 * a30;

    const b07 = a20 * a32 - a22 * a30;

    const b08 = a20 * a33 - a23 * a30;

    const b09 = a21 * a32 - a22 * a31;

    const b10 = a21 * a33 - a23 * a31;

    const b11 = a22 * a33 - a23 * a32;

    let det =
      b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;

    if (Math.abs(det) < 0.0000001) {
      return identity();
    }

    det = 1 / det;

    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;

    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;

    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;

    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;

    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;

    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;

    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;

    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;

    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;

    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;

    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;

    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;

    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;

    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;

    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;

    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

    return out;
  }

  function composeTransform(translationValue, rotationValue, scaleValue) {
    const t = translation(
      translationValue[0],
      translationValue[1],
      translationValue[2],
    );

    const r = quaternionMatrix(
      rotationValue[0],
      rotationValue[1],
      rotationValue[2],
      rotationValue[3],
    );

    const s = scaling(scaleValue[0], scaleValue[1], scaleValue[2]);

    return multiply(multiply(t, r), s);
  }

  // ============================================================
  // ANIMATION
  // ============================================================

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function normalizeQuaternion(q) {
    const length = Math.hypot(q[0], q[1], q[2], q[3]);

    if (length < 0.000001) {
      return [0, 0, 0, 1];
    }

    return [q[0] / length, q[1] / length, q[2] / length, q[3] / length];
  }

  function slerpQuaternion(a, b, t) {
    let bx = b[0];
    let by = b[1];
    let bz = b[2];
    let bw = b[3];

    let cosTheta = a[0] * bx + a[1] * by + a[2] * bz + a[3] * bw;

    if (cosTheta < 0) {
      cosTheta = -cosTheta;

      bx = -bx;
      by = -by;
      bz = -bz;
      bw = -bw;
    }

    if (cosTheta > 0.9995) {
      return normalizeQuaternion([
        lerp(a[0], bx, t),
        lerp(a[1], by, t),
        lerp(a[2], bz, t),
        lerp(a[3], bw, t),
      ]);
    }

    const theta = Math.acos(Math.min(1, Math.max(-1, cosTheta)));

    const sinTheta = Math.sin(theta);

    if (Math.abs(sinTheta) < 0.000001) {
      return [...a];
    }

    const weightA = Math.sin((1 - t) * theta) / sinTheta;

    const weightB = Math.sin(t * theta) / sinTheta;

    return [
      a[0] * weightA + bx * weightB,

      a[1] * weightA + by * weightB,

      a[2] * weightA + bz * weightB,

      a[3] * weightA + bw * weightB,
    ];
  }

  function findKeyframe(times, time) {
    if (!times || times.length <= 1) {
      return {
        a: 0,
        b: 0,
        t: 0,
      };
    }

    if (time <= times[0]) {
      return {
        a: 0,
        b: 0,
        t: 0,
      };
    }

    const lastIndex = times.length - 1;

    if (time >= times[lastIndex]) {
      return {
        a: lastIndex,
        b: lastIndex,
        t: 0,
      };
    }

    let low = 0;
    let high = lastIndex;

    while (low + 1 < high) {
      const middle = (low + high) >> 1;

      if (times[middle] <= time) {
        low = middle;
      } else {
        high = middle;
      }
    }

    const start = times[low];

    const end = times[high];

    const span = end - start;

    return {
      a: low,
      b: high,

      t: span > 0 ? (time - start) / span : 0,
    };
  }

  function sampleSampler(sampler, path, time) {
    const times = sampler.input;

    const values = sampler.output;

    const components = path === "rotation" ? 4 : 3;

    const key = findKeyframe(times, time);

    const offsetA = key.a * components;

    const offsetB = key.b * components;

    const a = [];

    const b = [];

    for (let i = 0; i < components; i++) {
      a.push(values[offsetA + i]);

      b.push(values[offsetB + i]);
    }

    if (key.a === key.b || sampler.interpolation === "STEP") {
      return a;
    }

    if (sampler.interpolation !== "LINEAR") {
      // Current player.glb uses
      // LINEAR / STEP.
      return a;
    }

    if (path === "rotation") {
      return slerpQuaternion(a, b, key.t);
    }

    return [
      lerp(a[0], b[0], key.t),
      lerp(a[1], b[1], key.t),
      lerp(a[2], b[2], key.t),
    ];
  }

  function findClip(asset, name) {
    return (
      asset.animations?.find((animation) => animation.name === name) || null
    );
  }

  // ============================================================
  // INSTANCE
  // ============================================================

  function getInstance(playerId) {
    let instance = instances.get(playerId);

    if (!instance) {
      instance = {
        playerId,

        clipName: null,
        animationTime: 0,

        pose: null,
      };

      instances.set(playerId, instance);
    }

    return instance;
  }

  function chooseAnimation(player, config) {
    const animation = config.resolveAnimation(player);

    if (!animation || typeof animation.name !== "string" || !animation.name) {
      return null;
    }

    return animation;
  }

  function buildPose(asset, clip, animationTime) {
    const nodeCount = asset.nodes.length;

    const translations = new Array(nodeCount);

    const rotations = new Array(nodeCount);

    const scales = new Array(nodeCount);

    for (let i = 0; i < nodeCount; i++) {
      const transform = asset.nodes[i].transform;

      translations[i] = [...transform.translation];

      rotations[i] = [...transform.rotation];

      scales[i] = [...transform.scale];
    }

    if (clip) {
      for (const channel of clip.channels) {
        if (!Number.isInteger(channel.node)) {
          continue;
        }

        const sampler = clip.samplers[channel.sampler];

        if (!sampler) {
          continue;
        }

        const value = sampleSampler(sampler, channel.path, animationTime);

        if (
          !Array.isArray(value) ||
          value.some((component) => !Number.isFinite(component))
        ) {
          continue;
        }

        switch (channel.path) {
          case "translation":
            translations[channel.node] = value;
            break;

          case "rotation":
            rotations[channel.node] = value;
            break;

          case "scale":
            scales[channel.node] = value;
            break;

          default:
            break;
        }
      }
    }

    const localMatrices = new Array(nodeCount);

    for (let i = 0; i < nodeCount; i++) {
      const transform = asset.nodes[i].transform;

      if (transform.matrix && !clip) {
        localMatrices[i] = new Float32Array(transform.matrix);
      } else {
        localMatrices[i] = composeTransform(
          translations[i],
          rotations[i],
          scales[i],
        );
      }
    }

    const worldMatrices = new Array(nodeCount);

    function visit(nodeIndex, parentMatrix) {
      const local = localMatrices[nodeIndex];

      const world = multiply(parentMatrix, local);

      worldMatrices[nodeIndex] = world;

      for (const child of asset.nodes[nodeIndex].children || []) {
        visit(child, world);
      }
    }

    const rootIdentity = identity();

    for (const rootNode of asset.rootNodes) {
      visit(rootNode, rootIdentity);
    }

    return {
      localMatrices,
      worldMatrices,
    };
  }

  function getBindPose(asset) {
    let pose = bindPoseCache.get(asset);

    if (!pose) {
      pose = buildPose(asset, null, 0);
      bindPoseCache.set(asset, pose);
    }

    return pose;
  }

  function getBindShapeCorrection(asset, meshNodeIndex, skinIndex) {
    let assetCorrections = bindShapeCorrectionCache.get(asset);

    if (!assetCorrections) {
      assetCorrections = new Map();
      bindShapeCorrectionCache.set(asset, assetCorrections);
    }

    const cacheKey = `${meshNodeIndex}:${skinIndex}`;
    const cached = assetCorrections.get(cacheKey);

    if (cached) {
      return cached;
    }

    const skin = asset.skins?.[skinIndex];
    const bindPose = getBindPose(asset);
    const bindMeshWorld = bindPose.worldMatrices[meshNodeIndex];

    if (!skin || !bindMeshWorld || skin.joints.length === 0) {
      console.error("[3D][PLAYER] Cannot validate skin bind space.", {
        meshNodeIndex,
        skinIndex,
      });

      return identity();
    }

    let maxIdentityError = 0;
    let maxMeshWorldError = 0;

    for (let jointIndex = 0; jointIndex < skin.joints.length; jointIndex++) {
      const jointWorld = bindPose.worldMatrices[skin.joints[jointIndex]];

      if (!jointWorld) {
        maxIdentityError = Infinity;
        maxMeshWorldError = Infinity;
        break;
      }

      const inverseBind = skin.inverseBindMatrices.subarray(
        jointIndex * 16,
        jointIndex * 16 + 16,
      );
      const bindJointMatrix = multiply(jointWorld, inverseBind);

      for (let i = 0; i < 16; i++) {
        const identityValue =
          i === 0 || i === 5 || i === 10 || i === 15 ? 1 : 0;
        maxIdentityError = Math.max(
          maxIdentityError,
          Math.abs(bindJointMatrix[i] - identityValue),
        );
        maxMeshWorldError = Math.max(
          maxMeshWorldError,
          Math.abs(bindJointMatrix[i] - bindMeshWorld[i]),
        );
      }
    }

    const needsBindShapeCorrection =
      maxIdentityError < 0.001 && maxMeshWorldError > 0.001;
    const correction = needsBindShapeCorrection ? bindMeshWorld : identity();
    const inverseBindMeshWorld = invert(bindMeshWorld);
    let maxBindPoseError = 0;

    for (let jointIndex = 0; jointIndex < skin.joints.length; jointIndex++) {
      const jointWorld = bindPose.worldMatrices[skin.joints[jointIndex]];

      if (!jointWorld) {
        maxBindPoseError = Infinity;
        break;
      }

      const inverseBind = skin.inverseBindMatrices.subarray(
        jointIndex * 16,
        jointIndex * 16 + 16,
      );
      const bindPalette = multiply(
        multiply(multiply(inverseBindMeshWorld, correction), jointWorld),
        inverseBind,
      );

      for (let i = 0; i < 16; i++) {
        const identityValue =
          i === 0 || i === 5 || i === 10 || i === 15 ? 1 : 0;
        maxBindPoseError = Math.max(
          maxBindPoseError,
          Math.abs(bindPalette[i] - identityValue),
        );
      }
    }

    if (!Number.isFinite(maxBindPoseError) || maxBindPoseError > 0.001) {
      console.error("[3D][PLAYER] Inconsistent skin bind spaces.", {
        meshNodeIndex,
        skinIndex,
        maxBindPoseError,
      });

      assetCorrections.set(cacheKey, identity());
      return identity();
    }

    assetCorrections.set(cacheKey, correction);
    return correction;
  }

  function buildSkinMatrices(asset, pose, meshNodeIndex, skinIndex) {
    const skin = asset.skins?.[skinIndex];

    if (!skin) {
      return null;
    }

    const meshWorld = pose.worldMatrices[meshNodeIndex];

    if (!meshWorld) {
      return null;
    }

    const inverseMeshWorld = invert(meshWorld);

    const bindShapeCorrection = getBindShapeCorrection(
      asset,
      meshNodeIndex,
      skinIndex,
    );

    const jointCount = skin.joints.length;

    const output = new Float32Array(jointCount * 16);

    const skinBaseMatrix = multiply(inverseMeshWorld, bindShapeCorrection);

    for (let jointIndex = 0; jointIndex < jointCount; jointIndex++) {
      const jointNodeIndex = skin.joints[jointIndex];

      const jointWorld = pose.worldMatrices[jointNodeIndex];

      if (!jointWorld) {
        continue;
      }

      const inverseBind = skin.inverseBindMatrices.subarray(
        jointIndex * 16,
        jointIndex * 16 + 16,
      );

      const jointMatrix = multiply(
        multiply(skinBaseMatrix, jointWorld),
        inverseBind,
      );

      output.set(jointMatrix, jointIndex * 16);
    }

    return output;
  }

  function updatePlayer(renderData, deltaSeconds) {
    const assetSystem = window.gltfAssetSystem3D;
    const config = getPlayerModelConfig();

    if (!assetSystem || !config) {
      return null;
    }

    const assetUrl = config.assetUrl;

    const asset = assetSystem.get(assetUrl);

    if (!asset) {
      if (assetSystem.getStatus(assetUrl) === "missing") {
        assetSystem.preload(assetUrl);
      }

      return null;
    }

    const playerId = renderData.id;

    const instance = getInstance(playerId);

    const animation = chooseAnimation(renderData, config);

    if (!animation) {
      return null;
    }

    const clip = findClip(asset, animation.name);

    if (instance.clipName !== animation.name) {
      instance.clipName = animation.name;

      instance.animationTime = 0;
    }

    if (clip && animation.playing) {
      instance.animationTime += Math.max(0, deltaSeconds);

      if (animation.loop && clip.duration > 0) {
        instance.animationTime %= clip.duration;
      } else if (clip.duration > 0) {
        instance.animationTime = Math.min(
          instance.animationTime,
          clip.duration,
        );
      }
    } else {
      instance.animationTime = 0;
    }

    const pose = buildPose(asset, clip, instance.animationTime);

    instance.pose = pose;

    const skinMatricesCache = new Map();

    return {
      assetUrl,

      asset,

      playerId,

      x: Number(renderData.x),

      y: Number(renderData.y),

      health: Number(renderData.health),

      direction: renderData.direction || "down",

      state: renderData.state || "idle",

      animation: animation.name,

      animationTime: instance.animationTime,

      pose,

      getSkinMatrices(meshNodeIndex, skinIndex) {
        const cacheKey = `${meshNodeIndex}:${skinIndex}`;

        if (skinMatricesCache.has(cacheKey)) {
          return skinMatricesCache.get(cacheKey);
        }

        const matrices = buildSkinMatrices(
          asset,
          pose,
          meshNodeIndex,
          skinIndex,
        );

        skinMatricesCache.set(cacheKey, matrices);

        return matrices;
      },
    };
  }

  function updateScene(players, deltaTimeMs) {
    if (!Array.isArray(players)) {
      return [];
    }

    const deltaSeconds =
      Math.min(Math.max(Number(deltaTimeMs) || 0, 0), 250) / 1000;

    const activeIds = new Set();

    const result = [];

    for (const player of players) {
      if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y)) {
        continue;
      }

      activeIds.add(player.id);

      const state = updatePlayer(player, deltaSeconds);

      if (state) {
        result.push(state);
      }
    }

    for (const playerId of instances.keys()) {
      if (!activeIds.has(playerId)) {
        instances.delete(playerId);
      }
    }

    return result;
  }

  function preload() {
    const assetUrl = getAssetUrl();

    if (!assetUrl) {
      return false;
    }

    return window.gltfAssetSystem3D?.preload?.(assetUrl) ?? false;
  }

  function getAssetUrl() {
    return getPlayerModelConfig()?.assetUrl ?? null;
  }

  function clear() {
    instances.clear();
  }

  window.playerSystem3D = Object.freeze({
    preload,
    updateScene,
    getAssetUrl,
    clear,
  });
})();
