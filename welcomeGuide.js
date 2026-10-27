// welcomeGuide.js — УЛЬТРА-ОПТИМИЗИРОВАННАЯ ВЕРСИЯ 2025 | СЕКТОР 8
// Один RAF, ноль утечек, мгновенное удаление, минимум мусора

(() => {
  let hasSeen = false;
  let dialog = null;
  let rafId = null;

  const HTML = `
    <div class="welcome-guide">
      <div class="npc-dialog-header">
      </div>
      <div class="npc-dialog-content">
        <div class="npc-text">
        </div>
      </div>
      <button id="wg-btn" class="welcomeBtn"></button>
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

      // Локально сразу помечаем как увиденное (на случай задержки сервера)
      const me = players.get(myId);
      if (me) me.hasSeenWelcomeGuide = true;
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

    // Улучшенная проверка: учитываем как distanceTraveled, так и hasSeenWelcomeGuide
    const traveled = me.distanceTraveled || 0;
    const alreadySeen = me.hasSeenWelcomeGuide === true;

    if (traveled >= 100 && !alreadySeen) {
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
