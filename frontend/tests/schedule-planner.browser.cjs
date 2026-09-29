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
let userId = 'planner-test-a', authenticated = true;
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
          else if (pathname.endsWith('/horarios')) errors.push('Manual planner should not request the catalog');
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
    const slot = async (day, time) => {
      await click('+ Clase manual');
      await waitFor(`document.querySelector('dialog[open]') !== null`);
      await evaluate(`document.querySelectorAll('dialog select')[0].id = 'test-day'; document.querySelectorAll('dialog select')[1].id = 'test-start'`);
      const dayValue = await evaluate(`[...document.querySelector('#test-day').options].find(o => o.textContent === ${JSON.stringify(day)}).value`);
      await fill('#test-day', dayValue); await fill('#test-start', time);
    };
    const saveLesson = async () => { await evaluate(`document.querySelector('dialog form').requestSubmit()`); await waitFor(`!document.querySelector('dialog')`); };
    await navigate(); await evaluate('localStorage.clear()'); await navigate();
    const addSubject = async name => { await fill('#planned-subject', name); await click('+ Agregar a mi lista'); };
    const place = async (day, time) => { await evaluate(`document.querySelector('[aria-label="Añadir materia: ${day}, ${time}"]').click()`); await delay(100); };
    await addSubject('Programación I'); await addSubject('Álgebra'); await addSubject('Materia pendiente');
    await evaluate(`document.querySelector('[aria-label="Seleccionar Programación I"]').click()`);
    await place('Lunes', '07:00');
    assert.equal(await evaluate(`!!document.querySelector('dialog')`), false);
    assert.equal((await data()).versions[0].lessons[0].materia, 'Programación I');
    await evaluate(`document.querySelector('[aria-label="Seleccionar Álgebra"]').click()`);
    await fill('#subject-duration', '2'); await place('Lunes', '08:00');
    assert.equal((await data()).versions[0].lessons[1].horaFin, '10:00');
    await place('Miércoles', '10:00');
    assert.equal((await data()).versions[0].lessons.length, 3);
    await place('Sábado', '21:00');
    assert.equal((await data()).versions[0].lessons.length, 3);
    await waitFor(`document.body.textContent.includes('La clase terminaría después de las 22:00')`);
    await navigate();
    assert.equal(await evaluate(`document.querySelectorAll('.planner-subject-card').length`), 3);
    assert.equal((await data()).versions[0].subjects.includes('Materia pendiente'), true);
    await click('Duplicar versión');
    assert.equal((await data()).versions[1].subjects.length, 3);
    await evaluate(`window.confirm = () => true; document.querySelector('[aria-label="Eliminar Álgebra de mi lista"]').click()`); await delay(100);
    assert.equal((await data()).versions[1].lessons.length, 1);
    assert.equal((await data()).versions[0].lessons.length, 3);
    assert.equal((await data()).versions[1].subjects.length, 2);
    userId = 'planner-test-b'; await navigate();
    assert.equal(await evaluate(`document.querySelectorAll('.planner-subject-card').length`), 0);
    userId = 'planner-test-a'; await navigate();
    await evaluate('localStorage.clear()'); await navigate();
    assert.equal(await evaluate(`document.querySelectorAll('.planner-hour-cell').length`), 90);
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('.planner-day-heading')].map(h => h.textContent)`), ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']);
    assert.equal(await evaluate(`document.querySelector('.planner-time-axis').lastElementChild.textContent`), '22:00');
    await slot('Lunes', '07:00'); await fill('dialog input', 'Programación I'); await saveLesson();
    assert.equal((await data()).versions[0].lessons[0].horaInicio, '07:00');
    await slot('Lunes', '08:00'); await fill('dialog input', 'Álgebra');
    await evaluate(`document.querySelectorAll('dialog select')[2].id = 'test-end'`); await fill('#test-end', '10:00'); await saveLesson();
    assert.equal((await data()).versions[0].lessons[1].horaFin, '10:00');
    assert.equal(await evaluate(`document.querySelectorAll('.has-conflict').length`), 0);
    assert.equal(await evaluate(`document.querySelectorAll('.planner-time-block')[1].offsetHeight`), 172);
    await slot('Sábado', '21:00'); await fill('dialog input', 'Taller'); await saveLesson();
    assert.equal((await data()).versions[0].lessons[2].horaFin, '22:00');
    await slot('Lunes', '09:00'); await fill('dialog input', 'Física'); await saveLesson();
    assert.equal(await evaluate(`document.querySelectorAll('.has-conflict').length`), 2);
    await evaluate(`document.querySelector('.planner-time-block').click()`); await fill('dialog input', 'Programación avanzada'); await saveLesson();
    assert.equal((await data()).versions[0].lessons[0].materia, 'Programación avanzada');
    await click('Duplicar versión'); await click('Cambiar nombre');
    await fill('#version-name', 'Plan manual'); await click('Guardar nombre');
    await evaluate(`window.confirm = () => true; document.querySelector('.planner-time-block').click()`);
    if (await evaluate(`!!document.querySelector('dialog')`)) await evaluate(`[...document.querySelectorAll('dialog button')].find(b => b.textContent === 'Eliminar clase').click()`);
    await waitFor(`!document.querySelector('dialog')`);
    assert.equal((await data()).versions[0].lessons.length, 4);
    assert.equal((await data()).versions[1].lessons.length, 3);
    await navigate();
    assert.equal(await evaluate(`document.querySelectorAll('.planner-time-block').length`), 3);
    assert.equal((await data()).versions[1].name, 'Plan manual');
    userId = 'planner-test-b'; await navigate();
    assert.equal(await evaluate(`document.querySelectorAll('.planner-time-block').length`), 0);
    userId = 'planner-test-a'; await navigate();
    assert.equal(await evaluate(`document.querySelectorAll('.planner-time-block').length`), 3);
    await evaluate(`window.confirm = () => true`); await click('Eliminar versión');
    assert.equal((await data()).versions.length, 1);
    await evaluate(`window.originalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function() { throw Error('QuotaExceeded'); }`);
    await click('+ Nueva versión');
    await waitFor(`document.body.textContent.includes('No se pudieron guardar los últimos cambios')`);
    await evaluate(`Storage.prototype.setItem = window.originalSetItem`); await click('Reintentar guardado');
    assert.equal((await data()).versions.length, 2);
    await evaluate(`document.querySelector('.planner-version').click()`); await delay(100);
    // Existing versions with half-hour classes remain readable and editable.
    await evaluate(`(() => { const p = JSON.parse(localStorage.getItem('${key}')); p.versions[0].lessons.push({ idHorario: 99, materia: 'Clase anterior', dia: 'MARTES', horaInicio: '08:00', horaFin: '09:30', docente: '', aula: '', grupo: '' }); localStorage.setItem('${key}', JSON.stringify(p)); })()`);
    await navigate();
    assert.equal(await evaluate(`document.querySelector('[aria-label="Editar Clase anterior, Martes, 08:00 a 09:30"]').offsetHeight`), 128);
    await evaluate(`document.querySelector('.planner-stats').scrollIntoView()`); await delay(150);
    const desktop = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, 'desktop.png'), Buffer.from(desktop.data, 'base64'));
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false);
    await evaluate(`document.querySelector('.planner-timetable-scroll').scrollLeft = 1000`);
    assert.ok(await evaluate(`document.querySelector('.planner-timetable-scroll').scrollLeft > 0`));
    await evaluate(`document.querySelector('.planner-stats').scrollIntoView()`); await delay(100);
    const mobile = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, 'mobile.png'), Buffer.from(mobile.data, 'base64'));
    await slot('Sábado', '20:00');
    assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false);
    await evaluate(`[...document.querySelectorAll('dialog button')].find(b => b.textContent === 'Cancelar').click()`);
    await evaluate(`localStorage.setItem('${key}', '{invalid')`); await send('Page.reload');
    await waitFor(`document.body.textContent.includes('No pudimos abrir tus horarios guardados')`);
    assert.equal(await evaluate(`localStorage.getItem('${key}')`), '{invalid');
    await evaluate(`window.confirm = () => true`); await click('Reiniciar horarios locales');
    await waitFor(`document.querySelector('.planner-timetable') !== null`);
    authenticated = false; await send('Page.reload');
    await waitFor(`location.pathname === '/login'`);
    assert.equal(await evaluate(`!!document.querySelector('a[href="/usuario/arma-tu-horario"]')`), false);
    assert.deepEqual(errors, []);
    console.log('PASS: 90 hourly cells, horizontal days, 07:00–22:00, manual creation, multi-hour blocks, edit, delete, conflicts, versions, persistence, account isolation, quota errors, legacy data, mobile scrolling and guest access.');
    await send('Browser.close');
  } finally { ws?.close(); chrome.kill(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
