// Ejecutar desde backend: node -r ts-node/register/transpile-only --test tests/mail.test.cjs
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { sendMail } = require('../src/utils/mail');
const { academicCodeMail } = require('../src/utils/mail-template');
const nodemailer = require('nodemailer').default;
const tls = require('node:tls');

const keys = ['MAIL_PROVIDER', 'MAIL_FROM', 'LOGIN_MAIL_FROM', 'MAILTRAP_API_TOKEN', 'MAILTRAP_INBOX_ID', 'RESEND_API_KEY',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USERNAME', 'SMTP_PASSWORD', 'SMTP_ENCRYPTION', 'MAILTRAP_SENDING_TOKEN', 'MAILTRAP_SENDING_FROM'];
let original, requests;
const message = { to: 'usuario@example.test', subject: 'Codigo SGIAC', text: 'Tu codigo es 123456' };
beforeEach((t) => {
  original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, {
    MAIL_PROVIDER: 'mailtrap', MAIL_FROM: 'SGIAC <acceso@sgiac.test>',
    MAILTRAP_API_TOKEN: 'test-token', MAILTRAP_INBOX_ID: '123',
  });
  requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, ...options, body: JSON.parse(options.body) });
    return { ok: true };
  });
});
afterEach((t) => {
  t.mock.restoreAll();
  for (const key of keys) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
});

test('plantilla académica destaca código, conserva texto y escapa datos del destinatario', () => {
  const content = academicCodeMail({ title: 'Confirma tu correo', description: 'Ingresa el código en Kardex.', name: '<img src=x onerror=alert(1)>', code: '012345', minutes: 15 });
  assert.match(content.html, /font-size:36px/);
  assert.match(content.html, /012345/); assert.match(content.text, /012345/);
  assert.match(content.html, /&lt;img/); assert.ok(!content.html.includes('<img'));
  assert.match(content.html, /15 minutos/); assert.ok(!content.html.includes('<script'));
});

test('SMTP y proveedores API conservan HTML y alternativa de texto', async t => {
  const content = { ...message, ...academicCodeMail({ title: 'Recupera tu cuenta', description: 'Confirma el código.', code: '012345', minutes: 15 }) };
  for (const provider of ['mailtrap', 'mailtrap-sending', 'resend']) {
    Object.assign(process.env, { MAIL_PROVIDER: provider, MAILTRAP_SENDING_TOKEN: 'fake', MAILTRAP_SENDING_FROM: 'test@example.test', RESEND_API_KEY: 'fake' });
    await sendMail(content); assert.equal(requests.at(-1).body.html, content.html); assert.equal(requests.at(-1).body.text, content.text);
  }
  Object.assign(process.env, { MAIL_PROVIDER: 'smtp', SMTP_HOST: 'sandbox.smtp.mailtrap.io', SMTP_USERNAME: 'fake', SMTP_PASSWORD: 'fake' });
  let delivered;
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async value => { delivered = value; } }));
  await sendMail(content); assert.equal(delivered.html, content.html); assert.equal(delivered.text, content.text);
});

test('Mailtrap captura el mensaje en la bandeja configurada y mantiene el destinatario', async () => {
  await sendMail(message);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://sandbox.api.mailtrap.io/api/send/123');
  assert.equal(requests[0].headers.Authorization, 'Bearer test-token');
  assert.deepEqual(requests[0].body, {
    from: { email: 'acceso@sgiac.test', name: 'SGIAC' },
    to: [{ email: message.to }], subject: message.subject, text: message.text,
  });
  assert.ok(requests[0].signal instanceof AbortSignal);
});

test('Resend permite envio real cambiando solo la configuracion', async () => {
  process.env.MAIL_PROVIDER = 'resend';
  process.env.RESEND_API_KEY = 'resend-test-key';
  await sendMail(message);
  assert.equal(requests[0].url, 'https://api.resend.com/emails');
  assert.equal(requests[0].headers.Authorization, 'Bearer resend-test-key');
  assert.deepEqual(requests[0].body, { ...message, from: process.env.MAIL_FROM, to: [message.to] });
});

