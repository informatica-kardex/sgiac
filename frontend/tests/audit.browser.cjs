// Desde la raíz: node frontend/tests/audit.browser.cjs
// Requiere vite build --outDir node_modules/.cache/audit-preview. API simulada, sin datos reales.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve('frontend/node_modules/.cache/audit-preview');
const output = path.resolve('frontend/node_modules/.cache/audit-browser'); fs.mkdirSync(output, { recursive: true });
const origin = 'http://127.0.0.1:5207', delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const permissions = ['ver-horarios', 'solicitudes-aulas', 'estudiantes', 'auditoria'];
let role = 'ADMINISTRADOR', allowed = permissions, fail = false, exportFail = false;
const requests = [], errors = [];
const user = () => ({ idUsuario: '7', nombreCompleto: 'Ana Auditora', correo: 'ana@umsa.bo', roles: [role], correoVerificado: true, debeCambiarPassword: false,
  permisos: allowed.map(modulo => ({ modulo, desde: null, hasta: null })) });
const item = id => ({ idBitacora: String(id), fechaHora: '2026-11-13T15:20:00Z', accion: 'HTTP_EXITO_MODIFICACION_AULAS_POST', entidadAfectada: 'aulas', idRegistroAfectado: '10',
  idUsuario: '7', usuario: { idUsuario: '7', nombreCompleto: 'Ana Auditora', correo: 'ana@umsa.bo' }, tipo: 'MODIFICACION', resultado: 'EXITO',
  detalle: { estadoHttp: 201, ip: '127.0.0.1', metodo: 'POST', ruta: '/api/aulas', requestId: 'test-request', respuesta: { message: 'Aula creada' }, entrada: { password: '[PROTEGIDO]' } } });
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, origin).pathname;
  const file = path.join(root, pathname.startsWith('/assets/') || pathname.startsWith('/images/') ? pathname : 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(resolve => server.listen(5207, '127.0.0.1', resolve));
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9357', '--user-data-dir=' + path.join(output, 'chrome'), 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let ws;
  try {
    let tabs;
    for (let n = 0; n < 50; n++) { try { tabs = await fetch('http://127.0.0.1:9357/json').then(r => r.json()); break; } catch { await delay(100); } }
    assert.ok(tabs, 'Chrome inició');
    ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
    let sequence = 0; const pending = new Map();
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
    ws.addEventListener('message', async message => {
      const data = JSON.parse(message.data);
      if (data.id) { const p = pending.get(data.id); pending.delete(data.id); return data.error ? p.reject(data.error) : p.resolve(data.result); }
      if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text);
      if (data.method !== 'Fetch.requestPaused') return;
      const { requestId, request } = data.params;
      try {
        const url = new URL(request.url), route = url.pathname; let payload = [], status = 200, raw = null, type = 'application/json';
        if (request.method !== 'OPTIONS') {
          requests.push({ route, query: Object.fromEntries(url.searchParams), method: request.method });
          if (route.endsWith('/auth/refresh')) payload = { accessToken: 'test-token', session: { id: 1, expiresAt: Date.now() + 180000 } };
          else if (route.endsWith('/auth/me')) payload = user();
          else if (route.endsWith('/auth/activity')) payload = { id: 1, expiresAt: Date.now() + 180000 };
          else if (route.endsWith('/notificaciones/pendientes')) payload = {};
          else if (route.endsWith('/events')) { type = 'text/event-stream'; raw = 'event: change\ndata: {}\n\n'; }
          else if (route.endsWith('/auditoria/filtros')) payload = { acciones: [item(1).accion], entidades: ['aulas'], usuarios: [item(1).usuario] };
          else if (route.endsWith('/auditoria/exportar')) { if (exportFail) { status = 400; payload = null; } else { type = 'text/csv'; raw = 'ID;Accion\r\n1;CREADO'; } }
          else if (route.endsWith('/auditoria')) {
            if (fail) status = 503;
            const page = Number(url.searchParams.get('pagina') || 1), limit = Number(url.searchParams.get('limite') || 25), total = url.searchParams.get('q') === 'sinresultados' ? 0 : 51;
            payload = { eventos: Array.from({ length: Math.max(0, Math.min(limit, total - (page - 1) * limit)) }, (_, i) => item((page - 1) * limit + i + 1)), total, pagina: page, limite: limit, paginas: Math.ceil(total / limit), resumen: { exitosos: total, rechazados: 0, errores: 0 } };
          } else if (/\/auditoria\/\d+$/.test(route)) payload = item(route.split('/').at(-1));
        }
        await send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [
          { name: 'Content-Type', value: type }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' },
          { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
        ], body: Buffer.from(raw ?? JSON.stringify({ success: status < 400, data: payload, message: status === 400 ? 'Reduce el rango de fechas' : status === 503 ? 'Auditoría no disponible' : 'OK' })).toString('base64') });
      } catch (e) { errors.push(String(e)); }
    });
    const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description); return r.result.value; };
    const waitFor = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(`Boolean(${expression})`)) return; await delay(75); } throw new Error('Timeout: ' + expression + '\n' + await evaluate('document.body.innerText')); };
    const go = async route => { await send('Page.navigate', { url: origin + route }); await waitFor('document.querySelector(".admin-sidebar")'); };
    const click = label => evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`);
    const fill = (selector, value) => evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await send('Runtime.enable'); await send('Page.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*' }] });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await go('/admin/subadministradores'); await waitFor('[...document.querySelectorAll("button")].some(b => b.textContent === "Añadir subadministrador" && !b.disabled)'); await click('Añadir subadministrador');
    await waitFor('document.querySelectorAll("[role=dialog] fieldset input[type=checkbox]").length === 14');
    const labels = await evaluate('document.querySelector("[role=dialog] fieldset").innerText');
    for (const label of ['solicitudes de aulas', 'Consultar horarios', 'cuentas de estudiantes', 'exportar auditoría']) assert.ok(labels.includes(label));
    await go('/admin/auditoria'); await waitFor('document.querySelectorAll("tbody tr").length === 25');
    assert.equal(await evaluate('document.body.innerText.includes("demostración")'), false);
    await click('Siguiente'); await waitFor('document.body.innerText.includes("Página 2 de 3")');
    await evaluate(`document.querySelector('button[aria-label="Ver detalle del evento 26"]').click()`);
    await waitFor('document.querySelector("[role=dialog]").innerText.includes("127.0.0.1")');
    assert.ok(await evaluate('document.querySelector("[role=dialog]").innerText.includes("[PROTEGIDO]")'));
    await evaluate('document.querySelector("button[aria-label=Cerrar]").click()');
    await fill('input[type=search]', 'sinresultados'); await click('Aplicar filtros'); await waitFor('document.body.innerText.includes("No hay eventos que coincidan")');
    await click('Limpiar filtros'); await waitFor('document.querySelectorAll("tbody tr").length === 25');
    await fill('input[type=date]', '2026-11-13'); await click('Aplicar filtros'); await waitFor('document.querySelectorAll("tbody tr").length === 25');
    await waitFor('!document.querySelector("button.btn-primary").disabled');
    assert.ok(requests.some(r => r.query.desde === '2026-11-13T04:00:00.000Z'));
    exportFail = true; await click('Exportar CSV'); await waitFor('document.body.innerText.includes("Reduce el rango de fechas")');
    exportFail = false; await click('Exportar CSV'); await waitFor('!document.body.innerText.includes("Exportando")');
    assert.ok(requests.filter(r => r.route.endsWith('/auditoria/exportar')).length >= 2);
    fail = true; await click('Actualizar'); await waitFor('document.body.innerText.includes("Auditoría no disponible")');
    fail = false; await click('Reintentar'); await waitFor('document.querySelectorAll("tbody tr").length === 25');
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true });
    await delay(150);
    const mobile = await evaluate('({ inner: innerWidth, viewport: visualViewport.width, scale: visualViewport.scale, body: document.body.getBoundingClientRect().width, scroll: document.documentElement.scrollWidth })');
    assert.ok(mobile.scroll <= 375 && mobile.viewport <= 375 && mobile.scale === 1, 'Sin desborde ni reducción automática en móvil: ' + JSON.stringify(mobile));
    const screenshot = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, 'auditoria-movil.png'), Buffer.from(screenshot.data, 'base64'));
    role = 'SUBADMINISTRADOR'; await go('/admin/auditoria'); await waitFor('document.querySelectorAll("tbody tr").length === 25');
    for (const module of permissions) assert.ok(await evaluate(`Boolean(document.querySelector('.admin-sidebar a[href="/admin/${module}"]'))`));
    assert.equal(await evaluate(`Boolean(document.querySelector('.admin-sidebar a[href="/admin/subadministradores"]'))`), false);
    await go('/admin/estudiantes'); await waitFor('document.body.innerText.includes("No hay estudiantes registrados")');
    allowed = []; await go('/admin/auditoria'); await waitFor('location.pathname === "/admin/dashboard"');
    assert.deepEqual(errors, []);
    console.log('OK: 14 funciones, listado, paginación, detalle, filtros, fechas Bolivia, CSV, errores, vista móvil y permisos delegados.');
  } finally { ws?.close(); chrome.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
