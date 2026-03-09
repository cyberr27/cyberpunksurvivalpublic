// Получаем элементы DOM

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const inventoryEl = document.getElementById("items");
const statsEl = document.getElementById("stats");

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

let ws;
let players = new Map();
let myId;
const items = new Map();
window.incomingMessageQueue = [];
window.isProcessingMessages = false;

const GAME_CONFIG = {
  FRAME_DURATION: 80,
};

window.atomFrame = 0;
window.atomFrameTime = 0;
const ATOM_FRAMES = 40;
const ATOM_FRAME_DURATION = 180;
const pendingPickups = new Set();

let lastTime = 0;
let lastRender = 0;
const FPS = 60;

const PLAYER_FRAME_WIDTH = 70;
const PLAYER_FRAME_HEIGHT = 70;
const WALK_FRAME_COUNT = 13;
const ATTACK_FRAME_COUNT = 13;
const WALK_FRAME_DURATION = GAME_CONFIG.FRAME_DURATION / WALK_FRAME_COUNT;
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

const SPRITE_ROWS = {
  walk_up: 70,
  walk_down: 0,
  walk_right: 140,
  walk_left: 210,
  attack_up_down: 280,
  attack_right: 350,
  attack_left: 420,
};

// Загрузка изображений
const imageSources = {
  playerSprite: "playerSprite.png",
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
  jackSprite: "jackSprite.png", // Создай файл спрайта (аналог johnSprite.png, 70x(40 кадров))
  jackPhotoImage: "jackPhoto.png", // Фото для диалога (аналог fotoQuestNPC.png)
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
  thimbleriggerSprite: "thimblerigger.png",
  misterTwisterSprite: "mister_twister.png",
  trashImage: "trash.png",
  torestosSprite: "torestosSprite.png",
  toremidosSprite: "toremidosSprite.png",
  homelessSprite: "homeless.png",
  portalImage: "portal.png",
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
};

const images = {};
let imagesLoaded = 0;
const totalImages = Object.keys(imageSources).length;

Object.entries(imageSources).forEach(([key, src]) => {
  images[key] = new Image();
  images[key].src = src;
  images[key].onload = () => {
    imagesLoaded++;
    if (imagesLoaded === totalImages) {
      window.addEventListener("resize", resizeCanvas);
      window.enemySystem.initialize();
      window.cockroachSystem.initialize(images.cockroachSprite);
      window.misterTwister.initialize();
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
    }
  };
});