test('Mailtrap Email Sending usa API real y credenciales separadas de Sandbox', async () => {
  process.env.MAIL_PROVIDER = 'mailtrap-sending';
  process.env.MAILTRAP_SENDING_TOKEN = 'sending-token';
  process.env.MAILTRAP_SENDING_FROM = 'Kardex <acceso@example.test>';
  await sendMail(message);
  assert.equal(requests[0].url, 'https://send.api.mailtrap.io/api/send');
  assert.equal(requests[0].headers.Authorization, 'Bearer sending-token');
  assert.deepEqual(requests[0].body.from, { email: 'acceso@example.test', name: 'Kardex' });
  assert.deepEqual(requests[0].body.to, [{ email: message.to }]);
});

test('Mailtrap Email Sending no reutiliza token ni remitente de Sandbox si falta configuracion', async () => {
  process.env.MAIL_PROVIDER = 'mailtrap-sending';
  await assert.rejects(sendMail(message), { statusCode: 503 });
  process.env.MAILTRAP_SENDING_FROM = 'acceso@example.test';
  await assert.rejects(sendMail(message), { statusCode: 503 });
  assert.equal(requests.length, 0);
});

test('conserva la configuracion anterior de Resend y LOGIN_MAIL_FROM', async () => {
  delete process.env.MAIL_PROVIDER;
  delete process.env.MAIL_FROM;
  process.env.LOGIN_MAIL_FROM = 'acceso@example.test';
  process.env.RESEND_API_KEY = 'resend-test-key';
  await sendMail(message);
  assert.equal(requests[0].url, 'https://api.resend.com/emails');
  assert.equal(requests[0].body.from, 'acceso@example.test');
});

test('Mailtrap admite remitente sin nombre', async () => {
  process.env.MAIL_FROM = 'acceso@sgiac.test';
  await sendMail(message);
  assert.deepEqual(requests[0].body.from, { email: 'acceso@sgiac.test' });
});

for (const [key, value] of [
  ['MAILTRAP_API_TOKEN', ''], ['MAILTRAP_INBOX_ID', ''],
  ['MAILTRAP_INBOX_ID', '../123'], ['MAIL_FROM', ''], ['MAIL_PROVIDER', 'invalid'],
]) {
  test(`configuracion invalida (${key}=${value}) falla sin enviar ni usar Resend`, async () => {
    process.env[key] = value;
    process.env.RESEND_API_KEY = 'resend-test-key';
    await assert.rejects(sendMail(message), error => error.statusCode === 503);
    assert.equal(requests.length, 0);
  });
}

for (const failure of ['http', 'network', 'timeout']) {
  test(`fallo ${failure} se informa sin exponer secretos ni cambiar de proveedor`, async (t) => {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => {
      calls++;
      if (failure === 'http') return { ok: false, status: 401 };
      throw new Error(failure + ' test-token 123456');
    });
    await assert.rejects(sendMail(message), error =>
      error.statusCode === 503 && !/test-token|123456/.test(error.message));
    assert.equal(calls, 1);
  });
}

function configureSmtp() {
  Object.assign(process.env, {
    MAIL_PROVIDER: 'smtp', MAIL_FROM: 'SGIAC <acceso@example.test>',
    SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: '587',
    SMTP_USERNAME: 'acceso@example.test', SMTP_PASSWORD: 'app-password', SMTP_ENCRYPTION: 'tls',
  });
}

