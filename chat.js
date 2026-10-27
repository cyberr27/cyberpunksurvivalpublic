const chatBtn = document.getElementById("chatBtn");
const chatContainer = document.getElementById("chatContainer");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");

window.chatSystem = window.chatSystem || {};
window.isChatInputFocused = false;
window.chatSystem.currentTab = "all"; // all | local | private | system

window.chatSystem.initializeChat = function (webSocket) {
  // === Вкладки All / Local / Private / System ===
  if (!document.getElementById("chatTabs")) {
    const tabsBar = document.createElement("div");
    tabsBar.id = "chatTabs";
    tabsBar.innerHTML = `
      <button type="button" id="chatTab1" class="chat-tab active" data-tab="all"></button>
      <button type="button" id="chatTab2" class="chat-tab" data-tab="local"></button>
      <button type="button" id="chatTab3" class="chat-tab" data-tab="private"></button>
      <button type="button" id="chatTab4" class="chat-tab" data-tab="system"> </button>
    `;
    const header = document.getElementById("chatHeader");
    if (header && header.parentNode) {
      header.parentNode.insertBefore(tabsBar, header.nextSibling);
    } else if (chatMessages && chatMessages.parentNode) {
      chatMessages.parentNode.insertBefore(tabsBar, chatMessages);
    }

    tabsBar.addEventListener("click", (e) => {
      const btn = e.target.closest(".chat-tab");
      if (!btn) return;
      window.chatSystem.currentTab = btn.dataset.tab || "all";
      tabsBar
        .querySelectorAll(".chat-tab")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      window.chatSystem.applyTabFilter();
    });
  }

  // === КНОПКА СМАЙЛОВ + ПАНЕЛЬ (senior UX) ===
  const inputContainer = document.getElementById("chatInputContainer");
  if (inputContainer && !document.getElementById("chatSmileBtn")) {
    // Кнопка
    const smileBtn = document.createElement("button");
    smileBtn.id = "chatSmileBtn";
    smileBtn.type = "button";
    smileBtn.title = "Смайлики (клик — вставить)";
    smileBtn.setAttribute("aria-label", "Открыть панель смайликов");
    smileBtn.innerHTML = `
      <span class="smile-btn-icon"></span>
    `;
    inputContainer.appendChild(smileBtn);

    // Панель
    const panel = document.createElement("div");
    panel.id = "chatSmilePanel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Панель анимированных смайликов");
    panel.innerHTML = `
      <div class="smile-panel-header">
        <span class="smile-panel-title">СМАЙЛИКИ</span>
        <button type="button" id="chatSmileClose" class="smile-panel-close" title="Закрыть">×</button>
      </div>
      <div class="smile-panel-hint">Клик — вставить в сообщение. Можно несколько.</div>
      <div id="chatSmileGrid" class="smile-grid"></div>
    `;
    chatContainer.appendChild(panel);

    // Ленивая генерация 100 GIF (только при первом открытии)
    let smilesBuilt = false;
    function buildSmileGrid() {
      if (smilesBuilt) return;
      smilesBuilt = true;
      const grid = document.getElementById("chatSmileGrid");
      if (!grid) return;

      const frag = document.createDocumentFragment();
      for (let i = 1; i <= 100; i++) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "smile-item";
        item.dataset.smileId = String(i);
        item.title = `Смайл #${i}`;
        item.setAttribute("aria-label", `Вставить смайл ${i}`);

        const img = document.createElement("img");
        img.src = `images/smiles/${i}.gif`;
        img.alt = `[s:${i}]`;
        img.loading = "lazy";
        img.decoding = "async";
        img.draggable = false;

        const num = document.createElement("span");
        num.className = "smile-num";
        num.textContent = i;

        item.appendChild(img);
        item.appendChild(num);
        frag.appendChild(item);
      }
      grid.appendChild(frag);
    }

    function openSmilePanel() {
      buildSmileGrid();
      panel.classList.add("open");
      smileBtn.classList.add("active");
    }

    function closeSmilePanel() {
      panel.classList.remove("open");
      smileBtn.classList.remove("active");
    }

    function toggleSmilePanel() {
      if (panel.classList.contains("open")) closeSmilePanel();
      else openSmilePanel();
    }

    // Вставка shortcode в позицию курсора
    function insertSmileAtCursor(id) {
      if (!chatInput) return;
      const code = `[s:${id}]`;
      const start = chatInput.selectionStart ?? chatInput.value.length;
      const end = chatInput.selectionEnd ?? chatInput.value.length;
      const before = chatInput.value.substring(0, start);
      const after = chatInput.value.substring(end);
      chatInput.value = before + code + after;

      // курсор сразу после вставленного кода
      const newPos = start + code.length;
      chatInput.setSelectionRange(newPos, newPos);
      chatInput.focus();
      window.isChatInputFocused = true;

      // лёгкий визуальный фидбек
      const item = panel.querySelector(`.smile-item[data-smile-id="${id}"]`);
      if (item) {
        item.classList.add("just-inserted");
        setTimeout(() => item.classList.remove("just-inserted"), 350);
      }
    }

    smileBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSmilePanel();
    });

    document
      .getElementById("chatSmileClose")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeSmilePanel();
        chatInput?.focus();
      });

    // Клик по смайлу
    panel.addEventListener("click", (e) => {
      const item = e.target.closest(".smile-item");
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      const id = parseInt(item.dataset.smileId, 10);
      if (id >= 1 && id <= 100) insertSmileAtCursor(id);
    });

    // Закрытие по клику вне панели (но не по кнопке)
    document.addEventListener("click", (e) => {
      if (!panel.classList.contains("open")) return;
      if (panel.contains(e.target) || smileBtn.contains(e.target)) return;
      closeSmilePanel();
    });

    // ESC закрывает панель (приоритет выше закрытия всего чата, если панель открыта)
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape" && panel.classList.contains("open")) {
          e.preventDefault();
          e.stopPropagation();
          closeSmilePanel();
          chatInput?.focus();
        }
      },
      true,
    );

    // Не даём событиям с панели уходить в игру
    panel.addEventListener("keydown", (e) => e.stopPropagation());
    panel.addEventListener("keypress", (e) => e.stopPropagation());
    panel.addEventListener("keyup", (e) => e.stopPropagation());
  }

  const toggleChat = () => {
    const isVisible = chatContainer.style.display === "flex";
    chatContainer.style.display = isVisible ? "none" : "flex";
    chatBtn.classList.toggle("active", !isVisible);

    // при закрытии чата — закрываем и панель смайлов
    const panel = document.getElementById("chatSmilePanel");
    if (panel) panel.classList.remove("open");
    const smileBtn = document.getElementById("chatSmileBtn");
    if (smileBtn) smileBtn.classList.remove("active");

    if (!isVisible) {
      chatInput.focus();
      setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }, 100);
    } else {
      chatInput.blur();
      window.isChatInputFocused = false;
    }
  };

  chatBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleChat();
  });

  // ESC / T — не мешаем, если фокус уже в input (кроме ESC)
  document.addEventListener("keydown", (e) => {
    if (window.isChatInputFocused || document.activeElement === chatInput) {
      if (e.key === "Escape" && chatContainer.style.display === "flex") {
        // если открыта панель смайлов — её уже закрыл capture-листener выше
        const panel = document.getElementById("chatSmilePanel");
        if (panel && panel.classList.contains("open")) return;
        e.preventDefault();
        e.stopPropagation();
        toggleChat();
      }
      return;
    }

    if (e.key === "Escape" && chatContainer.style.display === "flex") {
      toggleChat();
    }
    if (e.key === "t" || e.key === "T" || e.key === "е" || e.key === "Е") {
      if (chatContainer.style.display !== "flex") {
        toggleChat();
      }
    }
  });

  // === КРИТИЧНО: клавиши не уходят в игру ===
  chatInput.addEventListener("keydown", (e) => {
    // Escape: сначала панель смайлов, потом сам чат
    if (e.code === "Escape" || e.key === "Escape") {
      const panel = document.getElementById("chatSmilePanel");
      if (panel && panel.classList.contains("open")) {
        // Панель уже закрывает capture-listener выше — не мешаем,
        // но не даём событию уйти в игру
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Панели нет → закрываем чат
      if (chatContainer.style.display === "flex") {
        e.preventDefault();
        e.stopPropagation();
        toggleChat();
        return;
      }
    }

    // Все остальные клавиши (WASD, Q/E/R/T и т.д.) не уходят в игру
    e.stopPropagation();
  });
  chatInput.addEventListener("keypress", (e) => {
    e.stopPropagation();
  });
  chatInput.addEventListener("keyup", (e) => {
    e.stopPropagation();
  });

  chatInput.addEventListener("focus", () => {
    window.isChatInputFocused = true;
  });
  chatInput.addEventListener("blur", () => {
    window.isChatInputFocused = false;
  });

  // Отправка по Enter (поддержка pure-smile: [s:N] даёт length > 0)
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && chatInput.value.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      sendWhenReady(
        webSocket,
        JSON.stringify({ type: "chat", message: chatInput.value }),
      );
      chatInput.value = "";
      // после отправки можно закрыть панель
      const panel = document.getElementById("chatSmilePanel");
      if (panel) panel.classList.remove("open");
      const smileBtn = document.getElementById("chatSmileBtn");
      if (smileBtn) smileBtn.classList.remove("active");
    }
  });

  if (chatInput && !chatInput.dataset.privateHint) {
    chatInput.dataset.privateHint = "1";
    const oldPlaceholder = chatInput.placeholder || "ВВЕДИ СООБЩЕНИЕ...";
    chatInput.placeholder = oldPlaceholder + "  |  /w nick приватное сообщение";
  }

  chatContainer.addEventListener("transitionend", () => {
    if (chatContainer.style.display === "flex") {
      chatInput.focus();
    }
  });
};

