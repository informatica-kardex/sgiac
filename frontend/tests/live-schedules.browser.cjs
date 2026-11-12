// Real SSE transport + isolated API fixtures. No production database is used.
// Run from the workspace root after building frontend and backend.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const express = require('../../backend/node_modules/express');
const { streamChanges, notifySuccessfulMutation } = require('../../backend/dist/modules/realtime/realtime');
const output = path.resolve('.preview-academico/live-schedules');
fs.mkdirSync(output, { recursive: true });
const origin = 'http://127.0.0.1:5199';
const period = { idPeriodo: '1', gestion: 2099, periodo: 'II', fechaInicio: '2099-01-01', fechaFin: '2099-12-31', estado: 'ACTIVO' };
const places = ['INFORMATICA', 'LASIN', 'PABELLONES', 'ANTIGUO'];
const rooms = places.flatMap((lugar, n) => [1, 2].map(i => ({ idAula: `${n}-${i}`, codigo: `${lugar}-${i}`, nombre: `${lugar}-${i}`, lugar, piso: i, tipo: 'AULA', capacidad: 40, estado: 'disponible', equipamiento: [] })));
const assignment = { idAsignacion: '1', idDocente: '1', codigoMateria: 'INF-111', siglas: ['INF-111'], materia: 'Programación', docente: 'Ana', grupo: 'A', idPeriodo: '1', periodo: 'II/2099', estado: 'ACTIVO', desde: period.fechaInicio, hasta: period.fechaFin };
const schedules = [], requests = [], errors = [];
const datasets = { aulas: rooms, horarios: schedules, periodos: [period], asignaciones: [assignment], materias: [], menciones: [], docentes: [], auxiliares: [] };
const request = { id: '1', codigo: 'AUL-000001', estado: 'PENDIENTE', version: 1, nombre: 'Auxiliar de prueba', ci: '123', ru: '456', celular: '70000000', correo: 'prueba@umsa.bo', numeroEstudiantes: 20, actividad: 'CLASE_TEORICA', detalle: '', asignacion: assignment, propuesta: null,
  reserva: { aula: 'INFORMATICA-1', agenda: { alcance: 'DOS_DIAS', sesiones: ['2099-02-02', '2099-02-09'].map(fecha => ({ fecha, dia: 'LUNES', horaInicio: '10:00', horaFin: '12:00' })) } },
  creadaEn: '2026-10-29T15:00:00Z', actualizadaEn: '2026-10-29T15:00:00Z', historial: [] };
