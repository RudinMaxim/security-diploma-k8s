// Устанавливаем API_BASE_URL с резервным значением
const API_BASE_URL = window.API_URL || "http://localhost:8080";
if (!API_BASE_URL) {
  console.error("API_URL не найден");
  document.getElementById("statusText").textContent =
    "Ошибка конфигурации: API_URL не найден";
  return;
}

// Упрощенная функция для получения элементов по ID
const $ = (id) => document.getElementById(id);

// Кэширование DOM-элементов для производительности
const elements = {
  statusIndicator: $("statusIndicator"),
  statusText: $("statusText"),
  usersList: $("usersList"),
  userName: $("userName"),
  userEmail: $("userEmail"),
  createUserButton: $("createUserButton"),
  userCount: $("userCount"),
  lastUpdate: $("lastUpdate"),
  securityInfo: $("securityInfo"),
  endpoints: $("endpoints"),
  refreshStatsButton: $("refreshStatsButton"),
  refreshSecurityButton: $("refreshSecurityButton"),
  refreshEndpointsButton: $("refreshEndpointsButton"),
};

// Форматирование даты в локальный формат
const formatDate = (dateString) => new Date(dateString).toLocaleString("ru-RU");

// Функция для предотвращения множественных вызовов
function debounce(fn, ms) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
}

// Проверка состояния сервиса
async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    elements.statusIndicator.className = `status-indicator ${
      data.status === "healthy" ? "healthy" : "unhealthy"
    }`;
    elements.statusText.textContent =
      data.status === "healthy" ? "Сервис работает" : "Проблемы с сервисом";
  } catch (error) {
    console.error("Health check error:", {
      error,
      timestamp: new Date().toISOString(),
    });
    elements.statusIndicator.className = "status-indicator unhealthy";
    elements.statusText.textContent = "Сервис недоступен";
  }
}

// Загрузка списка пользователей
async function loadUsers() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/users`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const users = await response.json();

    if (users.length === 0) {
      elements.usersList.innerHTML =
        '<p class="loading">Пользователи не найдены</p>';
      return;
    }

    elements.usersList.innerHTML = users
      .map(
        (user) => `
          <div class="user-item">
            <h4>${user.name}</h4>
            <p>${user.email}</p>
          </div>
        `
      )
      .join("");
  } catch (error) {
    console.error("Users fetch error:", {
      error,
      timestamp: new Date().toISOString(),
    });
    elements.usersList.innerHTML =
      '<div class="error">Ошибка загрузки пользователей. Пожалуйста, попробуйте позже.</div>';
  }
}

// Создание нового пользователя
async function createUser() {
  const name = elements.userName.value.trim();
  const email = elements.userEmail.value.trim();

  if (!name || !email) {
    alert("Пожалуйста, заполните все поля");
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email }),
    });

    if (response.ok) {
      elements.userName.value = "";
      elements.userEmail.value = "";
      await loadUsers();
      await loadStats();
    } else {
      alert("Ошибка создания пользователя");
    }
  } catch (error) {
    console.error("User creation error:", {
      error,
      timestamp: new Date().toISOString(),
    });
    alert("Ошибка соединения с сервером");
  }
}

// Загрузка статистики
async function loadStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/stats`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const stats = await response.json();

    elements.userCount.textContent = stats.userCount;
    elements.lastUpdate.textContent = formatDate(stats.timestamp);
  } catch (error) {
    console.error("Stats fetch error:", {
      error,
      timestamp: new Date().toISOString(),
    });
    elements.userCount.textContent = "Ошибка";
    elements.lastUpdate.textContent = "Ошибка";
  }
}

