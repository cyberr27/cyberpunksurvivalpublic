// notifications.js - Логика уведомлений

window.notificationsSystem = window.notificationsSystem || {};

// Делаем глобальную showNotification для совместимости с вызовами в code.js
window.showNotification = function (message, color = "#1900ff") {
  // Создаём div для уведомления
  const notif = document.createElement("div");
  notif.className = "notification";
  notif.textContent = message;
  notif.style.color = color; // Применяем цвет из параметра (по умолчанию как в CSS)

  // Добавляем в gameContainer
  document.getElementById("gameContainer").appendChild(notif);

  // Удаляем через 10 секунд
  setTimeout(() => {
    if (notif.parentNode) {
      notif.parentNode.removeChild(notif);
    }
  }, 10000);

  // Дублируем в чат как системное сообщение (локально, только для этого игрока)
  if (window.chatSystem && window.chatSystem.handleChatMessage) {
    window.chatSystem.handleChatMessage({ id: "Система", message: message });
  }
};

// Для обратной совместимости, если где-то вызывают через notificationsSystem
window.notificationsSystem.showNotification = window.showNotification;
