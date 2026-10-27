// notifications.js - Логика уведомлений

window.notificationsSystem = window.notificationsSystem || {};

// Глобальная ссылка на текущее уведомление (singleton)
let currentNotification = null;

window.showNotification = function (message, color = "#1900ff") {
  // === УДАЛЯЕМ ПРЕДЫДУЩЕЕ СРАЗУ ===
  if (currentNotification && currentNotification.parentNode) {
    currentNotification.parentNode.removeChild(currentNotification);
  }

  // Создаём новое
  const notif = document.createElement("div");
  notif.className = "notification";
  notif.textContent = message;
  notif.style.color = color;

  // Добавляем в gameContainer
  const gameContainer = document.getElementById("gameContainer");
  if (!gameContainer) return; // защита

  gameContainer.appendChild(notif);
  currentNotification = notif;

  // Удаляем через 10 секунд (как было)
  setTimeout(() => {
    if (notif.parentNode && notif === currentNotification) {
      notif.parentNode.removeChild(notif);
      if (currentNotification === notif) currentNotification = null;
    }
  }, 10000);

  // Дублируем в чат как системное сообщение
  if (window.chatSystem && window.chatSystem.handleChatMessage) {
    window.chatSystem.handleChatMessage({ id: "Система", message: message });
  }
};

// Для обратной совместимости
window.notificationsSystem.showNotification = window.showNotification;

// Дополнительно: публичный метод принудительной очистки (на всякий случай)
window.notificationsSystem.clearCurrent = function () {
  if (currentNotification && currentNotification.parentNode) {
    currentNotification.parentNode.removeChild(currentNotification);
  }
  currentNotification = null;
};
