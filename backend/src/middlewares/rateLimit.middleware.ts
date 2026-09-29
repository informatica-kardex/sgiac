import rateLimit from "express-rate-limit";

// Limite general para toda la API
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Demasiadas solicitudes. Intenta nuevamente mas tarde.",
  },
});

// Limite estricto para endpoints sensibles de autenticacion
// (login, registro, recuperacion de contrasena) para mitigar
// fuerza bruta y abuso.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Demasiados intentos. Por seguridad, espera unos minutos antes de volver a intentar.",
  },
});

// Límite por cuenta, además del límite por IP, para los códigos de seis dígitos.
export const emailVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: req => typeof req.body?.correo === "string" ? req.body.correo.trim().toLowerCase() : "correo-invalido",
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: "Demasiados códigos incorrectos. Espera 15 minutos antes de volver a intentar." },
});
