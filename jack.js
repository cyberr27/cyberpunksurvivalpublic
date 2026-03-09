// jack.js (торговец, брат John) — Полная рабочая версия с скупкой
const JACK = {
  x: 1150,
  y: 437,
  width: 80,
  height: 80,
  spriteWidth: 70,
  spriteHeight: 70,
  interactionRadius: 50,
  name: "Jack",
};

let isJackDialogOpen = false;
let jackDialogStage = "greeting";
let isJackMet = false;
let jackSprite = null;

// Анимация
let jackFrame = 0;
let jackFrameTime = 0;
const JACK_FRAME_DURATION = 500;
const JACK_FRAMES_PER_ROW = 13;
const JACK_ANIMATION_ROW1_DURATION = 13 * JACK_FRAME_DURATION;
const JACK_ANIMATION_ROW2_IDLE_DURATION = 8000;

let jackCurrentAnimationPhase = "idle";
let jackPhaseTimer = 0;

// Кнопки над Джеком
let jackButtonsContainer = null;
let isPlayerNearJack = false;

// КРИТИЧНО: Флаг для предотвращения повторного показа приветствия
let hasJackGreetingBeenShown = false;

// Переменные для скупки
let selectedBuybackSlot = null;

// Инициализация стилей (подключаем jack.css)
function initializeJackStyles() {
  if (!document.getElementById("jackStylesLink")) {
    const link = document.createElement("link");
    link.id = "jackStylesLink";
    link.rel = "stylesheet";
    link.href = "jack.css";
    document.head.appendChild(link);
  }
}

// Создание кнопок (3 кнопки: Говорить, Магазин, Скупка)
function createJackButtons(screenX, screenY) {
  if (jackButtonsContainer) document.body.removeChild(jackButtonsContainer);

  jackButtonsContainer = document.createElement("div");
  jackButtonsContainer.className = "jack-buttons-container";

  const totalButtonsHeight = 45 * 3 + 16 * 2; // 3 кнопки
  jackButtonsContainer.style.left = screenX + JACK.width / 2 + "px";
  jackButtonsContainer.style.top = screenY - totalButtonsHeight - 25 + "px";
  jackButtonsContainer.style.transform = "translateX(-50%)";

  // КНОПКА 1: Говорить
  const talkBtn = document.createElement("div");
  talkBtn.className = "jack-button-talk";
  talkBtn.textContent = "Говорить";
  talkBtn.addEventListener("click", openJackTalkDialog);
  jackButtonsContainer.appendChild(talkBtn);

  // КНОПКА 2: Магазин
  const shopBtn = document.createElement("div");
  shopBtn.className = "jack-button-shop";
  shopBtn.textContent = "Магазин";
  shopBtn.addEventListener("click", openJackShopDialog);
  jackButtonsContainer.appendChild(shopBtn);

  // КНОПКА 3: СКУПКА (НОВАЯ)
  const buybackBtn = document.createElement("div");
  buybackBtn.className = "jack-button-buyback";
  buybackBtn.textContent = "Скупка";
  buybackBtn.addEventListener("click", openJackBuybackDialog);
  jackButtonsContainer.appendChild(buybackBtn);

  document.body.appendChild(jackButtonsContainer);
}

function removeJackButtons() {
  if (jackButtonsContainer) {
    document.body.removeChild(jackButtonsContainer);
    jackButtonsContainer = null;
  }
}

// НОВЫЕ ФУНКЦИИ ДЛЯ КНОПОК
function openJackTalkDialog() {
  showJackDialog("talk");
}

function openJackShopDialog() {
  showJackDialog("shop");
}

function openJackBuybackDialog() {
  showJackDialog("buyback");
}

