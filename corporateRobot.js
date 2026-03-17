window.corporateRobotSystem = (() => {
  "use strict";

  /* ================== CONSTANTS ================== */

  const POINT_A = { x: 1750, y: 1818 };
  const POINT_B = { x: 760, y: 2566 };

  const PAUSE_TIME = 30000;
  const MOVE_SPEED = 33;
  const INTERACTION_RADIUS_SQ = 2500;

  const FRAME_SIZE = 70;
  const HALF_FRAME = 35;

  /* ================== STATE ================== */

  let sprite = null;
  let initialized = false;
  let lastTime = performance.now();

  const state = {
    dialogueIndex: 0,
    playerInRange: false,
    isMoving: false,
    pauseUntil: 0,
    movingTowardsB: true,
    currentPos: { x: POINT_A.x, y: POINT_A.y },
    targetPos: POINT_B,
  };

  /* ================== UI CACHE ================== */

  const ui = {
    buttonsContainer: null,
    dialogWindow: null,
    dialogContent: null,
    dialogText: null,
    acceptBtn: null,
  };

  /* ================== UI CREATION ================== */

  function createUI() {
    if (ui.buttonsContainer) return;

    const body = document.body;

    // Buttons
    const buttons = document.createElement("div");
    buttons.className = "npc-buttons-container";
    buttons.style.cssText =
      "position:absolute;pointer-events:auto;display:none;z-index:1000;";
    body.appendChild(buttons);

    const talkBtn = document.createElement("div");
    talkBtn.className = "npc-button npc-talk-btn";
    talkBtn.textContent = "Говорить";
    talkBtn.onclick = openTalkDialog;
    buttons.appendChild(talkBtn);

    const questBtn = document.createElement("div");
    questBtn.className = "npc-button npc-quests-btn";
    questBtn.textContent = "Задания";
    questBtn.onclick = openQuestDialog;
    buttons.appendChild(questBtn);

    ui.buttonsContainer = buttons;

    // Dialog
    const dialog = document.createElement("div");
    dialog.className = "npc-dialog";
    dialog.style.display = "none";
    body.appendChild(dialog);

    const header = document.createElement("div");
    header.className = "npc-dialog-header";

    const photo = document.createElement("img");
    photo.className = "npc-photo";
    photo.src = "corporate_robot_foto.png";

    const title = document.createElement("h2");
    title.className = "npc-title";
    title.textContent = "Воспитатель Корпорации";

    header.append(photo, title);
    dialog.appendChild(header);

    const content = document.createElement("div");
    content.className = "npc-dialog-content";
    content.style.maxHeight = "calc(80vh - 150px)";
    dialog.appendChild(content);

    const text = document.createElement("div");
    text.className = "npc-text";
    content.appendChild(text);

    const closeBtn = document.createElement("div");
    closeBtn.className = "neon-btn";
    closeBtn.textContent = "Закрыть";
    closeBtn.onclick = closeDialog;
    dialog.appendChild(closeBtn);

    ui.dialogWindow = dialog;
    ui.dialogContent = content;
    ui.dialogText = text;
  }

  /* ================== DIALOG CONTROL ================== */

  function openDialog() {
    ui.dialogWindow.style.display = "flex";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }

  function closeDialog() {
    ui.dialogWindow.style.display = "none";
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  }

  function openTalkDialog() {
    if (ui.acceptBtn) ui.acceptBtn.style.display = "none";
    ui.dialogText.innerHTML = DIALOGUES[state.dialogueIndex];
    state.dialogueIndex = (state.dialogueIndex + 1) % DIALOGUES.length;
    openDialog();
  }

  /* ================== INVENTORY CHECKS ================== */

  const hasMedicalCertificate = () =>
    inventory.some(
      (i) =>
        i &&
        (i.type === "medical_certificate" ||
          i.type === "medical_certificate_stamped"),
    );

  const hasStampedCertificate = () =>
    inventory.some((i) => i && i.type === "medical_certificate_stamped");

  /* ================== QUEST DIALOG ================== */

  const DIALOGUES = [
    // 1. Приветствие: Введение в корпорацию как семью, правила лояльности
    `<strong><span style="color:#00FF00;">Добро пожаловать, дитя корпорации.</span></strong><br><br>
    NeoCorp — твоя семья, как и при твоем воспитании мы мы будем следить за твоими показателями в этом мире,  в котором выживание зависит от ресурсов и монеты. Здесь каждый сотрудник следует <br><span style="color:#FFD700;">Правилу №1: Абсолютная лояльность.</span> Ты должен ставить интересы корпорации выше своих — только так мы процветаем вместе. <span style="color:#FF4500;">Помни, предательство строго карается штрафом, заключением под стражу и даже изгнанием.</span> Чтобы присоединиться, к анклаву (Сектра - 8) - выйди из диалога и нажми кнопку <span style="color:#FF00FF;">(Задания)</span>, затем пройди регистрацию и получи базовый набор резидента для старта в NeoCorp.`,

    // 2. Будущее: Мониторинг для "защиты", правила отчетности
    `<strong><span style="color:#00FF00;">Ты — будущее. Мы следим за тобой.</span></strong><br><br>
    В NeoCorp мы инвестируем в тебя, как в ценный актив, предоставляя доступ к технологиям.<br> <span style="color:#FFD700;">Правило №2: Полная прозрачность.</span> Твои действия, здоровье и продуктивность мониторятся круглосуточно для твоей же безопасности. Ежедневно отчитывайся о прогрессе — это ключ к продвижению и бонусам, которые можно с умом потратить на необходимые предметы. С отрицательными отчётами ты рискуешь <span style="color:#FF4500;">штрафами...</span>`,

    // 3. Гидратация: Здоровье как ресурс, правила самоконтроля
    `<strong><span style="color:#00FF00;">Не забывай о показателях :<br><span style="color:#FF0000;">Здоровье, </span><span style="color:#00FF00;">Энергия,</span> <span style="color:#FFFF00;">Еда</span> и <span style="color:#0000FF;">Вода</span>.</span></strong><br><br>
    <span style="color:#FFD700;">Правило №3: Самоконтроль ресурсов.</span> Правильное потребление еды и воды каждый день. Восстановление энергии. Держи показатели ближе к максимуму - это улучшит отчет и повысит качество получаемого ежедневного провианта. Недостаток одного из ресурсов из твоих показателей (падение отметки показателя до 0 / 100) влияет на твое здоровье при движении.`,

    // 4. Послушание: Иерархия, правила подчинения
    `<strong><span style="color:#00FF00;">Слушай старших. Слушай корпорацию.</span></strong><br><br>
    NeoCorp построена на строгой иерархии: от новичков вроде тебя до элиты в Неоновом Городе, где доступны продвинутые системы. Каждое успешное выполненное задание будет открывать новые возможности. <span style="color:#FFD700;">Правило №4: Безусловное подчинение.</span> Приказы старших — закон, даже если они кажутся странными.`,

    // 5. Показатели: Мотивация через контроль, правила улучшения
    `<strong><span style="color:#00FF00;">Твои показатели в норме. Продолжай в том же духе.</span></strong><br><br>
    Мы анализируем твои данные в реальном времени: здоровье, энергия, вклад в задания, включая maxStats для health и energy из экипировки вроде torn_health_gloves. <span style="color:#FFD700;">Правило №5: Постоянное улучшение.</span> Стремитесь к 100% эффективности — еженедельные аудиты выявят слабости, как низкий food от отсутствия sausage или water от dried_fish. Если показатели падают, корпорация назначит коррекционные меры, как дополнительные тренировки в combatSystem или ограничения на ресурсы, чтобы подготовить тебя к боям с mutantSprite. Ты справишься — мы верим в тебя, особенно после регистрации с medical_certificate и доступа к bonfireSystem для отдыха.`,

    // 6. Гордость: Поощрение, правила вклада и лояльности
    `<strong><span style="color:#00FF00;">Корпорация гордится тобой.</span></strong><br><br>
    Твой вклад укрепляет NeoCorp в этом мире мутантов и хаоса, где enemySystem полон угроз вроде vacuumRobotSprite или corporateRobotSystem для патруля. <span style="color:#FFD700;">Правило №6: Вклад в общее благо.</span> Делись ресурсами с коллегами, выполняй корпоративные квесты — и получишь доступ к элитным зонам и технологиям, вроде speed_boots для движения или knuckles для ближнего боя. Гордость корпорации — твоя гордость: собирай balyary, улучшай inventory с atom, и после сдачи документов станешь частью элиты Неонового Города. Продолжай, и скоро ты экипируешься в cyber_pants, защищаясь от дронов и тараканов в наших мирах.`,
  ];

  function openQuestDialog() {
    if (ui.acceptBtn) ui.acceptBtn.style.display = "none";

    const me = players.get(myId);
    if (
      me?.medicalCertificate === true &&
      me?.medicalCertificateStamped === true &&
      me?.corporateDocumentsSubmitted === true
    ) {
      ui.dialogText.innerHTML = `
      <strong><span style="color:#00FF00;">Регистрация завершена успешно.</span></strong><br><br>
      Поздравляем. Ваши данные приняты и зафиксированы в системе корпорации <span style="color:#FFD700;">NeoCorp</span>.<br><br>
      На данный момент активных заданий для вас нет.<br>
      Продолжайте поддерживать показатели в норме и возвращайтесь позже — 
      <span style="color:#00FF00;">возможно, корпорация подготовит для вас новые поручения.</span><br><br>
      <span style="color:#888;">Корпорация наблюдает. Корпорация помнит.</span>
    `;
      openDialog();
      return;
    }

    if (!hasMedicalCertificate()) {
      ui.dialogText.innerHTML = `
        <strong><span style="color:#FF0000;">Воспитатель Корпорации внимательно сканирует тебя... Документ <span style="color:#FFD700;">(МН-69)</span> не обнаружен ...</span></strong><br><br>
        Сначала тебе нужно :<br><span style="color:#00FF00;">Посетить мед.бота и пройти обследование.</span><br> Он находится около здания больницы NeoCorp - ярко зеленое здание на координатах<br><span style="color:#FFD700;">Х : 2772, Y: 2332.</span><br><br>
        Если все будет хорошо и у тебя не обнаружится мутаций, возвращайся ко мне с докуметном, я скажу что делать дальше.<br><strong><span style="color:#FFFF00;">По окончнии всей процедуры регистрации NeoCorp выдаст :</span></strong><br> <span style="color:#FF00FF;">"Базовый набор резидента"!</span>
      `;
      openDialog();
      return;
    }

    if (hasMedicalCertificate() && !hasStampedCertificate()) {
      ui.dialogText.innerHTML = `
        <strong><span style="color:#00FF00;">Справка обнаружена! Проверка печати...</span></strong><br><br>
        <span style="color:#FF0000;"><strong>Печать охранной службы отсутствует!</span></strong><br><br>
        Отнеси документ <span style="color:#FFD700;">Капитану Райдеру</span> на охранную заставу — там тебе поставят официальную печать корпорации NeoCorp. Сможешь найти его на координатах <span style="color:#FFD700;"> X : 675, Y : 1593.</span><br><br>
        <strong><span style="color:#FF0000;">Без печати доступ к услугам корпорации NeoCorp закрыт!</strong></span><br>
        Я занесу документы в базу и вы сможете ощутить все преимущества жизни в нашем анклаве <span style="color:#00FF00;">NeoCorp.</span>
      `;
      openDialog();
      return;
    }

    ui.dialogText.innerHTML = `
      <strong><span style="color:#00FF00;">Медицинская справка <span style="color:#FFFF00;">(МН-69)</span> с печатью охранной службы обнаружена!</span></strong><br><br>
      Ваши биометрические данные загружены в корпоративную базу. Вы готовы к службе в корпорации!<br><br>
      <span style="color:#FFD700;">Подтвердите сдачу документов для получения допуска к корпоративным заданиям и получение</span> <span style="color:#FF00FF;">"Базового набора резидента".</span>
    `;

    if (!ui.acceptBtn) {
      ui.acceptBtn = document.createElement("div");
      ui.acceptBtn.className = "neon-btn";
      ui.acceptBtn.textContent = "Сдать документы";
      ui.acceptBtn.onclick = submitDocuments;
      ui.dialogWindow.insertBefore(
        ui.acceptBtn,
        ui.dialogWindow.lastElementChild,
      );
    } else {
      ui.acceptBtn.textContent = "Сдать документы";
      ui.acceptBtn.onclick = submitDocuments;
    }
    ui.acceptBtn.style.display = "block";

    openDialog();
  }

  function submitDocuments() {
    if (ws?.readyState === WebSocket.OPEN) {
      sendWhenReady(ws, JSON.stringify({ type: "submitCorporateDocuments" }));
    }
    closeDialog();
  }

  /* ================== MOVEMENT ================== */

  function updateMovement(dt, now) {
    if (state.playerInRange || now < state.pauseUntil) {
      state.isMoving = false;
      return;
    }

    state.isMoving = true;

    const dx = state.targetPos.x - state.currentPos.x;
    const dy = state.targetPos.y - state.currentPos.y;
    const distSq = dx * dx + dy * dy;

    const move = MOVE_SPEED * (dt / 1000);

    if (distSq <= move * move) {
      state.currentPos.x = state.targetPos.x;
      state.currentPos.y = state.targetPos.y;
      state.pauseUntil = now + PAUSE_TIME;
      state.movingTowardsB = !state.movingTowardsB;
      state.targetPos = state.movingTowardsB ? POINT_B : POINT_A;
      state.isMoving = false;
      return;
    }

    const invDist = move / Math.sqrt(distSq);
    state.currentPos.x += dx * invDist;
    state.currentPos.y += dy * invDist;
  }

  /* ================== PROXIMITY ================== */

  function checkProximity() {
    if (worldSystem.currentWorldId !== 0) {
      if (state.playerInRange) {
        state.playerInRange = false;
        ui.buttonsContainer.style.display = "none";
      }
      return;
    }

    const me = players.get(myId);
    if (!me) return;

    const dx = me.x + HALF_FRAME - state.currentPos.x;
    const dy = me.y + HALF_FRAME - state.currentPos.y;
    const inRange = dx * dx + dy * dy <= INTERACTION_RADIUS_SQ;

    if (inRange !== state.playerInRange) {
      state.playerInRange = inRange;
      ui.buttonsContainer.style.display = inRange ? "flex" : "none";
      if (!inRange) closeDialog();
    }
  }

  function updateButtonsPosition() {
    if (!state.playerInRange) return;

    const cam = movementSystem.getCamera();
    let x = state.currentPos.x - cam.x;
    let y = state.currentPos.y - cam.y - 80;

    const w = ui.buttonsContainer.offsetWidth || 200;
    const h = ui.buttonsContainer.offsetHeight || 50;

    ui.buttonsContainer.style.left =
      Math.max(0, Math.min(x, innerWidth - w)) + "px";
    ui.buttonsContainer.style.top =
      Math.max(0, Math.min(y, innerHeight - h)) + "px";
  }

  /* ================== PUBLIC API ================== */

  return {
    initialize(robotSprite) {
      if (initialized) return;
      sprite = robotSprite;
      createUI();
      initialized = true;
    },

    update() {
      const now = performance.now();
      const dt = now - lastTime;
      lastTime = now;

      checkProximity();
      updateMovement(dt, now);
      updateButtonsPosition();
    },

    draw() {
      if (worldSystem.currentWorldId !== 0 || !sprite?.complete) return;

      const cam = movementSystem.getCamera();
      const sx = state.currentPos.x - cam.x - HALF_FRAME;
      const sy = state.currentPos.y - cam.y - HALF_FRAME;

      let frame = 0;
      let row = 0;

      if (state.isMoving) {
        frame = 1 + (((performance.now() / 100) | 0) % 12);
        row = state.movingTowardsB ? 0 : 1;
      }

      ctx.drawImage(
        sprite,
        frame * FRAME_SIZE,
        row * FRAME_SIZE,
        FRAME_SIZE,
        FRAME_SIZE,
        sx,
        sy,
        FRAME_SIZE,
        FRAME_SIZE,
      );

      ctx.font = "12px Courier New";
      ctx.fillStyle = "#fbff00";
      ctx.textAlign = "center";
      ctx.fillText("Robot Corporations", sx + HALF_FRAME, sy - 15);
    },

    isPlayerInteracting: () =>
      state.playerInRange && ui.dialogWindow.style.display === "flex",
  };
})();