const ITEM_CONFIG = {
  // === ЕДА И НАПИТКИ ===
  energy_drink: {
    effect: { energy: 20, water: 5 },
    image: images.energyDrinkImage,
    description: "Энергетик: +20 эн. +5 воды.",
    rarity: 2,
  },
  nut: {
    effect: { food: 7 },
    image: images.nutImage,
    description: "Орех: +7 еды.",
    rarity: 3,
  },
  water_bottle: {
    effect: { water: 30 },
    image: images.waterBottleImage,
    description: "Вода: +30 воды.",
    rarity: 3,
  },
  apple: {
    effect: { food: 8, water: 5 },
    image: images.appleImage,
    description: "Яблоко: +8 еды, +5 воды.",
    rarity: 3,
  },
  berries: {
    effect: { food: 6, water: 6 },
    image: images.berriesImage,
    description: "Ягоды: +6 еды, +6 воды.",
    rarity: 3,
  },
  carrot: {
    effect: { food: 5, energy: 3 },
    image: images.carrotImage,
    description: "Морковь: +5 еды, +3 энергии.",
    rarity: 3,
  },
  canned_meat: {
    effect: { food: 20 },
    image: images.cannedMeatImage,
    description: "Банка тушёнки: +20 еды.",
    rarity: 1,
  },
  mushroom: {
    effect: { food: 5, energy: 15 },
    image: images.mushroomImage,
    description: "Гриб прущий: +15 энергии, +5 еды.",
    rarity: 1,
  },
  sausage: {
    effect: { food: 16, energy: 3 },
    image: images.sausageImage,
    description: "Колбаса: +16 еды, +3 энергии.",
    rarity: 2,
  },
  blood_pack: {
    effect: { health: 40 },
    image: images.bloodPackImage,
    description: "Пакет крови: +40 здоровья.",
    rarity: 1,
  },
  bread: {
    effect: { food: 13, water: -2 },
    image: images.breadImage,
    description: "Хлеб: +13 еды, -2 воды.",
    rarity: 2,
  },
  vodka_bottle: {
    effect: { health: 5, energy: -2, water: 1, food: 2 },
    image: images.vodkaBottleImage,
    description: "Водка: +5 здоровья, -2 эн. +1 воды, +2 еды.",
    rarity: 2,
  },
  meat_chunk: {
    effect: { food: 20, energy: 5, water: -2 },
    image: images.meatChunkImage,
    description: "Кусок мяса: +20 еды, +5 эн., -2 воды.",
    rarity: 2,
  },
  blood_syringe: {
    effect: { health: 10 },
    image: images.bloodSyringeImage,
    description: "Шприц с кровью: +10 здоровья.",
    rarity: 2,
  },
  milk: {
    effect: { water: 15, food: 5 },
    image: images.milkImage,
    description: "Молоко: +15 воды, +5 еды.",
    rarity: 2,
  },
  condensed_milk: {
    effect: { water: 5, food: 11, energy: 2 },
    image: images.condensedMilkImage,
    description: "Сгущёнка: +11 еды, +5 воды, +2 эн.",
    rarity: 2,
  },
  dried_fish: {
    effect: { food: 10, water: -3 },
    image: images.driedFishImage,
    description: "Сушёная рыба: +10 еды, -3 воды.",
    rarity: 2,
  },

  // === ВАЛЮТА И СПЕЦПРЕДМЕТЫ ===
  balyary: {
    image: images.balyaryImage,
    description: "Баляр: игровая валюта.",
    stackable: true,
    balyary: true,
    rarity: 1,
  },
  atom: {
    effect: { armor: 5 },
    image: images.atomImage,
    description: "Атом — даёт +5 брони при использовании.",
    stackable: true,
    rarity: 1,
  },
  medical_certificate: {
    image: images.medicalCertificateImage,
    description: "Мед. справка МД-07: подтверждает, что ты не зомби.",
    rarity: 5,
  },
  medical_certificate_stamped: {
    image: images.medicalCertificateStampedImage,
    description: "Мед. справка с печатью заставы. Допуск в Неоновый Город.",
    rarity: 5,
  },

  // === КИБЕР-ЭКИПИРОВКА (ЭНДГЕЙМ) ===
  cyber_helmet: {
    type: "headgear",
    effect: { armor: 10, energy: 5 },
    image: images.cyberHelmetImage,
    description: "Кибершлем: +10 брони, +5 энергии",
    rarity: 4,
    level: 5,
  },
  nano_armor: {
    type: "armor",
    effect: { armor: 20, health: 10 },
    image: images.nanoArmorImage,
    description: "Нано-броня: +20 брони, +10 здоровья",
    rarity: 4,
    level: 5,
  },
  tactical_belt: {
    type: "belt",
    effect: { armor: 5, food: 5 },
    image: images.tacticalBeltImage,
    description: "Тактический пояс: +5 брони, +5 еды",
    rarity: 4,
    level: 5,
  },
  cyber_pants: {
    type: "pants",
    effect: { armor: 10, water: 5 },
    image: images.cyberPantsImage,
    description: "Киберштаны: +10 брони, +5 воды",
    rarity: 4,
    level: 5,
  },
  speed_boots: {
    type: "boots",
    effect: { armor: 5, energy: 10 },
    image: images.speedBootsImage,
    description: "Скоростные ботинки: +5 брони, +10 энергии",
    rarity: 4,
    level: 5,
  },
  tech_gloves: {
    type: "gloves",
    effect: { armor: 5, energy: 5 },
    image: images.techGlovesImage,
    description: "Технические перчатки: +5 брони, +5 энергии",
    rarity: 4,
    level: 5,
  },
  plasma_rifle: {
    type: "weapon",
    effect: { damage: 50, range: 200 },
    image: images.plasmaRifleImage,
    description: "Плазменная винтовка: 50 урона, дальность 200px",
    rarity: 4,
    hands: "twohanded",
    level: 0,
  },
  knuckles: {
    type: "weapon",
    effect: { damage: { min: 3, max: 7 } },
    image: images.knucklesImage,
    description: "Кастет: 3–7 урона в ближнем бою",
    rarity: 4,
    hands: "onehanded",
    level: 2,
  },
  knife: {
    type: "weapon",
    effect: { damage: { min: 4, max: 6 } },
    image: images.knifeImage,
    description: "Нож: 4–6 урона в ближнем бою",
    rarity: 4,
    hands: "onehanded",
    level: 3,
  },
  nano_absorbing_knife: {
    type: "weapon",
    effect: { damage: { min: 6, max: 9 } },
    image: images.nano_absorbing_knife,
    description: "Нож: 6–9 урона в ближнем бою",
    rarity: 4,
    hands: "onehanded",
    level: 3,
  },
  bat: {
    type: "weapon",
    effect: { damage: { min: 5, max: 10 } },
    image: images.batImage,
    description: "Бита: 5–10 урона в ближнем бою",
    rarity: 4,
    hands: "onehanded",
    level: 4,
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
  },
  torn_belt_of_gluttony: {
    type: "belt",
    effect: { armor: 3, food: 7 },
    image: images.torn_belt_of_gluttony,
    description: "Порванный пояс обжорства: +7 к максимальной еде, +3 к броне",
    rarity: 4,
    collection: "Torn Gluttony",
    level: 0,
  },
  torn_pants_of_gluttony: {
    type: "pants",
    effect: { armor: 7, food: 6 },
    image: images.torn_pants_of_gluttony,
    description: "Порванные штаны обжорства: +6 к максимальной еде, +7 к броне",
    rarity: 4,
    collection: "Torn Gluttony",
    level: 0,
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
  },
  torn_gloves_of_thirst: {
    type: "gloves",
    effect: { armor: 5, water: 3 },
    image: images.torn_gloves_of_thirst,
    description: "Порванные перчатки жажды: +3 к максимальной воде, +5 к броне",
    rarity: 4,
    collection: "Torn Thirst",
    level: 0,
  },
  torn_belt_of_thirst: {
    type: "belt",
    effect: { armor: 3, water: 7 },
    image: images.torn_belt_of_thirst,
    description: "Порванный пояс жажды: +7 к максимальной воде, +3 к броне",
    rarity: 4,
    collection: "Torn Thirst",
    level: 0,
  },
  torn_pants_of_thirst: {
    type: "pants",
    effect: { armor: 7, water: 6 },
    image: images.torn_pants_of_thirst,
    description: "Порванные штаны жажды: +6 к максимальной воде, +7 к броне",
    rarity: 4,
    collection: "Torn Thirst",
    level: 0,
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
  },

  white_void_cap: {
    type: "headgear",
    effect: {},
    image: images.white_void_cap,
    description: "Белая кепка Пустоты — чистый лист для будущих улучшений",
    rarity: 4,
    collection: "White Void",
    level: 0,
  },
  white_void_t_shirt: {
    type: "armor",
    effect: {},
    image: images.white_void_t_shirt,
    description: "Белая футболка Пустоты — чистый лист для будущих улучшений",
    rarity: 4,
    collection: "White Void",
    level: 0,
  },
  white_void_gloves: {
    type: "gloves",
    effect: {},
    image: images.white_void_gloves,
    description: "Белые перчатки Пустоты — чистый лист для будущих улучшений",
    rarity: 4,
    collection: "White Void",
    level: 0,
  },
  white_void_belt: {
    type: "belt",
    effect: {},
    image: images.white_void_belt,
    description: "Белый пояс Пустоты — чистый лист для будущих улучшений",
    rarity: 4,
    collection: "White Void",
    level: 0,
  },
  white_void_pants: {
    type: "pants",
    effect: {},
    image: images.white_void_pants,
    description: "Белые штаны Пустоты — чистый лист для будущих улучшений",
    rarity: 4,
    collection: "White Void",
    level: 0,
  },
  white_void_sneakers: {
    type: "boots",
    effect: {},
    image: images.white_void_sneakers,
    description: "Белые кроссовки Пустоты — чистый лист для будущих улучшений",
    rarity: 4,
    collection: "White Void",
    level: 0,
  },

  recipe_torn_equipment: {
    image: images.recipe_torn_equipment,
    effect: {},
    description:
      "Рецепт порванной экипировки — материал для улучшений у Торестоса",
    rarity: 6,
    stackable: true,
    recipe: "recipe_torn_equipment",
  },
  recipe_chameleon_equipment: {
    image: images.recipe_chameleon_equipment,
    effect: {},
    description:
      "Рецепт хамелеон-экипировки — материал для улучшений у Торестоса",
    rarity: 6,
    stackable: true,
    recipe: "recipe_chameleon_equipment",
  },

  blue_crystal: {
    image: images.blue_crystal,
    description: "Синий кристал — материал для улучшений у Торестоса",
    rarity: 1,
    stackable: true,
  },
  green_crystal: {
    image: images.green_crystal,
    description: "Зеленый кристал — материал для улучшений у Торестоса",
    rarity: 1,
    stackable: true,
  },
  red_crystal: {
    image: images.red_crystal,
    description: "Красный кристал — материал для улучшений у Торестоса",
    rarity: 1,
    stackable: true,
  },
  white_crystal: {
    image: images.white_crystal,
    description: "Белый кристал — материал для улучшений у Торестоса",
    rarity: 1,
    stackable: true,
  },
  yellow_crystal: {
    image: images.yellow_crystal,
    description: "Желтый кристал — материал для улучшений у Торестоса",
    rarity: 1,
    stackable: true,
  },
  chameleon_crystal: {
    image: images.chameleon_crystal,
    description: "Хамелион кристал — материал для улучшений у Торестоса",
    rarity: 1,
    stackable: true,
  },
  nanoalloy: {
    image: images.nanoalloy,
    description: "Наносплав.",
    rarity: 1,
    stackable: true,
  },
  nanofilament: {
    image: images.nanofilament,
    description: "Нановолокно.",
    rarity: 1,
    stackable: true,
  },
};

