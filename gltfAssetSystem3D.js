(function () {
  "use strict";

  const GLB_MAGIC = 0x46546c67;
  const GLB_VERSION = 2;

  const GLB_CHUNK_TYPE_JSON = 0x4e4f534a;
  const GLB_CHUNK_TYPE_BIN = 0x004e4942;

  const COMPONENT_TYPES = Object.freeze({
    5120: {
      ArrayType: Int8Array,
      bytes: 1,
    },

    5121: {
      ArrayType: Uint8Array,
      bytes: 1,
    },

    5122: {
      ArrayType: Int16Array,
      bytes: 2,
    },

    5123: {
      ArrayType: Uint16Array,
      bytes: 2,
    },

    5125: {
      ArrayType: Uint32Array,
      bytes: 4,
    },

    5126: {
      ArrayType: Float32Array,
      bytes: 4,
    },
  });

  const TYPE_COMPONENT_COUNT = Object.freeze({
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    MAT2: 4,
    MAT3: 9,
    MAT4: 16,
  });

  const assetCache = new Map();

  // ============================================================
  // HELPERS
  // ============================================================

  function align4(value) {
    return (value + 3) & ~3;
  }

  function isFiniteNumber(value) {
    return Number.isFinite(value);
  }

  function normalizeUrl(url) {
    if (typeof url !== "string") {
      return null;
    }

    const normalized = url.trim();

    return normalized || null;
  }

  function decodeJsonChunk(bytes) {
    const decoder = new TextDecoder("utf-8");

    const text = decoder
      .decode(bytes)
      .replace(/\u0000+$/g, "")
      .trim();

    return JSON.parse(text);
  }

  // ============================================================
  // GLB CONTAINER
  // ============================================================

  function parseGlb(arrayBuffer) {
    if (!(arrayBuffer instanceof ArrayBuffer)) {
      throw new Error("GLB source must be an ArrayBuffer.");
    }

    if (arrayBuffer.byteLength < 20) {
      throw new Error("GLB file is too small.");
    }

    const view = new DataView(arrayBuffer);

    const magic = view.getUint32(0, true);
    const version = view.getUint32(4, true);
    const declaredLength = view.getUint32(8, true);

    if (magic !== GLB_MAGIC) {
      throw new Error("Invalid GLB magic.");
    }

    if (version !== GLB_VERSION) {
      throw new Error(
        `Unsupported GLB version: ${version}. Expected glTF 2.0.`,
      );
    }

    if (declaredLength > arrayBuffer.byteLength) {
      throw new Error("GLB declared length exceeds downloaded data.");
    }

    let offset = 12;

    let json = null;
    let binaryChunk = null;

    while (offset + 8 <= declaredLength) {
      const chunkLength = view.getUint32(offset, true);
      const chunkType = view.getUint32(offset + 4, true);

      offset += 8;

      if (offset + chunkLength > declaredLength) {
        throw new Error("Invalid GLB chunk length.");
      }

      const chunkBytes = new Uint8Array(arrayBuffer, offset, chunkLength);

      if (chunkType === GLB_CHUNK_TYPE_JSON) {
        json = decodeJsonChunk(chunkBytes);
      } else if (chunkType === GLB_CHUNK_TYPE_BIN) {
        binaryChunk = chunkBytes;
      }

      offset += chunkLength;
    }

    if (!json) {
      throw new Error("GLB JSON chunk was not found.");
    }

    if (!binaryChunk) {
      throw new Error("GLB BIN chunk was not found.");
    }

    return {
      json,
      binaryChunk,
    };
  }

  // ============================================================
  // ACCESSORS
  // ============================================================

  function normalizeAccessorArray(array, componentType) {
    if (!array) {
      return array;
    }

    const output = new Float32Array(array.length);

    switch (componentType) {
      // BYTE
      case 5120:
        for (let i = 0; i < array.length; i++) {
          output[i] = Math.max(array[i] / 127, -1);
        }
        return output;

      // UNSIGNED_BYTE
      case 5121:
        for (let i = 0; i < array.length; i++) {
          output[i] = array[i] / 255;
        }
        return output;

      // SHORT
      case 5122:
        for (let i = 0; i < array.length; i++) {
          output[i] = Math.max(array[i] / 32767, -1);
        }
        return output;

      // UNSIGNED_SHORT
      case 5123:
        for (let i = 0; i < array.length; i++) {
          output[i] = array[i] / 65535;
        }
        return output;

      // FLOAT is already normalized as a real float value.
      case 5126:
        return new Float32Array(array);

      default:
        throw new Error(
          `Normalized accessor componentType ${componentType} is not supported.`,
        );
    }
  }

  function readAccessor(gltf, binaryChunk, accessorIndex) {
    const accessor = gltf.accessors?.[accessorIndex];

    if (!accessor) {
      throw new Error(`Accessor ${accessorIndex} was not found.`);
    }

    if (accessor.sparse) {
      throw new Error(`Sparse accessor ${accessorIndex} is not supported yet.`);
    }

    const bufferView = gltf.bufferViews?.[accessor.bufferView];

    if (!bufferView) {
      throw new Error(`bufferView ${accessor.bufferView} was not found.`);
    }

    const componentInfo = COMPONENT_TYPES[accessor.componentType];

    if (!componentInfo) {
      throw new Error(
        `Unsupported accessor componentType: ${accessor.componentType}`,
      );
    }

    const componentCount = TYPE_COMPONENT_COUNT[accessor.type];

    if (!componentCount) {
      throw new Error(`Unsupported accessor type: ${accessor.type}`);
    }

    const count = Number(accessor.count);

    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`Invalid accessor count for accessor ${accessorIndex}.`);
    }

    const packedElementSize = componentInfo.bytes * componentCount;

    const byteStride = Number(bufferView.byteStride) || packedElementSize;

    const bufferViewOffset = Number(bufferView.byteOffset) || 0;

    const accessorOffset = Number(accessor.byteOffset) || 0;

    const sourceOffset =
      binaryChunk.byteOffset + bufferViewOffset + accessorOffset;

    const sourceBuffer = binaryChunk.buffer;

    const outputLength = count * componentCount;

    if (
      byteStride === packedElementSize &&
      sourceOffset % componentInfo.bytes === 0
    ) {
      const source = new componentInfo.ArrayType(
        sourceBuffer,
        sourceOffset,
        outputLength,
      );

      const output = new componentInfo.ArrayType(source);

      if (accessor.normalized === true) {
        return normalizeAccessorArray(output, accessor.componentType);
      }

      return output;
    }

    // General path for interleaved/strided data.
    const output = new componentInfo.ArrayType(outputLength);

    const dataView = new DataView(sourceBuffer);

    function readComponent(byteOffset) {
      switch (accessor.componentType) {
        case 5120:
          return dataView.getInt8(byteOffset);

        case 5121:
          return dataView.getUint8(byteOffset);

        case 5122:
          return dataView.getInt16(byteOffset, true);

        case 5123:
          return dataView.getUint16(byteOffset, true);

        case 5125:
          return dataView.getUint32(byteOffset, true);

        case 5126:
          return dataView.getFloat32(byteOffset, true);

        default:
          throw new Error(
            `Unsupported componentType ${accessor.componentType}.`,
          );
      }
    }

    for (let elementIndex = 0; elementIndex < count; elementIndex++) {
      const elementOffset = sourceOffset + elementIndex * byteStride;

      for (
        let componentIndex = 0;
        componentIndex < componentCount;
        componentIndex++
      ) {
        const componentOffset =
          elementOffset + componentIndex * componentInfo.bytes;

        output[elementIndex * componentCount + componentIndex] =
          readComponent(componentOffset);
      }
    }

    if (accessor.normalized === true) {
      return normalizeAccessorArray(output, accessor.componentType);
    }

    return output;
  }

  // ============================================================
  // EMBEDDED IMAGES
  // ============================================================

  async function decodeEmbeddedImage(gltf, binaryChunk, imageIndex) {
    const imageDefinition = gltf.images?.[imageIndex];

    if (!imageDefinition) {
      return null;
    }

    if (!Number.isInteger(imageDefinition.bufferView)) {
      throw new Error(
        `Image ${imageIndex} is not embedded in a GLB bufferView.`,
      );
    }

    const bufferView = gltf.bufferViews?.[imageDefinition.bufferView];

    if (!bufferView) {
      throw new Error(
        `Image bufferView ${imageDefinition.bufferView} was not found.`,
      );
    }

    const byteOffset =
      binaryChunk.byteOffset + (Number(bufferView.byteOffset) || 0);

    const byteLength = Number(bufferView.byteLength);

    if (!Number.isFinite(byteLength) || byteLength <= 0) {
      throw new Error(`Image ${imageIndex} has invalid byteLength.`);
    }

    const bytes = new Uint8Array(binaryChunk.buffer, byteOffset, byteLength);

    const blob = new Blob([bytes], {
      type: imageDefinition.mimeType || "application/octet-stream",
    });

    if (typeof createImageBitmap === "function") {
      return await createImageBitmap(blob);
    }

    const objectUrl = URL.createObjectURL(blob);

    try {
      const image = new Image();

      image.decoding = "async";

      const loadedImage = await new Promise((resolve, reject) => {
        image.onload = () => resolve(image);

        image.onerror = () =>
          reject(new Error(`Failed to decode embedded image ${imageIndex}.`));

        image.src = objectUrl;
      });

      return loadedImage;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  // ============================================================
  // MATERIALS
  // ============================================================

  function getTextureImageIndex(gltf, textureInfo) {
    if (!textureInfo || !Number.isInteger(textureInfo.index)) {
      return null;
    }

    const texture = gltf.textures?.[textureInfo.index];

    if (!texture || !Number.isInteger(texture.source)) {
      return null;
    }

    return texture.source;
  }

  async function buildMaterial(
    gltf,
    binaryChunk,
    materialIndex,
    imagePromises,
  ) {
    const materialDefinition = gltf.materials?.[materialIndex] || {};

    const pbr = materialDefinition.pbrMetallicRoughness || {};

    const baseColorImageIndex = getTextureImageIndex(
      gltf,
      pbr.baseColorTexture,
    );

    const normalImageIndex = getTextureImageIndex(
      gltf,
      materialDefinition.normalTexture,
    );

    const metallicRoughnessImageIndex = getTextureImageIndex(
      gltf,
      pbr.metallicRoughnessTexture,
    );

    const emissiveImageIndex = getTextureImageIndex(
      gltf,
      materialDefinition.emissiveTexture,
    );

    async function getImage(imageIndex) {
      if (!Number.isInteger(imageIndex)) {
        return null;
      }

      if (!imagePromises.has(imageIndex)) {
        imagePromises.set(
          imageIndex,
          decodeEmbeddedImage(gltf, binaryChunk, imageIndex),
        );
      }

      return await imagePromises.get(imageIndex);
    }

    return {
      name:
        typeof materialDefinition.name === "string"
          ? materialDefinition.name
          : `material-${materialIndex}`,

      doubleSided: materialDefinition.doubleSided === true,

      alphaMode: ["OPAQUE", "MASK", "BLEND"].includes(
        materialDefinition.alphaMode,
      )
        ? materialDefinition.alphaMode
        : "OPAQUE",

      alphaCutoff: Number.isFinite(materialDefinition.alphaCutoff)
        ? Math.max(0, Math.min(1, materialDefinition.alphaCutoff))
        : 0.5,

      baseColorFactor:
        Array.isArray(pbr.baseColorFactor) && pbr.baseColorFactor.length === 4
          ? [...pbr.baseColorFactor]
          : [1, 1, 1, 1],

      baseColorImage: await getImage(baseColorImageIndex),

      normalImage: await getImage(normalImageIndex),

      normalScale: isFiniteNumber(materialDefinition.normalTexture?.scale)
        ? Math.max(0, materialDefinition.normalTexture.scale)
        : 1,

      metallicRoughnessImage: await getImage(metallicRoughnessImageIndex),

      metallicFactor: isFiniteNumber(pbr.metallicFactor)
        ? pbr.metallicFactor
        : 1,

      roughnessFactor: isFiniteNumber(pbr.roughnessFactor)
        ? pbr.roughnessFactor
        : 1,

      emissiveFactor:
        Array.isArray(materialDefinition.emissiveFactor) &&
        materialDefinition.emissiveFactor.length === 3 &&
        materialDefinition.emissiveFactor.every(isFiniteNumber)
          ? materialDefinition.emissiveFactor.map((value) =>
              Math.max(0, Math.min(1, value)),
            )
          : [0, 0, 0],

      emissiveImage: await getImage(emissiveImageIndex),
    };
  }

  // ============================================================
  // PRIMITIVES / MESHES
  // ============================================================

  async function buildPrimitive(gltf, binaryChunk, primitive, imagePromises) {
    if (!primitive?.attributes) {
      throw new Error("glTF primitive has no attributes.");
    }

    if (!Number.isInteger(primitive.attributes.POSITION)) {
      throw new Error("glTF primitive has no POSITION accessor.");
    }

    if (!Number.isInteger(primitive.indices)) {
      throw new Error("Non-indexed glTF primitives are not supported yet.");
    }

    const mode = Number.isInteger(primitive.mode) ? primitive.mode : 4;

    if (mode !== 4) {
      throw new Error(
        `Unsupported glTF primitive mode ${mode}. Only TRIANGLES is supported.`,
      );
    }

    const positions = readAccessor(
      gltf,
      binaryChunk,
      primitive.attributes.POSITION,
    );

    const normals = Number.isInteger(primitive.attributes.NORMAL)
      ? readAccessor(gltf, binaryChunk, primitive.attributes.NORMAL)
      : null;

    const uvs = Number.isInteger(primitive.attributes.TEXCOORD_0)
      ? readAccessor(gltf, binaryChunk, primitive.attributes.TEXCOORD_0)
      : null;

    const joints = Number.isInteger(primitive.attributes.JOINTS_0)
      ? readAccessor(gltf, binaryChunk, primitive.attributes.JOINTS_0)
      : null;

    const weights = Number.isInteger(primitive.attributes.WEIGHTS_0)
      ? readAccessor(gltf, binaryChunk, primitive.attributes.WEIGHTS_0)
      : null;

    const indices = readAccessor(gltf, binaryChunk, primitive.indices);

    const vertexCount = positions.length / 3;

    const colors = new Float32Array(vertexCount * 4);

    colors.fill(1);

    const material = Number.isInteger(primitive.material)
      ? await buildMaterial(
          gltf,
          binaryChunk,
          primitive.material,
          imagePromises,
        )
      : {
          name: "default",
          doubleSided: false,
          alphaMode: "OPAQUE",
          alphaCutoff: 0.5,
          baseColorFactor: [1, 1, 1, 1],
          baseColorImage: null,
          normalImage: null,
          normalScale: 1,
          metallicRoughnessImage: null,
          metallicFactor: 1,
          roughnessFactor: 1,
          emissiveFactor: [0, 0, 0],
          emissiveImage: null,
        };

    return Object.freeze({
      positions,
      normals,

      uvs: uvs || new Float32Array(vertexCount * 2),
      hasTexCoord0: Boolean(uvs) && uvs.length === vertexCount * 2,

      joints,
      weights,

      colors,
      indices,
      material,

      isSkinned: Boolean(joints) && Boolean(weights),
    });
  }

  // ============================================================
  // NODE TRANSFORMS
  // ============================================================

  function getNodeTransform(node) {
    return Object.freeze({
      matrix:
        Array.isArray(node?.matrix) && node.matrix.length === 16
          ? [...node.matrix]
          : null,

      translation:
        Array.isArray(node?.translation) && node.translation.length === 3
          ? [...node.translation]
          : [0, 0, 0],

      rotation:
        Array.isArray(node?.rotation) && node.rotation.length === 4
          ? [...node.rotation]
          : [0, 0, 0, 1],

      scale:
        Array.isArray(node?.scale) && node.scale.length === 3
          ? [...node.scale]
          : [1, 1, 1],
    });
  }

  function buildSkins(gltf, binaryChunk) {
    const skinDefinitions = gltf.skins || [];

    return skinDefinitions.map((skin, skinIndex) => {
      const joints = Array.isArray(skin.joints) ? [...skin.joints] : [];

      let inverseBindMatrices = null;

      if (Number.isInteger(skin.inverseBindMatrices)) {
        inverseBindMatrices = readAccessor(
          gltf,
          binaryChunk,
          skin.inverseBindMatrices,
        );
      }

      if (
        !inverseBindMatrices ||
        inverseBindMatrices.length !== joints.length * 16
      ) {
        console.warn(
          `[GLTF3D] Skin ${skinIndex} has invalid inverse bind matrices. Using identity matrices.`,
        );

        inverseBindMatrices = new Float32Array(joints.length * 16);

        for (let i = 0; i < joints.length; i++) {
          const offset = i * 16;

          inverseBindMatrices[offset] = 1;

          inverseBindMatrices[offset + 5] = 1;

          inverseBindMatrices[offset + 10] = 1;

          inverseBindMatrices[offset + 15] = 1;
        }
      }

      return Object.freeze({
        name: typeof skin.name === "string" ? skin.name : `skin-${skinIndex}`,

        joints: Object.freeze(joints),

        skeleton: Number.isInteger(skin.skeleton) ? skin.skeleton : null,

        inverseBindMatrices,
      });
    });
  }

  function buildAnimations(gltf, binaryChunk) {
    const animationDefinitions = gltf.animations || [];

    return animationDefinitions.map((animation, animationIndex) => {
      const samplers = (animation.samplers || []).map(
        (sampler, samplerIndex) => {
          if (
            !Number.isInteger(sampler.input) ||
            !Number.isInteger(sampler.output)
          ) {
            throw new Error(
              `[GLTF3D] Animation ${animationIndex}, sampler ${samplerIndex} is invalid.`,
            );
          }

          const input = readAccessor(gltf, binaryChunk, sampler.input);

          const output = readAccessor(gltf, binaryChunk, sampler.output);

          return Object.freeze({
            input,
            output,

            interpolation:
              typeof sampler.interpolation === "string"
                ? sampler.interpolation
                : "LINEAR",
          });
        },
      );

      const channels = (animation.channels || []).map((channel) =>
        Object.freeze({
          sampler: channel.sampler,

          node: Number.isInteger(channel.target?.node)
            ? channel.target.node
            : null,

          path: channel.target?.path || null,
        }),
      );

      let duration = 0;

      for (const sampler of samplers) {
        if (sampler.input.length > 0) {
          duration = Math.max(
            duration,

            sampler.input[sampler.input.length - 1],
          );
        }
      }

      return Object.freeze({
        name:
          typeof animation.name === "string"
            ? animation.name
            : `animation-${animationIndex}`,

        samplers: Object.freeze(samplers),

        channels: Object.freeze(channels),

        duration,
      });
    });
  }

  async function buildAsset(url, gltf, binaryChunk) {
    const imagePromises = new Map();
    const skins = buildSkins(gltf, binaryChunk);

    const animations = buildAnimations(gltf, binaryChunk);

    const meshes = [];

    for (
      let meshIndex = 0;
      meshIndex < (gltf.meshes?.length || 0);
      meshIndex++
    ) {
      const meshDefinition = gltf.meshes[meshIndex];

      const primitives = [];

      for (const primitive of meshDefinition.primitives || []) {
        primitives.push(
          await buildPrimitive(gltf, binaryChunk, primitive, imagePromises),
        );
      }

      meshes.push(
        Object.freeze({
          name:
            typeof meshDefinition.name === "string"
              ? meshDefinition.name
              : `mesh-${meshIndex}`,

          primitives: Object.freeze(primitives),
        }),
      );
    }

    const nodes = (gltf.nodes || []).map((node, nodeIndex) =>
      Object.freeze({
        name: typeof node.name === "string" ? node.name : `node-${nodeIndex}`,

        mesh: Number.isInteger(node.mesh) ? node.mesh : null,

        skin: Number.isInteger(node.skin) ? node.skin : null,

        children: Array.isArray(node.children) ? [...node.children] : [],

        transform: getNodeTransform(node),
      }),
    );

    const activeSceneIndex = Number.isInteger(gltf.scene) ? gltf.scene : 0;

    const activeScene = gltf.scenes?.[activeSceneIndex] || null;

    const rootNodes = Array.isArray(activeScene?.nodes)
      ? [...activeScene.nodes]
      : [];

    return Object.freeze({
      url,

      asset: gltf.asset || {
        version: "2.0",
      },

      meshes: Object.freeze(meshes),

      nodes: Object.freeze(nodes),

      skins: Object.freeze(skins),

      animations: Object.freeze(animations),

      rootNodes: Object.freeze(rootNodes),
    });
  }

  // ============================================================
  // LOADING / CACHE
  // ============================================================

  async function load(url) {
    const normalizedUrl = normalizeUrl(url);

    if (!normalizedUrl) {
      throw new Error("[GLTF3D] load() requires a valid URL.");
    }

    const cached = assetCache.get(normalizedUrl);

    if (cached?.status === "ready") {
      return cached.asset;
    }

    if (cached?.status === "loading") {
      return cached.promise;
    }

    const promise = (async () => {
      const response = await fetch(normalizedUrl);

      if (!response.ok) {
        throw new Error(
          `Failed to load ${normalizedUrl}: HTTP ${response.status}.`,
        );
      }

      const arrayBuffer = await response.arrayBuffer();

      const { json, binaryChunk } = parseGlb(arrayBuffer);

      if (json.asset?.version !== "2.0") {
        throw new Error(`Unsupported glTF version: ${json.asset?.version}`);
      }

      const asset = await buildAsset(normalizedUrl, json, binaryChunk);

      assetCache.set(normalizedUrl, {
        status: "ready",
        asset,
        promise: Promise.resolve(asset),
        error: null,
      });

      console.log(`[GLTF3D] Loaded: ${normalizedUrl}`);

      return asset;
    })();

    assetCache.set(normalizedUrl, {
      status: "loading",
      asset: null,
      promise,
      error: null,
    });

    try {
      return await promise;
    } catch (error) {
      assetCache.set(normalizedUrl, {
        status: "error",
        asset: null,
        promise: null,
        error,
      });

      console.error(`[GLTF3D] Failed to load: ${normalizedUrl}`, error);

      throw error;
    }
  }

  function preload(url) {
    load(url).catch(() => {});

    return true;
  }

  function get(url) {
    const normalizedUrl = normalizeUrl(url);

    if (!normalizedUrl) {
      return null;
    }

    return assetCache.get(normalizedUrl)?.asset || null;
  }

  function getStatus(url) {
    const normalizedUrl = normalizeUrl(url);

    if (!normalizedUrl) {
      return "missing";
    }

    return assetCache.get(normalizedUrl)?.status || "missing";
  }

  function getError(url) {
    const normalizedUrl = normalizeUrl(url);

    if (!normalizedUrl) {
      return null;
    }

    return assetCache.get(normalizedUrl)?.error || null;
  }

  function clear(url = null) {
    if (url === null) {
      assetCache.clear();

      return true;
    }

    const normalizedUrl = normalizeUrl(url);

    if (!normalizedUrl) {
      return false;
    }

    return assetCache.delete(normalizedUrl);
  }

  window.gltfAssetSystem3D = Object.freeze({
    load,
    preload,

    get,
    getStatus,
    getError,

    clear,
  });
})();
