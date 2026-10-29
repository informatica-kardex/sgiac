// Ejecutar desde la raíz: node frontend/tests/comunicados-gallery.browser.cjs
// Navegador real con API y sesión simuladas; no modifica comunicados reales.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const root = path.resolve('frontend/dist');
const output = path.resolve('.preview-comunicados/galeria');
fs.mkdirSync(output, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const testFiles = ['uno.png', 'dos.png', 'tres.png'].map((name, i) => {
  const file = path.join(output, name);
  fs.copyFileSync(path.join(root, 'images', i === 1 ? 'informatica-umsa.png' : 'kardex.png'), file);
  return file;
});
let session = 'admin', records, origin, chrome, ws;
let attachmentId = 3;
const mutations = [], errors = [];
const attachment = (id, nombre) => ({ idAdjunto: String(id), nombre, tipo: 'image/png', url: `${origin}/images/${id % 2 ? 'kardex.png' : 'informatica-umsa.png'}` });
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.resolve(root, '.' + (/^\/(assets|images)\//.test(pathname) ? pathname : '/index.html'));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  records = [{ idComunicado: '1', titulo: 'Comunicado con varias imágenes', tipo: 'imagen', contenido: 'Información de la Carrera de Informática.', resumen: '', categoria: 'Académico', estado: 'publicado', fechaPublicacion: '2026-10-14T12:00:00.000Z', adjuntos: [attachment(1, 'portada.png'), attachment(2, 'informacion.png')] }];
  chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9361', '--user-data-dir=' + path.join(output, 'chrome'), 'about:blank'], { stdio: 'ignore', windowsHide: true });
  chrome.on('error', error => errors.push(error.message));
  let tabs;
  for (let i = 0; i < 60; i++) { try { tabs = await fetch('http://127.0.0.1:9361/json').then(r => r.json()); break; } catch { await delay(150); } }
  assert.ok(tabs, 'Chrome debe iniciar');
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  ws.addEventListener('message', async event => {
    const message = JSON.parse(event.data);
    if (message.id) { const item = pending.get(message.id); pending.delete(message.id); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); return; }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.method !== 'Fetch.requestPaused') return;
    try {
      const { request, requestId } = message.params;
      const route = new URL(request.url).pathname;
      let data = [], status = 200;
      if (route.endsWith('/auth/refresh')) { status = session ? 200 : 401; data = { accessToken: 'preview-token' }; }
      else if (route.endsWith('/auth/me')) data = { idUsuario: '1', nombreCompleto: 'Usuario de prueba', roles: [session === 'admin' ? 'ADMINISTRADOR' : 'ESTUDIANTE'], correoVerificado: true, debeCambiarPassword: false, permisos: [] };
      else if (route.includes('/comunicados')) {
        if (['POST', 'PUT'].includes(request.method)) {
          const entries = await evaluate('window.__ultimoFormulario');
          const fields = Object.fromEntries(entries.filter(e => e[0] !== 'archivo'));
          const names = entries.filter(e => e[0] === 'archivo').map(e => e[1]);
          mutations.push({ method: request.method, fields, names });
          const index = request.method === 'POST' ? records.length : records.findIndex(r => r.idComunicado === route.split('/').at(-1));
          const old = records[index];
          const removed = JSON.parse(fields.adjuntosEliminar || '[]');
          data = { ...records[0], ...old, ...fields, idComunicado: old?.idComunicado || String(index + 1), adjuntos: [...(old?.adjuntos || []).filter(a => !removed.includes(a.idAdjunto)), ...names.map(name => attachment(attachmentId++, name))] };
          records[index] = data;
        } else data = route.endsWith('/comunicados') ? records : records.find(r => r.idComunicado === route.split('/').at(-1));
      } else if (route.endsWith('/telegram')) data = { available: false, url: null };
      await send('Fetch.fulfillRequest', { requestId, responseCode: request.method === 'OPTIONS' ? 204 : status, responseHeaders: [
        { name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,OPTIONS' },
      ], body: Buffer.from(JSON.stringify({ success: status < 400, data })).toString('base64') });
    } catch (error) { errors.push(error.message); }
  });
  const wait = async expression => {
    for (let i = 0; i < 90; i++) { if (await evaluate(expression)) return; await delay(100); }
    throw new Error('No se cumplió: ' + expression + '\n' + await evaluate('document.body.innerText'));
  };
  const click = async label => { await wait(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === ${JSON.stringify(label)})`); await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`); };
  const clickAria = label => evaluate(`document.querySelector('button[aria-label=${JSON.stringify(label)}]').click()`);
  const field = (name, value) => evaluate(`(() => { const el = document.querySelector('[name=${JSON.stringify(name)}]'); const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`);
  const upload = async files => { const { root } = await send('DOM.getDocument'); const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' }); await send('DOM.setFileInputFiles', { nodeId, files }); };
  const navigate = async route => { await send('Page.navigate', { url: origin + route }); await wait('!!document.querySelector("main h1")'); };
  const screenshot = async name => { await delay(500); const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(result.data, 'base64')); };
  const counter = () => evaluate('document.querySelector(".comunicado-carrusel-contador")?.textContent');
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `const send = XMLHttpRequest.prototype.send; XMLHttpRequest.prototype.send = function(body) { if (body instanceof FormData) window.__ultimoFormulario = [...body].map(([key, value]) => [key, value instanceof File ? value.name : value]); return send.call(this, body); };` });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*' }] });
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });

  await navigate('/admin/comunicados'); await click('Editar');
  await wait('document.querySelectorAll("[data-adjunto-id]").length === 2');
  assert.equal(await evaluate('document.querySelector("input[type=file]").multiple'), true);
  await clickAria('Retirar portada.png');
  await upload(testFiles.slice(0, 2));
  await wait('document.querySelectorAll("[data-nuevo-archivo]").length === 2');
  await screenshot('admin-imagenes');
  await clickAria('Retirar dos.png');
  await click('Guardar');
  await wait('!document.querySelector("[role=dialog]")');
  assert.deepEqual(mutations[0].names, ['uno.png']);
  assert.deepEqual(JSON.parse(mutations[0].fields.adjuntosEliminar), ['1']);
  assert.equal(records[0].adjuntos[0].idAdjunto, '2');
  await click('Editar'); await wait('document.querySelectorAll("[data-adjunto-id]").length === 2');
  await clickAria('Retirar informacion.png'); await clickAria('Retirar uno.png');
  await click('Guardar'); await wait('document.body.innerText.includes("Añade al menos una imagen")');
  assert.equal(mutations.length, 1);
  await click('Cancelar'); await click('Editar');
  await wait('document.querySelectorAll("[data-adjunto-id]").length === 2');
  await click('Cancelar');
  await click('+ Nuevo comunicado'); await field('tipo', 'imagen'); await field('titulo', 'Comunicado de galería nuevo'); await field('categoria', 'Académico');
  await upload([testFiles[0]]); await wait('document.querySelectorAll("[data-nuevo-archivo]").length === 1');
  await upload([testFiles[1]]); await wait('document.querySelectorAll("[data-nuevo-archivo]").length === 2');
  await click('Guardar'); await wait('!document.querySelector("[role=dialog]")');
  assert.deepEqual(mutations[1].names, ['uno.png', 'dos.png']);
  console.log('OK: añadir por partes, retirar imágenes nuevas y guardadas, cancelar cambios y exigir una imagen.');

  session = null;
  await navigate('/comunicados/1'); await wait('!!document.querySelector(".comunicado-carrusel-contador")');
  await wait('document.querySelector(".comunicado-carrusel-contador").textContent === "2 / 2"');
  await wait('document.querySelector(".comunicado-carrusel-contador").textContent === "1 / 2"');
  await clickAria('Pausar carrusel'); await delay(5200); assert.equal(await counter(), '1 / 2');
  await clickAria('Imagen siguiente'); assert.equal(await counter(), '2 / 2');
  assert.ok((await evaluate('document.querySelector(".comunicado-descarga").href')).includes('kardex.png'));
  await clickAria('Imagen anterior'); assert.equal(await counter(), '1 / 2');
  await clickAria('Ir a imagen 2'); assert.equal(await counter(), '2 / 2');
  await evaluate(`document.querySelector('button[aria-label="Imagen siguiente"]').focus()`);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowLeft', code: 'ArrowLeft' });
  assert.equal(await counter(), '1 / 2');
  await screenshot('detalle-escritorio');
  console.log('OK: avance automático, vuelta al inicio, pausa, flechas, indicadores, teclado y descarga de imagen activa.');

  await navigate('/comunicados'); await wait('document.querySelectorAll(".comunicado-card .comunicado-carrusel").length === 2');
  assert.equal(await evaluate('document.querySelectorAll("a button").length'), 0);
  await clickAria('Imagen siguiente'); assert.equal(await counter(), '2 / 2');
  assert.equal(await evaluate('location.pathname'), '/comunicados');
  await screenshot('tarjetas');
  session = 'student'; await navigate('/usuario/comunicados/1'); await wait('!!document.querySelector(".comunicado-carrusel-contador")');
  session = null;
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate('/comunicados/1'); await wait('!!document.querySelector(".comunicado-carrusel-contador")');
  assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'));
  await screenshot('detalle-movil');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await navigate('/comunicados/1'); await wait('!!document.querySelector(".comunicado-carrusel-contador")');
  await delay(5200); assert.equal(await counter(), '1 / 2');
  assert.equal(await evaluate('document.querySelector(".comunicado-carrusel-pausa")'), null);
  await clickAria('Imagen siguiente'); assert.equal(await counter(), '2 / 2');
  records[0].adjuntos = records[0].adjuntos.slice(0, 1);
  await navigate('/comunicados/1'); await wait('!!document.querySelector(".comunicado-carrusel img")');
  assert.equal(await evaluate('document.querySelector(".comunicado-carrusel-controles")'), null);
  assert.equal(await evaluate('document.querySelector(".comunicado-carrusel-flecha")'), null);
  assert.deepEqual(errors, []);
  console.log('OK: tarjetas, portal de estudiante, móvil, movimiento reducido e imagen única sin controles.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  ws?.close(); chrome?.kill(); await new Promise(resolve => server.close(resolve));
});
