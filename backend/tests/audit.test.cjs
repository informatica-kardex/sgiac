const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { once } = require('node:events');
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-audit'; process.env.JWT_REFRESH_SECRET = 'test-audit-refresh';
const database = require('../src/database/prisma');
// Los delegates de Prisma son proxies; usar persistencia simulada evita conexiones reales.
const prisma = database.prisma = { bitacora: { create() {}, findMany() {}, count() {} }, $transaction() {} };
const { sanitizeAudit, safeAuditPath, enrichAuditData, auditContext } = require('../src/modules/audit/audit.context');
const { auditQuerySchema, auditWhere, auditKind, auditResult, csvCell } = require('../src/modules/audit/audit.query');
const { AuditRepository, auditDTO } = require('../src/modules/audit/audit.repository');
const { auditRequests } = require('../src/modules/audit/audit.middleware');

async function serve(t, app) {
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${server.address().port}`;
}

test('protege secretos anidados, datos binarios, enlaces privados y colecciones grandes', () => {
  const data = sanitizeAudit({ contrasena: 'clave', accessToken: 'jwt', CI: '12345',
    nested: [{ passwordHash: 'hash', codigo: '112233', ok: 42n }],
    buffer: Buffer.from('binario'), url: 'https://example.test?token=secreto',
    descripcion: 'Bearer secretvalue password=abc', ruta: '/api/aulas/15',
    largo: 'x'.repeat(10000), items: Array.from({ length: 100 }, (_, id) => ({ id })),
  });
  const json = JSON.stringify(data);
  for (const secret of ['clave', 'jwt', '12345', '112233', 'secretvalue', 'password=abc', 'binario']) assert.ok(!json.includes(secret));
  assert.equal(data.nested[0].ok, '42'); assert.equal(data.ruta, '/api/aulas/15');
  assert.ok(data.largo.includes('[TRUNCADO]')); assert.equal(data.items.length, 51);
  const numbers = Array.from({ length: 50 }, () => Array.from({ length: 50 }, () => Array(50).fill(123456789)));
  assert.ok(JSON.stringify(sanitizeAudit(numbers)).length < 50000, 'También limita colecciones numéricas');
  assert.equal(safeAuditPath('/api/academico/auxiliares/carnet/privado?token=otra'), '/api/academico/auxiliares/carnet/[PROTEGIDO]');
});

test('contexto relaciona eventos internos con la solicitud y conserva su detalle', async () => {
  const req = { method: 'POST', originalUrl: '/api/auth/login', ip: '127.0.0.1', get: () => 'test', user: undefined };
  const a = { requestId: 'a', req }, b = { requestId: 'b', req };
  const events = await Promise.all([a, b].map(context => auditContext.run(context, async () => {
    await new Promise(resolve => setImmediate(resolve));
    const data = { idUsuario: 7n, detalle: JSON.stringify({ antes: { estado: 'ACTIVO' }, despues: { estado: 'INACTIVO', token: 'secreto' } }) };
    enrichAuditData(data); return JSON.parse(data.detalle);
  })));
  assert.deepEqual(events.map(e => e.requestId), ['a', 'b']);
  assert.equal(events[0].antes.estado, 'ACTIVO'); assert.equal(events[0].despues.token, '[PROTEGIDO]');
  assert.equal(a.actorId, 7n); assert.equal(auditContext.getStore(), undefined);
});

test('valida filtros, IDs grandes, límites y fechas con zona horaria', () => {
  for (const q of [{ pagina: 0 }, { limite: 101 }, { usuario: '-1' }, { usuario: '9223372036854775808' },
    { q: 'x'.repeat(151) }, { tipo: 'OTRO' }, { resultado: 'OTRO' }, { desde: 'ayer' },
    { desde: '2026-11-14T00:00:00Z', hasta: '2026-11-13T00:00:00Z' }, { usuario: ['1', '2'] }]) {
    assert.equal(auditQuerySchema.safeParse(q).success, false);
  }
  const query = auditQuerySchema.parse({ usuario: '9007199254740993', desde: '2026-11-13T00:00:00-04:00', hasta: '2026-11-14T00:00:00-04:00', q: 'Ana', tipo: 'ACCESO', resultado: 'RECHAZADO', entidad: 'auth', registro: '42' });
  assert.equal(query.usuario, 9007199254740993n);
  const where = auditWhere(query); assert.ok(where.AND.some(p => p.idUsuario === query.usuario));
  assert.equal(where.AND.find(p => p.fechaHora).fechaHora.gte.toISOString(), '2026-11-13T04:00:00.000Z');
  assert.equal(auditKind('AUTH_LOGIN_FALLIDO'), 'ACCESO'); assert.equal(auditResult('AUTH_LOGIN_FALLIDO'), 'RECHAZADO');
  assert.equal(auditKind('SUBADMIN_CREADO'), 'MODIFICACION'); assert.equal(auditKind('SEED_ADMIN_CREADO'), 'SISTEMA');
  assert.equal(auditResult('HTTP_ERROR_MODIFICACION_AULAS_POST'), 'ERROR');
});

test('CSV neutraliza fórmulas, preserva comillas y saltos de línea', () => {
  for (const value of ['=SUM(1;2)', '+cmd', '-1+2', '@formula', '\t=1+1', '\r\n=1+1']) assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell('Ana "Pérez"\nLópez'), '"Ana ""Pérez""\nLópez"');
});

test('API registra módulos, consultas, rechazos, errores y archivos sin secretos', async t => {
  const events = [];
  t.mock.method(prisma.bitacora, 'create', async ({ data }) => { events.push(data); return data; });
  const app = express(); app.use('/api', auditRequests); app.use(express.json());
  app.use((req, _res, next) => { req.user = { idUsuario: '7', correo: 'ana@test.com', roles: ['ADMINISTRADOR'] }; next(); });
  app.all('/api/:module/:id', (req, res) => {
    if (req.body.fail) return res.status(req.body.fail).json({ message: 'Rechazado' });
    if (req.body.file) req.file = { originalname: 'documento.pdf', mimetype: 'application/pdf', size: 32, buffer: Buffer.from('privado') };
    res.status(req.method === 'POST' ? 201 : 200).json({ message: 'Guardado', data: { id: req.params.id, estado: 'ACTIVO', token: 'TOKEN-PRIVADO' } });
  });
  app.get('/api/auditoria', (_req, res) => res.json({ data: [] }));
  const base = await serve(t, app);
  for (const module of ['users', 'academico', 'aulas', 'horarios', 'comunicados', 'faq', 'fichas', 'documentos', 'estudiantes', 'solicitudes-aulas', 'telegram']) {
    const response = await fetch(`${base}/api/${module}/123`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: 'ACTIVO', contrasena: 'PRIVADA', file: module === 'comunicados' }) });
    assert.equal(response.status, 201); assert.ok(response.headers.get('x-request-id'));
  }
  for (const fail of [400, 401, 403, 409, 429, 500]) await fetch(`${base}/api/users/123`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fail }) });
  await fetch(`${base}/api/aulas/123`); await fetch(`${base}/api/auditoria/123`); await fetch(`${base}/api/auditoria`);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(events.length, 19);
  assert.equal(events[0].idUsuario, 7n); assert.equal(events[0].idRegistroAfectado, '123');
  const details = events.map(e => JSON.parse(e.detalle));
  assert.ok(details.every(d => d.requestId && d.ip && d.ruta && d.duracionMs >= 0));
  assert.ok(!JSON.stringify(details).includes('TOKEN-PRIVADO')); assert.ok(!JSON.stringify(details).includes('PRIVADA'));
  assert.equal(details.find(d => d.archivos.length).archivos[0].nombre, 'documento.pdf');
  assert.ok(events.some(e => e.accion.startsWith('HTTP_RECHAZADO_'))); assert.ok(events.some(e => e.accion.startsWith('HTTP_ERROR_')));
  assert.equal(details.at(-2).respuesta.data, undefined);
});

test('auditoría continúa registrando validaciones previas a las rutas', async t => {
  const events = []; t.mock.method(prisma.bitacora, 'create', async ({ data }) => { events.push(data); return data; });
  const app = express(); app.use('/api', auditRequests); app.use(express.json());
  app.use((err, _req, res, _next) => res.status(400).json({ message: 'JSON inválido' }));
  const base = await serve(t, app);
  const result = await fetch(`${base}/api/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"password":' });
  assert.equal(result.status, 400); await new Promise(resolve => setImmediate(resolve));
  assert.equal(events.length, 1); assert.ok(events[0].accion.startsWith('HTTP_RECHAZADO_'));
});