function sendWhenReady(ws, message) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(message);
  } else if (ws.readyState === WebSocket.CONNECTING) {
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
        clearInterval(interval);
      }
    }, 100);
    setTimeout(() => clearInterval(interval), 5000);
  }
}

/**
 * Парсит текст сообщения и возвращает DocumentFragment
 * с текстовыми нодами + анимированными <img> для [s:N]
 */
window.chatSystem.parseMessageContent = function (rawText) {
  const frag = document.createDocumentFragment();
  if (typeof rawText !== "string" || !rawText) {
    frag.appendChild(document.createTextNode(""));
    return frag;
  }

  const regex = /\[s:(\d{1,3})\]/gi;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(rawText)) !== null) {
    // текст до shortcode
    if (match.index > lastIndex) {
      frag.appendChild(
        document.createTextNode(rawText.slice(lastIndex, match.index)),
      );
    }

    const id = parseInt(match[1], 10);
    if (id >= 1 && id <= 100) {
      const img = document.createElement("img");
      img.src = `images/smiles/${id}.gif`;
      img.className = "chat-smile";
      img.alt = `[s:${id}]`;
      img.title = `Смайл #${id}`;
      img.loading = "lazy";
      img.decoding = "async";
      img.draggable = false;
      frag.appendChild(img);
    } else {
      // невалидный — оставляем как текст (сервер всё равно их вырежет)
      frag.appendChild(document.createTextNode(match[0]));
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < rawText.length) {
    frag.appendChild(document.createTextNode(rawText.slice(lastIndex)));
  }

  return frag;
};

