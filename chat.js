const chatBtn = document.getElementById("chatBtn");
const chatContainer = document.getElementById("chatContainer");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");

window.chatSystem = window.chatSystem || {};

// Инициализация чата
window.chatSystem.initializeChat = function (webSocket) {
  // Переключение видимости чата
  const toggleChat = () => {
    const isVisible = chatContainer.style.display === "flex";
    chatContainer.style.display = isVisible ? "none" : "flex";
    chatBtn.classList.toggle("active", !isVisible);

    if (!isVisible) {
      chatInput.focus();
      // Прокручиваем вниз
      setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }, 100);
    } else {
      chatInput.blur();
    }
  };

  // Клик по кнопке
  chatBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleChat();
  });

  // Закрытие по ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && chatContainer.style.display === "flex") {
      toggleChat();
    }
    // Открытие чата по T (как в большинстве игр)
    if (e.key === "t" || e.key === "T" || e.key === "е" || e.key === "Е") {
      if (chatContainer.style.display !== "flex") {
        toggleChat();
      }
    }
  });

  // Отправка по Enter
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && chatInput.value.length > 0) {
      
      sendWhenReady(
        webSocket,
        JSON.stringify({ type: "chat", message: chatInput.value })
      );
      chatInput.value = "";
    }
  });

  // Автофокус при открытии
  chatContainer.addEventListener("transitionend", () => {
    if (chatContainer.style.display === "flex") {
      chatInput.focus();
    }
  });
};

// Отправка с ожиданием готовности WS
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

window.chatSystem.handleChatMessage = function (data) {
  const messageEl = document.createElement("div");
  messageEl.classList.add("chat-message");
  if (data.id === "Система") {
    messageEl.classList.add("system-message");
  }

  const displayMessage = data.message;

  messageEl.textContent = `${data.id}: ${displayMessage}`;

  chatMessages.appendChild(messageEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
};
