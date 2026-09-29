import { Permiso } from "../modules/roles/permissions";
import jwt, { SignOptions } from "jsonwebtoken";
import { createHmac } from "crypto";
import { env } from "../config/env";

export interface AccessTokenPayload {
  idUsuario: string;
  correo: string;
  roles: string[];
  permisos?: Permiso[];
  debeCambiarPassword?: boolean;
  correoVerificado?: boolean;
  credentialVersion?: string;
}

export interface RefreshTokenPayload {
  idUsuario: string;
  tokenId: string;
  credentialVersion?: string;
}

// Vincula la sesión a la contraseña vigente sin publicar su hash de almacenamiento.
export function credentialVersion(passwordHash: string | null) {
  return createHmac("sha256", env.jwtSecret).update(passwordHash ?? "").digest("hex");
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtAccessExpiresIn,
  } as SignOptions);
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn,
  } as SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as RefreshTokenPayload;
}
