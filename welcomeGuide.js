// welcomeGuide.js — УЛЬТРА-ОПТИМИЗИРОВАННАЯ ВЕРСИЯ 2025 | СЕКТОР 8
// Один RAF, ноль утечек, мгновенное удаление, минимум мусора

(() => {
  let hasSeen = false;
  let dialog = null;
  let rafId = null;

  const HTML = `
    <div class="npc-dialog" style="opacity:0;transition:opacity .6s cubic-bezier(.175,.885,.32,1.275)">
      <div class="npc-dialog-header">
        <img src="section8.png" alt="СЕКТОР 8" class="npc-photo" loading="lazy">
        <h3 class="npc-title">WELCOME TO SECTOR 8</h3>
      </div>
      <div class="npc-dialog-content">
        <div class="npc-text" style="line-height:1.5">
          <strong><span style="color:#FF0000">Уважаемый резидент!</span></strong><br><br>
          Поздравляем с прибытием в <span style="color:#00FF00">(Сектор-8)</span>) флагманский анклав безопасности,<br>
          стабильности и прогрессивного развития управляемый корпорацией NeoCorp.<br>
          Вы официально получили статус :<br><span style="color:#FFFF00">«Гражданский актив класса Δ»,</span><br>
          что подтверждает ваше право на проживание, защиту и доступ к базовым ресурсам Сектора.<br> 
          Отныне ваша жизнь находится под надёжной опекой Корпорации.<br><br>
          <strong><span style="color:#FF0000">В <span style="color:#FFD700">(Секторе-8)</span> действуют единые и неизменные принципы :</span></strong><br><br>
          <span style="color:#00FF00">Абсолютный порядок и соблюдение всех установленных норм и правил.<br>
          Любое отклонение от установленных норм фиксируется и влечёт немедленные корректирующие меры.</span><br><br>
          <span style="color:#FFD700">В ближайшие минуты к вам прибудет назначенный личный куратор-проводник.<br>
          Он проведёт первичный инструктаж, расскажет что вы должны сделать и поможет адаптироваться к жизни в Секторе.</span><br><br>
          До его прибытия настоятельно рекомендуется:<br><br>
          <span style="color:#00FF00">Оставаться в зоне первичного спавна.<br>
          Ознакомиться с интерфейсом.<br>
          Безусловно выполнять все указания представителей Корпорации.</span><br><br>
          С уважением и заботой,<br>
          Администрация NeoCorp.<br>
          «Твои мечты. Твоя жизнь. Наша забота.»
        </div>
      </div>
      <button id="wg-btn" class="neon-btn">ПОНЯЛ</button>
    </div>`;

  const show = () => {
    if (hasSeen || dialog) return;
    hasSeen = true;

    dialog = document.createElement("div");
    dialog.innerHTML = HTML;
    document.body.appendChild(dialog);

    requestAnimationFrame(() => {
      dialog.firstElementChild.style.opacity = "1";
    });

    const btn = dialog.querySelector("#wg-btn");
    btn.onclick = () => {
      dialog.firstElementChild.style.opacity = "0";
      dialog.addEventListener("transitionend", () => dialog.remove(), {
        once: true,
      });

      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "welcomeGuideSeen" }));
      } else if (window.sendWhenReady) {
        sendWhenReady(ws, JSON.stringify({ type: "welcomeGuideSeen" }));
      }
    };
  };

  const check = () => {
    if (hasSeen) {
      rafId = requestAnimationFrame(check);
      return;
    }
    if (
      typeof myId === "undefined" ||
      !myId ||
      typeof players === "undefined" ||
      !players.has(myId)
    ) {
      rafId = requestAnimationFrame(check);
      return;
    }

    const me = players.get(myId);
    if (me.distanceTraveled >= 100 && !me.hasSeenWelcomeGuide) {
      cancelAnimationFrame(rafId);
      rafId = null;
      show();
    } else {
      rafId = requestAnimationFrame(check);
    }
  };

  window.welcomeGuideSystem = {
    init: () => {
      if (!hasSeen && !rafId) {
        rafId = requestAnimationFrame(check);
      }
    },
    setSeen: (v = true) => {
      hasSeen = !!v;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (dialog) {
        dialog.remove();
        dialog = null;
      }
    },
    forceShow: () => {
      hasSeen = false;
      if (rafId) cancelAnimationFrame(rafId);
      show();
    },
  };

  if (
    typeof myId !== "undefined" &&
    myId &&
    typeof players !== "undefined" &&
    players.has(myId)
  ) {
    window.welcomeGuideSystem.init();
  } else {
    const waiter = () => {
      if (
        typeof myId !== "undefined" &&
        myId &&
        typeof players !== "undefined" &&
        players.has(myId)
      ) {
        window.welcomeGuideSystem.init();
      } else {
        requestAnimationFrame(waiter);
      }
    };
    requestAnimationFrame(waiter);
  }
})();
