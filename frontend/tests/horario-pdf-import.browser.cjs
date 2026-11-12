// Real browser + real reference PDF; API/catalogue are isolated fixtures.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { spawn } = require('node:child_process');
const prismaPath = require.resolve('../../backend/dist/database/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { prisma: {} } };
const { importScheduleSchema, planScheduleImport } = require('../../backend/dist/modules/horarios/horario.import');
const source = require('../../backend/prisma/data/catalogo-pdf.json');
const output = path.resolve('.preview-academico/pdf-import'); fs.mkdirSync(output, { recursive: true });
const period = { idPeriodo: '1', gestion: 2026, periodo: 'II', estado: 'ACTIVO', fechaInicio: '2026-07-01', fechaFin: '2026-12-31' };
const database = { periodo: { id_periodo: 1n, gestion: 2026, periodo: 'II', estado: 'ACTIVO', fecha_inicio: new Date(period.fechaInicio), fecha_fin: new Date(period.fechaFin) },
  materias: source.materias.map((m, i) => ({ codigo_materia: `M-${i}`, nombre: m.nombre, estado: 'ACTIVO', siglas: m.siglas.map(sigla => ({ sigla })) })),
  docentes: [], aulas: source.aulas.map(a => ({ codigo_ambiente: a.codigo, estado: 'DISPONIBLE' })), asignaciones: [], horarios: [] };
const rooms = source.aulas.map((a, i) => ({ ...a, idAula: String(i + 1), estado: 'disponible', capacidad: 30, equipamiento: [] }));
const datasets = { aulas: rooms, periodos: [period, { ...period, idPeriodo: '2', gestion: 2027, periodo: 'I' }], docentes: [], auxiliares: [], materias: [], menciones: [], asignaciones: [], horarios: [] };
const errors = [], writes = []; let previews = 0, scheduleReads = 0, chrome, ws, send;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const root = path.resolve('frontend/dist');
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(root, url.startsWith('/assets/') || url.startsWith('/images/') ? url : 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9396', '--user-data-dir=' + path.join(output, 'chrome'), 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let launchError; chrome.on('error', error => { launchError = error; });
  let tabs;
  for (let n = 0; n < 100; n++) { if (launchError) throw launchError; try { tabs = await fetch('http://127.0.0.1:9396/json').then(r => r.json()); break; } catch { await delay(100); } }
  assert.ok(tabs, 'Chrome debe iniciar');
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  const waiting = new Map(); let seq = 0;
  send = (method, params = {}) => new Promise((resolve, reject) => { waiting.set(++seq, { resolve, reject }); ws.send(JSON.stringify({ id: seq, method, params })); });
  ws.addEventListener('message', async event => {
    const m = JSON.parse(event.data);
    if (m.id) { const p = waiting.get(m.id); waiting.delete(m.id); if (p) m.error ? p.reject(m.error) : p.resolve(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = m.params, pathname = new URL(request.url).pathname;
    let data = [], code = 200, message = '';
    try {
      if (request.method !== 'OPTIONS') {
        if (pathname.endsWith('/auth/refresh')) data = { accessToken: 'fixture', session: { id: 1, expiresAt: Date.now() + 3600000 } };
        else if (pathname.endsWith('/auth/me')) data = { idUsuario: 'fixture', nombreCompleto: 'Prueba', correo: 'prueba@example.test', roles: ['ADMINISTRADOR'], permisos: [], correoVerificado: true, debeCambiarPassword: false };
        else if (pathname.endsWith('/horarios/importar-pdf/validar')) { previews++; data = planScheduleImport(importScheduleSchema.parse(JSON.parse(request.postData)), database); }
        else if (pathname.endsWith('/horarios/importar-pdf/guardar')) {
          const payload = JSON.parse(request.postData), p = planScheduleImport(importScheduleSchema.parse(payload.datos), database);
          assert.equal(payload.huella, p.huella); writes.push(payload);
          for (const g of p.grupos.filter(g => g.estado === 'LISTO')) {
            let d = database.docentes.find(d => d.nombre_completo === g.docente);
            if (!d) { d = { id_docente: BigInt(database.docentes.length + 1), nombre_completo: g.docente, estado: 'ACTIVO' }; database.docentes.push(d); }
            const a = { id_paralelo: BigInt(database.asignaciones.length + 1), codigo_materia: g.codigoMateria, id_docente: d.id_docente, nombre_paralelo: g.paralelo, id_periodo: 1n, estado: 'ACTIVO' };
            database.asignaciones.push(a);
            for (const s of g.nuevas) {
              const id = database.horarios.length + 1;
              database.horarios.push({ id_horario: BigInt(id), id_paralelo: a.id_paralelo, codigo_ambiente: s.aula, dia_semana: s.dia, estado: 'ASIGNADO', fecha: null, id_auxiliar: null, es_auxiliar: false,
                bloque_horario: { hora_inicio: new Date(`1970-01-01T${s.horaInicio}:00Z`), hora_fin: new Date(`1970-01-01T${s.horaFin}:00Z`) }, paralelo: { ...a, periodo_academico: database.periodo } });
              datasets.horarios.push({ ...s, idHorario: id, idAsignacion: String(a.id_paralelo), idDocente: String(d.id_docente), idPeriodo: '1', periodo: 'II/2026', codigoMateria: g.codigoMateria,
                materia: g.materia, siglas: g.siglas, docente: g.docente, responsable: g.docente, grupo: g.paralelo, fecha: null, idAuxiliar: null, esAuxiliar: false, lugar: rooms.find(r => r.codigo === s.aula)?.lugar, piso: rooms.find(r => r.codigo === s.aula)?.piso });
            }
          }
          data = p.resumen;
        } else { if (pathname.endsWith('/academico/horarios')) scheduleReads++; data = datasets[pathname.split('/').at(-1)] ?? []; }
      }
    } catch (e) { code = 409; message = e.message; errors.push(e.message); }
    await send('Fetch.fulfillRequest', { requestId, responseCode: request.method === 'OPTIONS' ? 204 : code,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' }],
      body: Buffer.from(JSON.stringify({ success: code === 200, data, message })).toString('base64') });
  });
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const wait = async expr => { for (let n = 0; n < 300; n++) { if (await evaluate(expr)) return; await delay(100); } throw Error(`Timeout: ${expr}\n${await evaluate('document.body.innerText')}`); };
  const click = async label => { await wait(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled)`); await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`); };
  const load = async () => { const { root } = await send('DOM.getDocument'); const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' }); await send('DOM.setFileInputFiles', { nodeId, files: [path.resolve('referencias/Horarios Helen.pdf')] }); await wait('document.body.innerText.includes("198 grupos detectados") && !document.body.innerText.includes("Comprobando materias")'); };
  const screenshot = async name => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(r.data, 'base64')); };
  await send('Runtime.enable'); await send('Page.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1365, height: 950, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: origin + '/admin/horarios' }); await click('Importar PDF');
  await evaluate(`(()=>{const e=document.querySelector('input[type=file]'),dt=new DataTransfer();dt.items.add(new File(['no es pdf'],'invalido.pdf',{type:'application/pdf'}));e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait('document.body.innerText.includes("no contiene un PDF válido")'); assert.equal(previews, 0);
  await load(); assert.equal(writes.length, 0); assert.equal(previews, 1);
  await wait('[...document.querySelectorAll("button")].some(b=>/^Importar \\d+ sesiones$/.test(b.textContent)&&!b.disabled)');
  await screenshot('revision-escritorio');
  await click('Todos (198)');
  await evaluate(`(()=>{const d=[...document.querySelectorAll('details')].find(d=>d.querySelector('summary').textContent.includes('INF-111')&&d.querySelector('summary').textContent.includes('Paralelo C'));d.open=true;window.__pdfGroup=d;})()`);
  assert.equal(await evaluate('window.__pdfGroup.querySelectorAll("input:checked").length'), 0, 'Tres opciones no se seleccionan automáticamente');
  await evaluate('window.__pdfGroup.querySelectorAll("input[type=checkbox]")[0].click()');
  await evaluate('window.__pdfGroup.querySelectorAll("input[type=checkbox]")[1].click()');
  await wait('window.__pdfGroup.querySelectorAll("input:checked").length === 2');
  assert.equal(await evaluate('window.__pdfGroup.querySelectorAll("input[type=checkbox]")[2].disabled'), true);
  assert.equal(await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Importar 0 sesiones").disabled'), true);
  await click('Validar selección'); await wait('!document.body.innerText.includes("Comprobando materias")');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.equal(await evaluate('document.querySelector("[role=dialog]").scrollWidth<=document.querySelector("[role=dialog]").clientWidth'), true, 'Diálogo cabe en móvil');
  await screenshot('revision-movil');
  await send('Emulation.setDeviceMetricsOverride', { width: 1365, height: 950, deviceScaleFactor: 1, mobile: false });
  await evaluate(`[...document.querySelectorAll('button')].find(b=>/^Importar \\d+ sesiones$/.test(b.textContent)&&!b.disabled).click()`);
  await wait('document.body.innerText.includes("Importación completada")'); assert.equal(writes.length, 1); assert.ok(database.horarios.length > 0); assert.ok(scheduleReads > 1);
  await screenshot('resultado'); await click('Ver horarios'); await click('Importar PDF'); await load();
  await wait('document.body.innerText.includes("paralelos ya registrados")');
  assert.equal(await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Importar 0 sesiones").disabled'), true, 'Repetir PDF no genera duplicados');
  await evaluate(`(()=>{const s=[...document.querySelectorAll('[role=dialog] select')][0];Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'2');s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait('document.body.innerText.includes("el destino es I/2027")');
  assert.equal(await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Validar selección").disabled'), true);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'OK', pdf: '9 páginas, 198 grupos', previews, writes: writes.length, sessions: database.horarios.length, mobile: true, duplicateImportBlocked: true, periodMismatchBlocked: true, screenshots: output }));
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => { if (send && ws?.readyState === 1) { try { await send('Browser.close'); } catch {} } ws?.close(); chrome?.kill(); server.close(); });
