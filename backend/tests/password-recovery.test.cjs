const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-access'; process.env.JWT_REFRESH_SECRET = 'test-refresh';
const prisma = { usuario: {}, passwordResetToken: {}, emailVerificationToken: {}, refreshToken: {}, bitacora: {}, $queryRaw: async () => [] };
require('../src/database/prisma').prisma = prisma;
const mail = require('../src/utils/mail');
const passwords = require('../src/utils/password');
const { PasswordRecoveryService } = require('../src/modules/auth/password-recovery.service');
const { UserService } = require('../src/modules/users/user.service');
const { AuthService } = require('../src/modules/auth/auth.service');
const { UserRepository } = require('../src/modules/users/user.repository');
const { requireAuth } = require('../src/middlewares/auth.middleware');
const { signAccessToken, credentialVersion } = require('../src/utils/jwt');
const recovery = new PasswordRecoveryService();
const admin = new UserService();
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const role = nombre => ({ estado: 'ACTIVO', rol: { nombre, estado: 'ACTIVO' } });
let users, tokens, sent, audit, refreshes, failAudit;
beforeEach(t => {
  users = [
    { idUsuario: 1n, correo: 'admin@example.test', roles: [role('ADMINISTRADOR')], estudiante: null },
    { idUsuario: 2n, correo: 'sub@example.test', roles: [role('SUBADMINISTRADOR')], estudiante: null },
    { idUsuario: 3n, correo: 'estudiante@example.test', roles: [role('CONSULTA_INTERNA')], estudiante: { ci: '7654321' } },
  ].map(u => ({ ...u, nombreCompleto: 'Persona de prueba', estado: 'ACTIVO', correoVerificado: true, debeCambiarPassword: false, contrasenaHash: hash('Anterior1!') }));
  tokens = []; sent = []; audit = []; refreshes = users.map(u => ({ idUsuario: u.idUsuario, revocado: false })); failAudit = false;
  prisma.usuario.findUnique = async ({ where }) => users.find(u => where.correo ? u.correo === where.correo : u.idUsuario === BigInt(where.idUsuario)) ?? null;
  prisma.usuario.update = async ({ where, data }) => Object.assign(users.find(u => u.idUsuario === BigInt(where.idUsuario)), data);
  prisma.usuario.updateMany = async ({ where, data }) => { const u = users.find(u => u.idUsuario === BigInt(where.idUsuario) && u.contrasenaHash === where.contrasenaHash && u.estado === where.estado); if (!u) return { count: 0 }; Object.assign(u, data); return { count: 1 }; };
  const matches = (row, where) => Object.entries(where).every(([key, value]) => key === 'expiraEn' ? row.expiraEn > value.gt : row[key] === value);
  prisma.passwordResetToken.findFirst = async ({ where }) => [...tokens].reverse().find(row => matches(row, where)) ?? null;
  prisma.passwordResetToken.create = async ({ data }) => { const row = { ...data, idToken: tokens.length + 1, usado: false, creadoEn: new Date() }; tokens.push(row); return row; };
  prisma.passwordResetToken.updateMany = async ({ where, data }) => { const rows = tokens.filter(row => matches(row, where)); rows.forEach(row => Object.assign(row, data)); return { count: rows.length }; };
  prisma.passwordResetToken.update = async ({ where, data }) => Object.assign(tokens.find(row => row.idToken === where.idToken), data);
  prisma.emailVerificationToken.updateMany = async () => ({ count: 0 });
  prisma.refreshToken.updateMany = async ({ where, data }) => { refreshes.filter(row => matches(row, where)).forEach(row => Object.assign(row, data)); return { count: 1 }; };
  prisma.bitacora.create = async ({ data }) => { if (failAudit) throw Error('audit unavailable'); audit.push(data); return data; };
  let queue = Promise.resolve();
  prisma.$transaction = fn => { const run = queue.then(async () => {
    const previous = structuredClone({ users, tokens, audit, refreshes });
    try { return await fn(prisma); } catch (e) { ({ users, tokens, audit, refreshes } = previous); throw e; }
  }); queue = run.catch(() => {}); return run; };
  t.mock.method(mail, 'sendMail', async message => sent.push(message));
  t.mock.method(passwords, 'hashPassword', async value => hash(value));
  t.mock.method(passwords, 'comparePassword', async (value, digest) => hash(value) === digest);
});
const code = () => sent.at(-1).text.match(/\b\d{6}\b/)[0];
const input = () => ({ correo: users[2].correo, codigo: code(), nuevaContrasena: 'NuevaClave1!' });
const token = user => signAccessToken({ idUsuario: String(user.idUsuario), correo: user.correo, roles: [], debeCambiarPassword: user.debeCambiarPassword, credentialVersion: credentialVersion(user.contrasenaHash) });
async function authorize(value, path = '/api/auth/me') {
  let error; await requireAuth({ headers: { authorization: `Bearer ${value}` }, method: 'GET', baseUrl: path, path: '/' }, {}, e => { error = e; }); return error;
}

