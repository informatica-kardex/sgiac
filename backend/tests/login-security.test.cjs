// Ejecutar desde backend: node -r ts-node/register/transpile-only --test tests/login-security.test.cjs
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-only-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-only-refresh-secret';
process.env.RESEND_API_KEY = 'test-only-mail-key';
process.env.MAIL_PROVIDER = 'resend';
process.env.MAIL_FROM = '';
process.env.LOGIN_MAIL_FROM = 'test@example.test';

const security = require('../src/modules/auth/login-security');
const { AuthService } = require('../src/modules/auth/auth.service');
const { authController } = require('../src/modules/auth/auth.controller');
const { UserRepository } = require('../src/modules/users/user.repository');
const { AuthRepository } = require('../src/modules/auth/auth.repository');
const { AuditService } = require('../src/modules/audit/audit.service');
const password = require('../src/utils/password');

let user, sent, sessions, sequence = 0;
beforeEach((t) => {
  user = {
    idUsuario: BigInt(++sequence), correo: 'test@example.test', nombreCompleto: 'Test',
    contrasenaHash: 'hashed-password', estado: 'ACTIVO', twoFactorEnabled: false,
    roles: [{ estado: 'ACTIVO', rol: { nombre: 'ADMINISTRADOR', estado: 'ACTIVO' } }], correoVerificado: true, debeCambiarPassword: false,
  };
  sent = [];
  sessions = [];
  t.mock.method(crypto, 'randomInt', (min, max) => max === undefined ? 0 : min);
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    sent.push(JSON.parse(options.body));
    return { ok: true };
  });
  t.mock.method(password, 'comparePassword', async (value) => value === 'correct-password');
  t.mock.method(UserRepository.prototype, 'findByIdWithRolesByCorreo', async () => user);
  t.mock.method(UserRepository.prototype, 'findByIdWithRoles', async () => user);
  t.mock.method(UserRepository.prototype, 'findById', async () => user);
  t.mock.method(AuthRepository.prototype, 'guardarRefreshToken', async (value) => { sessions.push(value); });
  t.mock.method(AuthRepository.prototype, 'actualizarTwoFactor', async (id, enabled, correo, hash) => {
    assert.equal(id, user.idUsuario);
    assert.equal(correo, user.correo);
    assert.equal(hash, user.contrasenaHash);
    user.twoFactorEnabled = enabled;
  });
  t.mock.method(AuditService.prototype, 'registrar', async () => {});
});
afterEach((t) => t.mock.restoreAll());

function payload() {
  const captcha = security.createCaptcha();
  return { correo: user.correo, contrasena: 'correct-password', captchaId: captcha.captchaId, captchaCode: '22AAA2' };
}
function code(challenge) { return { challengeId: challenge.challengeId, codigo: '000000' }; }
async function controller(name, body, authenticated = false) {
  const result = { cookies: [], headers: {} };
  let finish, fail;
  const completed = new Promise((resolve, reject) => { finish = resolve; fail = reject; });
  const response = {
    cookie(name) { result.cookies.push(name); return this; },
    setHeader(name, value) { result.headers[name] = value; return this; },
    status(value) { result.status = value; return this; },
    json(value) { result.body = value; finish(); return this; },
  };
  await authController[name]({ body, headers: {}, ip: '127.0.0.1',
    user: authenticated ? { idUsuario: user.idUsuario.toString() } : undefined,
  }, response, fail);
  await completed;
  return result;
}

test('CAPTCHA mezcla letras y numeros, acepta minusculas y solo se usa una vez', () => {
  const input = payload();
  security.verifyCaptcha(input.captchaId, input.captchaCode.toLowerCase());
  assert.throws(() => security.verifyCaptcha(input.captchaId, input.captchaCode), /CAPTCHA/);
  const wrong = payload();
  assert.throws(() => security.verifyCaptcha(wrong.captchaId, 'ZZZZZZ'), /CAPTCHA/);
  assert.throws(() => security.verifyCaptcha(wrong.captchaId, wrong.captchaCode), /CAPTCHA/);
});

