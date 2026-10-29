// Desde la raíz: node frontend/tests/documentos.browser.cjs (Chrome, frontend compilado).
// API simulada; no inicia el bot ni envía avisos reales.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const root = path.resolve('frontend/dist'), output = path.resolve('.preview-documentos');
fs.mkdirSync(output, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let session = 'admin', linked = false;
let tipo = { id: '1', nombre: 'Récord académico', identificador: 'DOC1', descripcion: 'Convocatoria Beca Comedor', habilitado: false, disponible: false, desde: null, hasta: null, plazoHoras: 48, demoraRecojoMinutos: 60, cupoDiario: 50, lugar: 'Kardex', requisitos: 'Trae tu identificación y hojas blancas tamaño carta.', correoHabilitado: true, horaInicio: '08:00', horaFin: '16:00', diasAtencion: [1,2,3,4,5], version: 1 };
const solicitudes = [], mutations = [], errors = [];
let extras = [];
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(root, pathname.startsWith('/assets/') || pathname.startsWith('/images/') ? pathname : 'index.html');
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); } res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(5197, '127.0.0.1', resolve));
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9347', '--user-data-dir=' + path.join(output, 'chrome'), 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let ws;
  try {
    let tabs; for (let i = 0; i < 100; i++) { try { tabs = await (await fetch('http://127.0.0.1:9347/json')).json(); break; } catch { await delay(100); } }
    ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
    let id = 0; const pending = new Map();
    const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
    ws.addEventListener('message', async e => {
      const m = JSON.parse(e.data);
      if (m.id) { const p = pending.get(m.id); pending.delete(m.id); return m.error ? p.reject(m.error) : p.resolve(m.result); }
      if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
      if (m.method !== 'Fetch.requestPaused') return;
      try {
        const { requestId, request } = m.params; const route = new URL(request.url).pathname;
        const body = request.postData ? JSON.parse(request.postData) : {};
        let data = {}, code = 200;
        if (request.method !== 'OPTIONS') {
          if (request.method !== 'GET') mutations.push({ route, method: request.method, body });
          if (route.endsWith('/auth/refresh')) data = { accessToken: 'preview' };
          else if (route.endsWith('/auth/me')) data = { idUsuario: session === 'student' ? '2' : '1', nombreCompleto: session === 'student' ? 'Ana Estudiante' : 'Kardex Documentos', correo: 'prueba@example.invalid', estado: 'ACTIVO', correoVerificado: true, debeCambiarPassword: false, roles: [session === 'student' ? 'CONSULTA_INTERNA' : session === 'subadmin' ? 'SUBADMINISTRADOR' : 'ADMINISTRADOR'], permisos: [{ modulo: 'documentos', desde: null, hasta: null }] };
          else if (route.endsWith('/documentos/tipos')) data = [tipo];
          else if (route.endsWith('/documentos/tipos/1') && request.method === 'PUT') { tipo = { ...tipo, ...body, disponible: body.habilitado, version: tipo.version + 1 }; data = { id: '1' }; }
          else if (route.endsWith('/documentos/responsables')) data = [{ id: '1', nombre: 'Kardex Documentos' }];
          else if (route.endsWith('/documentos/bandeja')) data = { solicitudes: [...solicitudes, ...extras].sort((a, b) => a.apellidos.localeCompare(b.apellidos, 'es')), total: solicitudes.length + extras.length, pagina: 1, resumen: Object.fromEntries(['SOLICITADA','EN_PREPARACION','LISTA','ENTREGADA'].map(estado => [estado, [...solicitudes, ...extras].filter(s => s.estado === estado).length])) };
          else if (route.endsWith('/documentos/mis-solicitudes') && request.method === 'GET') data = { tipos: [tipo], solicitudes };
          else if (route.endsWith('/documentos/mis-solicitudes') && request.method === 'POST') {
            data = { id: '1', codigo: tipo.identificador + '-2026-000001', idTipo: '1', documento: tipo.nombre, solicitante: 'Ana Estudiante', nombres: 'Ana', apellidos: 'Estudiante', ru: '123456', ci: '987654', motivo: body.motivo, detalle: body.detalle, estado: 'SOLICITADA', creadaEn: new Date().toISOString(), estimadaEn: new Date(Date.now() + 86400000).toISOString(), fechaRecojo: null, hojas: null, lugar: tipo.lugar, requisitos: tipo.requisitos, version: 1, correoHabilitado: true, responsable: null, correo: null, telegram: null, eventos: [{ id: '1', estado: 'SOLICITADA', descripcion: 'Solicitud recibida por Kardex.', fecha: new Date().toISOString() }] }; solicitudes.push(data);
          } else if (route.endsWith('/documentos/1/accion')) {
            const s = solicitudes[0]; s.version++;
            if (body.accion === 'PREPARAR') { s.estado = 'EN_PREPARACION'; s.responsable = { id: '1', nombre: 'Kardex Documentos' }; }
            if (body.accion === 'LISTA') { s.estado = 'LISTA'; s.fechaRecojo = body.fechaRecojo || new Date(Date.now() + 1800000).toISOString(); s.hojas = body.hojas; s.lugar = body.lugar; s.requisitos = body.requisitos; s.correo = { estado: 'ENVIADO', intentos: 1, enviadoEn: new Date().toISOString() }; s.telegram = { estado: 'OMITIDO', intentos: 0, enviadoEn: null }; }
            if (body.accion === 'ENTREGAR') s.estado = 'ENTREGADA';
            s.eventos.unshift({ id: String(s.version), estado: s.estado, descripcion: `Estado actualizado: ${s.estado}`, fecha: new Date().toISOString() }); data = s;
          } else if (route.endsWith('/telegram/vinculo')) {
            if (request.method === 'GET') data = { vinculado: linked, vinculadoEn: linked ? new Date().toISOString() : null, available: true, url: 'https://t.me/test_bot?start=faq' };
            else if (request.method === 'POST') data = { url: 'https://t.me/test_bot?start=sgiac_' + 'A'.repeat(43), expiraEn: new Date(Date.now() + 600000).toISOString() };
            else if (request.method === 'DELETE') { linked = false; data = null; }
          }
        }
        await send('Fetch.fulfillRequest', { requestId, responseCode: code, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: 'http://127.0.0.1:5197' }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' }], body: Buffer.from(JSON.stringify({ success: true, data })).toString('base64') });
      } catch (e) { errors.push(String(e)); }
    });
    const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
    const waitFor = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100); } throw new Error('Timeout: ' + expression + '\n' + await evaluate('document.body.innerText')); };
    const click = async text => { await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent === ${JSON.stringify(text)} && !b.disabled)`); await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === ${JSON.stringify(text)}).click()`); };
    const field = async (label, value) => evaluate(`(() => { const el = [...document.querySelectorAll('label')].find(l => l.textContent.startsWith(${JSON.stringify(label)})).control; const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); })()`);
    const checkbox = async label => evaluate(`[...document.querySelectorAll('label')].find(l => l.textContent.includes(${JSON.stringify(label)})).querySelector('input[type=checkbox]').click()`);
    const navigate = async route => { await send('Page.navigate', { url: 'http://127.0.0.1:5197' + route }); await waitFor('!!document.querySelector("h1")'); };
    const screenshot = async name => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(r.data, 'base64')); };
    await send('Runtime.enable'); await send('Page.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: '*://localhost:4000/api/*' }] });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate('/admin/documentos'); await click('Documentos y periodos'); await click('Configurar documento');
    assert.equal(await evaluate('document.querySelector("[role=dialog]").innerText.includes("Hojas en blanco a traer")'), false, 'No configura hojas por adelantado');
    await checkbox('Habilitar solicitudes'); await field('Identificador de las fichas', 'REC'); await field('Plazo estimado (horas)', '24'); await field('Espera mínima', '30');
    await click('Guardar configuración'); await waitFor('!document.querySelector("[role=dialog]")');
    assert.equal(tipo.habilitado, true); assert.equal(tipo.plazoHoras, 24); assert.equal(tipo.demoraRecojoMinutos, 30);
    assert.equal(tipo.identificador, 'REC'); assert.equal('hojas' in mutations.find(m => m.route.endsWith('/tipos/1')).body, false);
    await screenshot('configuracion-admin');
    session = 'student'; await navigate('/usuario/documentos'); await waitFor('document.body.innerText.includes("Vincular mi Telegram")');
    assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Vincular mi Telegram').disabled`), true);
    await checkbox('Quiero vincular mi Telegram'); await click('Vincular mi Telegram'); await waitFor('document.body.innerText.includes("Abrir Telegram para confirmar")');
    assert.equal(mutations.find(m => m.route.endsWith('/telegram/vinculo') && m.method === 'POST').body.consentimiento, true);
    linked = true; await click('Ya lo vinculé: actualizar'); await waitFor('document.body.innerText.includes("Desvincular Telegram")');
    await click('Desvincular Telegram'); await click('Desvincular'); await waitFor('!document.querySelector("[role=dialog]")'); assert.equal(linked, false);
    await field('Documento', '1'); await field('Detalle adicional', 'Para la convocatoria de Beca Comedor.'); await click('Enviar solicitud');
    await waitFor('document.body.innerText.includes("Tu ficha es REC-2026-000001")'); assert.equal(solicitudes.length, 1);
    await waitFor('document.body.innerText.includes("Se indicarán cuando el documento esté listo")');
    extras = ['Arce Flores', 'Mamani Quispe', 'Medina Rojas', 'Pérez Gómez', 'Quispe Flores', 'Ramos Condori', 'Rojas López', 'Salinas Castro', 'Torrez Vargas', 'Vargas Lima'].map((apellidos, i) => ({ ...solicitudes[0], id: String(i + 2), codigo: `REC-2026-${String(i + 2).padStart(6, '0')}`, nombres: ['Lucía', 'Marco', 'Sofía', 'John Grover', 'Elena', 'Daniel', 'Mónica', 'José', 'Valeria', 'Luis'][i], apellidos }));
    session = 'subadmin'; await navigate('/admin/documentos');
    await waitFor(`document.querySelectorAll('ul[aria-label="Solicitudes por apellidos"] button').length === 11`);
    assert.equal(await evaluate(`document.querySelector('ul[aria-label="Solicitudes por apellidos"] button').getBoundingClientRect().height < 65`), true, 'Filas compactas');
    assert.equal(await evaluate(`document.querySelector('ul[aria-label="Solicitudes por apellidos"]').innerText.includes('Hojas:')`), false);
    const abrirSolicitud = () => evaluate(`[...document.querySelectorAll('ul[aria-label="Solicitudes por apellidos"] button')].find(b => b.title.endsWith('REC-2026-000001')).click()`);
    await screenshot('bandeja-compacta'); await abrirSolicitud();
    await waitFor('document.querySelector("[role=dialog]")?.innerText.includes("987654")');
    assert.equal(await evaluate('document.querySelector("[role=dialog]").getBoundingClientRect().width <= 512'), true, 'Detalle de ancho sencillo');
    await screenshot('detalle-ci-nombre');
    await click('Iniciar preparación'); await waitFor('document.querySelector("[role=dialog]")?.innerText.includes("En preparación")');
    await click('Marcar impreso y listo'); await waitFor('document.body.innerText.includes("Hora automática")');
    assert.equal(await evaluate('document.querySelector("[role=dialog] input[type=number]").value'), '', 'Debe indicar hojas al marcar listo');
    assert.equal(await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "Marcar listo y notificar").disabled'), true);
    await field('Cantidad de hojas en blanco', '3'); await screenshot('marcar-listo'); await click('Marcar listo y notificar'); await waitFor('!document.querySelector("[role=dialog]") && document.body.innerText.includes("Documento listo. Hora de recojo confirmada")');
    const ready = mutations.find(m => m.body.accion === 'LISTA'); assert.equal(ready.body.hojas, 3); assert.equal('fechaRecojo' in ready.body, false, 'El servidor calcula la hora');
    await screenshot('bandeja-subadmin');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate(`document.querySelector('input[placeholder="CI, apellidos, nombre o código de ficha"]').getBoundingClientRect().width > 250`), true, 'Buscador utilizable en móvil');
    await abrirSolicitud(); await waitFor('!!document.querySelector("[role=dialog]")');
    assert.equal(await evaluate('document.querySelector("[role=dialog]").getBoundingClientRect().width <= innerWidth'), true);
    await screenshot('detalle-movil'); await evaluate('document.querySelector("button[aria-label=Cerrar]").click()');
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await click('Documentos y periodos'); assert.equal(await evaluate('document.body.innerText.includes("Configurar documento")'), false);
    session = 'student'; await navigate('/usuario/documentos'); await waitFor('document.body.innerText.includes("Lista para recoger")');
    await screenshot('estudiante-escritorio');
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.equal(await evaluate('document.documentElement.scrollWidth > innerWidth'), false, 'Sin desborde horizontal en móvil'); await screenshot('estudiante-movil');
    await evaluate('window.print = () => { window.__printed = true; }'); await click('Imprimir ficha'); await waitFor('window.__printed === true');
    await send('Emulation.setEmulatedMedia', { media: 'print' });
    assert.equal(await evaluate('getComputedStyle(document.querySelector("#root")).display'), 'none');
    assert.equal(await evaluate('getComputedStyle(document.querySelector(".document-ticket-print")).display'), 'block');
    const pdf = await send('Page.printToPDF', { printBackground: true }); fs.writeFileSync(path.join(output, 'ficha-recojo.pdf'), Buffer.from(pdf.data, 'base64'));
    assert.deepEqual(errors, []);
    console.log('DOCUMENTOS_UI_OK: identificador configurable, bandeja compacta por apellido, detalle CI/nombre, hojas solo al marcar listo, hora automática, Telegram, móvil e impresión. API simulada.');
    await send('Browser.close');
  } finally { ws?.close(); chrome.kill(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; server.close(); });
