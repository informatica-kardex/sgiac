// Desde la raíz: node frontend/tests/auxiliar-carnet.browser.cjs
// Frontend y backend compilados, API simulada y Chrome. No modifica datos del sistema.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const express = require('../../backend/node_modules/express');
const helmet = require('../../backend/node_modules/helmet');
const { frontendProduccion } = require('../../backend/dist/frontend');
const root = path.resolve('frontend/dist'), output = path.resolve('.preview-academico/carnets');
fs.mkdirSync(output, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let token = '7.' + 'A'.repeat(43);
let email = 'ana@umsa.bo';
let session = 'admin', status = 200, chrome, ws, name = 'Ana María Pérez';
let habilitado = true, ownStatus = 200;
const errors = [], requests = [];
const originalSchedule = { id: '20', idAsignacion: '23', aula: 'A-101', dia: 'LUNES', fecha: null, horaInicio: '08:00', horaFin: '10:00', lugar: 'INFORMATICA', piso: 1, materia: 'Programación', grupo: 'A', periodo: 'II/2026', desde: '2026-07-01', hasta: '2026-12-20' };
let schedules = [originalSchedule];
const firstAssignment = { idAsignacion: '23', idDocente: '4', codigoMateria: 'INF-111', siglas: ['INF-111'], materia: 'Programación', docente: 'Lic. Docente Uno', grupo: 'A', idPeriodo: '3', periodo: 'II/2026', estado: 'ACTIVO', desde: '2026-07-01', hasta: '2026-12-20' };
const secondAssignment = { ...firstAssignment, idAsignacion: '24', idDocente: '5', codigoMateria: 'INF-112', siglas: ['INF-112'], materia: 'Fundamentos digitales', docente: 'Lic. Docente Dos', grupo: 'B' };
let assignments = [firstAssignment];
let printedSubjects = null;
const cardSubjects = () => printedSubjects ?? [...new Set(assignments.map(a => a.materia))];
const lesson = { idHorario: 1, ...firstAssignment, aula: 'SS-A1', dia: 'LUNES', horaInicio: '08:00', horaFin: '10:00', responsable: 'Lic. Docente Uno', esAuxiliar: false, esCoordinacion: false, lugar: 'INFORMATICA', piso: -1, fecha: null, motivo: '', idAuxiliar: null };
let classStatus = 200;
const classroom = (codigo, piso = -1, lugar = 'INFORMATICA') => ({ codigo, nombre: codigo, piso, lugar });
let classRooms = [classroom('LASIN-1', 1, 'LASIN'), classroom('PB-A1', 0), classroom('SS-A10'), classroom('SS-A2'), classroom('SS-A1'), classroom('SS-A3'), classroom('P1-A1', 1), ...Array.from({ length: 12 }, (_, i) => classroom(`P2-A${i + 1}`, 2))];
let classPeriods = [
  { idPeriodo: '4', periodo: 'I', gestion: 2100, fechaInicio: '2100-01-01', fechaFin: '2100-06-30', estado: 'ACTIVO' },
  { idPeriodo: '3', periodo: 'II', gestion: 2026, fechaInicio: '2001-01-01', fechaFin: '2099-12-31', estado: 'ACTIVO' },
  { idPeriodo: '2', periodo: 'I', gestion: 2000, fechaInicio: '2000-01-01', fechaFin: '2000-06-30', estado: 'ACTIVO' },
];
let classSchedules = [lesson,
  { ...lesson, idHorario: 2, grupo: 'B', aula: 'LASIN-1', dia: 'MARTES', horaInicio: '14:00', horaFin: '16:00', lugar: 'LASIN', responsable: 'Ana María Pérez', esAuxiliar: true },
  { ...lesson, ...secondAssignment, idHorario: 3, dia: 'MIERCOLES', responsable: 'Lic. Docente Dos', aula: 'SS-A2' },
  { ...lesson, idHorario: 4, materia: 'Curso preuniversitario', codigoMateria: 'CPU', siglas: ['CPU'], responsable: 'Coordinador', esCoordinacion: true },
  { ...lesson, idHorario: 5, idPeriodo: '2', periodo: 'I/2000', responsable: 'Docente del periodo anterior' },
  { ...lesson, idHorario: 6, aula: 'SS-A2', dia: 'SABADO', fecha: '2099-11-14', responsable: 'Reserva futura' },
  { ...lesson, idHorario: 7, fecha: '2000-01-01', responsable: 'Reserva vencida' },
];
const perfil = () => ({ habilitado, datos: habilitado ? { nombre: name, ci: '987654', ru: '123456', correo: 'ana@umsa.bo', celular: '71234567' } : null, asignaciones: habilitado ? assignments : [] });
const solicitudes = [firstAssignment, secondAssignment].map((asignacion, i) => ({ id: String(i + 1), codigo: `AUL-00000${i + 1}`, estado: 'PENDIENTE', version: 1, nombre: name, ci: '987654', ru: '123456', correo: 'ana@umsa.bo', celular: '71234567', numeroEstudiantes: 20, actividad: 'CLASE_TEORICA', detalle: '', reserva: { aula: i ? 'B-202' : 'A-101', agenda: { alcance: 'SEMESTRE', sesiones: [{ dia: 'LUNES', fecha: null, horaInicio: '08:00', horaFin: '10:00' }] } }, propuesta: null, asignacion, creadaEn: '2026-11-09T12:00:00Z', actualizadaEn: '2026-11-09T12:00:00Z', historial: [] }));
const app = express();
app.use(helmet());
app.use((req, res, next) => {
  const route = new URL(req.url, 'http://localhost').pathname;
  if (route === '/pdfjs.mjs' || route === '/pdf.worker.mjs') {
    res.setHeader('Content-Type', 'text/javascript');
    return res.end(fs.readFileSync(path.resolve('frontend/node_modules/pdfjs-dist/build', route === '/pdfjs.mjs' ? 'pdf.mjs' : 'pdf.worker.mjs')));
  }
  next();
});
app.use(frontendProduccion(root, false));
app.use((_req, res) => res.sendStatus(404));
const server = http.createServer(app);
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9391', '--user-data-dir=' + path.join(output, 'chrome'), 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let tabs;
  for (let i = 0; i < 100; i++) { try { tabs = await fetch('http://127.0.0.1:9391/json').then(r => r.json()); break; } catch { await delay(100); } }
  assert.ok(tabs, 'Chrome debe iniciar');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  ws.addEventListener('message', async event => {
    const m = JSON.parse(event.data);
    if (m.id) { const item = pending.get(m.id); pending.delete(m.id); m.error ? item.reject(new Error(m.error.message)) : item.resolve(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text);
    if (m.method !== 'Fetch.requestPaused') return;
    try {
      const { request, requestId } = m.params;
      const route = new URL(request.url).pathname;
      requests.push({ route, origin: new URL(request.url).origin, headers: request.headers });
      let data = [], code = 200, message = 'OK';
      if (route.endsWith('/auth/refresh')) { code = session ? 200 : 401; data = { accessToken: 'preview-token', session: { id: 1, expiresAt: Date.now() + 3600000 } }; }
      else if (route.endsWith('/auth/me')) data = { idUsuario: session === 'admin' ? '1' : '44', nombreCompleto: session === 'admin' ? 'Administrador de prueba' : name, correo: 'ana@umsa.bo', roles: [session === 'admin' ? 'ADMINISTRADOR' : 'CONSULTA_INTERNA'], correoVerificado: true, debeCambiarPassword: false, permisos: [] };
      else if (route.endsWith('/auth/activity')) data = { session: { id: 1, expiresAt: Date.now() + 3600000 } };
      else if (route.includes('/auxiliares/carnet/')) { code = status; message = status === 404 ? 'Este carnet no está disponible. Consulta con Kardex.' : 'No se pudo conectar.'; data = { nombreCompleto: name, horarios: schedules, consultadoEn: new Date().toISOString() }; }
      else if (route.endsWith('/auxiliares/7/carnet')) data = { idAuxiliar: '7', nombreCompleto: name, ru: '123456', correo: email, token, materias: cardSubjects() };
      else if (route.endsWith('/academico/auxiliares')) data = [{ idAuxiliar: '7', idEstudiante: '12', idUsuario: '44', nombreCompleto: name, correo: 'ana@umsa.bo', telefono: '', ru: '123456', estado: 'ACTIVO', cuentaActiva: true, asignaciones: [] }];
      else if (route.endsWith('/estudiantes/auxiliatura/carnet')) { code = habilitado ? 200 : 403; data = { idAuxiliar: '7', nombreCompleto: name, ru: '123456', correo: email, token, materias: cardSubjects() }; }
      else if (route.endsWith('/estudiantes/auxiliatura')) { code = ownStatus; message = 'No se pudo consultar tu auxiliatura.'; data = { perfil: perfil(), horarios: habilitado ? schedules : [] }; }
      else if (route.endsWith('/solicitudes-aulas/perfil')) data = perfil();
      else if (route.endsWith('/solicitudes-aulas/mias')) data = solicitudes;
      else if (route.endsWith('/estudiantes/perfil')) data = { nombres: 'Ana María', apellidos: 'Pérez', ci: '987654', ru: '123456', correo: 'ana@umsa.bo', mencion: 'Sistemas' };
      else if (route.endsWith('/documentos/mis-solicitudes')) data = { solicitudes: [], tipos: [] };
      else if (route === '/api/estudiantes/horarios-aulas') { code = classStatus; data = { aulas: classRooms, periodos: classPeriods, horarios: classSchedules }; }
      await send('Fetch.fulfillRequest', { requestId, responseCode: request.method === 'OPTIONS' ? 204 : code, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' }], body: Buffer.from(JSON.stringify({ success: code < 400, message, data })).toString('base64') });
    } catch (e) { errors.push(e.message); }
  });
  const wait = async expression => { for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await delay(100); } throw new Error('Espera agotada: ' + expression + '\n' + await evaluate('document.body.innerText')); };
  const click = async label => { await wait(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === ${JSON.stringify(label)})`); await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`); };
  const screenshot = async name => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(r.data, 'base64')); };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "window.__cspErrors = []; document.addEventListener('securitypolicyviolation', e => window.__cspErrors.push(e.violatedDirective + ': ' + e.blockedURI));" });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*' }] });
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: origin + '/admin/auxiliares' });
  await click('Carnet y QR');
  await wait(`document.querySelectorAll('canvas').length === 2 && [...document.querySelectorAll('canvas')].every(c => c.getBoundingClientRect().width > 0)`);
  assert.equal(await evaluate(`document.querySelector('a[download]').download`), 'carnet-auxiliar-7.pdf');
  const qrLink = await evaluate(`[...document.querySelectorAll('a')].find(a => a.textContent === 'Ver horario público').href`);
  assert.equal(qrLink, origin + '/auxiliares/carnet/' + token);
  const logo = await evaluate(`(async () => {
    const image = new Image(); image.src = '/images/kardex.png'; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0, opaque = 0;
    for (let i = 3; i < pixels.length; i += 4) { if (pixels[i] === 0) transparent++; if (pixels[i] >= 250) opaque++; }
    return { cornerAlpha: pixels[3], transparent, opaque };
  })()`);
  assert.equal(logo.cornerAlpha, 0, 'El nuevo logo tiene fondo transparente');
  assert.ok(logo.transparent > 100000 && logo.opaque > 100000, 'Conserva el logo y elimina el fondo');
  await screenshot('carnet-escritorio');
  const pdfData = await evaluate(`(async () => {
    const blob = await (await fetch(document.querySelector('a[download]').href)).blob();
    return new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(blob); });
  })()`);
  fs.writeFileSync(path.join(output, 'carnet-muestra.pdf'), Buffer.from(pdfData, 'base64'));
  const checkPdf = () => evaluate(`(async () => {
    const pdfjs = await import('/pdfjs.mjs'); pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
    const url = document.querySelector('a[download]').href;
    const task = pdfjs.getDocument({ url }); const pdf = await task.promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p); const content = await page.getTextContent(); const ops = await page.getOperatorList();
      pages.push({ size: page.view, text: content.items.map(i => i.str).join(' '),
        items: content.items.map(i => ({ text: i.str, x: i.transform[4], width: i.width })),
        images: ops.fnArray.filter(op => op === pdfjs.OPS.paintImageXObject).length });
    }
    await task.destroy(); return pages;
  })()`);
  let pages = await checkPdf();
  assert.equal(pages.length, 2, 'El PDF contiene exactamente las dos caras');
  assert.ok(pages[0].text.includes(name));
  assert.ok(pages[0].text.includes('123456'));
  assert.ok(pages[0].text.includes('Programación'), 'La materia aparece impresa en el frente');
  assert.ok(pages[1].text.includes('ESCANEA'));
  assert.ok(Math.abs(pages[0].size[2] - 85.6 * 72 / 25.4) < .1);
  assert.equal(pages[0].images, 2, 'El carnet incorpora los logos de Kardex y de la carrera');
  const nameItems = pages[0].items.filter(item => name.includes(item.text) && item.text.trim());
  const nameStart = Math.min(...nameItems.map(item => item.x));
  const nameEnd = Math.max(...nameItems.map(item => item.x + item.width));
  assert.ok(Math.abs((nameStart + nameEnd) / 2 - pages[0].size[2] / 2) < 1, 'El nombre queda centrado en el carnet');
  // Los visores existentes de impresión usan iframes con URL blob del PDF.
  await evaluate(`(() => { const frame = document.createElement('iframe'); frame.id = 'print-preview-test'; frame.src = document.querySelector('a[download]').href; document.body.append(frame); })()`);
  await delay(500);
  assert.deepEqual(await evaluate('window.__cspErrors'), [], 'La política de producción permite generar y visualizar el PDF');
  await evaluate(`document.getElementById('print-preview-test').remove()`);
  // Nombres al máximo de longitud admitida por el registro del estudiante.
  await click('Cerrar');
  name = 'W'.repeat(120) + ' ' + 'W'.repeat(120);
  email = 'w'.repeat(64) + '@' + 'w'.repeat(63) + '.umsa.bo';
  token = '123456789012345678.' + 'A'.repeat(43);
  printedSubjects = Array.from({ length: 5 }, (_, i) => `Materia ${i} ${'W'.repeat(180)}`);
  await click('Carnet y QR'); await wait(`!!document.querySelector('a[download]')`);
  pages = await checkPdf(); assert.equal(pages.length, 2, 'Nombres, correos y referencias largos no crean una tercera cara: ' + pages.map(p => p.text).join(' | '));
  printedSubjects = null;
  name = 'Ana María Pérez';
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await screenshot('carnet-movil');
  session = false;
  await send('Page.navigate', { url: qrLink });
  await wait(`document.body.innerText.includes('Aula A-101')`);
  assert.equal(await evaluate(`!!document.querySelector('nav')`), false, 'Consulta independiente del portal');
  assert.equal(await evaluate(`document.querySelector('meta[name=robots]').content`), 'noindex, nofollow, noarchive');
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, 'Sin desbordamiento en celular');
  assert.equal(await evaluate(`document.body.innerText.includes('123456') || document.body.innerText.includes('ana@umsa.bo')`), false);
  await screenshot('consulta-qr-movil');
  assert.ok(requests.filter(r => r.route.includes('/auxiliares/carnet/')).every(r => !Object.keys(r.headers).some(k => ['authorization', 'cookie'].includes(k.toLowerCase()))));
  assert.ok(requests.every(r => r.origin === origin), 'La compilación de producción consulta la API en el dominio real, sin localhost fijo');
  schedules = [{ ...schedules[0], aula: 'LASIN-2', horaInicio: '14:00', horaFin: '16:00', fecha: '2026-11-16' }];
  // Refresco automático al volver a la pestaña, sin cambiar el enlace.
  await evaluate(`window.dispatchEvent(new Event('focus'))`);
  await wait(`document.body.innerText.includes('Aula LASIN-2') && document.body.innerText.includes('14:00')`);
  assert.equal(await evaluate('location.href'), qrLink);
  status = 503; await click('Actualizar horario'); await wait(`!!document.querySelector('[role=alert]')`);
  assert.equal(await evaluate(`document.body.innerText.includes('Aula LASIN-2')`), false, 'No muestra una asignación antigua como vigente al fallar');
  status = 200; schedules = []; await click('Reintentar'); await wait(`document.body.innerText.includes('Sin horarios asignados')`);
  status = 404; await click('Actualizar horario'); await wait(`document.body.innerText.includes('Este carnet no está disponible')`);
  await send('Page.navigate', { url: origin + '/' }); await wait(`!!document.querySelector('nav')`);
  await wait(`document.querySelector('.kardex-brand img')?.complete`);
  await screenshot('logo-portal-movil');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await screenshot('logo-portal-escritorio');
  assert.equal(await evaluate(`[...document.querySelectorAll('a')].some(a => a.getAttribute('href')?.startsWith('/auxiliares/carnet'))`), false, 'El portal público no enlaza ni enumera carnets');

  // Cuenta del auxiliar: acceso propio, selección y operaciones de su materia.
  session = 'student'; status = 200; name = 'Ana María Pérez'; email = 'ana@umsa.bo'; token = '7.' + 'A'.repeat(43); schedules = [originalSchedule];
  const navigate = async route => { await send('Page.navigate', { url: origin + route }); };
  await navigate('/usuario/dashboard');
  await wait(`!!document.querySelector('section[aria-label="Servicios del estudiante"] a[href="/usuario/mi-auxiliatura"]')`);
  await evaluate(`document.querySelector('section[aria-label="Servicios del estudiante"] a[href="/usuario/mi-auxiliatura"]').click()`);
  await wait(`document.body.innerText.includes('Aula A-101') && document.body.innerText.includes('AUL-000001')`);
  assert.equal(await evaluate(`!!document.querySelector('#materia-auxiliatura')`), false, 'Una materia abre directamente su auxiliatura');
  assert.equal(await evaluate(`document.body.innerText.includes('AUL-000002')`), false, 'Solicitudes limitadas a la materia seleccionada');
  assert.ok(await evaluate(`[...document.querySelectorAll('nav a')].some(a => a.textContent.includes('Mi auxiliatura'))`));
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('h1').parentElement).backgroundColor`), 'rgb(6, 78, 59)', 'El título conserva su fondo oscuro y contraste dentro del portal');
  await delay(600);
  await screenshot('mi-auxiliatura-una-materia');
  const beforeCarnet = requests.length;
  await click('Ver mi carnet y QR');
  await wait(`!!document.querySelector('a[download]')`);
  assert.ok(requests.slice(beforeCarnet).some(r => r.route === '/api/estudiantes/auxiliatura/carnet'));
  assert.ok(!requests.slice(beforeCarnet).some(r => r.route.includes('/academico/auxiliares/')));
  assert.equal(await evaluate(`[...document.querySelectorAll('a')].find(a => a.textContent === 'Ver horario público').href`), qrLink, 'El auxiliar y el administrador obtienen el mismo carnet personal');
  await click('Cerrar');
  await click('+ Nueva solicitud');
  await wait(`!!document.querySelector('[role=dialog]')`);
  assert.equal(await evaluate(`[...document.querySelectorAll('[role=dialog] select')].find(s => [...s.options].some(o => o.value === '23')).value`), '23');
  assert.equal(await evaluate(`[...document.querySelectorAll('[role=dialog] option')].some(o => o.value === '24')`), false);
  await click('Cancelar');

  assignments = [firstAssignment, secondAssignment];
  schedules = [originalSchedule, { ...originalSchedule, id: '21', idAsignacion: '24', materia: 'Fundamentos digitales', aula: 'B-202', grupo: 'B' }];
  await navigate('/usuario/mi-auxiliatura');
  await wait(`!!document.querySelector('#materia-auxiliatura')`);
  assert.equal(await evaluate(`!!document.querySelector('section[aria-label="Mi carnet"]')`), false, 'Con varias materias primero elige');
  await evaluate(`(() => { const s = document.querySelector('#materia-auxiliatura'); s.value = '24'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await wait(`document.body.innerText.includes('Aula B-202') && document.body.innerText.includes('AUL-000002')`);
  assert.equal(await evaluate(`document.body.innerText.includes('Aula A-101') || document.body.innerText.includes('AUL-000001')`), false);
  await click('+ Nueva solicitud');
  await wait(`!!document.querySelector('[role=dialog]')`);
  assert.equal(await evaluate(`[...document.querySelectorAll('[role=dialog] select')].find(s => [...s.options].some(o => o.value === '24')).value`), '24');
  await click('Cancelar');
  await click('Ver mi carnet y QR'); await wait(`!!document.querySelector('a[download]')`);
  pages = await checkPdf();
  assert.equal(pages.length, 2);
  assert.ok(pages[0].text.includes('Programación') && pages[0].text.includes('Fundamentos digitales'), 'Las dos materias figuran en el carnet personal');
  await click('Cerrar');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, 'Mi auxiliatura se adapta al celular');
  await screenshot('mi-auxiliatura-movil');
  schedules[1].aula = 'LASIN-3';
  await evaluate(`window.dispatchEvent(new Event('focus'))`);
  await wait(`document.body.innerText.includes('Aula LASIN-3')`);
  ownStatus = 503; await click('Actualizar mi auxiliatura'); await wait(`!!document.querySelector('[role=alert]')`);
  assert.equal(await evaluate(`document.body.innerText.includes('Aula LASIN-3')`), false);
  ownStatus = 200; await click('Reintentar'); await wait(`document.body.innerText.includes('Aula LASIN-3')`);
  assignments = [firstAssignment];
  await evaluate(`window.dispatchEvent(new Event('focus'))`);
  await wait(`document.body.innerText.includes('Esta asignación ya no está disponible')`);
  assert.equal(await evaluate(`document.body.innerText.includes('Aula LASIN-3')`), false);
  assignments = []; await navigate('/usuario/mi-auxiliatura'); await wait(`document.body.innerText.includes('Sin materias vigentes')`);
  assert.ok(await evaluate(`document.body.innerText.includes('Ver mi carnet y QR')`));
  habilitado = false; await evaluate(`window.dispatchEvent(new Event('focus'))`);
  await wait(`document.body.innerText.includes('No tienes una auxiliatura habilitada')`);
  assert.equal(await evaluate(`document.body.innerText.includes('Ver mi carnet y QR')`), false);
  await wait(`![...document.querySelectorAll('nav a')].some(a => a.getAttribute('href') === '/usuario/mi-auxiliatura')`);
  await navigate('/usuario/dashboard'); await wait(`!!document.querySelector('section[aria-label="Servicios del estudiante"]')`);
  assert.equal(await evaluate(`!!document.querySelector('section[aria-label="Servicios del estudiante"] a[href="/usuario/mi-auxiliatura"]')`), false);

  // Horarios por aula: todas las tablas en orden, búsqueda única y actualización.
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  const beforeRooms = requests.length;
  await navigate('/usuario/horarios');
  await wait(`document.querySelectorAll('.student-schedules-room').length === ${classRooms.length}`);
  const search = async value => evaluate(`(() => { const s = document.getElementById('horarios-busqueda'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(s, ${JSON.stringify(value)}); s.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const roomCodes = () => evaluate(`[...document.querySelectorAll('.student-schedules-room-heading h2')].map(n => n.textContent.replace('Aula ', ''))`);
  assert.deepEqual((await roomCodes()).slice(0, 7), ['SS-A1', 'SS-A2', 'SS-A3', 'SS-A10', 'PB-A1', 'P1-A1', 'P2-A1'], 'Orden por edificio, piso y número, sin ordenar 10 antes de 2');
  assert.equal((await roomCodes()).at(-1), 'LASIN-1');
  assert.equal(await evaluate(`document.querySelectorAll('.student-schedules select').length`), 0, 'Solo un filtro de búsqueda');
  assert.equal(await evaluate(`document.querySelectorAll('.student-schedules input').length`), 1);
  assert.equal(await evaluate(`document.querySelector('.student-schedules-intro').innerText.trim()`), 'HORARIOS');
  assert.equal(await evaluate(`document.querySelectorAll('.student-schedules .room-timetable').length`), classRooms.length, 'Muestra todas las aulas sin paginación');
  assert.equal(await evaluate(`document.querySelectorAll('.student-schedules .room-session button, .student-schedules .room-slot').length`), 0, 'Consulta sin controles administrativos');
  assert.ok(!await evaluate(`document.querySelector('.student-schedules').innerText.includes('Docente del periodo anterior') || document.querySelector('.student-schedules').innerText.includes('Reserva vencida')`));
  assert.ok(await evaluate(`document.querySelector('[aria-label="Aula SS-A2"]').textContent.includes('Sábado') && document.querySelector('[aria-label="Aula SS-A2"]').textContent.includes('14/11/2099')`));
  assert.ok(requests.slice(beforeRooms).some(r => r.route === '/api/estudiantes/horarios-aulas'));
  assert.ok(!requests.slice(beforeRooms).some(r => r.route === '/api/aulas' || r.route === '/api/academico/aulas'));
  await screenshot('horarios-todas-las-aulas');
  await search('programacion');
  await wait(`document.querySelectorAll('.student-schedules-room').length === 3`);
  assert.deepEqual(await roomCodes(), ['SS-A1', 'SS-A2', 'LASIN-1'], 'Busca sin tildes e incluye las reservas vigentes');
  assert.ok(await evaluate(`document.querySelector('[aria-label="Aula SS-A1"]').innerText.includes('Coordinador')`), 'Conserva la ocupación completa del aula');
  assert.ok(await evaluate(`document.querySelectorAll('.room-session.is-search-match').length > 0`));
  await search('INF-112'); assert.deepEqual(await roomCodes(), ['SS-A2']);
  await search('ss a3'); assert.deepEqual(await roomCodes(), ['SS-A3']);
  assert.ok(await evaluate(`document.querySelector('.student-schedules-room').innerText.includes('Sin clases ni reservas')`));
  await search('SS-A1 programación'); assert.deepEqual(await roomCodes(), ['SS-A1']);
  await search('no existe esta materia');
  assert.ok(await evaluate(`document.body.innerText.includes('No se encontraron aulas, materias o docentes')`));
  await click('Mostrar todas las aulas');
  assert.equal((await roomCodes()).length, classRooms.length);

  // Búsqueda por docente y selección accesible con teclado o clic.
  classSchedules[0].responsable = 'Lic. José García';
  classSchedules[2].responsable = 'M.Sc. María García';
  await click('Actualizar horarios');
  await wait(`document.querySelector('.student-schedules-rooms').textContent.includes('José García')`);
  await evaluate(`document.getElementById('horarios-busqueda').focus()`);
  await search('GARCIA');
  await wait(`document.querySelectorAll('.student-schedules-room').length === 2`);
  assert.deepEqual(await roomCodes(), ['SS-A1', 'SS-A2'], 'Encuentra docentes por apellido sin tildes ni distinción de mayúsculas');
  assert.equal(await evaluate(`document.querySelectorAll('[role=option]').length`), 2);
  assert.equal(await evaluate(`document.querySelectorAll('.room-session.is-search-match').length`), 2);
  await screenshot('horarios-sugerencias-docentes');
  const key = async (key, code, keyCode) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: keyCode }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: keyCode }); };
  await key('ArrowDown', 'ArrowDown', 40);
  assert.ok(await evaluate(`document.getElementById(document.getElementById('horarios-busqueda').getAttribute('aria-activedescendant'))?.getAttribute('aria-selected') === 'true'`));
  await key('Enter', 'Enter', 13);
  assert.equal(await evaluate(`document.getElementById('horarios-busqueda').value`), 'Lic. José García');
  assert.deepEqual(await roomCodes(), ['SS-A1']);
  assert.equal(await evaluate(`document.getElementById('horarios-busqueda').getAttribute('aria-expanded')`), 'false');
  assert.ok(await evaluate(`document.querySelector('.student-schedules-rooms').textContent.includes('Coordinador')`), 'El filtro del docente mantiene el horario completo del aula');
  await evaluate(`window.dispatchEvent(new Event('focus'))`);
  await wait(`document.querySelectorAll('.room-session.is-search-match').length === 1`);
  assert.equal(await evaluate(`document.getElementById('horarios-busqueda').value`), 'Lic. José García');
  await search('garcia');
  await key('ArrowUp', 'ArrowUp', 38);
  await key('Enter', 'Enter', 13);
  assert.deepEqual(await roomCodes(), ['SS-A2']);
  assert.equal(await evaluate(`document.getElementById('horarios-busqueda').value`), 'M.Sc. María García');
  await search('garcia'); await key('Escape', 'Escape', 27);
  assert.equal(await evaluate(`document.querySelectorAll('[role=option]').length`), 0, 'Escape cierra las sugerencias sin borrar la búsqueda');
  assert.deepEqual(await roomCodes(), ['SS-A1', 'SS-A2']);
  await search('SS-A1 jose'); assert.deepEqual(await roomCodes(), ['SS-A1'], 'Permite combinar aula y docente');
  await search('perez'); assert.deepEqual(await roomCodes(), ['LASIN-1'], 'Incluye al auxiliar responsable');
  assert.equal(await evaluate(`document.querySelector('.student-schedules-suggestion-kind').textContent`), 'Auxiliar');
  await search('SS-A1');
  const chooseSuggestion = async text => {
    const point = await evaluate(`(() => { const b = [...document.querySelectorAll('[role=option]')].find(b => b.querySelector('strong').textContent === ${JSON.stringify(text)}); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  };
  await chooseSuggestion('SS-A1');
  assert.deepEqual(await roomCodes(), ['SS-A1'], 'La sugerencia elige el aula exacta sin incluir SS-A10');
  assert.equal(await evaluate(`document.getElementById('horarios-busqueda').getAttribute('aria-expanded')`), 'false');
  await search('programacion'); await chooseSuggestion('Programación');
  assert.deepEqual(await roomCodes(), ['SS-A1', 'SS-A2', 'LASIN-1']);
  await search('garcia'); await key('Tab', 'Tab', 9);
  assert.equal(await evaluate(`document.activeElement.textContent`), 'Limpiar');
  await key('Tab', 'Tab', 9);
  assert.equal(await evaluate(`document.querySelectorAll('[role=option]').length`), 0, 'El desplegable cierra al salir del buscador');
  await click('Limpiar');
  assert.equal((await roomCodes()).length, classRooms.length);
  assert.equal(await evaluate(`document.activeElement.id`), 'horarios-busqueda');
  await search('SS-A1');
  classSchedules[0].responsable = 'Docente actualizado';
  await evaluate(`window.dispatchEvent(new Event('focus'))`);
  await wait(`document.querySelector('.student-schedules-rooms').innerText.includes('Docente actualizado')`);
  assert.equal(await evaluate(`document.getElementById('horarios-busqueda').value`), 'SS-A1', 'Conserva la búsqueda al actualizar');
  await screenshot('horarios-aula-filtrada');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, 'La tabla no ensancha la página en celular');
  assert.ok(await evaluate(`document.querySelector('.student-schedules-table').scrollWidth > document.querySelector('.student-schedules-table').clientWidth`), 'El horario conserva su tabla y permite desplazarse');
  await evaluate(`window.scrollTo({ top: 0, behavior: 'instant' }); document.getElementById('horarios-busqueda').focus({ preventScroll: true });`);
  await search('garcia');
  await wait(`document.querySelectorAll('[role=option]').length === 1`);
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, 'Las sugerencias se adaptan al celular');
  await screenshot('horarios-sugerencias-movil');
  await chooseSuggestion('M.Sc. María García');
  assert.deepEqual(await roomCodes(), ['SS-A2']);
  await search('SS-A1'); await key('Escape', 'Escape', 27);
  await screenshot('horarios-aulas-movil');
  await evaluate(`document.querySelector('.student-schedules-table').scrollIntoView({ behavior: 'instant', block: 'center' }); document.querySelector('.student-schedules-table').scrollLeft = 450;`);
  await screenshot('horarios-tabla-movil');
  classStatus = 503; await click('Actualizar horarios'); await wait(`!!document.querySelector('.student-schedules-empty[role=alert]')`);
  assert.equal((await roomCodes()).length, 0, 'Ante un error no presenta horarios antiguos como vigentes');
  classStatus = 200; await click('Reintentar'); await wait(`document.querySelectorAll('.student-schedules-room').length > 0`);
  await click('Limpiar');
  classSchedules = []; await click('Actualizar horarios');
  await wait(`document.querySelectorAll('.student-schedules .room-session').length === 0`);
  assert.equal((await roomCodes()).length, classRooms.length, 'Todas las aulas siguen visibles aunque no haya clases');
  classPeriods = []; await click('Actualizar horarios'); await wait(`document.body.innerText.includes('No hay un periodo académico activo')`);
  assert.equal((await roomCodes()).length, 0);

  assert.deepEqual(errors, []);
  console.log('CARNET_BROWSER_OK: carnet, QR, Mi auxiliatura, horarios por aula, búsqueda por docente, sugerencias con clic/teclado, título HORARIOS y móvil.');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
});
