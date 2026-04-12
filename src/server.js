import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pool from "./config/db.js";
import path from "path";
import { fileURLToPath } from "url";

import paypalRoutes from "./routes/paypal.routes.js";
import bccrRoutes from "./routes/bccr.routes.js";
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import orderRoutes from "./routes/orders.routes.js";
import userRoutes from "./routes/user.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import securityRoutes from "./routes/security.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import economyRoutes from "./routes/economy.routes.js";
import integrationsRoutes from "./routes/integrations.routes.js";
import tseRoutes from "./routes/tse.routes.js";
import bankRoutes from "./routes/bank.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import ubicacionesRoutes from "./routes/ubicaciones.routes.js";

import { verifyToken, isAdmin } from "./middleware/auth.middleware.js";

const app = express();

// =============================
// RENDER / PROXY
// =============================
app.set("trust proxy", 1);

// =============================
// PATHS
// =============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================
// CONFIG
// =============================
const PORT = process.env.PORT || 4000;
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL ||
  process.env.BACKEND_URL ||
  `http://localhost:${PORT}`;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// =============================
// CORS
// =============================
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origen no permitido por CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// =============================
// BODY PARSERS
// =============================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================
// SECURITY HEADERS
// =============================
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// =============================
// RATE LIMIT GLOBAL
// =============================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiadas peticiones desde esta IP. Intente más tarde.",
  },
});

app.use(limiter);

// =============================
// RATE LIMIT LOGIN
// =============================
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    const resetTime =
      req.rateLimit?.resetTime instanceof Date
        ? req.rateLimit.resetTime.getTime()
        : Date.now() + 15 * 60 * 1000;

    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((resetTime - Date.now()) / 1000)
    );

    res.set("Retry-After", String(retryAfterSeconds));

    return res.status(options.statusCode).json({
      error: "Demasiados intentos de login. Intente nuevamente en 15 minutos.",
      retryAfterSeconds,
      retryAfterMinutes: Math.ceil(retryAfterSeconds / 60),
    });
  },
});

app.use("/api/auth/login", loginLimiter);

// =============================
// STATIC FILES
// =============================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// =============================
// ROOT
// =============================
app.get("/", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      message: "MySQL principal conectado correctamente ✅",
      database: process.env.DB_NAME || "granos_la_tradicion",
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "Error conectando a MySQL principal",
      detail: error.message,
    });
  }
});

// =============================
// HEALTH
// =============================
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      status: "ok",
      server: "Granos La Tradición API",
      database: process.env.DB_NAME || "granos_la_tradicion",
      time: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      status: "error",
      server: "Granos La Tradición API",
      detail: error.message,
      time: new Date().toISOString(),
    });
  }
});

app.get("/health/bank", (_req, res) => {
  res.json({
    ok: true,
    status: "ok",
    service: "Banco Simulado",
    database: process.env.BANK_DB_NAME || "banco_simulado",
    time: new Date().toISOString(),
  });
});

app.get("/health/tse", (_req, res) => {
  res.json({
    ok: true,
    status: "ok",
    service: "TSE Simulado",
    database: process.env.TSE_DB_NAME || "tse_simulado",
    time: new Date().toISOString(),
  });
});

// =============================
// SYSTEM SERVICES
// =============================
app.get("/api/system/services", (_req, res) => {
  res.json({
    ok: true,
    proyecto: "Granos La Tradición",
    servicios: {
      principal: {
        nombre: "Backend Principal",
        baseUrl: PUBLIC_BASE_URL,
      },
      tseSimulado: {
        nombre: "TSE Simulado",
        baseUrl: process.env.TSE_SIMULADO_BASE_URL || PUBLIC_BASE_URL,
        endpoints: [
          "GET /api/tse/ciudadanos/:cedula",
          "GET /api/integrations/tse/cedula/:cedula",
        ],
      },
      bancoSimulado: {
        nombre: "Banco Simulado",
        endpoints: [
          "POST /api/bank/validate-card",
          "POST /api/bank/process-payment",
          "GET /api/bank/card/:numeroTarjeta",
        ],
      },
      pagos: {
        nombre: "Payments del sistema",
        endpoints: ["POST /api/payments/process"],
      },
      economia: {
        nombre: "BCCR",
        endpoints: [
          "GET /api/economia/tipo-cambio",
          "GET /api/bccr/tipo-cambio",
        ],
      },
    },
  });
});

// =============================
// API ROUTES
// =============================
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/security", securityRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/ubicaciones", ubicacionesRoutes);
app.use("/api/economia", economyRoutes);
app.use("/api/integrations", integrationsRoutes);
app.use("/api/tse", tseRoutes);
app.use("/api/bank", bankRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/bccr", bccrRoutes);
app.use("/api/paypal", paypalRoutes);

// =============================
// PROTECTED TEST ROUTES
// =============================
app.get("/api/protected", verifyToken, (req, res) => {
  res.json({
    ok: true,
    message: "Ruta protegida funcionando correctamente 🔐",
    user: req.user,
  });
});

app.get("/api/admin-only", verifyToken, isAdmin, (req, res) => {
  res.json({
    ok: true,
    message: "Bienvenido administrador 👑",
    user: req.user,
  });
});

// =============================
// 404
// =============================
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: "Ruta no encontrada",
  });
});

// =============================
// ERROR HANDLER
// =============================
app.use((err, _req, res, _next) => {
  console.error("Error del servidor:", err);

  res.status(err.status || 500).json({
    ok: false,
    error: "Error interno del servidor",
    detail: err.message,
  });
});

// =============================
// START SERVER
// =============================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`
=======================================
🚀 Servidor corriendo
🌐 Local: http://localhost:${PORT}
🌐 Public: ${PUBLIC_BASE_URL}
🗄️ DB principal: ${process.env.DB_NAME || "granos_la_tradicion"}
🧾 TSE DB: ${process.env.TSE_DB_NAME || "tse_simulado"}
🏦 BANK DB: ${process.env.BANK_DB_NAME || "banco_simulado"}
=======================================
`);
});