// src/app.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import passport from "./config/passport.js";
import { startSyncCron } from "./jobs/syncCron.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter, authLimiter } from "./middleware/rateLimiter.js";
import authRoutes from "./routes/authRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import goalRoutes from "./routes/goalRoutes.js";
import summaryRoutes from "./routes/summaryRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import gmailRoutes from "./routes/gmailRoutes.js";

// __dirname no existe en ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// ─── Seguridad ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || "http://127.0.0.1:5500",
    credentials: true,
  })
);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));

// ─── Passport OAuth ───────────────────────────────────────────────────────────
app.use(passport.initialize());

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use("/api", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// ─── Static frontend ──────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "..", "frontend")));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) =>
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || "development",
  })
);

// ─── API routes ───────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/summary", summaryRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/gmail", gmailRoutes);

// ─── SPA fallback ─────────────────────────────────────────────────────────────
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

// ─── 404 para rutas API no encontradas ────────────────────────────────────────
app.use("/api/*path", (req, res) => {
  res.status(404).json({
    success: false,
    code: "NOT_FOUND",
    message: `Ruta ${req.method} ${req.originalUrl} no encontrada`,
  });
});

// ─── Error handler centralizado (SIEMPRE al final) ───────────────────────────
app.use(errorHandler);