test('CAPTCHA vencido o ausente no permite iniciar sesion', async (t) => {
  const input = payload();
  const now = Date.now();
  t.mock.method(Date, 'now', () => now + 300_001);
  assert.throws(() => security.verifyCaptcha(input.captchaId, input.captchaCode), /CAPTCHA/);
  await assert.rejects(controller('login', { correo: user.correo, contrasena: 'correct-password' }));
  assert.equal(sessions.length, 0);
});

for (const name of ['login', 'adminLogin']) {
  test(`${name}: 2FA desactivado permite acceso directo tras CAPTCHA`, async () => {
    const response = await controller(name, payload());
    assert.ok(response.body.data.accessToken);
    assert.deepEqual(response.cookies, ['accessToken', 'refreshToken']);
    assert.equal(sent.length, 0);
    assert.equal(sessions.length, 1);
  });

  test(`${name}: 2FA activo no emite tokens ni cookies antes del codigo`, async () => {
    user.twoFactorEnabled = true;
    const response = await controller(name, payload());
    assert.equal(response.body.data.requiresTwoFactor, true);
    assert.equal(response.body.data.accessToken, undefined);
    assert.equal(response.body.data.codigo, undefined);
    assert.deepEqual(response.cookies, []);
    assert.equal(sessions.length, 0);
    assert.equal(sent.length, 1);
    const verify = name === 'login' ? 'verifyLogin' : 'verifyAdminLogin';
    const verified = await controller(verify, code(response.body.data));
    assert.ok(verified.body.data.accessToken);
    assert.equal(verified.cookies.length, 2);
    await assert.rejects(controller(verify, code(response.body.data)));
    assert.equal(sessions.length, 1);
  });
}

test('Contrasena incorrecta y usuario sin rol no envian codigos', async () => {
  user.twoFactorEnabled = true;
  const service = new AuthService();
  await assert.rejects(service.login({ ...payload(), contrasena: 'wrong' }, {}));
  user.roles = [];
  await assert.rejects(service.loginAdmin(payload(), {}));
  assert.equal(sent.length, 0);
  assert.equal(sessions.length, 0);
});

test('Cinco errores agotan el codigo y no admiten reuso', async () => {
  const challenge = await security.beginLoginVerification(user, false);
  for (let i = 0; i < 5; i++) assert.throws(() => security.consumeLoginVerification(challenge.challengeId, '999999', false));
  assert.throws(() => security.consumeLoginVerification(challenge.challengeId, '000000', false));
});

test('Codigo vencido y cambio de cuenta impiden el acceso', async (t) => {
  user.twoFactorEnabled = true;
  const service = new AuthService();
  const challenge = await service.login(payload(), {});
  user.estado = 'INACTIVO';
  await assert.rejects(service.verificarLogin(code(challenge), false, {}));
  const second = await security.beginLoginVerification(user, false);
  const now = Date.now();
  t.mock.method(Date, 'now', () => now + 300_001);
  assert.throws(() => security.consumeLoginVerification(second.challengeId, '000000', false));
  assert.equal(sessions.length, 0);
});

test('Activacion exige sesion, contrasena y codigo; el codigo no sirve para login', async () => {
  const service = new AuthService();
  await assert.rejects(controller('twoFactorSetup', { enabled: true, contrasena: 'correct-password' }));
  await assert.rejects(service.solicitarCambioTwoFactor(user.idUsuario, { enabled: true, contrasena: 'wrong' }));
  const challenge = await service.solicitarCambioTwoFactor(user.idUsuario, { enabled: true, contrasena: 'correct-password' });
  assert.equal(user.twoFactorEnabled, false);
  await assert.rejects(service.verificarLogin(code(challenge), false, {}));
  await assert.rejects(service.confirmarCambioTwoFactor(user.idUsuario + 1n, { ...code(challenge), enabled: true }));
  await service.confirmarCambioTwoFactor(user.idUsuario, { ...code(challenge), enabled: true });
  assert.equal(user.twoFactorEnabled, true);
  assert.equal(sessions.length, 0);
  const login = await service.login(payload(), {});
  assert.equal(login.requiresTwoFactor, true);
});