// Отрисовка Jack (без изменений)
function drawJack(deltaTime) {
  if (window.worldSystem.currentWorldId !== 0) return;

  const camera = window.movementSystem.getCamera();
  const screenX = JACK.x - camera.x;
  const screenY = JACK.y - camera.y;

  // Периодическая анимация
  const me = players.get(myId);
  const dx = me ? me.x + 35 - (JACK.x + 35) : 9999;
  const dy = me ? me.y + 35 - (JACK.y + 35) : 9999;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const isPlayerNear = distance < JACK.interactionRadius;

  if (isPlayerNear) {
    // Рядом с игроком — всегда первый кадр (покой)
    jackFrame = 0;
    jackCurrentAnimationPhase = "idle";
    jackPhaseTimer = 0;
  } else {
    // Игрок далеко → анимация
    jackPhaseTimer += deltaTime;

    if (jackCurrentAnimationPhase === "idle") {
      jackFrame = 0;
      // Через 8 секунд начинаем вторую строку
      if (jackPhaseTimer >= JACK_ANIMATION_ROW2_IDLE_DURATION) {
        jackCurrentAnimationPhase = "row2";
        jackPhaseTimer = 0;
        jackFrame = JACK_FRAMES_PER_ROW; // первый кадр второй строки = 13
      }
    } else if (jackCurrentAnimationPhase === "row2") {
      // Проигрываем вторую строку (кадры 13..25)
      jackFrame =
        JACK_FRAMES_PER_ROW + Math.floor(jackPhaseTimer / JACK_FRAME_DURATION);

      // 8 секунд прошло → переходим на одну прокрутку первой строки
      if (jackPhaseTimer >= JACK_ANIMATION_ROW2_IDLE_DURATION) {
        jackCurrentAnimationPhase = "row1";
        jackPhaseTimer = 0;
        jackFrame = 0;
      }
    } else if (jackCurrentAnimationPhase === "row1") {
      // Проигрываем один раз первую строку (кадры 0..12)
      jackFrame = Math.floor(jackPhaseTimer / JACK_FRAME_DURATION);

      // Закончили один проход первой строки → возвращаемся к 8 секундам второй
      if (jackPhaseTimer >= JACK_ANIMATION_ROW1_DURATION) {
        jackCurrentAnimationPhase = "row2";
        jackPhaseTimer = 0;
        jackFrame = JACK_FRAMES_PER_ROW;
      }
    }
  }

  if (jackSprite && jackSprite.complete) {
    let sourceY = 0;
    if (jackFrame >= JACK_FRAMES_PER_ROW) {
      sourceY = 70;
    }

    let frameInRow = jackFrame % JACK_FRAMES_PER_ROW;

    ctx.drawImage(
      jackSprite,
      frameInRow * 70,
      sourceY,
      70,
      70,
      screenX,
      screenY,
      JACK.width,
      JACK.height,
    );
  } else {
    ctx.fillStyle = "purple";
    ctx.fillRect(screenX, screenY, JACK.width, JACK.height);
  }

  // Рисуем имя
  ctx.fillStyle = isJackMet ? "#15ce00ff" : "#ffffff";
  ctx.font = "12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(
    isJackMet ? JACK.name : "?",
    screenX + JACK.width / 2,
    screenY - 10,
  );

  // Обновляем позицию кнопок
  if (isPlayerNearJack && jackButtonsContainer) {
    const totalButtonsHeight = 45 * 3 + 16 * 2;
    jackButtonsContainer.style.left = screenX + JACK.width / 2 + "px";
    jackButtonsContainer.style.top = screenY - totalButtonsHeight - 25 + "px";
  }
}

// Проверка расстояния (адаптировано под 3 кнопки)
function checkJackProximity() {
  const me = players.get(myId);
  if (!me || me.health <= 0) return;

  const dx = me.x + 35 - (JACK.x + 35);
  const dy = me.y + 35 - (JACK.y + 35);
  const distance = Math.sqrt(dx * dx + dy * dy);
  const isNear = distance < JACK.interactionRadius;

  if (isNear) {
    if (!isJackDialogOpen) {
      if (!isJackMet && !hasJackGreetingBeenShown) {
        hasJackGreetingBeenShown = true;
        openJackDialog();
      } else if (isJackMet && !isPlayerNearJack) {
        isPlayerNearJack = true;
        const camera = window.movementSystem.getCamera();
        createJackButtons(JACK.x - camera.x, JACK.y - camera.y);
      }
    }
  } else {
    if (isJackDialogOpen) closeJackDialog();
    if (isPlayerNearJack) {
      isPlayerNearJack = false;
      removeJackButtons();
    }
  }
}

