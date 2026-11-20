const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { once } = require('node:events');
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-permissions'; process.env.JWT_REFRESH_SECRET = 'test-permissions-refresh';
const database = require('../src/database/prisma');
const prisma = database.prisma = { usuario: { findUnique() {}, findMany() {} }, solicitudAula: { count() {} } };
const auth = require('../src/middlewares/auth.middleware');
let identity;
auth.requireAuth = (req, _res, next) => { req.user = identity; next(); };
const { userController } = require('../src/modules/users/user.controller');
for (const key of ['cambiarEstado', 'resetearPassword', 'crear', 'asignarPermisos', 'crearEstudiante']) userController[key] = (_req, res) => res.json({ success: true });
const userRoutes = require('../src/modules/users/user.routes').default;
const auditRoutes = require('../src/modules/audit/audit.routes').default;
const solicitudRoutes = require('../src/modules/solicitudes-aulas/solicitud-aula.routes').default;
const academicRoutes = require('../src/modules/academico/academico.routes').default;
const documentRoutes = require('../src/modules/documentos/documento.routes').default;
const { solicitudesPendientes } = require('../src/modules/notificaciones/notificacion.routes');
const { AuditRepository } = require('../src/modules/audit/audit.repository');
const { solicitudAulaService } = require('../src/modules/solicitudes-aulas/solicitud-aula.service');
const { academicoService } = require('../src/modules/academico/academico.service');
const { tienePermiso, FUNCIONES_SUBADMIN } = require('../src/modules/roles/permissions');
const { asignarPermisosSchema } = require('../src/modules/users/user.validation');
const subadmin = (modulos = [], dates = {}) => ({ idUsuario: '7', roles: ['SUBADMINISTRADOR'], correoVerificado: true, debeCambiarPassword: false,
  permisos: modulos.map(modulo => ({ modulo, desde: null, hasta: null, ...dates })) });

test('todos los módulos delegables aceptan vigencia y no permiten escalar roles', () => {
  assert.equal(asignarPermisosSchema.safeParse({ permisos: FUNCIONES_SUBADMIN.map(modulo => ({ modulo, desde: null, hasta: null })) }).success, true);
  for (const modulo of ['ver-horarios', 'solicitudes-aulas', 'estudiantes', 'auditoria']) {
    assert.equal(tienePermiso(subadmin([modulo]), modulo), true);
    assert.equal(tienePermiso(subadmin([]), modulo), false);
    assert.equal(tienePermiso(subadmin([modulo], { desde: '2020-01-01', hasta: '2020-01-02' }), modulo), false);
  }
  for (const modulo of ['roles', 'subadministradores']) assert.equal(asignarPermisosSchema.safeParse({ permisos: [{ modulo }] }).success, false);
});

test('rutas protegen cuentas administrativas, lectura de horarios y auditoría delegada', async t => {
  t.mock.method(prisma.usuario, 'findUnique', async ({ where }) => ({ idUsuario: where.idUsuario, estudiante: {},
    roles: [{ rol: { nombre: where.idUsuario === 11n ? 'SUBADMINISTRADOR' : where.idUsuario === 12n ? 'ADMINISTRADOR' : 'CONSULTA_INTERNA' } }] }));
  const userQueries = []; t.mock.method(prisma.usuario, 'findMany', async args => { userQueries.push(args); return []; });
  t.mock.method(AuditRepository.prototype, 'list', async () => ({ eventos: [], total: 0 }));
  t.mock.method(AuditRepository.prototype, 'detail', async () => null);
  t.mock.method(AuditRepository.prototype, 'export', async () => []);
  t.mock.method(solicitudAulaService, 'listar', async () => []);
  t.mock.method(solicitudAulaService, 'revisar', async () => ({ estado: 'APROBADA' }));
  t.mock.method(academicoService, 'docentes', async () => []);
  const app = express(); app.use(express.json()); app.use('/users', userRoutes); app.use('/auditoria', auditRoutes);
  app.use('/solicitudes-aulas', solicitudRoutes); app.use('/academico', academicRoutes); app.use('/documentos', documentRoutes);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 400).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const request = (url, method = 'GET') => fetch(`http://127.0.0.1:${server.address().port}${url}`, { method, headers: { 'Content-Type': 'application/json' }, ...(method !== 'GET' ? { body: '{}' } : {}) });
  identity = subadmin(['estudiantes']);
  assert.equal((await request('/users/estudiantes')).status, 200);
  assert.ok(userQueries[0].where.roles.none); // El filtrado de cuentas se aplica en el servidor.
  assert.equal((await request('/users')).status, 403);
  assert.equal((await request('/users/10/estado', 'PATCH')).status, 200);
  assert.equal((await request('/users/10/reset-password', 'POST')).status, 200);
  for (const id of [11, 12]) for (const [action, method] of [['estado', 'PATCH'], ['reset-password', 'POST'], ['permisos', 'PATCH']]) {
    assert.equal((await request(`/users/${id}/${action}`, method)).status, 403);
  }
  assert.equal((await request('/users', 'POST')).status, 403);
  identity = subadmin(['ver-horarios']);
  assert.equal((await request('/academico/docentes')).status, 200);
  assert.equal((await request('/academico/docentes', 'POST')).status, 403);
  assert.equal((await request('/academico/auxiliares/estudiantes')).status, 403);
  identity = subadmin(['solicitudes-aulas']);
  assert.equal((await request('/academico/docentes')).status, 200);
  assert.equal((await request('/academico/docentes', 'POST')).status, 403);
  assert.equal((await request('/solicitudes-aulas/admin')).status, 200);
  assert.equal((await request('/solicitudes-aulas/admin/1/revisar', 'POST')).status, 200);
  identity = subadmin([]); assert.equal((await request('/solicitudes-aulas/admin')).status, 403);
  assert.equal((await request('/documentos/tipos', 'POST')).status, 403);
  identity = subadmin(['documentos']);
  // Con permiso llega a validar el formulario; sin permiso se rechaza antes.
  assert.equal((await request('/documentos/tipos', 'POST')).status, 400);
  identity = subadmin([]);
  for (const url of ['/auditoria', '/auditoria/exportar', '/auditoria/1']) assert.equal((await request(url)).status, 403);
  identity = subadmin(['auditoria']);
  assert.equal((await request('/auditoria')).status, 200);
  const csv = await request('/auditoria/exportar'); assert.equal(csv.status, 200); assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert.equal((await request('/auditoria/1')).status, 404);
  assert.equal((await request('/auditoria/1', 'DELETE')).status, 404);
  identity = subadmin(['auditoria'], { desde: '2020-01-01', hasta: '2020-01-02' });
  assert.equal((await request('/auditoria')).status, 403);
});

test('pendientes de aulas están disponibles con permiso delegado', async t => {
  t.mock.method(prisma.solicitudAula, 'count', async () => 5);
  assert.equal((await solicitudesPendientes(subadmin(['solicitudes-aulas'])))['solicitudes-aulas'], 5);
  assert.equal((await solicitudesPendientes(subadmin([])))['solicitudes-aulas'], 0);
});
