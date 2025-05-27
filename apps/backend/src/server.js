const express = require("express");
const { Pool } = require("pg");
const redis = require("redis");
const cors = require("cors");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const SALT_ROUNDS = 10;

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

// Middleware для проверки JWT токена
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

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

// Эндпоинт для регистрации пользователя
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email and password are required" });
  }

  try {
    // Проверяем, существует ли пользователь
    const existingUser = await pgPool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: "User with this email already exists" });
    }

    // Хэшируем пароль
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Создаем пользователя
    const result = await pgPool.query(
      "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at",
      [name, email, hashedPassword]
    );

    res.status(201).json({
      message: "User registered successfully",
      user: result.rows[0]
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

// Эндпоинт для логина
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    // Находим пользователя по email
    const result = await pgPool.query(
      "SELECT id, name, email, password_hash FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    // Проверяем пароль
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Создаем JWT токен
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        name: user.name 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Сохраняем сессию в Redis (опционально)
    await redisClient.setEx(`session:${user.id}`, 86400, JSON.stringify({
      userId: user.id,
      email: user.email,
      loginTime: new Date().toISOString()
    }));

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Authentication service error" });
  }
});

// Эндпоинт для логаута
app.post("/logout", authenticateToken, async (req, res) => {
  try {
    // Удаляем сессию из Redis
    await redisClient.del(`session:${req.user.userId}`);
    
    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout service error" });
  }
});

// Защищенный эндпоинт для получения профиля пользователя
app.get("/profile", authenticateToken, async (req, res) => {
  try {
    const result = await pgPool.query(
      "SELECT id, name, email, created_at FROM users WHERE id = $1",
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/users", authenticateToken, async (req, res) => {
  try {
    const result = await pgPool.query("SELECT id, name, email, created_at FROM users");
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
        protected: isProtectedEndpoint(middleware.route.path)
      });
    } else if (middleware.name === "router") {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const methods = Object.keys(handler.route.methods);
          endpoints.push({
            path: handler.route.path,
            methods: methods.map((method) => method.toUpperCase()),
            description: getEndpointDescription(handler.route.path, methods[0]),
            protected: isProtectedEndpoint(handler.route.path)
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
    "/register": "Регистрация нового пользователя",
    "/login": "Аутентификация пользователя",
    "/logout": "Выход из системы",
    "/profile": "Получение профиля текущего пользователя",
    "/users":
      method === "get"
        ? "Получение списка всех пользователей"
        : "Создание нового пользователя",
    "/stats": "Получение статистики (кэшируется в Redis на 60 сек)",
    "/security": "Информация о безопасности контейнера и pod'а",
    "/endpoints": "Список всех доступных API эндпоинтов",
    "/nonce": "Получение nonce для CSP",
  };

  return descriptions[path] || "Описание недоступно";
}

function isProtectedEndpoint(path) {
  const protectedPaths = ["/users", "/profile"];
  return protectedPaths.includes(path);
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
  console.log(`  POST /register - User registration`);
  console.log(`  POST /login - User authentication`);
  console.log(`  POST /logout - User logout (protected)`);
  console.log(`  GET  /profile - Get user profile (protected)`);
  console.log(`  GET  /users - Get all users (protected)`);
  console.log(`  POST /users - Create new user`);
  console.log(`  GET  /stats - Get statistics`);
  console.log(`  GET  /security - Security information`);
  console.log(`  GET  /endpoints - List all endpoints`);
  console.log(`  GET  /nonce - Get nonce for CSP`);
});