// Универсальная функция показа диалога
function showJackDialog(stage) {
  jackDialogStage = stage;

  let container = document.getElementById("jackDialog");
  if (container) {
    container.remove();
  }

  container = document.createElement("div");
  container.id = "jackDialog";
  container.className = `jack-dialog ${stage}`;
  document.body.appendChild(container);

  switch (stage) {
    case "greeting":
      jackShowGreetingDialog(container);
      break;
    case "talk":
      openJackTalkDialogContent(container);
      break;
    case "shop":
      showShopDialog(container);
      break;
    case "buyback":
      showBuybackDialog(container);
      break;
  }

  document.body.classList.add("npc-dialog-active");
  isJackDialogOpen = true;
}

// Открытие диалога (старое название для обратной совместимости)
function openJackDialog(skipGreeting = false) {
  if (!isJackMet && !skipGreeting) {
    showJackDialog("greeting");
  } else {
    showJackDialog("shop");
  }
}

// Закрытие
function closeJackDialog() {
  const dlg = document.getElementById("jackDialog");
  if (dlg) dlg.remove();
  isJackDialogOpen = false;
  document.body.classList.remove("npc-dialog-active");
  if (!isJackMet) hasJackGreetingBeenShown = false;
}

// Приветствие (без изменений)
function jackShowGreetingDialog(container) {
  container.innerHTML = `
    <div class="jack-dialog-header">
      <img src="jackPhoto.png" alt="Jack Photo" class="jack-photo">
      <h2 class="jack-title">${JACK.name}</h2>
    </div>
    <p class="jack-text">Привет я Джек бывший контрабандист, теперь торговец. Я всегда был в тени Джона — он инженер, я уличный делец. После Отключения я торговал на черном рынке: от плазменных ружей до атомов. Теперь продаю то, что брат скупит у новичков. Город — джунгли, где выживает хитрый. Купи у меня — или умри от нехватки ресурсов.</p>
    <button class="jack-button" id="meetJackBtn">Познакомиться</button>
  `;

  document.getElementById("meetJackBtn").addEventListener("click", () => {
    isJackMet = true;
    sendWhenReady(ws, JSON.stringify({ type: "meetJack" }));
    closeJackDialog();
    isPlayerNearJack = true;
    const camera = window.movementSystem.getCamera();
    createJackButtons(JACK.x - camera.x, JACK.y - camera.y);
  });
}