test('solo estudiantes reciben códigos; ni subadmins, administradores, roles mixtos o cuentas inactivas', async () => {
  const generic = await recovery.solicitar('inexistente@example.test');
  for (const u of users.slice(0, 2)) assert.deepEqual(await recovery.solicitar(u.correo), generic);
  users[1].estudiante = { ci: '123' }; // Un perfil estudiantil no debe permitir eludir su rol administrativo.
  await recovery.solicitar(users[1].correo);
  users[1].roles[0].estado = 'INACTIVO';
  await recovery.solicitar(users[1].correo);
  users[2].estado = 'INACTIVO'; await recovery.solicitar(users[2].correo);
  assert.equal(sent.length, 0); assert.equal(tokens.length, 0);
});

test('recuperación envía HTML, guarda código cifrado y cambia la contraseña una sola vez', async () => {
  const old = token(users[2]); users[2].correoVerificado = false;
  await recovery.solicitar(users[2].correo);
  assert.equal(tokens[0].codigo, hash(code())); assert.notEqual(tokens[0].codigo, code());
  assert.match(sent[0].html, /TU CÓDIGO DE VERIFICACIÓN/);
  const request = input(); await recovery.restablecer(request);
  assert.equal(users[2].contrasenaHash, hash(request.nuevaContrasena));
  assert.equal(users[2].correoVerificado, true); assert.equal(users[2].debeCambiarPassword, false);
  assert.equal(refreshes[2].revocado, true); assert.equal(refreshes[0].revocado, false);
  assert.equal((await authorize(old)).statusCode, 401);
  await assert.rejects(recovery.restablecer(request), { statusCode: 400 });
});

test('códigos incorrectos y vencidos no cambian contraseña', async () => {
  await recovery.solicitar(users[2].correo);
  await assert.rejects(recovery.restablecer({ ...input(), codigo: 'abcdef' }), { statusCode: 400 });
  tokens[0].expiraEn = new Date(0);
  await assert.rejects(recovery.restablecer(input()), { statusCode: 400 });
  assert.equal(users[2].contrasenaHash, hash('Anterior1!'));
});

test('espera 60 segundos, reemplaza código anterior y evita envíos simultáneos duplicados', async () => {
  await Promise.all([recovery.solicitar(users[2].correo), recovery.solicitar(users[2].correo)]);
  assert.equal(sent.length, 1); const previous = input();
  tokens[0].creadoEn = new Date(Date.now() - 61_000);
  await recovery.solicitar(users[2].correo);
  assert.equal(sent.length, 2); assert.equal(tokens[0].usado, true);
  if (previous.codigo !== code()) await assert.rejects(recovery.restablecer(previous), { statusCode: 400 });
});

test('fallo de envío permite reintentar sin esperar y no deja código usable', async t => {
  t.mock.method(mail, 'sendMail', async () => { throw Error('SMTP unavailable'); });
  await assert.rejects(recovery.solicitar(users[2].correo)); assert.equal(tokens[0].usado, true);
  t.mock.method(mail, 'sendMail', async message => sent.push(message));
  await recovery.solicitar(users[2].correo); assert.equal(sent.length, 1);
});

