// Browser smoke test with a simulated API; no real accounts or backend writes.
// Run from workspace root: node frontend/tests/schedule-planner.browser.cjs
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const root = path.resolve('frontend/dist');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const output = path.resolve('.preview-estudiantes/planner');
fs.mkdirSync(output, { recursive: true });
let userId = 'planner-test-a', authenticated = true, failCatalog = false;
const catalog = JSON.parse(fs.readFileSync('backend/src/modules/academico/data/planes-estudio.json', 'utf8'));
const today = new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 10);
const period = { id: 'test-period', nombre: 'Periodo de prueba', desde: today, hasta: today };
const errors = [];
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(root, pathname.startsWith('/assets/') || pathname.startsWith('/images/') ? pathname : 'index.html');
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(5194, '127.0.0.1', resolve));
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9344', '--user-data-dir=' + path.join(output, 'chrome'), 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let ws;
  try {
    let tabs;
    for (let i = 0; i < 40; i++) { try { tabs = await fetch('http://127.0.0.1:9344/json').then(r => r.json()); break; } catch { await delay(250); } }
    ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
    let id = 0; const pending = new Map();
    const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
    ws.addEventListener('message', async event => {
      const message = JSON.parse(event.data);
      if (message.id) { const p = pending.get(message.id); pending.delete(message.id); message.error ? p.reject(message.error) : p.resolve(message.result); return; }
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
      if (message.method !== 'Fetch.requestPaused') return;
      try {
        const { requestId, request } = message.params;
        const pathname = new URL(request.url).pathname;
        let data = [], code = 200;
        if (request.method !== 'OPTIONS') {
          if (pathname.endsWith('/auth/refresh')) { data = { accessToken: 'preview' }; if (!authenticated) code = 401; }
          else if (pathname.endsWith('/auth/me')) data = { idUsuario: userId, nombreCompleto: 'Estudiante Prueba', correo: 'test@example.test', roles: ['CONSULTA_INTERNA'], correoVerificado: true, debeCambiarPassword: false };
          else if (pathname.endsWith('/estudiantes/catalogo-horario')) { data = { ...catalog, periodos: [period] }; if (failCatalog) code = 503; }
          else if (pathname.endsWith('/documentos/mis-solicitudes')) data = { tipos: [], solicitudes: [] };
          else if (pathname.endsWith('/horarios')) errors.push('El planificador consulta la malla, no los horarios publicados');
        }
        await send('Fetch.fulfillRequest', { requestId, responseCode: code, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: 'http://127.0.0.1:5194' }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' }], body: Buffer.from(JSON.stringify({ success: code === 200, data })).toString('base64') });
      } catch (error) { errors.push(String(error)); }
    });
    const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    const waitFor = async expression => { for (let i = 0; i < 80; i++) { if (await evaluate(expression)) return; await delay(100); } throw new Error('Timeout: ' + expression + ' | ' + await evaluate('document.body.innerText')); };
    const click = async text => { await evaluate(`(() => { const b = [...document.querySelectorAll('main button')].find(b => b.textContent === ${JSON.stringify(text)}); if (!b) throw Error('Button missing'); b.click(); })()`); await delay(100); };
    const navigate = async () => { await send('Page.navigate', { url: 'http://127.0.0.1:5194/usuario/arma-tu-horario' }); await waitFor(`document.querySelector('.planner-timetable') !== null`); };
    const key = 'sgiac:student-schedules:v1:planner-test-a';
    const data = () => evaluate(`JSON.parse(localStorage.getItem('${key}'))`);
    await send('Runtime.enable'); await send('Page.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    const fill = async (selector, value) => {
      await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`);
      await delay(50);
    };
    const choose = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); await delay(100); };
    const noOverflow = async () => assert.equal(await evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth'), false, 'Sin desborde horizontal');
    const versions = async () => { if (!await evaluate(`document.querySelector('[aria-label="Versiones de mi horario"] details').open`)) await choose('[aria-label="Versiones de mi horario"] summary'); };
    const slot = async (day, start, end) => {
      await click('+ Añadir clase'); await waitFor(`!!document.querySelector('dialog[open]')`);
      await fill('#lesson-day', day); await fill('#lesson-start', start); if (end) await fill('#lesson-end', end);
    };
    const saveLesson = async () => { await click('Guardar clase'); await waitFor(`!document.querySelector('dialog')`); };
    const place = async (day, time) => choose(`[aria-label="Añadir materia: ${day}, ${time}"]`);
    const dashboard = async () => { await send('Page.navigate', { url: 'http://127.0.0.1:5194/usuario/dashboard' }); await waitFor(`document.body.innerText.includes('No tienes fichas pendientes')`); };
    await navigate(); await evaluate('localStorage.clear()'); await navigate();
    await waitFor(`!!document.querySelector('#planner-mention option[value="SOFTWARE"]')`);
    assert.equal(await evaluate(`document.querySelector('[aria-label="Versiones de mi horario"] details').open`), false);
    assert.equal(await evaluate(`document.querySelector('.planner-preferred button').disabled`), true);
    assert.equal(await evaluate(`document.querySelectorAll('.planner-hour-cell').length`), 90);
    await fill('#planner-mention', 'SOFTWARE'); await fill('#planner-semester', '1'); await fill('#planner-period', period.id);
    await waitFor(`document.querySelectorAll('.planner-catalog-list button').length > 1`);
    const catalogNames = await evaluate(`[...document.querySelectorAll('.planner-catalog-list strong')].map(s => s.textContent)`);
    await choose('.planner-catalog-list button');
    assert.equal((await data()).versions[0].subjects[0], catalogNames[0]);
    await click('Elegir día y hora'); await waitFor(`!!document.querySelector('dialog[open]')`);
    assert.equal(await evaluate(`document.querySelector('#lesson-subject').value`), catalogNames[0], 'Materia precargada, sin escribirla');
    assert.equal(await evaluate(`document.querySelector('dialog details').open`), false, 'Campos opcionales plegados');
    await fill('#lesson-day', 'LUNES'); await fill('#lesson-start', '08:00'); await fill('#lesson-end', '10:00');
    await saveLesson();
    assert.equal((await data()).versions[0].lessons[0].horaFin, '10:00');
    assert.equal(await evaluate(`document.querySelector('.planner-time-block').offsetHeight`), 172);
    await click('Usar como mi horario del semestre');
    assert.equal((await data()).preferredId, (await data()).activeId);
    await choose('.planner-catalog-list button:nth-child(2)');
    await slot('LUNES', '09:00', '10:00'); await saveLesson();
    assert.equal(await evaluate(`document.querySelectorAll('.has-conflict').length`), 2);
    assert.equal((await data()).preferredId, undefined, 'Los cruces invalidan el horario elegido');
    assert.equal(await evaluate(`document.querySelector('.planner-preferred button').disabled`), true);
    await choose('.planner-time-block.has-conflict:last-child');
    await fill('#lesson-day', 'MARTES'); await click('Guardar cambios');
    await waitFor(`document.querySelectorAll('.has-conflict').length === 0`);
    await fill('#planner-semester', '2');
    assert.equal((await data()).versions[0].subjects.length, 2, 'Cambiar de semestre conserva las materias');
    await click('Usar como mi horario del semestre');
    await dashboard();
    await waitFor(`!!document.querySelector('section[aria-label="Mi horario del semestre"]')`);
    assert.equal(await evaluate(`document.querySelectorAll('section[aria-label="Servicios del estudiante"] > a.card').length`), 5, 'Inicio anterior conservado');
    assert.ok(await evaluate(`document.querySelector('section[aria-label="Mi horario del semestre"]').textContent.includes('Periodo de prueba')`));
    await navigate();
    assert.equal(await evaluate(`document.querySelector('#planner-semester').value`), '2');
    assert.equal(await evaluate(`document.querySelectorAll('.planner-time-block').length`), 2);
    await fill('#subject-duration', '2'); await place('Miércoles', '10:00');
    assert.equal((await data()).versions[0].lessons[2].horaFin, '12:00');
    await place('Sábado', '21:00');
    assert.equal((await data()).versions[0].lessons.length, 3, 'No permite sobrepasar las 22:00');
    await versions(); await click('Duplicar versión'); await click('Cambiar nombre'); await fill('#version-name', 'Mi alternativa'); await click('Guardar nombre');
    const secondSubject = catalogNames[1];
    await evaluate('window.confirm = () => true'); await choose(`[aria-label="Eliminar ${secondSubject} de mi lista"]`);
    assert.equal((await data()).versions[0].lessons.length, 3);
    assert.equal((await data()).versions[1].lessons.length, 2, 'Eliminar en copia no afecta la original');
    assert.equal((await data()).versions[1].context.period.id, period.id);
    assert.equal((await data()).preferredId, (await data()).versions[0].id);
    await navigate(); assert.equal((await data()).versions[1].name, 'Mi alternativa');
    userId = 'planner-test-b'; await navigate();
    assert.equal(await evaluate(`document.querySelectorAll('.planner-time-block').length`), 0);
    await dashboard(); assert.equal(await evaluate(`!!document.querySelector('section[aria-label="Mi horario del semestre"]')`), false, 'No muestra la preferencia de otra cuenta');
    userId = 'planner-test-a'; failCatalog = true; await navigate();
    await waitFor(`document.body.innerText.includes('No pudimos cargar el catálogo')`);
    assert.equal(await evaluate(`document.querySelectorAll('.planner-time-block').length`), 2, 'El horario guardado funciona sin catálogo');
    failCatalog = false; await click('Reintentar'); await waitFor(`!!document.querySelector('#planner-mention option[value="SOFTWARE"]')`);
    await versions(); await evaluate('window.confirm = () => true'); await click('Eliminar versión');
    assert.equal((await data()).versions.length, 1);
    await evaluate(`window.originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function() { throw Error('QuotaExceeded'); }`);
    await click('+ Nueva versión'); await waitFor(`document.body.innerText.includes('No se pudieron guardar los últimos cambios')`);
    await evaluate('Storage.prototype.setItem = window.originalSetItem'); await click('Reintentar guardado');
    assert.equal((await data()).versions.length, 2);
    await choose('.planner-version');
    await evaluate(`(() => { const p = JSON.parse(localStorage.getItem('${key}')); p.versions[0].lessons.push({ idHorario: 99, materia: 'Clase anterior', dia: 'JUEVES', horaInicio: '08:00', horaFin: '09:30', docente: '', aula: '', grupo: '' }); localStorage.setItem('${key}', JSON.stringify(p)); })()`);
    await navigate();
    await choose('[aria-label="Editar Clase anterior, Jueves, 08:00 a 09:30"]');
    assert.equal(await evaluate(`document.querySelector('#lesson-end').value`), '09:30');
    assert.equal(await evaluate(`document.querySelector('#lesson-subject').value`), 'Clase anterior');
    await click('Guardar cambios'); await waitFor(`!document.querySelector('dialog')`);
    assert.ok((await data()).versions[0].subjects.includes('Clase anterior'));
    await noOverflow(); await evaluate(`document.querySelector('.planner-workspace').scrollIntoView()`); await delay(200);
    let shot = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, 'desktop.png'), Buffer.from(shot.data, 'base64'));
    for (const width of [390, 320]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true }); await navigate();
      await noOverflow();
      assert.equal(await evaluate(`document.querySelectorAll('.planner-day-column').length`), 1);
      assert.equal(await evaluate(`document.querySelector('.planner-timetable-scroll').scrollWidth <= document.querySelector('.planner-timetable-scroll').clientWidth`), true);
      await slot('SABADO', '20:00', '21:00'); await noOverflow();
      const viewport = await evaluate(`({ width: innerWidth, scale: visualViewport.scale, offset: visualViewport.offsetLeft, viewport: visualViewport.width, dialog: document.querySelector('dialog').getBoundingClientRect().toJSON() })`);
      assert.ok(viewport.dialog.left >= viewport.offset && viewport.dialog.right <= viewport.offset + viewport.viewport, 'Editor completo dentro de la pantalla');
      shot = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, `editor-${width}.png`), Buffer.from(shot.data, 'base64'));
      await click('Cancelar'); await fill('#planner-view-day', ''); await noOverflow();
      await evaluate(`document.querySelector('.planner-timetable-scroll').scrollLeft = 1000`);
      assert.ok(await evaluate(`document.querySelector('.planner-timetable-scroll').scrollLeft > 0`));
    }
    await evaluate(`localStorage.setItem('${key}', '{invalid')`); await send('Page.reload');
    await waitFor(`document.body.innerText.includes('No pudimos abrir tus horarios guardados')`);
    assert.equal(await evaluate(`localStorage.getItem('${key}')`), '{invalid');
    await evaluate('window.confirm = () => true'); await click('Reiniciar horarios locales'); await waitFor(`!!document.querySelector('.planner-timetable')`);
    authenticated = false; await send('Page.reload'); await waitFor(`location.pathname === '/login'`);
    assert.deepEqual(errors, []);
    console.log('PLANIFICADOR_OK: catálogo por mención/semestre, formulario sin escribir materia, edición, cruces, versiones, preferencia en inicio, guardado, aislamiento por cuenta, recuperación ante errores, datos antiguos y móvil 320/390 px.');
    await send('Browser.close');
  } finally { ws?.close(); chrome.kill(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