let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 2000; // 2 секунды
let lastDistance = 0; // Добавляем глобальную переменную

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
      fetch("https://cyberpunksurvival.onrender.com/health")
        .then((response) => {
          if (!response.ok) {
            throw new Error("Сервер недоступен");
          }
          ws = new WebSocket("wss://cyberpunksurvival.onrender.com");
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
                ws.onmessage = (event) => {
                  try {
                    const data = JSON.parse(event.data);
                    window.incomingMessageQueue.push(data);
                    processMessageQueue(); // запустит обработку, если ещё не идёт
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
  ws = new WebSocket("wss://cyberpunksurvival.onrender.com");
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
            window.incomingMessageQueue.push(data);
            processMessageQueue(); // запустит обработку, если ещё не идёт
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
    registerError.textContent = "Введите имя и пароль";
    return;
  }
  if (ws.readyState === WebSocket.OPEN) {
    console.log("Отправка регистрации:", { username, password });
    sendWhenReady(ws, JSON.stringify({ type: "register", username, password }));
  } else {
    registerError.textContent = "Нет соединения с сервером";
  }
});

// Вход
loginBtn.addEventListener("click", () => {
  const username = document.getElementById("loginUsername").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  if (!username || !password) {
    loginError.textContent = "Введите имя и пароль";
    return;
  }
  if (ws.readyState === WebSocket.OPEN) {
    sendWhenReady(ws, JSON.stringify({ type: "login", username, password }));
  } else {
    loginError.textContent = "Нет соединения с сервером";
  }
});

function handleAuthMessage(event) {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case "loginSuccess":
      myId = data.id;
      authContainer.style.display = "none";
      document.getElementById("gameContainer").style.display = "block";

      const me = {
        id: data.id,
        x: data.x || 474,
        y: data.y || 2474,
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
        torestosMet: data.torestosMet || false,
        selectedQuestId: data.selectedQuestId || null,
        level: data.level || 0,
        xp: data.xp || 99,
        skills: data.skills || [],
        skillPoints: data.skillPoints || 0,
        meleeDamageBonus: data.meleeDamageBonus || 0,
        upgradePoints: data.upgradePoints || 0,
        worldId: data.worldId || 0,
        worldPositions: data.worldPositions || { 0: { x: 222, y: 3205 } },
        lastMoveTime: data.lastMoveTime || 0,
        lastConfirmedPosition: { x: data.x || 474, y: data.y || 2474 },
        lastProcessedMoveTime: data.lastProcessedMoveTime || 0,
        lastPickupTime: data.lastPickupTime || 0,
        pickupSpamCount: data.pickupSpamCount || 0,
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

        // Добавляем поле для баббла чата
        chatBubble: null,
      };

      // === ДОПОЛНИТЕЛЬНО: если сервер вдруг пришлёт maxStats — сохраняем ===
      if (data.maxStats) {
        me.maxStats = data.maxStats;
      }

      players.set(myId, me);

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
      window.inventorySystem.updateInventoryDisplay();
      updateStatsDisplay();

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

      if (window.neonNpcSystem && data.alexNeonMet !== undefined) {
        NEON_NPC.isMet = !!data.alexNeonMet;
      }

      if (window.outpostCaptainSystem) {
        window.outpostCaptainSystem.setCaptainMet(data.captainMet === true);
      }

      if (window.thimbleriggerSystem && data.thimbleriggerMet !== undefined) {
        window.thimbleriggerSystem.setThimbleriggerMet(!!data.thimbleriggerMet);
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

      resizeCanvas();
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          window.incomingMessageQueue.push(data);
          processMessageQueue(); // запустит обработку, если ещё не идёт
        } catch (err) {
          console.error("Не удалось распарсить сообщение от сервера:", err);
        }
      };
      startGame();
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
    case "attackPlayer":
      if (data.worldId === currentWorldId && players.has(data.targetId)) {
        const player = players.get(data.targetId);
        player.health = Math.max(0, player.health - data.damage);
        players.set(data.targetId, { ...player });
        updateStatsDisplay();
      }
      break;
    case "newItem":
      const newItem = {
        x: data.x,
        y: data.y,
        type: data.type,
        spawnTime: data.spawnTime,
        worldId: data.worldId,
      };
      items.set(data.itemId, newItem);
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

function startGame() {
  window.worldSystem.initialize();
  window.lightsSystem.initialize(); // Инициализируем источники света
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
  window.combatSystem.initialize();
  if (window.strongStrikeSystem && !window.strongStrikeSystem.initialized) {
    window.strongStrikeSystem.initialize();
  }

  document.addEventListener("keydown", (e) => {
    const me = players.get(myId);
    if (!me || me.health <= 0) return;

    if (e.key === "Escape") {
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
      document.activeElement === chatInput ||
      document.activeElement === document.getElementById("balyaryAmount")
    ) {
      return;
    }

    switch (e.key) {
      case "q":
        toggleInventory();
        e.preventDefault();
        break;
      case "c":
        const isChatVisible = chatContainer.style.display === "flex";
        chatContainer.style.display = isChatVisible ? "none" : "flex";
        chatBtn.classList.toggle("active", !isChatVisible);
        if (!isChatVisible) chatInput.focus();
        else chatInput.blur();
        e.preventDefault();
        break;
      case "e":
        window.equipmentSystem.toggleEquipment();
        e.preventDefault();
        break;
      case "r":
        window.skillsSystem?.toggleSkills?.();
        e.preventDefault();
        break;
    }
  });

  // Обработчик нажатия мыши (только для инвентаря)
  canvas.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      const me = players.get(myId);
      if (!me || me.health <= 0) return;

      const inventoryContainer = document.getElementById("inventoryContainer");
      const rect = inventoryContainer.getBoundingClientRect();
      if (
        isInventoryOpen &&
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
            e.clientY <= slotRect.bottom &&
            inventory[i]
          ) {
            selectSlot(i, slots[i]);
            return;
          }
        }
      } else {
        const camera = window.movementSystem.getCamera();
        const worldX = e.clientX + window.movementSystem.getCamera().x;
        const worldY = e.clientY + window.movementSystem.getCamera().y;
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
      const camera = window.movementSystem.getCamera();
      const worldX = touch.clientX + window.movementSystem.getCamera().x;
      const worldY = touch.clientY + window.movementSystem.getCamera().y;
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
    targetX = touch.clientX + window.movementSystem.getCamera().x;
    targetY = touch.clientY + window.movementSystem.getCamera().y;
  });

  canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    isMoving = false;
    const me = players.get(myId);
    if (me) {
      me.state = "idle";
      me.frame = 0;
      me.frameTime = 0;
      sendWhenReady(
        ws,
        JSON.stringify({
          type: "move",
          x: me.x,
          y: me.y,
          health: me.health,
          energy: me.energy,
          food: me.food,
          water: me.water,
          armor: me.armor,
          distanceTraveled: me.distanceTraveled,
          direction: me.direction,
          state: me.state,
          frame: me.frame,
        }),
      );
    }
  });

  window.chatSystem.initializeChat(ws);
  window.inventorySystem.initialize();
  window.tradeSystem.initialize(ws);
  window.equipmentSystem.initialize();
  const me = players.get(myId);
  if (me && me.equipment) {
    window.equipmentSystem.syncEquipment(me.equipment);
  }

  if (window.outpostCaptainSystem) {
    window.outpostCaptainSystem.initialize();
  }

  requestAnimationFrame(gameLoop);
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
    statsEl.innerHTML = `
  <span class="health">Здоровье: ${Math.min(
    me.health ?? 0,
    me.maxStats?.health ?? 100,
  )}/${me.maxStats?.health ?? 100}</span><br>
  <span class="energy">Энергия: ${Math.min(
    me.energy ?? 0,
    me.maxStats?.energy ?? 100,
  )}/${me.maxStats?.energy ?? 100}</span><br>
  <span class="food">Еда: ${Math.min(me.food ?? 0, me.maxStats?.food ?? 100)}/${
    me.maxStats?.food ?? 100
  }</span><br>
  <span class="water">Вода: ${Math.min(
    me.water ?? 0,
    me.maxStats?.water ?? 100,
  )}/${me.maxStats?.water ?? 100}</span><br>
  <span class="armor">Броня: ${Math.min(
    me.armor ?? 0,
    me.maxStats?.armor ?? 0,
  )}/${me.maxStats?.armor ?? 0}</span>
`;
    updateUpgradeButtons();

    document.getElementById("coords").innerHTML = `X: ${Math.floor(
      me.x,
    )}<br>Y: ${Math.floor(me.y)}`;
  } catch (error) {}
}