test('Activacion 2FA por Mailtrap SMTP solo persiste tras confirmar el codigo', async (t) => {
  const keys = ['MAIL_PROVIDER', 'MAIL_FROM', 'SMTP_HOST', 'SMTP_PORT',
    'SMTP_USERNAME', 'SMTP_PASSWORD', 'SMTP_ENCRYPTION'];
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  t.after(() => {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  });
  Object.assign(process.env, {
    MAIL_PROVIDER: 'smtp', MAIL_FROM: 'SGIAC <acceso@example.test>',
    SMTP_HOST: 'sandbox.smtp.mailtrap.io', SMTP_PORT: '587',
    SMTP_USERNAME: 'sandbox-user', SMTP_PASSWORD: 'sandbox-password', SMTP_ENCRYPTION: 'tls',
  });
  const smtpMessages = [];
  t.mock.method(require('nodemailer').default, 'createTransport', () => ({
    sendMail: async message => { smtpMessages.push(message); },
  }));
  const response = await controller('twoFactorSetup', { enabled: true, contrasena: 'correct-password' }, true);
  const challenge = response.body.data;
  assert.equal(smtpMessages.length, 1);
  assert.equal(smtpMessages[0].to, user.correo);
  assert.match(smtpMessages[0].text, /Activa la verificación en dos pasos/);
  assert.match(smtpMessages[0].html, /TU CÓDIGO DE VERIFICACIÓN/);
  assert.match(smtpMessages[0].text, /000000/);
  assert.equal(user.twoFactorEnabled, false);
  assert.equal(sent.length, 0);
  assert.equal(JSON.stringify(challenge).includes('000000'), false);
  const confirmed = await controller('twoFactorConfirm', { ...code(challenge), enabled: true }, true);
  assert.equal(confirmed.body.data.enabled, true);
  assert.equal(user.twoFactorEnabled, true);
  await assert.rejects(controller('twoFactorConfirm', { ...code(challenge), enabled: true }, true));
});

test('Desactivar exige otro codigo y vuelve al acceso directo', async () => {
  user.twoFactorEnabled = true;
  const service = new AuthService();
  const challenge = await service.solicitarCambioTwoFactor(user.idUsuario, { enabled: false, contrasena: 'correct-password' });
  await assert.rejects(service.confirmarCambioTwoFactor(user.idUsuario, { ...code(challenge), enabled: true }));
  await service.confirmarCambioTwoFactor(user.idUsuario, { ...code(challenge), enabled: false });
  assert.equal(user.twoFactorEnabled, false);
  const result = await service.login(payload(), {});
  assert.ok(result.tokens.accessToken);
});

test('Fallo de correo no activa 2FA ni deja un codigo utilizable', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('test delivery failure'); });
  const service = new AuthService();
  await assert.rejects(service.solicitarCambioTwoFactor(user.idUsuario, { enabled: true, contrasena: 'correct-password' }), /No se pudo enviar/);
  assert.equal(user.twoFactorEnabled, false);
  assert.equal(sessions.length, 0);
});

test('Reenvio tiene espera minima e invalida el codigo anterior', async (t) => {
  const first = await security.beginLoginVerification(user, false);
  await assert.rejects(security.beginLoginVerification(user, false), /Espera un minuto/);
  const now = Date.now();
  t.mock.method(Date, 'now', () => now + 60_001);
  const second = await security.beginLoginVerification(user, false);
  assert.throws(() => security.consumeLoginVerification(first.challengeId, '000000', false));
  assert.equal(security.consumeLoginVerification(second.challengeId, '000000', false).idUsuario, user.idUsuario.toString());
});

test('Dos verificaciones simultaneas crean una sola sesion', async () => {
  user.twoFactorEnabled = true;
  const service = new AuthService();
  const challenge = await service.login(payload(), {});
  const results = await Promise.allSettled([
    service.verificarLogin(code(challenge), false, {}),
    service.verificarLogin(code(challenge), false, {}),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(sessions.length, 1);
});

test('Un codigo incorrecto de configuracion no invalida la sesion actual', async () => {
  const service = new AuthService();
  const challenge = await service.solicitarCambioTwoFactor(user.idUsuario, { enabled: true, contrasena: 'correct-password' });
  await assert.rejects(service.confirmarCambioTwoFactor(user.idUsuario, {
    challengeId: challenge.challengeId, codigo: '999999', enabled: true,
  }), (error) => error.statusCode === 400);
  assert.equal(user.twoFactorEnabled, false);
});
