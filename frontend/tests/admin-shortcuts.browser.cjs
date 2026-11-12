// Desde la raíz: node frontend/tests/admin-shortcuts.browser.cjs
// Chrome headless con API simulada; no toca cuentas ni datos reales.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const root = path.resolve('frontend/dist'), output = path.resolve('.preview-admin-cambios');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const today = new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 10);
let web, chrome, ws, nextPuesto = 5;
const errors = [], requests = [], students = [], auxiliaries = [], jornadas = [], fichas = [];
let puestos = ['Ventanilla 1', 'Ventanilla 2', 'Ventanilla 3', 'Encargada de Kardex'].map((nombre, i) => ({ idPuesto: String(i + 1), nombre }));
const admin = { idUsuario: '1', nombreCompleto: 'Administrador de prueba', correo: 'prueba@umsa.bo', roles: ['ADMINISTRADOR'], permisos: [], estado: 'activo', correoVerificado: true, debeCambiarPassword: false };
const assignment = { idAsignacion: '31', idDocente: '41', codigoMateria: 'INF111', siglas: ['INF-111'], materia: 'Introducción a la programación', docente: 'Lic. Docente de prueba', grupo: 'A', idPeriodo: '51', periodo: 'II/2026', estado: 'ACTIVO' };
const catalog = {
  docentes: [{ idDocente: '41', nombreCompleto: 'Docente de prueba', gradoAcademico: 'Lic.', correo: '', telefono: '', especialidad: '', estado: 'ACTIVO', asignaciones: [assignment] }, { idDocente: '42', nombreCompleto: 'Docente sin materias', gradoAcademico: 'Lic.', correo: '', telefono: '', especialidad: '', estado: 'ACTIVO', asignaciones: [] }],
  materias: [{ codigo: 'INF111', siglas: ['INF-111'], nombre: assignment.materia, estado: 'ACTIVO' }], menciones: [],
  periodos: [{ idPeriodo: '51', gestion: 2026, periodo: 'II', estado: 'ACTIVO', fechaInicio: '2026-08-01', fechaFin: '2099-12-31' }],
  asignaciones: [assignment], aulas: [{ codigo: '101', nombre: 'Aula 101', lugar: 'MONOBLOCK', piso: 1, estado: 'disponible' }], horarios: [],
};
function expanded(j) {
  const current = fichas.filter(f => f.idJornada === j.idJornada);
  const enabled = puestos.filter(p => j.idPuestos.includes(p.idPuesto));
  return { ...j, puestos: enabled, puesto: enabled.map(p => p.nombre).join(' · '), emitidas: current.length, ocupadas: current.length, disponibles: j.cupoTotal - current.length,
    enEspera: current.filter(f => f.estado === 'GENERADA').length, atendidas: current.filter(f => f.estado === 'ATENDIDA').length };
}
function fichaDTO(f) { return { ...f, jornada: expanded(jornadas.find(j => j.idJornada === f.idJornada)) }; }
function response(request) {
  const url = new URL(request.url), p = url.pathname.replace(/^\/api/, '');
  const data = request.postData ? JSON.parse(request.postData) : {};
  requests.push({ method: request.method, path: p, data });
  if (p === '/auth/refresh') return { accessToken: 'preview-token', session: { id: 1, expiresAt: Date.now() + 3600000, idleTimeoutMs: 3600000, warningMs: 120000 } };
  if (p === '/auth/me') return admin;
  if (p === '/auth/activity') return { id: 1, expiresAt: Date.now() + 3600000 };
  if (p === '/events') return {};
  if (p === '/notificaciones/pendientes') return { 'solicitudes-aulas': 0, documentos: 0, fichas: 0 };
  if (p === '/users/estudiantes') {
    const student = { idEstudiante: String(13 + students.length), idUsuario: String(23 + students.length), nombreCompleto: `${data.nombres} ${data.apellidos}`, correo: data.correo, ci: data.ci, ru: data.ru, idAuxiliar: null, motivoNoDisponible: '' };
    students.push(student); return student;
  }
  if (p === '/academico/auxiliares/estudiantes') return students;
  if (p === '/academico/auxiliares' && request.method === 'POST') {
    const student = students.find(s => s.idEstudiante === data.idEstudiante);
    assert.ok(student); assert.equal(data.idAsignacion, '31'); student.idAuxiliar = '71';
    auxiliaries.push({ ...student, telefono: '', estado: 'ACTIVO', cuentaActiva: true, asignaciones: [assignment] });
    return { idAuxiliar: '71' };
  }
  if (p === '/academico/auxiliares') return auxiliaries;
  if (p === '/academico/asignaciones' && request.method === 'POST') {
    const created = { ...assignment, ...data, idAsignacion: '32', grupo: 'B', docente: 'Lic. Docente sin materias' };
    catalog.asignaciones.push(created); catalog.docentes[1].asignaciones.push(created); return created;
  }
  if (p === '/horarios/lote') {
    catalog.horarios.push(...data.sesiones.map((s, i) => ({ ...s, idHorario: catalog.horarios.length + i + 1, idDocente: catalog.asignaciones.find(a => a.idAsignacion === s.idAsignacion).idDocente, idPeriodo: '51' })));
    return catalog.horarios;
  }
  if (p.startsWith('/academico/')) return catalog[p.split('/')[2]] ?? [];
  if (p === '/fichas/panel') return { puestos, tramites: [{ idTramite: '1', nombre: 'Consulta académica', descripcion: 'Prueba de atención', identificador: 'CON' }], jornadas: jornadas.filter(j => j.fecha === url.searchParams.get('fecha')).map(expanded), fichas: fichas.map(fichaDTO) };
  if (p === '/fichas/puestos' && request.method === 'POST') { const puesto = { idPuesto: String(nextPuesto++), nombre: data.nombre }; puestos.push(puesto); return puesto; }
  if (p.startsWith('/fichas/puestos/')) {
    const id = p.split('/').at(-1);
    if (request.method === 'PUT') { const puesto = puestos.find(p => p.idPuesto === id); puesto.nombre = data.nombre; return puesto; }
    if (request.method === 'DELETE') { puestos = puestos.filter(p => p.idPuesto !== id); return null; }
  }
  if (p === '/fichas/jornadas' && request.method === 'POST') { const jornada = { ...data, idJornada: String(jornadas.length + 1), tramite: 'Consulta académica' }; jornadas.push(jornada); return expanded(jornada); }
  if (/^\/fichas\/jornadas\/\d+$/.test(p) && request.method === 'PUT') { const jornada = jornadas.find(j => j.idJornada === p.split('/').at(-1)); Object.assign(jornada, data); return expanded(jornada); }
  if (p.endsWith('/siguiente')) {
    const jornada = jornadas.find(j => j.idJornada === p.split('/')[3]);
    assert.ok(jornada.idPuestos.includes(data.idPuesto));
    const ficha = fichas.find(f => f.idJornada === jornada.idJornada && f.estado === 'GENERADA');
    assert.ok(ficha); ficha.estado = 'LLAMADA'; ficha.idPuesto = data.idPuesto; ficha.puesto = puestos.find(p => p.idPuesto === data.idPuesto).nombre;
    return fichaDTO(ficha);
  }
  if (/^\/fichas\/\d+\/accion$/.test(p)) { const ficha = fichas.find(f => f.idFicha === p.split('/')[2]); ficha.estado = data.accion === 'FINALIZAR' ? 'ATENDIDA' : data.accion === 'AUSENTE' ? 'NO PRESENTADA' : 'LLAMADA'; return fichaDTO(ficha); }
  throw Error(`Unexpected request ${request.method} ${p}`);
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  web = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.join(root, pathname.startsWith('/assets/') || pathname.startsWith('/images/') ? pathname : 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
    res.end(fs.readFileSync(file));
  });
  await new Promise(r => web.listen(5209, '127.0.0.1', r));
  chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9369', '--user-data-dir=' + path.join(output, 'chrome'), 'about:blank'], { stdio: 'ignore', windowsHide: true });
  chrome.on('error', e => errors.push(e.message));
  let tabs;
  for (let i = 0; i < 80; i++) { try { tabs = await fetch('http://127.0.0.1:9369/json').then(r => r.json()); break; } catch { await delay(100); } }
  assert.ok(tabs, 'Chrome debe iniciar');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  let seq = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++seq, { resolve, reject }); ws.send(JSON.stringify({ id: seq, method, params })); });
  ws.addEventListener('message', async event => {
    const m = JSON.parse(event.data);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); return m.error ? p.reject(m.error) : p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method !== 'Fetch.requestPaused') return;
    try {
      const { request, requestId } = m.params;
      const data = request.method === 'OPTIONS' ? {} : response(request);
      await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: 'http://127.0.0.1:5209' }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' }], body: Buffer.from(JSON.stringify({ success: true, data })).toString('base64') });
    } catch (e) { errors.push(String(e)); await send('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'Failed' }); }
  });
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const wait = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await delay(100); } throw Error(`Timeout: ${expression}\n${await evaluate('document.body.innerText')}\n${errors.join('\n')}`); };
  const click = async (text, scope = 'document') => { const expression = `[...${scope}.querySelectorAll('button')].filter(b => b.textContent.trim() === ${JSON.stringify(text)} && !b.disabled).at(-1)`; await wait(expression); await evaluate(`${expression}.click()`); await delay(100); };
  const labelExpression = label => `[...document.querySelectorAll('label')].find(l => (l.querySelector(':scope > span')?.textContent || [...l.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join('')).trim() === ${JSON.stringify(label)})`;
  const field = async (label, value) => {
    await evaluate(`(() => { const label = ${labelExpression(label)}; if (!label) throw Error('Missing label: '+${JSON.stringify(label)}); const el = label.querySelector('input,select,textarea') || document.getElementById(label.htmlFor); const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); })()`); await delay(100);
  };
  const checked = async (label, value) => { await evaluate(`(() => { const el = ${labelExpression(label)}.querySelector('input'); if (el.checked !== ${value}) el.click(); })()`); await delay(100); };
  const value = label => evaluate(`${labelExpression(label)}.querySelector('input,select').value`);
  const navigate = async route => { await send('Page.navigate', { url: 'http://127.0.0.1:5209' + route }); await wait('document.querySelector("h1") !== null'); await delay(250); };
  const screenshot = async name => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(r.data, 'base64')); };
  await send('Runtime.enable'); await send('Page.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  await navigate('/admin/auxiliares'); await click('Crear estudiante');
  for (const [label, v] of [['Nombres', 'María'], ['Apellidos', 'Flores'], ['CI', '1234567'], ['Registro universitario (RU)', '123456'], ['Número de celular', '70123456'], ['Correo institucional', 'maria@umsa.bo'], ['Mención', 'Sistemas']]) await field(label, v);
  await click('Crear estudiante');
  await wait(`document.querySelector('[role="dialog"]')?.textContent.includes('Habilitar estudiante como auxiliar') && document.querySelector('input[type="radio"]')?.checked`);
  assert.equal(await evaluate('location.pathname'), '/admin/auxiliares');
  assert.equal(students[0].nombreCompleto, 'María Flores');
  await field('Materia', 'INF-111'); await wait(`document.querySelectorAll('[role="option"]').length > 1`);
  await evaluate(`[...document.querySelectorAll('[role="option"]')].find(o => o.textContent.includes('Introducción')).click()`);
  await field('Docente, paralelo y periodo', '31'); await click('Habilitar como auxiliar');
  await wait(`!document.querySelector('[role="dialog"]') && document.querySelector('article')?.textContent.includes('María Flores')`);
  await screenshot('auxiliares-creacion-directa');

  await navigate('/admin/docentes');
  await click('Asignar horario', `document.querySelector('tbody tr')`);
  await wait(`document.querySelector('[role="dialog"]')?.textContent.includes('Asignar horario')`);
  assert.equal(await value('Docente'), '41'); assert.equal(await value('Materia'), 'INF111'); assert.equal(await value('Periodo'), '51');
  assert.equal(await evaluate(`${labelExpression('Docente')}.querySelector('select').disabled`), true);
  await field('Aula · sesión 1', '101'); await field('Aula · sesión 2', '101'); await screenshot('docentes-asignar-horario');
  await click('Guardar'); await wait(`!document.querySelector('[role="dialog"]') && document.body.innerText.includes('Horario asignado.')`);
  assert.equal(await evaluate('location.pathname'), '/admin/docentes');
  const schedule = requests.find(r => r.path === '/horarios/lote');
  assert.equal(schedule.data.sesiones.length, 2); assert.ok(schedule.data.sesiones.every(s => s.idAsignacion === '31' && s.aula === '101'));
  await click('Asignar horario', `[...document.querySelectorAll('tbody tr')][1]`);
  await wait(`document.querySelector('[role="dialog"]')?.textContent.includes('Primero vincula la materia')`);
  await field('Materia', 'INF111'); await click('Guardar');
  await wait(`document.querySelector('[role="dialog"] h3')?.textContent === 'Asignar horario'`);
  assert.equal(await value('Docente'), '42'); assert.equal(await value('Materia'), 'INF111'); await click('Cancelar');

  await navigate('/admin/fichas'); await click('Puestos de atención'); await click('Añadir puesto');
  await field('Nombre del puesto', 'Oficina de apoyo'); await click('Guardar puesto');
  await wait(`!document.querySelector('[role="dialog"]') && [...document.querySelectorAll('article')].some(a => a.textContent.includes('Oficina de apoyo'))`);
  await click('Editar nombre', `[...document.querySelectorAll('article')].find(a => a.textContent.includes('Oficina de apoyo'))`);
  await field('Nombre del puesto', 'Coordinación'); await click('Guardar puesto');
  await wait(`!document.querySelector('[role="dialog"]') && [...document.querySelectorAll('article')].some(a => a.textContent.includes('Coordinación'))`);
  await click('Eliminar', `[...document.querySelectorAll('article')].find(a => a.textContent.includes('Coordinación'))`); await click('Eliminar');
  await wait(`!document.querySelector('[role="dialog"]') && ![...document.querySelectorAll('article')].some(a => a.textContent.includes('Coordinación'))`);
  assert.equal(puestos.length, 4); await screenshot('puestos-catalogo');
  await click('Atención y cupos'); await click('Programar jornada'); await field('Trámite', '1');
  await checked('Todos los puestos actuales', true);
  assert.equal(await evaluate(`document.querySelectorAll('[role="dialog"] input[type="checkbox"]:checked').length`), 5);
  await checked('Ventanilla 3', false); await checked('Encargada de Kardex', false);
  await screenshot('puestos-seleccion-jornada');
  await click('Guardar jornada'); await wait(`!document.querySelector('[role="dialog"]') && document.body.innerText.includes('Configuración de la jornada guardada.')`);
  assert.deepEqual(jornadas[0].idPuestos, ['1', '2']); assert.equal(jornadas[0].cupoTotal, 96);
  assert.equal(requests.find(r => r.path === '/fichas/jornadas' && r.method === 'POST').data.puesto, undefined);
  for (let i = 1; i <= 2; i++) fichas.push({ idFicha: String(i), idJornada: '1', numero: i, codigo: `CON-00${i}`, solicitante: `Estudiante ${i}`, correo: `estudiante${i}@umsa.bo`, ru: String(i), motivo: 'Consulta', estado: 'GENERADA', fechaSolicitud: today, delante: i - 1, esperaMinutos: (i - 1) * 10, ultimoEvento: null, idPuesto: null, puesto: null });
  await click('Actualizar'); await field('Atender desde', '2'); await click('Llamar siguiente →');
  await wait(`document.body.innerText.includes('Finalizar atención')`);
  assert.equal(fichas[0].idPuesto, '2'); assert.equal(fichas[0].puesto, 'Ventanilla 2');
  await field('Atender desde', '1'); await click('Llamar siguiente →');
  await wait(`document.body.innerText.includes('Finalizar atención')`);
  assert.equal(fichas[1].idPuesto, '1'); assert.equal(fichas.filter(f => f.estado === 'LLAMADA').length, 2);
  await screenshot('atencion-dos-puestos'); await click('Finalizar atención');
  await wait(`document.body.innerText.includes('Atención finalizada.')`);
  assert.equal(fichas[1].estado, 'ATENDIDA'); assert.equal(fichas[0].estado, 'LLAMADA');
  await field('Atender desde', '2'); await wait(`document.body.innerText.includes('Finalizar atención')`);
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth > window.innerWidth'), false);
  await screenshot('atencion-movil');
  assert.equal(await evaluate(`document.querySelector('a[href="/admin/documentos"]')?.textContent.includes('Trámites en línea')`), true);
  assert.deepEqual(errors, []);
  console.log('UI_ADMIN_SHORTCUTS_OK: estudiante y habilitación sin salir de auxiliares; horario con materia/docente preseleccionados; docente sin materia abre ambos pasos; puestos crear/renombrar/eliminar; selección todos/varios y cupo; llamados independientes por puesto; móvil sin desborde.');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  if (ws) ws.close(); if (chrome) chrome.kill();
  if (web) { web.closeAllConnections(); await new Promise(r => web.close(r)); }
});