async function handleGameMessageLogic(data) {
  const currentWorldId = window.worldSystem.currentWorldId;

  switch (data.type) {
    case "syncPlayers":
      if (data.worldId === currentWorldId && data.players) {
        const myPlayer = players.get(myId);
        players.clear();
        if (myPlayer) players.set(myId, { ...myPlayer, frameTime: 0 });

        data.players.forEach((p) => {
          if (p?.id && p.id !== myId) {
            players.set(p.id, {
              ...p,
              frameTime: 0,
              animTime: 0,
              targetX: p.x,
              targetY: p.y,
              targetFrame: p.state === "walking" ? p.frame : 0,
              targetDirection: p.direction,
              targetState: p.state,
              targetAttackFrame: p.attackFrame || 0,
            });
          }
        });
      }
      break;
    case "worldTransitionSuccess":
      {
        const me = players.get(myId);
        if (me) {
          window.worldSystem.switchWorld(data.worldId, me, data.x, data.y);
          items.forEach((item, itemId) => {
            if (item.worldId !== data.worldId) {
              items.delete(itemId);
            }
          });
          window.vendingMachine.hideVendingMenu();
          window.lightsSystem.reset(data.worldId);
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
        }
      }
      // Добавляем задержку для стабилизации соединения после перехода
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          sendWhenReady(
            ws,
            JSON.stringify({
              type: "syncPlayers",
              worldId: data.worldId,
            }),
          );
        }
      }, 1000); // Задержка 1 секунда
      break;
    case "newPlayer":
      if (data.player?.id && data.player.worldId === currentWorldId) {
        players.set(data.player.id, {
          ...data.player,
          animTime: 0,
          targetX: data.player.x,
          targetY: data.player.y,
          targetDirection: data.player.direction,
          targetState: data.player.state,
          targetAttackFrame: data.player.attackFrame || 0,
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
        window.inventorySystem.updateInventoryDisplay();
        levelSystem.handleItemPickup(
          data.item.type,
          data.item.isDroppedByPlayer || false,
        );
      }
      updateStatsDisplay();
      break;
    case "itemNotFound":
      items.delete(data.itemId);
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
        me.health = data.stats.health;
        me.energy = data.stats.energy;
        me.food = data.stats.food;
        me.water = data.stats.water;
        me.armor = data.stats.armor;

        inventory = me.inventory.map((slot) => (slot ? { ...slot } : null));

        // Синхронизируем визуальные слоты
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
    case "unequipItemFail":
      window.equipmentSystem.handleUnequipFail(message.error);
      break;
    case "inventoryFull":
      pendingPickups.delete(data.itemId);
      break;
    case "update":
      if (data.player?.id === myId) {
        const me = players.get(myId);
        if (!me) break;

        // ← Самое важное место для детекта урона
        if (data.player.health !== undefined) {
          const oldHealth = Number(me.health) || 0;
          let newHealth = Number(data.player.health);

          // Защита от отрицательного здоровья с сервера
          newHealth = Math.max(0, newHealth);

          if (newHealth < oldHealth && window.regenerationSystem) {
            window.regenerationSystem.resetTimerOnDamage();
          }

          me.health = Math.max(
            0,
            Math.min(newHealth, me.maxStats?.health || 100),
          );
        }

        const isMoving = me.state === "walking" || me.state === "attacking";

        if (isMoving) {
          const { x, y, direction, state, frame, ...stats } = data.player;
          Object.assign(me, stats);
        } else {
          if (data.player.x !== undefined) {
            me.serverTargetX = data.player.x;
            me.serverTargetY = data.player.y;
            me.x += (me.serverTargetX - me.x) * 0.1;
            me.y += (me.serverTargetY - me.y) * 0.1;
            if (
              Math.abs(me.serverTargetX - me.x) < 0.5 &&
              Math.abs(me.serverTargetY - me.y) < 0.5
            ) {
              me.x = me.serverTargetX;
              me.y = me.serverTargetY;
              delete me.serverTargetX;
              delete me.serverTargetY;
            }
          }
          const { x, y, ...stats } = data.player;
          Object.assign(me, stats);
          if (data.player.meleeDamageBonus !== undefined) {
            me.meleeDamageBonus = Number(data.player.meleeDamageBonus);
          }
        }

        if (data.player.inventory) {
          // Глубокая копия, чтобы не было неожиданных мутаций
          inventory = data.player.inventory.map((slot) =>
            slot ? { ...slot } : null,
          );

          // Синхронизируем также в объекте игрока
          me.inventory = inventory.map((slot) => (slot ? { ...slot } : null));

          // Обновляем отображение инвентаря
          window.inventorySystem?.updateInventoryDisplay();

          // Если открыто меню Mister Twister — обновляем баланс на табло
          if (window.misterTwister?.isMenuOpen) {
            window.misterTwister.updateLocalBalanceDisplay();
          }
        }

        // Оборудование (оставляем как было)
        if (data.player.equipment) {
          window.equipmentSystem.syncEquipment(data.player.equipment);
        }

        // Обновляем статы в любом случае
        updateStatsDisplay();
      } else if (data.player?.id) {
        const existing = players.get(data.player.id) || {};

        const updatedPlayer = {
          ...existing,
          ...data.player,
          targetX: data.player.x,
          targetY: data.player.y,
          targetDirection: data.player.direction,
          targetState: data.player.state,
          x: existing.x ?? data.player.x,
          y: existing.y ?? data.player.y,
          direction: data.player.direction,
          state: data.player.state,
        };

        if (data.player.attackFrame !== undefined) {
          updatedPlayer.attackFrame = data.player.attackFrame;
          updatedPlayer.attackFrameTime = data.player.attackFrameTime || 0;
        } else if (data.player.state !== "attacking") {
          updatedPlayer.attackFrame = 0;
          updatedPlayer.attackFrameTime = 0;
        }

        // Если атака только началась — гарантируем сброс
        if (
          data.player.state === "attacking" &&
          existing.state !== "attacking"
        ) {
          updatedPlayer.attackFrame = 0;
          updatedPlayer.attackFrameTime = 0;
        }

        if (data.player.attackFrameTime !== undefined) {
          updatedPlayer.attackFrameTime = data.player.attackFrameTime;
        }
        if (data.player.attackFrame !== undefined) {
          updatedPlayer.attackFrame = data.player.attackFrame;
        }

        // Добавь это:
        if (data.player.attackFrame !== undefined) {
          updatedPlayer.attackFrame = data.player.attackFrame;
          updatedPlayer.attackFrameTime = data.player.attackFrameTime || 0;
        }

        // КРИТИЧНО ВАЖНЫЙ БЛОК: детект начала атаки у других игроков
        const wasAttacking = existing.state === "attacking";
        const isAttacking = data.player.state === "attacking";

        if (isAttacking && !wasAttacking) {
          // Игрок ТОЛЬКО ЧТО начал атаковать (даже стоя на месте!)
          updatedPlayer.attackFrame = 0;
          updatedPlayer.attackFrameTime = 0;
          updatedPlayer.animTime = 0; // сбрасываем анимацию ходьбы
          updatedPlayer.frame = 0;
          updatedPlayer.prevState = existing.state || "idle"; // на всякий
        } else if (!isAttacking && wasAttacking) {
          // Закончил атаку
          updatedPlayer.attackFrame = 0;
          updatedPlayer.attackFrameTime = 0;
        } else if (isAttacking && wasAttacking) {
          // Продолжает атаковать — сохраняем прогресс
          updatedPlayer.attackFrame = existing.attackFrame || 0;
          updatedPlayer.attackFrameTime = existing.attackFrameTime || 0;
        } else {
          // Не атакует вообще
          updatedPlayer.attackFrame = 0;
          updatedPlayer.attackFrameTime = 0;
        }

        // Анимация ходьбы — только если не атакует
        if (data.player.state === "walking") {
          updatedPlayer.animTime = existing.animTime || 0;
          updatedPlayer.frame = existing.frame ?? 0;
        } else if (data.player.state !== "attacking") {
          updatedPlayer.frame = 0;
          updatedPlayer.animTime = 0;
        }

        players.set(data.player.id, updatedPlayer);
      }
      break;
    case "itemDropped":
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
        window.inventorySystem.updateInventoryDisplay();
      }
      break;
    case "chat":
      window.chatSystem.handleChatMessage(data);

      const player = players.get(data.id);
      if (player && player.worldId === window.worldSystem.currentWorldId) {
        const shortText = data.message.substring(0, CHAT_BUBBLE_MAX_LENGTH);
        player.chatBubble = {
          text: shortText,
          time: Date.now(),
        };
      }
      break;
    case "buyWaterResult":
      if (data.success) {
        const me = players.get(myId);
        me.water = data.water;
        me.inventory = data.inventory.map((slot) =>
          slot ? { ...slot } : null,
        );
        updateStatsDisplay();
        window.inventorySystem.updateInventoryDisplay();
        window.vendingMachine.hideVendingMenu();
      } else {
        const errorEl = document.getElementById("vendingError");
        errorEl.textContent = data.error || "Ошибка покупки";
      }
      break;
    case "totalOnline":
      updateOnlineCount(data.count);
      break;
    case "tradeRequest":
    case "tradeAccepted":
    case "tradeOffer":
    case "tradeConfirmed":
    case "tradeCancelled":
      window.tradeSystem.handleTradeMessage(data);
      break;

    case "tradeCompleted":
      if (data.newInventory) {
        // КРИТИЧНО: обновляем локальный инвентарь
        inventory = data.newInventory.map((slot) =>
          slot ? { ...slot } : null,
        );

        // Также обновляем инвентарь в объекте игрока (для других систем)
        const me = players.get(myId);
        if (me) {
          me.inventory = [...inventory]; // глубокая копия
          players.set(myId, me);
        }

        window.tradeSystem.closeTradeWindow();
        window.tradeSystem.resetTrade();
        window.inventorySystem.updateInventoryDisplay();
        updateStatsDisplay();
      }
      break;
    case "tradeChatMessage":
      window.tradeSystem.handleTradeMessage(data);
      break;
    case "useItemSuccess":
      {
        const me = players.get(myId);
        if (me) {
          // Обновляем статы игрока (важно для других систем)
          if (data.stats.health !== undefined)
            me.health = Math.max(
              0,
              Math.min(me.maxStats?.health || 100, Number(data.stats.health)),
            );

          if (data.stats.energy !== undefined)
            me.energy = Math.max(
              0,
              Math.min(me.maxStats?.energy || 100, Number(data.stats.energy)),
            );

          if (data.stats.food !== undefined)
            me.food = Math.max(
              0,
              Math.min(me.maxStats?.food || 100, Number(data.stats.food)),
            );

          if (data.stats.water !== undefined)
            me.water = Math.max(
              0,
              Math.min(me.maxStats?.water || 100, Number(data.stats.water)),
            );

          if (data.stats.armor !== undefined)
            me.armor = Math.max(0, Number(data.stats.armor || me.armor));

          // КРИТИЧНО: полностью синхронизируем инвентарь игрока с серверным
          me.inventory = data.inventory.map((slot) =>
            slot ? { ...slot } : null,
          );
        }

        // Обновляем глобальную переменную inventory (используется в UI)
        inventory = data.inventory.map((slot) => (slot ? { ...slot } : null));

        // Перерисовываем всё
        updateStatsDisplay();
        window.inventorySystem.updateInventoryDisplay();

        // Если был выбран слот с использованным предметом — снимаем выделение
        if (
          selectedSlot !== null &&
          (!inventory[selectedSlot] || inventory[selectedSlot] === null)
        ) {
          selectedSlot = null;
          document
            .querySelectorAll(".inventory-slot.selected")
            ?.forEach((el) => el.classList.remove("selected"));
          document.getElementById("inventoryScreen").textContent = "";
          document.getElementById("useBtn").disabled = true;
          document.getElementById("dropBtn").disabled = true;
        }
      }
      break;
    case "syncBullets":
      window.combatSystem.syncBullets(data.bullets);
      break;
    case "enemyUpdate":
      if (data.enemy && data.enemy.id) {
        const enemyId = data.enemy.id;

        if (enemies.has(enemyId)) {
          // Существующий враг — обновляем поля (с сохранением локальных данных, если нужно)
          const existing = enemies.get(enemyId);
          enemies.set(enemyId, {
            ...existing,
            ...data.enemy,
            // Для плавной интерполяции движения врагов (если у тебя есть система интерполяции)
            targetX: data.enemy.x,
            targetY: data.enemy.y,
          });
        } else {
          // Новый враг (пришёл впервые, например, при входе в мир или спавне)
          enemies.set(enemyId, {
            ...data.enemy,
            targetX: data.enemy.x,
            targetY: data.enemy.y,
          });
        }
      }
      break;

    case "enemyDied":
      const deadId = data.enemyId;
      if (enemies.has(deadId)) {
        enemies.delete(deadId);
      }
      // Вызываем обработчик смерти (эффекты, звук и т.д.), если он есть
      if (window.enemySystem && window.enemySystem.handleEnemyDeath) {
        window.enemySystem.handleEnemyDeath(deadId);
      }
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
    case "levelSyncAfterKill": {
      // Мгновенно обновляем уровень, XP, xpToNextLevel, upgradePoints
      if (window.levelSystem) {
        window.levelSystem.currentLevel = data.level;
        window.levelSystem.currentXP = data.xp;
        window.levelSystem.xpToNextLevel = data.xpToNextLevel;
        window.levelSystem.upgradePoints = data.upgradePoints;
        if (typeof window.levelSystem.setLevelData === "function") {
          window.levelSystem.setLevelData(
            data.level,
            data.xp,
            null,
            data.upgradePoints,
          );
        }
        if (typeof window.levelSystem.showXPEffect === "function") {
          window.levelSystem.showXPEffect(data.xpGained);
        }
        if (typeof window.levelSystem.updateLevelDisplay === "function") {
          window.levelSystem.updateLevelDisplay();
        }
        if (typeof window.levelSystem.updateStatsDisplay === "function") {
          window.levelSystem.updateStatsDisplay();
        }
        if (typeof window.levelSystem.updateUpgradeButtons === "function") {
          window.levelSystem.updateUpgradeButtons();
        }
      }
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
    case "neonQuestStarted":
      showNotification("Заказ принят: Очистка пустошей", "#00ff44");
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
      break;
    case "neonQuestCompleted":
      {
        showNotification(
          `Заказ сдан! +${data.reward.xp} XP | +${data.reward.balyary} баляров!`,
          "#00ffff",
        );
        if (window.levelSystem) {
          window.levelSystem.setLevelData(
            data.level,
            data.xp,
            data.xpToNextLevel,
            data.upgradePoints,
          );
          window.levelSystem.showXPEffect(data.reward.xp);
        }
        const me = players.get(myId);
        me.inventory = data.inventory.map((slot) =>
          slot ? { ...slot } : null,
        );
        window.inventorySystem.updateInventoryDisplay();
      }
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
          window.inventorySystem.updateInventoryDisplay();
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
            window.inventorySystem.updateInventoryDisplay();
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
        window.inventorySystem.updateInventoryDisplay();

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
        window.inventorySystem.updateInventoryDisplay();

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
    case "thimbleriggerMet":
      window.thimbleriggerSystem.setThimbleriggerMet(data.met);
      break;
    case "thimbleriggerBetResult":
      if (data.success) {
        const me = players.get(myId);
        me.inventory = data.inventory.map((i) => (i ? { ...i } : null));
        window.inventorySystem.updateInventoryDisplay();

        // Начинаем игру на клиенте (передаём bet)
        startSimpleGame(data.bet);
      } else {
        showNotification(
          data.error || "Недостаточно баляров для ставки!",
          "#ff0066",
        );
      }
      break;
    case "thimbleriggerGameResultSync":
      if (data.success) {
        const me = players.get(myId);
        me.inventory = data.inventory.map((i) => (i ? { ...i } : null));
        window.inventorySystem.updateInventoryDisplay();

        if (window.levelSystem) {
          window.levelSystem.setLevelData(
            data.level,
            data.xp,
            null, // maxStats не меняем
            data.upgradePoints,
          );
          window.levelSystem.showXPEffect(data.xpGained || 0);

          // ← ДОБАВЛЕНО: динамическое обновление level-display после +XP
          window.levelSystem.updateLevelDisplay();
          window.levelSystem.checkLevelUp(); // На всякий, хотя сервер уже проверил
        }
        updateStatsDisplay();

        showNotification(
          data.won ? "Выигрыш зачислен! +XP" : "Проигрыш подтверждён.",
          data.won ? "#00ff00" : "#ff0000",
        );
      } else {
        showNotification(data.error || "Ошибка в результате игры.", "#ff0066");
      }
      break;
    case "buyFromJackSuccess":
      {
        // Обновляем инвентарь из сервера
        inventory = data.inventory.map((slot) => (slot ? { ...slot } : null));
        const me = players.get(myId);
        if (me) {
          me.inventory = [...inventory]; // Синхронизируем с игроком
          players.set(myId, me);
        }
        window.inventorySystem.updateInventoryDisplay();
        updateStatsDisplay();

        // Перезагружаем диалог магазина (обновит grid)
        if (jackDialogStage === "shop") {
          showJackDialog("shop");
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
        window.inventorySystem.updateInventoryDisplay();
        updateStatsDisplay();

        // Перезагружаем диалог скупки
        if (jackDialogStage === "buyback") {
          showJackDialog("buyback");
        }
      }
      break;
    case "sellToJackFail":
      alert(data.error || "Ошибка продажи");
      break;
    case "twister":
      if (window.misterTwister?.handleMessage) {
        window.misterTwister.handleMessage(data);
      }
      break;
    case "trashGuessResult":
      const msgEl = document.getElementById("trashMessage");
      const cardEl = document.getElementById("cardBack");

      if (!msgEl || !cardEl) break;

      if (data.success) {
        msgEl.textContent = "Угадал! Забирай лут!";
        msgEl.style.color = "#00ff44";

        showNotification("Мусорный бак открыт! +лут и XP", "#44ff44");

        if (data.loot) {
          let lootText = "Получено: ";
          data.loot.forEach((it) => {
            lootText += `${it.type} ×${it.quantity || 1}, `;
          });
          msgEl.textContent += "\n" + lootText.slice(0, -2);
        }

        if (data.xpGained) {
          if (window.levelSystem?.showXPEffect) {
            window.levelSystem.showXPEffect(data.xpGained);
          }
          showNotification(`+${data.xpGained} XP`, "#ffff44");
        }

        window.inventorySystem?.updateInventoryDisplay();
        updateStatsDisplay();
      } else {
        msgEl.textContent = data.message || data.error || "Не угадал...";
        msgEl.style.color = "#ff4444";

        showNotification(
          data.message || "Не та масть... подожди 3 минуты",
          "#ff4444",
        );

        if (data.waitUntil) {
          const remainSec = Math.ceil((data.waitUntil - Date.now()) / 1000);
          msgEl.textContent += ` (ещё ~${remainSec} сек)`;
        }
      }
      break;

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
          const msgEl = document.getElementById("trashMessage");
          if (msgEl) {
            msgEl.textContent = "Этот бак уже кто-то открыл...";
            msgEl.style.color = "#ffaa00";
          }
          document.querySelectorAll(".suit-btn").forEach((btn) => {
            btn.disabled = true;
            btn.style.opacity = "0.4";
          });
        }
      }
      break;

    case "trashState":
      if (data.index >= 0 && data.index < window.trashCansState.length) {
        window.trashCansState[data.index] = {
          ...window.trashCansState[data.index],
          guessed: data.guessed ?? false,
          isOpened: data.isOpened ?? false,
          // nextAttemptAfter больше не нужен здесь
        };

        if (currentTrashIndex === data.index) {
          const msgEl = document.getElementById("trashMessage");
          if (msgEl) {
            if (data.isOpened) {
              msgEl.textContent = "Бак пуст... подожди респавна";
              msgEl.style.color = "#888888";
              document
                .querySelectorAll(".suit-btn")
                .forEach((btn) => (btn.disabled = true));
            }
            // убираем блок с nextAttemptAfter
          }
        }
      }
      break;
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
    case "torestosMet":
      window.torestosSystem.setTorestosMet(data.met);
      break;
    case "torestosUpgradeResult":
      const upgradeBtn = document.querySelector(
        ".upgrade-buttons .torestos-neon-btn",
      );

      if (data.success) {
        window.inventory = data.newInventory.map((i) => (i ? { ...i } : null));
        window.inventorySystem.updateInventoryDisplay();
        updateStatsDisplay();

        showNotification(data.message || "Предмет успешно улучшен!", "#00ff88");

        // Перерисовываем интерфейс Торестоса
        if (isDialogOpen) {
          renderUpgradeUI(); // ← вызови свою функцию renderUpgradeUI()
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
      window.toremidosSystem?.setMet?.(data.met);
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
        window.inventorySystem.updateInventoryDisplay();
        updateStatsDisplay(); // на всякий случай, если статы могли измениться
      }

      // Также обновляем интерфейс склада, если он открыт
      if (window.homelessSystem?.handleMessage) {
        window.homelessSystem.handleMessage(data);
      }
      break;
    case "upgradeSkillResult":
      if (data.success) {
        // Обновляем локальные данные навыков
        window.skillsSystem.playerSkills =
          data.skills || window.skillsSystem.playerSkills;
        window.skillsSystem.skillPoints =
          data.remainingPoints || window.skillsSystem.skillPoints;

        // Если окно навыков открыто — обновляем его
        if (window.skillsSystem.isSkillsOpen) {
          window.skillsSystem.updateSkillsDisplay();
          window.skillsSystem.updateSkillPointsDisplay();
        }

        // Если открыто окно Торемидоса — тоже обновляем
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
        if (data.skillId === 2) {
          window.regenerationSystem.start();
        }
      } else {
        showNotification(data.error || "Не удалось улучшить навык", "#ff4444");
      }
      break;
    case "updateLevel":
      // Обновляем уровень, XP, очки улучшений
      window.levelSystem.setLevelData(
        data.level,
        data.xp,
        null,
        data.upgradePoints,
      );

      // Обновляем очки навыков (самое важное!)
      if (data.skillPoints !== undefined) {
        const oldPoints = window.skillsSystem.skillPoints;
        window.skillsSystem.skillPoints = Number(data.skillPoints);

        // Если очки увеличились — показываем уведомление
        if (data.skillPoints > oldPoints) {
          showNotification(
            `+${data.skillPoints - oldPoints} очков навыков за уровень!`,
            "#ffaa00",
          );
        }

        // Если окно навыков открыто — обновляем
        if (window.skillsSystem.isSkillsOpen) {
          window.skillsSystem.updateSkillPointsDisplay();
        }
      }

      updateStatsDisplay();
      break;
    case "regenerationApplied":
      if (data.playerId === myId) {
        // Здоровье уже пришло через "update" → просто синхронизируем на всякий случай
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
  }
}

async function processMessageQueue() {
  if (window.isProcessingMessages) return;
  window.isProcessingMessages = true;

  while (window.incomingMessageQueue.length > 0) {
    const data = window.incomingMessageQueue.shift();

    try {
      await handleGameMessageLogic(data);
    } catch (err) {
      console.error(
        "Критическая ошибка при обработке сообщения из очереди:",
        err,
        data,
      );
    }
  }

  window.isProcessingMessages = false;
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
  window.atomFrameTime += deltaTime;
  while (window.atomFrameTime >= ATOM_FRAME_DURATION) {
    window.atomFrameTime -= ATOM_FRAME_DURATION;
    window.atomFrame = (window.atomFrame + 1) % ATOM_FRAMES;
  }

  const me = players.get(myId);
  if (!me) return;

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

    // === ОТСЛЕЖИВАНИЕ ПЕРЕХОДА В АТАКУ ===
    // Сохраняем предыдущее состояние (нужно для детекта начала атаки)
    if (player.prevState === undefined) {
      player.prevState = player.state;
    }

    // Если только что перешёл в атаку — принудительно запускаем анимацию с начала
    if (player.state === "attacking" && player.prevState !== "attacking") {
      player.attackFrame = 0;
      player.attackFrameTime = 0;
      player.animTime = 0; // на всякий случай сбрасываем ходьбу
      player.frame = 0;
    }

    // Обновляем prevState для следующего кадра
    player.prevState = player.state;

    // Атака — фиксируем кадр с сервера
    if (player.state === "attacking") {
      // Таймеры инициализируются при переходе в атаку (выше)
      player.attackFrameTime += deltaTime;

      const ATTACK_FRAME_DURATION = 500 / ATTACK_FRAME_COUNT; // ~38.46 мс на кадр (500 мс на всю атаку)

      while (player.attackFrameTime >= ATTACK_FRAME_DURATION) {
        player.attackFrameTime -= ATTACK_FRAME_DURATION;
        player.attackFrame += 1;

        if (player.attackFrame >= ATTACK_FRAME_COUNT) {
          // Анимация закончилась
          player.attackFrame = 0;
          player.attackFrameTime = 0;

          // Определяем, куда возвращаться
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
      // Не атакует — сбрасываем всё связанное с атакой
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

  window.movementSystem.update(deltaTime);

  // Обновление систем
  window.combatSystem.update(deltaTime);
  window.enemySystem.update(deltaTime);

  if (window.neonNpcSystem) window.neonNpcSystem.update(deltaTime);
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
  window.toremidosSystem?.checkProximity?.();
  window.toremidosSystem?.update?.(deltaTime);
  window.homelessSystem?.checkProximity?.();
  window.homelessSystem?.update?.(deltaTime);
  window.misterTwister.checkProximity();
  if (window.trashCansSystem) {
    window.trashCansSystem.update(deltaTime);
  }
  window.portalSystem.checkProximity();
  window.worldSystem.checkTransitionZones(me.x, me.y);
}

function draw(deltaTime) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(10, 20, 40, 0.8)"; // Ночной эффект
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const currentWorld = window.worldSystem.getCurrentWorld();
  const currentWorldId = window.worldSystem.currentWorldId;
  const groundSpeed = 1.0,
    vegetationSpeed = 1.0,
    rocksSpeed = 0.5,
    cloudsSpeed = 0.3;
  const groundOffsetX = window.movementSystem.getCamera().x * groundSpeed;
  const vegetationOffsetX =
    window.movementSystem.getCamera().x * vegetationSpeed;
  const rocksOffsetX = window.movementSystem.getCamera().x * rocksSpeed;
  const cloudsOffsetX = window.movementSystem.getCamera().x * cloudsSpeed;

  // Рисуем фон
  if (currentWorld.bg && currentWorld.bg.complete) {
    ctx.fillStyle = ctx.createPattern(currentWorld.bg, "repeat");
    ctx.save();
    ctx.translate(
      -(groundOffsetX % currentWorld.bg.width),
      -(window.movementSystem.getCamera().y * groundSpeed) %
        currentWorld.bg.height,
    );
    ctx.fillRect(
      (groundOffsetX % currentWorld.bg.width) - currentWorld.bg.width,
      ((window.movementSystem.getCamera().y * groundSpeed) %
        currentWorld.bg.height) -
        currentWorld.bg.height,
      currentWorld.w + currentWorld.bg.width,
      currentWorld.h + currentWorld.bg.height,
    );
    ctx.restore();
  } else {
    ctx.fillStyle = "rgba(10, 20, 40, 1)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  window.lightsSystem.draw(deltaTime);

  // Отрисовка предметов (оптимизировано: без дубликатов, с ранней проверкой видимости)
  const cameraX = window.movementSystem.getCamera().x;
  const cameraY = window.movementSystem.getCamera().y;
  // Предметы — оптимизированная отрисовка
  const viewWidth = canvas.width + 100;
  const viewHeight = canvas.height + 100;

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
        window.atomFrame * 50,
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

  // Остальные слои
  if (currentWorld.rocks.complete) {
    ctx.drawImage(
      currentWorld.rocks,
      rocksOffsetX,
      window.movementSystem.getCamera().y * rocksSpeed,
      canvas.width,
      canvas.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }

  if (window.cockroachSystem) {
    window.cockroachSystem.draw();
  }
  if (window.vacuumRobotSystem) {
    window.vacuumRobotSystem.draw();
  }

  window.jackSystem.drawJack(deltaTime);
  window.combatSystem.draw();
  window.enemySystem.draw();
  window.corporateRobotSystem.draw();

  players.forEach((player) => {
    if (player.worldId !== currentWorldId) return;

    const screenX = player.x - cameraX;
    const screenY = player.y - cameraY;
    if (
      screenX < -80 ||
      screenX > viewWidth ||
      screenY < -80 ||
      screenY > viewHeight
    )
      return;

    // ─── Отрисовка спрайта игрока (без изменений) ───
    let spriteX, spriteY;
    let effectiveState = player.state;

    if (player.health <= 0) {
      effectiveState = "idle";
    }

    if (effectiveState === "attacking") {
      let frame = player.attackFrame || 0;
      if (frame >= ATTACK_FRAME_COUNT) frame = ATTACK_FRAME_COUNT - 1;
      spriteX = frame * PLAYER_FRAME_WIDTH;
      spriteY =
        player.direction === "up" || player.direction === "down"
          ? SPRITE_ROWS.attack_up_down
          : player.direction === "right"
            ? SPRITE_ROWS.attack_right
            : SPRITE_ROWS.attack_left;
    } else {
      const frame = effectiveState === "walking" ? player.frame : 0;
      spriteX = frame * PLAYER_FRAME_WIDTH;
      spriteY =
        {
          up: SPRITE_ROWS.walk_up,
          down: SPRITE_ROWS.walk_down,
          left: SPRITE_ROWS.walk_left,
          right: SPRITE_ROWS.walk_right,
        }[player.direction] || SPRITE_ROWS.walk_down;
    }

    window.portalSystem.draw(deltaTime);

    if (images.playerSprite?.complete) {
      ctx.drawImage(
        images.playerSprite,
        spriteX,
        spriteY,
        PLAYER_FRAME_WIDTH,
        PLAYER_FRAME_HEIGHT,
        screenX,
        screenY,
        70,
        70,
      );
    } else {
      ctx.fillStyle = "blue";
      ctx.fillRect(screenX, screenY, 70, 70);
    }

    if (currentWorld.veg.complete) {
      ctx.drawImage(
        currentWorld.veg,
        vegetationOffsetX,
        window.movementSystem.getCamera().y * vegetationSpeed,
        canvas.width,
        canvas.height,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    }

    window.bonfireSystem.draw();

    // ─── Имя и здоровье (без изменений) ───
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

    // ─── НОВОЕ: баббл чата над головой ───
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
            // Слово — рисуем с обводкой
            ctx.strokeText(part, currentX, lineY);
            ctx.fillText(part, currentX, lineY);
            currentX += ctx.measureText(part).width;
          }
        });
      } else {
        player.chatBubble = null;
      }
    }

    ctx.shadowBlur = 0;
  });

  window.misterTwister.draw();
  window.vendingMachine.draw();
  if (window.robotDoctorSystem) {
    window.robotDoctorSystem.draw();
  }
  window.thimbleriggerSystem.drawThimblerigger(deltaTime);
  window.npcSystem.drawNPC(deltaTime);
  window.outpostCaptainSystem.drawCaptain(ctx, cameraX, cameraY);
  clockSystem.draw();
  if (window.trashCansSystem) {
    window.trashCansSystem.draw(ctx);
  }
  window.torestosSystem.drawTorestos(deltaTime);
  window.toremidosSystem?.draw?.(deltaTime);
  window.homelessSystem?.draw?.();
  window.jackSystem.drawJack(deltaTime);
  window.droneSystem.draw();
  if (window.neonNpcSystem) {
    window.neonNpcSystem.draw();
  }
  window.corporateRobotSystem.draw();

  if (currentWorld.clouds.complete) {
    ctx.drawImage(
      currentWorld.clouds,
      cloudsOffsetX,
      window.movementSystem.getCamera().y * cloudsSpeed,
      canvas.width,
      canvas.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }
  window.worldSystem.drawTransitionZones();
}

function checkCollisions() {
  const me = players.get(myId);
  if (!me || me.health <= 0) return;

  const currentWorldId = window.worldSystem.currentWorldId;
  items.forEach((item, id) => {
    if (item.worldId !== currentWorldId) return;
    if (!items.has(id)) return; // Убрал console.log для оптимизации
    if (pendingPickups.has(id)) return; // Убрал console.log

    const dx = me.x + 35 - (item.x + 10);
    const dy = me.y + 35 - (item.y + 10);
    const distanceSquared = dx * dx + dy * dy; // Используем квадрат расстояния вместо Math.sqrt для снижения нагрузки на CPU
    // Убрал console.log проверки расстояния

    if (distanceSquared < 2500) {
      // 50^2 = 2500, чтобы избежать дорогого Math.sqrt
      if (ws.readyState === WebSocket.OPEN) {
        pendingPickups.add(id);
        sendWhenReady(ws, JSON.stringify({ type: "pickup", itemId: id }));
        // Убрал console.log отправки и попытки подбора
      } else {
        // Убрал console.error
      }
    }
  });
}

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp; // Инициализация, как у тебя

  // Проверяем, пора ли рендерить (не чаще 30 FPS)
  if (timestamp - lastRender < 1000 / FPS) {
    requestAnimationFrame(gameLoop);
    return;
  }

  // Рассчитываем deltaTime только для рендера
  const deltaTime = timestamp - lastTime;
  lastTime = timestamp;
  lastRender = timestamp; // Обновляем время последнего рендера

  update(deltaTime);
  draw(deltaTime);
  requestAnimationFrame(gameLoop);
}

// Инициализация изображений (без изменений)
function onImageLoad() {
  imagesLoaded++;
  if (imagesLoaded === 30) window.addEventListener("resize", resizeCanvas);
}
