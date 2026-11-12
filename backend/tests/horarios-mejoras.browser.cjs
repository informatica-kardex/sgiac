// Frontend compilado en Chrome, API simulada: no usa cuentas, BD ni correos reales.
// node tests/horarios-mejoras.browser.cjs (requiere frontend/dist y Chrome)
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../frontend/dist');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sgiac-horarios-browser-'));
const chromePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const period = { idPeriodo: '1', periodo: 'II', gestion: 2026, fechaInicio: '2026-07-01', fechaFin: '2026-12-31', estado: 'ACTIVO' };
const aulas = ['A1', 'A2', 'A3', 'A4'].map((codigo, i) => ({ idAula: codigo, codigo, nombre: codigo, capacidad: i === 3 ? 10 : i === 2 ? 20 : 40, tipo: 'AULA', lugar: 'INFORMATICA', piso: 1, estado: 'disponible', ubicacion: '' }));
const materias = [1,2,3].map(n => ({ codigo: 'INF-'+n, siglas: ['INF-'+n], nombre: 'Materia '+n, estado: 'ACTIVO' }));
const asignaciones = materias.map((m,i) => ({ idAsignacion: String(i+1), idDocente: String(i+1), codigoMateria: m.codigo, siglas: m.siglas, materia: m.nombre, docente: 'Docente '+(i+1), grupo: 'A', idPeriodo: '1', periodo: 'II/2026', estado: 'ACTIVO' }));
const docentes = asignaciones.map(a => ({ idDocente: a.idDocente, nombreCompleto: a.docente, estado: 'ACTIVO', asignaciones: [a] }));
const auxiliares = [{ idAuxiliar: '7', idEstudiante: '7', idUsuario: '7', cuentaActiva: true, nombreCompleto: 'Julia Auxiliar', estado: 'ACTIVO', asignaciones: [asignaciones[0]] }];
const base = { ...asignaciones[0], idHorario: 1, idAuxiliar: '7', esAuxiliar: true, responsable: 'Julia Auxiliar', docente: 'Julia Auxiliar', aula: 'A1', dia: 'LUNES', horaInicio: '08:00', horaFin: '10:00', fecha: null, motivo: '', lugar: 'INFORMATICA', piso: 1, idHorarioBase: null, idReservaOrigen: null, reubicaciones: [], traslados: [] };
let horarios = [structuredClone(base), { ...base, ...asignaciones[1], idHorario: 2, esAuxiliar: false, idAuxiliar: null, responsable: 'Docente 2', aula: 'A2' }];
const mutations = [], errors = [];
let server, chrome, ws, send, origin, student = false;
let nextId = 10;
function saveMock(input, id = nextId++) {
  const previous = horarios.find(h => h.idHorario === id);
  horarios = horarios.filter(h => h.idHorario !== id && h.idReservaOrigen !== id);
  const assignment = asignaciones.find(a => a.idAsignacion === input.idAsignacion);
  const saved = { ...base, ...assignment, ...input, idHorario: id, idHorarioBase: null, idReservaOrigen: null, responsable: assignment.docente, traslados: [], avisos: [] };
  horarios.push(saved);
  if (previous) for (const r of previous.reubicaciones ?? []) {
    const weekly = horarios.find(h => h.idHorario === r.idHorario);
    weekly.traslados = weekly.traslados.filter(t => t.fecha !== previous.fecha);
  }
  for (const r of input.reubicaciones ?? []) {
    const weekly = horarios.find(h => h.idHorario === r.idHorario);
    weekly.traslados.push({ fecha: saved.fecha, aula: r.aula });
    horarios.push({ ...weekly, idHorario: nextId++, fecha: saved.fecha, aula: r.aula, idHorarioBase: weekly.idHorario, idReservaOrigen: id, aulaOriginal: weekly.aula, traslados: [], reubicaciones: [] });
  }
  return saved;
}
async function run() {
  server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.join(root, pathname.startsWith('/assets/') || pathname.startsWith('/images/') ? pathname : 'index.html');
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.end(fs.readFileSync(file));
  }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  chrome = spawn(chromePath, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', '--user-data-dir='+profile, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let debug;
  for (let n = 0; n < 100; n++) { try { debug = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; break; } catch { await delay(100); } }
  assert.ok(debug, 'Chrome debe iniciar');
  const tabs = await fetch(`http://127.0.0.1:${debug}/json`).then(r => r.json());
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let sequence = 0; const pending = new Map();
  send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++sequence, { resolve, reject }); ws.send(JSON.stringify({ id: sequence, method, params })); });
  ws.addEventListener('message', async event => {
    const m = JSON.parse(event.data);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(m.error) : p.resolve(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method !== 'Fetch.requestPaused') return;
    try {
      const { requestId, request } = m.params, url = new URL(request.url);
      let data = [], status = 200;
      if (request.method === 'OPTIONS') data = {};
      else if (url.pathname.endsWith('/auth/refresh')) data = { accessToken: 'mock-token', session: { id: 1, expiresAt: Date.parse('2027-01-01') } };
      else if (url.pathname.endsWith('/auth/me')) data = { idUsuario: '1', nombreCompleto: 'Prueba local', correo: 'prueba@example.test', roles: [student ? 'CONSULTA_INTERNA' : 'ADMINISTRADOR'], correoVerificado: true, debeCambiarPassword: false };
      else if (url.pathname === '/api/events') { await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/event-stream' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' }], body: Buffer.from(': test\n\n').toString('base64') }); return; }
      else if (url.pathname === '/api/horarios/lote' && request.method === 'POST') {
        const payload = JSON.parse(request.postData); mutations.push({ method: request.method, payload });
        data = payload.sesiones.map(s => saveMock(s));
      } else if (/^\/api\/horarios\/\d+$/.test(url.pathname) && request.method === 'PUT') {
        const id = Number(url.pathname.split('/').at(-1)), payload = JSON.parse(request.postData);
        mutations.push({ method: request.method, id, payload }); data = saveMock(payload, id);
      } else if (url.pathname === '/api/estudiantes/horarios-aulas') data = { aulas, horarios, periodos: [period] };
      else if (url.pathname === '/api/solicitudes-aulas/perfil') data = { habilitado: true, datos: { nombre: 'Julia Auxiliar' }, asignaciones: [{ ...asignaciones[0], desde: period.fechaInicio, hasta: period.fechaFin }] };
      else if (/^\/api\/academico\/docentes\/\d+\/horarios$/.test(url.pathname)) data = horarios.filter(h => h.idDocente === url.pathname.split('/')[4]).map(h => ({ ...h, estado: 'ASIGNADO' }));
      else if (url.pathname.startsWith('/api/academico/')) data = { aulas, horarios, periodos: [period], materias, docentes, auxiliares, asignaciones, menciones: [] }[url.pathname.split('/').at(-1)] ?? [];
      else if (url.pathname === '/api/estudiantes/auxiliatura') data = { perfil: { habilitado: true, datos: { nombre: 'Julia Auxiliar' }, asignaciones: [{ ...asignaciones[0], desde: period.fechaInicio, hasta: period.fechaFin }] }, horarios: [
        { id: '1', idAsignacion: '1', aula: 'A1', dia: 'LUNES', horaInicio: '08:00', horaFin: '10:00', fecha: null, lugar: 'INFORMATICA', piso: 1, materia: 'Materia 1', traslados: [{ fecha: '2026-11-16', aula: 'A3' }] },
        { id: '20', idAsignacion: '1', aula: 'A3', aulaOriginal: 'A1', docenteReserva: 'Docente 3', dia: 'LUNES', horaInicio: '08:00', horaFin: '10:00', fecha: '2026-11-16', lugar: 'INFORMATICA', piso: 1, materia: 'Materia 1' },
      ] };
      await send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' }], body: Buffer.from(JSON.stringify({ success: true, data, message: '' })).toString('base64') });
    } catch (e) { errors.push(e instanceof Error ? e.stack : JSON.stringify(e)); }
  });
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const wait = async expr => { for (let n = 0; n < 100; n++) { if (await evaluate(expr)) return; await delay(80); } throw Error(`Timeout: ${expr}\n${await evaluate('document.body.innerText')}`); };
  const click = async label => { const expr = `[...document.querySelectorAll('button,summary')].find(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled)`; await wait(`Boolean(${expr})`); await evaluate(`${expr}.click()`); await delay(100); };
  const field = async (label, value) => { await evaluate(`(()=>{ const l=[...document.querySelectorAll('label')].find(l=>(l.querySelector(':scope > span')?.textContent || l.firstChild?.textContent)?.trim()===${JSON.stringify(label)}); if(!l)throw Error('Falta campo '+${JSON.stringify(label)}); const e=l.querySelector('input,select'); Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)}); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); })()`); await delay(100); };
  const value = async label => evaluate(`(()=>{const l=[...document.querySelectorAll('label')].find(l=>(l.querySelector(':scope > span')?.textContent || l.firstChild?.textContent)?.trim()===${JSON.stringify(label)});return l.querySelector('input,select').value;})()`);
  const clickAria = async label => { await evaluate(`document.querySelector('[aria-label=' + ${JSON.stringify(JSON.stringify(label))} + ']').click()`); await delay(100); };
  const blankReservation = async (teacher = false) => { for (const label of ['Materia', 'Motivo de la reserva', 'Fecha · sesión 1', 'Inicio · sesión 1', 'Fin · sesión 1', ...(!teacher ? ['Docente'] : [])]) assert.equal(await value(label), '', `Campo vacío: ${label}`); };
  const navigate = async route => { await send('Page.navigate', { url: origin + route }); await wait('document.querySelector("h1") !== null'); };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.testNow=Date.parse('2026-11-11T12:00:00Z');const OriginalDate=Date;window.Date=class extends OriginalDate {constructor(...args){super(...(args.length?args:[window.testNow]));}static now(){return window.testNow;}};` });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate('/admin/horarios?aula=A1&periodo=1'); await wait('document.body.innerText.includes("Julia Auxiliar")');
  await click('Buscar docentes y auxiliares por día y hora'); await field('Día', 'LUNES'); await field('Hora o desde', '08:00'); await field('Hasta (opcional)', '10:00');
  await wait('document.body.innerText.includes("2 sesiones encontradas")');
  await click('Buscar aula'); await field('Día de búsqueda', 'LUNES'); await wait('document.body.innerText.includes("Franjas libres:")');
  await field('Cantidad de estudiantes', '35'); await field('Hora de inicio', '08:00'); await field('Hora de fin', '10:00');
  await wait(`document.querySelector('[aria-label="Alternativas de día y horario"]') !== null`);
  assert.match(await evaluate(`document.querySelector('[aria-label="Alternativas de día y horario"]').textContent`), /Mismo día · otro horario/);
  assert.match(await evaluate(`document.querySelector('[aria-label="Alternativas de día y horario"]').textContent`), /Otro día · misma hora/);
  await click('Asignar esta opción'); await wait('document.body.innerText.includes("10:00–12:00")');
  await navigate('/admin/horarios?aula=A1&periodo=1'); await wait('document.body.innerText.includes("Julia Auxiliar")');
  await click('Asignar en esta aula'); await wait('document.body.innerText.includes("Quiénes ya tienen asignada el aula")');
  assert.match(await evaluate(`document.querySelector('[aria-label="Asignaciones existentes del aula"]').textContent`), /Julia Auxiliar.*Todo el semestre/);
  await click('Quitar este día'); await field('Frecuencia', 'temporal'); await field('Materia', 'INF-3'); await field('Docente', '3');
  await field('Motivo de la reserva', 'Examen de prueba'); await field('Fecha · sesión 1', '2026-11-16');
  await wait('document.body.innerText.includes("Aula de traslado para Julia Auxiliar")');
  await field('Aula de traslado para Julia Auxiliar', 'A3'); await click('Guardar');
  await wait('!document.querySelector("[role=dialog]")'); assert.equal(mutations.length, 1);
  assert.deepEqual(mutations[0].payload.sesiones[0].reubicaciones, [{ idHorario: 1, aula: 'A3' }]);
  assert.equal(horarios[0].fecha, null); assert.equal(horarios[0].responsable, 'Julia Auxiliar');
  await wait('document.querySelector(".room-session.temporary") !== null');
  const original = structuredClone(horarios.find(h => h.idHorario === 10));
  await evaluate('document.querySelector(".room-session.temporary").click()'); await wait('document.querySelector("[role=dialog]") !== null');
  await blankReservation();
  assert.match(await evaluate(`document.querySelector('[aria-label="Asignaciones existentes del aula"]').textContent`), /Docente 3/);
  await clickAria('Editar asignación de Docente 3 en A1'); assert.equal(await value('Fecha · sesión 1'), '2026-11-16'); assert.equal(await value('Motivo de la reserva'), original.motivo);
  await click('Nueva reserva temporal'); await blankReservation();
  await field('Materia', 'INF-3'); await field('Docente', '3'); await field('Motivo de la reserva', 'Otra fecha'); await field('Fecha · sesión 1', '2026-11-23'); await field('Inicio · sesión 1', '08:00');
  await field('Aula de traslado para Julia Auxiliar', 'A3'); await click('Guardar'); await wait('!document.querySelector("[role=dialog]")');
  assert.equal(mutations.at(-1).method, 'POST'); assert.deepEqual(horarios.find(h => h.idHorario === 10), original, 'Crear otra fecha conserva la reserva original');
  await evaluate(`[...document.querySelectorAll('.room-session.temporary')].find(e=>e.textContent.includes('16/11/2026')).click()`); await wait('document.querySelector("[role=dialog]") !== null');
  await clickAria('Cambiar aula de Docente 3 en A1');
  assert.equal(await evaluate(`document.querySelector('input[type=date]').disabled`), true);
  await field('Aula · sesión 1', 'A4'); await click('Guardar'); await wait('!document.querySelector("[role=dialog]")');
  assert.equal(mutations.at(-1).method, 'PUT'); assert.equal(mutations.at(-1).id, 10); assert.equal(horarios.find(h => h.idHorario === 10).fecha, original.fecha); assert.equal(horarios.find(h => h.idHorario === 10).aula, 'A4');
  assert.ok(horarios.some(h => h.aula === 'A1' && h.fecha === '2026-11-23' && !h.idHorarioBase));
  await evaluate(`window.testNow=Date.parse('2026-11-17T12:00:00Z');window.dispatchEvent(new Event('focus'));`);
  await wait(`![...document.querySelectorAll('.room-session.temporary')].some(e=>e.textContent.includes('16/11/2026'))`); assert.match(await evaluate('document.body.innerText'), /Julia Auxiliar/);
  await navigate('/admin/docentes'); await wait('document.body.innerText.includes("Docente 3")');
  await evaluate(`[...document.querySelectorAll('tbody tr')].find(r=>r.textContent.includes('Docente 3')).querySelectorAll('button').forEach(b=>{if(b.textContent==='Reservar aulas')b.click();})`);
  await wait('document.querySelector("[role=dialog]") !== null'); await blankReservation(true);
  await field('Materia', 'INF-3'); assert.equal(await value('Docente'), '3'); await field('Motivo de la reserva', 'Dos aulas para examen'); await field('Aula · sesión 1', 'A3'); await field('Fecha · sesión 1', '2026-11-24'); await field('Inicio · sesión 1', '10:00');
  await click('+ Añadir otra aula en esta fecha'); assert.equal(await value('Fecha · sesión 2'), '2026-11-24'); assert.equal(await value('Inicio · sesión 2'), '10:00');
  await field('Aula · sesión 2', 'A4'); await click('Guardar'); await wait('!document.querySelector("[role=dialog]")');
  assert.equal(mutations.at(-1).payload.sesiones.length, 2); assert.deepEqual(mutations.at(-1).payload.sesiones.map(s=>s.aula), ['A3', 'A4']);
  const pair = horarios.filter(h=>h.fecha==='2026-11-24'); assert.equal(pair.length, 2);
  await clickAria('Ver horarios y materias de Docente 3'); await wait('document.body.innerText.includes("24/11/2026")');
  await clickAria('Cambiar aula de sesión en A3 del 2026-11-24'); await wait('document.querySelector("[role=dialog]") !== null');
  assert.equal(await value('Fecha · sesión 1'), '2026-11-24'); await field('Aula · sesión 1', 'A1'); await click('Guardar'); await wait('!document.querySelector("[role=dialog]")');
  assert.equal(mutations.at(-1).method, 'PUT'); assert.equal(horarios.find(h=>h.idHorario===pair[0].idHorario).aula, 'A1'); assert.equal(horarios.find(h=>h.idHorario===pair[1].idHorario).aula, 'A4');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate('/admin/ver-horarios?aula=A1&periodo=1'); await wait('document.body.innerText.includes("Julia Auxiliar")');
  await click('Buscar docentes y auxiliares por día y hora'); await field('Día', 'LUNES');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, 'Sin desbordamiento de página en móvil');
  student = true; await navigate('/usuario/horarios'); await wait('document.body.innerText.includes("Julia Auxiliar")');
  await click('Buscar docentes y auxiliares por día y hora'); await field('Día', 'LUNES'); await field('Hora o desde', '08:00'); await field('Hasta (opcional)', '10:00');
  await wait('document.body.innerText.includes("sesiones encontradas")');
  await navigate('/usuario/mi-auxiliatura'); await wait('document.body.innerText.includes("Avisos de cambio de aula por un día")');
  assert.match(await evaluate('document.body.innerText'), /en A3, de 08:00 a 10:00/);
  assert.deepEqual(errors, []); console.log('HORARIOS_BROWSER_OK: filtros, día sin horas, alternativas, reserva sin reemplazar auxiliar, traslado, fin de fecha, móvil y aviso al auxiliar.');
}
run().catch(error => { console.error(error); if (errors.length) console.error(errors); process.exitCode = 1; }).finally(async () => {
  ws?.close(); if (chrome) { chrome.kill(); await delay(500); }
  if (server) await new Promise(resolve => server.close(resolve));
  // Solo la carpeta temporal propia y validada; ninguna carpeta del proyecto.
  if (path.dirname(path.resolve(profile)) === path.resolve(os.tmpdir()) && path.basename(profile).startsWith('sgiac-horarios-browser-')) fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
});
