const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-access';
process.env.JWT_REFRESH_SECRET = 'test-refresh';
const prisma = { usuario: {}, rol: {}, usuarioRol: {}, permisoUsuario: {}, $queryRaw: async () => [], refreshToken: {}, passwordResetToken: {}, bitacora: {}, $transaction() {} };
require('../src/database/prisma').prisma = prisma;
const security = require('../src/modules/auth/login-security');
const { UserService } = require('../src/modules/users/user.service');
const { AuthService } = require('../src/modules/auth/auth.service');
const { RoleRepository, rolesActivos } = require('../src/modules/roles/role.repository');
const { crearSubadminSchema, asignarPermisosSchema, idSchema } = require('../src/modules/users/user.validation');
const { changePasswordSchema } = require('../src/modules/auth/auth.validation');
const { requireAuth, requireAdmin, requirePermission, optionalAuth } = require('../src/middlewares/auth.middleware');
const { credentialVersion, signAccessToken, verifyAccessToken } = require('../src/utils/jwt');
const { comparePassword } = require('../src/utils/password');
let users, roles, audit, sessions;
const service = new UserService();
const auth = new AuthService();
const input = () => crearSubadminSchema.parse({ nombreCompleto: 'Ana Pérez', correo: 'ANA@example.test', ci: '1234567', permisos: [{ modulo: 'aulas', desde: null, hasta: null }] });
const relation = rol => ({ estado: 'ACTIVO', rol });
beforeEach(t => {
  roles = [
    { idRol: 1n, nombre: 'ADMINISTRADOR', estado: 'ACTIVO' },
    { idRol: 2n, nombre: 'SUBADMINISTRADOR', estado: 'ACTIVO' },
    { idRol: 3n, nombre: 'SUBADMINISTRADOR_ATENCION', estado: 'ACTIVO' },
    { idRol: 4n, nombre: 'CONSULTA_INTERNA', estado: 'ACTIVO' },
  ];
  users = [{ idUsuario: 1n, nombreCompleto: 'Admin', correo: 'admin@example.test', estado: 'ACTIVO', correoVerificado: true, debeCambiarPassword: false, roles: [relation(roles[0])] }];
  audit = []; sessions = [];
  prisma.usuario.findUnique = async ({ where }) => users.find(u => where.idUsuario !== undefined ? u.idUsuario === BigInt(where.idUsuario) : u.correo === where.correo) ?? null;
  prisma.usuario.findMany = async () => users;
  prisma.usuario.create = async ({ data }) => {
    const user = { ...data, idUsuario: 2n, fechaCreacion: new Date(), twoFactorEnabled: false, permisos: data.permisos.create, roles: [relation(roles.find(r => r.idRol === data.roles.create.idRol))] };
    users.push(user); return user;
  };
  prisma.passwordResetToken.updateMany = async () => ({ count: 0 });
  prisma.usuario.updateMany = async ({ where, data }) => { const u = users.find(u => u.idUsuario === BigInt(where.idUsuario) && u.contrasenaHash === where.contrasenaHash); if (!u) return { count: 0 }; Object.assign(u, data); return { count: 1 }; };
  prisma.usuario.update = async ({ where, data }) => Object.assign(users.find(u => u.idUsuario === BigInt(where.idUsuario)), data);
  prisma.rol.findUnique = async ({ where }) => roles.find(r => where.nombre ? r.nombre === where.nombre : r.idRol === BigInt(where.idRol));
  prisma.rol.findMany = async ({ where }) => {
    assert.deepEqual(where, { estado: { equals: 'ACTIVO', mode: 'insensitive' }, nombre: { in: ['ADMINISTRADOR', 'SUBADMINISTRADOR'] } }); return roles.filter(r => where.nombre.in.includes(r.nombre));
  };
  prisma.permisoUsuario.deleteMany = async ({ where }) => { users.find(u => u.idUsuario === BigInt(where.idUsuario)).permisos = []; };
  prisma.permisoUsuario.createMany = async ({ data }) => { for (const p of data) users.find(u => u.idUsuario === BigInt(p.idUsuario)).permisos.push(p); };
  prisma.usuarioRol.deleteMany = async ({ where }) => { users.find(u => u.idUsuario === BigInt(where.idUsuario)).roles = []; };
  prisma.usuarioRol.create = async ({ data }) => { users.find(u => u.idUsuario === BigInt(data.idUsuario)).roles.push(relation(roles.find(r => r.idRol === BigInt(data.idRol)))); };
  prisma.refreshToken.create = async ({ data }) => { sessions.push({ ...data, revocado: false }); };
  prisma.refreshToken.updateMany = async ({ where }) => { sessions.filter(s => where.idUsuario ? s.idUsuario === where.idUsuario : s.tokenHash === where.tokenHash).forEach(s => s.revocado = true); };
  prisma.refreshToken.findUnique = async ({ where }) => sessions.find(s => s.tokenHash === where.tokenHash);
  prisma.bitacora.create = async ({ data }) => { audit.push(data); return data; };
  prisma.$transaction = async fn => fn(prisma);
  t.mock.method(security, 'verifyCaptcha', () => {});
});
async function authorize(token, route = '/api/aulas', role = 'aulas', method = 'GET') {
  const req = { headers: { authorization: `Bearer ${token}` }, baseUrl: route, path: '/', method };
  let error;
  await requireAuth(req, {}, e => { error = e; });
  if (!error && role) (role === 'ADMINISTRADOR' ? requireAdmin(role) : requirePermission(role))(req, {}, e => { error = e; });
  return { req, error };
}
const login = password => auth.loginAdmin({ correo: 'ana@example.test', contrasena: password, captchaId: '', captchaCode: '' }, {});

