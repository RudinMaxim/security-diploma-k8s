const API_BASE_URL = window.API_URL || '/api';

const $ = (id) => document.getElementById(id);
const formatDate = (dateString) => new Date(dateString).toLocaleString("ru-RU");

async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();

    const indicator = $("statusIndicator");
    const statusText = $("statusText");

    if (data.status === "healthy") {
      indicator.className = "status-indicator healthy";
      statusText.textContent = "Сервис работает";
    } else {
      indicator.className = "status-indicator unhealthy";
      statusText.textContent = "Проблемы с сервисом";
    }
  } catch (error) {
    console.error("Health check error:", error);
    const indicator = $("statusIndicator");
    const statusText = $("statusText");
    indicator.className = "status-indicator unhealthy";
    statusText.textContent = "Сервис недоступен";
  }
}

async function loadUsers() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/users`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const users = await response.json();

    const usersList = $("usersList");

    if (users.length === 0) {
      usersList.innerHTML = '<p class="loading">Пользователи не найдены</p>';
      return;
    }

    usersList.innerHTML = users
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
    console.error("Users fetch error:", error);
    $("usersList").innerHTML =
      '<div class="error">Ошибка загрузки пользователей</div>';
  }
}

async function createUser() {
  const name = $("userName").value.trim();
  const email = $("userEmail").value.trim();

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
      $("userName").value = "";
      $("userEmail").value = "";
      await loadUsers();
      await loadStats();
    } else {
      alert("Ошибка создания пользователя");
    }
  } catch (error) {
    console.error("User creation error:", error);
    alert("Ошибка соединения с сервером");
  }
}

async function loadStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/stats`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const stats = await response.json();

    $("userCount").textContent = stats.userCount;
    $("lastUpdate").textContent = formatDate(stats.timestamp);
  } catch (error) {
    console.error("Stats fetch error:", error);
    $("userCount").textContent = "Ошибка";
    $("lastUpdate").textContent = "Ошибка";
  }
}

async function loadSecurityInfo() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/security`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const security = await response.json();

    const securityInfo = $("securityInfo");
    securityInfo.innerHTML = `
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
    console.error("Security info fetch error:", error);
    $("securityInfo").innerHTML =
      '<div class="error">Ошибка загрузки информации о безопасности</div>';
  }
}
async function loadEndpoints() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/endpoints`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();

    const endpoints = $("endpoints");
    endpoints.innerHTML = `
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
                    <div class="endpoint-description">${
                      endpoint.description
                    }</div>
                </div>
            `
              )
              .join("")}
        `;
  } catch (error) {
    console.error("Endpoints fetch error:", error);
    $("endpoints").innerHTML =
      '<div class="error">Ошибка загрузки списка эндпоинтов</div>';
  }
}

async function loadScriptWithNonce() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/nonce`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const { nonce } = await response.json();

    const script = document.createElement("script");
    script.src = "script.js";
    script.setAttribute("nonce", nonce);
    script.onload = async () => {
      await checkHealth();
      await Promise.all([
        loadUsers(),
        loadStats(),
        loadSecurityInfo(),
        loadEndpoints(),
      ]);
      setInterval(checkHealth, 30000);
      setInterval(loadStats, 60000);

      $("createUserButton").addEventListener("click", createUser);
      $("refreshStatsButton").addEventListener("click", loadStats);
      $("refreshSecurityButton").addEventListener("click", loadSecurityInfo);
      $("refreshEndpointsButton").addEventListener("click", loadEndpoints);

      $("userName").addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          $("userEmail").focus();
        }
      });

      $("userEmail").addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          createUser();
        }
      });
    };
    document.getElementById("mainScript").replaceWith(script);
  } catch (error) {
    console.error("Error loading script with nonce:", error);
  }
}

document.addEventListener("DOMContentLoaded", loadScriptWithNonce);
