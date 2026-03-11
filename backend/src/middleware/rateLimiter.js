// src/middleware/rateLimiter.js
// Rate limiting para proteger la API en producción.
// Usa express-rate-limit (sin Redis, en memoria — suficiente para un solo proceso).
// Si en el futuro escalas a múltiples procesos, cambia el store por RedisStore.

import rateLimit from "express-rate-limit";

// ─── Handler de respuesta cuando se excede el límite ────────────────────────

export const limitExceededHandler = (req, res) => {
  res.status(429).json({
    success: false,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Demasiadas peticiones. Por favor espera un momento antes de reintentar.',
    retryAfter: res.getHeader('Retry-After'),
  });
};

// ─── Límite general de la API ────────────────────────────────────────────────
// 200 peticiones por IP cada 15 minutos — protege contra scraping y fuerza bruta básica.

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  standardHeaders: true,  // incluye RateLimit-* headers en la respuesta
  legacyHeaders: false,
  handler: limitExceededHandler,
  // Permitir IPs de confianza (ej: load balancer) si las hay
  // skip: (req) => req.ip === '127.0.0.1',
});

// ─── Límite para autenticación ───────────────────────────────────────────────
// 10 intentos por IP cada 15 minutos — previene ataques de fuerza bruta al login.

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitExceededHandler,
  // Contar solo intentos fallidos (comentado porque requiere lógica extra)
  // skipSuccessfulRequests: true,
});

// ─── Límite para el agente IA ────────────────────────────────────────────────
// 30 mensajes por IP cada hora — cada llamada consume tokens reales de OpenAI.
// Ajusta según tu presupuesto de API.

export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      code: 'AI_RATE_LIMIT_EXCEEDED',
      message: 'Has alcanzado el límite de mensajes al agente IA por hora. Intenta más tarde.',
      retryAfter: res.getHeader('Retry-After'),
    });
  },
});
