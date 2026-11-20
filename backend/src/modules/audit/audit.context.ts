import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request } from 'express';

export const auditContext = new AsyncLocalStorage<{
  requestId: string; req: Request; actorId?: bigint | number;
}>();

const secret = /password|contrasena|contraseña|token|secret|authorization|cookie|captcha|challenge|credential|hash|^codigo$|^code$|^ci$|^buffer$|^stack$|^html$|^contenido$|^url$|^path$|^rutaArchivo$|^enlace$/i;
const hidden = '[PROTEGIDO]';

// Límites compartidos para no guardar binarios ni cuerpos arbitrariamente grandes.
export function sanitizeAudit(value: unknown, depth = 0, budget = { left: 24000 }): unknown {
  if (budget.left <= 0 || depth > 8) return '[TRUNCADO]';
  budget.left -= 8;
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return '[ARCHIVO]';
  if (typeof value === 'string') {
    const text = value.replace(/Bearer\s+\S+/gi, `Bearer ${hidden}`)
      .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, hidden)
      .replace(/((?:password|contrasena|contraseña|token|secret|codigo|code|ci)\s*[=:]\s*)[^\s&,;]+/gi, `$1${hidden}`)
      .replace(/(https?:\/\/[^\s?]+)\?[^\s]+/gi, '$1?[PROTEGIDO]');
    const length = Math.min(2000, budget.left);
    budget.left -= Math.min(text.length, length);
    return text.length > length ? `${text.slice(0, length)} [TRUNCADO]` : text;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const items = value.slice(0, 50).map(item => sanitizeAudit(item, depth + 1, budget));
    if (value.length > 50) items.push(`[${value.length - 50} elementos omitidos]`);
    return items;
  }
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 60).map(([key, item]) => {
      budget.left -= key.length;
      return [key, secret.test(key.normalize('NFD').replace(/[\u0300-\u036f]/g, '')) ? hidden : sanitizeAudit(item, depth + 1, budget)];
    }));
  }
  return String(value);
}

export function safeAuditPath(path: string) {
  return path.split('?')[0].replace(/(\/carnet\/)[^/]+/gi, '$1[PROTEGIDO]').slice(0, 500);
}

export function auditMetadata() {
  const context = auditContext.getStore();
  if (!context) return {};
  const { req, requestId } = context;
  return {
    requestId, metodo: req.method, ruta: safeAuditPath(req.originalUrl),
    ip: req.ip || req.socket?.remoteAddress || null,
    navegador: String(sanitizeAudit(req.get('user-agent') || '')).slice(0, 500),
    actor: req.user ? { idUsuario: req.user.idUsuario, correo: req.user.correo, roles: req.user.roles } : null,
  };
}

export function parseAuditDetail(detail: string | null | undefined): unknown {
  if (!detail) return null;
  try { return JSON.parse(detail); } catch { return detail; }
}

// Se aplica también a los eventos escritos dentro de transacciones existentes.
export function enrichAuditData(data: { detalle?: string | null; idUsuario?: bigint | number | null }) {
  const context = auditContext.getStore();
  if (context && data.idUsuario != null) context.actorId = data.idUsuario;
  const original = parseAuditDetail(data.detalle);
  const structured = original && typeof original === 'object' && !Array.isArray(original) ? original : { descripcion: original };
  data.detalle = JSON.stringify(sanitizeAudit({ ...structured, ...auditMetadata() }));
}
