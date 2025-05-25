const express = require("express");
const { Pool } = require("pg");
const redis = require("redis");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

const generateNonce = () => {
  return crypto.randomBytes(16).toString("base64");
};

app.use((req, res, next) => {
  const nonce = generateNonce();
  res.locals.nonce = nonce;
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' http://localhost:3000; object-src 'none';`
  );
  next();
});

const pgPool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "postgres-service",
  database: process.env.DB_NAME || "appdb",
  password: process.env.DB_PASSWORD || "password",
  port: process.env.DB_PORT || 5432,
});

const redisClient = redis.createClient({
  url: `redis://${process.env.REDIS_HOST || "redis-service"}:${
    process.env.REDIS_PORT || 6379
  }`,
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

app.use(cors());
app.use(express.json());

app.get("/nonce", (req, res) => {
  res.json({ nonce: res.locals.nonce });
});

app.get("/health", async (req, res) => {
  try {
    await pgPool.query("SELECT 1");
    await redisClient.ping();
    res.json({
      status: "healthy",
      database: "connected",
      cache: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({
      status: "unhealthy",
      error: error.message,
    });
  }
});

app.get("/users", async (req, res) => {
  try {
    const result = await pgPool.query("SELECT id, name, email FROM users");
    res.json(result.rows);
  } catch (error) {
    console.error("Users fetch error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/users", async (req, res) => {
  const { name, email } = req.body;
  try {
    const result = await pgPool.query(
      "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
      [name, email]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("User creation error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/stats", async (req, res) => {
  try {
    const cached = await redisClient.get("stats");
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const result = await pgPool.query(
      "SELECT COUNT(*) as user_count FROM users"
    );
    const stats = {
      userCount: parseInt(result.rows[0].user_count),
      timestamp: new Date().toISOString(),
    };

    await redisClient.setEx("stats", 60, JSON.stringify(stats));
    res.json(stats);
  } catch (error) {
    console.error("Stats fetch error:", error);
    res.status(500).json({ error: "Service error" });
  }
});

app.get("/security", (req, res) => {
  res.json({
    container: {
      user: process.getuid ? process.getuid() : "unknown",
      capabilities: process.env.CAPABILITIES || "none",
      readOnlyFs: process.env.READ_ONLY_FS || "false",
    },
    network: {
      policies: process.env.NETWORK_POLICIES || "enabled",
      tls: process.env.TLS_ENABLED || "true",
    },
    pod: {
      serviceAccount: process.env.SERVICE_ACCOUNT || "default",
      securityContext: process.env.SECURITY_CONTEXT || "restricted",
    },
  });
});

app.get("/endpoints", (req, res) => {
  const endpoints = [];

  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      const methods = Object.keys(middleware.route.methods);
      endpoints.push({
        path: middleware.route.path,
        methods: methods.map((method) => method.toUpperCase()),
        description: getEndpointDescription(middleware.route.path, methods[0]),
      });
    } else if (middleware.name === "router") {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const methods = Object.keys(handler.route.methods);
          endpoints.push({
            path: handler.route.path,
            methods: methods.map((method) => method.toUpperCase()),
            description: getEndpointDescription(handler.route.path, methods[0]),
          });
        }
      });
    }
  });

  res.json({
    service: "Security Diploma K8s Backend",
    version: "1.0.0",
    totalEndpoints: endpoints.length,
    endpoints: endpoints.sort((a, b) => a.path.localeCompare(b.path)),
    timestamp: new Date().toISOString(),
  });
});

function getEndpointDescription(path, method) {
  const descriptions = {
    "/health": "Проверка состояния сервиса и подключений к БД и Redis",
    "/users":
      method === "get"
        ? "Получение списка всех пользователей"
        : "Создание нового пользователя",
    "/api/stats": "Получение статистики (кэшируется в Redis на 60 сек)",
    "/api/security": "Информация о безопасности контейнера и pod'а",
    "/api/endpoints": "Список всех доступных API эндпоинтов",
    "/api/nonce": "Получение nonce для CSP",
  };

  return descriptions[path] || "Описание недоступно";
}

(async () => {
  try {
    await redisClient.connect();
    console.log("Connected to Redis");
  } catch (err) {
    console.error("Failed to connect to Redis:", err);
  }
})();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on port ${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  GET  /health - Health check`);
  console.log(`  GET  /users - Get all users`);
  console.log(`  POST /users - Create new user`);
  console.log(`  GET  /stats - Get statistics`);
  console.log(`  GET  /security - Security information`);
  console.log(`  GET  /endpoints - List all endpoints`);
  console.log(`  GET  /nonce - Get nonce for CSP`);
});