test('consulta paginada usa filtros compartidos, orden estable y sanitiza historia', async t => {
  const calls = [], row = { idBitacora: 9007199254740993n, accion: 'SUBADMIN_CREADO', entidadAfectada: 'usuario', idUsuario: 7n, idRegistroAfectado: '9', fechaHora: new Date(), detalle: '{"password":"privado"}', usuario: { idUsuario: 7n, nombreCompleto: 'Ana', correo: 'ana@test.com' } };
  t.mock.method(prisma.bitacora, 'findMany', async args => { calls.push(args); return [row]; });
  let n = 0; t.mock.method(prisma.bitacora, 'count', async () => [51, 2, 1][n++]);
  t.mock.method(prisma, '$transaction', async promises => Promise.all(promises));
  const data = await new AuditRepository().list(auditQuerySchema.parse({ pagina: 2, limite: 25, entidad: 'usuario' }));
  assert.equal(data.total, 51); assert.equal(data.paginas, 3); assert.equal(data.resumen.exitosos, 48);
  assert.equal(calls[0].skip, 25); assert.deepEqual(calls[0].orderBy, [{ fechaHora: 'desc' }, { idBitacora: 'desc' }]);
  assert.equal(data.eventos[0].detalle.password, '[PROTEGIDO]');
  assert.equal(auditDTO(row).idBitacora, 9007199254740993n);
});
