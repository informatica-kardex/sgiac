import { FuncionSubadmin, tienePermiso } from "../modules/roles/permissions";
﻿import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError";
import { AccessTokenPayload, credentialVersion, verifyAccessToken } from "../utils/jwt";
import { ROLES_ADMINISTRATIVOS, rolesActivos } from "../modules/roles/role.repository";
import { prisma } from "../database/prisma";

declare global {
  namespace Express {
    interface Request { user?: AccessTokenPayload; }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.substring(7) : req.cookies?.accessToken || null;
}

async function sesionActual(token: string): Promise<AccessTokenPayload> {
  let payload: AccessTokenPayload;
  try {
    payload = verifyAccessToken(token);
    if (!/^\d+$/.test(payload.idUsuario)) throw new Error("ID inválido");
  } catch { throw ApiError.unauthorized("Token inválido o expirado"); }
  const usuario = await prisma.usuario.findUnique({
    where: { idUsuario: BigInt(payload.idUsuario) }, include: { permisos: true, roles: { include: { rol: true } } },
  });
  if (!usuario || usuario.estado.toUpperCase() !== "ACTIVO") throw ApiError.unauthorized("Cuenta inactiva o inexistente");
  if (payload.credentialVersion !== credentialVersion(usuario.contrasenaHash)) {
    throw ApiError.unauthorized("Tu sesión ya no es válida. Inicia sesión nuevamente");
  }
  // Los tokens temporales no se convierten en sesiones completas después del cambio.
  if (payload.debeCambiarPassword && !usuario.debeCambiarPassword) {
    throw ApiError.unauthorized("La contraseña cambió. Inicia sesión nuevamente");
  }
  return { idUsuario: usuario.idUsuario.toString(), correo: usuario.correo,
    roles: rolesActivos(usuario.roles), permisos: usuario.permisos ?? [], debeCambiarPassword: usuario.debeCambiarPassword,
    correoVerificado: usuario.correoVerificado };
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  delete req.user;
  const token = extractToken(req);
  if (!token) return next();
  try {
    const user = await sesionActual(token);
    if (user.correoVerificado && !user.debeCambiarPassword) req.user = user;
  } catch (error) {
    if (!(error instanceof ApiError) || error.statusCode !== 401) return next(error);
  }
  return next();
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next(ApiError.unauthorized("No se proporcionó un token de acceso"));
  try {
    req.user = await sesionActual(token);
    const permitidas = ["GET /api/auth/me", "POST /api/auth/logout", "POST /api/auth/change-password"];
    const ruta = `${req.method} ${req.baseUrl}${req.path}`.replace(/\/$/, "");
    if (!req.user.correoVerificado && !["GET /api/auth/me", "POST /api/auth/logout"].includes(ruta)) {
      return next(new ApiError(403, "Confirma tu correo electrónico antes de continuar", { code: "EMAIL_VERIFICATION_REQUIRED" }));
    }
    if (req.user.debeCambiarPassword && !permitidas.includes(ruta)) {
      return next(new ApiError(403, "Debes cambiar tu contraseña temporal antes de continuar", { code: "PASSWORD_CHANGE_REQUIRED" }));
    }
    return next();
  } catch (error) { return next(error); }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized("No autenticado"));
    if (!req.user.correoVerificado || req.user.debeCambiarPassword || !req.user.roles.some(role => allowedRoles.includes(role))) {
      return next(ApiError.forbidden("No tienes permisos suficientes para acceder a este recurso"));
    }
    return next();
  };
}

export function requireAdmin(...specificRoles: string[]) {
  return requireRole(...(specificRoles.length ? specificRoles : ROLES_ADMINISTRATIVOS));
}

export function requirePermission(modulo: FuncionSubadmin) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized("No autenticado"));
    if (!req.user.correoVerificado || req.user.debeCambiarPassword || !tienePermiso(req.user, modulo)) {
      return next(ApiError.forbidden("No tienes esta función asignada o está fuera de su periodo de acceso"));
    }
    return next();
  };
}
