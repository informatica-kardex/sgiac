import rateLimit from "express-rate-limit";

// Limite general para toda la API
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  // Estas lecturas automáticas tienen límites propios para no consumir el de navegación.
  skip: req => req.method === "GET" && ["/api/fichas/tablero", "/api/fichas/panel", "/api/estudiantes/atencion", "/api/fichas/tv/config", "/api/documentos/mis-solicitudes", "/api/documentos/bandeja", "/api/telegram/vinculo"].includes(req.path),
  message: {
    success: false,
    message: "Demasiadas solicitudes. Intenta nuevamente mas tarde.",
  },
});

export const atencionPollingLimiter = rateLimit({
  windowMs: 60000, limit: 120,
  keyGenerator: req => `usuario:${req.user!.idUsuario}`,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: "Demasiadas actualizaciones. Espera un minuto." },
});

// Trámites autenticados: no compartir el cupo de login entre estudiantes de una misma red.
export const documentosMutationLimiter = rateLimit({
  windowMs: 60000, limit: 20,
  keyGenerator: req => `documentos:${req.user!.idUsuario}`,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: "Demasiadas operaciones. Espera un minuto antes de continuar." },
});
export const tableroPollingLimiter = rateLimit({
  windowMs: 60000, limit: 600,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: "Demasiadas actualizaciones del tablero. Espera un minuto." },
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