test('crea subadmin activo con CI cifrado, rol y cambio obligatorio, sin exponer secretos', async () => {
  const result = await service.crearSubadmin(input(), 1n);
  assert.equal(result.correo, 'ana@example.test');
  assert.deepEqual(result.roles, ['SUBADMINISTRADOR']);
  assert.equal(result.debeCambiarPassword, true);
  assert.equal(users[1].estado, 'ACTIVO');
  assert.equal(await comparePassword('1234567', users[1].contrasenaHash), true);
  assert.equal('contrasenaHash' in result, false);
  assert.equal('ci' in result, false);
  assert.equal(audit[0].idUsuario, 1n);
  assert.equal(JSON.stringify(audit, (_, v) => typeof v === 'bigint' ? String(v) : v).includes('1234567'), false);
});

test('rechaza correo duplicado, roles inactivos y crear administradores', async () => {
  await service.crearSubadmin(input(), 1n);
  await assert.rejects(service.crearSubadmin(input(), 1n), { statusCode: 409 });
  assert.equal(crearSubadminSchema.safeParse({ ...input(), idRol: '1' }).success, false);
  roles[1].estado = 'INACTIVO';
  await assert.rejects(service.crearSubadmin(input(), 1n), { statusCode: 400 });
});

test('flujo completo: CI, bloqueo de módulos, cambio de contraseña y nuevo ingreso', async () => {
  await service.crearSubadmin(input(), 1n);
  users[1].correoVerificado = true;
  const initial = await login('1234567');
  assert.equal(verifyAccessToken(initial.tokens.accessToken).debeCambiarPassword, true);
  assert.equal((await authorize(initial.tokens.accessToken)).error.statusCode, 403);
  for (const [path, method] of [['me', 'GET'], ['logout', 'POST'], ['change-password', 'POST']]) {
    assert.equal((await authorize(initial.tokens.accessToken, `/api/auth/${path}`, null, method)).error, undefined);
  }
  const refresh = await auth.refrescarSesion(initial.tokens.refreshToken);
  assert.equal((await authorize(refresh.accessToken)).error.statusCode, 403);
  await assert.rejects(auth.cambiarPassword(2n, { contrasenaActual: 'incorrecta', nuevaContrasena: 'NuevaClave123!', confirmarContrasena: 'NuevaClave123!' }), { statusCode: 401 });
  await assert.rejects(auth.cambiarPassword(2n, { contrasenaActual: '1234567', nuevaContrasena: '1234567', confirmarContrasena: '1234567' }), { statusCode: 400 });
  await auth.cambiarPassword(2n, changePasswordSchema.parse({ contrasenaActual: '1234567', nuevaContrasena: 'NuevaClave123!', confirmarContrasena: 'NuevaClave123!' }));
  assert.equal(users[1].debeCambiarPassword, false);
  assert.ok(sessions.every(s => s.revocado));
  assert.equal((await authorize(initial.tokens.accessToken)).error.statusCode, 401);
  await assert.rejects(login('1234567'), { statusCode: 401 });
  const final = await login('NuevaClave123!');
  assert.equal((await authorize(final.tokens.accessToken)).error, undefined);
  assert.equal((await authorize(final.tokens.accessToken, '/api/users', 'ADMINISTRADOR', 'POST')).error.statusCode, 403);
});

