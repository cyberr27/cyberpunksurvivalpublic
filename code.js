// Получаем элементы DOM

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const inventoryEl = document.getElementById("items");
window.ctx = ctx;
const statsEl = document.getElementById("stats");
let isStatsOpen = true;
window.isStatsOpen = true;

function toggleStats() {
  isStatsOpen = !isStatsOpen;
  window.isStatsOpen = isStatsOpen;

  const statsContainer = document.getElementById("stats");
  if (statsContainer) {
    statsContainer.style.display = isStatsOpen ? "block" : "none";
  }
}

window.lastPointerCanvasX = null;
window.lastPointerCanvasY = null;

window.lastPointerWorldX = null;
window.lastPointerWorldY = null;

window.lastPointerClientX = null;
window.lastPointerClientY = null;

const game3DPointerCanvas = document.getElementById("game3DCanvas");

function handleTrackedTouchMove(event) {
  const touch = event.touches?.[0];

  if (!touch) {
    return;
  }

  updatePointerCoordinates(touch.clientX, touch.clientY);
}

canvas.addEventListener("touchmove", handleTrackedTouchMove, {
  passive: true,
});

if (game3DPointerCanvas) {
  game3DPointerCanvas.addEventListener("touchmove", handleTrackedTouchMove, {
    passive: true,
  });
}

// Элементы авторизации
const authContainer = document.getElementById("authContainer");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const toRegister = document.getElementById("toRegister");
const toLogin = document.getElementById("toLogin");
const loginError = document.getElementById("loginError");
const registerError = document.getElementById("registerError");
const btnRu = document.getElementById("btnRu");
const btnEn = document.getElementById("btnEn");

let ws;
window.sector12WorldBarriersRevision = -1;

let pendingWorldBuildingRequest = null;
let worldBuildingRequestCounter = 0;
let pendingWorldBarriersRequest = null;
let worldBarriersRequestCounter = 0;

function requestWorldBuildingsSnapshot() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false;
  }

  ws.send(
    JSON.stringify({
      type: "worldBuildingsGet",
    }),
  );

  return true;
}

function applySelectedWorldBuilding() {
  const editor = window.foundationEditor3D;

  if (!editor || !ws || ws.readyState !== WebSocket.OPEN) {
    return false;
  }

  if (pendingWorldBuildingRequest) return false;

  const request = editor.beginApply?.();
  if (!request) return false;

  const requestId = `editor-${++worldBuildingRequestCounter}`;

  pendingWorldBuildingRequest = {
    requestId,
    buildingId: request.buildingId,
  };

  ws.send(
    JSON.stringify({
      type: "worldBuildingApply",
      requestId,
      ...request,
    }),
  );

  return true;
}

function handleWorldBuildingMessage(data) {
  const editor = window.foundationEditor3D;

  if (data.type === "worldBuildingsSnapshot") {
    editor?.applyServerSnapshot?.(data);
    return true;
  }

  if (data.type === "worldBuildingUpdated") {
    const accepted = editor?.applyServerUpdate?.(data);

    if (!accepted) {
      requestWorldBuildingsSnapshot();
    }

    return true;
  }

  if (data.type === "worldBuildingApplyResult") {
    const pending = pendingWorldBuildingRequest;

    if (!pending || data.requestId !== pending.requestId) {
      return true;
    }

    pendingWorldBuildingRequest = null;
    editor?.finishApply?.(data);

    window.dispatchEvent(
      new CustomEvent("foundationEditor3DSaveResult", {
        detail: data,
      }),
    );

    if (data.error === "REVISION_CONFLICT") {
      requestWorldBuildingsSnapshot();
    }

    return true;
  }

  return false;
}

window.sector12WorldBuildings = Object.freeze({
  apply: applySelectedWorldBuilding,
  refresh: requestWorldBuildingsSnapshot,
});

function requestWorldBarriersSnapshot() {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false;
  }

  ws.send(
    JSON.stringify({
      type: "worldBarriersGet",
    }),
  );

  return true;
}

function applySelectedWorldBarriers() {
  const barriersSystem = window.barriersSystem;

  if (!barriersSystem || !ws || ws.readyState !== WebSocket.OPEN) {
    return false;
  }

  if (pendingWorldBarriersRequest) {
    return false;
  }

  const worldId = window.worldSystem?.currentWorldId;
  if (!Number.isSafeInteger(worldId)) {
    return false;
  }

  const expectedRevision = Number.isSafeInteger(
    barriersSystem.serverRevisionByWorld?.get(worldId),
  )
    ? barriersSystem.serverRevisionByWorld.get(worldId)
    : globalThis.sector12WorldBarriersRevision;

  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    console.warn("[WorldBarriers] Server revision is not ready.");

    requestWorldBarriersSnapshot();
    return false;
  }

  const barriers = barriersSystem.getEffectiveBarriersForWorld(worldId);

  const requestId = `barriers-${++worldBarriersRequestCounter}`;

  pendingWorldBarriersRequest = {
    requestId,
    worldId,
  };

  ws.send(
    JSON.stringify({
      type: "worldBarriersApply",
      requestId,
      worldId,
      expectedRevision,
      barriers,
    }),
  );

  return true;
}

function handleWorldBarrierMessage(data) {
  if (data.type === "worldBarriersSnapshot") {
    if (window.barriersSystem?.onBarriersSync) {
      window.barriersSystem.onBarriersSync(data);
    }
    return true;
  }

  if (data.type === "worldBarriersUpdated") {
    if (window.barriersSystem?.onBarriersSync) {
      window.barriersSystem.onBarriersSync(data);
    }
    return true;
  }

  if (data.type === "worldBarriersApplyResult") {
    const pending = pendingWorldBarriersRequest;
    if (!pending || data.requestId !== pending.requestId) {
      return true;
    }

    pendingWorldBarriersRequest = null;
    window.barriersSystem?.handleApplyResult?.(data);

    if (data.error === "REVISION_CONFLICT") {
      requestWorldBarriersSnapshot();
    }

    return true;
  }

  return false;
}

window.sector12WorldBarriers = Object.freeze({
  apply: applySelectedWorldBarriers,
  refresh: requestWorldBarriersSnapshot,
});

let players = new Map();
let myId;

window.sector12SceneAdapter?.setLocalPlayerProvider?.(
  () => players.get(myId) ?? null,
);

window.editorPlayerCountProvider = () => players.size;
const items = new Map();
class EventBus {
  constructor() {
    this.listeners = new Map();
  }
  on(eventName, listener) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    this.listeners.get(eventName).add(listener);
    return () => this.off(eventName, listener);
  }
  off(eventName, listener) {
    this.listeners.get(eventName)?.delete(listener);
  }
  emit(eventName, payload) {
    this.listeners.get(eventName)?.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.error(`UI event listener failed: ${eventName}`, error);
      }
    });
  }
}

class GameContext {
  constructor() {
    this.players = players;
    this.enemies = typeof enemies !== "undefined" ? enemies : new Map();
    this.bullets = typeof bullets !== "undefined" ? bullets : new Map();
    this.projectiles = [];
    this.inventory = [];
    this.items = items;
    this.pendingPickups = new Set();
    this.messageQueue = [];
    this.isProcessingMessages = false;
    this.atomFrame = 0;
    this.atomFrameTime = 0;
    this.uiEvents = new EventBus();
    this.systems = {};
  }
}

const gameContext = new GameContext();

if (window.sceneEntitySystem?.setPlayerProvider) {
  window.sceneEntitySystem.setPlayerProvider(() => players);
} else {
  console.error(
    "[Game] sceneEntitySystem is unavailable. Player scene provider was not registered.",
  );
}

if (!window.notificationsSystem) {
  window.notificationsSystem = {};
}
const pendingPickups = gameContext.pendingPickups;

function attachGameSystems(context) {
  const scope = globalThis;
  context.systems = {
    worldSystem: scope.worldSystem,
    lightsSystem: scope.lightsSystem,
    vendingMachine: scope.vendingMachine,
    misterTwister: scope.misterTwister,
    movementSystem: scope.movementSystem,
    npcSystem: scope.npcSystem,
    jackSystem: scope.jackSystem,
    outpostCaptainSystem: scope.outpostCaptainSystem,
    vacuumRobotSystem: scope.vacuumRobotSystem,
    cockroachSystem: scope.cockroachSystem,
    droneSystem: scope.droneSystem,
    bonfireSystem: scope.bonfireSystem,
    clockSystem: scope.clockSystem,
    corporateRobotSystem: scope.corporateRobotSystem,
    robotDoctorSystem: scope.robotDoctorSystem,
    thimbleriggerSystem: scope.thimbleriggerSystem,
    trashCansSystem: scope.trashCansSystem,
    torestosSystem: scope.torestosSystem,
    toremidosSystem: scope.toremidosSystem,
    homelessSystem: scope.homelessSystem,
    portalSystem: scope.portalSystem,
    guardNpcSystem: scope.guardNpcSystem,
    combatSystem: scope.combatSystem,
    strongStrikeSystem: scope.strongStrikeSystem,
    chatSystem: scope.chatSystem,
    inventorySystem: scope.inventorySystem,
    tradeSystem: scope.tradeSystem,
    equipmentSystem: scope.equipmentSystem,
    implantsSystem: scope.implantsSystem,
    levelSystem: scope.levelSystem,
    skillsSystem: scope.skillsSystem,
    enemySystem: scope.enemySystem,
    regenerationSystem: scope.regenerationSystem,
    welcomeGuideSystem: scope.welcomeGuideSystem,
    neonNpcSystem: scope.neonNpcSystem,
    npcDialogSystem: scope.npcDialogSystem,
    potionNpcSystem: scope.potionNpcSystem,
    soundSystem: scope.soundSystem,
    cristinaNpc: scope.cristinaNpc,
    linaNpc: scope.linaNpc,
    viktorNpc: scope.viktorNpc,
    danielNpc: scope.danielNpc,
    warmanNpc: scope.warmanNpc,
    madDoctorSystem: scope.madDoctorSystem,
    yuriSystem: scope.yuriSystem,
  };
}

function setupUIEventBridge(context) {
  context.uiEvents.on("notification", ({ text, color }) => {
    if (typeof showNotification === "function") {
      showNotification(text, color);
    }
  });
  context.uiEvents.on("stats:update", () => {
    updateStatsDisplay();
  });
}

attachGameSystems(gameContext);
if (!window.inventorySystem || !window.inventorySystem.updateInventoryDisplay) {
  window.inventorySystem = {
    updateInventoryDisplay: function () {
      console.warn(
        "[inventorySystem] Заглушка: updateInventoryDisplay вызван до инициализации",
      );
      if (window.inventorySystem?.updateInventoryDisplay) {
        window.inventorySystem.updateInventoryDisplay();
      } else if (typeof updateInventoryDisplay === "function") {
        updateInventoryDisplay();
      }
    },
    initialize: function () {
      console.log(
        "[inventorySystem] Инициализация заглушки пропущена — будет перезаписана inventory.js",
      );
    },
  };
}
setupUIEventBridge(gameContext);

// i18n integration
function initI18nIntegration() {
  if (!window.i18n) return;
  const { setLanguage, getLanguage, translateDocument, t } = window.i18n;

  // initial translate
  translateDocument(document);

  // reflect active language on buttons
  function updateLangButtons() {
    const cur = getLanguage();
    if (btnRu) btnRu.classList.toggle("active", cur === "ru");
    if (btnEn) btnEn.classList.toggle("active", cur === "en");
  }
  updateLangButtons();

  if (btnRu) btnRu.addEventListener("click", () => setLanguage("ru"));
  if (btnEn) btnEn.addEventListener("click", () => setLanguage("en"));

  // update dynamic elements on language change
  window.addEventListener("languageChanged", (e) => {
    translateDocument(document);
    const chatInput = document.getElementById("chatInput");
    if (chatInput)
      chatInput.setAttribute("placeholder", t("chat_input_placeholder"));

    const healthEl = document.getElementById("health");
    const energyEl = document.getElementById("energy");
    const foodEl = document.getElementById("food");
    const waterEl = document.getElementById("water");
    const armorEl = document.getElementById("armor");
    if (healthEl) healthEl.textContent = t("stats_health");
    if (energyEl) energyEl.textContent = t("stats_energy");
    if (foodEl) foodEl.textContent = t("stats_food");
    if (waterEl) waterEl.textContent = t("stats_water");
    if (armorEl) armorEl.textContent = t("stats_armor");

    // update inventory buttons
    const useBtn = document.getElementById("useBtn");
    const dropBtn = document.getElementById("dropBtn");
    if (useBtn) useBtn.textContent = t("use_btn");
    if (dropBtn) dropBtn.textContent = t("drop_btn");

    updateLangButtons();

    // dispatch internal event so subsystems can react
    window.dispatchEvent(
      new CustomEvent("languageChangedInternal", { detail: e.detail }),
    );
  });

  // Observe dynamic additions under #gameContainer and translate them
  const gameContainer = document.getElementById("gameContainer");
  if (gameContainer) {
    const mo = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        if (m.type === "childList") {
          m.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              try {
                window.i18n.translateDocument(node);
              } catch (e) {
                /* ignore */
              }
            }
          });
        } else if (m.type === "attributes" && m.attributeName === "data-i18n") {
          const target = m.target;
          if (target && target.nodeType === 1)
            window.i18n.translateDocument(target);
        }
      });
    });
    mo.observe(gameContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-i18n"],
    });
    // keep observer reference so garbage collector doesn't collect it
    window.__kv_i18n_mo = mo;
  }
}

initI18nIntegration();

const GAME_CONFIG = {
  FRAME_DURATION: 80,
};

gameContext.atomFrame = 0;
gameContext.atomFrameTime = 0;
const ATOM_FRAMES = 40;
const ATOM_FRAME_DURATION = 180;
gameContext.projectiles = [];
gameContext.lightningStrikes = [];
Object.defineProperty(window, "implantProjectiles", {
  configurable: true,
  enumerable: false,

  get() {
    return gameContext.projectiles;
  },

  set(value) {
    if (Array.isArray(value)) {
      gameContext.projectiles = value;
    }
  },
});
window.implantRenderSystem = Object.freeze({
  getProjectiles() {
    return Array.isArray(gameContext.projectiles)
      ? gameContext.projectiles
      : [];
  },

  getLightningStrikes() {
    return Array.isArray(gameContext.lightningStrikes)
      ? gameContext.lightningStrikes
      : [];
  },

  getTornadoStrikes() {
    return Array.isArray(gameContext.tornadoStrikes)
      ? gameContext.tornadoStrikes
      : [];
  },
});
function cleanupExpiredImplantEffects(now = Date.now()) {
  const lightning = gameContext.lightningStrikes;

  if (Array.isArray(lightning)) {
    for (let i = lightning.length - 1; i >= 0; i--) {
      const strike = lightning[i];

      if (
        !strike ||
        !Number.isFinite(strike.x) ||
        !Number.isFinite(strike.y) ||
        now - (strike.spawnTime || now) >
          (strike.frames || 13) * (strike.frameDuration || 120) + 400
      ) {
        lightning.splice(i, 1);
      }
    }
  }

  const tornado = gameContext.tornadoStrikes;

  if (Array.isArray(tornado)) {
    for (let i = tornado.length - 1; i >= 0; i--) {
      const strike = tornado[i];

      if (
        !strike ||
        !Number.isFinite(strike.x) ||
        !Number.isFinite(strike.y) ||
        now - (strike.spawnTime || now) >
          (strike.frames || 13) * (strike.frameDuration || 120) + 300
      ) {
        tornado.splice(i, 1);
      }
    }
  }
}
let activeAnomaly = null;
let lastProjectileDebugLogAt = 0;

const PLAYER_VISUAL_2D = window.playerVisualConfig?.get();

if (!PLAYER_VISUAL_2D) {
  throw new Error("[Game] playerVisualConfig must be loaded before code.js.");
}

const WALK_FRAME_WIDTH = 120;
const WALK_FRAME_HEIGHT = 120;
const WALK_FRAME_COUNT = 16;

const ATTACK_FRAME_WIDTH = 120;
const ATTACK_FRAME_HEIGHT = 120;
const ATTACK_FRAME_COUNT = 13;

const WALK_FRAME_DURATION = GAME_CONFIG.FRAME_DURATION;
const ATTACK_FRAME_DURATION = 500 / ATTACK_FRAME_COUNT;

const CHAT_BUBBLE_LIFETIME = 6000;
const CHAT_BUBBLE_MAX_LENGTH = 15;
const CHAT_BUBBLE_FONT_SIZE = 12;
const CHAT_BUBBLE_OFFSET_Y = -65;

function cleanupOldChatBubbles() {
  const now = Date.now();
  players.forEach((player) => {
    if (
      player.chatBubble &&
      now - player.chatBubble.time > CHAT_BUBBLE_LIFETIME
    ) {
      player.chatBubble = null;
    }
  });
}

// === УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ДЛЯ РИСОВАНИЯ ПОВОРАЧИВАЕМЫХ СПРАЙТОВ ===
function drawRotatedSprite(
  image,
  sx,
  sy,
  sWidth,
  sHeight,
  dx,
  dy,
  dWidth,
  dHeight,
  angle,
) {
  ctx.save();
  ctx.translate(dx + dWidth / 2, dy + dHeight / 2);
  ctx.rotate(angle);
  ctx.drawImage(
    image,
    sx,
    sy,
    sWidth,
    sHeight,
    -dWidth / 2,
    -dHeight / 2,
    dWidth,
    dHeight,
  );
  ctx.restore();
}

const WALK_SPRITE_ROWS = Object.freeze({
  down: 0,
  "down-right": 120,
  right: 240,
  "up-right": 360,
  up: 480,
  "up-left": 600,
  left: 720,
  "down-left": 840,
});

// === СТАРЫЙ ATTACK ATLAS ===
// playerSprite.png остаётся без изменений.
const ATTACK_SPRITE_ROWS = Object.freeze({
  down: 0,
  "down-right": 120,
  right: 240,
  "up-right": 360,
  up: 480,
  "up-left": 600,
  left: 720,
  "down-left": 840,
});

// Загрузка изображений
const imageSources = {
  playerSprite: "playerSprite.png",
  playerWalkingSprite: "playerWalkingSprite.png",
  playerAttackSprite: "playerAttackSprite.png",
  energyDrinkImage: "energy_drink.png",
  nutImage: "nut.png",
  waterBottleImage: "water_bottle.png",
  cannedMeatImage: "canned_meat.png",
  mushroomImage: "mushroom.png",
  sausageImage: "sausage.png",
  bloodPackImage: "blood_pack.png",
  breadImage: "bread.png",
  vodkaBottleImage: "vodka_bottle.png",
  meatChunkImage: "meat_chunk.png",
  bloodSyringeImage: "blood_syringe.png",
  milkImage: "milk.png",
  condensedMilkImage: "condensed_milk.png",
  driedFishImage: "dried_fish.png",
  balyaryImage: "balyary.png",
  appleImage: "apple.png",
  berriesImage: "berry.png",
  carrotImage: "carrot.png",
  johnSprite: "JohnSprite.png",
  npcPhotoImage: "fotoQuestNPC.png",
  jackSprite: "jackSprite.png",
  jackPhotoImage: "jackPhoto.png",
  jackNoDoc: "jackNoDoc.png",
  jackDoc: "jackDoc.png",
  old_man_with_potions: "old_man_with_potions.png",
  potionBookImage: "potion_book.png",
  potionTalkBg: "potion-talk-bg.png",
  potionPotionBg: "potion-potion-bg.png",
  potionQuestBg: "potion-quest-bg.png",
  thimbleriggerDocBg: "thimblerigger-doc-bg.png",
  thimbleriggerMeetBg: "thimblerigger-meet-bg.png",
  thimbleriggerTalkBg: "thimblerigger-talk-bg.png",
  thimbleriggerGameBg: "thimblerigger-game-bg.png",
  cyberHelmetImage: "cyber_helmet.png",
  nanoArmorImage: "nano_armor.png",
  tacticalBeltImage: "tactical_belt.png",
  cyberPantsImage: "cyber_pants.png",
  speedBootsImage: "speed_boots.png",
  techGlovesImage: "tech_gloves.png",
  plasmaRifleImage: "plasma_rifle.png",
  knucklesImage: "knuckles.png",
  knifeImage: "knife.png",
  nano_absorbing_knife: "nano_absorbing_knife.png",
  batImage: "bat.png",
  atomImage: "atom.png",
  mutantSprite: "mutantSprite.png",
  scorpionSprite: "scorpionSprite.png",
  bloodEyeSprite: "blood_eye.png",
  alexNeonSprite: "alexNeonSprite.png",
  alexNeonFoto: "alexNeonFoto.png",
  guardSprite: "guardSprite.png",
  guardPhoto: "guardPhoto.png",
  vacuumRobotSprite: "vacuum_robot.png",
  vacuumPhotoImage: "vacuum_photo.png",
  cockroachSprite: "cockroachSprite.png",
  droneSprite: "dronSprite.png",
  bonfireImage: "bonfire.png",
  oclocSprite: "oclocSprite.png",
  corporateRobotSprite: "corporate_robot.png",
  corporateRobotFoto: "corporate_robot_foto.png",
  robotDoctorSprite: "robotDoctorSprite.png",
  robotDoctorFoto: "robot_doctor_foto.png",
  medicalCertificateImage: "medical_certificate.png",
  medicalCertificateStampedImage: "medical_certificate_stamped.png",
  shevaNoDoc: "shevaNoDoc.png",
  shevaDoc: "shevaDoc.png",
  thimbleriggerSprite: "thimblerigger.png",
  misterTwisterSprite: "mister_twister.png",
  trashImage: "trash.png",
  torestosSprite: "torestosSprite.png",
  torestosNoDoc: "torestosNoDoc.png",
  torestosDoc: "torestosDoc.png",
  toremidosSprite: "toremidosSprite.png",
  toremidosNoDoc: "toremidosNoDoc.png",
  toremidosDoc: "toremidosDoc.png",
  homelessSprite: "homeless.png",
  portalImage: "portal.png",

  neonNoDoc: "neon-no-doc.png",
  neonNoLevel: "neon-no-level.png",
  neonHi: "neon-hi.png",
  neonQuestOne: "neonQuestOne.png",
  neonQuestTwo: "neonQuestTwo.png",
  neonTalk: "neon-talk.png",

  cristinaSprite: "cristinaSprite.png",
  linaSprite: "linaSprite.png",
  viktorSprite: "viktorSprite.png",
  danielSprite: "danielSprite.png",
  warmanSprite: "warmanSprite.png",
  madDoctorSprite: "madDoctor.png",
  yuriSprite: "ImplantMerchantSprite.png",

  // === НОВАЯ ПОРВАННАЯ ЭКИПИРОВКА ===
  torn_baseball_cap_of_health: "torn_baseball_cap_of_health.png",
  torn_health_t_shirt: "torn_health_t_shirt.png",
  torn_health_gloves: "torn_health_gloves.png",
  torn_belt_of_health: "torn_belt_of_health.png",
  torn_pants_of_health: "torn_pants_of_health.png",
  torn_health_sneakers: "torn_health_sneakers.png",

  torn_energy_cap: "torn_energy_cap.png",
  torn_energy_t_shirt: "torn_energy_t_shirt.png",
  torn_gloves_of_energy: "torn_gloves_of_energy.png",
  torn_energy_belt: "torn_energy_belt.png",
  torn_pants_of_energy: "torn_pants_of_energy.png",
  torn_sneakers_of_energy: "torn_sneakers_of_energy.png",

  torn_cap_of_gluttony: "torn_cap_of_gluttony.png",
  torn_t_shirt_of_gluttony: "torn_t_shirt_of_gluttony.png",
  torn_gloves_of_gluttony: "torn_gloves_of_gluttony.png",
  torn_belt_of_gluttony: "torn_belt_of_gluttony.png",
  torn_pants_of_gluttony: "torn_pants_of_gluttony.png",
  torn_sneakers_of_gluttony: "torn_sneakers_of_gluttony.png",

  torn_cap_of_thirst: "torn_cap_of_thirst.png",
  torn_t_shirt_of_thirst: "torn_t_shirt_of_thirst.png",
  torn_gloves_of_thirst: "torn_gloves_of_thirst.png",
  torn_belt_of_thirst: "torn_belt_of_thirst.png",
  torn_pants_of_thirst: "torn_pants_of_thirst.png",
  torn_sneakers_of_thirst: "torn_sneakers_of_thirst.png",

  chameleonBeltImage: "chameleon_belt.png",
  chameleonCapImage: "chameleon_cap.png",
  chameleonGlovesImage: "chameleon_gloves.png",
  chameleonPantsImage: "chameleon_pants.png",
  chameleonSneakersImage: "chameleon_sneakers.png",
  chameleonTShirtImage: "chameleon_t_shirt.png",

  white_void_cap: "white_void_cap.png",
  white_void_t_shirt: "white_void_t_shirt.png",
  white_void_gloves: "white_void_gloves.png",
  white_void_belt: "white_void_belt.png",
  white_void_pants: "white_void_pants.png",
  white_void_sneakers: "white_void_sneakers.png",

  nanofabric_health_cap: "nanofabric_health_cap.png",
  energy_cap_made_of_nanofabric: "energy_cap_made_of_nanofabric.png",
  thirst_cap_made_of_nanofabric: "thirst_cap_made_of_nanofabric.png",
  gluttony_cap_made_of_nanofabric: "gluttony_cap_made_of_nanofabric.png",

  nanofiber_health_t_shirt: "nanofiber_health_t_shirt.png",
  energy_t_shirt_made_of_nanofiber: "energy_t_shirt_made_of_nanofiber.png",
  nanofiber_thirst_t_shirt: "nanofiber_thirst_t_shirt.png",
  gluttony_t_shirt_made_of_nanofiber: "gluttony_t_shirt_made_of_nanofiber.png",

  nanofiber_health_gloves: "nanofiber_health_gloves.png",
  nanofiber_energy_gloves: "nanofiber_energy_gloves.png",
  nanofiber_thirst_gloves: "nanofiber_thirst_gloves.png",
  gluttony_gloves_made_of_nanofiber: "gluttony_gloves_made_of_nanofiber.png",

  nanofiber_health_belt: "nanofiber_health_belt.png",
  nanofiber_energy_belt: "nanofiber_energy_belt.png",
  nanofiber_thirst_belt: "nanofiber_thirst_belt.png",
  nanofiber_gluttony_belt: "nanofiber_gluttony_belt.png",

  nanofiber_health_pants: "nanofiber_health_pants.png",
  nanofiber_energy_pants: "nanofiber_energy_pants.png",
  nanofiber_thirst_pants: "nanofiber_thirst_pants.png",
  gluttony_pants_made_of_nanofiber: "gluttony_pants_made_of_nanofiber.png",

  healthy_sneakers_made_of_nanofiber: "healthy_sneakers_made_of_nanofiber.png",
  energy_sneakers_made_of_nanofiber: "energy_sneakers_made_of_nanofiber.png",
  nanofiber_thirst_sneakers: "nanofiber_thirst_sneakers.png",
  gluttony_sneakers_made_of_nanofiber:
    "gluttony_sneakers_made_of_nanofiber.png",

  whole_chameleon_cap: "whole_chameleon_cap.png",
  whole_chameleon_t_shirt: "whole_chameleon_t_shirt.png",
  whole_chameleon_gloves: "whole_chameleon_gloves.png",
  whole_chameleon_belt: "whole_chameleon_belt.png",
  whole_chameleon_pants: "whole_chameleon_pants.png",
  whole_chameleon_sneakers: "whole_chameleon_sneakers.png",

  recipe_torn_equipment: "recipe_torn_equipment.png",
  recipe_chameleon_equipment: "recipe_chameleon_equipment.png",

  blue_crystal: "blue_crystal.png",
  green_crystal: "green_crystal.png",
  red_crystal: "red_crystal.png",
  white_crystal: "white_crystal.png",
  yellow_crystal: "yellow_crystal.png",
  chameleon_crystal: "chameleon_crystal.png",
  nanoalloy: "nanoalloy.png",
  nanofilament: "nanofilament.png",
  mutant_bone: "mutant_bone.png",
  scorpion_sting: "scorpion_sting.png",
  tears_of_a_bloody_eye: "tears_of_a_bloody_eye.png",

  fireballImplant: "fireballImplant.png",
  fireballHotBar: "fireballHotBar.png",
  fireballSprite: "fireballSprite.png",

  lightningHotBar: "lightningHotBar.png",
  lightningImplant: "lightningImplant.png",
  lightningSprite: "lightningSprite.png",

  tornadoSprite: "tornadoSprite.png",
  tornadoHotBar: "tornadoHotBar.png",
  tornadoImplant: "tornadoImplant.png",

  violentTornadoSprite: "violentTornadoSprite.png",
  violentTornadoHotBar: "violentTornadoHotBar.png",
  violentTornadoImplant: "violentTornadoImplant.png",

  talisman_strong_strike: "talisman_strong_strike.png",
  talisman_regeneration: "talisman_regeneration.png",
  talisman_endurance: "talisman_endurance.png",
  talisman_iron_stomach: "talisman_iron_stomach.png",
  talisman_anomaly_resistance: "talisman_anomaly_resistance.png",
  talisman_critical_strike: "talisman_critical_strike.png",
  talisman_dodge: "talisman_dodge.png",
  talisman_implant_sync: "talisman_implant_sync.png",
  talisman_speed: "talisman_speed.png",
  talisman_implant_range: "talisman_implant_range.png",
  talisman_receding_target: "talisman_receding_target.png",

  // === МАЛЫЕ ТАЛИСМАНЫ (+1) ===
  talisman_strong_strike_minor: "talisman_strong_strike.png",
  talisman_regeneration_minor: "talisman_regeneration.png",
  talisman_endurance_minor: "talisman_endurance.png",
  talisman_iron_stomach_minor: "talisman_iron_stomach.png",
  talisman_anomaly_resistance_minor: "talisman_anomaly_resistance.png",
  talisman_critical_strike_minor: "talisman_critical_strike.png",
  talisman_dodge_minor: "talisman_dodge.png",
  talisman_implant_sync_minor: "talisman_implant_sync.png",
  talisman_implant_range_minor: "talisman_implant_range.png",
  talisman_speed_minor: "talisman_speed.png",
};

const images = Object.create(null);

const imageLoadPromises = Object.entries(imageSources).map(([key, src]) => {
  const image = new Image();

  images[key] = image;

  const loadPromise = new Promise((resolve) => {
    image.addEventListener(
      "load",
      () => {
        resolve({ key, loaded: true });
      },
      { once: true },
    );

    image.addEventListener(
      "error",
      () => {
        console.error(`[Images] Failed to load: ${src}`);
        resolve({ key, loaded: false });
      },
      { once: true },
    );
  });

  image.src = src;

  return loadPromise;
});

const imagesReady = Promise.all(imageLoadPromises).then((results) => {
  const failed = results.filter((result) => !result.loaded);

  if (failed.length > 0) {
    console.warn(
      `[Images] ${failed.length} of ${results.length} images failed to load.`,
    );
  }

  return results;
});

