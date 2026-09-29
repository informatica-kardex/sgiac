const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-access';
process.env.JWT_REFRESH_SECRET = 'test-refresh';
const prisma = { usuario: {}, emailVerificationToken: {}, passwordResetToken: {}, refreshToken: {}, bitacora: {}, $transaction() {}, $queryRaw: async () => [] };
require('../src/database/prisma').prisma = prisma;
const mail = require('../src/utils/mail');
const passwords = require('../src/utils/password');
const security = require('../src/modules/auth/login-security');
const { EmailVerificationService, hashEmailCode } = require('../src/modules/auth/email-verification.service');
const { AuthService } = require('../src/modules/auth/auth.service');
const { AuthRepository } = require('../src/modules/auth/auth.repository');
const { requireAuth, optionalAuth } = require('../src/middlewares/auth.middleware');
const { credentialVersion, signAccessToken } = require('../src/utils/jwt');
const schemas = require('../src/modules/auth/auth.validation');
const { passwordSchema } = require('../src/modules/auth/password-policy');
const frontPath = path.resolve('../frontend/src/utils/password-policy.ts');
const frontModule = new Module(frontPath, module);
frontModule.filename = frontPath;
frontModule.paths = Module._nodeModulePaths(path.dirname(frontPath));
frontModule._compile(ts.transpileModule(fs.readFileSync(frontPath, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, frontPath);
const frontPolicy = frontModule.exports;
const service = new EmailVerificationService();
const auth = new AuthService();
let user, tokens, sent, audit, exists, refreshes;
beforeEach(t => {
  exists = true; tokens = []; sent = []; audit = []; refreshes = [];
  user = { idUsuario: 2n, correo: 'ana@example.test', nombreCompleto: 'Ana Perez', estado: 'ACTIVO', correoVerificado: false,
    debeCambiarPassword: true, twoFactorEnabled: false, contrasenaHash: 'hash', roles: [{ estado: 'ACTIVO', rol: { estado: 'ACTIVO', nombre: 'SUBADMINISTRADOR' } }] };
  prisma.usuario.findUnique = async ({ where }) => exists && (where.correo ? where.correo === user.correo : BigInt(where.idUsuario) === user.idUsuario) ? user : null;
  prisma.passwordResetToken.updateMany = async () => ({ count: 0 });
  prisma.usuario.updateMany = async ({ where, data }) => { if (user.contrasenaHash !== where.contrasenaHash) return { count: 0 }; Object.assign(user, data); return { count: 1 }; };
  prisma.usuario.update = async ({ data }) => Object.assign(user, data);
  prisma.emailVerificationToken.findFirst = async ({ where }) => [...tokens].reverse().find(token => token.idUsuario === where.idUsuario &&
    (where.codigo === undefined || token.codigo === where.codigo) && token.usado === where.usado &&
    (!where.expiraEn || token.expiraEn > where.expiraEn.gt)) ?? null;
  prisma.emailVerificationToken.create = async ({ data }) => {
    const token = { ...data, idToken: tokens.length + 1, usado: false, creadoEn: new Date(Date.now()) }; tokens.push(token); return token;
  };
  prisma.emailVerificationToken.updateMany = async ({ where, data }) => {
    const selected = tokens.filter(token => token.idUsuario === where.idUsuario && token.usado === where.usado);
    selected.forEach(token => Object.assign(token, data)); return { count: selected.length };
  };
  prisma.emailVerificationToken.update = async ({ where, data }) => Object.assign(tokens.find(token => token.idToken === where.idToken), data);
  prisma.bitacora.create = async ({ data }) => { audit.push(data); return data; };
  prisma.refreshToken.create = async ({ data }) => { refreshes.push(data); return data; };
  prisma.refreshToken.updateMany = async () => ({ count: refreshes.length });
  let queue = Promise.resolve();
  prisma.$transaction = fn => { const operation = queue.then(() => fn(prisma)); queue = operation.catch(() => {}); return operation; };
  t.mock.method(mail, 'sendMail', async message => { sent.push(message); });
  t.mock.method(passwords, 'comparePassword', async value => value === '1234567');
  t.mock.method(passwords, 'hashPassword', async () => 'new-hash');
  t.mock.method(security, 'verifyCaptcha', () => {});
  t.mock.method(AuthRepository.prototype, 'crearEstudiante', async input => { exists = true; user.correo = input.correo; user.debeCambiarPassword = false; return user; });
});
const code = () => sent.at(-1).text.match(/\b\d{6}\b/)[0];
const registerInput = { nombres: 'Ana', apellidos: 'Perez', ci: '123', ru: '456', mencion: 'Sistemas', correo: 'ana@example.test', contrasena: 'Abcdef1!', confirmarContrasena: 'Abcdef1!' };
async function authorize(route, method = 'GET') {
  const token = signAccessToken({ credentialVersion: credentialVersion(user.contrasenaHash), idUsuario: '2', correo: user.correo, roles: ['SUBADMINISTRADOR'], debeCambiarPassword: user.debeCambiarPassword });
  const req = { headers: { authorization: `Bearer ${token}` }, baseUrl: route, path: '/', method };
  let error;
  await requireAuth(req, {}, e => { error = e; });
  return { req, error };
}

test('politica y medidor aceptan 8 caracteres completos y rechazan cualquier requisito ausente', () => {
  for (const value of ['Abcdef1!', 'UnaClaveLarga123!', 'Ñabcde1!']) {
    assert.equal(passwordSchema.safeParse(value).success, true);
    assert.equal(frontPolicy.passwordSchema.safeParse(value).success, true);
    assert.equal(frontPolicy.passwordRequirements(value).filter(r => r.met).length, 5);
  }
  for (const value of ['', 'Abcd1!x', 'abcdef1!', 'ABCDEF1!', 'Abcdefg!', 'Abcdef12', 'Abcdef1 ', 'Aa12345ñ']) {
    assert.equal(passwordSchema.safeParse(value).success, false, value);
    assert.equal(frontPolicy.passwordSchema.safeParse(value).success, false, value);
    assert.ok(frontPolicy.passwordRequirements(value).some(r => !r.met));
  }
  assert.equal(schemas.registerSchema.safeParse({ ...registerInput, contrasena: 'Abcdef12', confirmarContrasena: 'Abcdef12' }).success, false);
  assert.equal(schemas.resetPasswordSchema.safeParse({ correo: user.correo, codigo: '123456', nuevaContrasena: 'Abcdef12' }).success, false);
  assert.equal(schemas.changePasswordSchema.safeParse({ contrasenaActual: '1234567', nuevaContrasena: 'Abcdef12', confirmarContrasena: 'Abcdef12' }).success, false);
  assert.equal(schemas.loginSchema.safeParse({ correo: user.correo, contrasena: '1234567', captchaId: 'a'.repeat(64), captchaCode: 'ABC234' }).success, true);
});

test('registro crea cuenta pendiente, envia codigo y no dice que puede entrar sin confirmar', async () => {
  exists = false;
  const result = await auth.registrar(registerInput, {});
  assert.equal(result.correoEnviado, true);
  assert.equal(user.correoVerificado, false);
  assert.equal(sent.length, 1);
  assert.equal(tokens[0].codigo, hashEmailCode(code()));
  assert.equal(JSON.stringify(result, (_, v) => typeof v === 'bigint' ? String(v) : v).includes(code()), false);
  assert.equal((await authorize('/api/estudiantes/perfil')).error.statusCode, 403);
});

test('fallo de envio conserva cuenta pendiente y permite reintentar sin registrarla de nuevo', async t => {
  exists = false;
  mail.sendMail = async () => { throw new Error('delivery failed'); };
  const result = await auth.registrar(registerInput, {});
  assert.equal(result.correoEnviado, false);
  assert.equal(exists, true);
  assert.equal(user.correoVerificado, false);
  assert.equal(tokens[0].usado, true);
  mail.sendMail = async message => sent.push(message);
  await service.solicitar(user.correo);
  assert.equal(sent.length, 1);
});

test('codigo es de un solo uso y la confirmacion no elimina el cambio de password pendiente', async () => {
  await service.solicitar(user.correo);
  const codigo = code();
  await assert.rejects(service.confirmar('otra@example.test', codigo), { statusCode: 400 });
  await service.confirmar(user.correo, codigo);
  assert.equal(user.correoVerificado, true);
  assert.equal(user.debeCambiarPassword, true);
  assert.equal(tokens[0].usado, true);
  await assert.rejects(service.confirmar(user.correo, codigo), { statusCode: 400 });
});

test('codigo vencido o incorrecto no verifica la cuenta', async () => {
  await service.solicitar(user.correo);
  await assert.rejects(service.confirmar(user.correo, 'xxxxxx'), { statusCode: 400 });
  tokens[0].expiraEn = new Date(Date.now() - 1000);
  await assert.rejects(service.confirmar(user.correo, code()), { statusCode: 400 });
  assert.equal(user.correoVerificado, false);
});

test('reenvio tiene espera y reemplaza el codigo previo', async t => {
  let n = 100000;
  t.mock.method(passwords, 'generateNumericCode', () => String(++n));
  await service.solicitar(user.correo);
  const anterior = code();
  await service.solicitar(user.correo);
  assert.equal(sent.length, 1);
  tokens[0].creadoEn = new Date(Date.now() - 61000);
  await service.solicitar(user.correo);
  assert.equal(sent.length, 2);
  await assert.rejects(service.confirmar(user.correo, anterior), { statusCode: 400 });
  await service.confirmar(user.correo, code());
});

test('envios y confirmaciones simultaneos no duplican codigos ni aceptan reuso', async () => {
  await Promise.all([service.solicitar(user.correo), service.solicitar(user.correo)]);
  assert.equal(sent.length, 1);
  const results = await Promise.allSettled([service.confirmar(user.correo, code()), service.confirmar(user.correo, code())]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
});

test('cuentas confirmadas, inactivas o inexistentes no reciben nuevos codigos', async () => {
  user.correoVerificado = true; await service.solicitar(user.correo);
  user.correoVerificado = false; user.estado = 'INACTIVO'; await service.solicitar(user.correo);
  await service.solicitar('inexistente@example.test');
  assert.equal(sent.length, 0);
});

test('ambos logins conservan correo pendiente y servidor exige correo antes de password', async () => {
  for (const fn of ['login', 'loginAdmin']) {
    const result = await auth[fn]({ correo: user.correo, contrasena: '1234567', captchaId: '', captchaCode: '' }, {});
    assert.equal(result.usuario.correoVerificado, false);
  }
  assert.equal((await authorize('/api/auth/me')).error, undefined);
  assert.equal((await authorize('/api/auth/change-password', 'POST')).error.details.code, 'EMAIL_VERIFICATION_REQUIRED');
  assert.equal((await authorize('/api/aulas')).error.statusCode, 403);
  const req = (await authorize('/api/auth/me')).req;
  await optionalAuth(req, {}, error => assert.equal(error, undefined));
  assert.equal(req.user, undefined);
  await service.solicitar(user.correo);
  await service.confirmar(user.correo, code());
  assert.equal((await authorize('/api/auth/change-password', 'POST')).error, undefined);
  assert.equal((await authorize('/api/aulas')).error.details.code, 'PASSWORD_CHANGE_REQUIRED');
});

test('HTTP: codigo confirma correo y habilita cambio temporal; repetidos errores se limitan', async () => {
  const express = require('express');
  const app = express(); app.use(express.json());
  app.use('/api', require('../src/routes').default);
  app.use(require('../src/middlewares/error.middleware').errorMiddleware);
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = signAccessToken({ credentialVersion: credentialVersion(user.contrasenaHash), idUsuario: '2', correo: user.correo, roles: [], debeCambiarPassword: true });
  const request = (route, body) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  try {
    const password = { contrasenaActual: '1234567', nuevaContrasena: 'Abcdef1!', confirmarContrasena: 'Abcdef1!' };
    assert.equal((await request('/auth/change-password', password)).status, 403);
    assert.equal((await request('/auth/resend-verification', { correo: user.correo })).status, 200);
    assert.equal((await request('/auth/verify-email', { correo: user.correo, codigo: code() })).status, 200);
    const result = await request('/auth/change-password', password);
    assert.equal(result.status, 200);
    assert.ok(result.headers.get('set-cookie').includes('accessToken=;'));
    for (let n = 0; n < 5; n++) assert.equal((await request('/auth/verify-email', { correo: user.correo, codigo: '000000' })).status, 400);
    assert.equal((await request('/auth/verify-email', { correo: user.correo, codigo: '000000' })).status, 429);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