test('SMTP envia el mismo mensaje con STARTTLS obligatorio en el puerto 587', async (t) => {
  configureSmtp();
  const sent = [];
  const create = t.mock.method(nodemailer, 'createTransport', options => {
    assert.equal(options.host, 'smtp.gmail.com');
    assert.equal(options.port, 587);
    assert.equal(options.secure, false);
    assert.equal(options.requireTLS, true);
    assert.equal(options.tls.rejectUnauthorized, true);
    assert.deepEqual(options.auth, { user: 'acceso@example.test', pass: 'app-password' });
    return { sendMail: async mail => { sent.push(mail); } };
  });
  await sendMail(message);
  assert.equal(create.mock.callCount(), 1);
  assert.deepEqual(sent, [{ from: process.env.MAIL_FROM, ...message }]);
  assert.equal(requests.length, 0);
});

test('SMTP admite TLS directo en el puerto 465', async (t) => {
  configureSmtp();
  process.env.SMTP_PORT = '465';
  process.env.SMTP_ENCRYPTION = 'ssl';
  t.mock.method(nodemailer, 'createTransport', options => {
    assert.equal(options.port, 465);
    assert.equal(options.secure, true);
    assert.equal(options.requireTLS, false);
    return { sendMail: async () => {} };
  });
  await sendMail(message);
  assert.equal(requests.length, 0);
});

test('Mailtrap SMTP usa sus credenciales sin exigir un token de API', async (t) => {
  configureSmtp();
  process.env.SMTP_HOST = 'sandbox.smtp.mailtrap.io';
  process.env.SMTP_USERNAME = 'sandbox-user';
  delete process.env.MAILTRAP_API_TOKEN;
  delete process.env.MAILTRAP_INBOX_ID;
  const sent = [];
  t.mock.method(nodemailer, 'createTransport', options => {
    assert.equal(options.host, 'sandbox.smtp.mailtrap.io');
    assert.equal(options.auth.user, 'sandbox-user');
    assert.equal(options.requireTLS, true);
    assert.equal(options.tls.rejectUnauthorized, true);
    return { sendMail: async mail => { sent.push(mail); } };
  });
  await sendMail(message);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, message.to);
  assert.equal(requests.length, 0);
});

test('SMTP conserva las CA de Node y agrega las del sistema sin desactivar TLS', {
  skip: typeof tls.getCACertificates !== 'function',
}, async (t) => {
  configureSmtp();
  t.mock.method(tls, 'getCACertificates', type => type === 'default'
    ? ['node-ca', 'extra-ca'] : ['system-ca', 'node-ca']);
  t.mock.method(nodemailer, 'createTransport', options => {
    assert.deepEqual(options.tls.ca, ['node-ca', 'extra-ca', 'system-ca']);
    assert.equal(options.tls.rejectUnauthorized, true);
    return { sendMail: async () => {} };
  });
  await sendMail(message);
});

for (const [key, value] of [
  ['SMTP_HOST', ''], ['SMTP_USERNAME', ''], ['SMTP_PASSWORD', ''],
  ['SMTP_PORT', 'invalid'], ['SMTP_PORT', '0'], ['SMTP_PORT', '65536'],
  ['SMTP_PORT', '587.5'], ['SMTP_ENCRYPTION', 'none'],
]) {
  test(`SMTP invalido (${key}=${value}) falla antes de conectar`, async (t) => {
    configureSmtp();
    process.env[key] = value;
    const create = t.mock.method(nodemailer, 'createTransport', () => {
      throw new Error('No debe conectar');
    });
    await assert.rejects(sendMail(message), error => error.statusCode === 503);
    assert.equal(create.mock.callCount(), 0);
    assert.equal(requests.length, 0);
  });
}

test('error SMTP no expone credenciales ni usa otro proveedor', async (t) => {
  configureSmtp();
  const send = t.mock.fn(async () => { throw new Error('SMTP app-password 123456'); });
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: send }));
  await assert.rejects(sendMail(message), error =>
    error.statusCode === 503 && !/app-password|123456/.test(error.message));
  assert.equal(send.mock.callCount(), 1);
  assert.equal(requests.length, 0);
});
