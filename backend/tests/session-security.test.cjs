// Sin conexiones a la BD: HTTP real y persistencia simulada para probar los límites de seguridad.
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-session-access';
process.env.JWT_REFRESH_SECRET = 'test-session-refresh';
process.env.FRONTEND_URL = 'http://localhost:5173';
const prisma = { usuario: {}, refreshToken: {}, bitacora: {} };
require('../src/database/prisma').prisma = prisma;
const { AuthService } = require('../src/modules/auth/auth.service');
const { requireAuth, requireAdmin, requirePermission } = require('../src/middlewares/auth.middleware');
const { SESSION_IDLE_MS, SESSION_MAX_MS, recordActivity } = require('../src/modules/auth/session-policy');
const { signAccessToken, signRefreshToken, verifyAccessToken, credentialVersion } = require('../src/utils/jwt');
const security = require('../src/modules/auth/login-security');
const password = require('../src/utils/password');
const auth = new AuthService();
let users, sessions, now, server, base;
const role = nombre => ({ estado: 'ACTIVO', rol: { nombre, estado: 'ACTIVO' } });
const hash = token => crypto.createHash('sha256').update(token).digest('hex');
const clone = value => value ? structuredClone(value) : null;
beforeEach(async t => {
  now = Date.now();
  t.mock.method(Date, 'now', () => now);
  users = ['ADMINISTRADOR', 'SUBADMINISTRADOR', 'CONSULTA_INTERNA'].map((r, i) => ({
    idUsuario: BigInt(i + 1), correo: `user${i + 1}@example.test`, nombreCompleto: 'Prueba',
    contrasenaHash: 'hash', estado: 'ACTIVO', correoVerificado: true, debeCambiarPassword: false,
    twoFactorEnabled: false, roles: [role(r)], permisos: r === 'SUBADMINISTRADOR' ? [{ modulo: 'aulas', desde: null, hasta: null }] : [],
  }));
  sessions = [];
  prisma.usuario.findUnique = async ({ where }) => clone(users.find(u => where.correo ? u.correo === where.correo : u.idUsuario === BigInt(where.idUsuario)));
  prisma.refreshToken.create = async ({ data }) => {
    const row = { ...data, idRefreshToken: sessions.length + 1, creadoEn: new Date(now), revocado: false };
    sessions.push(row); return clone(row);
  };
  prisma.refreshToken.findUnique = async ({ where }) => clone(sessions.find(s => where.tokenHash ? s.tokenHash === where.tokenHash : s.idRefreshToken === where.idRefreshToken));
  prisma.refreshToken.updateMany = async ({ where, data }) => {
    const rows = sessions.filter(s => Object.entries(where).every(([k, v]) => k === 'expiraEn' ? s.expiraEn > v.gt : s[k] === v));
    rows.forEach(s => Object.assign(s, data)); return { count: rows.length };
  };
  prisma.bitacora.create = async () => ({});
  t.mock.method(security, 'verifyCaptcha', () => {});
  t.mock.method(password, 'comparePassword', async p => p === 'correct');
  t.mock.method(require('../src/modules/horarios/horario.service').HorarioService.prototype, 'listar', async () => [{ materia: 'Privada' }]);
  t.mock.method(require('../src/modules/horarios/horario.service').HorarioService.prototype, 'obtener', async () => ({ materia: 'Privada' }));
  const express = require('express');
  const app = express();
  app.use(express.json(), require('cookie-parser')());
  app.use('/api/auth', require('../src/modules/auth/auth.routes').default);
  app.use('/api/horarios', require('../src/modules/horarios/horario.routes').default);
  app.get('/api/admin', requireAuth, requireAdmin('ADMINISTRADOR'), (_req, res) => res.json({ ok: true }));
  app.get('/api/aulas', requireAuth, requirePermission('aulas'), (_req, res) => res.json({ ok: true }));
  app.use(require('../src/middlewares/error.middleware').errorMiddleware);
  server = await new Promise(resolve => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
afterEach(async () => { await new Promise(resolve => server.close(resolve)); });
const login = (index = 2) => auth.login({ correo: users[index].correo, contrasena: 'correct', captchaId: '', captchaCode: '' }, {});
const request = (path, token, body, extra = {}) => fetch(base + path, {
  method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

test('un único login devuelve el rol real e ignora roles enviados por el cliente', async () => {
  for (const [i, user] of users.entries()) {
    const response = await request('/auth/login', null, { correo: user.correo, contrasena: 'correct', captchaId: 'a'.repeat(64), captchaCode: 'ABC234', roles: ['ADMINISTRADOR'] });
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.deepEqual(data.usuario.roles, [user.roles[0].rol.nombre]);
    assert.equal(data.refreshToken, undefined);
    assert.equal(data.session.expiresAt, now + SESSION_IDLE_MS);
    const cookies = response.headers.getSetCookie();
    assert.equal(cookies.length, 2);
    assert.ok(cookies.every(c => /HttpOnly/.test(c) && /SameSite=Lax/.test(c) && !/Max-Age|Expires=/.test(c)));
    assert.equal((await request('/admin', data.accessToken)).status, i === 0 ? 200 : 403);
    assert.equal((await request('/aulas', data.accessToken)).status, i === 2 ? 403 : 200);
  }
});

test('horarios: anónimo bloqueado en listado y detalle; estudiante verificado puede leer pero no escribir', async () => {
  for (const path of ['/horarios', '/horarios/1']) assert.equal((await request(path)).status, 401);
  const { tokens } = await login();
  for (const path of ['/horarios', '/horarios/1']) {
    const response = await request(path, tokens.accessToken);
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal((await request('/horarios', tokens.accessToken, {})).status, 403);
  users[2].correoVerificado = false;
  assert.equal((await request('/horarios', tokens.accessToken)).status, 403);
  assert.equal((await request('/auth/activity', tokens.accessToken, {})).status, 200);
  users[2].correoVerificado = true; users[2].debeCambiarPassword = true;
  assert.equal((await request('/horarios', tokens.accessToken)).status, 403);
});

test('lecturas y refresh automáticos no aplazan el cierre; al vencer se rechazan ambos tokens', async () => {
  const { tokens } = await login();
  now += SESSION_IDLE_MS - 1;
  assert.equal((await request('/horarios', tokens.accessToken)).status, 200);
  const rotated = await auth.refrescarSesion(tokens.refreshToken);
  assert.equal(rotated.session.expiresAt, tokens.session.expiresAt);
  now++;
  assert.equal((await request('/horarios', rotated.accessToken)).status, 401);
  await assert.rejects(auth.refrescarSesion(rotated.refreshToken), { statusCode: 401 });
  await assert.rejects(recordActivity('3', tokens.session.id), { statusCode: 401 });
  now += 24 * 60 * 60 * 1000;
  await assert.rejects(auth.refrescarSesion(rotated.refreshToken), { statusCode: 401 });
});

test('actividad renueva una sesión vigente y respeta el máximo absoluto de ocho horas', async () => {
  const { tokens } = await login();
  now += 150000;
  const renewed = await recordActivity('3', tokens.session.id);
  assert.equal(renewed.expiresAt, now + SESSION_IDLE_MS);
  now += 31000;
  assert.equal((await request('/horarios', tokens.accessToken)).status, 200);
  sessions[0].creadoEn = new Date(now - SESSION_MAX_MS + 1000);
  const last = await recordActivity('3', tokens.session.id);
  assert.equal(last.expiresAt, now + 1000);
  now += 1000;
  await assert.rejects(recordActivity('3', tokens.session.id), { statusCode: 401 });
});

test('logout revoca access y refresh, incluso si el access ya venció o hubo rotación', async () => {
  const { tokens } = await login();
  const rotated = await auth.refrescarSesion(tokens.refreshToken);
  const response = await request('/auth/logout', tokens.accessToken, {}, { Cookie: `refreshToken=${tokens.refreshToken}` });
  assert.equal(response.status, 200);
  assert.ok(response.headers.get('set-cookie').includes('Max-Age=0') || response.headers.get('set-cookie').includes('Expires=Thu, 01 Jan 1970'));
  assert.equal((await request('/horarios', rotated.accessToken)).status, 401);
  await assert.rejects(auth.refrescarSesion(rotated.refreshToken), { statusCode: 401 });
  assert.equal((await request('/auth/logout', 'expired-or-invalid', {})).status, 200);
});

test('roles alterados, cuenta desactivada, permiso retirado y sesión ajena no otorgan privilegios', async () => {
  const { tokens } = await login(1);
  const { iat, exp, ...claims } = verifyAccessToken(tokens.accessToken);
  const forgedRole = signAccessToken({ ...claims, roles: ['ADMINISTRADOR'] });
  assert.equal((await request('/admin', forgedRole)).status, 403);
  users[1].permisos = [];
  assert.equal((await request('/aulas', tokens.accessToken)).status, 403);
  const otherUser = signAccessToken({ ...claims, idUsuario: '1' });
  assert.equal((await request('/admin', otherUser)).status, 401);
  const parts = tokens.accessToken.split('.');
  parts[1] = Buffer.from(JSON.stringify({ ...claims, roles: ['ADMINISTRADOR'] })).toString('base64url');
  assert.equal((await request('/admin', parts.join('.'))).status, 401);
  users[1].estado = 'INACTIVO';
  assert.equal((await request('/aulas', tokens.accessToken)).status, 401);
});

test('tokens antiguos sin sesión y refresh anteriores al control de inactividad no se restauran', async () => {
  const legacyAccess = signAccessToken({ idUsuario: '1', correo: users[0].correo, roles: ['ADMINISTRADOR'], credentialVersion: credentialVersion('hash') });
  assert.equal((await request('/admin', legacyAccess)).status, 401);
  const legacyRefresh = signRefreshToken({ idUsuario: '1', tokenId: 'old', credentialVersion: credentialVersion('hash') });
  await prisma.refreshToken.create({ data: { idUsuario: 1n, tokenHash: hash(legacyRefresh), expiraEn: new Date(now + 7 * 86400000) } });
  await assert.rejects(auth.refrescarSesion(legacyRefresh), { statusCode: 401 });
});

test('rotación concurrente solo consume el refresh una vez y no invalida access de otras pestañas', async () => {
  const { tokens } = await login();
  const results = await Promise.allSettled([auth.refrescarSesion(tokens.refreshToken), auth.refrescarSesion(tokens.refreshToken)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await request('/horarios', tokens.accessToken)).status, 200);
});

test('peticiones de otro origen no renuevan ni cierran sesiones', async () => {
  const { tokens } = await login();
  for (const path of ['/auth/activity', '/auth/refresh', '/auth/logout']) {
    assert.equal((await request(path, tokens.accessToken, {}, { Origin: 'https://otro.example' })).status, 403);
  }
  assert.equal(sessions[0].revocado, false);
});
