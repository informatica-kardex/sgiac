import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { AuditService } from './audit.service';
import { auditContext, auditMetadata, safeAuditPath, sanitizeAudit } from './audit.context';

const service = new AuditService();
const automatic = new Set(['/api/health', '/api/events', '/api/auth/activity', '/api/auth/me', '/api/auth/login/captcha', '/api/notificaciones/pendientes', '/api/fichas/tablero']);

export const auditRequests: RequestHandler = (req, res, next) => {
  const context = { requestId: randomUUID(), req, actorId: undefined as bigint | number | undefined };
  auditContext.run(context, () => {
    const start = performance.now();
    const path = safeAuditPath(req.originalUrl).replace(/\/$/, '');
    res.setHeader('X-Request-Id', context.requestId);
    let response: unknown;
    let affectedId: string | undefined;
    let routeParams: Record<string, string> = {};
    const json = res.json;
    res.json = function (body) {
      routeParams = { ...req.params };
      const data = body?.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const key = Object.keys(data).find(k => /^id(?:[A-Z_]|$)/.test(k));
        if (key && ['string', 'number', 'bigint'].includes(typeof data[key])) affectedId = String(data[key]);
      }
      // Las consultas solo guardan el resumen; no duplican el contenido consultado.
      response = sanitizeAudit(req.method === 'GET' || req.method === 'HEAD'
        ? { message: body?.message, cantidad: Array.isArray(body?.data) ? body.data.length : undefined }
        : { message: body?.message, data: body?.data, details: body?.details });
      return json.call(this, body);
    };
    let registered = false;
    const register = (aborted = false) => {
      if (registered) return;
      registered = true;
      const status = aborted ? 499 : res.statusCode;
      // Evita registrar latidos y las propias lecturas de bitácora, salvo errores.
      if (status < 400 && (automatic.has(path) || req.method === 'OPTIONS' ||
          /^\/api\/auditoria(?:\/filtros)?$/.test(path))) return;
      const segments = path.replace(/^\/api\/?/, '').split('/');
      const module = segments[0] || 'sistema';
      const kind = module === 'auth' ? 'ACCESO' : /exportar|descargar|archivo|carnet/.test(path) && req.method === 'GET'
        ? 'EXPORTACION' : ['GET', 'HEAD'].includes(req.method) || path.endsWith('/disponibilidad') ? 'CONSULTA' : 'MODIFICACION';
      const result = status >= 500 ? 'ERROR' : status >= 400 ? 'RECHAZADO' : 'EXITO';
      const entity = module === 'academico' ? segments[1] || module : module;
      const params = Object.entries({ ...routeParams, ...req.params }).filter(([key]) => !/token|code/i.test(key));
      const id = params.find(([key]) => /^id$|^codigo$/i.test(key))?.[1] ?? affectedId;
      const files = req.file ? [req.file] : Array.isArray(req.files) ? req.files : Object.values(req.files ?? {}).flat();
      const detail = {
        version: 1, ...auditMetadata(), tipo: kind, resultado: result, modulo: module,
        estadoHttp: status, duracionMs: Math.round(performance.now() - start), interrumpida: aborted,
        parametros: Object.fromEntries(params), consulta: req.query,
        entrada: req.body, respuesta: response,
        archivos: files.map(f => ({ nombre: f.originalname, tipo: f.mimetype, bytes: f.size })),
      };
      void service.registrar({
        accion: `HTTP_${result}_${kind}_${module.replace(/-/g, '_').toUpperCase()}_${req.method}`.slice(0, 100),
        entidadAfectada: entity.slice(0, 100), idRegistroAfectado: id?.slice(0, 100),
        idUsuario: req.user ? BigInt(req.user.idUsuario) : context.actorId,
        detalle: JSON.stringify(sanitizeAudit(detail)),
      });
    };
    res.once('finish', () => auditContext.run(context, () => register()));
    res.once('close', () => { if (!res.writableFinished) auditContext.run(context, () => register(true)); });
    next();
  });
};