test('dos confirmaciones concurrentes consumen el código exactamente una vez', async () => {
  await recovery.solicitar(users[2].correo); const request = input();
  const results = await Promise.allSettled([recovery.restablecer(request), recovery.restablecer(request)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
});

test('un código obtenido antes de convertirse en subadmin ya no recupera su contraseña', async () => {
  await recovery.solicitar(users[2].correo); users[2].roles.push(role('SUBADMINISTRADOR'));
  await assert.rejects(recovery.restablecer(input()), { statusCode: 400 });
});

test('admin restablece subadmin al CI, revoca sesiones y obliga el cambio antes de acceder', async () => {
  const old = token(users[1]);
  await admin.resetearPassword(2n, '1234567', 1n);
  assert.equal(users[1].contrasenaHash, hash('1234567')); assert.equal(users[1].debeCambiarPassword, true);
  assert.equal(refreshes[1].revocado, true); assert.equal((await authorize(old)).statusCode, 401);
  const temporary = token(users[1]); assert.equal(await authorize(temporary), undefined);
  assert.equal((await authorize(temporary, '/api/users')).statusCode, 403);
  await new AuthService().cambiarPassword(2n, { contrasenaActual: '1234567', nuevaContrasena: 'NuevaClave1!', confirmarContrasena: 'NuevaClave1!' });
  assert.equal(users[1].debeCambiarPassword, false);
  assert.equal((await authorize(old)).statusCode, 401); assert.equal((await authorize(temporary)).statusCode, 401);
  assert.equal(await authorize(token(users[1])), undefined);
  assert.ok(audit.some(a => a.accion === 'ADMIN_RESET_PASSWORD' && a.idUsuario === 1n));
  assert.ok(!JSON.stringify(audit, (_, value) => typeof value === 'bigint' ? String(value) : value).includes('1234567'));
});

test('estudiante usa el CI registrado y se invalidan códigos anteriores al reinicio', async () => {
  await recovery.solicitar(users[2].correo); const previous = input();
  await admin.resetearPassword(3n, 'CI_NO_AUTORIZADO', 1n);
  assert.equal(users[2].contrasenaHash, hash('7654321')); assert.equal(users[2].debeCambiarPassword, true);
  await assert.rejects(recovery.restablecer(previous), { statusCode: 400 });
});

test('protege administradores, cuenta propia y requiere CI para subadmin', async () => {
  await assert.rejects(admin.resetearPassword(1n, '123', 1n), { statusCode: 403 });
  await assert.rejects(admin.resetearPassword(1n, '123', 9n), { statusCode: 403 });
  await assert.rejects(admin.resetearPassword(2n, undefined, 1n), { statusCode: 400 });
  await assert.rejects(admin.resetearPassword(99n, '123', 1n), { statusCode: 404 });
});

test('fallo de transacción revierte contraseña y consumo del código', async () => {
  await recovery.solicitar(users[2].correo); failAudit = true;
  await assert.rejects(recovery.restablecer(input()));
  assert.equal(users[2].contrasenaHash, hash('Anterior1!')); assert.equal(tokens[0].usado, false); assert.equal(refreshes[2].revocado, false);
});

test('cambio con contraseña anterior no sobrescribe un reinicio posterior', async () => {
  const old = users[1].contrasenaHash; await admin.resetearPassword(2n, '1234567', 1n);
  await assert.rejects(new UserRepository().actualizarContrasena(2n, hash('NuevaClave1!'), old), { statusCode: 409 });
  assert.equal(users[1].contrasenaHash, hash('1234567'));
});

test('HTTP: solo admin restablece; recuperación rechaza subadmins y limita códigos incorrectos', async () => {
  const express = require('express'); const app = express(); app.use(express.json());
  app.use('/api/users', require('../src/modules/users/user.routes').default);
  app.use('/api/auth', require('../src/modules/auth/auth.routes').default);
  app.use(require('../src/middlewares/error.middleware').errorMiddleware);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const post = (route, body, user) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${token(user)}` } : {}) }, body: JSON.stringify(body) });
  try {
    assert.equal((await post('/users/2/reset-password', { ci: '1234567' })).status, 401);
    assert.equal((await post('/users/3/reset-password', {}, users[1])).status, 403);
    assert.equal((await post('/users/2/reset-password', { ci: '1234567' }, users[2])).status, 403);
    assert.equal((await post('/users/2/reset-password', { ci: '1234567' }, users[0])).status, 200);
    assert.equal((await post('/auth/forgot-password', { correo: users[1].correo })).status, 200);
    assert.equal(sent.length, 0);
    for (let i = 0; i < 5; i++) assert.equal((await post('/auth/reset-password', { correo: users[2].correo, codigo: '999999', nuevaContrasena: 'NuevaClave1!' })).status, 400);
    assert.equal((await post('/auth/reset-password', { correo: users[2].correo, codigo: '999999', nuevaContrasena: 'NuevaClave1!' })).status, 429);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
