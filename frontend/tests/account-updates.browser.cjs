// Desde la raíz: node frontend/tests/account-updates.browser.cjs (requiere frontend/dist).
// Todas las llamadas a la API se simulan; no crea cuentas ni cambia datos reales.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const root = path.resolve('frontend/dist'), output = path.resolve('.preview-auth/account-updates');
fs.mkdirSync(output, { recursive: true });
const origin = 'http://127.0.0.1:5199';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let role = null, counts = { 'solicitudes-aulas': 2, documentos: 3, fichas: 4 };
const requests = [], errors = [];
const user = () => ({ idUsuario: '42', nombreCompleto: 'Ana Pérez', correo: 'ana@umsa.bo', roles: [role], permisos: [], correoVerificado: true, debeCambiarPassword: false });
const session = () => ({ id: 1, expiresAt: Date.now() + 180000 });
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, origin).pathname);
  const file = path.join(root, pathname.startsWith('/assets/') || pathname.startsWith('/images/') ? pathname : 'index.html');
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.webp') ? 'image/webp' : file.endsWith('.png') ? 'image/png' : 'text/html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise(resolve => server.listen(5199, '127.0.0.1', resolve));
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9349', '--user-data-dir=' + path.join(output, 'chrome'), 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let ws;
  try {
    let tabs;
    for (let i = 0; i < 50; i++) { try { tabs = await fetch('http://127.0.0.1:9349/json').then(r => r.json()); break; } catch { await delay(200); } }
    assert.ok(tabs, 'Chrome inició');
    ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
    let sequence = 0;
    const pending = new Map();
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
    });
    ws.addEventListener('message', async event => {
      const message = JSON.parse(event.data);
      if (message.id) { const p = pending.get(message.id); pending.delete(message.id); message.error ? p.reject(message.error) : p.resolve(message.result); return; }
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
      if (message.method !== 'Fetch.requestPaused') return;
      const { requestId, request } = message.params;
      try {
        const route = new URL(request.url).pathname;
        let data = [], status = 200, text = '', type = 'application/json';
        const body = request.postData ? JSON.parse(request.postData) : {};
        if (request.method !== 'OPTIONS') {
          requests.push({ route, method: request.method, body });
          if (route.endsWith('/auth/refresh')) { if (!role) status = 401; else data = { accessToken: 'test-token', session: session() }; }
          else if (route.endsWith('/auth/me')) data = user();
          else if (route.endsWith('/auth/activity')) data = session();
          else if (route.endsWith('/auth/two-factor')) data = { enabled: false };
          else if (route.endsWith('/auth/register')) data = { idUsuario: '99', correo: body.correo, mensaje: 'Cuenta creada', correoEnviado: true };
          else if (route.endsWith('/auth/change-password')) {
            if (body.contrasenaActual !== 'Actual123!') { status = 400; text = 'Contraseña actual incorrecta'; }
            else { data = { mensaje: 'Contraseña actualizada' }; role = null; }
          }
          else if (route.endsWith('/estudiantes/perfil')) data = { nombres: 'Ana', apellidos: 'Pérez', ci: '123', ru: '456', correo: 'ana@umsa.bo', mencion: 'Sistemas' };
          else if (route.endsWith('/notificaciones/pendientes')) data = counts;
          else if (route.endsWith('/events')) { type = 'text/event-stream'; text = 'event: change\ndata: {}\n\n'; }
          else if (route.includes('/telegram')) data = { available: false, url: null };
          else if (route.endsWith('/fichas/tablero')) data = { jornadas: [], ultimosLlamados: [] };
        }
        await send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [
          { name: 'Content-Type', value: type }, { name: 'Access-Control-Allow-Origin', value: origin },
          { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' },
          { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
        ], body: Buffer.from(type === 'text/event-stream' ? text : JSON.stringify({ success: status < 400, data, message: text })).toString('base64') });
      } catch (error) { errors.push(String(error)); }
    });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    const waitFor = async expression => {
      for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await delay(100); }
      throw new Error('Timeout: ' + expression + '\n' + await evaluate('document.body.innerText'));
    };
    const go = async (route, selector) => { await send('Page.navigate', { url: origin + route }); await waitFor(`document.querySelector(${JSON.stringify(selector)})`); };
    const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    const fill = (selector, value) => evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    const submit = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).requestSubmit()`);
    const screenshot = async name => {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(shot.data, 'base64'));
    };
    await send('Runtime.enable'); await send('Page.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*' }] });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await go('/', '.campus-hero');
    assert.equal(await evaluate('document.querySelectorAll("[data-rotation], .campus-photo-controls").length'), 0);
    const position = await evaluate('(() => { const left = document.querySelector(".campus-photo-arrow-left").getBoundingClientRect(); const right = document.querySelector(".campus-photo-arrow-right").getBoundingClientRect(); return {left: left.left, right: right.right, width: document.documentElement.clientWidth}; })()');
    await screenshot('carrusel-posicion');
    assert.ok(position.left < 20 && position.right > position.width - 20, 'Flechas en los extremos: ' + JSON.stringify(position));
    await waitFor('document.querySelector(".campus-photos img.is-active")?.naturalWidth > 0');
    const initial = await evaluate('document.querySelector(".campus-photo-tabs [aria-pressed=true]").getAttribute("aria-label")');
    const started = Date.now();
    await waitFor(`document.querySelector('.campus-photo-tabs [aria-pressed=true]').getAttribute('aria-label') !== ${JSON.stringify(initial)}`);
    assert.ok(Date.now() - started < 6500, 'Avance automático de cinco segundos');
    await click('button[aria-label="Foto anterior"]');
    await waitFor(`document.querySelector('.campus-photo-tabs [aria-pressed=true]').getAttribute('aria-label') === ${JSON.stringify(initial)}`);
    await waitFor(`document.querySelector('.campus-photo-tabs [aria-pressed=true]').getAttribute('aria-label') !== ${JSON.stringify(initial)}`);
    await screenshot('carrusel-escritorio');
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false, 'Carrusel sin desborde móvil');
    await screenshot('carrusel-movil');

    await go('/registro', '#celular');
    assert.equal(await evaluate('document.querySelector("#celular").type'), 'tel');
    for (const [name, value] of Object.entries({ nombres: 'Ana', apellidos: 'Pérez', ci: '123', correo: 'ana@umsa.bo', ru: '456', contrasena: 'Nueva123!', confirmarContrasena: 'Nueva123!' })) await fill('#' + name, value);
    await evaluate('const select = document.querySelector("#mencion"); select.value = select.options[1].value; select.dispatchEvent(new Event("change", { bubbles: true }))');
    await submit('form');
    await waitFor('document.querySelector("#celular-error")');
    assert.equal(requests.filter(r => r.route.endsWith('/auth/register')).length, 0);
    await fill('#celular', '+591 7123-4567'); await submit('form');
    await waitFor('!document.querySelector("#celular")');
    assert.equal(requests.find(r => r.route.endsWith('/auth/register')).body.celular, '+59171234567');

    role = 'CONSULTA_INTERNA';
    await go('/usuario/perfil?seccion=seguridad', '#account-current-password');
    await fill('#account-current-password', 'Incorrecta123!');
    await fill('#account-new-password', 'Nueva123!');
    await fill('#account-confirm-password', 'Distinta123!');
    await submit('.account-settings__password form');
    await waitFor('document.body.innerText.includes("Las contraseñas no coinciden")');
    assert.equal(requests.filter(r => r.route.endsWith('/auth/change-password')).length, 0);
    await fill('#account-confirm-password', 'Nueva123!'); await submit('.account-settings__password form');
    await waitFor('document.body.innerText.includes("Contraseña actual incorrecta")');
    await screenshot('seguridad-estudiante');
    await fill('#account-current-password', 'Actual123!'); await submit('.account-settings__password form');
    await waitFor('location.pathname === "/usuario/password-actualizada"');
    assert.ok(await evaluate('document.body.innerText.includes("Tu contraseña ha sido actualizada correctamente")'));

    role = 'ADMINISTRADOR';
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await go('/admin/configuracion', '.admin-sidebar');
    await waitFor(`document.querySelector('a[aria-label^="9 solicitudes pendientes"]')`);
    for (const [key, count] of Object.entries(counts)) assert.ok(await evaluate(`document.querySelector('.admin-sidebar a[href="/admin/${key}"]').textContent.includes('${count}')`));
    counts = { 'solicitudes-aulas': 5, documentos: 1, fichas: 0 };
    await waitFor(`document.querySelector('a[aria-label^="6 solicitudes pendientes"]')`);
    assert.equal(await evaluate('location.pathname'), '/admin/configuracion', 'Actualiza sin entrar a las bandejas');
    await screenshot('avisos-escritorio');
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
    await screenshot('avisos-movil');
    await click('button[aria-label="Abrir menú"]');
    assert.ok(await evaluate(`Boolean(document.querySelector('.admin-sidebar a[href="/admin/documentos"] [aria-label="1 solicitudes pendientes"]'))`));

    await go('/admin/estudiantes?crear=1', '[role=dialog] input[type=tel]');
    assert.equal(await evaluate('document.querySelector("[role=dialog] input[type=tel]").required'), true);
    await go('/admin/subadministradores', '.admin-sidebar');
    await waitFor('[...document.querySelectorAll("button")].some(button => button.textContent === "Añadir subadministrador" && !button.disabled)');
    await evaluate('[...document.querySelectorAll("button")].find(button => button.textContent === "Añadir subadministrador").click()');
    await waitFor('document.querySelector("[role=dialog] input[type=tel]")');
    assert.equal(await evaluate('document.querySelector("[role=dialog] input[type=tel]").required'), true);
    assert.deepEqual(errors, []);
    console.log('OK: carrusel, celular en las tres altas, contraseña del estudiante y avisos automáticos en escritorio/móvil.');
  } finally { ws?.close(); chrome.kill(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