// Загрузка информации о безопасности
async function loadSecurityInfo() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/security`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const security = await response.json();

    elements.securityInfo.innerHTML = `
      <div class="security-section">
        <h4>Контейнер</h4>
        <div class="security-item">
          <span>Пользователь:</span>
          <span>${security.container.user}</span>
        </div>
        <div class="security-item">
          <span>Capabilities:</span>
          <span>${security.container.capabilities}</span>
        </div>
        <div class="security-item">
          <span>Read-only FS:</span>
          <span>${security.container.readOnlyFs}</span>
        </div>
      </div>
      <div class="security-section">
        <h4>Сеть</h4>
        <div class="security-item">
          <span>Network Policies:</span>
          <span>${security.network.policies}</span>
        </div>
        <div class="security-item">
          <span>TLS:</span>
          <span>${security.network.tls}</span>
        </div>
      </div>
      <div class="security-section">
        <h4>Pod</h4>
        <div class="security-item">
          <span>Service Account:</span>
          <span>${security.pod.serviceAccount}</span>
        </div>
        <div class="security-item">
          <span>Security Context:</span>
          <span>${security.pod.securityContext}</span>
        </div>
      </div>
    `;
  } catch (error) {
    console.error("Security info fetch error:", {
      error,
      timestamp: new Date().toISOString(),
    });
    elements.securityInfo.innerHTML =
      '<div class="error">Ошибка загрузки информации о безопасности. Пожалуйста, попробуйте позже.</div>';
  }
}

// Загрузка API эндпоинтов
async function loadEndpoints() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/endpoints`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();

    elements.endpoints.innerHTML = `
      <div style="margin-bottom: 15px;">
        <strong>Сервис:</strong> ${data.service}<br>
        <strong>Версия:</strong> ${data.version}<br>
        <strong>Всего эндпоинтов:</strong> ${data.totalEndpoints}
      </div>
      ${data.endpoints
        .map(
          (endpoint) => `
          <div class="endpoint-item">
            ${endpoint.methods
              .map(
                (method) =>
                  `<span class="endpoint-method method-${method.toLowerCase()}">${method}</span>`
              )
              .join("")}
            <span class="endpoint-path">${endpoint.path}</span>
            <div class="endpoint-description">${endpoint.description}</div>
          </div>
        `
        )
        .join("")}
    `;
  } catch (error) {
    console.error("Endpoints fetch error:", {
      error,
      timestamp: new Date().toISOString(),
    });
    elements.endpoints.innerHTML =
      '<div class="error">Ошибка загрузки списка эндпоинтов. Пожалуйста, попробуйте позже.</div>';
  }
}

// Динамическая загрузка скрипта с nonce
async function loadScriptWithNonce() {
  if (document.querySelector("script[nonce]")) {
    console.log("Script with nonce already loaded");
    initializeApp();
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/nonce`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const { nonce } = await response.json();

    const script = document.createElement("script");
    script.src = "/script.js";
    script.setAttribute("nonce", nonce);
    script.onload = initializeApp;
    const mainScript = $("mainScript");
    if (!mainScript) {
      console.error('Element with id "mainScript" not found');
      elements.statusText.textContent = "Ошибка загрузки приложения";
      return;
    }
    mainScript.replaceWith(script);
  } catch (error) {
    console.error("Error loading script with nonce:", {
      error,
      timestamp: new Date().toISOString(),
    });
    elements.statusText.textContent =
      "Ошибка загрузки приложения. Запускаем без nonce.";
    initializeApp(); // Запускаем приложение даже при ошибке nonce
  }
}

// Инициализация приложения
function initializeApp() {
  checkHealth();
  Promise.all([loadUsers(), loadStats(), loadSecurityInfo(), loadEndpoints()]);
  setInterval(checkHealth, 30000);
  setInterval(loadStats, 60000);

  elements.createUserButton.addEventListener(
    "click",
    debounce(createUser, 300)
  );
  elements.refreshStatsButton.addEventListener("click", loadStats);
  elements.refreshSecurityButton.addEventListener("click", loadSecurityInfo);
  elements.refreshEndpointsButton.addEventListener("click", loadEndpoints);

  elements.userName.addEventListener("keypress", (e) => {
    if (e.key === "Enter") elements.userEmail.focus();
  });

  elements.userEmail.addEventListener("keypress", (e) => {
    if (e.key === "Enter") createUser();
  });
}

// Запуск загрузки скрипта при загрузке страницы
document.addEventListener("DOMContentLoaded", loadScriptWithNonce);
