// Desde la raíz: SGIAC_UI_DIST apunta a una compilación; toda la API es simulada.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const root = path.resolve(process.env.SGIAC_UI_DIST || 'frontend/dist');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'sgiac-horarios-browser-'));
const profile = path.join(output, 'chrome');
const period = { idPeriodo: '1', gestion: 2026, periodo: 'II', estado: 'ACTIVO', fechaInicio: '2026-07-01', fechaFin: '2026-12-31' };
const aulas = ['SS-A1', 'LASIN-1'].map((codigo, i) => ({ idAula: codigo, codigo, nombre: codigo, lugar: i ? 'LASIN' : 'INFORMATICA', piso: i ? 1 : -1, tipo: 'AULA', estado: 'disponible', capacidad: i ? 27 : 40, equipamiento: [] }));
const base = { idAsignacion: '1', idDocente: '1', codigoMateria: 'INF-111', siglas: ['INF-111'], materia: 'Programación I', docente: 'Ana Pérez', responsable: 'Ana Pérez', grupo: 'A', idPeriodo: '1', periodo: 'II/2026', aula: 'SS-A1', dia: 'LUNES', horaInicio: '08:00', horaFin: '10:00', fecha: null };
const horarios = [
  { ...base, idHorario: 1 },
  { ...base, idHorario: 2, aula: 'LASIN-1', dia: 'MIERCOLES', horaInicio: '10:00', horaFin: '12:00' },
  { ...base, idHorario: 3, docente: 'Luis Pérez', responsable: 'Luis Pérez', dia: 'MARTES' },
  { ...base, idHorario: 4, fecha: '2026-11-02' },
  { ...base, idHorario: 5, idPeriodo: '2' },
];
const datasets = { aulas, periodos: [period], horarios, materias: [], docentes: [], asignaciones: [], auxiliares: [], menciones: [] };
let audience = 'admin', publication = { publico: false, estudiantes: false, actualizadoEn: null }, failSave = false, failRead = false;
const errors = [], writes = [];
let chrome, ws, origin;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(root, pathname.startsWith('/assets/') || pathname.startsWith('/images/') ? pathname : 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
  chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let port, launchError; chrome.on('error', error => { launchError = error; });
  for (let n = 0; n < 100; n++) { if (launchError) throw launchError; try { port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; break; } catch { await delay(100); } }
  assert.ok(port, 'Chrome debe iniciar');
  const tabs = await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json());
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  const pending = new Map(); let seq = 0;
  const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++seq, { resolve, reject }); ws.send(JSON.stringify({ id: seq, method, params })); });
  ws.addEventListener('message', async event => {
    const m = JSON.parse(event.data);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); if (p) m.error ? p.reject(m.error) : p.resolve(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method !== 'Fetch.requestPaused') return;
    try {
      const { requestId, request } = m.params, pathname = new URL(request.url).pathname;
      let data = [], status = 200, message = '';
      if (pathname.endsWith('/auth/refresh')) { if (audience === 'anonymous') status = 401; else data = { accessToken: 'fixture', session: { id: 1, expiresAt: Date.parse('2027-01-01') } }; }
      else if (pathname.endsWith('/auth/me')) { if (audience === 'anonymous') status = 401; else data = { idUsuario: '1', nombreCompleto: 'Usuario de prueba', correo: 'prueba@example.test', roles: [audience === 'admin' ? 'ADMINISTRADOR' : 'CONSULTA_INTERNA'], permisos: [], correoVerificado: true, debeCambiarPassword: false }; }
      else if (pathname.endsWith('/horarios/publicacion/config') || pathname.endsWith('/horarios/publicacion/visibilidad')) {
        if (request.method === 'PUT') {
          if (failSave) { status = 500; message = 'No se pudo guardar la publicación.'; }
          else { publication = { ...JSON.parse(request.postData), actualizadoEn: new Date().toISOString() }; writes.push({ ...publication }); }
        }
        data = publication;
      } else if (pathname.endsWith('/horarios/publicacion/publico') || pathname.endsWith('/estudiantes/horarios-aulas')) {
        const publicado = publication[pathname.endsWith('/publico') ? 'publico' : 'estudiantes'];
        data = { publicado, aulas: publicado ? aulas : [], periodos: publicado ? [period] : [], horarios: publicado ? horarios : [] };
        if (failRead) { status = 500; message = 'No se pudieron consultar los horarios.'; }
      } else if (pathname.endsWith('/ubicacion/visibilidad')) data = { publico: false, estudiantes: false, actualizadoEn: null };
      else if (pathname.endsWith('/ubicacion/publico')) data = { publicado:false, aulas:[], periodos:[], horarios:[] };
      else if (pathname.endsWith('/notificaciones/pendientes')) data = {};
      else if (pathname.endsWith('/estudiantes/auxiliatura')) data = { habilitado: false };
      else data = datasets[pathname.split('/').at(-1)] || [];
      await send('Fetch.fulfillRequest', { requestId, responseCode: request.method === 'OPTIONS' ? 204 : status,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,PUT,POST,OPTIONS' }],
        body: Buffer.from(JSON.stringify({ success: status === 200, data, message })).toString('base64') });
    } catch (error) { if (error.code !== -32602 || error.message !== 'Invalid InterceptionId.') errors.push(error.stack || JSON.stringify(error)); }
  });
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const wait = async expr => { for (let n = 0; n < 150; n++) { if (await evaluate(expr)) return; await delay(100); } throw Error(`Timeout: ${expr}\n${await evaluate('document.body.innerText')}`); };
  const button = async label => { const expr = `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled)`; await wait(`Boolean(${expr})`); await evaluate(`${expr}.click()`); };
  const navigate = async route => { await send('Page.navigate', { url: origin + route }); await wait('document.querySelector("h1") !== null'); };
  const search = async value => { await evaluate(`(()=>{const input=document.getElementById('horarios-busqueda');input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));input.blur();})()`); await delay(100); };
  const rows = () => evaluate(`document.querySelectorAll('[aria-label="Lista de clases encontradas"] tbody tr').length`);
  const capacities = selector => evaluate(`[...document.querySelectorAll(${JSON.stringify(selector + ' .room-capacity')})].map(e=>e.textContent.trim())`);
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `const OriginalDate=Date;window.Date=class extends OriginalDate {constructor(...args){super(...(args.length?args:['2026-11-16T16:00:00Z']));}static now(){return Date.parse('2026-11-16T16:00:00Z');}};` });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate('/admin/horarios'); await wait(`document.querySelector('[aria-label="Publicación de horarios"] button') !== null`);
  failSave = true; await button('Publicar en portal público'); await wait('document.body.innerText.includes("No se pudo guardar la publicación")');
  assert.equal(publication.publico, false);
  failSave = false; await button('Publicar en portal público'); await wait('document.body.innerText.includes("Horarios publicados en el portal público")');
  assert.equal(publication.estudiantes, false);
  await button('Publicar en portal del estudiante'); await wait('document.body.innerText.includes("Horarios publicados en el portal del estudiante")');
  await navigate('/admin/horarios'); await wait(`document.querySelectorAll('[aria-label="Publicación de horarios"] a').length === 2`);
  assert.deepEqual(writes.map(w => [w.publico, w.estudiantes]), [[true, false], [true, true]]);
  audience = 'anonymous'; await navigate('/horarios'); await wait('document.getElementById("horarios-busqueda") !== null && document.body.innerText.includes("Periodo II/2026")');
  assert.equal(await evaluate('location.pathname'), '/horarios');
  assert.equal(await evaluate(`document.querySelector('header a[href="/horarios"]').textContent`), 'Horarios y ubicación');
  assert.equal(await evaluate('document.querySelector("h1").textContent'),'HORARIOS Y UBICACIÓN');
  assert.equal(await evaluate('document.querySelectorAll(".student-schedules-rooms article").length'),0,'La vista inicial prioriza los planos');
  assert.equal(await evaluate(`document.querySelector('header a[href="/ubicacion"]')`),null);
  await search('INF-111'); assert.equal(await rows(),3);
  await search('programacion'); assert.equal(await rows(),3);
  await search('LASIN-1'); assert.equal(await rows(),1);
  await search('ana perez'); assert.equal(await rows(), 2);
  assert.deepEqual(await capacities('.student-schedules-rooms'),['Capacidad del aula: 40 estudiantes','Capacidad del aula: 27 estudiantes']);
  assert.deepEqual(await capacities('[aria-label="Lista de clases encontradas"]'),['Capacidad del aula: 40 estudiantes','Capacidad del aula: 27 estudiantes']);
  assert.equal(await evaluate('document.querySelectorAll(".is-search-match").length'), 2);
  assert.equal(await evaluate('Boolean(document.getElementById("horarios-resultados").compareDocumentPosition(document.querySelector(".student-schedules-rooms")) & Node.DOCUMENT_POSITION_FOLLOWING)'), true);
  assert.ok(await evaluate(`document.querySelector('[aria-label="Lista de clases encontradas"]').innerText.includes('Programación I')`));
  await evaluate(`document.querySelector('a[aria-label="Ver horario del aula LASIN-1"]').click()`);
  assert.equal(await evaluate('location.hash'), '#horario-aula-LASIN-1'); assert.equal(await rows(), 2);
  await search('perez'); assert.equal(await rows(), 3);
  await search('no existe'); assert.equal(await rows(), 0);
  assert.ok(await evaluate('document.body.innerText.includes("No hay clases que coincidan")'));
  await search(''); assert.equal(await evaluate('document.getElementById("horarios-resultados")'), null);
  await evaluate(`document.querySelector('details summary').click()`);
  await evaluate(`(()=>{const s=[...document.querySelectorAll('details label')].find(l=>l.textContent.startsWith('Día')).querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'LUNES');s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait('document.querySelectorAll("details tbody tr").length === 1');
  assert.equal(await evaluate('document.querySelector("details tbody").textContent.includes("Ana Pérez")'),true,'El filtro por día conserva sus resultados');
  assert.deepEqual(await capacities('details tbody'),['Capacidad del aula: 40 estudiantes']);
  await button('SS-A1'); await wait('document.querySelectorAll(".student-schedules-rooms article").length === 1');
  assert.deepEqual(await capacities('.student-schedules-rooms'),['Capacidad del aula: 40 estudiantes'],'Abrir un aula desde el filtro conserva la capacidad');
  await button('Limpiar filtros de personas'); await evaluate(`document.querySelector('details summary').click()`);
  await search('ana'); await evaluate('document.getElementById("horarios-busqueda").focus()');
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown' });
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter' }); await delay(100);
  assert.equal(await rows(), 2); assert.equal(await evaluate('document.getElementById("horarios-busqueda").value'), 'Ana Pérez');
  aulas[0].capacidad=0; aulas[1].capacidad=null;
  await button('Actualizar horarios'); await wait('[...document.querySelectorAll(".student-schedules-rooms .room-capacity")].filter(e=>e.textContent.includes("Por confirmar")).length === 2');
  assert.deepEqual(await capacities('[aria-label="Lista de clases encontradas"]'),['Capacidad del aula: Por confirmar','Capacidad del aula: Por confirmar']);
  aulas[0].capacidad=1; await button('Actualizar horarios'); await wait('document.querySelector(".student-schedules-rooms .room-capacity")?.textContent.trim() === "Capacidad del aula: 1 estudiante"');
  aulas[0].capacidad=40; aulas[1].capacidad=27; await button('Actualizar horarios');
  await wait('document.querySelector(".student-schedules-rooms .room-capacity")?.textContent.trim() === "Capacidad del aula: 40 estudiantes"');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  const shot = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, 'busqueda-movil.png'), Buffer.from(shot.data, 'base64'));
  await evaluate('document.querySelector(".student-schedules-rooms article").scrollIntoView({block:"start",behavior:"instant"})');
  const capacityShot = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, 'horario-capacidad-movil.png'), Buffer.from(capacityShot.data, 'base64'));
  failRead = true; await button('Actualizar horarios'); await wait('document.body.innerText.includes("No se pudieron actualizar los horarios")');
  assert.equal(await rows(), 0); assert.equal(await evaluate('document.querySelectorAll(".is-search-match").length'), 0);
  failRead = false; await button('Reintentar'); await wait('document.querySelectorAll(".is-search-match").length === 2');
  audience = 'admin'; await navigate('/admin/horarios'); await button('Retirar en portal público'); await wait('document.body.innerText.includes("Publicación retirada en el portal público")');
  assert.equal(publication.estudiantes, true);
  audience = 'anonymous'; await navigate('/horarios'); await wait('document.body.innerText.includes("Horarios aún no publicados")');
  assert.equal(await evaluate(`document.querySelector('header a[href="/horarios"]')`), null);
  audience = 'student'; await navigate('/usuario/horarios'); await wait('document.querySelectorAll(".student-schedules-rooms article").length === 2');
  assert.deepEqual(await capacities('.student-schedules-rooms'),['Capacidad del aula: 40 estudiantes','Capacidad del aula: 27 estudiantes']);
  await search('ana perez'); assert.equal(await rows(), 2);
  assert.deepEqual(await capacities('.student-schedules-rooms'),['Capacidad del aula: 40 estudiantes','Capacidad del aula: 27 estudiantes']);
  assert.deepEqual(await capacities('[aria-label="Lista de clases encontradas"]'),['Capacidad del aula: 40 estudiantes','Capacidad del aula: 27 estudiantes']);
  await evaluate(`document.querySelector('details summary').click()`);
  await evaluate(`(()=>{const s=[...document.querySelectorAll('details label')].find(l=>l.textContent.startsWith('Día')).querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'MIERCOLES');s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait('document.querySelectorAll("details tbody tr").length === 1');
  assert.deepEqual(await capacities('details tbody'),['Capacidad del aula: 27 estudiantes']);
  assert.equal(await evaluate(`Boolean(document.querySelector('header a[href="/usuario/horarios"]'))`), true);
  audience = 'admin'; await navigate('/admin/horarios'); await button('Retirar en portal del estudiante'); await wait('document.body.innerText.includes("Publicación retirada en el portal del estudiante")');
  audience = 'student'; await navigate('/usuario/horarios'); await wait('document.body.innerText.includes("Horarios aún no publicados")');
  assert.equal(await evaluate(`document.querySelector('header a[href="/usuario/horarios"]')`), null);
  assert.deepEqual(errors, []);
  console.log('HORARIOS_OK: capacidad por aula en horarios, búsquedas y filtros públicos/estudiantiles, capacidad por confirmar, publicación, errores, teclado y móvil. Captura: ' + output);
})().catch(error => { console.error(error, { errors }); process.exitCode = 1; }).finally(async () => {
  ws?.close(); chrome?.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
});