window.chatSystem.handleChatMessage = function (data) {
  if (!data || typeof data.message !== "string") return;

  const messageEl = document.createElement("div");
  messageEl.classList.add("chat-message");

  const isSystem =
    data.id === "Система" || data.id === "System" || data.isSystem === true;
  const isPrivate = !!data.isPrivate;

  if (isSystem) {
    messageEl.classList.add("system-message");
    messageEl.dataset.msgType = "system";
  } else if (isPrivate) {
    messageEl.classList.add("private-message");
    messageEl.dataset.msgType = "private";
  } else {
    messageEl.dataset.msgType = "local";
  }

  const sender =
    isSystem && window.i18n ? window.i18n.t("system_name") : data.id;

  let prefix = "";
  if (isPrivate) {
    if (typeof myId !== "undefined" && data.targetId && data.id !== myId) {
      prefix = `(private from ${data.id}) `;
    } else if (data.targetId) {
      prefix = `(private to ${data.targetId}) `;
    } else {
      prefix = "(private) ";
    }
  }

  // Префикс + имя как текст, дальше — распарсенное сообщение со смайлами
  const prefixNode = document.createTextNode(`${prefix}${sender}: `);
  messageEl.appendChild(prefixNode);
  messageEl.appendChild(window.chatSystem.parseMessageContent(data.message));

  chatMessages.appendChild(messageEl);

  while (chatMessages.children.length > 200) {
    chatMessages.removeChild(chatMessages.firstChild);
  }

  window.chatSystem.applyTabFilter();
  chatMessages.scrollTop = chatMessages.scrollHeight;
};

window.chatSystem.applyTabFilter = function () {
  const tab = window.chatSystem.currentTab || "all";
  const nodes = chatMessages.querySelectorAll(".chat-message");
  nodes.forEach((el) => {
    const type = el.dataset.msgType || "local";
    if (tab === "all") {
      el.style.display = "";
    } else if (tab === type) {
      el.style.display = "";
    } else {
      el.style.display = "none";
    }
  });
};
