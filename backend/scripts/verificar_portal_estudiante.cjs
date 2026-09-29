// Prueba local con navegador y BD reales. Crea UN estudiante por formulario.
// Solo correo y aleatoriedad del CAPTCHA son controlados en este proceso de prueba.
// No altera backend/.env. Ejecutar desde backend después de compilar frontend.
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
process.env.FRONTEND_URL = 'http://127.0.0.1:5189';
process.env.COOKIE_SECURE = 'false';
const mail = require('../dist/utils/mail');
mail.sendMail = async () => { throw new Error('Proveedor no usado durante la prueba local'); };
const crypto = require('crypto');
const security = require('../dist/modules/auth/login-security');
const originalCaptcha = security.createCaptcha;
security.createCaptcha = () => {
  const originalRandom = crypto.randomInt;
  crypto.randomInt = (min, max) => max === undefined ? 0 : min;
  try { return originalCaptcha(); } finally { crypto.randomInt = originalRandom; }
};
const app = require('../dist/app').default;
const { prisma } = require('../dist/database/prisma');
const root = path.resolve('../frontend/dist');
const output = path.resolve('../.preview-estudiantes');
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return app(req, res);
  const url = new URL(req.url, 'http://127.0.0.1');
  const relative = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/images/') ? url.pathname : '/index.html';
  const file = path.join(root, relative);
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
  res.end(fs.readFileSync(file));
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let chrome, ws;
(async () => {
  await new Promise(resolve => server.listen(5189, '127.0.0.1', resolve));
  chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9339', '--user-data-dir=' + path.join(output, 'chrome'), 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let tabs;
  for (let i = 0; i < 40; i++) { try { tabs = await fetch('http://127.0.0.1:9339/json').then(r => r.json()); break; } catch { await delay(250); } }
  assert.ok(tabs, 'Chrome debe iniciar');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let id = 0; const pending = new Map(); const errors = [];
  const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) { const p = pending.get(message.id); pending.delete(message.id); if (message.error) p.reject(message.error); else p.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async expression => { for (let i = 0; i < 80; i++) { if (await evaluate(expression)) return; await delay(150); } throw new Error('Tiempo agotado: ' + expression); };
  const fill = async (selector, value) => evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  const capture = async name => { await delay(200); const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(r.data, 'base64')); };
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Network.clearBrowserCookies');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `const originalOpen=XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open=function(method,url,...rest){const parsed=new URL(url,location.href);if(parsed.pathname.startsWith('/api/'))url=location.origin+parsed.pathname+parsed.search;return originalOpen.call(this,method,url,...rest);};` });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'http://127.0.0.1:5189/registro' });
  await waitFor('!!document.querySelector("#mencion")');
  assert.equal(await evaluate('!!document.querySelector("#semestre, #gestion, #carrera")'), false);
  const suffix = process.env.TEST_STUDENT_SUFFIX || Date.now().toString().slice(-10);
  const email = `registro.frontend.${suffix}@example.test`;
  const payload = { nombres: 'Prueba', apellidos: 'Frontend', ci: 'WEB-' + suffix, ru: 'WEB-' + suffix, correo: email, mencion: 'Ingeniería de Sistemas', contrasena: 'Estudiante2026!Kardex', confirmarContrasena: 'Estudiante2026!Kardex' };
  const exists = await prisma.estudiante.findUnique({ where: { correo_institucional: email } });
  if (!exists) {
    for (const [key, value] of Object.entries(payload)) await fill('#' + key, value);
    await evaluate('document.querySelector("form").requestSubmit()');
    await waitFor('document.body.innerText.includes("Cuenta creada correctamente")');
    await capture('registro-exitoso');
  }
  const student = await prisma.estudiante.findUnique({ where: { correo_institucional: email }, include: { usuario: { include: { roles: { include: { rol: true } } } } } });
  assert.ok(student); assert.equal(student.carrera, payload.mencion); assert.equal(student.semestre, null); assert.equal(student.gestion, null);
  assert.deepEqual(student.usuario.roles.map(r => r.rol.nombre), ['CONSULTA_INTERNA']);
  console.log('REGISTRO_FRONTEND_OK', JSON.stringify({ correo: email, idUsuario: student.id_usuario.toString() }));
  // La segunda solicitud debe distinguir el correo duplicado.
  const duplicate = await fetch('http://127.0.0.1:5189/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  assert.equal(duplicate.status, 409); assert.match((await duplicate.json()).message, /correo/);
  for (const [field, label] of [['ci', 'CI'], ['ru', 'RU']]) {
    const candidate = { ...payload, correo: `duplicado.${field}.${suffix}@example.test`, ci: 'DUP-CI-' + suffix, ru: 'DUP-RU-' + suffix, [field]: payload[field] };
    const response = await fetch('http://127.0.0.1:5189/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(candidate) });
    assert.equal(response.status, 409); assert.ok((await response.json()).message.includes(label));
  }
  console.log('DUPLICADOS_CORREO_CI_RU_OK');
  await send('Page.navigate', { url: 'http://127.0.0.1:5189/login' });
  await waitFor('!!document.querySelector("img[alt^=CAPTCHA]")');
  await fill('#institutional-email', email); await fill('#institutional-password', payload.contrasena); await fill('#login-captcha', '22AAA2');
  await evaluate('document.querySelector("form").requestSubmit()');
  await waitFor('location.pathname === "/usuario/dashboard" && document.body.innerText.includes("No tienes fichas pendientes")');
  assert.ok(await evaluate(`!!document.querySelector('a[aria-label="Ver mi perfil"]')`));
  await capture('portal-escritorio');
  await evaluate(`document.querySelector('a[aria-label="Ver mi perfil"]').click()`);
  await waitFor('document.body.innerText.includes("Ingeniería de Sistemas")');
  await capture('perfil');
  assert.equal(await evaluate('document.querySelector("main").innerText.includes("Semestre")'), false);
  await send('Page.navigate', { url: 'http://127.0.0.1:5189/usuario/fichas?solicitar=1' });
  await waitFor('document.body.innerText.includes("No hay jornadas disponibles")');
  await capture('fichas-sin-jornadas');
  await send('Page.navigate', { url: 'http://127.0.0.1:5189/usuario/horarios' });
  await waitFor('!!document.querySelector("main h1") && document.querySelector("main h1").textContent === "Horarios"');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: 'http://127.0.0.1:5189/usuario/dashboard' });
  await waitFor('document.body.innerText.includes("No tienes fichas pendientes")');
  assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false);
  await capture('portal-movil');
  await evaluate(`document.querySelector('button[aria-label="Abrir menú"]').click()`);
  assert.equal(await evaluate(`document.querySelector('button[aria-label="Abrir menú"]').getAttribute('aria-expanded')`), 'true');
  await capture('menu-movil');
  assert.deepEqual(errors, []);
  console.log('LOGIN_PERFIL_HORARIOS_FICHAS_MOVIL_OK (sin errores JavaScript ni desbordamiento)');
  await send('Browser.close');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { ws?.close(); chrome?.kill(); server.close(); await prisma.$disconnect(); });