// Диалог разговора (перенесена логика из openJackTalkDialog)
function openJackTalkDialogContent(container) {
  const topics = [
    {
      title: "Черный Рынок и Секреты",
      text: "Черный рынок в нижних уровнях — это сердце Неонового Города, где торгуют всем, от имплантов до секретов корпораций. Я провёл там годы, прячась в туннелях, где неон еле мигает, и подслушивал сделки: один тип продавал хакерские чипы, способные взломать ИИ, другой — карты забытых бункеров. Рынок родился после Отключения, когда официальная экономика рухнула, и люди начали обмениваться теневыми товарами. Там полно секретов: шепот о корпоративных заговорах, рецепты мутированных грибов из джунглей. Но опасности везде — банды устраивают засады, а патрули корпораций сжигают всё. Я выжил, зная, когда молчать, а когда слушать. Рынок учит: в городе информация — оружие острее любого ножа.",
    },
    {
      title: "Корпоративные Интриги",
      text: "Корпорации вроде 'NeoCorp' плетут интриги в верхних башнях, где неон слепит глаза, а воздух пахнет деньгами. Они дерутся между собой: 'ShadowTech' крадёт технологии у конкурентов, устраивая саботаж в сетях. Я подслушивал их агентов в барах — они сливают токсины в джунгли, чтобы ослабить банды, и тестируют импланты на уличных крысах. Интриги начались давно: после Отключения корпорации обвиняли друг друга в саботаже ИИ. Теперь они заключают тайные альянсы, обещая бессмертие, но на деле сеют хаос. Я видел, как один босс предал партнёра, сбросив его с башни. В этом мире корпорации — пауки в паутине, и мы, внизу, — мухи, ждущие своей очереди.",
    },
    {
      title: "Ночные Улицы Неона",
      text: "Ночные улицы Неонового Города — это живое существо: неоновые огни мигают как пульс, голограммы шепчут рекламу забытых продуктов, а тени скрывают опасности. Я бродил по ним часами, избегая патрулей, и видел всё: банды дерутся за угол, мутанты из джунглей крадутся в канализации. Ночи стали хуже после Отключения — без света город сошёл с ума, люди мутировали от радиации. Теперь улицы оживают: торговцы шепчут секреты, хакеры взламывают сети под неоном. Я прятался в переулках, слушая истории о потерянных артефактах. Ночь учит: в темноте выживает тот, кто видит дальше света, а неон — лишь иллюзия безопасности.",
    },
    {
      title: "Баляры и Богатство",
      text: "Баляры — это валюта выживших, осколки старого цифрового мира, которые стали золотом после краха банков. Я копил их в молодости, обходя корпорации, и видел, как богатство меняет людей: один стал королём трущоб, другой — жертвой банд. Богатство в городе — мираж: корпорации печатают баляры для элиты, а мы дерёмся за крохи. После Отключения баляры спасли многих — ими платили за еду, импланты. Но оно притягивает беды: зависть, предательства. Я знал парня, который накопил кучу, но потерял всё в одной ночи от хакера. В Неоновом Городе богатство — цепь, которая тянет вниз, если не быть хитрым.",
    },
    {
      title: "Банды и Альянсы",
      text: "Банды Неонового Города заключают альянсы, как волки в стае: 'Неоновые Тени' объединяются с 'Красными Клинками' против корпораций, обмениваясь оружием и территориями. Я наблюдал за ними из тени — они дерутся за контроль над уровнями, используя плазменные ружья и импланты. Альянсы хрупкие: сегодня союзники, завтра — враги из-за предательства. После Отключения банды выросли из уличных бродяг, заполняя вакуум власти. Я видел, как один альянс захватил целый уровень, но рухнул от внутренней войны. Банды учат: в городе сила в числах, но доверие — редкость, и один нож в спину меняет всё.",
    },
    {
      title: "Пустоши и Контрабанда",
      text: "Пустоши за городом — царство забытых вещей, где сухая земля скрывает контрабанду: обломки технологий, флаконы с водкой от радиации. Я ездил туда караванами, рискуя жизнью в песчаных бурях, и находил артефакты — старые импланты, мутированные растения. Контрабанда процветает: банды переправляют её в город, обходя патрули. Пустоши изменились после Отключения — радиация создала монстров, а земля высохла. Я потерял друзей в одной вылазке: буря засыпала нас, и только хитрость спасла. Это место напоминает, что город — лишь фасад, а настоящие сокровища в забытых землях, полных опасностей.",
    },
    {
      title: "Братья и Семейные Связи",
      text: "Мой брат Джон — идеалист, всегда помогает другим в этом безумном городе. Мы потеряли родителей в Отключении: они погибли в хаосе, оставив нас вдвоём в трущобах. Джон научился чинить гаджеты, а я — маневрировать в тенях, избегая банд. Семейные связи редки здесь: люди предают за выгоду, но наша держится на воспоминаниях. Джон рассказывает о технологиях, я — о улицах. В Неоновом Городе семья — слабость, которую эксплуатируют, но и сила, что помогает пережить ночь. Мы разные, но вместе — выжившие в аду.",
    },
    {
      title: "Падение и Возрождение Города",
      text: "Неоновый Город на грани падения: неон угасает, корпорации гниют изнутри, ИИ бунтует в сетях. Я видел признаки — перебои в энергии, мятежи в нижних уровнях. Падение начнётся с нового Отключения, и город рухнет, как карточный домик. Но из пепла может родиться возрождение: выжившие, как мы, построят новый порядок, без корпоративных цепей. Я копил знания о слабостях системы, зная, что хаос — шанс для хитрых. Город возродится, если мы будем готовы: джунгли очистятся, пустоши оживут. В этом цикле падения и подъёма выживает тот, кто видит дальше неона.",
    },
  ];

  container.innerHTML = `
    <div class="jack-dialog-header">
      <img src="jackPhoto.png" alt="Jack Photo" class="jack-photo">
      <h2 class="jack-title">${JACK.name}</h2>
    </div>
    <div class="jack-dialog-content">
      <p class="jack-text">Слушаю тебя, покупатель...</p>
      <div id="talkTopics" class="talk-topics"></div>
    </div>
    <button id="closeTalkBtn" class="jack-button">Закрыть</button>
  `;

  const jackText = container.querySelector(".jack-text");
  const topicsContainer = document.getElementById("talkTopics");
  const closeBtn = document.getElementById("closeTalkBtn");

  topics.forEach((topic) => {
    const div = document.createElement("div");
    div.className = "talk-topic";
    div.innerHTML = `<strong>${topic.title}</strong>`;
    div.addEventListener("click", () => {
      topicsContainer.classList.add("hidden");
      jackText.classList.add("fullscreen");
      jackText.innerHTML = `<div style="flex:1;overflow-y:auto;padding-right:10px;">${topic.text}</div>`;
      closeBtn.textContent = "Понятно";
      closeBtn.onclick = showTopics;
    });
    topicsContainer.appendChild(div);
  });

  function showTopics() {
    topicsContainer.classList.remove("hidden");
    jackText.classList.remove("fullscreen");
    jackText.textContent = "Слушаю тебя, покупатель...";
    closeBtn.textContent = "Закрыть";
    closeBtn.onclick = closeJackDialog;
  }

  closeBtn.onclick = closeJackDialog;
}

