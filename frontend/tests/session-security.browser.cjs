// Chrome + API simulada. Compilar en .preview-auth/dist; no usa cuentas ni datos reales.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const output = path.resolve('.preview-auth');
const root = path.join(output, 'dist');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let now = Date.now(), session = null, nextId = 1, selectedRole = 'CONSULTA_INTERNA';
let requireTwoFactor = false, verified = true, temporary = false, rejectActivity = false;
let expireAccessReads = 0, rejectRefresh = false;
const calls = [], errors = [], clients = [];
const user = () => ({ idUsuario: selectedRole, nombreCompleto: 'Persona Prueba', correo: 'prueba@fcpn.edu.bo',
  roles: [selectedRole], permisos: selectedRole === 'SUBADMINISTRADOR' ? [{ modulo: 'aulas', desde: null, hasta: null }] : [],
  correoVerificado: verified, debeCambiarPassword: temporary });
const establish = () => { session = { id: nextId++, expiresAt: now + 180000 }; return { usuario: user(), accessToken: 'test-access', session }; };
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(root, pathname.startsWith('/assets/') || pathname.startsWith('/images/') ? pathname : 'index.html');
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.end(fs.readFileSync(file));
});
let chrome;
async function connect(tab) {
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let sequence = 0, scriptId;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
  });
  ws.addEventListener('message', async event => {
    const message = JSON.parse(event.data);
    if (message.id) { const p = pending.get(message.id); pending.delete(message.id); message.error ? p.reject(message.error) : p.resolve(message.result); return; }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method !== 'Fetch.requestPaused') return;
    const { requestId, request } = message.params;
    try {
      const pathname = new URL(request.url).pathname;
      let data = [], status = 200, sessionExpired = false;
      if (request.method !== 'OPTIONS') {
        calls.push({ pathname, method: request.method });
        const valid = session && session.expiresAt > now;
        sessionExpired = !valid;
        if (pathname.endsWith('/auth/refresh')) { if (valid && !rejectRefresh) data = { accessToken: 'test-access', session }; else status = 401; }
        else if (pathname.endsWith('/auth/me')) { if (valid) data = user(); else status = 401; }
        else if (pathname.endsWith('/auth/login/captcha')) data = { captchaId: 'a'.repeat(64), image: 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64') };
        else if (pathname.endsWith('/auth/login')) {
          if (JSON.parse(request.postData).contrasena === 'incorrecta') status = 401;
          else if (requireTwoFactor) data = { requiresTwoFactor: true, challengeId: 'b'.repeat(64), maskedEmail: 'p***@fcpn.edu.bo', expiresIn: 300 };
          else data = establish();
        }
        else if (pathname.endsWith('/auth/login/verify')) data = establish();
        else if (pathname.endsWith('/auth/activity')) {
          if (!valid) status = 401;
          else if (rejectActivity) status = 503;
          else { session = { ...session, expiresAt: now + 180000 }; data = session; }
        }
        else if (pathname.endsWith('/auth/logout')) { session = null; data = null; }
        else if (pathname.endsWith('/auth/resend-verification')) data = { mensaje: 'Enviado', reenviarEn: 60 };
        else if (pathname.endsWith('/horarios')) {
          if (!valid) status = 401;
          else if (expireAccessReads > 0) { expireAccessReads--; status = 401; }
          else data = [{ idHorario: 1, materia: 'Materia privada', docente: 'Docente', aula: 'A1', dia: 'LUNES', horaInicio: '08:00', horaFin: '10:00' }];
        }
        else if (pathname.endsWith('/reportes/dashboard')) data = { totalAulas: 1, comunicadosActivos: 0, totalUsuarios: 3, atencionesPendientes: 0, aulasDisponibles: 1, totalHorarios: 1 };
        else if (pathname.endsWith('/documentos/mis-solicitudes')) data = { solicitudes: [] };
        else if (pathname.includes('/solicitudes-aulas/perfil')) data = { habilitado: false };
      }
      await send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [
        { name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: 'http://127.0.0.1:5197' },
        { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' },
        { name: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
      ], body: Buffer.from(JSON.stringify({ success: status === 200, data, message: 'Respuesta de prueba', ...(status === 401 && sessionExpired && !pathname.includes('/auth/login') ? { details: { code: 'SESSION_EXPIRED' } } : {}) })).toString('base64') });
    } catch (error) { errors.push(String(error)); }
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const wait = async expression => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(100); }
    throw Error('Timeout: ' + expression + '\n' + await evaluate('document.body.innerText'));
  };
  const clock = async () => {
    if (scriptId) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId });
    scriptId = (await send('Page.addScriptToEvaluateOnNewDocument', { source: `const RealDate=Date;window.__now=${now};window.Date=class extends RealDate{constructor(...a){super(...(a.length?a:[window.__now]));}static now(){return window.__now;}};` })).identifier;
  };
  const go = async route => { await clock(); await send('Page.navigate', { url: 'http://127.0.0.1:5197' + route }); await wait('document.querySelector("main") !== null'); };
  const field = async (id, value) => evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const submit = async () => evaluate('document.querySelector("main form").requestSubmit()');
  const screenshot = async name => { const result = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(result.data, 'base64')); };
  await send('Runtime.enable'); await send('Page.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*' }] });
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  const client = { ws, send, evaluate, wait, go, field, submit, screenshot }; clients.push(client); return client;
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  await new Promise(resolve => server.listen(5197, '127.0.0.1', resolve));
  chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9347', '--user-data-dir=' + path.join(output, 'chrome'), 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let tabs;
  for (let i = 0; i < 60; i++) { try { tabs = await fetch('http://127.0.0.1:9347/json').then(r => r.json()); break; } catch { await delay(200); } }
  const c = await connect(tabs.find(tab => tab.type === 'page'));
  const login = async (role, options = {}) => {
    session = null; selectedRole = role; requireTwoFactor = !!options.twoFactor; verified = options.verified !== false; temporary = !!options.temporary;
    await c.go('/login'); await c.wait('document.getElementById("login-captcha") && !document.getElementById("login-captcha").disabled');
    await c.field('institutional-email', 'prueba@fcpn.edu.bo'); await c.field('institutional-password', 'correcta'); await c.field('login-captcha', 'ABC234'); await c.submit();
    if (requireTwoFactor) {
      await c.wait('document.getElementById("login-verification") !== null'); assert.equal(session, null);
      await c.field('login-verification', '123456'); await c.submit();
    }
    const prefix = role === 'CONSULTA_INTERNA' ? '/usuario' : '/admin';
    await c.wait(`location.pathname===${JSON.stringify(prefix + (!verified ? '/verificar-correo' : temporary ? '/cambiar-password' : '/dashboard'))}`);
  };
  const advance = async ms => { now += ms; await Promise.all(clients.map(client => client.evaluate(`window.__now=${now}`))); await delay(1200); };
  await c.go('/'); await c.wait('document.body.innerText.includes("Últimos comunicados")');
  assert.equal(await c.evaluate('document.querySelector("a[href=\'/horarios\']")===null && !document.body.innerText.includes("Horarios publicados")'), true);
  assert.equal(calls.some(call => call.pathname === '/api/horarios'), false);
  await c.screenshot('portal-publico');
  await c.go('/horarios'); await c.wait('location.pathname==="/login"');
  await c.go('/admin/login'); await c.wait('location.pathname==="/login"');
  await c.wait('document.getElementById("login-captcha") && !document.getElementById("login-captcha").disabled');
  const refreshesBeforeError = calls.filter(call => call.pathname.endsWith('/auth/refresh')).length;
  await c.field('institutional-email', 'prueba@fcpn.edu.bo'); await c.field('institutional-password', 'incorrecta'); await c.field('login-captcha', 'ABC234'); await c.submit();
  await c.wait('document.body.innerText.includes("Respuesta de prueba")');
  assert.equal(calls.filter(call => call.pathname.endsWith('/auth/refresh')).length, refreshesBeforeError, 'Una contraseña incorrecta no restaura otra sesión');
  await c.screenshot('login-unico');

  for (const role of ['ADMINISTRADOR', 'SUBADMINISTRADOR', 'CONSULTA_INTERNA']) {
    await login(role);
    if (role === 'CONSULTA_INTERNA') { await c.go('/admin/usuarios'); await c.wait('location.pathname==="/usuario/dashboard"'); }
    if (role === 'SUBADMINISTRADOR') { await c.go('/admin/roles'); await c.wait('location.pathname==="/admin/dashboard"'); assert.equal(await c.evaluate('document.querySelector("a[href=\'/admin/roles\']")===null'), true); }
  }
  await c.go('/usuario/horarios'); await c.wait('document.body.innerText.includes("Materia privada")');
  await c.screenshot('horarios-estudiante');
  expireAccessReads = 1;
  const beforeRefresh = session.expiresAt;
  // Navegación interna para que la consulta provoque una renovación del access.
  await c.evaluate('document.querySelector("a[href=\'/usuario/dashboard\']").click()');
  await c.wait('location.pathname==="/usuario/dashboard"');
  await c.evaluate('document.querySelector("a[href=\'/usuario/horarios\']").click()');
  await c.wait('document.body.innerText.includes("Materia privada")');
  assert.equal(expireAccessReads, 0); assert.equal(session.expiresAt, beforeRefresh);
  await login('ADMINISTRADOR', { twoFactor: true });
  await login('SUBADMINISTRADOR', { temporary: true });
  await login('CONSULTA_INTERNA', { verified: false });
  assert.equal(calls.some(call => call.pathname.includes('/auth/admin/login')), false);

  await login('CONSULTA_INTERNA');
  const originalExpiry = session.expiresAt;
  const activityCount = () => calls.filter(call => call.pathname.endsWith('/auth/activity')).length;
  const beforeIdle = activityCount();
  await advance(150000); await c.wait('document.querySelector("dialog[open]")!==null');
  assert.equal(session.expiresAt, originalExpiry); assert.equal(activityCount(), beforeIdle);
  await c.screenshot('aviso-inactividad');
  await c.evaluate('[...document.querySelectorAll("dialog button")].find(b=>b.textContent==="Continuar sesión").click()');
  await c.wait('document.querySelector("dialog[open]")===null');
  assert.equal(session.expiresAt, now + 180000);
  await c.go('/usuario/horarios'); // Recargar no reinicia el plazo.
  await c.wait('document.body.innerText.includes("Materia privada")');
  const beforeReload = session.expiresAt;
  await advance(150000); await c.wait('document.querySelector("dialog[open]")!==null');
  assert.equal(session.expiresAt, beforeReload);
  rejectActivity = true;
  await c.evaluate('[...document.querySelectorAll("dialog button")].find(b=>b.textContent==="Continuar sesión").click()');
  await c.wait('document.querySelector("dialog").innerText.includes("No se pudo prolongar")');
  await advance(30000); await c.wait('location.pathname==="/login"'); rejectActivity = false;
  assert.equal(session, null);
  await c.go('/usuario/horarios'); await c.wait('location.pathname==="/login"');

  await login('SUBADMINISTRADOR');
  await advance(90000);
  const beforeInput = activityCount();
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Shift', code: 'ShiftLeft', windowsVirtualKeyCode: 16 });
  for (let i = 0; activityCount() === beforeInput && i < 50; i++) await delay(100);
  assert.ok(activityCount() > beforeInput, 'La interacción real prolonga la sesión');

  const otherTab = await fetch('http://127.0.0.1:9347/json/new?about:blank', { method: 'PUT' }).then(r => r.json());
  const second = await connect(otherTab); await second.go('/admin/dashboard'); await second.wait('document.querySelector("main h1")!==null');
  await advance(150000);
  await c.wait('document.querySelector("dialog[open]")!==null'); await second.wait('document.querySelector("dialog[open]")!==null');
  await second.evaluate('[...document.querySelectorAll("dialog button")].find(b=>b.textContent==="Continuar sesión").click()');
  await c.wait('document.querySelector("dialog[open]")===null');
  await advance(180000); await c.wait('location.pathname==="/login"'); await second.wait('location.pathname==="/login"');
  await login('CONSULTA_INTERNA');
  expireAccessReads = 1; rejectRefresh = true;
  await c.evaluate('document.querySelector("a[href=\'/usuario/horarios\']").click()');
  await c.wait('location.pathname==="/login"');
  rejectRefresh = false;
  assert.deepEqual(errors, []);
  console.log('OK: ingreso por tres roles, 2FA, correo y contraseña temporal, rutas protegidas, horarios privados, aviso, continuar, expiración, recarga, actividad real y dos pestañas.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  clients.forEach(c => c.ws.close()); if (chrome) chrome.kill(); await new Promise(resolve => server.close(resolve));
});