test('reemplaza y retira funciones incluso con un token anterior', async () => {
  await service.crearSubadmin(input(), 1n);
  users[1].correoVerificado = true;
  users[1].debeCambiarPassword = false;
  const session = await login('1234567');
  const result = await service.asignarPermisos(2n, [{ modulo: 'fichas', desde: null, hasta: null }], 1n);
  assert.deepEqual(result.roles, ['SUBADMINISTRADOR']);
  assert.equal((await authorize(session.tokens.accessToken)).error.statusCode, 403);
  assert.equal((await authorize(session.tokens.accessToken, '/api/fichas', 'fichas')).error, undefined);
  await service.asignarPermisos(2n, [], 1n);
  assert.equal((await authorize(session.tokens.accessToken, '/api/fichas', 'fichas')).error.statusCode, 403);
  assert.equal((await login('1234567')).usuario.roles[0], 'SUBADMINISTRADOR');
});

test('desactivar cuenta impide usar tokens existentes y devuelve perfil sin hash', async () => {
  await service.crearSubadmin(input(), 1n);
  users[1].correoVerificado = true;
  users[1].debeCambiarPassword = false;
  const session = await login('1234567');
  const result = await service.cambiarEstado(2n, 'inactivo', 1n);
  assert.equal(users[1].estado, 'INACTIVO');
  assert.equal('contrasenaHash' in result, false);
  assert.equal((await authorize(session.tokens.accessToken)).error.statusCode, 401);
  await assert.rejects(login('1234567'), { statusCode: 403 });
});

test('protege la cuenta administradora y rechaza escalamiento a administrador', async () => {
  await service.crearSubadmin(input(), 1n);
  await assert.rejects(service.asignarPermisos(1n, [], 1n), { statusCode: 403 });
  await assert.rejects(service.cambiarEstado(1n, 'inactivo', 5n), { statusCode: 403 });
  assert.equal(asignarPermisosSchema.safeParse({ permisos: [{ modulo: 'subadministradores' }] }).success, false);
  users[1].roles = [relation(roles[3])];
  await assert.rejects(service.asignarPermisos(2n, [], 1n), { statusCode: 403 });
});

test('ignora permisos de JWT y relaciones o roles inactivos', async () => {
  await service.crearSubadmin(input(), 1n);
  users[1].correoVerificado = true;
  users[1].debeCambiarPassword = false;
  const token = signAccessToken({ credentialVersion: credentialVersion(users[1].contrasenaHash), idUsuario: '2', correo: 'ana@example.test', roles: ['ADMINISTRADOR'] });
  assert.equal((await authorize(token, '/api/users', 'ADMINISTRADOR')).error.statusCode, 403);
  users[1].roles[0].estado = 'INACTIVO';
  assert.deepEqual(rolesActivos(users[1].roles), []);
  assert.equal((await authorize(token)).error.statusCode, 403);
  users[1].roles[0].estado = 'ACTIVO'; roles[1].estado = 'INACTIVO';
  assert.deepEqual(rolesActivos(users[1].roles), []);
});

test('auth opcional no entrega privilegios con contraseña temporal ni cuenta inactiva', async () => {
  await service.crearSubadmin(input(), 1n);
  const token = (await login('1234567')).tokens.accessToken;
  const req = { headers: { authorization: `Bearer ${token}` } };
  await optionalAuth(req, {}, e => assert.equal(e, undefined));
  assert.equal(req.user, undefined);
  users[1].estado = 'INACTIVO';
  await optionalAuth(req, {}, e => assert.equal(e, undefined));
  assert.equal(req.user, undefined);
});