// Магазин (без изменений)
let selectedItemType = null;
let selectedPrice = 0;

function showShopDialog(container) {
  container.innerHTML = `
    <div class="jack-dialog-header">
      <img src="jackPhoto.png" alt="Jack Photo" class="jack-photo">
      <h2 class="jack-title">${JACK.name}</h2>
    </div>
    <p class="jack-text">Что хочешь купить? Цены в balyary.</p>
    <div id="shopGrid" class="shop-grid"></div>
    <div class="shop-buttons">
      <button class="jack-button" id="buyBtn" disabled>Купить</button>
      <button class="jack-button" id="closeShopBtn">Закрыть</button>
    </div>
  `;

  const grid = document.getElementById("shopGrid");
  const buyBtn = document.getElementById("buyBtn");
  const closeBtn = document.getElementById("closeShopBtn");

  closeBtn.addEventListener("click", closeJackDialog);

  const BLACKLIST = ["balyary", "atom", "blood_pack", "blood_syringe"];

  const availableItems = Object.entries(ITEM_CONFIG).filter(([type, cfg]) => {
    const isBlacklisted = BLACKLIST.includes(type);
    const isWeapon = cfg.category === "weapon";
    const isRarityValid = cfg.rarity >= 1 && cfg.rarity <= 3;
    return isRarityValid && !isBlacklisted && !isWeapon;
  });

  availableItems.forEach(([type, cfg]) => {
    const price = cfg.rarity;
    const itemEl = document.createElement("div");
    itemEl.className = "shop-item";
    itemEl.innerHTML = `
      <img src="${cfg.image.src}" alt="${type}" width="40" height="40" style="margin-right:10px;">
      <div>
        <p>${cfg.description} <span class="shop-reward">[Цена: ${price} balyary]</span></p>
      </div>
    `;

    itemEl.addEventListener("click", () => {
      document
        .querySelectorAll(".shop-item")
        .forEach((el) => el.classList.remove("selected"));
      itemEl.classList.add("selected");
      selectedItemType = type;
      selectedPrice = price;
      buyBtn.disabled = false;
    });

    grid.appendChild(itemEl);
  });

  buyBtn.addEventListener("click", () => {
    if (selectedItemType) buyItem(selectedItemType, selectedPrice);
  });
}