let subadmin = false, reads = 0, streams = 0;
const app = express();
app.use((req, res, next) => {
  res.set({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' });
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());
app.use('/api', (req, res, next) => {
  if (!req.path.startsWith('/auth/') && req.headers.authorization !== 'Bearer fixture') return res.sendStatus(401);
  req.user = { idUsuario: '1' }; next();
}, notifySuccessfulMutation);
app.get('/api/events', (req, res) => { streams++; res.once('close', () => streams--); streamChanges(req, res); });
app.post('/api/auth/refresh', (_req, res) => res.json({ data: { accessToken: 'fixture', session: { id: 1, expiresAt: Date.now() + 3600000 } } }));
app.post('/api/auth/activity', (_req, res) => res.json({ data: { session: { id: 1, expiresAt: Date.now() + 3600000 } } }));
app.get('/api/notificaciones/pendientes', (_req, res) => res.json({ data: {} }));
app.get('/api/auth/me', (_req, res) => res.json({ data: { idUsuario: '1', nombreCompleto: 'Usuario de prueba', correo: 'prueba@example.test', correoVerificado: true, debeCambiarPassword: false, roles: [subadmin ? 'SUBADMINISTRADOR' : 'ADMINISTRADOR'], permisos: [{ modulo: 'horarios', desde: null, hasta: null }] } }));
app.get('/api/academico/:dataset', (req, res) => { reads++; res.json({ data: datasets[req.params.dataset] ?? [] }); });
app.get('/api/solicitudes-aulas/admin', (_req, res) => res.json({ data: requests }));
app.post('/api/test/request', (_req, res) => { requests.push(structuredClone(request)); res.json({ data: null }); });
app.post('/api/test/schedule', (req, res) => { schedules.push(req.body); res.json({ data: null }); });
app.post('/api/solicitudes-aulas/admin/:id/revisar', (req, res) => {
  const s = requests.find(s => s.id === req.params.id);
  assert.equal(req.body.accion, 'APROBAR');
  s.estado = 'APROBADA'; s.version++;
  for (const sesion of s.reserva.agenda.sesiones) schedules.push({ ...assignment, ...sesion, idHorario: schedules.length + 1, aula: s.reserva.aula, idAuxiliar: '1', responsable: 'Auxiliar de prueba', esAuxiliar: true, motivo: s.codigo });
  res.json({ data: s });
});
app.use(express.static(path.resolve('frontend/dist')));
app.get('*', (_req, res) => res.sendFile(path.resolve('frontend/dist/index.html')));
let server, chrome, ws;
const delay = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  server = app.listen(5199, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9350', '--user-data-dir=' + path.join(output, 'chrome'), 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let tabs;
  for (let n = 0; n < 50; n++) { try { tabs = await fetch('http://127.0.0.1:9350/json').then(r => r.json()); break; } catch { await delay(200); } }
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let seq = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++seq, { resolve, reject }); ws.send(JSON.stringify({ id: seq, method, params })); });
  ws.addEventListener('message', async event => {
    const m = JSON.parse(event.data);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Fetch.requestPaused') {
      const { requestId, request } = m.params, url = new URL(request.url);
      try { await send('Fetch.continueRequest', { requestId, url: origin + url.pathname + url.search }); } catch (e) { errors.push(String(e)); }
    }
  });
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description); return r.result.value; };
  const wait = async expression => { for (let n = 0; n < 80; n++) { if (await evaluate(expression)) return; await delay(75); } throw Error('Timeout: ' + expression + '\n' + await evaluate('document.body.innerText')); };
  const click = async label => { await evaluate(`document.querySelector(${JSON.stringify('[aria-label="' + label + '"]')}).click()`); await delay(100); };
  const button = async text => { await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent===${JSON.stringify(text)}).click()`); await delay(100); };
  const navigate = async route => { await send('Page.navigate', { url: origin + route }); await wait('document.querySelector("main h1") !== null'); };
  const external = async (route, data = {}) => { const r = await fetch(origin + '/api/test/' + route, { method: 'POST', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); assert.equal(r.status, 200); };
  await send('Runtime.enable'); await send('Page.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 950, deviceScaleFactor: 1, mobile: false });
  await navigate('/admin/solicitudes-aulas');
  await wait('document.body.innerText.includes("No hay solicitudes")');
  await external('request');
  await wait('document.body.innerText.includes("AUL-000001")'); // Deadline < 10s polling: must arrive through SSE.
  await button('Revisar solicitud'); await button('Aceptar solicitud'); await button('Aceptar y reservar aula');
  await wait('location.pathname === "/admin/ver-horarios" && document.querySelector("article .room-schedule") !== null');
  assert.equal(await evaluate('new URLSearchParams(location.search).get("aula")'), 'INFORMATICA-1');
  assert.ok(await evaluate('document.querySelector("article").innerText.includes("02/02/2099") && document.querySelector("article").innerText.includes("09/02/2099")'));
  assert.equal(schedules.length, 2);
  for (const role of ['admin', 'subadmin']) {
    subadmin = role === 'subadmin';
    for (const page of ['horarios', 'ver-horarios']) {
      await navigate('/admin/' + page); await wait('document.querySelector(".place-cards button:not(:disabled)") !== null');
      assert.deepEqual(await evaluate('[...document.querySelectorAll(".place-cards button")].map(b=>b.getAttribute("aria-label"))'), ['Todos los lugares', 'Edificio de Informática', 'LASIN', 'Pabellones', 'Edificio antiguo']);
      await click('Todos los lugares'); assert.equal(await evaluate('document.querySelectorAll("main .room-schedule").length'), 8);
      await click('Edificio antiguo'); assert.equal(await evaluate('document.querySelectorAll("main .room-schedule").length'), 2);
      await click('LASIN'); assert.equal(await evaluate('document.querySelectorAll("main .room-schedule").length'), 2);
      await click('Abrir horario de LASIN-2'); assert.equal(await evaluate('document.querySelectorAll("main .room-schedule").length'), 1);
      await button('← Volver a las aulas'); assert.equal(await evaluate('document.querySelectorAll("main .room-schedule").length'), 2);
      await click('Edificio de Informática'); await click('Primer piso');
      const marker = 'Reserva remota ' + role + ' ' + page;
      await external('schedule', { ...assignment, idHorario: schedules.length + 1, aula: 'INFORMATICA-1', dia: 'MARTES', horaInicio: '14:00', horaFin: '16:00', fecha: null, responsable: marker });
      await wait(`document.querySelector('main .room-schedule').innerText.includes(${JSON.stringify(marker)})`);
      assert.equal(streams, 1, 'Navigating releases the previous SSE connection');
      assert.equal(await evaluate('document.querySelector(".floor-cards [aria-pressed=true]").getAttribute("aria-label")'), 'Primer piso');
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(output, role + '-' + page + '.png'), Buffer.from(shot.data, 'base64'));
    }
  }
  await navigate('/admin/horarios?aula=INFORMATICA-1&periodo=1');
  await wait('document.querySelector(".room-slot") !== null'); await button('Asignar en esta aula');
  await wait('document.querySelector("[role=dialog] input[type=time]") !== null');
  await evaluate(`(()=>{const input=document.querySelector('[role=dialog] input[type=time]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'09:15');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const before = reads; await external('schedule', { ...assignment, idHorario: 99, aula: 'LASIN-1', dia: 'VIERNES', horaInicio: '18:00', horaFin: '20:00', fecha: null, responsable: 'Otro usuario' });
  for (let n = 0; reads === before && n < 50; n++) await delay(100);
  assert.ok(reads > before); assert.equal(await evaluate('document.querySelector("[role=dialog] input[type=time]").value'), '09:15');
  assert.deepEqual(errors, []);
  console.log('LIVE_SCHEDULES_OK: new requests via SSE, approval opens both dates, admin/subadmin live schedules, all places/floors, ordering, single room and draft preservation.');
})().catch(e => { console.error(e, { streams, reads, errors }); process.exitCode = 1; }).finally(async () => {
  ws?.close(); chrome?.kill(); server?.closeAllConnections(); if (server) await new Promise(r => server.close(r));
});