test('roles activos e IDs bigint se manejan sin perder precisión', async () => {
  assert.equal((await new RoleRepository().findAll()).length, 2);
  assert.equal(idSchema.parse('9007199254740993'), 9007199254740993n);
  assert.equal(idSchema.safeParse(9007199254740993).success, false);
  assert.equal(idSchema.safeParse('9223372036854775808').success, false);
  assert.equal(crearSubadminSchema.safeParse({ ...input(), ci: '   ' }).success, false);
});

test('rutas HTTP: solo el administrador crea y cambia roles; el primer ingreso bloquea módulos', async () => {
  const express = require('express');
  const { errorMiddleware } = require('../src/middlewares/error.middleware');
  const app = express();
  app.use(express.json());
  app.use('/api', require('../src/routes').default);
  app.use(errorMiddleware);
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const adminToken = signAccessToken({ credentialVersion: credentialVersion(users[0].contrasenaHash), idUsuario: '1', correo: users[0].correo, roles: ['ADMINISTRADOR'] });
  const request = (path, token, method = 'GET', body) => fetch(base + path, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  try {
    const created = await request('/users', adminToken, 'POST', input());
    assert.equal(created.status, 201);
    const result = (await created.json()).data;
    assert.equal(result.idUsuario, '2');
    assert.equal(result.debeCambiarPassword, true);
    const temporary = (await login('1234567')).tokens.accessToken;
    assert.equal((await request('/auth/me', temporary)).status, 200);
    assert.equal((await request('/aulas', temporary)).status, 403);
    assert.equal((await request('/users', temporary, 'POST', {})).status, 403);
    assert.equal((await request('/auth/change-password', temporary, 'POST', { contrasenaActual: '1234567', nuevaContrasena: 'NuevaClave123!', confirmarContrasena: 'NuevaClave123!' })).status, 403);
    users[1].correoVerificado = true;
    const changed = await request('/auth/change-password', temporary, 'POST', {
      contrasenaActual: '1234567', nuevaContrasena: 'NuevaClave123!', confirmarContrasena: 'NuevaClave123!',
    });
    assert.equal(changed.status, 200);
    assert.ok(changed.headers.get('set-cookie').includes('accessToken=;'));
    const token = (await login('NuevaClave123!')).tokens.accessToken;
    for (const [path, method, body] of [
      ['/users', 'GET'], ['/users', 'POST', {}], ['/users/2/permisos', 'PATCH', { idRol: '1' }],
      ['/users/2/estado', 'PATCH', { estado: 'inactivo' }], ['/roles', 'GET'], ['/reportes/dashboard', 'GET'],
    ]) assert.equal((await request(path, token, method, body)).status, 403, `${method} ${path}`);
    assert.equal((await request('/aulas', token)).status, 200);
    assert.equal((await request('/fichas', token)).status, 403);
    assert.equal((await request('/users/2/permisos', adminToken, 'PATCH', { permisos: [{ modulo: 'fichas', desde: null, hasta: null }] })).status, 200);
    assert.equal((await request('/aulas', token)).status, 403);
    assert.equal((await request('/fichas', token)).status, 200);
    const now = Date.now();
    for (const permiso of [
      { modulo: 'fichas', desde: new Date(now - 10000).toISOString(), hasta: new Date(now - 1000).toISOString() },
      { modulo: 'fichas', desde: new Date(now + 60000).toISOString(), hasta: new Date(now + 120000).toISOString() },
    ]) {
      assert.equal((await request('/users/2/permisos', adminToken, 'PATCH', { permisos: [permiso] })).status, 200);
      assert.equal((await request('/fichas', token)).status, 403);
    }
    assert.equal((await request('/users/2/permisos', adminToken, 'PATCH', { permisos: [] })).status, 200);
    assert.equal((await request('/fichas', token)).status, 403);
    assert.equal((await request('/users/2/permisos', adminToken, 'PATCH', { permisos: [{ modulo: 'roles' }] })).status, 400);
    assert.equal((await request('/users/2/rol', adminToken, 'PATCH', { idRol: '4' })).status, 404);
    assert.equal((await request('/users/2/estado', adminToken, 'PATCH', { estado: 'inactivo' })).status, 200);
    assert.equal((await request('/fichas', token)).status, 401);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