// Покупка (без изменений)
function buyItem(type, price) {
  if (ws.readyState === WebSocket.OPEN) {
    sendWhenReady(
      ws,
      JSON.stringify({ type: "buyFromJack", itemType: type, price }),
    ); // Отправляем тип и цену (сервер проверит)
  } else {
    alert("Соединение потеряно. Попробуйте позже.");
  }
}

// НОВЫЙ ДИАЛОГ СКУПКИ
function showBuybackDialog(container) {
  container.innerHTML = `
    <div class="jack-dialog-header">
      <img src="jackPhoto.png" alt="Jack Photo" class="jack-photo">
      <h2 class="jack-title">${JACK.name}</h2>
    </div>
    <p class="jack-text">Возьму только продукты питания</p>
    <div id="buybackInventoryGrid" class="buyback-inventory-grid"></div>
    <div class="buyback-buttons">
      <button class="jack-button" id="sellBtn" disabled>Продать (1 баляр)</button>
      <button class="jack-button" id="closeBuybackBtn">Выход</button>
    </div>
  `;

  const grid = document.getElementById("buybackInventoryGrid");
  const sellBtn = document.getElementById("sellBtn");
  const closeBtn = document.getElementById("closeBuybackBtn");

  closeBtn.addEventListener("click", closeJackDialog);

  // Создаем копию инвентаря (5x4 сетка)
  inventory.forEach((item, index) => {
    const slot = document.createElement("div");
    slot.className = "buyback-inventory-slot";
    if (item) {
      const img = document.createElement("img");
      img.src = ITEM_CONFIG[item.type]?.image?.src || "";
      img.width = 40;
      img.height = 40;
      slot.appendChild(img);

      if (item.quantity > 1) {
        const qty = document.createElement("div");
        qty.textContent = item.quantity;
        slot.appendChild(qty);
      }
    }

    // Клик по слоту
    slot.addEventListener("click", () => {
      document
        .querySelectorAll(".buyback-inventory-slot")
        .forEach((el) => el.classList.remove("selected"));
      slot.classList.add("selected");
      selectedBuybackSlot = index;

      // АКТИВИРУЕМ кнопку только для продуктов питания
      const itemType = inventory[index]?.type;
      sellBtn.disabled = !isFoodProduct(itemType);
    });

    grid.appendChild(slot);
  });

  sellBtn.addEventListener("click", () => {
    if (selectedBuybackSlot !== null) {
      sellItemToJack(selectedBuybackSlot);
      // Перезагружаем диалог для обновления инвентаря
      showBuybackDialog(container);
    }
  });
}

// Проверка является ли предмет продуктом питания (та же логика что в магазине)
function isFoodProduct(type) {
  if (!type || !ITEM_CONFIG[type]) return false;
  const cfg = ITEM_CONFIG[type];
  const BLACKLIST = ["balyary", "atom", "blood_pack", "blood_syringe"];
  const isBlacklisted = BLACKLIST.includes(type);
  const isWeapon = cfg.category === "weapon";
  const isRarityValid = cfg.rarity >= 1 && cfg.rarity <= 3;
  return isRarityValid && !isBlacklisted && !isWeapon;
}

// Продажа предмета Джеку (1 баляр за любой продукт)
function sellItemToJack(slotIndex) {
  if (ws.readyState === WebSocket.OPEN) {
    sendWhenReady(ws, JSON.stringify({ type: "sellToJack", slotIndex })); // Отправляем слот (сервер проверит item)
  } else {
    alert("Соединение потеряно. Попробуйте позже.");
  }
}

// Экспорт
window.jackSystem = {
  drawJack,
  checkJackProximity,
  setJackMet: (met) => {
    isJackMet = met;
    if (!met) {
      removeJackButtons();
      isPlayerNearJack = false;
      hasJackGreetingBeenShown = false;
    }
  },
  initialize: (spriteImg) => {
    jackSprite = spriteImg;
    initializeJackStyles();
    hasJackGreetingBeenShown = false;
  },
};