const ITEM_CONFIG = {
  // === ЕДА / НАПИТКИ ===
  energy_drink: {
    effect: { energy: 20, water: 5 },
    image: images.energyDrinkImage,
    description:
      "Neuro-Stim Canister: high-voltage synth-caffeine cocktail. +20 energy, +5 water.",
    rarity: 2,
    canBeAutoSpawned: true,
    canDropFromEnemy: true,
  },
  nut: {
    effect: { food: 7 },
    image: images.nutImage,
    description:
      "SynthNut Protein Bar: compressed lab-grown muscle protein from corporate bioreactors. +7 food.",
    rarity: 3,
    canBeAutoSpawned: true,
    canDropFromEnemy: true,
  },
  water_bottle: {
    effect: { water: 30 },
    image: images.waterBottleImage,
    description:
      "Purified Hydro-Pack: recycled atmospheric condensate filtered through nano-membranes. +30 water.",
    rarity: 3,
    canBeAutoSpawned: true,
    canDropFromEnemy: true,
  },
  apple: {
    effect: { food: 8, water: 5 },
    image: images.appleImage,
    description:
      "Gene-Mod Apple: bio-engineered fruit grown under neon hydroponics. +8 food, +5 water.",
    rarity: 3,
    canBeAutoSpawned: true,
    canDropFromEnemy: true,
  },
  berries: {
    effect: { food: 6, water: 6 },
    image: images.berriesImage,
    description:
      "Nano-Berries: lab-cultured fruit clusters infused with micro-nutrients. +6 food, +6 water.",
    rarity: 3,
    canBeAutoSpawned: true,
    canDropFromEnemy: true,
  },
  carrot: {
    effect: { food: 5, energy: 3 },
    image: images.carrotImage,
    description:
      "Hydroponic Stim-Root: genetically enhanced root vegetable with mild energy additives. +5 food, +3 energy.",
    rarity: 3,
    canBeAutoSpawned: true,
    canDropFromEnemy: true,
  },
  canned_meat: {
    effect: { food: 20 },
    image: images.cannedMeatImage,
    description:
      "Vat-Grown Protein Can: industrial-grade cultured meat slurry sealed for long-term storage. +20 food.",
    rarity: 1,
    canBeAutoSpawned: true,
    canDropFromEnemy: true,
  },
  mushroom: {
    effect: { food: 5, energy: 15 },
    image: images.mushroomImage,
    description:
      "Undercity Stim-Fungus: psychoactive growth harvested from abandoned metro tunnels. +15 energy, +5 food.",
    rarity: 1,
    canBeAutoSpawned: true,
    canDropFromEnemy: true,
  },
  sausage: {
    effect: { food: 16, energy: 3 },
    image: images.sausageImage,
    description:
      "Synth-Meat Tube: extruded cloned protein with industrial preservatives. +16 food, +3 energy.",
    rarity: 2,
    canBeAutoSpawned: true,
    canDropFromEnemy: true,
  },
  blood_pack: {
    effect: { health: 40 },
    image: images.bloodPackImage,
    description:
      "Synthetic Plasma Pack: medical-grade artificial blood substitute. +40 health.",
    rarity: 1,
    canBeAutoSpawned: true,
    canDropFromEnemy: true,
  },
  bread: {
    effect: { food: 13, water: -2 },
    image: images.breadImage,
    description:
      "Algae Nutrient Loaf: dense carbohydrate block pressed from urban hydroponic algae. +13 food, -2 water.",
    rarity: 2,
    canBeAutoSpawned: true,
    canDropFromEnemy: true,
  },
  vodka_bottle: {
    effect: { health: 5, energy: -2, water: 1, food: 2 },
    image: images.vodkaBottleImage,
    description:
      "Industrial Synth-Spirit: high-proof solvent distilled from chemical runoff with medicinal additives. +5 health, -2 energy, +1 water, +2 food.",
    rarity: 2,
    canBeAutoSpawned: true,
    canDropFromEnemy: true,
  },
  meat_chunk: {
    effect: { food: 20, energy: 5, water: -2 },
    image: images.meatChunkImage,
    description:
      "Cloned Muscle Slab: raw vat-grown tissue cut from corporate bioreactor lines. +20 food, +5 energy, -2 water.",
    rarity: 2,
    canBeAutoSpawned: true,
    canDropFromEnemy: true,
  },
  blood_syringe: {
    effect: { health: 10 },
    image: images.bloodSyringeImage,
    description:
      "Nano-Blood Injector: single-use syringe of oxygen-rich synthetic hemoglobin. +10 health.",
    rarity: 2,
    canBeAutoSpawned: true,
    canDropFromEnemy: true,
  },
  milk: {
    effect: { water: 15, food: 5 },
    image: images.milkImage,
    description:
      "Lab-Cultured Dairy: animal-free milk substitute grown in sterile bioreactors. +15 water, +5 food.",
    rarity: 2,
    canBeAutoSpawned: true,
    canDropFromEnemy: true,
  },
  condensed_milk: {
    effect: { water: 5, food: 11, energy: 2 },
    image: images.condensedMilkImage,
    description:
      "Concentrated Nutrient Paste: ultra-dense synthetic dairy concentrate. +11 food, +5 water, +2 energy.",
    rarity: 2,
    canBeAutoSpawned: true,
    canDropFromEnemy: true,
  },
  dried_fish: {
    effect: { food: 10, water: -3 },
    image: images.driedFishImage,
    description:
      "Desiccated Aqua-Protein: tank-grown fish tissue dehydrated for long-term field rations. +10 food, -3 water.",
    rarity: 2,
    canBeAutoSpawned: true,
    canDropFromEnemy: true,
  },

  // === ВАЛЮТА И СПЕЦПРЕДМЕТЫ ===
  balyary: {
    image: images.balyaryImage,
    description: "Баляр: игровая валюта.",
    stackable: true,
    balyary: true,
    rarity: 1,
    canBeAutoSpawned: true,
    canDropFromEnemy: true,
  },
  atom: {
    effect: { armor: 5 },
    image: images.atomImage,
    description: "Атом — даёт +5 брони при использовании.",
    stackable: true,
    rarity: 1,
    canBeAutoSpawned: true,
    canDropFromEnemy: true,
  },
  medical_certificate: {
    image: images.medicalCertificateImage,
    description: "Мед. справка МД-07: подтверждает, что ты не зомби.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },
  medical_certificate_stamped: {
    image: images.medicalCertificateStampedImage,
    description: "Мед. справка с печатью заставы. Допуск в Неоновый Город.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },
  potion_book: {
    image: images.potionBookImage,
    description: "Книга рецептов Алхимика. Нельзя прочесть.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },

  // === КИБЕР-ЭКИПИРОВКА (ЭНДГЕЙМ) ===
  cyber_helmet: {
    type: "headgear",
    effect: { armor: 10, energy: 5 },
    image: images.cyberHelmetImage,
    description: "Кибершлем: +10 брони, +5 энергии",
    rarity: 4,
    level: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },
  nano_armor: {
    type: "armor",
    effect: { armor: 20, health: 10 },
    image: images.nanoArmorImage,
    description: "Нано-броня: +20 брони, +10 здоровья",
    rarity: 4,
    level: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },
  tactical_belt: {
    type: "belt",
    effect: { armor: 5, food: 5 },
    image: images.tacticalBeltImage,
    description: "Тактический пояс: +5 брони, +5 еды",
    rarity: 4,
    level: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },
  cyber_pants: {
    type: "pants",
    effect: { armor: 10, water: 5 },
    image: images.cyberPantsImage,
    description: "Киберштаны: +10 брони, +5 воды",
    rarity: 4,
    level: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },
  speed_boots: {
    type: "boots",
    effect: { armor: 5, energy: 10 },
    image: images.speedBootsImage,
    description: "Скоростные ботинки: +5 брони, +10 энергии",
    rarity: 4,
    level: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },
  tech_gloves: {
    type: "gloves",
    effect: { armor: 5, energy: 5 },
    image: images.techGlovesImage,
    description: "Технические перчатки: +5 брони, +5 энергии",
    rarity: 4,
    level: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },
  plasma_rifle: {
    type: "weapon",
    effect: { damage: 50, range: 200 },
    image: images.plasmaRifleImage,
    description: "Плазменная винтовка: 50 урона, дальность 200px",
    rarity: 4,
    hands: "twohanded",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },
  knuckles: {
    type: "weapon",
    effect: { damage: { min: 3, max: 7 } },
    image: images.knucklesImage,
    description: "Кастет: 3–7 урона в ближнем бою",
    rarity: 4,
    hands: "onehanded",
    level: 2,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  knife: {
    type: "weapon",
    effect: { damage: { min: 4, max: 6 } },
    image: images.knifeImage,
    description: "Нож: 4–6 урона в ближнем бою",
    rarity: 4,
    hands: "onehanded",
    level: 3,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  nano_absorbing_knife: {
    type: "weapon",
    effect: { damage: { min: 6, max: 9 } },
    image: images.nano_absorbing_knife,
    description: "Нож: 6–9 урона в ближнем бою",
    rarity: 4,
    hands: "onehanded",
    level: 3,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },
  bat: {
    type: "weapon",
    effect: { damage: { min: 5, max: 10 } },
    image: images.batImage,
    description: "Бита: 5–10 урона в ближнем бою",
    rarity: 4,
    hands: "onehanded",
    level: 4,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  talisman_strong_strike: {
    type: "talisman",
    skillBonus: { skillId: 1, value: 30 },
    image: images?.talisman_strong_strike || null,
    description:
      "Талисман Сильного удара: +30 к навыку Сильный удар, если находится в инвентаре.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },
  talisman_regeneration: {
    type: "talisman",
    skillBonus: { skillId: 2, value: 30 },
    image: images?.talisman_regeneration || null,
    description:
      "Талисман Регенерации: +30 к навыку Регенерация, если находится в инвентаре.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },
  talisman_endurance: {
    type: "talisman",
    skillBonus: { skillId: 3, value: 30 },
    image: images?.talisman_endurance || null,
    description:
      "Талисман Выносливости: +30 к навыку Выносливость, если находится в инвентаре.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },
  talisman_iron_stomach: {
    type: "talisman",
    skillBonus: { skillId: 4, value: 30 },
    image: images?.talisman_iron_stomach || null,
    description:
      "Талисман Железного желудка: +30 к навыку Железный желудок, если находится в инвентаре.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },
  talisman_anomaly_resistance: {
    type: "talisman",
    skillBonus: { skillId: 5, value: 30 },
    image: images?.talisman_anomaly_resistance || null,
    description:
      "Талисман Стойкости к аномалиям: +30 к навыку Стойкость к аномалиям, если находится в инвентаре.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },
  talisman_critical_strike: {
    type: "talisman",
    skillBonus: { skillId: 6, value: 30 },
    image: images?.talisman_critical_strike || null,
    description:
      "Талисман Критического удара: +30 к навыку Критический удар, если находится в инвентаре.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },
  talisman_dodge: {
    type: "talisman",
    skillBonus: { skillId: 7, value: 30 },
    image: images?.talisman_dodge || null,
    description:
      "Талисман Ловкого: +30 к навыку Ловкий, если находится в инвентаре.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },
  talisman_implant_sync: {
    type: "talisman",
    skillBonus: { skillId: 8, value: 30 },
    image: images?.talisman_implant_sync || null,
    description:
      "Талисман Имплантной синхронизации: +30 к навыку Имплантная Синхронизация, если находится в инвентаре.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },
  talisman_implant_range: {
    type: "talisman",
    skillBonus: { skillId: 9, value: 30 },
    image: images?.talisman_implant_range || null,
    description:
      "Талисман Дальности имплантов: +30 к навыку Дальность имплантов, если находится в инвентаре.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },
  talisman_speed: {
    type: "talisman",
    skillBonus: { skillId: 10, value: 30 },
    image: images?.talisman_speed || null,
    description:
      "Талисман Быстрых ног: +30 к навыку Быстрые Ноги, если находится в инвентаре.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },
  talisman_receding_target: {
    type: "talisman",
    skillBonus: { skillId: 11, value: 30 },
    image: images?.talisman_receding_target || null,
    description:
      "Амулет уходящей цели: +30 к навыку Уходящая цель, если находится в инвентаре.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: false,
  },

  // === КОЛЛЕКЦИЯ МАЛЫХ ТАЛИСМАНОВ (+1) ===
  talisman_strong_strike_minor: {
    type: "talisman",
    skillBonus: { skillId: 1, value: 1 },
    image:
      images?.talisman_strong_strike_minor ||
      images?.talisman_strong_strike ||
      null,
    description:
      "Малый талисман Сильного удара: +1 к навыку Сильный удар, если находится в инвентаре.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  talisman_regeneration_minor: {
    type: "talisman",
    skillBonus: { skillId: 2, value: 1 },
    image:
      images?.talisman_regeneration_minor ||
      images?.talisman_regeneration ||
      null,
    description:
      "Малый талисман Регенерации: +1 к навыку Регенерация, если находится в инвентаре.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  talisman_endurance_minor: {
    type: "talisman",
    skillBonus: { skillId: 3, value: 1 },
    image:
      images?.talisman_endurance_minor || images?.talisman_endurance || null,
    description:
      "Малый талисман Выносливости: +1 к навыку Выносливость, если находится в инвентаре.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  talisman_iron_stomach_minor: {
    type: "talisman",
    skillBonus: { skillId: 4, value: 1 },
    image:
      images?.talisman_iron_stomach_minor ||
      images?.talisman_iron_stomach ||
      null,
    description:
      "Малый талисман Железного желудка: +1 к навыку Железный желудок, если находится в инвентаре.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  talisman_anomaly_resistance_minor: {
    type: "talisman",
    skillBonus: { skillId: 5, value: 1 },
    image:
      images?.talisman_anomaly_resistance_minor ||
      images?.talisman_anomaly_resistance ||
      null,
    description:
      "Малый талисман Стойкости к аномалиям: +1 к навыку Стойкость к аномалиям, если находится в инвентаре.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  talisman_critical_strike_minor: {
    type: "talisman",
    skillBonus: { skillId: 6, value: 1 },
    image:
      images?.talisman_critical_strike_minor ||
      images?.talisman_critical_strike ||
      null,
    description:
      "Малый талисман Критического удара: +1 к навыку Критический удар, если находится в инвентаре.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  talisman_dodge_minor: {
    type: "talisman",
    skillBonus: { skillId: 7, value: 1 },
    image: images?.talisman_dodge_minor || images?.talisman_dodge || null,
    description:
      "Малый талисман Ловкого: +1 к навыку Ловкий, если находится в инвентаре.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  talisman_implant_sync_minor: {
    type: "talisman",
    skillBonus: { skillId: 8, value: 1 },
    image:
      images?.talisman_implant_sync_minor ||
      images?.talisman_implant_sync ||
      null,
    description:
      "Малый талисман Имплантной синхронизации: +1 к навыку Имплантная Синхронизация, если находится в инвентаре.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  talisman_implant_range_minor: {
    type: "talisman",
    skillBonus: { skillId: 9, value: 1 },
    image:
      images?.talisman_implant_range_minor ||
      images?.talisman_implant_range ||
      null,
    description:
      "Малый талисман Дальности имплантов: +1 к навыку Дальность имплантов, если находится в инвентаре.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  talisman_speed_minor: {
    type: "talisman",
    skillBonus: { skillId: 10, value: 1 },
    image: images?.talisman_speed_minor || images?.talisman_speed || null,
    description:
      "Малый талисман Быстрых ног: +1 к навыку Быстрые Ноги, если находится в инвентаре.",
    rarity: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },

  // === ПОРВАННАЯ СТАРТОВАЯ ЭКИПИРОВКА — АКТУАЛЬНЫЕ ЗНАЧЕНИЯ ИЗ items.js ===
  torn_baseball_cap_of_health: {
    type: "headgear",
    effect: { armor: 5, health: 5 },
    image: images.torn_baseball_cap_of_health,
    description:
      "Порванная кепка здоровья: +5 к максимальному здоровью и броне",
    rarity: 4,
    collection: "Torn Health",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  torn_health_t_shirt: {
    type: "armor",
    effect: { armor: 10, health: 10 },
    image: images.torn_health_t_shirt,
    description:
      "Порванная футболка здоровья: +10 к максимальному здоровью, +10 к броне",
    rarity: 4,
    collection: "Torn Health",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  torn_health_gloves: {
    type: "gloves",
    effect: { armor: 5, health: 3 },
    image: images.torn_health_gloves,
    description:
      "Порванные перчатки здоровья: +3 к максимальному здоровью, +5 к броне",
    rarity: 4,
    collection: "Torn Health",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  torn_belt_of_health: {
    type: "belt",
    effect: { armor: 3, health: 7 },
    image: images.torn_belt_of_health,
    description:
      "Порванный пояс здоровья: +7 к максимальному здоровью, +3 к броне",
    rarity: 4,
    collection: "Torn Health",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  torn_pants_of_health: {
    type: "pants",
    effect: { armor: 7, health: 6 },
    image: images.torn_pants_of_health,
    description:
      "Порванные штаны здоровья: +6 к максимальному здоровью, +7 к броне",
    rarity: 4,
    collection: "Torn Health",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  torn_health_sneakers: {
    type: "boots",
    effect: { armor: 5, health: 4 },
    image: images.torn_health_sneakers,
    description:
      "Порванные кроссовки здоровья: +4 к максимальному здоровью, +5 к броне",
    rarity: 4,
    collection: "Torn Health",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },

  // ЭНЕРГЕТИЧЕСКАЯ ЛИНИЯ
  torn_energy_cap: {
    type: "headgear",
    effect: { armor: 5, energy: 5 },
    image: images.torn_energy_cap,
    description:
      "Порванная кепка энергии: +5 к максимальной энергии, +5 к броне",
    rarity: 4,
    collection: "Torn Energy",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  torn_energy_t_shirt: {
    type: "armor",
    effect: { armor: 10, energy: 10 },
    image: images.torn_energy_t_shirt,
    description:
      "Порванная футболка энергии: +10 к максимальной энергии, +10 к броне",
    rarity: 4,
    collection: "Torn Energy",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  torn_gloves_of_energy: {
    type: "gloves",
    effect: { armor: 5, energy: 3 },
    image: images.torn_gloves_of_energy,
    description:
      "Порванные перчатки энергии: +3 к максимальной энергии, +5 к броне",
    rarity: 4,
    collection: "Torn Energy",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  torn_energy_belt: {
    type: "belt",
    effect: { armor: 3, energy: 7 },
    image: images.torn_energy_belt,
    description:
      "Порванный пояс энергии: +7 к максимальной энергии, +3 к броне",
    rarity: 4,
    collection: "Torn Energy",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  torn_pants_of_energy: {
    type: "pants",
    effect: { armor: 7, energy: 6 },
    image: images.torn_pants_of_energy,
    description:
      "Порванные штаны энергии: +6 к максимальной энергии, +7 к броне",
    rarity: 4,
    collection: "Torn Energy",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  torn_sneakers_of_energy: {
    type: "boots",
    effect: { armor: 5, energy: 4 },
    image: images.torn_sneakers_of_energy,
    description:
      "Порванные кроссовки энергии: +4 к максимальной энергии, +5 к броне",
    rarity: 4,
    collection: "Torn Energy",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },

  // ОБЖОРСТВО
  torn_cap_of_gluttony: {
    type: "headgear",
    effect: { armor: 5, food: 5 },
    image: images.torn_cap_of_gluttony,
    description: "Порванная кепка обжорства: +5 к максимальной еде, +5 к броне",
    rarity: 4,
    collection: "Torn Gluttony",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  torn_t_shirt_of_gluttony: {
    type: "armor",
    effect: { armor: 10, food: 10 },
    image: images.torn_t_shirt_of_gluttony,
    description:
      "Порванная футболка обжорства: +10 к максимальной еде, +10 к броне",
    rarity: 4,
    collection: "Torn Gluttony",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  torn_gloves_of_gluttony: {
    type: "gloves",
    effect: { armor: 5, food: 3 },
    image: images.torn_gloves_of_gluttony,
    description:
      "Порванные перчатки обжорства: +3 к максимальной еде, +5 к броне",
    rarity: 4,
    collection: "Torn Gluttony",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  torn_belt_of_gluttony: {
    type: "belt",
    effect: { armor: 3, food: 7 },
    image: images.torn_belt_of_gluttony,
    description: "Порванный пояс обжорства: +7 к максимальной еде, +3 к броне",
    rarity: 4,
    collection: "Torn Gluttony",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  torn_pants_of_gluttony: {
    type: "pants",
    effect: { armor: 7, food: 6 },
    image: images.torn_pants_of_gluttony,
    description: "Порванные штаны обжорства: +6 к максимальной еде, +7 к броне",
    rarity: 4,
    collection: "Torn Gluttony",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  torn_sneakers_of_gluttony: {
    type: "boots",
    effect: { armor: 5, food: 4 },
    image: images.torn_sneakers_of_gluttony,
    description:
      "Порванные кроссовки обжорства: +4 к максимальной еде, +5 к броне",
    rarity: 4,
    collection: "Torn Gluttony",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },

  // ЖАЖДА
  torn_cap_of_thirst: {
    type: "headgear",
    effect: { armor: 5, water: 5 },
    image: images.torn_cap_of_thirst,
    description: "Порванная кепка жажды: +5 к максимальной воде, +5 к броне",
    rarity: 4,
    collection: "Torn Thirst",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  torn_t_shirt_of_thirst: {
    type: "armor",
    effect: { armor: 10, water: 10 },
    image: images.torn_t_shirt_of_thirst,
    description:
      "Порванная футболка жажды: +10 к максимальной воде, +10 к броне",
    rarity: 4,
    collection: "Torn Thirst",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  torn_gloves_of_thirst: {
    type: "gloves",
    effect: { armor: 5, water: 3 },
    image: images.torn_gloves_of_thirst,
    description: "Порванные перчатки жажды: +3 к максимальной воде, +5 к броне",
    rarity: 4,
    collection: "Torn Thirst",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  torn_belt_of_thirst: {
    type: "belt",
    effect: { armor: 3, water: 7 },
    image: images.torn_belt_of_thirst,
    description: "Порванный пояс жажды: +7 к максимальной воде, +3 к броне",
    rarity: 4,
    collection: "Torn Thirst",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  torn_pants_of_thirst: {
    type: "pants",
    effect: { armor: 7, water: 6 },
    image: images.torn_pants_of_thirst,
    description: "Порванные штаны жажды: +6 к максимальной воде, +7 к броне",
    rarity: 4,
    collection: "Torn Thirst",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  torn_sneakers_of_thirst: {
    type: "boots",
    effect: { armor: 5, water: 4 },
    image: images.torn_sneakers_of_thirst,
    description:
      "Порванные кроссовки жажды: +4 к максимальной воде, +5 к броне",
    rarity: 4,
    collection: "Torn Thirst",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },

  nanofabric_health_cap: {
    type: "headgear",
    effect: { armor: 10, health: 15 },
    image: images.nanofabric_health_cap,
    description:
      "Нанофабриковая кепка здоровья: +15 к максимальному здоровью, +10 брони",
    rarity: 4,
    collection: "Nanofabric Health",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  energy_cap_made_of_nanofabric: {
    type: "headgear",
    effect: { armor: 10, energy: 15 },
    image: images.energy_cap_made_of_nanofabric,
    description:
      "Кепка энергии из нанофабрики: +15 к максимальной энергии, +10 брони",
    rarity: 4,
    collection: "Nanofabric Energy",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  thirst_cap_made_of_nanofabric: {
    type: "headgear",
    effect: { armor: 10, water: 15 },
    image: images.thirst_cap_made_of_nanofabric,
    description:
      "Кепка жажды из нанофабрики: +15 к максимальной воде, +10 брони",
    rarity: 4,
    collection: "Nanofabric Thirst",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  gluttony_cap_made_of_nanofabric: {
    type: "headgear",
    effect: { armor: 10, food: 15 },
    image: images.gluttony_cap_made_of_nanofabric,
    description:
      "Кепка обжорства из нанофабрики: +15 к максимальной еде, +10 брони",
    rarity: 4,
    collection: "Nanofabric Gluttony",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },

  nanofiber_health_t_shirt: {
    type: "armor",
    effect: { armor: 20, health: 30 },
    image: images.nanofiber_health_t_shirt,
    description:
      "Нанофибровая футболка здоровья: +30 к максимальному здоровью, +20 брони",
    rarity: 4,
    collection: "Nanofabric Health",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  energy_t_shirt_made_of_nanofiber: {
    type: "armor",
    effect: { armor: 20, energy: 30 },
    image: images.energy_t_shirt_made_of_nanofiber,
    description:
      "Футболка энергии из нанофибры: +30 к максимальной энергии, +20 брони",
    rarity: 4,
    collection: "Nanofabric Energy",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  nanofiber_thirst_t_shirt: {
    type: "armor",
    effect: { armor: 20, water: 30 },
    image: images.nanofiber_thirst_t_shirt,
    description:
      "Футболка жажды из нанофибры: +30 к максимальной воде, +20 брони",
    rarity: 4,
    collection: "Nanofabric Thirst",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  gluttony_t_shirt_made_of_nanofiber: {
    type: "armor",
    effect: { armor: 20, food: 30 },
    image: images.gluttony_t_shirt_made_of_nanofiber,
    description:
      "Футболка обжорства из нанофибры: +30 к максимальной еде, +20 брони",
    rarity: 4,
    collection: "Nanofabric Gluttony",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },

  nanofiber_health_gloves: {
    type: "gloves",
    effect: { armor: 10, health: 12 },
    image: images.nanofiber_health_gloves,
    description:
      "Нанофибровые перчатки здоровья: +12 к максимальному здоровью, +10 брони",
    rarity: 4,
    collection: "Nanofabric Health",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  nanofiber_energy_gloves: {
    type: "gloves",
    effect: { armor: 10, energy: 12 },
    image: images.nanofiber_energy_gloves,
    description:
      "Перчатки энергии из нанофибры: +12 к максимальной энергии, +10 брони",
    rarity: 4,
    collection: "Nanofabric Energy",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  nanofiber_thirst_gloves: {
    type: "gloves",
    effect: { armor: 10, water: 12 },
    image: images.nanofiber_thirst_gloves,
    description:
      "Перчатки жажды из нанофибры: +12 к максимальной воде, +10 брони",
    rarity: 4,
    collection: "Nanofabric Thirst",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  gluttony_gloves_made_of_nanofiber: {
    type: "gloves",
    effect: { armor: 10, food: 12 },
    image: images.gluttony_gloves_made_of_nanofiber,
    description:
      "Перчатки обжорства из нанофибры: +12 к максимальной еде, +10 брони",
    rarity: 4,
    collection: "Nanofabric Gluttony",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },

  nanofiber_health_belt: {
    type: "belt",
    effect: { armor: 10, health: 21 },
    image: images.nanofiber_health_belt,
    description:
      "Нанофибровый пояс здоровья: +21 к максимальному здоровью, +10 брони",
    rarity: 4,
    collection: "Nanofabric Health",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  nanofiber_energy_belt: {
    type: "belt",
    effect: { armor: 10, energy: 21 },
    image: images.nanofiber_energy_belt,
    description:
      "Пояс энергии из нанофибры: +21 к максимальной энергии, +10 брони",
    rarity: 4,
    collection: "Nanofabric Energy",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  nanofiber_thirst_belt: {
    type: "belt",
    effect: { armor: 10, water: 21 },
    image: images.nanofiber_thirst_belt,
    description: "Пояс жажды из нанофибры: +21 к максимальной воде, +10 брони",
    rarity: 4,
    collection: "Nanofabric Thirst",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  nanofiber_gluttony_belt: {
    type: "belt",
    effect: { armor: 10, food: 21 },
    image: images.nanofiber_gluttony_belt,
    description:
      "Пояс обжорства из нанофибры: +21 к максимальной еде, +10 брони",
    rarity: 4,
    collection: "Nanofabric Gluttony",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },

  nanofiber_health_pants: {
    type: "pants",
    effect: { armor: 15, health: 18 },
    image: images.nanofiber_health_pants,
    description:
      "Нанофибровые штаны здоровья: +18 к максимальному здоровью, +15 брони",
    rarity: 4,
    collection: "Nanofabric Health",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  nanofiber_energy_pants: {
    type: "pants",
    effect: { armor: 15, energy: 18 },
    image: images.nanofiber_energy_pants,
    description:
      "Штаны энергии из нанофибры: +18 к максимальной энергии, +15 брони",
    rarity: 4,
    collection: "Nanofabric Energy",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  nanofiber_thirst_pants: {
    type: "pants",
    effect: { armor: 15, water: 18 },
    image: images.nanofiber_thirst_pants,
    description: "Штаны жажды из нанофибры: +18 к максимальной воде, +15 брони",
    rarity: 4,
    collection: "Nanofabric Thirst",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  gluttony_pants_made_of_nanofiber: {
    type: "pants",
    effect: { armor: 15, food: 18 },
    image: images.gluttony_pants_made_of_nanofiber,
    description:
      "Штаны обжорства из нанофибры: +18 к максимальной еде, +15 брони",
    rarity: 4,
    collection: "Nanofabric Gluttony",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },

  healthy_sneakers_made_of_nanofiber: {
    type: "boots",
    effect: { armor: 10, health: 24 },
    image: images.healthy_sneakers_made_of_nanofiber,
    description:
      "Кроссовки здоровья из нанофибры: +24 к максимальному здоровью, +10 брони",
    rarity: 4,
    collection: "Nanofabric Health",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  energy_sneakers_made_of_nanofiber: {
    type: "boots",
    effect: { armor: 10, energy: 24 },
    image: images.energy_sneakers_made_of_nanofiber,
    description:
      "Кроссовки энергии из нанофибры: +24 к максимальной энергии, +10 брони",
    rarity: 4,
    collection: "Nanofabric Energy",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  nanofiber_thirst_sneakers: {
    type: "boots",
    effect: { armor: 10, water: 24 },
    image: images.nanofiber_thirst_sneakers,
    description:
      "Кроссовки жажды из нанофибры: +24 к максимальной воде, +10 брони",
    rarity: 4,
    collection: "Nanofabric Thirst",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  gluttony_sneakers_made_of_nanofiber: {
    type: "boots",
    effect: { armor: 10, food: 24 },
    image: images.gluttony_sneakers_made_of_nanofiber,
    description:
      "Кроссовки обжорства из нанофибры: +24 к максимальной еде, +10 брони",
    rarity: 4,
    collection: "Nanofabric Gluttony",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },

  chameleon_belt: {
    type: "belt",
    effect: { armor: 12, health: 14, energy: 7, food: 7, water: 7 },
    image: images.chameleonBeltImage,
    description:
      "Хамелеон пояс: +12 брони, +14 здоровья, +7 энергии, +7 еды, +7 воды",
    rarity: 4,
    collection: "Light Chameleon",
    level: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  chameleon_cap: {
    type: "headgear",
    effect: { armor: 15, health: 10, energy: 5, food: 5, water: 5 },
    image: images.chameleonCapImage,
    description:
      "Хамелеон кепка: +15 брони, +10 здоровья, +5 энергии, +5 еды, +5 воды",
    rarity: 4,
    collection: "Light Chameleon",
    level: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  chameleon_gloves: {
    type: "gloves",
    effect: { armor: 20, health: 6, energy: 3, food: 3, water: 3 },
    image: images.chameleonGlovesImage,
    description:
      "Хамелеон перчатки: +20 брони, +6 здоровья, +3 энергии, +3 еды, +3 воды",
    rarity: 4,
    collection: "Light Chameleon",
    level: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  chameleon_pants: {
    type: "pants",
    effect: { armor: 21, health: 12, energy: 6, food: 6, water: 6 },
    image: images.chameleonPantsImage,
    description:
      "Хамелеон штаны: +21 брони, +12 здоровья, +6 энергии, +6 еды, +6 воды",
    rarity: 4,
    collection: "Light Chameleon",
    level: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  chameleon_sneakers: {
    type: "boots",
    effect: { armor: 15, health: 8, energy: 4, food: 4, water: 4 },
    image: images.chameleonSneakersImage,
    description:
      "Хамелеон кроссовки: +15 брони, +8 здоровья, +4 энергии, +4 еды, +4 воды",
    rarity: 4,
    collection: "Light Chameleon",
    level: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  chameleon_t_shirt: {
    type: "armor",
    effect: { armor: 30, health: 20, energy: 10, food: 10, water: 10 },
    image: images.chameleonTShirtImage,
    description:
      "Хамелеон футболка: +30 брони, +20 здоровья, +10 энергии, +10 еды, +10 воды",
    rarity: 4,
    collection: "Light Chameleon",
    level: 5,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },

  whole_chameleon_cap: {
    type: "headgear",
    effect: { armor: 20, health: 20, energy: 8, food: 8, water: 8 },
    image: images.whole_chameleon_cap, // ← добавляем image
    description:
      "Целостная кепка хамелеона: +20 брони, +20 здоровья, +8 к остальным статам",
    rarity: 4,
    collection: "Whole Chameleon",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  whole_chameleon_t_shirt: {
    type: "armor",
    effect: { armor: 40, health: 27, energy: 13, food: 13, water: 13 },
    image: images.whole_chameleon_t_shirt,
    description:
      "Целостная футболка хамелеона: +40 брони, +27 здоровья, +13 к остальным статам",
    rarity: 4,
    collection: "Whole Chameleon",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  whole_chameleon_gloves: {
    type: "gloves",
    effect: { armor: 30, health: 12, energy: 5, food: 5, water: 5 },
    image: images.whole_chameleon_gloves,
    description:
      "Целостные перчатки хамелеона: +30 брони, +12 здоровья, +5 к остальным статам",
    rarity: 4,
    collection: "Whole Chameleon",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  whole_chameleon_belt: {
    type: "belt",
    effect: { armor: 20, health: 20, energy: 8, food: 8, water: 8 },
    image: images.whole_chameleon_belt,
    description:
      "Целостный пояс хамелеона: +20 брони, +20 здоровья, +8 к остальным статам",
    rarity: 4,
    collection: "Whole Chameleon",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  whole_chameleon_pants: {
    type: "pants",
    effect: { armor: 25, health: 15, energy: 7, food: 7, water: 7 },
    image: images.whole_chameleon_pants,
    description:
      "Целостные штаны хамелеона: +25 брони, +15 здоровья, +7 к остальным статам",
    rarity: 4,
    collection: "Whole Chameleon",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  whole_chameleon_sneakers: {
    type: "boots",
    effect: { armor: 20, health: 15, energy: 8, food: 8, water: 8 },
    image: images.whole_chameleon_sneakers,
    description:
      "Целостные кроссовки хамелеона: +20 брони, +15 здоровья, +8 к остальным статам",
    rarity: 4,
    collection: "Whole Chameleon",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },

  white_void_cap: {
    type: "headgear",
    effect: {},
    image: images.white_void_cap,
    description: "Белая кепка Пустоты — чистый лист для будущих улучшений",
    rarity: 4,
    collection: "White Void",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  white_void_t_shirt: {
    type: "armor",
    effect: {},
    image: images.white_void_t_shirt,
    description: "Белая футболка Пустоты — чистый лист для будущих улучшений",
    rarity: 4,
    collection: "White Void",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  white_void_gloves: {
    type: "gloves",
    effect: {},
    image: images.white_void_gloves,
    description: "Белые перчатки Пустоты — чистый лист для будущих улучшений",
    rarity: 4,
    collection: "White Void",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  white_void_belt: {
    type: "belt",
    effect: {},
    image: images.white_void_belt,
    description: "Белый пояс Пустоты — чистый лист для будущих улучшений",
    rarity: 4,
    collection: "White Void",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  white_void_pants: {
    type: "pants",
    effect: {},
    image: images.white_void_pants,
    description: "Белые штаны Пустоты — чистый лист для будущих улучшений",
    rarity: 4,
    collection: "White Void",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  white_void_sneakers: {
    type: "boots",
    effect: {},
    image: images.white_void_sneakers,
    description: "Белые кроссовки Пустоты — чистый лист для будущих улучшений",
    rarity: 4,
    collection: "White Void",
    level: 0,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },

  recipe_torn_equipment: {
    image: images.recipe_torn_equipment,
    effect: {},
    description:
      "Рецепт порванной экипировки — материал для улучшений у Торестоса",
    rarity: 6,
    stackable: true,
    recipe: "recipe_torn_equipment",
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  recipe_chameleon_equipment: {
    image: images.recipe_chameleon_equipment,
    effect: {},
    description:
      "Рецепт хамелеон-экипировки — материал для улучшений у Торестоса",
    rarity: 6,
    stackable: true,
    recipe: "recipe_chameleon_equipment",
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },

  blue_crystal: {
    image: images.blue_crystal,
    description: "Синий кристал — материал для улучшений у Торестоса",
    rarity: 3,
    stackable: true,
    canBeAutoSpawned: true,
    canDropFromEnemy: false,
  },
  green_crystal: {
    image: images.green_crystal,
    description: "Зеленый кристал — материал для улучшений у Торестоса",
    rarity: 3,
    stackable: true,
    canBeAutoSpawned: true,
    canDropFromEnemy: false,
  },
  red_crystal: {
    image: images.red_crystal,
    description: "Красный кристал — материал для улучшений у Торестоса",
    rarity: 3,
    stackable: true,
    canBeAutoSpawned: true,
    canDropFromEnemy: false,
  },
  white_crystal: {
    image: images.white_crystal,
    description: "Белый кристал — материал для улучшений у Торестоса",
    rarity: 2,
    stackable: true,
    canBeAutoSpawned: true,
    canDropFromEnemy: false,
  },
  yellow_crystal: {
    image: images.yellow_crystal,
    description: "Желтый кристал — материал для улучшений у Торестоса",
    rarity: 3,
    stackable: true,
    canBeAutoSpawned: true,
    canDropFromEnemy: false,
  },
  chameleon_crystal: {
    image: images.chameleon_crystal,
    description: "Хамелион кристал — материал для улучшений у Торестоса",
    rarity: 1,
    stackable: true,
    canBeAutoSpawned: true,
    canDropFromEnemy: false,
  },
  nanoalloy: {
    image: images.nanoalloy,
    description: "Наносплав - материал для улучшений у Торестоса.",
    rarity: 3,
    stackable: true,
    canBeAutoSpawned: true,
    canDropFromEnemy: false,
  },
  nanofilament: {
    image: images.nanofilament,
    description: "Нановолокно - материал для улучшений у Торестоса.",
    rarity: 3,
    stackable: true,
    canBeAutoSpawned: true,
    canDropFromEnemy: false,
  },
  mutant_bone: {
    image: images.mutant_bone,
    description: "Мутантная кость — материал",
    rarity: 6,
    stackable: true,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  scorpion_sting: {
    image: images.scorpion_sting,
    description: "Жало скорпиона — материал",
    rarity: 6,
    stackable: true,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  tears_of_a_bloody_eye: {
    image: images.tears_of_a_bloody_eye,
    description: "Слезы кровавого глаза — материал",
    rarity: 6,
    stackable: true,
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  fireball_implant: {
    type: "implant",
    image: images.fireballImplant,
    description:
      "Огненный шар — активный имплант (25-50 урона, дальность 300px)",
    rarity: 8,
    level: 0,
    effect: {},
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  lightning_implant: {
    type: "implant",
    image: images.lightningImplant,
    description: "Молния — активный имплант (40-70 урона, дальность 300px)",
    rarity: 8,
    level: 0,
    effect: {},
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  tornado_implant: {
    type: "implant",
    image: images.tornadoImplant,
    description: "Торнадо — активный имплант (30-60 урона, дальность 300px)",
    rarity: 8,
    level: 0,
    effect: {},
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
  violent_tornado_implant: {
    type: "implant",
    image: images.violentTornadoImplant,
    description:
      "Разрушительный торнадо — активный имплант (30-60 урона, дальность 300px)",
    rarity: 8,
    level: 0,
    effect: {},
    canBeAutoSpawned: false,
    canDropFromEnemy: true,
  },
};

window.worldItemRenderSystem = Object.freeze({
  getItems() {
    return items;
  },

  getRenderData(item) {
    if (!item || typeof item.type !== "string") {
      return null;
    }

    const config = ITEM_CONFIG[item.type];

    if (!config) {
      return null;
    }

    return {
      itemId: item.itemId ?? item.id ?? null,

      type: item.type,

      x: Number(item.x),
      y: Number(item.y),

      worldId: item.worldId,

      image: config.image || null,

      isAnimated: item.type === "atom",

      frame: item.type === "atom" ? gameContext.atomFrame : 0,

      frameWidth: item.type === "atom" ? 50 : null,

      frameHeight: item.type === "atom" ? 50 : null,
    };
  },
});

let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 2000; // 2 секунды
let lastDistance = 0; // Добавляем глобальную переменную

const GAME_SERVER_CONFIG = (() => {
  const hostname = window.location.hostname;

  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]";

  const httpUrl = isLocal
    ? "http://localhost:10000"
    : "https://cyberpunksurvivalserver.onrender.com";

  const wsUrl = isLocal
    ? "ws://localhost:10000"
    : "wss://cyberpunksurvivalserver.onrender.com";

  return Object.freeze({
    httpUrl,
    wsUrl,
  });
})();

console.log("[GameServer] HTTP:", GAME_SERVER_CONFIG.httpUrl);
console.log("[GameServer] WebSocket:", GAME_SERVER_CONFIG.wsUrl);

// Переключение форм
toRegister.addEventListener("click", () => {
  loginForm.style.display = "none";
  registerForm.style.display = "block";
  loginError.textContent = "";
  registerError.textContent = "";
});

toLogin.addEventListener("click", () => {
  registerForm.style.display = "none";
  loginForm.style.display = "block";
  loginError.textContent = "";
  registerError.textContent = "";
});

function reconnectWebSocket() {
  if (reconnectAttempts >= maxReconnectAttempts) {
    authContainer.style.display = "flex";
    document.getElementById("gameContainer").style.display = "none";
    return;
  }
  setTimeout(
    () => {
      // Проверяем доступность сервера перед переподключением
      fetch(`${GAME_SERVER_CONFIG.httpUrl}/health`)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Сервер недоступен");
          }
          ws = new WebSocket(GAME_SERVER_CONFIG.wsUrl);
          ws.onopen = () => {
            reconnectAttempts = 0;
            if (myId) {
              const lastUsername = document
                .getElementById("loginUsername")
                .value.trim();
              const lastPassword = document
                .getElementById("loginPassword")
                .value.trim();
              if (lastUsername && lastPassword) {
                sendWhenReady(
                  ws,
                  JSON.stringify({
                    type: "login",
                    username: lastUsername,
                    password: lastPassword,
                  }),
                );
              } else {
                authContainer.style.display = "flex";
                document.getElementById("gameContainer").style.display = "none";
              }
            }
          };
          ws.onerror = (error) => {
            reconnectAttempts++;
            reconnectWebSocket();
          };
          ws.onclose = (event) => {
            if (event.code === 4000) {
              authContainer.style.display = "flex";
              document.getElementById("gameContainer").style.display = "none";
              return;
            }
            reconnectAttempts++;
            reconnectWebSocket();
          };
          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === "loginSuccess") {
                pendingWorldBuildingRequest = null;
                window.foundationEditor3D?.resetServerConnection?.();
                requestWorldBuildingsSnapshot();
                ws.onmessage = (event) => {
                  try {
                    const data = JSON.parse(event.data);
                    if (data.type === "vacuumRobotUpdate") {
                      window.vacuumRobotSystem?.applyServerUpdate?.(data);
                      return;
                    }
                    gameContext.messageQueue.push(data);
                    processMessageQueue(gameContext); // запустит обработку, если ещё не идёт
                  } catch (err) {
                    console.error(
                      "Не удалось распарсить сообщение от сервера:",
                      err,
                    );
                  }
                };
                tradeSystem.initialize(ws);
                // Синхронизируем игрока с сервером
                const me = players.get(myId);
                if (me) {
                  sendWhenReady(
                    ws,
                    JSON.stringify({
                      type: "syncPlayers",
                      worldId: me.worldId,
                    }),
                  );
                }
              }
            } catch (error) {
              console.error("Ошибка при обработке сообщения:", error);
            }
          };
        })
        .catch((error) => {
          console.error("Сервер недоступен, повторная попытка:", error);
          reconnectAttempts++;
          reconnectWebSocket();
        });
    },
    reconnectDelay * (reconnectAttempts + 1) * 1.5,
  ); // Увеличиваем задержку
}

// Инициализация WebSocket
function initializeWebSocket() {
  ws = new WebSocket(GAME_SERVER_CONFIG.wsUrl);
  ws.onopen = () => {
    console.log("WebSocket соединение установлено");
    reconnectAttempts = 0; // Сбрасываем попытки переподключения
  };
  ws.onmessage = (event) => {
    try {
      handleAuthMessage(event);
      const data = JSON.parse(event.data);
      if (data.type === "loginSuccess") {
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "vacuumRobotUpdate") {
              window.vacuumRobotSystem?.applyServerUpdate?.(data);
              return;
            }
            gameContext.messageQueue.push(data);
            processMessageQueue(gameContext); // запустит обработку, если ещё не идёт
          } catch (err) {
            console.error("Не удалось распарсить сообщение от сервера:", err);
          }
        };
      }
    } catch (error) {
      console.error("Ошибка при обработке сообщения:", error);
    }
  };
  ws.onerror = (error) => {
    console.error("Ошибка WebSocket:", error);
  };
  ws.onclose = (event) => {
    console.log("WebSocket закрыт:", event.code, event.reason);
    // Показываем окно авторизации
    authContainer.style.display = "flex";
    document.getElementById("gameContainer").style.display = "none";
    // Очищаем данные игрока
    players.clear();
    myId = null;
    // Если код 4000 (неактивность), не пытаемся переподключиться
    if (event.code === 4000) {
      return;
    }
    // Иначе пробуем переподключиться
    reconnectWebSocket();
  };
}

initializeWebSocket();

registerBtn.addEventListener("click", () => {
  const username = document.getElementById("registerUsername").value.trim();
  const password = document.getElementById("registerPassword").value.trim();
  if (!username || !password) {
    registerError.textContent = window.i18n
      ? window.i18n.t("enter_username_password")
      : "Введите имя и пароль";
    return;
  }
  if (ws.readyState === WebSocket.OPEN) {
    console.log("Отправка регистрации:", { username, password });
    sendWhenReady(ws, JSON.stringify({ type: "register", username, password }));
  } else {
    registerError.textContent = window.i18n
      ? window.i18n.t("no_connection")
      : "Нет соединения с сервером";
  }
});

// Вход
loginBtn.addEventListener("click", () => {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  if (!username || !password) {
    loginError.textContent = window.i18n
      ? window.i18n.t("enter_username_password")
      : "Введите имя и пароль";
    return;
  }
  if (ws.readyState === WebSocket.OPEN) {
    sendWhenReady(ws, JSON.stringify({ type: "login", username, password }));
  } else {
    loginError.textContent = window.i18n
      ? window.i18n.t("no_connection")
      : "Нет соединения с сервером";
  }
});

function handleAuthMessage(event) {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case "loginSuccess":
      myId = data.id;
      pendingWorldBuildingRequest = null;
      window.foundationEditor3D?.resetServerConnection?.();
      authContainer.style.display = "none";
      document.getElementById("gameContainer").style.display = "block";

      // Ensure translations applied after game UI becomes visible
      if (window.i18n && typeof window.i18n.translateDocument === "function") {
        try {
          window.i18n.translateDocument(
            document.getElementById("gameContainer"),
          );
        } catch (e) {}
        // notify subsystems in case they need to re-render with translations
        window.dispatchEvent(
          new CustomEvent("languageChangedInternal", {
            detail: { lang: window.i18n.getLanguage() },
          }),
        );
      }

      const me = {
        id: data.id,
        x: data.x || 1050,
        y: data.y || 3800,
        health: data.health,
        energy: data.energy,
        food: data.food,
        water: data.water,
        armor: data.armor || 0,
        distanceTraveled: data.distanceTraveled || 0,
        lastResourceCheckDistance: data.lastResourceCheckDistance || 0,
        hasSeenWelcomeGuide: data.hasSeenWelcomeGuide || false,
        direction: data.direction || "down",
        state: data.state || "idle",
        frame: data.frame || 0,
        inventory: data.inventory || Array(20).fill(null),
        equipment: data.equipment || {
          head: null,
          chest: null,
          belt: null,
          pants: null,
          boots: null,
          weapon: null,
          gloves: null,
        },
        npcMet: data.npcMet || false,
        jackMet: data.jackMet || false,
        alexNeonMet: data.alexNeonMet || false,
        captainMet: data.captainMet || false,
        thimbleriggerMet: data.thimbleriggerMet || false,
        homelessMet: data.homelessMet === true,
        torestosMet: data.torestosMet || false,
        potionMet: data.potionMet || false, // ← добавлено
        cristinaMet: data.cristinaMet || false, // ← добавлено
        linaMet: data.linaMet || false,
        viktorMet: data.viktorMet === true,
        danielMet: data.danielMet === true,
        warmanMet: data.warmanMet === true,
        madDoctorMet: data.madDoctorMet || false,
        yuriMet: data.yuriMet === true,
        potionQuest: data.potionQuest || {
          // ← добавлено
          currentQuestId: null,
          progress: {},
          completed: [],
        },
        potionBookSearch: data.potionBookSearch || false, // ← добавлено
        selectedQuestId: data.selectedQuestId || null,
        level: data.level || 0,
        xp: data.xp || 99,
        skills: data.skills || [],
        skillPoints: data.skillPoints || 0,
        energyLossInterval: data.energyLossInterval ?? 1300,
        waterLossInterval: data.waterLossInterval ?? 500,
        foodLossInterval: data.foodLossInterval ?? 900,
        meleeDamageBonus: data.meleeDamageBonus || 0,
        strongStrikeBonus: data.strongStrikeBonus || 0,
        speedBonus: data.speedBonus || 0,
        upgradePoints: data.upgradePoints || 0,
        worldId: data.worldId || 0,
        worldPositions: data.worldPositions || { 0: { x: 222, y: 3205 } },
        lastMoveTime: data.lastMoveTime || 0,
        lastConfirmedPosition: { x: data.x || 474, y: data.y || 2474 },
        lastProcessedMoveTime: data.lastProcessedMoveTime || 0,
        lastPickupTime: data.lastPickupTime || 0,
        pickupSpamCount: data.pickupSpamCount || 0,
        lastUseItemTime: 0,
        lastXPAddTime: 0,
        lastDropTime: 0,
        lastVacuumRewardTime: 0,
        lastTwisterMsg: 0,
        twisterSpinning: false,
        healthUpgrade: data.healthUpgrade || 0,
        energyUpgrade: data.energyUpgrade || 0,
        foodUpgrade: data.foodUpgrade || 0,
        waterUpgrade: data.waterUpgrade || 0,
        neonQuest: data.neonQuest || {
          currentQuestId: null,
          progress: {},
          completed: [],
        },
        medicalCertificate: data.medicalCertificate || false,
        medicalCertificateStamped: data.medicalCertificateStamped || false,
        corporateDocumentsSubmitted: data.corporateDocumentsSubmitted || false,
        corporateRobotGreetingShown: data.corporateRobotGreetingShown || false,
        chatBubble: null,
      };

      // === ДОПОЛНИТЕЛЬНО: если сервер вдруг пришлёт maxStats — сохраняем ===
      if (data.maxStats) {
        me.maxStats = data.maxStats;
      }

      players.set(myId, me);

      window.inventorySystem?.initialize?.();
      window.equipmentSystem?.initialize?.();
      window.skillsSystem?.initialize?.();

      if (window.homelessSystem?.setHomelessMet) {
        window.homelessSystem.setHomelessMet(me.homelessMet === true);
      }
      if (window.corporateRobotSystem) {
        window.corporateRobotSystem.setGreetingShown(
          me.corporateRobotGreetingShown === true,
        );
        // Если greetingDialog ещё висит — закрываем
        if (
          typeof window.corporateRobotSystem.closeCorporateFirstGreeting ===
          "function"
        ) {
          window.corporateRobotSystem.closeCorporateFirstGreeting();
        }
      }

      if (
        me.skills?.some((s) => s.id === 2 && s.level >= 1) &&
        window.regenerationSystem
      ) {
        window.regenerationSystem.start();
      }
      // ────────────────────────────────────────────────────────────────

      if (window.skillsSystem) {
        window.skillsSystem.playerSkills = data.skills || [];
        window.skillsSystem.skillPoints = Number(data.skillPoints) || 0;
        console.log(
          `[Login] Загружены skillPoints: ${window.skillsSystem.skillPoints} (из сервера: ${data.skillPoints})`,
        );

        // Если окно навыков открыто — сразу обновляем
        if (window.skillsSystem.isSkillsOpen) {
          window.skillsSystem.updateSkillsDisplay();
          window.skillsSystem.updateSkillPointsDisplay();
        }
      }

      window.worldSystem.currentWorldId = me.worldId;
      window.worldSystem.ensureTilesLoaded(me.worldId);

      if (data.barriers && window.barriersSystem?.onBarriersSync) {
        window.barriersSystem.onBarriersSync({
          worldId: data.worldId ?? window.worldSystem?.currentWorldId,
          barriers: data.barriers,
        });
      }

      window.combatSystem.syncBullets(data.bullets || []);

      if (window.soundSystem) {
        window.soundSystem.setWorld(me.worldId);
      }

      if (window.welcomeGuideSystem) {
        window.welcomeGuideSystem.setSeen(me.hasSeenWelcomeGuide);
        window.welcomeGuideSystem.init();
      }

      // Инициализация систем
      if (window.equipmentSystem && !window.equipmentSystem.isInitialized) {
        window.equipmentSystem.initialize();
      }

      if (window.equipmentSystem && me.equipment) {
        window.equipmentSystem.syncEquipment(me.equipment);
      }

      // Инвентарь и UI
      inventory = me.inventory.map((item) => (item ? { ...item } : null));

      // === БЕЗОПАСНЫЙ ВЫЗОВ ===
      if (window.inventorySystem?.updateInventoryDisplay) {
        window.inventorySystem.updateInventoryDisplay();
      } else if (typeof updateInventoryDisplay === "function") {
        updateInventoryDisplay();
      }

      updateStatsDisplay();

      if (window.implantsSystem && data.equipment) {
        window.implantsSystem.syncFromEquipment(data.equipment);
      }

      // Другие игроки
      if (data.players) {
        data.players.forEach((p) => {
          if (p.id !== myId) {
            // Важно: тоже синхронизируем флаг у других игроков (если придёт)
            if (p.medicalCertificateStamped === undefined) {
              p.medicalCertificateStamped = false;
            }
            players.set(p.id, p);
          }
        });
      }

      lastDistance = me.distanceTraveled;

      // Предметы
      if (data.items) {
        items.clear();
        data.items.forEach((item) =>
          items.set(item.itemId, {
            x: item.x,
            y: item.y,
            type: item.type,
            spawnTime: item.spawnTime,
            worldId: item.worldId,
          }),
        );
      }

      // Свет
      if (data.lights) {
        lights.length = 0;
        data.lights.forEach((light) =>
          lights.push({
            ...light,
            baseRadius: light.radius,
            pulseSpeed: 0.001,
          }),
        );
      }

      window.lightsSystem.reset(me.worldId);

      // === СИНХРОНИЗАЦИЯ NPC ===
      window.npcSystem.setNPCMet(data.npcMet || false);
      window.jackSystem.setJackMet(data.jackMet || false);

      if (window.linaNpc?.setLinaMet) {
        window.linaNpc.setLinaMet(data.linaMet === true);
      }

      if (window.viktorNpc) {
        window.viktorNpc.setMet(data.viktorMet === true);
      }

      if (window.danielNpc) {
        window.danielNpc.setMet(data.danielMet === true);
      }

      if (window.warmanNpc) {
        window.warmanNpc.setMet(data.warmanMet === true);
      }

      if (window.madDoctorSystem) {
        window.madDoctorSystem.setMet(data.madDoctorMet === true);
      }

      if (window.yuriSystem) {
        window.yuriSystem.setMet(data.yuriMet === true);
      }

      if (window.neonNpcSystem && data.alexNeonMet !== undefined) {
        NEON_NPC.isMet = !!data.alexNeonMet;
      }

      if (window.outpostCaptainSystem) {
        window.outpostCaptainSystem.setCaptainMet(data.captainMet === true);
      }

      if (window.thimbleriggerSystem && data.thimbleriggerMet !== undefined) {
        window.thimbleriggerSystem.setThimbleriggerMet(!!data.thimbleriggerMet);
      }
      if (window.homelessSystem?.setHomelessMet) {
        window.homelessSystem.setHomelessMet(data.homelessMet === true);
      }
      window.torestosSystem.setTorestosMet(data.torestosMet === true);
      window.toremidosSystem?.setMet?.(data.toremidosMet === true);

      window.npcSystem.setSelectedQuest(data.selectedQuestId || null);
      window.npcSystem.checkQuestCompletion();
      window.npcSystem.setAvailableQuests(data.availableQuests || []);

      window.levelSystem.setLevelData(
        data.level || 0,
        data.xp || 0,
        data.maxStats,
        data.upgradePoints || 0,
      );

      window.equipmentSystem.syncEquipment(data.equipment);

      if (data.activeAnomaly) {
        activeAnomaly = data.activeAnomaly;
        console.log(
          "[Anomaly] Получена активная аномалия при логине:",
          activeAnomaly.type,
        );

        // Немедленная проверка — находимся ли мы внутри
        const me = players.get(myId);
        if (me) {
          const dx = me.x - activeAnomaly.x;
          const dy = me.y - activeAnomaly.y;
          window.isInAnomaly =
            dx * dx + dy * dy < activeAnomaly.radius * activeAnomaly.radius;
        }
      } else {
        activeAnomaly = null;
        window.isInAnomaly = false;
      }

      resizeCanvas();
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "vacuumRobotUpdate") {
            window.vacuumRobotSystem?.applyServerUpdate?.(data);
            return;
          }
          gameContext.messageQueue.push(data);
          processMessageQueue(gameContext); // запустит обработку, если ещё не идёт
        } catch (err) {
          console.error("Не удалось распарсить сообщение от сервера:", err);
        }
      };
      void startGameWhenReady();
      updateOnlineCount(0);
      break;
    case "registerSuccess":
      registerError.textContent = "Регистрация успешна! Войдите.";
      registerForm.style.display = "none";
      loginForm.style.display = "block";
      break;
    case "registerFail":
      registerError.textContent = "Ник занят, выберите другой";
      break;
    case "loginFail":
      loginError.textContent = "Неверное имя или пароль";
      break;
  }
}

function checkCollision(newX, newY) {
  return false;
}

// Функция для отправки данных, когда WebSocket готов
function sendWhenReady(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(message);
  } else if (ws.readyState === WebSocket.CONNECTING) {
    const checkInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        clearInterval(checkInterval);
      }
    }, 100); // Проверяем каждые 100 мс
    setTimeout(() => clearInterval(checkInterval), 5000); // Таймаут 5 секунд
  } else {
    console.error("WebSocket не готов для отправки:", ws.readyState);
  }
}

function updateOnlineCount(totalCount) {
  const onlineCountEl = document.getElementById("onlineCount");
  onlineCountEl.textContent = `Онлайн: ${totalCount || 0}`;
}

function initializeRemainingSector12Systems() {
  window.enemySystem.initialize();
  window.implantsSystem.initialize();

  window.potionNpcSystem?.initialize?.(images.old_man_with_potions);

  if (window.viktorNpc) {
    window.viktorNpc.initialize(images.viktorSprite);
    const me = players.get(myId);
    window.viktorNpc.setMet(me?.viktorMet === true);
  }

  if (window.danielNpc) {
    window.danielNpc.initialize(images.danielSprite);
  }

  if (window.madDoctorSystem) {
    window.madDoctorSystem.initialize(images.madDoctorSprite);
    const me = players.get(myId);
    window.madDoctorSystem.setMet(me?.madDoctorMet === true);
  }

  if (window.yuriSystem) {
    window.yuriSystem.initialize(images.yuriSprite);
    const me = players.get(myId);
    window.yuriSystem.setMet(me?.yuriMet === true);
  }

  window.soundSystem?.initialize?.();
}

let gameStartRequested = false;
let gameStarted = false;
let gameInitializationFailed = false;

async function startGameWhenReady() {
  if (gameStarted || gameStartRequested || gameInitializationFailed) {
    return;
  }

  gameStartRequested = true;

  try {
    await imagesReady;

    if (gameStarted) {
      return;
    }

    const started = startGame();

    if (started !== true) {
      throw new Error("Game loop did not start.");
    }

    gameStarted = true;
  } catch (error) {
    gameInitializationFailed = true;
    console.error("[Sector12] Initialization failed:", error);
  } finally {
    gameStartRequested = false;
  }
}

let resizeListenerRegistered = false;

function startGame() {
  if (!resizeListenerRegistered) {
    window.addEventListener("resize", resizeCanvas);
    resizeListenerRegistered = true;
  }

  window.worldSystem.initialize();

  // Sector 12 Corp — существующее здание.
  if (!window.sector12Corp3D?.register?.()) {
    console.warn("[Game] Sector 12 Corp 3D registration failed.");
  }

  // Neon Citadel — новое здание мира 0.
  if (!window.neonCitadel3D?.register?.()) {
    console.warn("[Game] Neon Citadel 3D registration failed.");
  }

  if (!window.s12IndustrialComplex3D?.register?.()) {
    console.warn("[Game] S12 Industrial Complex 3D registration failed.");
  }

  if (!window.s12DefenseHeadquarters3D?.register?.()) {
    console.warn("[Game] S12 Defense Headquarters 3D registration failed.");
  }

  if (!window.s12GuildOfMasters3D?.register?.()) {
    console.warn("[Game] S12 Guild of Masters 3D registration failed.");
  }

  if (!window.s12Shop3D?.register?.()) {
    console.warn("[Game] S12 Shop 3D registration failed.");
  }

  if (!window.s12Bank3D?.register?.()) {
    console.warn("[Game] S12 Bank 3D registration failed.");
  }

  if (!window.s12Arena3D?.register?.()) {
    console.warn("[Game] S12 Arena 3D registration failed.");
  }

  if (!window.s12Medcore3D?.register?.()) {
    console.warn("[Game] S12 MEDCORE 3D registration failed.");
  }

  if (!window.sector12PerimeterWall3D?.register?.()) {
    console.warn("[Game] Sector12 perimeter wall registration failed.");
  }

  requestWorldBuildingsSnapshot();

  window.lightsSystem.initialize();
  updateOnlineCount(0); // Начальное значение до получения данных от сервера
  levelSystem.initialize(); // Инициализируем систему уровней
  window.vendingMachine.initialize();
  window.misterTwister.initialize();
  window.movementSystem.initialize(); // Инициализируем систему движения
  window.npcSystem.initialize(images.johnSprite); // Передаём изображение NPC
  window.jackSystem.initialize(images.jackSprite);
  if (window.outpostCaptainSystem) window.outpostCaptainSystem.initialize();
  window.vacuumRobotSystem.initialize(images.vacuumRobotSprite);
  window.cockroachSystem.initialize(images.cockroachSprite);
  window.droneSystem.initialize(images.droneSprite);
  window.bonfireSystem.initialize(images.bonfireImage);
  window.clockSystem.initialize(images.oclocSprite);
  window.corporateRobotSystem.initialize(images.corporateRobotSprite);
  window.robotDoctorSystem.initialize(images.robotDoctorSprite);
  window.thimbleriggerSystem.initialize(images.thimbleriggerSprite);
  window.trashCansSystem.initialize(images.trashImage);
  window.torestosSystem.initialize(images.torestosSprite);
  window.toremidosSystem?.initialize?.(images.toremidosSprite);
  window.homelessSystem?.initialize?.(images.homelessSprite);
  window.portalSystem.initialize(images.portalImage);
  if (window.guardNpcSystem) window.guardNpcSystem.update(0);
  if (window.cristinaNpc) {
    window.cristinaNpc.initialize(images.cristinaSprite);
    const me = players.get(myId);
    window.cristinaNpc.setMet(me?.cristinaMet === true);
  }
  if (window.linaNpc) {
    window.linaNpc.initialize(images.linaSprite);
  }
  if (window.warmanNpc) {
    window.warmanNpc.initialize(images.warmanSprite);
  }
  window.combatSystem.initialize();
  if (window.strongStrikeSystem && !window.strongStrikeSystem.initialized) {
    window.strongStrikeSystem.initialize();
  }

  initializeRemainingSector12Systems();

  document.addEventListener("keydown", (e) => {
    const me = players.get(myId);
    if (!me || me.health <= 0) return;

    // Escape работает одинаково в любой раскладке
    if (e.code === "Escape" || e.key === "Escape") {
      if (chatContainer.style.display === "flex") {
        chatContainer.style.display = "none";
        chatInput.blur();
      }
      if (isInventoryOpen) {
        toggleInventory();
      }
      e.preventDefault();
      return;
    }

    if (
      window.isChatInputFocused ||
      document.activeElement === chatInput ||
      document.activeElement === document.getElementById("balyaryAmount") ||
      document.activeElement === document.getElementById("stackableAmount")
    ) {
      return;
    }

    // Используем e.code (физическая клавиша) — работает в RU / EN / любой раскладке
    switch (e.code) {
      case "KeyQ": // физическая Q
        toggleInventory();
        e.preventDefault();
        break;
      case "KeyT": // физическая T
        {
          const isChatVisible = chatContainer.style.display === "flex";
          chatContainer.style.display = isChatVisible ? "none" : "flex";
          chatBtn.classList.toggle("active", !isChatVisible);
          if (!isChatVisible) chatInput.focus();
          else chatInput.blur();
          e.preventDefault();
        }
        break;
      case "KeyE": // физическая E
        window.equipmentSystem.toggleEquipment();
        e.preventDefault();
        break;
      case "KeyR": // физическая R
        window.skillsSystem?.toggleSkills?.();
        e.preventDefault();
        break;
      case "KeyL": // физическая L
        toggleStats();
        e.preventDefault();
        break;
    }
  });

  function handle3DPrimaryWorldAction(e) {
    if (e.button !== 0) {
      return false;
    }

    if (window.rendererSystem?.is3D?.() !== true) {
      return false;
    }

    const me = players.get(myId);

    if (!me || me.health <= 0) {
      return false;
    }

    window.inputSystem?.updatePointer?.(e.clientX, e.clientY, {
      pointerType: "mouse",
    });

    const currentWorldId = window.worldSystem.currentWorldId;

    const implants = window.implantsSystem;

    if (implants?.aiming?.active) {
      if (currentWorldId === 0) {
        implants.aiming = null;

        showNotification("Not in the city!", "#ff4444");

        return true;
      }

      const worldPosition = window.inputSystem?.screenToWorld?.(
        e.clientX,
        e.clientY,
      );

      if (
        !worldPosition ||
        !Number.isFinite(worldPosition.x) ||
        !Number.isFinite(worldPosition.y)
      ) {
        return true;
      }

      const slotIndex = implants.aiming.slotIndex;

      const aimX = Math.floor(worldPosition.x);

      const aimY = Math.floor(worldPosition.y);

      if (!implants.isAimInRange(aimX, aimY, 300)) {
        showNotification("Цель слишком далеко", "#ff4444");

        return true;
      }

      if (ws && ws.readyState === WebSocket.OPEN) {
        const payload = JSON.stringify({
          type: "useImplant",
          implantSlotIndex: slotIndex,
          aimX,
          aimY,
        });

        console.log("[CLIENT] useImplant (tornado 3D) ->", payload);

        try {
          if (typeof sendWhenReady === "function") {
            sendWhenReady(ws, payload);
          } else {
            ws.send(payload);
          }

          implants.lastUseTime[slotIndex] = Date.now();

          showNotification("Торнадо применено", "#00ccff");
        } catch (err) {
          console.error("send useImplant tornado 3D failed:", err);

          return true;
        }
      }

      implants.aiming = null;

      return true;
    }

    const enemyId = window.rendererSystem?.pickEnemy?.(e.clientX, e.clientY);

    if (enemyId !== null && enemyId !== undefined) {
      const success = window.implantsSystem?.selectEnemy?.(enemyId);

      if (success) {
        window.selectedEnemyId = enemyId;

        window.tradeSystem?.selectPlayer?.(null);

        return true;
      }
    }

    return false;
  }

  if (game3DPointerCanvas) {
    game3DPointerCanvas.addEventListener(
      "mousedown",
      (e) => {
        const consumed = handle3DPrimaryWorldAction(e);

        if (!consumed) {
          return;
        }

        e.preventDefault();

        e.stopPropagation();
        e.stopImmediatePropagation();
      },

      true,
    );
  }

  // Обработчик нажатия мыши (только для инвентаря)
  canvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;

    const me = players.get(myId);
    if (!me || me.health <= 0) return;

    // 1. Инвентарь — высший приоритет (логика без изменений)
    const inventoryContainer = document.getElementById("inventoryContainer");
    if (inventoryContainer && isInventoryOpen) {
      const rect = inventoryContainer.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        const slots = inventoryContainer.children;
        for (let i = 0; i < slots.length; i++) {
          const slotRect = slots[i].getBoundingClientRect();
          if (
            e.clientX >= slotRect.left &&
            e.clientX <= slotRect.right &&
            e.clientY >= slotRect.top &&
            e.clientY <= slotRect.bottom
          ) {
            if (typeof handleInventorySlotClick === "function") {
              handleInventorySlotClick(i);
            }
            return;
          }
        }
      }
    }

    // 2. Правильный перевод координат (учитываем canvas offset)
    const worldPosition = window.inputSystem?.screenToWorld?.(
      e.clientX,
      e.clientY,
    );

    if (!worldPosition) {
      return;
    }

    const worldX = worldPosition.x;
    const worldY = worldPosition.y;

    const currentWorldId = window.worldSystem.currentWorldId;

    try {
      const implants = window.implantsSystem;
      if (implants && implants.aiming && implants.aiming.active) {
        if (currentWorldId === 0) {
          implants.aiming = null;
          showNotification("Not in the city!", "#ff4444");
          e.preventDefault();
          return;
        }

        const slotIndex = implants.aiming.slotIndex;
        const aimX = Math.floor(worldX);
        const aimY = Math.floor(worldY);

        // === CLIENT-SIDE RANGE CHECK === (учитываем бонус от скилла)
        if (!implants.isAimInRange(aimX, aimY, 300)) {
          showNotification("Цель слишком далеко", "#ff4444");
          implants.aiming = null;
          e.preventDefault();
          return;
        }

        // local cooldown for UX (server authoritative)
        implants.lastUseTime[slotIndex] = Date.now();
        if (ws && ws.readyState === WebSocket.OPEN) {
          const payload = JSON.stringify({
            type: "useImplant",
            implantSlotIndex: slotIndex,
            aimX: aimX,
            aimY: aimY,
          });
          console.log("[CLIENT] useImplant (tornado) ->", payload);
          try {
            if (typeof sendWhenReady === "function") sendWhenReady(ws, payload);
            else ws.send(payload);
            showNotification("Торнадо применено", "#00ccff");
          } catch (err) {
            console.error("send useImplant failed:", err);
          }
        }
        implants.aiming = null;
        e.preventDefault();
        return;
      }
    } catch (err) {
      console.error("aim-confirm error:", err);
    }

    // === ПРИОРИТЕТ 1: ВРАГИ ===
    let selectedEnemyId = null;
    if (window.enemies) {
      window.enemies.forEach((enemy, id) => {
        if (enemy.worldId !== currentWorldId || enemy.health <= 0) return;

        const dx = worldX - (enemy.x + 35);
        const dy = worldY - (enemy.y + 35);
        if (Math.hypot(dx, dy) < 62) {
          // чуть увеличен для удобства
          selectedEnemyId = id;
        }
      });
    }

    if (selectedEnemyId !== null) {
      const success = window.implantsSystem?.selectEnemy?.(selectedEnemyId);
      if (success) {
        window.selectedEnemyId = selectedEnemyId; // явно устанавливаем
        window.tradeSystem?.selectPlayer(null);
        e.preventDefault();
        return;
      }
    }

    // === ПРИОРИТЕТ 2: Игроки (торговля) ===
    let selectedPlayerId = null;
    players.forEach((player, id) => {
      if (id === myId || player.worldId !== currentWorldId) return;

      const dx = worldX - (player.x + 20);
      const dy = worldY - (player.y + 20);
      if (Math.hypot(dx, dy) < 48) {
        selectedPlayerId = id;
      }
    });

    if (selectedPlayerId) {
      window.selectedEnemyId = null;
      window.tradeSystem?.selectPlayer(selectedPlayerId);
    } else {
      // Клик по пустому месту
      window.selectedEnemyId = null;
      window.tradeSystem?.selectPlayer(null);
    }
  });

  // Обработчик тач-событий для инвентаря
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const me = players.get(myId);
    if (!me || me.health <= 0) return;

    const touch = e.touches[0];
    const inventoryContainer = document.getElementById("inventoryContainer");
    const rect = inventoryContainer.getBoundingClientRect();

    if (
      isInventoryOpen &&
      touch.clientX >= rect.left &&
      touch.clientX <= rect.right &&
      touch.clientY >= rect.top &&
      touch.clientY <= rect.bottom
    ) {
      const slots = inventoryContainer.children;
      for (let i = 0; i < slots.length; i++) {
        const slotRect = slots[i].getBoundingClientRect();
        if (
          touch.clientX >= slotRect.left &&
          touch.clientX <= slotRect.right &&
          touch.clientY >= slotRect.top &&
          touch.clientY <= slotRect.bottom &&
          inventory[i]
        ) {
          selectSlot(i, slots[i]);
          return;
        }
      }
    } else {
      // If in implants aiming mode — confirm with touch
      try {
        const implants = window.implantsSystem;
        if (implants && implants.aiming && implants.aiming.active) {
          if (window.worldSystem.currentWorldId === 0) {
            implants.aiming = null;
            showNotification("Not in the city!", "#ff4444");
            return;
          }

          const slotIndex = implants.aiming.slotIndex;
          const rect = canvas.getBoundingClientRect();
          const camera = window.movementSystem.getCamera();
          window.inputSystem?.screenToWorld?.(touch.clientX, touch.clientY);

          if (!worldPosition) {
            return;
          }

          const worldX = worldPosition.x;
          const worldY = worldPosition.y;

          // === CLIENT-SIDE RANGE CHECK ===
          if (
            !implants.isAimInRange(Math.floor(worldX), Math.floor(worldY), 300)
          ) {
            showNotification("Цель слишком далеко", "#ff4444");
            implants.aiming = null;
            return;
          }

          implants.lastUseTime[slotIndex] = Date.now();
          const payload = JSON.stringify({
            type: "useImplant",
            implantSlotIndex: slotIndex,
            aimX: Math.floor(worldX),
            aimY: Math.floor(worldY),
          });
          console.log("[CLIENT] useImplant (tornado) touch ->", payload);
          try {
            if (typeof sendWhenReady === "function") sendWhenReady(ws, payload);
            else ws.send(payload);
            showNotification("Торнадо применено", "#00ccff");
          } catch (err) {
            console.error("send useImplant touch failed:", err);
          }
          implants.aiming = null;
          return;
        }
      } catch (err) {
        console.error("aim-confirm touch error:", err);
      }

      window.inputSystem?.screenToWorld?.(touch.clientX, touch.clientY);

      if (!worldPosition) {
        return;
      }

      const worldX = worldPosition.x;
      const worldY = worldPosition.y;
      const currentWorldId = window.worldSystem.currentWorldId;
      let selectedPlayerId = null;
      players.forEach((player, id) => {
        if (id !== myId && player.worldId === currentWorldId) {
          const dx = worldX - (player.x + 20);
          const dy = worldY - (player.y + 20);
          if (Math.sqrt(dx * dx + dy * dy) < 40) {
            selectedPlayerId = id;
          }
        }
      });
      window.tradeSystem.selectPlayer(selectedPlayerId);
    }
  });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    window.inputSystem?.screenToWorld?.(touch.clientX, touch.clientY);
    targetX = worldPosition.x;
    targetY = worldPosition.y;
  });

  canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    isMoving = false;

    const me = players.get(myId);
    if (!me || me.health <= 0) return;

    // Сбрасываем состояние на idle
    me.state = "idle";
    me.frame = 0;
    me.frameTime = 0;

    // ─── ВАЖНО: ТОЛЬКО ДВИЖЕНИЕ И АНИМАЦИЯ, БЕЗ СТАТОВ! ───
    const movePacket = {
      type: "move",
      x: Math.floor(me.x), // округляем, чтобы меньше спама
      y: Math.floor(me.y),
      direction: me.direction,
      state: me.state,
      frame: me.frame,
    };

    sendWhenReady(ws, JSON.stringify(movePacket));
  });

  window.chatSystem.initializeChat(ws);
  window.inventorySystem.initialize();
  window.tradeSystem.initialize(ws);
  window.equipmentSystem.initialize();
  const me = players.get(myId);
  if (me && me.equipment) {
    window.equipmentSystem.syncEquipment(me.equipment);
  }

  if (!window.gameLoopSystem?.isRunning?.()) {
    const configured = configureGameLoop();

    if (!configured) {
      console.error("[Game] Failed to configure game loop.");
      return false;
    }

    const started = window.gameLoopSystem.start();

    if (!started) {
      console.error("[Game] Failed to start game loop.");
      return false;
    }
  }

  return window.gameLoopSystem?.isRunning?.() === true;
}

function handlePlayerClick(worldX, worldY) {
  let selectedPlayerId = null;
  players.forEach((player, id) => {
    if (id !== myId && player.health > 0) {
      const dx = worldX - (player.x + 20);
      const dy = worldY - (player.y + 20);
      if (Math.sqrt(dx * dx + dy * dy) < 40) {
        selectedPlayerId = id;
      }
    }
  });
  window.tradeSystem.selectPlayer(selectedPlayerId); // Убрали !!selectedPlayerId
}

function updateStatsDisplay() {
  try {
    const statsEl = document.getElementById("stats");
    if (!statsEl) {
      return;
    }
    const me = players.get(myId);
    if (!me) {
      return;
    }
    const t = window.i18n ? window.i18n.t : (k) => k;
    const healthLabel = t("stats_health");
    const energyLabel = t("stats_energy");
    const foodLabel = t("stats_food");
    const waterLabel = t("stats_water");
    const armorLabel = t("stats_armor");

    const statRows = [
      {
        id: "health",
        className: "health",
        label: healthLabel,
        value: me.health,
        max: me.maxStats?.health ?? 100,
      },
      {
        id: "energy",
        className: "energy",
        label: energyLabel,
        value: me.energy,
        max: me.maxStats?.energy ?? 100,
      },
      {
        id: "food",
        className: "food",
        label: foodLabel,
        value: me.food,
        max: me.maxStats?.food ?? 100,
      },
      {
        id: "water",
        className: "water",
        label: waterLabel,
        value: me.water,
        max: me.maxStats?.water ?? 100,
      },
      {
        id: "armor",
        className: "armor",
        label: armorLabel,
        value: me.armor,
        max: me.maxStats?.armor ?? 0,
      },
    ];

    statRows.forEach(({ id, className, label, value, max }) => {
      let row = document.getElementById(id);
      if (!row) {
        row = document.createElement("span");
        row.id = id;
        statsEl.appendChild(row);
      }
      row.className = className;
      row.textContent = `${label}: ${Math.min(value ?? 0, max)}/${max}`;
    });

    updateUpgradeButtons();

    // Координаты — полезная фича, оставляем
    document.getElementById("coords").innerHTML = `X: ${Math.floor(
      me.x,
    )}<br>Y: ${Math.floor(me.y)}`;
  } catch (error) {}
}

const gameMessageHandlers = {
  fireball: async (data, context) => {
    const currentWorldId = context.systems.worldSystem.currentWorldId;
    if (data.worldId !== currentWorldId) return true;
    if (!context.projectiles) context.projectiles = [];

    const isOwnProjectile = data.ownerId === myId;
    const existing = context.projectiles.find(
      (p) =>
        p.id === data.id ||
        (isOwnProjectile &&
          typeof data.clientProjectileId === "string" &&
          p.ownerId === myId &&
          p.type === "fireball" &&
          p.clientProjectileId === data.clientProjectileId),
    );

    if (existing) {
      existing.id = data.id;
      existing.clientProjectileId = data.clientProjectileId || null;
      existing.serverConfirmed = true;

      if (isOwnProjectile && data.clientProjectileId) {
        context.systems.implantsSystem?.pendingProjectileRequests?.delete(
          data.clientProjectileId,
        );
      }
      existing.maxDistance = Number(data.maxDistance) || 300;
      existing.traveled = 0;
      existing.x = Number(data.x);
      existing.y = Number(data.y);
      existing.vx = Number(data.vx);
      existing.vy = Number(data.vy);
      existing.spawnTime = data.spawnTime || Date.now();
    } else if (!isOwnProjectile) {
      context.projectiles.push({
        id: data.id,
        x: Number(data.x),
        y: Number(data.y),
        vx: Number(data.vx),
        vy: Number(data.vy),
        type: "fireball",
        ownerId: data.ownerId,
        traveled: 0,
        spawnTime: data.spawnTime || Date.now(),
        maxDistance: data.maxDistance || 300,
        isOwn: false,
      });
    } else {
      context.projectiles.push({
        id: data.id,
        x: Number(data.x),
        y: Number(data.y),
        vx: Number(data.vx),
        vy: Number(data.vy),
        type: "fireball",
        ownerId: data.ownerId,
        traveled: 0,
        spawnTime: data.spawnTime || Date.now(),
        maxDistance: data.maxDistance || 300,
        isOwn: true,
      });
    }
    return true;
  },
  violent_tornado: async (data, context) => {
    const currentWorldId = context.systems.worldSystem.currentWorldId;
    if (data.worldId !== currentWorldId) return true;
    if (!context.projectiles) context.projectiles = [];

    const isOwnProjectile = data.ownerId === myId;
    const existing = context.projectiles.find(
      (p) =>
        p.id === data.id ||
        (isOwnProjectile &&
          typeof data.clientProjectileId === "string" &&
          p.ownerId === myId &&
          p.type === "violent_tornado" &&
          p.clientProjectileId === data.clientProjectileId),
    );

    if (existing) {
      existing.id = data.id;
      existing.clientProjectileId = data.clientProjectileId || null;
      existing.serverConfirmed = true;

      if (isOwnProjectile && data.clientProjectileId) {
        context.systems.implantsSystem?.pendingProjectileRequests?.delete(
          data.clientProjectileId,
        );
      }
      existing.maxDistance = Number(data.maxDistance) || 300;
      existing.traveled = 0;
      existing.perpX = Number(data.perpX) || 0;
      existing.perpY = Number(data.perpY) || 0;
      existing.waveAmplitude = Number(data.waveAmplitude) || 10;
      existing.waveFreq = Number(data.waveFreq) || 0.025;
      existing.lastWaveOffset = 0;
      existing.x = Number(data.x);
      existing.y = Number(data.y);
      existing.vx = Number(data.vx);
      existing.vy = Number(data.vy);
      existing.baseVx = Number(data.baseVx ?? data.vx);
      existing.baseVy = Number(data.baseVy ?? data.vy);
      existing.spawnTime = data.spawnTime || Date.now();
    } else {
      context.projectiles.push({
        id: data.id,
        x: Number(data.x),
        y: Number(data.y),
        vx: Number(data.vx),
        vy: Number(data.vy),
        baseVx: Number(data.baseVx ?? data.vx),
        baseVy: Number(data.baseVy ?? data.vy),
        perpX: Number(data.perpX) || 0,
        perpY: Number(data.perpY) || 0,
        waveAmplitude: data.waveAmplitude || 10,
        waveFreq: data.waveFreq || 0.025,
        lastWaveOffset: 0,
        type: "violent_tornado",
        ownerId: data.ownerId,
        traveled: 0,
        spawnTime: data.spawnTime || Date.now(),
        maxDistance: data.maxDistance || 300,
        isOwn: isOwnProjectile,
      });
    }
    return true;
  },
  lightningStrike: async (data, context) => {
    const currentWorldId = context.systems.worldSystem.currentWorldId;
    if (data.worldId != null && data.worldId !== currentWorldId) {
      return true;
    }

    if (!gameContext.lightningStrikes) gameContext.lightningStrikes = [];

    const strike = {
      id:
        data.strikeId ||
        `ln_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      x: Number(data.x) || 0,
      y: Number(data.y) || 0,
      worldId: currentWorldId,
      ownerId: data.ownerId,
      targetType: data.targetType,
      targetId: data.targetId,
      damage: data.damage,
      spawnTime: data.spawnTime || Date.now(),
      frames: 13,
      frameDuration: 120, // синхронизируем с клиентом
    };

    gameContext.lightningStrikes.push(strike);
    return true;
  },
  tornadoStrike: async (data, context) => {
    const currentWorldId = context.systems.worldSystem.currentWorldId;
    if (data.worldId != null && data.worldId !== currentWorldId) {
      return true;
    }

    if (!gameContext.tornadoStrikes) gameContext.tornadoStrikes = [];

    const strike = {
      id:
        data.id ||
        `tz_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      x: Number(data.x) || 0,
      y: Number(data.y) || 0,
      worldId: currentWorldId,
      ownerId: data.ownerId,
      spawnTime: data.spawnTime || Date.now(),
      frames: 13,
      frameDuration: data.frameDuration || 120,
    };

    gameContext.tornadoStrikes.push(strike);

    // === Apply damage instances locally ===
    if (Array.isArray(data.damageInstances)) {
      for (const inst of data.damageInstances) {
        if (inst.targetType === "player" && inst.targetId === myId) {
          const me = players.get(myId);
          if (me) {
            const oldHealth = me.health;
            me.health = Number(
              inst.health ?? Math.max(0, (me.health || 0) - (inst.damage || 0)),
            );
            players.set(myId, me);

            const isSelf = data.ownerId === myId;

            context.uiEvents.emit("notification", {
              text: isSelf
                ? `Вы попали под своё торнадо! -${inst.damage} HP`
                : `Получено ${inst.damage} урона от торнадо!`,
              color: "#ff4444",
            });

            context.uiEvents.emit("stats:update");
          }
        }

        if (inst.targetType === "enemy" && inst.targetId) {
          const enemy = enemies.get(inst.targetId);
          if (enemy) {
            enemy.health = Number(
              inst.health ??
                Math.max(0, (enemy.health || 0) - (inst.damage || 0)),
            );

            if (enemy.health <= 0) {
              const eid = inst.targetId;
              if (window.selectedEnemyId === eid) window.selectedEnemyId = null;
              enemies.delete(eid);
              if (window.enemySystem?.handleEnemyDeath) {
                window.enemySystem.handleEnemyDeath(eid);
              }
            } else {
              enemies.set(inst.targetId, enemy);
            }
          }
        }
      }
    }

    return true;
  },
  projectileHit: async (data, context) => {
    const currentWorldId = context.systems.worldSystem.currentWorldId;
    if (data.worldId && data.worldId !== currentWorldId) return true;

    // Удаляем только point-projectiles (fireball).
    // violent_tornado продолжает жить до maxDistance / projectileExpired.
    const hitProj = (context.projectiles || []).find(
      (p) => p.id === data.projectileId,
    );
    if (!hitProj || hitProj.type !== "violent_tornado") {
      context.projectiles = (context.projectiles || []).filter(
        (p) => p.id !== data.projectileId,
      );
    }

    if (data.hitType === "player" && data.targetId === myId) {
      context.uiEvents.emit("notification", {
        text: `Получено ${data.damage} урона от импланта!`,
        color: "#ff4444",
      });
    }
    // Если попали по врагу — применяем мгновенное обновление HP (если сервер прислал)
    if (data.hitType === "enemy" && data.targetId) {
      const enemy = enemies.get(data.targetId);
      if (enemy) {
        if (typeof data.health === "number") {
          enemy.health = Number(data.health);
        } else {
          // Фоллбек — уменьшаем локально
          enemy.health = Math.max(0, (enemy.health || 0) - (data.damage || 0));
        }
        // Если цель мертва — очищаем выделение и вызываем обработчик смерти
        if (enemy.health <= 0) {
          const eid = data.targetId;
          if (window.selectedEnemyId === eid) window.selectedEnemyId = null;
          enemies.delete(eid);
          if (
            window.enemySystem &&
            typeof window.enemySystem.handleEnemyDeath === "function"
          ) {
            window.enemySystem.handleEnemyDeath(eid);
          }
        }
      }
    }
    return true;
  },
  implantHit: async (data, context) => {
    if ((data.targetId === myId || data.from === myId) && data.damage > 0) {
      context.uiEvents.emit("notification", {
        text: `Имплант нанёс ${data.damage} урона`,
        color: "#ff4400",
      });
    }
    return true;
  },
  projectileExpired: async (data, context) => {
    context.projectiles = (context.projectiles || []).filter(
      (p) => p.id !== data.projectileId,
    );
    return true;
  },
  implantError: async (data, context) => {
    const requestId = data.clientProjectileId;
    const implants = context.systems.implantsSystem;

    if (typeof requestId === "string") {
      const pending = implants?.pendingProjectileRequests;

      if (pending?.has(requestId)) {
        const slotIndex = pending.get(requestId);

        context.projectiles = (context.projectiles || []).filter(
          (projectile) =>
            projectile.clientProjectileId !== requestId ||
            projectile.serverConfirmed === true,
        );

        pending.delete(requestId);

        if (
          Number.isInteger(slotIndex) &&
          slotIndex >= 0 &&
          slotIndex < implants.lastUseTime.length &&
          ![...pending.values()].includes(slotIndex)
        ) {
          implants.lastUseTime[slotIndex] = 0;
        }
      }
    }

    if (data.message) {
      context.uiEvents.emit("notification", {
        text: data.message,
        color: "#ff4444",
      });
    }

    return true;
  },
  implantUsed: async (data, context) => {
    if (typeof data.slotIndex === "number" && context.systems.implantsSystem) {
      context.systems.implantsSystem.lastUseTime[data.slotIndex] = Date.now();
    }
    return true;
  },
  showNotification: async (data, context) => {
    if (data.message) {
      context.uiEvents.emit("notification", {
        text: data.message,
        color: data.color || "#ff4444",
      });
    }
    return true;
  },
  chat: async (data, context) => {
    // Системные + локальные + приваты
    context.systems.chatSystem?.handleChatMessage?.(data);

    // Bubble только для обычных (не system, не private) сообщений в том же мире
    if (
      !data.isSystem &&
      !data.isPrivate &&
      data.id &&
      data.id !== "Система" &&
      data.id !== "System"
    ) {
      const player = players.get(data.id);
      if (
        player &&
        player.worldId === context.systems.worldSystem.currentWorldId
      ) {
        const shortText =
          String(data.message || "")
            .replace(/\[s:\d{1,3}\]/gi, "")
            .trim()
            .substring(0, CHAT_BUBBLE_MAX_LENGTH) || "✨";
        player.chatBubble = {
          text: shortText,
          time: Date.now(),
        };
      }
    }
    return true;
  },
  chatError: async (data, context) => {
    context.systems.chatSystem?.handleChatMessage?.({
      id: "Система",
      message: data.message || "Ошибка чата",
      isSystem: true,
    });
    return true;
  },
  totalOnline: async (data) => {
    updateOnlineCount(data.count);
    return true;
  },
  tradeRequest: async (data, context) => {
    /* #region agent log
    fetch("http://127.0.0.1:7282/ingest/e3608100-abc5-413f-baa4-fda886dde1aa", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "ad6397",
      },
      body: JSON.stringify({
        sessionId: "ad6397",
        runId: "post-fix",
        hypothesisId: "R3",
        location: "code.js:handlers.trade",
        message: "Trade event processed by handler map",
        data: { type: data.type },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    */ // #endregion
    context.systems.tradeSystem?.handleTradeMessage?.(data);
    return true;
  },
  tradeAccepted: async (data, context) => {
    context.systems.tradeSystem?.handleTradeMessage?.(data);
    return true;
  },
  tradeOffer: async (data, context) => {
    context.systems.tradeSystem?.handleTradeMessage?.(data);
    return true;
  },
  tradeConfirmed: async (data, context) => {
    context.systems.tradeSystem?.handleTradeMessage?.(data);
    return true;
  },
  tradeCancelled: async (data, context) => {
    context.systems.tradeSystem?.handleTradeMessage?.(data);
    return true;
  },
  tradeChatMessage: async (data, context) => {
    context.systems.tradeSystem?.handleTradeMessage?.(data);
    return true;
  },
  itemDropped: async (data, context) => {
    const currentWorldId = context.systems.worldSystem.currentWorldId;
    if (data.worldId === currentWorldId) {
      items.set(data.itemId, {
        x: data.x,
        y: data.y,
        type: data.type,
        spawnTime: data.spawnTime,
        worldId: data.worldId,
      });
      if (data.quantity && ITEM_CONFIG[data.type]?.stackable) {
        items.get(data.itemId).quantity = data.quantity;
      }
      context.systems.inventorySystem?.updateInventoryDisplay?.();
      /* #region agent log
      fetch(
        "http://127.0.0.1:7282/ingest/e3608100-abc5-413f-baa4-fda886dde1aa",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "ad6397",
          },
          body: JSON.stringify({
            sessionId: "ad6397",
            runId: "post-fix",
            hypothesisId: "R4",
            location: "code.js:handlers.itemDropped",
            message: "itemDropped handled by map",
            data: { itemId: data.itemId, worldId: data.worldId },
            timestamp: Date.now(),
          }),
        },
      ).catch(() => {});
      */ // #endregion
    }
    return true;
  },
  tradeCompleted: async (data, context) => {
    if (!data.newInventory) return true;
    context.inventory = data.newInventory.map((slot) =>
      slot ? { ...slot } : null,
    );
    const me = players.get(myId);
    if (me) {
      me.inventory = [...context.inventory];
      players.set(myId, me);
    }
    context.systems.tradeSystem?.closeTradeWindow?.();
    context.systems.tradeSystem?.resetTrade?.();
    context.systems.inventorySystem?.updateInventoryDisplay?.();
    context.uiEvents.emit("stats:update");
    /* #region agent log
    fetch("http://127.0.0.1:7282/ingest/e3608100-abc5-413f-baa4-fda886dde1aa", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "ad6397",
      },
      body: JSON.stringify({
        sessionId: "ad6397",
        runId: "post-fix",
        hypothesisId: "R4",
        location: "code.js:handlers.tradeCompleted",
        message: "tradeCompleted handled by map",
        data: { inventorySize: context.inventory.length },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    */ // #endregion
    return true;
  },
  enemyDied: async (data, context) => {
    const currentWorldId = context.systems.worldSystem?.currentWorldId;
    if (data.worldId && data.worldId !== currentWorldId) return true;

    const eid = data.enemyId || data.id;
    if (!eid) return true;

    // === ЖЁСТКАЯ ОЧИСТКА ===
    if (window.selectedEnemyId === eid) {
      window.selectedEnemyId = null;
    }

    // Удаляем из Map
    if (enemies.has(eid)) {
      enemies.delete(eid);
    }

    // Вызываем системный обработчик (анимация смерти, звуки и т.д.)
    if (
      window.enemySystem &&
      typeof window.enemySystem.handleEnemyDeath === "function"
    ) {
      window.enemySystem.handleEnemyDeath(eid);
    }

    return true;
  },
  enemyUpdate: async (data, context) => {
    const currentWorldId = context.systems.worldSystem?.currentWorldId;
    if (data.worldId && data.worldId !== currentWorldId) return true;

    const enemyData = data.enemy;
    if (!enemyData || !enemyData.id) return true;

    const enemyId = enemyData.id;

    // === КРИТИЧНО: Если сервер говорит, что моб мёртв — сразу удаляем ===
    if (enemyData.health !== undefined && Number(enemyData.health) <= 0) {
      if (window.selectedEnemyId === enemyId) {
        window.selectedEnemyId = null;
      }

      if (enemies.has(enemyId)) {
        enemies.delete(enemyId);
      }

      if (
        window.enemySystem &&
        typeof window.enemySystem.handleEnemyDeath === "function"
      ) {
        window.enemySystem.handleEnemyDeath(enemyId);
      }
      return true;
    }

    // === Обновление живого моба ===
    let enemy = enemies.get(enemyId);

    if (enemy) {
      // Существующий
      const isForced = !!data.enemy.forced;

      if (isForced) {
        // Lightning / мгновенные удары — жёсткая синхронизация
        Object.assign(enemy, {
          x: Number(enemyData.x),
          y: Number(enemyData.y),
          health: Number(enemyData.health),
          direction: enemyData.direction || enemy.direction || "down",
          state: enemyData.state || "idle",
          type: enemyData.type || enemy.type,
          worldId: enemyData.worldId || enemy.worldId,
          forceSnapTime: Date.now(),
          lastHitAt: enemyData.lastHitAt || enemy.lastHitAt,
          lastHitBy: enemyData.lastHitBy || enemy.lastHitBy,
        });
      } else {
        // Обычное обновление (движение)
        // Если у нас уже есть отметка о недавнем попадании (lastHitAt),
        // и входящий пакет содержит более старую отметку — игнорируем
        // позиционное обновление, чтобы не откатывать позицию назад.
        const incomingLastHit = Number(enemyData.lastHitAt) || 0;
        const localLastHit = Number(enemy.lastHitAt) || 0;

        if (
          localLastHit > 0 &&
          incomingLastHit > 0 &&
          incomingLastHit < localLastHit
        ) {
          // incoming position is older than our recent hit — only update HP/state
          enemy.health = Number(enemyData.health);
          enemy.direction = enemyData.direction || enemy.direction || "down";
          enemy.state = enemyData.state || "idle";
          enemy.type = enemyData.type || enemy.type;
        } else {
          Object.assign(enemy, {
            x: Number(enemyData.x),
            y: Number(enemyData.y),
            health: Number(enemyData.health),
            direction: enemyData.direction || enemy.direction || "down",
            state: enemyData.state || "idle",
            type: enemyData.type || enemy.type,
            targetX: Number(enemyData.x),
            targetY: Number(enemyData.y),
            lastHitAt: enemyData.lastHitAt || enemy.lastHitAt,
            lastHitBy: enemyData.lastHitBy || enemy.lastHitBy,
          });
        }
      }
    } else {
      // Новый моб
      if (window.enemySystem?.handleNewEnemy) {
        window.enemySystem.handleNewEnemy(enemyData);
      } else {
        // Fallback
        enemies.set(enemyId, {
          ...enemyData,
          x: Number(enemyData.x),
          y: Number(enemyData.y),
          health: Number(enemyData.health),
          targetX: Number(enemyData.x),
          targetY: Number(enemyData.y),
        });
      }
    }

    return true;
  },
};

async function handleGameMessageLegacySwitch(data, context) {
  const currentWorldId = context.systems.worldSystem.currentWorldId;
  const showNotification = (text, color) =>
    context.uiEvents.emit("notification", { text, color });
  const updateStatsDisplay = () => context.uiEvents.emit("stats:update");
  const systems = context.systems;
  const window = {
    ...systems,
    get inventory() {
      return context.inventory;
    },
    set inventory(value) {
      context.inventory = value;
    },
    get implantProjectiles() {
      return context.projectiles;
    },
    set implantProjectiles(value) {
      context.projectiles = value;
    },
    get trashCansState() {
      return globalThis.trashCansState;
    },
    set trashCansState(v) {
      globalThis.trashCansState = v;
    },
    showNotification,
  };
  /* #region agent log 
  fetch("http://127.0.0.1:7282/ingest/e3608100-abc5-413f-baa4-fda886dde1aa", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "ad6397",
    },
    body: JSON.stringify({
      sessionId: "ad6397",
      runId: "pre-fix",
      hypothesisId: "R1",
      location: "code.js:handleGameMessageLegacySwitch:shim",
      message: "Legacy handler using context-backed window shim",
      data: {
        hasWorldSystem: Boolean(systems.worldSystem),
        hasInventorySystem: Boolean(systems.inventorySystem),
        hasTradeSystem: Boolean(systems.tradeSystem),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  */ // #endregion

  switch (data.type) {
    case "syncPlayers":
      if (data.worldId === currentWorldId && data.players) {
        const myPlayer = players.get(myId);
        players.clear();
        if (myPlayer) {
          players.set(myId, {
            ...myPlayer,
            frameTime: 0,
            animTime: 0,
          });
        }

        data.players.forEach((p) => {
          if (p?.id && p.id !== myId) {
            players.set(p.id, {
              ...p,
              // Критично для анимации ходьбы и атаки
              animTime: 0,
              frameTime: 0,
              attackFrameTime: 0,
              attackFrame: p.attackFrame || 0,
              prevState: p.state || "idle",

              // Для плавной интерполяции
              targetX: p.x,
              targetY: p.y,
              targetDirection: p.direction,
              targetState: p.state,
            });
          }
        });
      }
      break;
    case "worldTransitionSuccess":
      {
        const me = players.get(myId);
        if (!me) break;

        // === ПОЛНАЯ ОЧИСТКА СТАРОГО СОСТОЯНИЯ ===
        if (
          window.enemySystem &&
          typeof window.enemySystem.cleanupAllEnemies === "function"
        ) {
          window.enemySystem.cleanupAllEnemies();
        }

        if (gameContext.projectiles) {
          gameContext.projectiles.length = 0;
        }

        window.implantsSystem?.pendingProjectileRequests?.clear();

        if (gameContext.lightningStrikes) {
          gameContext.lightningStrikes.length = 0;
        }

        if (gameContext.tornadoStrikes) {
          gameContext.tornadoStrikes.length = 0;
        }

        // Очищаем старые предметы
        items.forEach((item, itemId) => {
          if (item.worldId !== data.worldId) items.delete(itemId);
        });

        window.worldSystem.switchWorld(data.worldId, me, data.x, data.y);
        window.combatSystem.syncBullets(data.bullets || []);

        // The transition response already contains the authoritative snapshot
        // of every player currently in the destination world.
        if (Array.isArray(data.players)) {
          const currentPlayer = players.get(myId) || me;
          players.clear();
          players.set(myId, {
            ...currentPlayer,
            frameTime: 0,
            animTime: 0,
          });

          data.players.forEach((p) => {
            if (p?.id && p.id !== myId && p.worldId === data.worldId) {
              players.set(p.id, {
                ...p,
                animTime: 0,
                frameTime: 0,
                attackFrameTime: 0,
                attackFrame: p.attackFrame || 0,
                prevState: p.state || "idle",
                targetX: p.x,
                targetY: p.y,
                targetDirection: p.direction,
                targetState: p.state,
              });
            }
          });
        }

        if (window.soundSystem) {
          window.soundSystem.setWorld(data.worldId);
        }
        window.vendingMachine.hideVendingMenu();
        window.lightsSystem.reset(data.worldId);

        if (data.barriers && window.barriersSystem?.onBarriersSync) {
          window.barriersSystem.onBarriersSync({
            worldId: data.worldId ?? window.worldSystem?.currentWorldId,
            barriers: data.barriers,
          });
        }

        if (data.lights) {
          lights.length = 0;
          data.lights.forEach((light) =>
            lights.push({
              ...light,
              baseRadius: light.radius,
              pulseSpeed: 0.001,
            }),
          );
        }

        if (data.activeAnomaly) {
          activeAnomaly = data.activeAnomaly;
          const dx = me.x - activeAnomaly.x;
          const dy = me.y - activeAnomaly.y;
          window.isInAnomaly =
            dx * dx + dy * dy < activeAnomaly.radius * activeAnomaly.radius;
        } else {
          activeAnomaly = null;
          window.isInAnomaly = false;
        }

        // === СИНХРОНИЗАЦИЯ ВРАГОВ (главное) ===
        if (data.enemies && Array.isArray(data.enemies)) {
          window.enemySystem.syncEnemies(data.enemies);
        }
      }

      // Запрос полной синхронизации игроков
      setTimeout(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          sendWhenReady(
            ws,
            JSON.stringify({ type: "syncPlayers", worldId: data.worldId }),
          );
        }
      }, 700);
      break;
    case "worldTransitionFail": {
      const reason = data.reason || "unknown";
      let msg = "Не удалось перейти в арену";
      if (reason === "too_far_from_warman") msg = "Подойди ближе к Warman";
      else if (reason === "warman_not_met")
        msg = "Сначала познакомься с Warman";
      else if (reason === "no_corporate_documents")
        msg = "Сначала сдай документы";
      else if (reason === "position_not_recently_confirmed")
        msg = "Подвинься и попробуй снова";
      else if (reason === "position_mismatch_with_confirmed")
        msg = "Позиция не совпадает (античит)";
      else if (reason === "wrong_world_for_training")
        msg = "Warman только в Неоновом Городе";

      if (typeof showNotification === "function") {
        showNotification(msg, "#ff5555");
      }
      break;
    }
    case "newPlayer":
      if (data.player?.id && data.player.worldId === currentWorldId) {
        players.set(data.player.id, {
          ...data.player,
          // Критично для анимации
          animTime: 0,
          frameTime: 0,
          attackFrameTime: 0,
          attackFrame: data.player.attackFrame || 0,
          prevState: data.player.state || "idle",

          // Для интерполяции
          targetX: data.player.x,
          targetY: data.player.y,
          targetDirection: data.player.direction,
          targetState: data.player.state,
        });
      }
      break;
    case "playerLeft":
      if (players.has(data.id)) {
        players.delete(data.id);
      }
      break;
    case "syncItems":
      items.clear();
      data.items.forEach((item) => {
        if (item.worldId === currentWorldId) {
          items.set(item.itemId, {
            x: item.x,
            y: item.y,
            type: item.type,
            spawnTime: item.spawnTime,
            worldId: item.worldId,
          });
        }
      });
      data.items.forEach((item) => {
        if (pendingPickups.has(item.itemId)) {
          pendingPickups.delete(item.itemId);
        }
      });
      break;
    case "shoot":
      if (data.worldId === currentWorldId) {
        bullets.set(data.bulletId, {
          id: data.bulletId,
          x: data.x,
          y: data.y,
          vx: data.vx,
          vy: data.vy,
          damage: data.damage,
          range: data.range,
          ownerId: data.ownerId,
          spawnTime: data.spawnTime,
          worldId: data.worldId,
        });
      }
      break;
    case "bulletCollision":
      if (data.worldId === currentWorldId) {
        data.bulletIds.forEach((bulletId) => bullets.delete(bulletId));
      }
      break;
    case "removeBullet":
      if (data.worldId === currentWorldId) {
        bullets.delete(data.bulletId);
      }
      break;
    case "shootFail":
      if (data.reason === "no_ammo" || data.message) {
        showNotification(
          data.message || "У вас нет зарядов атомов в инвентаре!",
          "#ff5555",
        );
      }
      break;
    case "attackPlayer":
      if (
        data.worldId === currentWorldId &&
        currentWorldId !== 1 &&
        currentWorldId !== 2 &&
        players.has(data.targetId)
      ) {
        const player = players.get(data.targetId);
        player.health = Math.max(0, player.health - data.damage);
        players.set(data.targetId, { ...player });
        updateStatsDisplay();
      }
      break;
    case "itemPicked":
      items.delete(data.itemId);
      pendingPickups.delete(data.itemId);
      const me = players.get(myId);
      if (me && data.playerId === myId && data.item) {
        if (data.item.type === "balyary") {
          const balyarySlot = inventory.findIndex(
            (slot) => slot && slot.type === "balyary",
          );
          if (balyarySlot !== -1) {
            inventory[balyarySlot].quantity =
              (inventory[balyarySlot].quantity || 1) + 1;
          } else {
            const freeSlot = inventory.findIndex((slot) => slot === null);
            if (freeSlot !== -1) {
              inventory[freeSlot] = {
                type: "balyary",
                quantity: 1,
                itemId: data.itemId,
              };
            }
          }
        } else {
          const freeSlot = inventory.findIndex((slot) => slot === null);
          if (freeSlot !== -1) {
            inventory[freeSlot] = data.item;
          }
        }
        if (window.inventorySystem?.updateInventoryDisplay) {
          window.inventorySystem.updateInventoryDisplay();
        } else if (typeof updateInventoryDisplay === "function") {
          updateInventoryDisplay();
        }
      }
      updateStatsDisplay();
      break;
    case "itemNotFound":
      items.delete(data.itemId);
      pendingPickups.delete(data.itemId);
      break;
    case "pickupFail":
      pendingPickups.delete(data.itemId);
      break;
    case "equipItemSuccess": {
      const me = players.get(myId);
      if (me) {
        me.inventory = data.inventory;
        me.equipment = data.equipment;
        me.maxStats = data.maxStats;
        me.health = data.stats.health;
        me.energy = data.stats.energy;
        me.food = data.stats.food;
        me.water = data.stats.water;
        me.armor = data.stats.armor;

        inventory = me.inventory.map((slot) => (slot ? { ...slot } : null));
        window.equipmentSystem.equipmentSlots = { ...data.equipment };
        window.equipmentSystem.syncEquipment(data.equipment); // перерисовка + эффекты
        if (
          window.implantsSystem &&
          typeof window.implantsSystem.syncFromEquipment === "function"
        ) {
          window.implantsSystem.syncFromEquipment(data.equipment);
          window.implantsSystem.updateHotbarDisplay();
        }
      }
      window.equipmentSystem.pendingEquip = null;
      updateInventoryDisplay();
      updateStatsDisplay();
      break;
    }
    case "equipItemFail":
      window.equipmentSystem.handleEquipFail(data.error);
      break;
    case "unequipItemSuccess": {
      const me = players.get(myId);
      if (me) {
        me.inventory = data.inventory;
        me.equipment = data.equipment;
        me.maxStats = data.maxStats;

        // Важно: принудительно ограничиваем текущие статы (на случай рассинхрона)
        me.health = Math.min(me.health, me.maxStats.health);
        me.energy = Math.min(me.energy, me.maxStats.energy);
        me.food = Math.min(me.food, me.maxStats.food);
        me.water = Math.min(me.water, me.maxStats.water);
        me.armor = Math.min(me.armor, me.maxStats.armor);

        inventory = me.inventory.map((slot) => (slot ? { ...slot } : null));

        window.equipmentSystem.equipmentSlots = { ...data.equipment };
        window.equipmentSystem.applyEquipmentEffects(me);
        window.equipmentSystem.updateEquipmentDisplay();
      }

      window.equipmentSystem.pendingUnequip = null;
      updateInventoryDisplay();
      updateStatsDisplay();
      showNotification("Предмет снят", "#00ff88");
      break;
    }
    case "unequipItemFail": {
      showNotification(data.error || "Не удалось снять предмет!", "#ff5555");
      window.equipmentSystem.handleUnequipFail(data.error || "Ошибка сервера");
      break;
    }
    case "inventoryFull":
      pendingPickups.delete(data.itemId);
      break;
    case "update":
      if (data.player?.id === myId) {
        const me = players.get(myId);
        if (!me) break;

        const incoming = data.player;
        const old = { ...me };

        // ─── СОХРАНЯЕМ ВСЁ, ЧТО ОТВЕЧАЕТ ЗА АНИМАЦИЮ ─────────────────────
        const preserved = {
          animTime: me.animTime,
          frameTime: me.frameTime,
          frame: me.frame,
          attackFrameTime: me.attackFrameTime,
          attackFrame: me.attackFrame,
        };

        // Позиция и направление — через target*
        if (incoming.x !== undefined) me.targetX = incoming.x;
        if (incoming.y !== undefined) me.targetY = incoming.y;
        if (incoming.direction !== undefined)
          me.targetDirection = incoming.direction;

        // Состояние + переходы атаки
        if (incoming.state !== undefined) {
          const prevTarget = me.targetState;
          me.targetState = incoming.state;

          const becameAttack =
            prevTarget !== "attacking" && incoming.state === "attacking";
          const leftAttack =
            prevTarget === "attacking" && incoming.state !== "attacking";

          if (becameAttack) {
            me.attackFrame = incoming.attackFrame ?? 0;
            me.attackFrameTime = incoming.attackFrameTime ?? 0;
          } else if (leftAttack) {
            me.attackFrame = 0;
            me.attackFrameTime = 0;
          }
        }

        // КРИТИЧНО: всегда применяем attack-состояние от сервера
        if (incoming.attackFrame !== undefined)
          me.attackFrame = incoming.attackFrame;
        if (incoming.attackFrameTime !== undefined)
          me.attackFrameTime = incoming.attackFrameTime;

        // Критичные статы
        [
          "health",
          "energy",
          "food",
          "water",
          "armor",
          "distanceTraveled",
        ].forEach((k) => {
          if (incoming[k] !== undefined) me[k] = incoming[k];
        });

        if (incoming.maxStats) me.maxStats = incoming.maxStats;

        // Инвентарь + экипировка
        if (incoming.inventory) {
          me.inventory = incoming.inventory.map((slot) =>
            slot ? { ...slot } : null,
          );
          inventory = me.inventory.map((slot) => (slot ? { ...slot } : null));
          if (window.inventorySystem?.updateInventoryDisplay) {
            window.inventorySystem.updateInventoryDisplay();
          } else if (typeof updateInventoryDisplay === "function") {
            updateInventoryDisplay();
          }
        }

        if (incoming.equipment) {
          me.equipment = incoming.equipment;
          if (window.equipmentSystem) {
            window.equipmentSystem.equipmentSlots = { ...incoming.equipment };
            if (window.equipmentSystem.syncEquipment)
              window.equipmentSystem.syncEquipment(incoming.equipment);
            if (window.equipmentSystem.updateEquipmentDisplay)
              window.equipmentSystem.updateEquipmentDisplay();
          }
        }

        if (window.equipmentSystem?.updateDamageDisplay) {
          window.equipmentSystem.updateDamageDisplay();
        }

        // Универсальное применение остальных полей
        const skip = new Set([
          "id",
          "x",
          "y",
          "direction",
          "state",
          "animTime",
          "frameTime",
          "frame",
          "attackFrame",
          "attackFrameTime",
          "targetX",
          "targetY",
          "targetDirection",
          "targetState",
          "inventory",
          "equipment",
          "maxStats",
        ]);

        Object.keys(incoming).forEach((k) => {
          if (skip.has(k)) return;
          me[k] = incoming[k];
        });

        // ─── ВОССТАНАВЛИВАЕМ ЛОКАЛЬНУЮ АНИМАЦИЮ ─────────────────────────────
        me.animTime = preserved.animTime;
        me.frameTime = preserved.frameTime;
        me.frame = preserved.frame;

        // Гарантируем состояние
        if (incoming.state !== undefined) {
          me.state = incoming.state;
        }

        players.set(myId, { ...me });

        // NPC диалоги
        const watched = [
          "corporateDocumentsSubmitted",
          "potionMet",
          "potionQuest",
          "potionBookSearch",
          "medicalCertificate",
          "medicalCertificateStamped",
          "neonQuest",
        ];

        let needDialogRefresh = false;
        for (const key of watched) {
          if (incoming[key] !== undefined && incoming[key] !== old[key]) {
            needDialogRefresh = true;
            break;
          }
        }

        if (needDialogRefresh) {
          if (window.npcDialogSystem?.refreshCurrentDialog)
            window.npcDialogSystem.refreshCurrentDialog();
          if (window.potionNpcSystem?.refreshDialog)
            window.potionNpcSystem.refreshDialog();
        }

        if (incoming.corporateDocumentsSubmitted !== undefined) {
          me.corporateDocumentsSubmitted = incoming.corporateDocumentsSubmitted;
        }

        if (
          isThimbleriggerDialogOpen &&
          window.thimbleriggerSystem?.refreshDialogBackground
        ) {
          try {
            window.thimbleriggerSystem.refreshDialogBackground();
          } catch (e) {
            console.warn("[Thimblerigger] refreshDialogBackground failed:", e);
          }
        }

        updateStatsDisplay?.();
      }
      // ─── ДРУГИЕ ИГРОКИ (без изменений) ───────────────────────────────
      else if (data.player?.id) {
        let p = players.get(data.player.id);
        if (!p) {
          p = {
            id: data.player.id,
            animTime: 0,
            frameTime: 0,
            attackFrameTime: 0,
            attackFrame: 0,
            prevState: data.player.state || "idle",
          };
          players.set(data.player.id, p);
        }

        if (data.player.x !== undefined) p.targetX = Number(data.player.x);
        if (data.player.y !== undefined) p.targetY = Number(data.player.y);
        if (data.player.direction !== undefined)
          p.targetDirection = data.player.direction;
        if (data.player.state !== undefined) {
          p.targetState = data.player.state;
          p.state = data.player.state;
        }

        if (data.player.state === "attacking") {
          p.attackFrame = data.player.attackFrame ?? 0;
          p.attackFrameTime = data.player.attackFrameTime ?? 0;
        } else {
          p.attackFrame = 0;
          p.attackFrameTime = 0;
        }

        if (data.player.health !== undefined)
          p.health = Math.max(0, Number(data.player.health));
        if (data.player.energy !== undefined)
          p.energy = Math.max(0, Number(data.player.energy));
        if (data.player.food !== undefined)
          p.food = Math.max(0, Number(data.player.food));
        if (data.player.water !== undefined)
          p.water = Math.max(0, Number(data.player.water));
        if (data.player.armor !== undefined)
          p.armor = Number(data.player.armor);

        if (data.player.maxStats) p.maxStats = { ...data.player.maxStats };
      }
      break;
    case "updateMaxStatsResult":
      window.levelSystem.completeUpgradeRequest();
      if (data.success) {
        const me = players.get(myId);
        if (!me) break;

        // Обновляем объект игрока
        me.upgradePoints = data.upgradePoints;
        me.healthUpgrade = data.healthUpgrade;
        me.energyUpgrade = data.energyUpgrade;
        me.foodUpgrade = data.foodUpgrade;
        me.waterUpgrade = data.waterUpgrade;

        if (data.maxStats) {
          me.maxStats = { ...data.maxStats };
        }

        // Обновляем текущие значения (сервер уже ограничил)
        if (data.health !== undefined) me.health = data.health;
        if (data.energy !== undefined) me.energy = data.energy;
        if (data.food !== undefined) me.food = data.food;
        if (data.water !== undefined) me.water = data.water;

        // Синхронизируем глобальные переменные levelSystem
        window.levelSystem.upgradePoints = data.upgradePoints;
        window.levelSystem.healthUpgrade = data.healthUpgrade;
        window.levelSystem.energyUpgrade = data.energyUpgrade;
        window.levelSystem.foodUpgrade = data.foodUpgrade;
        window.levelSystem.waterUpgrade = data.waterUpgrade;

        // Если maxStats пришли — обновляем и их
        if (data.maxStats) {
          window.levelSystem.maxStats = { ...data.maxStats };
        }

        updateStatsDisplay();
        updateUpgradeButtons(); // важно — перерисовать кнопки +/-
      } else {
        alert(data.error || "Не удалось улучшить характеристики");
        // Синхронизируем состояние с авторитетным ответом сервера.
        const me = players.get(myId);
        if (me) {
          if (data.upgradePoints !== undefined)
            me.upgradePoints = data.upgradePoints;
          if (data.healthUpgrade !== undefined)
            me.healthUpgrade = data.healthUpgrade;
          if (data.energyUpgrade !== undefined)
            me.energyUpgrade = data.energyUpgrade;
          if (data.foodUpgrade !== undefined) me.foodUpgrade = data.foodUpgrade;
          if (data.waterUpgrade !== undefined)
            me.waterUpgrade = data.waterUpgrade;
        }
        if (data.upgradePoints !== undefined) {
          window.levelSystem.upgradePoints = data.upgradePoints;
          updateUpgradeButtons();
        }
      }
      break;
    case "buyWaterResult":
      if (data.success) {
        const me = players.get(myId);
        if (me) {
          me.water = data.water;
          me.inventory = data.inventory.map((slot) =>
            slot ? { ...slot } : null,
          );
        }

        updateStatsDisplay();
        if (window.inventorySystem?.updateInventoryDisplay) {
          window.inventorySystem.updateInventoryDisplay();
        } else if (typeof updateInventoryDisplay === "function") {
          updateInventoryDisplay();
        }

        window.vendingMachine?.hideVendingMenu?.();

        // Новое уведомление
        if (data.notification) {
          showNotification(data.notification, data.color || "#00ff88");
        }
      } else {
        // Ошибка (включая "Недостаточно баляр!")
        if (data.notification) {
          showNotification(data.notification, data.color || "#ff00ff");
        }
      }
      break;
    case "vacuumRobotUpdate":
      if (window.vacuumRobotSystem?.applyServerUpdate) {
        window.vacuumRobotSystem.applyServerUpdate(data);
      }
      break;
    case "useItemSuccess":
      {
        const me = players.get(myId);
        if (!me) break;

        // Обновляем только те статы, которые пришли
        if (data.stats) {
          if (data.stats.health !== undefined)
            me.health = Number(data.stats.health);
          if (data.stats.energy !== undefined)
            me.energy = Number(data.stats.energy);
          if (data.stats.food !== undefined) me.food = Number(data.stats.food);
          if (data.stats.water !== undefined)
            me.water = Number(data.stats.water);
          if (data.stats.armor !== undefined)
            me.armor = Number(data.stats.armor);
        }

        // Полная синхронизация инвентаря — критично!
        if (data.inventory) {
          me.inventory = data.inventory.map((slot) =>
            slot ? { ...slot } : null,
          );
          window.inventory = me.inventory.map((slot) =>
            slot ? { ...slot } : null,
          );
        }

        // Если использовали предмет в выбранном слоте — снимаем выделение
        if (
          typeof data.slotIndex === "number" &&
          selectedSlot === data.slotIndex &&
          (!window.inventory[data.slotIndex] || data.remainingQuantity <= 0)
        ) {
          selectedSlot = null;
          document
            .querySelectorAll(".inventory-slot")
            .forEach((el) => el.classList.remove("selected"));
          document.getElementById("inventoryScreen").textContent = "";
        }

        // Обновляем UI
        updateStatsDisplay();
        if (window.inventorySystem?.updateInventoryDisplay) {
          window.inventorySystem.updateInventoryDisplay();
        } else if (typeof updateInventoryDisplay === "function") {
          updateInventoryDisplay();
        }

        // Включаем кнопку обратно (если инвентарь открыт)
        if (isInventoryOpen) {
          document.getElementById("useBtn").disabled = false;
        }
      }
      break;
    case "syncBullets":
      window.combatSystem.syncBullets(data.bullets);
      break;
    case "newEnemy":
      // Это сообщение приходит при спавне нового врага (у тебя есть spawnNewEnemy на сервере)
      if (data.enemy && data.enemy.id) {
        enemies.set(data.enemy.id, {
          ...data.enemy,
          targetX: data.enemy.x,
          targetY: data.enemy.y,
        });
      }
      break;
    case "enemyKilled":
      break;
    case "xpSync": {
      // ← УНИФИЦИРОВАННЫЙ ОБРАБОТЧИК
      // Мгновенно обновляем уровень, XP, xpToNextLevel, upgradePoints
      if (window.levelSystem) {
        window.levelSystem.currentLevel = data.level;
        window.levelSystem.currentXP = data.xp;
        window.levelSystem.xpToNextLevel = data.xpToNextLevel;
        window.levelSystem.upgradePoints = data.upgradePoints;
        window.levelSystem.meleeDamageBonus =
          Number(data.meleeDamageBonus) || 0;

        if (typeof window.levelSystem.setLevelData === "function") {
          window.levelSystem.setLevelData(
            data.level,
            data.xp,
            null,
            data.upgradePoints,
          );
        }

        // Показываем эффект +XP всегда (даже если уровень не вырос)
        if (
          typeof window.levelSystem.showXPEffect === "function" &&
          data.xpGained
        ) {
          window.levelSystem.showXPEffect(data.xpGained);
        }

        if (typeof window.levelSystem.updateLevelDisplay === "function") {
          window.levelSystem.updateLevelDisplay();
        }

        if (typeof updateStatsDisplay === "function") {
          updateStatsDisplay();
        }

        if (typeof window.levelSystem.updateUpgradeButtons === "function") {
          window.levelSystem.updateUpgradeButtons();
        }
      }
      break;
    }
    case "levelUpSuccess": {
      const oldSkillPoints = window.skillsSystem.skillPoints ?? 0;

      window.levelSystem.setLevelData(
        data.level,
        data.xp,
        null,
        data.upgradePoints,
        data.skillPoints,
      );

      const me = players.get(myId);
      if (me) {
        // Обновляем объект игрока — это источник правды
        me.level = data.level;
        me.xp = data.xp;
        me.xpToNextLevel = calculateXPToNextLevel(data.level); // если сервер не прислал
        me.upgradePoints = data.upgradePoints;
        me.meleeDamageBonus = Number(data.meleeDamageBonus) || 0;

        // Обновляем skillPoints, если пришли
        if (data.skillPoints !== undefined) {
          window.skillsSystem.skillPoints = Number(data.skillPoints);

          if (data.skillPoints > oldSkillPoints) {
            showNotification(
              `+${data.skillPoints - oldSkillPoints} очков навыков за уровень!`,
              "#ffaa00",
            );
          }

          if (window.skillsSystem.isSkillsOpen) {
            window.skillsSystem.updateSkillPointsDisplay();
          }
        }
        window.levelSystem.upgradePoints = me.upgradePoints;
      }

      // Показываем красивый level up эффект
      showLevelUpEffect();

      // Обновляем UI ТОЛЬКО ПОСЛЕ обновления данных
      updateLevelDisplay();
      updateStatsDisplay();
      updateUpgradeButtons(); // теперь кнопки появятся сразу, если upgradePoints > 0

      break;
    }
    case "syncEnemies":
      window.enemySystem.syncEnemies(data.enemies);
      break;
    case "enemyAttack":
      if (data.targetId === myId) {
        triggerAttackAnimation?.(); // если функция существует
        if (window.regenerationSystem) {
          window.regenerationSystem.resetTimerOnDamage();
        }
      }
      break;
    case "vacuumBalyaryRewardSuccess":
      {
        const me = players.get(myId);
        if (me && data.inventory) {
          // Синхронизируем инвентарь
          me.inventory = data.inventory.map((slot) =>
            slot ? { ...slot } : null,
          );
          window.inventory = me.inventory.map((slot) =>
            slot ? { ...slot } : null,
          );
        }

        // Красивое уведомление
        if (typeof showNotification === "function") {
          const balyaryText = data.amount
            ? `+${data.amount} баляр`
            : `+${data.quantity || 1} баляр`;
          const xpText = data.xpGained ? ` и +${data.xpGained} XP` : "";
          showNotification(`${balyaryText}${xpText}`, "#00ff88");
        }

        // Обновляем отображение инвентаря
        if (window.inventorySystem?.updateInventoryDisplay) {
          window.inventorySystem.updateInventoryDisplay();
        } else if (typeof updateInventoryDisplay === "function") {
          updateInventoryDisplay();
        }
        updateStatsDisplay?.();
      }
      break;
    case "questCompleted":
      showNotification(
        `Квест выполнен! +${data.balyaryGained || 0} баляр и ${data.xpGained || 0} XP!`,
        "#00ff88",
      );
      break;
    case "closeQuestDialog":
      closeNPCDialog();
      break;
    case "questCompleteFailed":
      if (data.reason === "bought_from_jack") {
        showNotification(
          data.message || "Купленные у Джека предметы нельзя сдавать в квесты",
          "#ff5555",
        );
      } else if (data.reason === "not_enough_items") {
        showNotification("Недостаточно предметов для квеста", "#ff5555");
      } else {
        showNotification("Не удалось сдать квест", "#ff5555");
      }
      break;
    case "neonQuestStarted":
      showNotification("Заказ принят: Очистка пустошей", "#00ff44");
      if (window.npcDialogSystem) window.npcDialogSystem.refreshCurrentDialog();
      break;
    case "neonQuestProgressUpdate":
      // Это основное обновление прогресса от сервера
      if (window.neonNpcSystem) {
        const me = players.get(myId);
        if (me && me.neonQuest) {
          me.neonQuest.progress = {
            ...me.neonQuest.progress,
            ...data.progress,
          };
          if (me.neonQuest.currentQuestId === "neon_quest_1") {
            updateQuestProgressDisplay(); // вызываем из neon_npc.js
          }
        }
      }
      if (window.npcDialogSystem) window.npcDialogSystem.refreshCurrentDialog();
      break;
    case "neonQuestCompleted":
      {
        const reward = data.reward || {};
        showNotification(
          `Задание сдано! +${reward.xp} XP | +${reward.balyary} баляров${reward.item ? " + рецепт" : ""}!`,
          "#00ffff",
        );

        if (window.levelSystem) {
          window.levelSystem.setLevelData(
            data.level,
            data.xp,
            data.xpToNextLevel,
            data.upgradePoints,
          );
          window.levelSystem.showXPEffect(reward.xp || 0);
        }

        const me = players.get(myId);
        if (me && data.inventory) {
          me.inventory = data.inventory.map((slot) =>
            slot ? { ...slot } : null,
          );
          window.inventory = me.inventory.map((slot) =>
            slot ? { ...slot } : null,
          );
          if (window.inventorySystem?.updateInventoryDisplay) {
            window.inventorySystem.updateInventoryDisplay();
          } else if (typeof updateInventoryDisplay === "function") {
            updateInventoryDisplay();
          }
        }

        if (window.npcDialogSystem)
          window.npcDialogSystem.refreshCurrentDialog();
        removeQuestProgressFromChat(); // убираем прогресс-бар после сдачи
      }
      break;
    case "potionQuestStarted":
      showNotification("Квест принят: Найти потерянную книгу", "#00ff88");
      if (window.potionNpcSystem?.handleMessage) {
        window.potionNpcSystem.handleMessage(data);
      }
      break;
    case "potionQuestCompleted":
      {
        const reward = data.reward || {};
        showNotification(
          `Книга сдана! +${reward.xp} XP | +${reward.balyary} баляров!`,
          "#00ffff",
        );

        if (window.levelSystem) {
          window.levelSystem.setLevelData(
            data.level,
            data.xp,
            null,
            data.upgradePoints,
          );
          window.levelSystem.showXPEffect(reward.xp || 0);
        }

        const me = players.get(myId);
        if (me && data.inventory) {
          me.inventory = data.inventory.map((slot) =>
            slot ? { ...slot } : null,
          );
          window.inventory = me.inventory.map((slot) =>
            slot ? { ...slot } : null,
          );
          if (window.inventorySystem?.updateInventoryDisplay) {
            window.inventorySystem.updateInventoryDisplay();
          } else if (typeof updateInventoryDisplay === "function") {
            updateInventoryDisplay();
          }
        }

        if (window.potionNpcSystem?.handleMessage) {
          window.potionNpcSystem.handleMessage(data);
        }
        if (window.npcDialogSystem)
          window.npcDialogSystem.refreshCurrentDialog();
      }
      break;
    case "potionQuestError":
    case "potionQuestCompleteFailed":
      showNotification(data.error || "Ошибка квеста", "#ff5555");
      break;
    case "doctorQuestCompleted":
      {
        showNotification(
          "Мед. справка получена! Форма МД-07 в инвентаре.",
          "#00ff44",
        );
        const me = players.get(myId);
        if (me) {
          me.medicalCertificate = data.medicalCertificate || true;
          me.inventory = data.inventory.map((i) => (i ? { ...i } : null));
          if (window.inventorySystem?.updateInventoryDisplay) {
            window.inventorySystem.updateInventoryDisplay();
          } else if (typeof updateInventoryDisplay === "function") {
            updateInventoryDisplay();
          }
        }
      }
      break;
    case "robotDoctorResult":
      if (data.success) {
        const me = players.get(myId);
        if (me) {
          if (data.health !== undefined) me.health = data.health;
          if (data.inventory) {
            me.inventory = data.inventory.map((i) => (i ? { ...i } : null));
            if (window.inventorySystem?.updateInventoryDisplay) {
              window.inventorySystem.updateInventoryDisplay();
            } else if (typeof updateInventoryDisplay === "function") {
              updateInventoryDisplay();
            }
          }
          updateStatsDisplay();
          showNotification(
            data.action === "freeHeal"
              ? "Осмотр пройден. Здоровье восстановлено!"
              : data.action === "heal20"
                ? "+20 HP за 1 баляр"
                : `Полное восстановление за ${data.cost} баляров!`,
            "#00ff44",
          );
        }
      } else {
        showNotification(data.error || "Лечение невозможно", "#ff0066");
      }
      break;
    case "captainStampResult":
      if (data.success) {
        // Обновляем инвентарь
        const me = players.get(myId);
        me.inventory = data.inventory.map((i) => (i ? { ...i } : null));
        if (window.inventorySystem?.updateInventoryDisplay) {
          window.inventorySystem.updateInventoryDisplay();
        } else if (typeof updateInventoryDisplay === "function") {
          updateInventoryDisplay();
        }

        if (me) {
          me.medicalCertificateStamped = data.medicalCertificateStamped ?? true;
          players.set(myId, me);
        }

        // Уведомление
        showNotification(
          "Печать получена! Допуск в Неоновый Город выдан.",
          "#00ff44",
        );

        // Автоматически закрываем диалог капитана
        const captainDialog = document.getElementById("captainDialog");
        if (captainDialog) captainDialog.remove();

        if (window.outpostCaptainSystem) {
          window.outpostCaptainSystem.isCaptainDialogOpen = () => false;
        }
      } else {
        showNotification(
          data.error || "Капитан отказался ставить печать.",
          "#ff0066",
        );
      }
      break;
    case "corporateDocumentsStatus":
      {
        const me = players.get(myId);
        if (me)
          me.corporateDocumentsSubmitted = data.corporateDocumentsSubmitted;
      }
      break;
    case "corporateDocumentsResult":
      if (data.success) {
        // Обновляем уровень и опыт
        window.levelSystem.setLevelData(
          data.level,
          data.xp,
          null,
          data.upgradePoints,
        );

        // Обновляем инвентарь
        const me = players.get(myId);
        me.inventory = data.inventory;
        if (window.inventorySystem?.updateInventoryDisplay) {
          window.inventorySystem.updateInventoryDisplay();
        } else if (typeof updateInventoryDisplay === "function") {
          updateInventoryDisplay();
        }

        // Уведомление
        showNotification(
          "Документы приняты. Добро пожаловать в Корпорацию!",
          "#00ffff",
        );
        showNotification(
          "Получен стартовый комплект снаряжения и кастет",
          "#ffff00",
        );

        // Закрываем диалог
        if (window.corporateRobotSystem?.isPlayerInteracting()) {
          document.querySelector(".npc-dialog")?.style &&
            (document.querySelector(".npc-dialog").style.display = "none");
        }
      } else {
        showNotification(
          data.error || "Ошибка при сдаче документов",
          "#ff0000",
        );
      }
      break;
    case "homelessMet":
      const meAfterHomeless = players.get(myId);
      if (meAfterHomeless) {
        meAfterHomeless.homelessMet = data.met === true;
      }
      if (window.homelessSystem?.setHomelessMet) {
        window.homelessSystem.setHomelessMet(data.met === true);
      }
      if (data.xpGained > 0) {
        showNotification(
          `Знакомство с NPC + ${data.xpGained} опыта!`,
          "#ffff00",
        );
        if (window.levelSystem) {
          window.levelSystem.setLevelData(
            data.level,
            data.xp,
            null,
            data.upgradePoints || 0,
          );
        }
      }
      break;
    case "corporateRobotGreetingShown":
      const meCorp = players.get(myId);
      if (meCorp) {
        meCorp.corporateRobotGreetingShown = true;
      }
      if (window.corporateRobotSystem?.setGreetingShown) {
        window.corporateRobotSystem.setGreetingShown(true);
      }
      // Дополнительно обновляем state (на случай если диалог был открыт)
      if (window.corporateRobotSystem?.state) {
        window.corporateRobotSystem.state.greetingShown = true;
      }
      break;
    case "npcMet":
      // Обновляем статус в игроке
      const meAfterNpc = players.get(myId);
      if (meAfterNpc) {
        meAfterNpc.npcMet = data.met === true;
      }

      // Обновляем систему NPC (если есть)
      if (window.npcSystem?.setNPCMet) {
        window.npcSystem.setNPCMet(data.met === true);
      }

      // === Награда за знакомство ===
      if (data.xpGained > 0) {
        showNotification(
          `Знакомство с NPC + ${data.xpGained} опыта!`,
          "#ffff00",
        );
        if (window.levelSystem) {
          window.levelSystem.setLevelData(
            data.level,
            data.xp,
            null,
            data.upgradePoints || 0,
          );
        }
      }
      break;
    case "jackMet":
      // Обновляем статус в игроке
      const meAfterJack = players.get(myId);
      if (meAfterJack) {
        meAfterJack.jackMet = data.met === true;
      }

      // Обновляем систему Jack
      window.jackSystem?.setJackMet?.(data.met === true);

      // Если познакомились и рядом — сразу показываем кнопки
      if (data.met === true) {
        const me = players.get(myId);
        if (me) {
          const dx = me.x + 35 - (1634 + 35);
          const dy = me.y + 35 - (915 + 35);
          const dist = Math.hypot(dx, dy);
          if (dist < 50) {
            // isPlayerNearJack выставится в checkJackProximity,
            // но на всякий случай форсируем создание кнопок
            const camera = window.movementSystem?.getCamera?.();
            if (camera && window.jackSystem) {
              // checkJackProximity сам создаст кнопки при следующем тике
            }
          }
        }
      }

      // === Награда за знакомство (как у остальных NPC) ===
      if (data.xpGained > 0) {
        showNotification(
          `Знакомство с NPC + ${data.xpGained} опыта!`,
          "#ffff00",
        );
        if (window.levelSystem) {
          window.levelSystem.setLevelData(
            data.level,
            data.xp,
            null,
            data.upgradePoints || 0,
          );
        }
      }
      break;
    case "neonMet":
      // Уже обработано в neon_npc.js, но дублируем для надёжности
      if (data.xpGained > 0) {
        showNotification(
          `Знакомство с NPC + ${data.xpGained} опыта!`,
          "#ffff00",
        );
        if (window.levelSystem) {
          window.levelSystem.setLevelData(
            data.level,
            data.xp,
            null,
            data.upgradePoints || 0,
          );
        }
      }
      break;
    case "thimbleriggerMet":
      window.thimbleriggerSystem.setThimbleriggerMet(data.met);

      // Обновляем фон если диалог уже открыт
      if (
        isThimbleriggerDialogOpen &&
        window.thimbleriggerSystem?.refreshDialogBackground
      ) {
        window.thimbleriggerSystem.refreshDialogBackground();
      }

      // === НОВОЕ: награда за знакомство ===
      if (data.xpGained > 0) {
        showNotification(
          `Знакомство с NPC + ${data.xpGained} опыта!`,
          "#ffff00",
        );
        if (window.levelSystem) {
          window.levelSystem.setLevelData(
            data.level,
            data.xp,
            null,
            data.upgradePoints || 0,
          );
        }
      }
      break;
    case "thimbleriggerStartGame": {
      const me = players.get(myId);
      if (me) {
        me.inventory = data.inventory.map((i) => (i ? { ...i } : null));
        if (window.inventorySystem?.updateInventoryDisplay) {
          window.inventorySystem.updateInventoryDisplay();
        } else if (typeof updateInventoryDisplay === "function") {
          updateInventoryDisplay();
        }
      }

      // Запускаем игру с реальной последовательностью свапов с сервера
      startSimpleGame(data.swapSequence);
      break;
    }
    case "thimbleriggerGameResultSync":
      if (data.success) {
        const me = players.get(myId);
        if (me) {
          me.inventory = data.inventory.map((i) => (i ? { ...i } : null));
          if (window.inventorySystem?.updateInventoryDisplay) {
            window.inventorySystem.updateInventoryDisplay();
          } else if (typeof updateInventoryDisplay === "function") {
            updateInventoryDisplay();
          }

          if (window.levelSystem) {
            window.levelSystem.setLevelData(
              data.level,
              data.xp,
              null,
              data.upgradePoints,
            );
            window.levelSystem.showXPEffect(data.xpGained || 0);
            window.levelSystem.updateLevelDisplay();
          }
          updateStatsDisplay();
        }

        // === УБРАЛИ ВНУТРЕННИЕ СООБЩЕНИЯ ИГРЫ ===
        // Оставляем только визуал (поднятые чашки + шарик) для красоты
        const area = document.getElementById("gameArea");
        if (area && data.correctCup !== undefined) {
          const cups = area.querySelectorAll(".thimble-cup");
          cups.forEach((c) => c.classList.add("lifted"));

          const ball = document.createElement("div");
          ball.className = "thimble-ball";
          const correctCupEl = cups[data.correctCup];
          if (correctCupEl) {
            ball.style.left = correctCupEl.style.left.replace("80px", "10px");
          } else {
            ball.style.left = "50%";
          }
          area.appendChild(ball);
        }

        showNotification(
          data.won
            ? `Выигрыш! +${data.bet * 2} баляров и +${data.xpGained} XP`
            : "Не повезло... Попробуй ещё раз",
          data.won ? "#00ff00" : "#ff5555",
        );

        lastSelectedCup = -1;
      } else {
        showNotification(data.error || "Ошибка игры", "#ff5555");
        lastSelectedCup = -1;
      }
      break;
    case "buyFromJackSuccess":
      {
        // Обновляем инвентарь из сервера
        inventory = data.inventory.map((slot) => (slot ? { ...slot } : null));
        const me = players.get(myId);
        if (me) {
          me.inventory = [...inventory];
          players.set(myId, me);
        }
        if (window.inventorySystem?.updateInventoryDisplay) {
          window.inventorySystem.updateInventoryDisplay();
        } else if (typeof updateInventoryDisplay === "function") {
          updateInventoryDisplay();
        }
        updateStatsDisplay();

        // Перезагружаем диалог магазина (точно как у Cristina)
        if (
          document.querySelector('[data-npc="jack-buy"]') ||
          jackDialogStage === "shop"
        ) {
          showJackDialog("shop");
        }

        if (typeof showNotification === "function") {
          showNotification("Покупка успешна!", "#00ff88");
        }
      }
      break;
    case "buyFromJackFail":
      alert(data.error || "Ошибка покупки");
      break;
    case "sellToJackSuccess":
      {
        // Обновляем инвентарь из сервера
        inventory = data.inventory.map((slot) => (slot ? { ...slot } : null));
        const me = players.get(myId);
        if (me) {
          me.inventory = [...inventory];
          players.set(myId, me);
        }
        if (window.inventorySystem?.updateInventoryDisplay) {
          window.inventorySystem.updateInventoryDisplay();
        } else if (typeof updateInventoryDisplay === "function") {
          updateInventoryDisplay();
        }
        updateStatsDisplay();

        // Уведомление игроку (как у Cristina)
        if (typeof showNotification === "function") {
          showNotification("Продано за 1 баляр!", "#00ff88");
        }

        // Перезагружаем диалог скупки
        if (jackDialogStage === "buyback") {
          showJackDialog("buyback");
        }
      }
      break;
    case "sellToJackFail":
      alert(data.error || "Ошибка продажи");
      break;
    case "cristinaBuySuccess": {
      // Полная синхронизация инвентаря (точно как у Джека)
      if (data.inventory) {
        inventory = data.inventory.map((slot) => (slot ? { ...slot } : null));
        const me = players.get(myId);
        if (me) {
          me.inventory = [...inventory];
          players.set(myId, me);
        }
        if (window.inventorySystem?.updateInventoryDisplay) {
          window.inventorySystem.updateInventoryDisplay();
        } else if (typeof updateInventoryDisplay === "function") {
          updateInventoryDisplay();
        }
        updateStatsDisplay();
      }

      if (typeof showNotification === "function") {
        showNotification(
          `Куплено за 50 баляр! Осталось: ${data.balyaryLeft ?? "?"}`,
          "#00ff88",
        );
      }
      break;
    }
    case "cristinaSellSuccess": {
      // Полная синхронизация инвентаря (точно как у Джека / cristinaBuySuccess)
      if (data.inventory) {
        inventory = data.inventory.map((slot) => (slot ? { ...slot } : null));
        const me = players.get(myId);
        if (me) {
          me.inventory = [...inventory];
          players.set(myId, me);
        }
        if (window.inventorySystem?.updateInventoryDisplay) {
          window.inventorySystem.updateInventoryDisplay();
        } else if (typeof updateInventoryDisplay === "function") {
          updateInventoryDisplay();
        }
        updateStatsDisplay();
      }

      // Уведомление игроку
      if (typeof showNotification === "function") {
        showNotification(`Продано за ${data.price ?? 5} баляр!`, "#00ff88");
      }

      // Динамическое обновление окна продажи (как showJackDialog("buyback") у Джека)
      if (
        document.querySelector('[data-npc="cristina-sell"]') &&
        window.cristinaNpc?.openSellDialog
      ) {
        window.cristinaNpc.openSellDialog();
      }
      break;
    }
    case "cristinaError": {
      if (typeof showNotification === "function") {
        showNotification(data.message || "Ошибка", "#ff4444");
      }
      break;
    }
    case "linaBuySuccess": {
      if (Array.isArray(data.inventory)) {
        // обновляем локальный инвентарь
        if (typeof inventory !== "undefined") {
          // если inventory — глобальный массив
          for (let i = 0; i < 20; i++) {
            inventory[i] = data.inventory[i] || null;
          }
        }
        const me = players.get(myId);
        if (me) {
          me.inventory = data.inventory;
          players.set(myId, me);
        }
        if (window.inventorySystem?.updateInventoryDisplay) {
          window.inventorySystem.updateInventoryDisplay();
        } else if (typeof updateInventoryDisplay === "function") {
          updateInventoryDisplay();
        }
      }
      if (typeof showNotification === "function") {
        showNotification(
          `Куплено: ${data.itemType} (−${data.price} баляр)`,
          "#ff9ecf",
        );
      }
      break;
    }
    case "linaError": {
      if (typeof showNotification === "function") {
        showNotification(data.message || "Ошибка магазина Lina", "#ff4444");
      }
      break;
    }
    case "linaSellSuccess": {
      if (data.inventory) {
        inventory = data.inventory.map((slot) => (slot ? { ...slot } : null));
        const me = players.get(myId);
        if (me) {
          me.inventory = [...inventory];
          players.set(myId, me);
        }
        if (window.inventorySystem?.updateInventoryDisplay) {
          window.inventorySystem.updateInventoryDisplay();
        } else if (typeof updateInventoryDisplay === "function") {
          updateInventoryDisplay();
        }
        updateStatsDisplay();
      }

      if (typeof showNotification === "function") {
        showNotification(`Продано за ${data.price ?? 1} баляр!`, "#ff9ecf");
      }

      // Оставляем диалог открытым и сразу обновляем сетку
      if (
        document.querySelector('[data-npc="lina-sell"]') &&
        window.linaNpc?.openSellDialog
      ) {
        window.linaNpc.openSellDialog();
      }
      break;
    }
    case "viktorBuySuccess": {
      if (Array.isArray(data.inventory)) {
        if (typeof inventory !== "undefined") {
          for (let i = 0; i < 20; i++) {
            inventory[i] = data.inventory[i] || null;
          }
        }
        const me = players.get(myId);
        if (me) {
          me.inventory = data.inventory;
          players.set(myId, me);
        }
        if (window.inventorySystem?.updateInventoryDisplay) {
          window.inventorySystem.updateInventoryDisplay();
        } else if (typeof updateInventoryDisplay === "function") {
          updateInventoryDisplay();
        }
        updateStatsDisplay();
      }
      if (typeof showNotification === "function") {
        showNotification(
          `Куплено: ${data.itemType} (−${data.price} баляр)`,
          "#7ec8ff",
        );
      }
      break;
    }
    case "viktorSellSuccess": {
      if (data.inventory) {
        inventory = data.inventory.map((slot) => (slot ? { ...slot } : null));
        const me = players.get(myId);
        if (me) {
          me.inventory = [...inventory];
          players.set(myId, me);
        }
        if (window.inventorySystem?.updateInventoryDisplay) {
          window.inventorySystem.updateInventoryDisplay();
        } else if (typeof updateInventoryDisplay === "function") {
          updateInventoryDisplay();
        }
        updateStatsDisplay();
      }

      if (typeof showNotification === "function") {
        showNotification(`Продано за ${data.price ?? 0} баляр!`, "#7ec8ff");
      }

      // Оставляем диалог открытым и сразу обновляем сетку
      if (
        document.querySelector('[data-npc="viktor-sell"]') &&
        window.viktorNpc?.openSellDialog
      ) {
        window.viktorNpc.openSellDialog();
      }
      break;
    }
    case "viktorError": {
      if (typeof showNotification === "function") {
        showNotification(data.message || "Ошибка магазина Viktor", "#ff4444");
      }
      break;
    }
    case "madDoctorBuySuccess":
      {
        if (data.inventory) {
          inventory = data.inventory.map((slot) => (slot ? { ...slot } : null));
          const me = players.get(myId);
          if (me) {
            me.inventory = [...inventory];
          }
          if (window.inventorySystem?.updateInventoryDisplay) {
            window.inventorySystem.updateInventoryDisplay();
          } else if (typeof updateInventoryDisplay === "function") {
            updateInventoryDisplay();
          }
          updateStatsDisplay();
        }
        showNotification(
          `Куплено: ${data.itemType} за ${data.price} баляр`,
          "#00ff88",
        );
      }
      break;
    case "madDoctorDonateSuccess":
      {
        const me = players.get(myId);
        if (me) {
          if (typeof data.health === "number") {
            me.health = data.health;
          }
          if (data.inventory) {
            me.inventory = data.inventory.map((slot) =>
              slot ? { ...slot } : null,
            );
            inventory = me.inventory.map((slot) => (slot ? { ...slot } : null));
          }
          players.set(myId, { ...me });
        }

        if (window.inventorySystem?.updateInventoryDisplay) {
          window.inventorySystem.updateInventoryDisplay();
        } else if (typeof updateInventoryDisplay === "function") {
          updateInventoryDisplay();
        }
        updateStatsDisplay();

        showNotification(
          `Сдано ${data.amount} мл крови → +${data.reward} баляр`,
          "#00ff88",
        );

        // Закрываем диалог донорства, если открыт
        if (window.madDoctorSystem) {
          // closeDialog уже внутри системы; просто уберём active
          document.body.classList.remove("npc-dialog-active");
          const dlg = document.querySelector(
            '.npc-dialog[data-npc="madDoctor-blooddonation"]',
          );
          if (dlg) dlg.remove();
        }
      }
      break;
    case "madDoctorError":
      showNotification(data.message || "Ошибка банка крови", "#ff5555");
      break;
    case "twister":
      if (window.misterTwister?.handleMessage) {
        window.misterTwister.handleMessage(data);
      }
      break;
    case "trashGuessResult": {
      if (data.success) {
        // Ставим флаг — диалог не должен переоткрываться ближайшие ~4.5 сек
        window._trashJustOpenedAt = Date.now();

        // Собираем точный текст награды
        let balyaryQty = 0;
        const otherItems = [];

        if (Array.isArray(data.loot)) {
          data.loot.forEach((it) => {
            if (!it || !it.type) return;
            if (it.type === "balyary") {
              balyaryQty += it.quantity || 1;
            } else {
              otherItems.push(`${it.type} ×${it.quantity || 1}`);
            }
          });
        }

        const parts = [];
        if (balyaryQty > 0) parts.push(`${balyaryQty} баляр`);
        if (data.xpGained) parts.push(`${data.xpGained} XP`);
        if (otherItems.length > 0) parts.push(otherItems.join(", "));

        if (parts.length > 0) {
          showNotification(`Угадал! Получено: ${parts.join(", ")}`, "#44ff44");
        } else {
          showNotification("Угадал! Бак открыт", "#44ff44");
        }

        if (data.xpGained && window.levelSystem?.showXPEffect) {
          window.levelSystem.showXPEffect(data.xpGained);
        }

        window.inventorySystem?.updateInventoryDisplay?.();
        updateStatsDisplay?.();

        // Закрываем диалог
        const dialog = document.getElementById("trashCanDialog");
        if (dialog) dialog.remove();
        document.body.classList.remove("trash-dialog-active");
        currentTrashIndex = -1;
      } else {
        if (data.waitUntil) {
          const remainSec = Math.max(
            0,
            Math.ceil((data.waitUntil - Date.now()) / 1000),
          );
          showNotification(
            `Не угадал, следующая попытка через: ${remainSec}`,
            "#ff4444",
          );
        } else {
          showNotification(
            data.message || data.error || "Не угадал...",
            "#ff4444",
          );
        }
      }
      break;
    }
    case "trashCanOpened":
      if (
        data.trashIndex >= 0 &&
        data.trashIndex < window.trashCansState.length
      ) {
        window.trashCansState[data.trashIndex] = {
          ...window.trashCansState[data.trashIndex],
          guessed: true,
          isOpened: true,
        };

        if (currentTrashIndex === data.trashIndex) {
          document.querySelectorAll(".suit-btn").forEach((btn) => {
            btn.disabled = true;
            btn.style.opacity = "0.4";
          });
          showNotification("Этот бак уже кто-то открыл...", "#ffaa00");
        }
      }
      break;
    case "trashState": {
      if (data.index >= 0 && data.index < window.trashCansState.length) {
        window.trashCansState[data.index] = {
          ...window.trashCansState[data.index],
          guessed: data.guessed ?? false,
          isOpened: data.isOpened ?? false,
        };

        // Показываем «Бак пуст» только если диалог реально открыт
        // (после успешного угадывания диалог закрыт + стоит кулдаун)
        if (currentTrashIndex === data.index && data.isOpened) {
          document.querySelectorAll(".suit-btn").forEach((btn) => {
            btn.disabled = true;
            btn.style.opacity = "0.4";
          });
          showNotification("Бак пуст... подожди респавна", "#888888");
        }
      }
      break;
    }
    case "trashAllStates":
      data.states.forEach((st) => {
        if (st.index >= 0 && st.index < window.trashCansState.length) {
          window.trashCansState[st.index] = {
            guessed: st.guessed,
            isOpened: st.isOpened,
            nextAttemptAfter: st.nextAttemptAfter,
          };
        }
      });
      break;
    case "trashRespawned":
      const idx = data.index;
      if (idx >= 0 && idx < window.trashCansState.length) {
        window.trashCansState[idx].isOpened = false;
        window.trashCansState[idx].guessed = false;
        window.trashCansState[idx].nextAttemptAfter = 0;
      }
      break;
    case "captainMet":
      // Обновляем статус в игроке
      const meAfterCaptain = players.get(myId);
      if (meAfterCaptain) {
        meAfterCaptain.captainMet = data.met === true;
      }

      // Обновляем систему Капитана
      window.outpostCaptainSystem?.setCaptainMet?.(data.met === true);

      // === Награда за знакомство (как у остальных NPC) ===
      if (data.xpGained > 0) {
        showNotification(
          `Знакомство с NPC + ${data.xpGained} опыта!`,
          "#ffff00",
        );
        if (window.levelSystem) {
          window.levelSystem.setLevelData(
            data.level,
            data.xp,
            null,
            data.upgradePoints || 0,
          );
        }
      }
      break;
    case "torestosMet":
      // Обновляем статус в игроке
      const meAfterTorestos = players.get(myId);
      if (meAfterTorestos) {
        meAfterTorestos.torestosMet = data.met === true;
      }

      // Обновляем систему Торестоса
      window.torestosSystem?.setTorestosMet?.(data.met === true);

      // === Награда за знакомство (как у остальных NPC) ===
      if (data.xpGained > 0) {
        showNotification(
          `Знакомство с NPC + ${data.xpGained} опыта!`,
          "#ffff00",
        );
        if (window.levelSystem) {
          window.levelSystem.setLevelData(
            data.level,
            data.xp,
            null,
            data.upgradePoints || 0,
          );
        }
      }
      break;
    case "torestosUpgradeResult":
      const upgradeBtn = document.querySelector(
        ".upgrade-buttons .torestos-neon-btn",
      );
      if (data.success) {
        // Применяем новый инвентарь с itemId
        window.inventory = data.newInventory.map((i) => (i ? { ...i } : null));

        if (window.inventorySystem?.updateInventoryDisplay) {
          window.inventorySystem.updateInventoryDisplay();
        } else if (typeof updateInventoryDisplay === "function") {
          updateInventoryDisplay();
        }
        updateStatsDisplay();
        showNotification(data.message || "Предмет успешно улучшен!", "#00ff88");

        // Перерисовываем интерфейс Торестоса
        if (isDialogOpen && typeof renderUpgradeUI === "function") {
          renderUpgradeUI();
        }
      } else {
        showNotification(data.error || "Не удалось улучшить", "#ff4444");
      }
      if (upgradeBtn) {
        upgradeBtn.disabled = false;
        upgradeBtn.textContent = "УЛУЧШИТЬ";
      }
      break;
    case "toremidosMet":
      // Обновляем статус в игроке
      const meAfterToremidos = players.get(myId);
      if (meAfterToremidos) {
        meAfterToremidos.toremidosMet = data.met === true;
      }

      // Обновляем систему Торемидоса
      window.toremidosSystem?.setMet?.(data.met === true);

      // === Награда за знакомство (как у остальных NPC) ===
      if (data.xpGained > 0) {
        showNotification(
          `Знакомство с NPC + ${data.xpGained} опыта!`,
          "#ffff00",
        );
        if (window.levelSystem) {
          window.levelSystem.setLevelData(
            data.level,
            data.xp,
            null,
            data.upgradePoints || 0,
          );
        }
      }
      break;
    case "cristinaMet":
      // Обновляем статус в игроке
      const meAfterCristina = players.get(myId);
      if (meAfterCristina) {
        meAfterCristina.cristinaMet = data.met === true;
        players.set(myId, meAfterCristina);
      }

      // Обновляем систему
      window.cristinaNpc?.setMet?.(data.met === true);

      if (data.met !== true && data.error) {
        showNotification(data.error, "#ff5555");
      }

      // Награда за знакомство
      if (data.xpGained > 0) {
        showNotification(
          `Знакомство с NPC + ${data.xpGained} опыта!`,
          "#ffff00",
        );
        if (window.levelSystem) {
          window.levelSystem.setLevelData(
            data.level,
            data.xp,
            null,
            data.upgradePoints || 0,
          );
        }
      }
      break;
    case "linaMet":
      {
        const meAfterLina = players.get(myId);
        if (meAfterLina) {
          meAfterLina.linaMet = data.met === true;
          players.set(myId, meAfterLina);
        }

        window.linaNpc?.setMet?.(data.met === true);

        if (data.met !== true && data.error) {
          showNotification(data.error, "#ff5555");
        }

        if (data.xpGained > 0) {
          showNotification(
            `Знакомство с NPC + ${data.xpGained} опыта!`,
            "#ffff00",
          );
          if (window.levelSystem) {
            window.levelSystem.setLevelData(
              data.level,
              data.xp,
              null,
              data.upgradePoints || 0,
            );
          }
        }
      }
      break;
    case "viktorMet":
      {
        const meAfterViktor = players.get(myId);
        if (meAfterViktor) {
          meAfterViktor.viktorMet = data.met === true;
          players.set(myId, meAfterViktor);
        }

        window.viktorNpc?.setMet?.(data.met === true);

        if (data.met !== true && data.error) {
          showNotification(data.error, "#ff5555");
        }

        if (data.xpGained > 0) {
          showNotification(
            `Знакомство с NPC + ${data.xpGained} опыта!`,
            "#ffff00",
          );
          if (window.levelSystem) {
            window.levelSystem.setLevelData(
              data.level,
              data.xp,
              null,
              data.upgradePoints || 0,
            );
          }
        }
      }
      break;
    case "danielMet":
      {
        const meAfterDaniel = players.get(myId);
        if (meAfterDaniel) {
          meAfterDaniel.danielMet = data.met === true;
          players.set(myId, meAfterDaniel);
        }

        window.danielNpc?.setMet?.(data.met === true);

        if (data.met !== true && data.error) {
          showNotification(data.error, "#ff5555");
        }

        if (data.xpGained > 0) {
          showNotification(
            `Знакомство с NPC + ${data.xpGained} опыта!`,
            "#ffff00",
          );
          if (window.levelSystem) {
            window.levelSystem.setLevelData(
              data.level,
              data.xp,
              null,
              data.upgradePoints || 0,
            );
          }
        }
      }
      break;
    case "warmanMet":
      {
        const meAfterWarman = players.get(myId);
        if (meAfterWarman) {
          meAfterWarman.warmanMet = data.met === true;
          players.set(myId, meAfterWarman);
        }

        window.warmanNpc?.setMet?.(data.met === true);

        if (data.met !== true && data.error) {
          showNotification(data.error, "#ff5555");
        }

        if (data.xpGained > 0) {
          showNotification(
            `Знакомство с NPC + ${data.xpGained} опыта!`,
            "#ffff00",
          );
          if (window.levelSystem) {
            window.levelSystem.setLevelData(
              data.level,
              data.xp,
              null,
              data.upgradePoints || 0,
            );
          }
        }
      }
      break;
    case "madDoctorMet":
      {
        const meAfterMadDoctor = players.get(myId);
        if (meAfterMadDoctor) {
          meAfterMadDoctor.madDoctorMet = data.met === true;
          players.set(myId, meAfterMadDoctor);
        }

        window.madDoctorSystem?.setMet?.(data.met === true);

        if (data.met !== true && data.error) {
          showNotification(data.error, "#ff5555");
        }

        if (data.xpGained > 0) {
          showNotification(
            `Знакомство с NPC + ${data.xpGained} опыта!`,
            "#ffff00",
          );
          if (window.levelSystem) {
            window.levelSystem.setLevelData(
              data.level,
              data.xp,
              null,
              data.upgradePoints || 0,
            );
          }
        }
      }
      break;
    case "yuriMet":
      {
        const meAfterYuri = players.get(myId);
        if (meAfterYuri) {
          meAfterYuri.yuriMet = data.met === true;
          players.set(myId, meAfterYuri);
        }

        window.yuriSystem?.setMet?.(data.met === true);

        if (data.met !== true && data.error) {
          showNotification(data.error, "#ff5555");
        }

        if (data.xpGained > 0) {
          showNotification(
            `Знакомство с NPC + ${data.xpGained} опыта!`,
            "#ffff00",
          );
          if (window.levelSystem) {
            window.levelSystem.setLevelData(
              data.level,
              data.xp,
              null,
              data.upgradePoints || 0,
            );
          }
        }
      }
      break;
    case "forcePosition": {
      const me = players.get(myId);
      if (!me) break;

      const reason = data.reason || "server_correction";

      // Принудительно ставим позицию от сервера
      me.x = Number(data.x);
      me.y = Number(data.y);

      // Останавливаем любое движение по клику / тачу / джойстику
      window.movementSystem?.stopMovement?.();

      // Сбрасываем анимацию ходьбы, если была
      if (me.state === "walking") {
        me.state = "idle";
        me.frame = 0;
        me.frameTime = 0;
      }
      break;
    }
    case "barriersSync": {
      if (window.barriersSystem?.onBarriersSync) {
        window.barriersSystem.onBarriersSync(data);
      }
      break;
    }
    case "worldBarriersSnapshot":
    case "worldBarriersUpdated": {
      if (
        !Number.isSafeInteger(data.worldId) ||
        !Number.isSafeInteger(data.revision) ||
        !Array.isArray(data.barriers)
      ) {
        break;
      }

      if (data.worldId !== globalThis.worldSystem?.currentWorldId) {
        break;
      }

      const previousRevision = globalThis.sector12WorldBarriersRevision ?? -1;

      if (data.revision < previousRevision) {
        break;
      }

      globalThis.sector12WorldBarriersRevision = data.revision;

      globalThis.barriersSystem?.serverRevisionByWorld?.set(
        data.worldId,
        data.revision,
      );

      globalThis.barriersSystem?.onBarriersSync?.({
        worldId: data.worldId,
        barriers: data.barriers,
        revision: data.revision,
      });

      globalThis.dispatchEvent(
        new CustomEvent("sector12WorldBarriersUpdated", {
          detail: {
            worldId: data.worldId,
            revision: data.revision,
          },
        }),
      );

      break;
    }
    case "worldBarriersApplyResult": {
      const pending = pendingWorldBarriersRequest;

      if (!pending || data.requestId !== pending.requestId) {
        break;
      }

      pendingWorldBarriersRequest = null;

      const result = {
        ...data,
        worldId: pending.worldId,
      };

      globalThis.barriersSystem?.handleApplyResult?.(result);

      if (result.success === true && Number.isSafeInteger(result.revision)) {
        globalThis.sector12WorldBarriersRevision = Math.max(
          globalThis.sector12WorldBarriersRevision ?? -1,
          result.revision,
        );
      }

      globalThis.dispatchEvent(
        new CustomEvent("sector12WorldBarriersSaveResult", {
          detail: result,
        }),
      );

      console.log("[WorldBarriers] Apply result:", result);

      if (result.error === "REVISION_CONFLICT") {
        requestWorldBarriersSnapshot();
      }

      break;
    }
    case "homelessStorageStatus":
    case "homelessRentSuccess":
    case "homelessError":
      if (window.homelessSystem?.handleMessage) {
        window.homelessSystem.handleMessage(data);
      }
      break;
    case "homelessStorageUpdate":
      // Обновляем глобальный инвентарь игрока (как у Джека, торговли, использования предметов)
      if (data.inventory) {
        inventory = data.inventory.map((slot) => (slot ? { ...slot } : null));
        const me = players.get(myId);
        if (me) {
          me.inventory = [...inventory]; // синхронизируем с объектом игрока
        }
        if (window.inventorySystem?.updateInventoryDisplay) {
          window.inventorySystem.updateInventoryDisplay();
        } else if (typeof updateInventoryDisplay === "function") {
          updateInventoryDisplay();
        }
        updateStatsDisplay(); // на всякий случай, если статы могли измениться
      }

      // Также обновляем интерфейс склада, если он открыт
      if (window.homelessSystem?.handleMessage) {
        window.homelessSystem.handleMessage(data);
      }
      break;
    case "danielStorageStatus":
    case "danielRentSuccess":
    case "danielError":
    case "danielInventoryFull":
      if (window.danielNpc?.handleMessage) {
        window.danielNpc.handleMessage(data);
      }
      break;
    case "danielStorageUpdate":
      if (data.inventory) {
        inventory = data.inventory.map((slot) => (slot ? { ...slot } : null));
        const me = players.get(myId);
        if (me) {
          me.inventory = [...inventory];
        }
        if (window.inventorySystem?.updateInventoryDisplay) {
          window.inventorySystem.updateInventoryDisplay();
        } else if (typeof updateInventoryDisplay === "function") {
          updateInventoryDisplay();
        }
        updateStatsDisplay();
      }
      if (window.danielNpc?.handleMessage) {
        window.danielNpc.handleMessage(data);
      }
      break;
    case "upgradeSkillResult":
      if (data.success) {
        // Обновляем локальные данные навыков
        window.skillsSystem.playerSkills = data.playerSkills || [];
        window.skillsSystem.skillPoints = data.remainingPoints;

        const me = players.get(myId);
        if (me) {
          me.speedBonus = data.speedBonus || 0;
        }

        if (data.implantCooldownReduction !== undefined) {
          const me = players.get(myId);
          if (me) me.implantCooldownReduction = data.implantCooldownReduction;
        }

        window.skillsSystem.updateSkillsDisplay();
        window.skillsSystem.updateSkillPointsDisplay();

        if (window.skillsSystem.isSkillsOpen) {
          window.skillsSystem.updateSkillsDisplay();
          window.skillsSystem.updateSkillPointsDisplay();
        }

        // === ОСНОВНОЕ ИСПРАВЛЕНИЕ: обновляем отображение урона ===
        if (
          window.skillsSystem &&
          typeof window.skillsSystem.updateDamageDisplayIfNeeded === "function"
        ) {
          window.skillsSystem.updateDamageDisplayIfNeeded();
        } else if (window.equipmentSystem?.updateDamageDisplay) {
          window.equipmentSystem.updateDamageDisplay();
        }

        // Если открыто окно Торемидоса — обновляем
        const toremidosDesc = document.getElementById(
          "toremidos-skills-description",
        );
        if (toremidosDesc) {
          const activeSlot = document.querySelector(
            "#toremidos-skills-grid .skill-slot.active",
          );
          if (activeSlot) {
            const index = Number(activeSlot.dataset.index);
            const template = window.skillsSystem.skillTemplates[index];
            const playerSkill = window.skillsSystem.playerSkills.find(
              (s) => s.id === template?.id,
            );

            if (template) {
              toremidosDesc.innerHTML = `
                  <h3>${template.name} (ур. ${playerSkill?.level || 0}/${template.maxLevel})</h3>
                  <p>${template.description}</p>
                  <p style="margin-top:12px; color:#00ffcc;">
                    Доступно очков: <strong>${window.skillsSystem.skillPoints}</strong>
                  </p>
                  <button id="toremidos-upgrade-btn" 
                          class="toremidos-neon-btn upgrade-skill-btn" 
                          ${window.skillsSystem.skillPoints > 0 && (playerSkill?.level || 0) < template.maxLevel ? "" : "disabled"}>
                    Улучшить (1 очко)
                  </button>
                `;

              const upgradeBtn = document.getElementById(
                "toremidos-upgrade-btn",
              );
              if (
                upgradeBtn &&
                window.skillsSystem.skillPoints > 0 &&
                (playerSkill?.level || 0) < template.maxLevel
              ) {
                upgradeBtn.onclick = () => {
                  if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(
                      JSON.stringify({
                        type: "upgradeSkill",
                        skillId: template.id,
                      }),
                    );
                  }
                };
              }
            }
          }
        }

        showNotification(
          `Навык улучшен! Осталось очков: ${data.remainingPoints}`,
          "#00ff88",
        );

        // Регенерация
        if (data.skillId === 2) {
          const me = players.get(myId);
          if (me) me.skills = data.playerSkills || me.skills || [];
          window.regenerationSystem.start();
          setTimeout(() => window.regenerationSystem.start(), 150);
          window.dispatchEvent(new CustomEvent("regenerationCheck"));
        }

        // Дополнительно для Сильного удара
        if (data.skillId === 1 && window.equipmentSystem?.updateDamageDisplay) {
          window.equipmentSystem.updateDamageDisplay();
        }
      } else {
        showNotification(data.error || "Не удалось улучшить навык", "#ff4444");
      }
      break;
    case "regenerationSkillUnlocked":
      {
        window.skillsSystem.playerSkills =
          data.playerSkills || window.skillsSystem.playerSkills;

        const me = players.get(myId);
        if (me) {
          me.skills = data.playerSkills || me.skills;
        }

        window.regenerationSystem.start();
        showNotification("Регенерация активирована!", "#00ff88");
      }
      break;
    case "regenerationApplied":
      if (data.playerId === myId) {
        const me = players.get(myId);
        if (
          me &&
          typeof data.newHealth === "number" &&
          !isNaN(data.newHealth)
        ) {
          me.health = Math.min(
            Math.max(0, Number(data.newHealth)),
            me.maxStats?.health || 100,
          );
          updateStatsDisplay();
        }
      }
      break;
    case "regenerationRejected":
      if (data.playerId === myId) {
        console.warn("Регенерация отклонена сервером:", data.reason);
      }
      break;
    case "anomalySpawned":
      if (data.zone && data.zone.worldId === currentWorldId) {
        activeAnomaly = data.zone;
        showNotification("АНОМАЛЬНАЯ зона (диаметр 1000м)!", "#ff3300");
      }
      break;

    case "anomalyEnded":
      if (data.worldId === currentWorldId) {
        activeAnomaly = null;
        window.isInAnomaly = false;
        showNotification("Аномалия прекратилась...", "#00ff88");
      }
      break;
    case "criticalHitNotification":
      if (data.message) {
        // Используем существующий showNotification из notifications.js
        showNotification(data.message, "#ff0000"); // ярко-оранжевый/золотой цвет
      }
      break;
    case "dodgeNotification":
      if (data.message) {
        showNotification(data.message, data.color || "#ffaa00");
      }
      break;
    case "newItem":
      // Поддержка как одиночного предмета (старый формат), так и массива (новый формат от сервера)
      const itemsToAdd = Array.isArray(data.items) ? data.items : [data];

      itemsToAdd.forEach((itemData) => {
        if (!itemData || !itemData.itemId) return;

        const newItem = {
          x: itemData.x,
          y: itemData.y,
          type: itemData.type,
          quantity: itemData.quantity || 1,
          spawnTime: itemData.spawnTime,
          worldId: itemData.worldId || 0,
          // Для квестовых предметов сохраняем ownerId (чтобы потом можно было фильтровать)
          ownerId: itemData.ownerId,
          questOwnerId: itemData.questOwnerId || itemData.ownerId,
          isQuestItem: itemData.isQuestItem || false,
        };

        items.set(itemData.itemId, newItem);

        // Дополнительно: если это potion_book — можно сразу показать уведомление
        if (itemData.type === "potion_book") {
          showNotification(
            "Найди книгу Алхимика в пределах города!",
            "#ffdd00",
          );
        }
      });
      break;
  }
}

async function handleGameMessageLogic(data, context = gameContext) {
  if (handleWorldBuildingMessage(data)) {
    return;
  }
  const mappedHandler = gameMessageHandlers[data.type];
  if (mappedHandler) {
    await mappedHandler(data, context);
    return;
  }
  await handleGameMessageLegacySwitch(data, context);
}

async function processMessageQueue(context = gameContext) {
  if (context.isProcessingMessages) return;
  context.isProcessingMessages = true;

  while (context.messageQueue.length > 0) {
    const data = context.messageQueue.shift();

    try {
      await handleGameMessageLogic(data, context);
    } catch (err) {
      console.error(
        "Критическая ошибка при обработке сообщения из очереди:",
        err,
        data,
      );
    }
  }

  context.isProcessingMessages = false;
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight; // 100% высоты
  const me = players.get(myId);
  if (me) {
    window.movementSystem.update(0); // Обновляем камеру
  }
}

function update(deltaTime) {
  // Глобальная анимация атома — одна на всю игру
  gameContext.atomFrameTime += deltaTime;
  while (gameContext.atomFrameTime >= ATOM_FRAME_DURATION) {
    gameContext.atomFrameTime -= ATOM_FRAME_DURATION;
    gameContext.atomFrame = (gameContext.atomFrame + 1) % ATOM_FRAMES;
  }
  // Синхронизируем с глобальным пространством имён, чтобы старые модули
  // (inventory.js и прочие) могли читать `window.atomFrame`.
  if (typeof window !== "undefined") window.atomFrame = gameContext.atomFrame;

  const me = players.get(myId);
  if (!me) return;

  if (me && typeof me.speedBonus === "number") {
    window.movementSystem.speedBonus = me.speedBonus;
  }

  const currentWorldId = window.worldSystem.currentWorldId;
  const camera = window.movementSystem.getCamera();

  // === Интерполяция и анимация других игроков ===
  players.forEach((player, id) => {
    if (id === myId || player.worldId !== currentWorldId) return;

    const lerpFactor = 0.15;

    // Позиция
    if (player.targetX !== undefined) {
      player.x += (player.targetX - player.x) * lerpFactor;
      player.y += (player.targetY - player.y) * lerpFactor;
    }

    // Состояние и направление — сразу с сервера
    player.direction = player.targetDirection ?? player.direction;
    player.state = player.targetState ?? player.state;

    // === ИНИЦИАЛИЗАЦИЯ НЕДОСТАЮЩИХ ПОЛЕЙ ДЛЯ АНИМАЦИИ (критично для симметрии) ===
    if (player.animTime === undefined) player.animTime = 0;
    if (player.frameTime === undefined) player.frameTime = 0;
    if (player.attackFrameTime === undefined) player.attackFrameTime = 0;
    if (player.attackFrame === undefined) player.attackFrame = 0;
    if (player.prevState === undefined) player.prevState = player.state;

    // === ОТСЛЕЖИВАНИЕ ПЕРЕХОДА В АТАКУ ===
    if (player.state === "attacking" && player.prevState !== "attacking") {
      player.attackFrame = 0; // ← обязательно сбрасываем при старте атаки
      player.attackFrameTime = 0;
      player.animTime = 0;
      player.frame = 0;
    }

    // Обновляем prevState
    player.prevState = player.state;

    // === АНИМАЦИЯ АТАКИ (локальная) ===
    if (player.state === "attacking") {
      player.attackFrameTime += deltaTime;

      const ATTACK_FRAME_DURATION = 500 / ATTACK_FRAME_COUNT;

      while (player.attackFrameTime >= ATTACK_FRAME_DURATION) {
        player.attackFrameTime -= ATTACK_FRAME_DURATION;
        player.attackFrame += 1;

        if (player.attackFrame >= ATTACK_FRAME_COUNT) {
          player.attackFrame = 0;
          player.attackFrameTime = 0;

          const isMoving =
            player.targetX !== undefined &&
            (Math.abs(player.targetX - player.x) > 3 ||
              Math.abs(player.targetY - player.y) > 3);

          player.state = isMoving ? "walking" : "idle";
          player.animTime = 0;
          player.frame = 0;
        }
      }
    } else {
      // Не атакует — сбрасываем атаку
      player.attackFrame = 0;
      player.attackFrameTime = 0;
    }

    // === ЛОКАЛЬНАЯ АНИМАЦИЯ ХОДЬБЫ ===
    if (player.state === "walking") {
      player.animTime = (player.animTime || 0) + deltaTime;
      const frameDuration = 80;
      player.frame =
        Math.floor(player.animTime / frameDuration) % WALK_FRAME_COUNT;
    } else if (player.state !== "attacking") {
      player.frame = 0;
      player.animTime = 0;
    }
  });

  // Применяем эффекты экипировки один раз при логине
  if (
    window.equipmentSystem &&
    me.equipment &&
    !window.equipmentSystem.lastApplied
  ) {
    window.equipmentSystem.syncEquipment(me.equipment);
    window.equipmentSystem.lastApplied = true;
    updateStatsDisplay();
  }

  if (gameContext.projectiles) {
    gameContext.projectiles = gameContext.projectiles.filter((p) => {
      if (p.type !== "fireball" && p.type !== "violent_tornado") return true;

      const deltaFactor = deltaTime / 16.67;

      if (p.type === "violent_tornado") {
        const waveOffset =
          Math.sin((p.traveled || 0) * (p.waveFreq || 0.025)) *
          (p.waveAmplitude || 40);
        p.x += (p.baseVx || p.vx) * deltaFactor;
        p.y += (p.baseVy || p.vy) * deltaFactor;
        p.x += (p.perpX || 0) * (waveOffset - (p.lastWaveOffset || 0));
        p.y += (p.perpY || 0) * (waveOffset - (p.lastWaveOffset || 0));
        p.lastWaveOffset = waveOffset;
      } else {
        p.x += p.vx * deltaFactor;
        p.y += p.vy * deltaFactor;
      }

      p.traveled =
        (p.traveled || 0) +
        Math.hypot(p.baseVx || p.vx, p.baseVy || p.vy) * deltaFactor;

      return p.traveled < (p.maxDistance || 300);
    });
  }

  cleanupExpiredImplantEffects();

  window.movementSystem.update(deltaTime);

  // Обновление систем
  window.combatSystem.update(deltaTime);
  window.enemySystem.update(deltaTime);

  if (window.neonNpcSystem) window.neonNpcSystem.update(deltaTime);
  if (window.guardNpcSystem) window.guardNpcSystem.update(deltaTime);
  if (window.potionNpcSystem) window.potionNpcSystem.update(deltaTime);
  if (window.vacuumRobotSystem) window.vacuumRobotSystem.update(deltaTime);
  window.cockroachSystem.update(deltaTime);
  window.droneSystem.update(deltaTime);
  window.bonfireSystem.update(deltaTime);
  clockSystem.update(deltaTime);
  if (window.corporateRobotSystem)
    window.corporateRobotSystem.update(deltaTime);
  if (window.robotDoctorSystem) window.robotDoctorSystem.update(deltaTime);
  if (window.outpostCaptainSystem)
    window.outpostCaptainSystem.update(deltaTime);
  window.thimbleriggerSystem.checkThimbleriggerProximity();
  window.torestosSystem.checkTorestosProximity();
  if (window.cristinaNpc) {
    window.cristinaNpc.update(deltaTime);
    window.cristinaNpc.checkProximity();
  }
  if (window.linaNpc) {
    window.linaNpc.update(deltaTime);
    window.linaNpc.checkProximity();
  }
  if (window.viktorNpc) {
    window.viktorNpc.update(deltaTime);
    window.viktorNpc.checkProximity();
  }
  if (window.danielNpc) {
    window.danielNpc.update(deltaTime);
    window.danielNpc.checkProximity();
  }
  if (window.warmanNpc) {
    window.warmanNpc.update(deltaTime);
    window.warmanNpc.checkProximity();
  }
  if (window.madDoctorSystem) {
    window.madDoctorSystem.update(deltaTime);
  }
  if (window.yuriSystem) {
    window.yuriSystem.update(deltaTime);
  }
  window.vendingMachine?.checkProximity?.();
  window.toremidosSystem?.checkProximity?.();
  window.toremidosSystem?.update?.(deltaTime);
  window.homelessSystem?.checkProximity?.();
  window.homelessSystem?.update?.(deltaTime);
  window.misterTwister.checkProximity();
  if (window.trashCansSystem) {
    window.trashCansSystem.update(deltaTime);
  }
  if (window.cristinaNpc) window.cristinaNpc.update(deltaTime);
  window.portalSystem?.checkProximity?.();
  if (
    currentWorldId === 0 &&
    typeof window.portalSystem?.updateAnimation === "function"
  ) {
    window.portalSystem.updateAnimation(deltaTime);
  }
  window.worldSystem.checkTransitionZones(me.x, me.y);
}

function draw2D(deltaTime) {
  const zoom = window.movementSystem?.getZoom?.() || 1;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(10, 20, 40, 0.8)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.scale(zoom, zoom);

  try {
    drawWorld(deltaTime, zoom);
  } finally {
    ctx.restore();
  }
}

function draw(deltaTime) {
  if (window.rendererSystem?.render) {
    window.rendererSystem.render(deltaTime, draw2D);
    return;
  }

  draw2D(deltaTime);
}

function configureGameLoop() {
  const gameLoopSystem = window.gameLoopSystem;

  if (!gameLoopSystem) {
    console.error(
      "[Game] gameLoopSystem is not loaded. Game loop cannot start.",
    );
    return false;
  }

  return gameLoopSystem.configure({
    update,
    render: draw,
    targetFps: 60,
    profilerProvider: () => window.editorPerformance3D ?? null,
  });
}

function drawWorld(deltaTime, zoom) {
  const currentWorld = window.worldSystem.getCurrentWorld();
  const currentWorldId = window.worldSystem.currentWorldId;
  const cameraX = window.movementSystem.getCamera().x;
  const cameraY = window.movementSystem.getCamera().y;

  // === ТАЙЛОВЫЙ СЛОЙ BG ===
  if (window.worldSystem.bgTiles[currentWorldId]) {
    window.worldSystem.drawBgTiles(cameraX, cameraY);
  } else {
    // На всякий случай, если тайлы ещё не загрузились
    ctx.fillStyle = "rgba(10, 20, 40, 1)";
    ctx.fillRect(0, 0, canvas.width / zoom, canvas.height / zoom);
  }

  // Предметы — оптимизированная отрисовка
  const viewWidth = canvas.width / zoom + 100;
  const viewHeight = canvas.height / zoom + 100;

  items.forEach((item) => {
    if (item.worldId !== currentWorldId) return;

    const screenX = item.x - cameraX;
    const screenY = item.y - cameraY;

    if (
      screenX < -60 ||
      screenX > viewWidth ||
      screenY < -60 ||
      screenY > viewHeight
    )
      return;

    const config = ITEM_CONFIG[item.type];
    if (!config?.image?.complete) {
      ctx.fillStyle = "yellow";
      ctx.fillRect(screenX, screenY, 20, 20);
      return;
    }

    if (item.type === "atom") {
      ctx.drawImage(
        config.image,
        gameContext.atomFrame * 50,
        0,
        50,
        50,
        screenX,
        screenY,
        50,
        50,
      );
    } else {
      ctx.drawImage(config.image, screenX, screenY, 20, 20);
    }
  });

  updatePickupHints(cameraX, cameraY, currentWorldId);

  if (window.cockroachSystem) {
    window.cockroachSystem.draw();
  }

  // === ТАЙЛОВЫЙ СЛОЙ ROCKS ===
  if (window.worldSystem.rocksTiles[currentWorldId]) {
    window.worldSystem.drawRocksTiles(cameraX, cameraY);
  }

  // === ТАЙЛОВЫЙ СЛОЙ VEGETATION (здания) ===
  if (window.worldSystem.vegetationTiles[currentWorldId]) {
    window.worldSystem.drawVegetationTiles(cameraX, cameraY);
  }

  window.misterTwister.draw();
  window.combatSystem.draw();

  // Highlight selected enemy for local player
  if (window.selectedEnemyId && window.enemies) {
    const e = window.enemies.get(window.selectedEnemyId);
    if (e && e.worldId === currentWorldId) {
      const ex = e.x - cameraX;
      const ey = e.y - cameraY;

      // === ПУЛЬСИРУЮЩАЯ ПРЕРЫВИСТАЯ ЛИНИЯ (единственный highlight) ===
      const pulsePhase = Math.sin(Date.now() / 360) * 0.25;
      const pulseRadius = 43 + pulsePhase * 8;

      ctx.strokeStyle = "rgba(255, 50, 50, 0.85)";
      ctx.lineWidth = 2.8;
      ctx.setLineDash([8, 4]);

      ctx.beginPath();
      ctx.arc(ex + 35, ey + 25, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.setLineDash([]);
    }
  }

  const depthList = [];

  const PLAYER_DRAW_HEIGHT = 80;
  const ROBOT_BOTTOM_OFFSET = 45;
  const NEON_BOTTOM_OFFSET = 60;
  const POTION_BOTTOM_OFFSET = 65;
  const TORESTOS_BOTTOM_OFFSET = 80;
  const LINA_BOTTOM_OFFSET = 80;
  const JACK_BOTTOM_OFFSET = 90;
  const CAPTAIN_BOTTOM_OFFSET = 50;
  const JOHN_BOTTOM_OFFSET = 90;
  const WARMAN_BOTTOM_OFFSET = 90;
  const GUARD_BOTTOM_OFFSET = 60;
  const PORTAL_BOTTOM_OFFSET = 200;
  const BONFIRE_BOTTOM_OFFSET = 70;
  const TOREMIDOS_BOTTOM_OFFSET = 90;
  const VENDING_BOTTOM_OFFSET = 90;
  const HOMELESS_BOTTOM_OFFSET = 40;
  const ROBOT_DOCTOR_BOTTOM_OFFSET = 80;
  const ENEMY_BOTTOM_OFFSET = 50;
  const TRASH_BOTTOM_OFFSET = 25;
  const CRISTINA_BOTTOM_OFFSET = 93;
  const THIMBLERIGGER_BOTTOM_OFFSET = 80;
  const VIKTOR_BOTTOM_OFFSET = 80;
  const DANIEL_BOTTOM_OFFSET = 80;
  const VACUUM_BOTTOM_OFFSET = 70;
  const YURI_BOTTOM_OFFSET = 90;

  if (
    currentWorldId === 0 &&
    window.torestosSystem &&
    typeof window.torestosSystem.updateAnimation === "function"
  ) {
    window.torestosSystem.updateAnimation(deltaTime);
  }

  if (
    currentWorldId === 0 &&
    window.jackSystem &&
    typeof window.jackSystem.updateAnimation === "function"
  ) {
    window.jackSystem.updateAnimation(deltaTime);
  }

  if (
    currentWorldId === 0 &&
    window.outpostCaptainSystem &&
    typeof window.outpostCaptainSystem.update === "function"
  ) {
    window.outpostCaptainSystem.update(deltaTime);
  }

  if (
    currentWorldId === 0 &&
    window.npcSystem &&
    typeof window.npcSystem.updateAnimation === "function"
  ) {
    window.npcSystem.updateAnimation(deltaTime);
  }

  players.forEach((player) => {
    if (player.worldId !== currentWorldId) return;
    depthList.push({
      y: player.y + PLAYER_DRAW_HEIGHT,
      type: "player",
      player: player,
    });
  });

  if (
    currentWorldId === 0 &&
    window.corporateRobotSystem &&
    typeof window.corporateRobotSystem.getPosition === "function"
  ) {
    const pos = window.corporateRobotSystem.getPosition();
    depthList.push({
      y: pos.y + ROBOT_BOTTOM_OFFSET,
      type: "corporateRobot",
    });
  }

  if (
    currentWorldId === 0 &&
    window.neonNpcSystem &&
    typeof window.neonNpcSystem.getPosition === "function"
  ) {
    const pos = window.neonNpcSystem.getPosition();
    depthList.push({
      y: pos.y + NEON_BOTTOM_OFFSET,
      type: "neonNpc",
    });
  }

  if (
    currentWorldId === 0 &&
    window.potionNpcSystem &&
    typeof window.potionNpcSystem.getPosition === "function"
  ) {
    const pos = window.potionNpcSystem.getPosition();
    depthList.push({
      y: pos.y + POTION_BOTTOM_OFFSET,
      type: "potionNpc",
    });
  }

  if (
    currentWorldId === 0 &&
    window.torestosSystem &&
    typeof window.torestosSystem.getPosition === "function"
  ) {
    const pos = window.torestosSystem.getPosition();
    depthList.push({
      y: pos.y + TORESTOS_BOTTOM_OFFSET,
      type: "torestos",
    });
  }

  if (
    currentWorldId === 0 &&
    window.linaNpc &&
    typeof window.linaNpc.getPosition === "function"
  ) {
    const pos = window.linaNpc.getPosition();
    depthList.push({
      y: pos.y + LINA_BOTTOM_OFFSET,
      type: "lina",
    });
  }

  if (
    currentWorldId === 0 &&
    window.jackSystem &&
    typeof window.jackSystem.getPosition === "function"
  ) {
    const pos = window.jackSystem.getPosition();
    depthList.push({
      y: pos.y + JACK_BOTTOM_OFFSET,
      type: "jack",
    });
  }

  if (
    currentWorldId === 0 &&
    window.outpostCaptainSystem &&
    typeof window.outpostCaptainSystem.getPosition === "function"
  ) {
    const pos = window.outpostCaptainSystem.getPosition();
    depthList.push({
      y: pos.y + CAPTAIN_BOTTOM_OFFSET,
      type: "captain",
    });
  }

  if (
    currentWorldId === 0 &&
    window.npcSystem &&
    typeof window.npcSystem.getPosition === "function"
  ) {
    const pos = window.npcSystem.getPosition();
    depthList.push({
      y: pos.y + JOHN_BOTTOM_OFFSET,
      type: "john",
    });
  }

  if (
    currentWorldId === 0 &&
    window.warmanNpc &&
    typeof window.warmanNpc.getPosition === "function"
  ) {
    const pos = window.warmanNpc.getPosition();
    depthList.push({
      y: pos.y + WARMAN_BOTTOM_OFFSET,
      type: "warman",
    });
  }

  if (
    currentWorldId === 0 &&
    window.guardNpcSystem &&
    typeof window.guardNpcSystem.getPosition === "function"
  ) {
    const pos = window.guardNpcSystem.getPosition();
    depthList.push({
      y: pos.y + GUARD_BOTTOM_OFFSET,
      type: "guard",
    });
  }

  if (
    currentWorldId === 0 &&
    window.portalSystem &&
    typeof window.portalSystem.getPosition === "function"
  ) {
    const pos = window.portalSystem.getPosition();
    depthList.push({
      y: pos.y + PORTAL_BOTTOM_OFFSET,
      type: "portal",
    });
  }

  if (
    currentWorldId === 0 &&
    window.bonfireSystem &&
    typeof window.bonfireSystem.getBonfires === "function"
  ) {
    const bonfires = window.bonfireSystem.getBonfires();
    for (let i = 0; i < bonfires.length; i++) {
      const b = bonfires[i];
      depthList.push({
        y: b.y + BONFIRE_BOTTOM_OFFSET,
        type: "bonfire",
        index: i,
      });
    }
  }

  if (
    currentWorldId === 0 &&
    window.toremidosSystem &&
    typeof window.toremidosSystem.getPosition === "function"
  ) {
    const pos = window.toremidosSystem.getPosition();
    depthList.push({
      y: pos.y + TOREMIDOS_BOTTOM_OFFSET,
      type: "toremidos",
    });
  }

  if (
    currentWorldId === 0 &&
    window.vendingMachine &&
    typeof window.vendingMachine.getPosition === "function"
  ) {
    const pos = window.vendingMachine.getPosition();
    depthList.push({
      y: pos.y + VENDING_BOTTOM_OFFSET,
      type: "vending",
    });
  }

  if (
    currentWorldId === 0 &&
    window.homelessSystem &&
    typeof window.homelessSystem.getPosition === "function"
  ) {
    const pos = window.homelessSystem.getPosition();
    depthList.push({
      y: pos.y + HOMELESS_BOTTOM_OFFSET,
      type: "homeless",
    });
  }

  if (
    currentWorldId === 0 &&
    window.robotDoctorSystem &&
    typeof window.robotDoctorSystem.getPosition === "function"
  ) {
    const pos = window.robotDoctorSystem.getPosition();
    depthList.push({
      y: pos.y + ROBOT_DOCTOR_BOTTOM_OFFSET,
      type: "robotDoctor",
    });
  }

  if (
    window.enemySystem &&
    typeof window.enemySystem.getEnemies === "function"
  ) {
    const enemiesMap = window.enemySystem.getEnemies();
    for (const enemy of enemiesMap.values()) {
      if (enemy.worldId !== currentWorldId || enemy.health <= 0) continue;
      depthList.push({
        y: enemy.y + ENEMY_BOTTOM_OFFSET,
        type: "enemy",
        enemy: enemy,
      });
    }
  }

  if (
    currentWorldId === 0 &&
    window.trashCansSystem &&
    typeof window.trashCansSystem.getTrashPositions === "function"
  ) {
    const positions = window.trashCansSystem.getTrashPositions();
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      depthList.push({
        y: pos.y + TRASH_BOTTOM_OFFSET,
        type: "trash",
        index: i,
      });
    }
  }

  if (
    currentWorldId === 0 &&
    window.cristinaNpc &&
    typeof window.cristinaNpc.getPosition === "function"
  ) {
    const pos = window.cristinaNpc.getPosition();
    depthList.push({
      y: pos.y + CRISTINA_BOTTOM_OFFSET,
      type: "cristina",
    });
  }

  if (
    currentWorldId === 0 &&
    window.thimbleriggerSystem &&
    typeof window.thimbleriggerSystem.getPosition === "function"
  ) {
    const pos = window.thimbleriggerSystem.getPosition();
    depthList.push({
      y: pos.y + THIMBLERIGGER_BOTTOM_OFFSET,
      type: "thimblerigger",
    });
  }

  if (
    currentWorldId === 0 &&
    window.viktorNpc &&
    typeof window.viktorNpc.getPosition === "function"
  ) {
    const pos = window.viktorNpc.getPosition();
    depthList.push({
      y: pos.y + VIKTOR_BOTTOM_OFFSET,
      type: "viktor",
    });
  }

  if (
    currentWorldId === 0 &&
    window.danielNpc &&
    typeof window.danielNpc.getPosition === "function"
  ) {
    const pos = window.danielNpc.getPosition();
    depthList.push({
      y: pos.y + DANIEL_BOTTOM_OFFSET,
      type: "daniel",
    });
  }

  if (
    currentWorldId === 0 &&
    window.vacuumRobotSystem &&
    typeof window.vacuumRobotSystem.getPosition === "function"
  ) {
    const pos = window.vacuumRobotSystem.getPosition();
    depthList.push({
      y: pos.y + VACUUM_BOTTOM_OFFSET,
      type: "vacuum",
    });
  }

  if (
    currentWorldId === 0 &&
    window.madDoctorSystem &&
    typeof window.madDoctorSystem.getPosition === "function"
  ) {
    const pos = window.madDoctorSystem.getPosition();
    depthList.push({
      y: pos.y + 70, // MAD_DOCTOR_BOTTOM_OFFSET
      type: "madDoctor",
    });
  }

  if (
    currentWorldId === 0 &&
    window.yuriSystem &&
    typeof window.yuriSystem.getPosition === "function"
  ) {
    const pos = window.yuriSystem.getPosition();
    depthList.push({
      y: pos.y + YURI_BOTTOM_OFFSET,
      type: "yuri",
    });
  }

  depthList.sort((a, b) => a.y - b.y);

  // Отрисовываем в отсортированном порядке
  for (const item of depthList) {
    if (item.type === "player") {
      const player = item.player;
      const screenX = player.x - cameraX;
      const screenY = player.y - cameraY;

      if (
        screenX < -80 ||
        screenX > viewWidth ||
        screenY < -80 ||
        screenY > viewHeight
      ) {
        continue;
      }

      let effectiveState = player.state;

      // Мёртвого игрока не оставляем визуально в walking/attacking.
      if (player.health <= 0) {
        effectiveState = "idle";
      }

      if (effectiveState === "attacking") {
        // ==========================================================
        // ATTACK
        // playerAttackSprite.png:
        // 13 кадров × 8 направлений.
        // Каждый кадр 120x120.
        // ==========================================================

        const attackFrame = Math.max(
          0,
          Math.min(
            Number.isFinite(player.attackFrame)
              ? Math.floor(player.attackFrame)
              : 0,
            ATTACK_FRAME_COUNT - 1,
          ),
        );

        const spriteX = attackFrame * ATTACK_FRAME_WIDTH;

        // Используем настоящее 8-направленное направление игрока.
        // Никаких приближений up/down/right/left больше нет.
        const direction = Object.prototype.hasOwnProperty.call(
          ATTACK_SPRITE_ROWS,
          player.direction,
        )
          ? player.direction
          : "down";

        const spriteY = ATTACK_SPRITE_ROWS[direction];

        if (
          images.playerAttackSprite?.complete &&
          images.playerAttackSprite.naturalWidth > 0
        ) {
          const attackRenderX =
            screenX -
            (ATTACK_FRAME_WIDTH - PLAYER_VISUAL_2D.sprite2D.referenceSize) / 2;

          const attackRenderY =
            screenY -
            (ATTACK_FRAME_HEIGHT - PLAYER_VISUAL_2D.sprite2D.referenceSize);

          ctx.drawImage(
            images.playerAttackSprite,
            spriteX,
            spriteY,
            ATTACK_FRAME_WIDTH,
            ATTACK_FRAME_HEIGHT,
            attackRenderX,
            attackRenderY,
            ATTACK_FRAME_WIDTH,
            ATTACK_FRAME_HEIGHT -
              PLAYER_VISUAL_2D.sprite2D.attack.drawHeightReduction,
          );
        } else {
          ctx.fillStyle = "blue";
          ctx.fillRect(screenX, screenY, 70, 70);
        }
      } else {
        // ==========================================================
        // WALK / IDLE
        // Новый playerWalkingSprite.png:
        // 16 кадров × 8 направлений, 90x90.
        // ==========================================================

        const rawWalkFrame =
          effectiveState === "walking" && Number.isFinite(player.frame)
            ? Math.floor(player.frame)
            : 0;

        // Защита от старого/битого frame:
        // всегда получаем диапазон 0..15.
        const walkFrame =
          ((rawWalkFrame % WALK_FRAME_COUNT) + WALK_FRAME_COUNT) %
          WALK_FRAME_COUNT;

        const spriteX = walkFrame * WALK_FRAME_WIDTH;

        // Сервер и movementSystem работают с теми же строковыми
        // направлениями, поэтому здесь нет приближений диагоналей.
        const direction = Object.prototype.hasOwnProperty.call(
          WALK_SPRITE_ROWS,
          player.direction,
        )
          ? player.direction
          : "down";

        const spriteY = WALK_SPRITE_ROWS[direction];

        if (
          images.playerWalkingSprite?.complete &&
          images.playerWalkingSprite.naturalWidth > 0
        ) {
          const walkRenderX =
            screenX -
            (WALK_FRAME_WIDTH - PLAYER_VISUAL_2D.sprite2D.referenceSize) / 2;

          const walkRenderY =
            screenY -
            (WALK_FRAME_HEIGHT - PLAYER_VISUAL_2D.sprite2D.referenceSize);

          ctx.drawImage(
            images.playerWalkingSprite,
            spriteX,
            spriteY,
            WALK_FRAME_WIDTH,
            WALK_FRAME_HEIGHT,
            walkRenderX,
            walkRenderY,
            WALK_FRAME_WIDTH,
            WALK_FRAME_HEIGHT -
              PLAYER_VISUAL_2D.sprite2D.walking.drawHeightReduction,
          );
        } else {
          ctx.fillStyle = "blue";
          ctx.fillRect(screenX, screenY, 70, 70);
        }
      }

      // ─── Имя и здоровье ───
      const nameY = screenY - 45;
      const healthY = screenY - 25;

      ctx.font = "20px 'Courier New', monospace";
      ctx.textAlign = "center";

      ctx.strokeStyle = "black";
      ctx.lineWidth = 4;
      ctx.strokeText(player.id, screenX + 35, nameY);
      ctx.fillStyle = "#00ffff";
      ctx.shadowColor = "#00ffff";
      ctx.shadowBlur = 10;
      ctx.fillText(player.id, screenX + 35, nameY);

      const healthText = `${Math.floor(player.health ?? 0)} / ${
        player.maxStats?.health ?? 100
      }`;
      ctx.font = "bold 15px 'Courier New', monospace";
      ctx.strokeStyle = "black";
      ctx.lineWidth = 4;
      ctx.strokeText(healthText, screenX + 35, healthY);
      ctx.fillStyle = "#ff0066";
      ctx.shadowColor = "#ff0066";
      ctx.shadowBlur = 10;
      ctx.fillText(healthText, screenX + 35, healthY);

      // ─── Баббл чата ───
      if (player.chatBubble) {
        const now = Date.now();
        if (now - player.chatBubble.time <= CHAT_BUBBLE_LIFETIME) {
          const fullText = player.chatBubble.text + "...";
          const bubbleY = screenY + CHAT_BUBBLE_OFFSET_Y;

          ctx.font = `${CHAT_BUBBLE_FONT_SIZE}px 'Courier New', monospace`;
          ctx.textAlign = "left";
          ctx.fillStyle = "white";
          ctx.strokeStyle = "rgba(0,0,0,0.8)";
          ctx.lineWidth = 3;

          const words = fullText.split(/(\s+)/);
          let currentX = screenX + 0;
          let lineY = bubbleY;

          words.forEach((part) => {
            if (part.trim() === "") {
              currentX += ctx.measureText(part).width;
            } else {
              ctx.strokeText(part, currentX, lineY);
              ctx.fillText(part, currentX, lineY);
              currentX += ctx.measureText(part).width;
            }
          });
        } else {
          player.chatBubble = null;
        }
      }

      // Highlight selected player for trade
      if (
        window.tradeSystem &&
        window.tradeSystem.selectedPlayerId === player.id
      ) {
        const now = Date.now();

        ctx.save();

        const angleOffset = (now / 280) % (Math.PI * 2);
        ctx.strokeStyle = "rgba(0, 240, 255, 0.85)";
        ctx.lineWidth = 2.8;
        ctx.shadowColor = "#00f0ff";
        ctx.shadowBlur = 18;

        ctx.beginPath();
        ctx.arc(
          screenX + 35,
          screenY + 35,
          43,
          angleOffset,
          angleOffset + Math.PI * 1.65,
        );
        ctx.stroke();

        ctx.strokeStyle = "rgba(0, 255, 200, 0.55)";
        ctx.lineWidth = 1.6;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.arc(
          screenX + 35,
          screenY + 35,
          38,
          -angleOffset * 0.7,
          -angleOffset * 0.7 + Math.PI * 1.4,
        );
        ctx.stroke();

        ctx.restore();
      }

      ctx.shadowBlur = 0;
    } else if (item.type === "corporateRobot") {
      window.corporateRobotSystem.drawSprite(cameraX, cameraY);
    } else if (item.type === "neonNpc") {
      window.neonNpcSystem.drawSprite(cameraX, cameraY);
    } else if (item.type === "potionNpc") {
      window.potionNpcSystem.drawSprite(cameraX, cameraY);
    } else if (item.type === "torestos") {
      window.torestosSystem.drawSprite(cameraX, cameraY);
    } else if (item.type === "lina") {
      window.linaNpc.drawSprite(cameraX, cameraY);
    } else if (item.type === "jack") {
      window.jackSystem.drawSprite(cameraX, cameraY);
    } else if (item.type === "captain") {
      window.outpostCaptainSystem.drawSprite(cameraX, cameraY);
    } else if (item.type === "john") {
      window.npcSystem.drawSprite(cameraX, cameraY);
    } else if (item.type === "warman") {
      window.warmanNpc.drawSprite(cameraX, cameraY);
    } else if (item.type === "guard") {
      window.guardNpcSystem.drawSprite(cameraX, cameraY);
    } else if (item.type === "portal") {
      window.portalSystem.drawSprite(cameraX, cameraY);
    } else if (item.type === "bonfire") {
      window.bonfireSystem.drawSprite(cameraX, cameraY, item.index);
    } else if (item.type === "toremidos") {
      window.toremidosSystem.drawSprite(cameraX, cameraY);
    } else if (item.type === "vending") {
      window.vendingMachine.drawSprite(cameraX, cameraY);
    } else if (item.type === "homeless") {
      window.homelessSystem.drawSprite(cameraX, cameraY);
    } else if (item.type === "robotDoctor") {
      window.robotDoctorSystem.drawSprite(cameraX, cameraY);
    } else if (item.type === "enemy") {
      window.enemySystem.drawSprite(item.enemy, cameraX, cameraY);
    } else if (item.type === "trash") {
      window.trashCansSystem.drawSprite(cameraX, cameraY, item.index);
    } else if (item.type === "cristina") {
      window.cristinaNpc.drawSprite(cameraX, cameraY);
    } else if (item.type === "thimblerigger") {
      window.thimbleriggerSystem.drawSprite(cameraX, cameraY);
    } else if (item.type === "viktor") {
      window.viktorNpc.drawSprite(cameraX, cameraY);
    } else if (item.type === "daniel") {
      window.danielNpc.drawSprite(cameraX, cameraY);
    } else if (item.type === "vacuum") {
      window.vacuumRobotSystem.drawSprite(cameraX, cameraY);
    } else if (item.type === "madDoctor") {
      window.madDoctorSystem.drawSprite(cameraX, cameraY);
    } else if (item.type === "yuri") {
      window.yuriSystem.drawSprite(cameraX, cameraY);
    }
  }

  if (gameContext.projectiles && gameContext.projectiles.length > 0) {
    const camera = window.movementSystem.getCamera();

    for (let i = gameContext.projectiles.length - 1; i >= 0; i--) {
      const p = gameContext.projectiles[i];
      if (p.type !== "fireball") continue;

      if (p.traveled >= (p.maxDistance || 300)) {
        continue;
      }

      const screenX = p.x - camera.x;
      const screenY = p.y - camera.y;

      if (
        screenX < -100 ||
        screenX > canvas.width + 100 ||
        screenY < -100 ||
        screenY > canvas.height + 100
      ) {
        continue;
      }

      if (!images.fireballSprite || !images.fireballSprite.complete) {
        ctx.fillStyle = "yellow";
        ctx.fillRect(screenX - 8, screenY - 8, 16, 16);
        continue;
      }

      const frameWidth = 32;
      const frame = Math.floor((Date.now() / 60) % 12);
      const angle = Math.atan2(p.vy || 0, p.vx || 0);

      drawRotatedSprite(
        images.fireballSprite,
        frame * frameWidth,
        0,
        frameWidth,
        32,
        screenX - 16,
        screenY - 16,
        32,
        32,
        angle,
      );
    }
  }

  // === Projectiles (fireball) ===
  if (gameContext.projectiles && gameContext.projectiles.length > 0) {
    const camera = window.movementSystem.getCamera();

    for (let i = gameContext.projectiles.length - 1; i >= 0; i--) {
      const p = gameContext.projectiles[i];
      if (p.type !== "violent_tornado") continue;

      if (p.traveled >= (p.maxDistance || 300)) {
        continue;
      }

      const screenX = p.x - camera.x;
      const screenY = p.y - camera.y;

      if (
        screenX < -150 ||
        screenX > canvas.width + 150 ||
        screenY < -150 ||
        screenY > canvas.height + 150
      ) {
        continue;
      }

      if (
        !images.violentTornadoSprite ||
        !images.violentTornadoSprite.complete
      ) {
        ctx.fillStyle = "rgba(180,180,255,0.85)";
        ctx.beginPath();
        ctx.arc(screenX, screenY, 50, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      // 1-в-1 как tornado
      const frames = 13;
      const frameDuration = 120;
      const elapsed = Date.now() - (p.spawnTime || Date.now());
      let frame = Math.floor(elapsed / frameDuration) % frames;

      const FRAME_W = 200;
      const FRAME_H = 200;
      const sx = frame * FRAME_W;
      const safeSx = Math.max(
        0,
        Math.min(sx, images.violentTornadoSprite.width - FRAME_W),
      );

      const drawW = 220;
      const drawH = 150;

      ctx.drawImage(
        images.violentTornadoSprite,
        safeSx,
        0,
        FRAME_W,
        FRAME_H,
        screenX - drawW / 2,
        screenY - drawH / 2,
        drawW,
        drawH,
      );
    }
  }

  // === Lightning strikes ===
  if (gameContext.lightningStrikes && gameContext.lightningStrikes.length > 0) {
    const camera = window.movementSystem.getCamera();

    for (let i = gameContext.lightningStrikes.length - 1; i >= 0; i--) {
      const s = gameContext.lightningStrikes[i];
      if (!s || typeof s.x !== "number" || typeof s.y !== "number") {
        gameContext.lightningStrikes.splice(i, 1);
        continue;
      }

      const screenX = s.x - camera.x;
      const screenY = s.y - camera.y;

      const frames = 13;
      const frameDuration = 120;
      const elapsed = Date.now() - (s.spawnTime || Date.now());
      const totalLifetime = frames * frameDuration + 400;

      if (elapsed > totalLifetime) {
        continue;
      }

      if (!images.lightningSprite || !images.lightningSprite.complete) {
        ctx.fillStyle = "white";
        ctx.fillRect(screenX - 32, screenY - 120, 64, 240);
        continue;
      }

      let frame = Math.floor(elapsed / frameDuration);
      if (frame >= frames) frame = frames - 1;

      const FRAME_WIDTH = 64;
      const FRAME_HEIGHT = 256;

      const sx = frame * FRAME_WIDTH;
      const safeSx = Math.max(
        0,
        Math.min(sx, images.lightningSprite.width - FRAME_WIDTH),
      );

      const drawW = 92;
      const drawH = 265;

      ctx.drawImage(
        images.lightningSprite,
        safeSx,
        0,
        FRAME_WIDTH,
        FRAME_HEIGHT,
        screenX - drawW / 2,
        screenY - drawH / 2 - 95,
        drawW,
        drawH,
      );
    }
  }

  // === Tornado strikes ===
  if (gameContext.tornadoStrikes && gameContext.tornadoStrikes.length > 0) {
    const camera = window.movementSystem.getCamera();

    for (let i = gameContext.tornadoStrikes.length - 1; i >= 0; i--) {
      const s = gameContext.tornadoStrikes[i];
      if (!s || typeof s.x !== "number" || typeof s.y !== "number") {
        gameContext.tornadoStrikes.splice(i, 1);
        continue;
      }

      const screenX = s.x - camera.x;
      const screenY = s.y - camera.y;

      const frames = 13;
      const frameDuration = s.frameDuration || 120;
      const elapsed = Date.now() - (s.spawnTime || Date.now());
      const totalLifetime = frames * frameDuration + 300;

      if (elapsed > totalLifetime) {
        continue;
      }

      if (!images.tornadoSprite || !images.tornadoSprite.complete) {
        ctx.fillStyle = "rgba(200,200,255,0.9)";
        ctx.beginPath();
        ctx.arc(screenX, screenY, 50, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      let frame = Math.floor(elapsed / frameDuration);
      if (frame >= frames) frame = frames - 1;

      const FRAME_W = 200;
      const FRAME_H = 200;
      const sx = frame * FRAME_W;

      const safeSx = Math.max(
        0,
        Math.min(sx, images.tornadoSprite.width - FRAME_W),
      );

      const drawW = 220;
      const drawH = 150;

      ctx.drawImage(
        images.tornadoSprite,
        safeSx,
        0,
        FRAME_W,
        FRAME_H,
        screenX - drawW / 2,
        screenY - drawH / 2,
        drawW,
        drawH,
      );
    }
  }

  // Отрисовка режима прицеливания для имплантов области
  try {
    const implants = window.implantsSystem;
    if (implants && implants.aiming && implants.aiming.active) {
      const aimSlot = implants.aiming.slotIndex;
      const cfg = implants.IMPLANT_CONFIG[implants.implantSlots[aimSlot]?.type];
      const radius = (cfg && cfg.radius) || 100;
      const aimXWorld =
        typeof window.lastPointerWorldX === "number"
          ? window.lastPointerWorldX
          : 0;
      const aimYWorld =
        typeof window.lastPointerWorldY === "number"
          ? window.lastPointerWorldY
          : 0;

      const screenAX = aimXWorld - cameraX;
      const screenAY = aimYWorld - cameraY;

      ctx.save();
      ctx.fillStyle = "rgba(120,120,120,0.35)";
      ctx.beginPath();
      ctx.arc(screenAX, screenAY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(200,200,200,0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  } catch (err) {
    // noop
  }

  if (window.worldSystem.foregroundTiles[currentWorldId]) {
    window.worldSystem.drawForegroundTiles(cameraX, cameraY);
  }

  clockSystem.draw();
  window.droneSystem.draw();

  // === ТАЙЛОВЫЙ СЛОЙ CLOUDS ===
  if (window.worldSystem.cloudsTiles[currentWorldId]) {
    window.worldSystem.drawCloudsTiles(cameraX, cameraY);
  }

  window.worldSystem.drawTransitionZones();

  // === ЭФФЕКТ НАХОЖДЕНИЯ В АНОМАЛИИ ===
  if (activeAnomaly && activeAnomaly.worldId === currentWorldId) {
    const me = players.get(myId);
    if (!me) return;

    if (window.lastAnomalyCheckTime === undefined)
      window.lastAnomalyCheckTime = 0;

    const now = Date.now();
    if (now - window.lastAnomalyCheckTime > 300) {
      const dx = me.x - activeAnomaly.x;
      const dy = me.y - activeAnomaly.y;
      window.isInAnomaly =
        dx * dx + dy * dy < activeAnomaly.radius * activeAnomaly.radius;
      window.lastAnomalyCheckTime = now;
    }

    if (window.isInAnomaly) {
      ctx.save();

      ctx.fillStyle = "rgba(255, 40, 40, 0.22)";
      ctx.fillRect(0, 0, canvas.width / zoom, canvas.height / zoom);

      const pulse = 0.6 + Math.sin(now / 180) * 0.4;
      ctx.shadowColor = "#ff2222";
      ctx.shadowBlur = 35;

      ctx.font = `bold ${54 / zoom}px 'Courier New', monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = `rgba(255, 90, 90, ${pulse})`;
      ctx.fillText(
        "ВЫЙДИТЕ ИЗ АНОМАЛИИ!",
        canvas.width / (2 * zoom),
        canvas.height / (2 * zoom) - 30 / zoom,
      );

      ctx.font = `bold ${26 / zoom}px 'Courier New', monospace`;
      ctx.fillStyle = `rgba(255, 160, 160, ${pulse * 0.9})`;
      ctx.fillText(
        "Аномалия наносит урон!",
        canvas.width / (2 * zoom),
        canvas.height / (2 * zoom) + 35 / zoom,
      );

      ctx.restore();
    }
  } else {
    window.isInAnomaly = false;
  }
}

function checkCollisions() {
  return;
}

const PICKUP_RADIUS_SQUARED = 2500;
const pickupHintElements = new Map();

function getNearestPickupItem() {
  const me = players.get(myId);
  if (!me || me.health <= 0) return null;

  let nearest = null;
  let nearestDistanceSquared = PICKUP_RADIUS_SQUARED;

  items.forEach((item, itemId) => {
    if (
      item.worldId !== window.worldSystem.currentWorldId ||
      pendingPickups.has(itemId)
    ) {
      return;
    }

    const dx = me.x + 35 - (item.x + 10);
    const dy = me.y + 35 - (item.y + 10);
    const distanceSquared = dx * dx + dy * dy;

    if (distanceSquared < nearestDistanceSquared) {
      nearest = { item, itemId };
      nearestDistanceSquared = distanceSquared;
    }
  });

  return nearest;
}

function requestNearestPickup() {
  if (ws?.readyState !== WebSocket.OPEN) return;

  const nearest = getNearestPickupItem();
  if (!nearest) return;

  pendingPickups.add(nearest.itemId);
  sendWhenReady(ws, JSON.stringify({ type: "pickup", itemId: nearest.itemId }));
}

window.addEventListener("keydown", (event) => {
  if (event.code !== "KeyF" || event.repeat) return;
  if (
    window.isChatInputFocused ||
    document.activeElement === document.getElementById("chatInput")
  ) {
    return;
  }

  event.preventDefault();
  requestNearestPickup();
});

function updatePickupHints(cameraX, cameraY, currentWorldId) {
  const activeHintIds = new Set();
  const me = players.get(myId);
  const zoom = window.movementSystem?.getZoom?.() || 1;

  if (me && me.health > 0) {
    items.forEach((item, itemId) => {
      if (item.worldId !== currentWorldId || pendingPickups.has(itemId)) {
        return;
      }

      const dx = me.x + 35 - (item.x + 10);
      const dy = me.y + 35 - (item.y + 10);
      if (dx * dx + dy * dy >= PICKUP_RADIUS_SQUARED) return;

      let hint = pickupHintElements.get(itemId);
      if (!hint) {
        hint = document.createElement("div");
        hint.className = "pickup-hint";
        hint.textContent = "[F] Подобрать";
        document.getElementById("gameContainer")?.appendChild(hint);
        pickupHintElements.set(itemId, hint);
      }

      hint.style.left = `${(item.x - cameraX + 10) * zoom}px`;
      hint.style.top = `${(item.y - cameraY - 16) * zoom}px`;
      hint.hidden = false;
      activeHintIds.add(itemId);
    });
  }

  pickupHintElements.forEach((hint, itemId) => {
    if (!activeHintIds.has(itemId)) {
      hint.remove();
      pickupHintElements.delete(itemId);
    }
  });
}
