import { prisma } from "../../database/prisma";
import { ApiError } from "../../utils/apiError";

export const SESSION_IDLE_MS = 3 * 60_000;
export const SESSION_MAX_MS = 8 * 60 * 60_000;

export function sessionExpired() {
  return new ApiError(401, "Tu sesión terminó. Inicia sesión nuevamente", { code: "SESSION_EXPIRED" });
}

export async function currentSession(idUsuario: string, sessionId?: number) {
  if (!Number.isSafeInteger(sessionId) || sessionId! <= 0) throw sessionExpired();
  const session = await prisma.refreshToken.findUnique({ where: { idRefreshToken: sessionId } });
  if (!session || session.idUsuario.toString() !== idUsuario || session.revocado ||
      session.expiraEn.getTime() <= Date.now() || session.creadoEn.getTime() + SESSION_MAX_MS <= Date.now()) {
    throw sessionExpired();
  }
  return session;
}

export async function recordActivity(idUsuario: string, sessionId?: number) {
  const session = await currentSession(idUsuario, sessionId);
  const now = Date.now();
  const expiresAt = Math.min(now + SESSION_IDLE_MS, session.creadoEn.getTime() + SESSION_MAX_MS);
  // La condición se comprueba también al escribir: una petición pendiente no revive una sesión cerrada.
  const result = await prisma.refreshToken.updateMany({
    where: { idRefreshToken: session.idRefreshToken, revocado: false, expiraEn: { gt: new Date(now) } },
    data: { expiraEn: new Date(expiresAt) },
  });
  if (result.count !== 1) throw sessionExpired();
  return { id: session.idRefreshToken, expiresAt };
}
