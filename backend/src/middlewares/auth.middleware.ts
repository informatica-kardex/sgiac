import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError";
import { AccessTokenPayload, verifyAccessToken } from "../utils/jwt";
import { ROLES_ADMINISTRATIVOS } from "../modules/roles/role.repository";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  // Fallback: cookie httpOnly "accessToken"
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken;
  }
  return null;
}

// Middleware opcional: si se envia un access token valido, lo
// decodifica y lo adjunta a req.user; si no hay token o es
// invalido, continua sin error. Util para endpoints publicos
// (comunicados, horarios, faq) que muestran informacion extra
// cuando la peticion viene del panel administrativo autenticado.
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return next();
  }
  try {
    req.user = verifyAccessToken(token);
  } catch {
    // token invalido/expirado: se ignora, la peticion sigue como publica
  }
  return next();
}

// Middleware requireAuth(): valida que exista un access token
// valido. Adjunta el payload decodificado a req.user.
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const token = extractToken(req);

  if (!token) {
    return next(ApiError.unauthorized("No se proporciono un token de acceso"));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    return next();
  } catch (error) {
    return next(ApiError.unauthorized("Token invalido o expirado"));
  }
}

// Middleware de autorizacion por rol. Preparado para que los
// futuros modulos (aulas, horarios, comunicados, etc.) puedan
// restringir endpoints por rol especifico.
//
// Uso: router.get("/ruta", requireAuth, requireRole("ADMINISTRADOR"), handler)
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized("No autenticado"));
    }

    const hasRole = req.user.roles.some((role) =>
      allowedRoles.includes(role)
    );

    if (!hasRole) {
      return next(
        ApiError.forbidden(
          "No tienes permisos suficientes para acceder a este recurso"
        )
      );
    }

    return next();
  };
}

// Middleware de conveniencia: exige que el usuario tenga alguno
// de los roles con acceso al panel administrativo (/admin).
// Si se pasan roles especificos, se restringe aun mas (ej. solo
// ADMINISTRADOR para /admin/usuarios).
export function requireAdmin(...specificRoles: string[]) {
  const roles = specificRoles.length > 0 ? specificRoles : [...ROLES_ADMINISTRATIVOS];
  return requireRole(...roles);
}
