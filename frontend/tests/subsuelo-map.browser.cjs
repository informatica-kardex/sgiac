// Run from the workspace root after building the frontend.
// SGIAC_UI_DIST may point to a separate build. All API traffic is mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const root = path.resolve(process.env.SGIAC_UI_DIST || 'frontend/dist');
const output = path.resolve('.preview-academico/ubicacion');
fs.mkdirSync(output, { recursive: true });
const profile = fs.mkdtempSync(path.join(output, 'chrome-'));
const period = { idPeriodo: '1', gestion: 2026, periodo: 'II', estado: 'ACTIVO', fechaInicio: '2026-07-01', fechaFin: '2026-12-31' };
let aulas = require('../../backend/prisma/data/aulas-kardex.json').aulas.filter(a => a.lugar === 'INFORMATICA').map(a => ({...a,idAula:a.codigo,nombre:a.codigo,estado:'disponible',ubicacion:''}));
aulas.find(a=>a.codigo==='SS-A1').capacidad=45;
aulas.find(a=>a.codigo==='SS-A2').capacidad=0;
aulas.find(a=>a.codigo==='PB-A1').capacidad=32;
const assignment = { idAsignacion: '1', idDocente: '1', codigoMateria: 'INF-111', siglas: ['INF-111'], materia: 'Programación I', docente: 'Docente de prueba', grupo: 'A', idPeriodo: '1', periodo: 'II/2026', estado: 'ACTIVO' };
const datasets = { periodos: [period], materias: [{ codigo: 'INF-111', siglas: ['INF-111'], nombre: 'Programación I', estado: 'ACTIVO' }], docentes: [{ idDocente: '1', nombreCompleto: 'Docente de prueba', estado: 'ACTIVO', asignaciones: [assignment] }], asignaciones: [assignment], auxiliares: [], menciones: [], horarios: [] };
const errors = [], writes = [];
let chrome, ws, send, origin, failRooms = false, failSave = false, audience = 'admin', publication = {publico:false,estudiantes:false,actualizadoEn:null};
let schedulesPublished = true;
const publicationWrites = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(root, url.startsWith('/assets/') || url.startsWith('/images/') ? url : 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let launchError, port;
  chrome.on('error', error => { launchError = error; });
  for (let n = 0; n < 100; n++) {
    if (launchError) throw launchError;
    try { port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; break; } catch { await delay(100); }
  }
  assert.ok(port, 'Chrome debe iniciar');
  const tabs = await fetch(`http://127.0.0.1:${port}/json`).then(r => r.json());
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  const pending = new Map(); let seq = 0;
  send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++seq, { resolve, reject }); ws.send(JSON.stringify({ id: seq, method, params })); });
  ws.addEventListener('message', async event => {
    const m = JSON.parse(event.data);
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); if (p) m.error ? p.reject(m.error) : p.resolve(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method !== 'Fetch.requestPaused') return;
    try {
      const { requestId, request } = m.params, pathname = new URL(request.url).pathname;
      let data = [], status = 200, message = '';
      if (request.method !== 'OPTIONS') {
        if (pathname.endsWith('/auth/refresh')) { if (audience === 'anonymous') status = 401; else data = { accessToken: 'fixture', session: { id: 1, expiresAt: Date.parse('2027-01-01') } }; }
        else if (pathname.endsWith('/auth/me')) { if (audience === 'anonymous') status = 401; else data = { idUsuario: '1', nombreCompleto: 'Prueba local', correo: 'prueba@example.test', roles: [audience === 'admin' ? 'ADMINISTRADOR' : audience === 'aulas-only' ? 'SUBADMINISTRADOR' : 'CONSULTA_INTERNA'], permisos: audience === 'aulas-only' ? [{modulo:'aulas',desde:null,hasta:null}] : [], correoVerificado: true, debeCambiarPassword: false }; }
        else if (pathname.endsWith('/ubicacion/config') || pathname.endsWith('/ubicacion/visibilidad')) {
          if (request.method === 'PUT') { publication = {...JSON.parse(request.postData),actualizadoEn:new Date().toISOString()}; publicationWrites.push({...publication}); }
          data = publication;
        } else if (pathname.endsWith('/ubicacion/publico') || pathname.endsWith('/ubicacion/estudiantes')) {
          const student = pathname.endsWith('/estudiantes'), published = publication[student ? 'estudiantes' : 'publico'];
          data = {publicado:published,aulas:published ? aulas : [],periodos:published && student ? datasets.periodos : [],horarios:published && student ? datasets.horarios : []};
        }
        else if (pathname.endsWith('/horarios/publicacion/visibilidad')) data = {publico:schedulesPublished,estudiantes:schedulesPublished,actualizadoEn:null};
        else if (pathname.endsWith('/horarios/publicacion/publico')) data = {publicado:schedulesPublished,aulas:schedulesPublished ? aulas : [],periodos:schedulesPublished ? datasets.periodos : [],horarios:schedulesPublished ? datasets.horarios : []};
        else if (pathname.endsWith('/horarios/lote') && request.method === 'POST') {
          if (failSave) { status=409; message='El aula ya tiene una asignación en ese horario.'; }
          else {
            const payload = JSON.parse(request.postData); writes.push(payload);
            data = payload.sesiones.map((session, i) => ({ ...assignment, ...session, idHorario: i + 1, responsable: assignment.docente, lugar: 'INFORMATICA', piso: -1, avisos: [] }));
            datasets.horarios.push(...data);
          }
        } else if (/\/horarios\/\d+$/.test(pathname) && request.method === 'PUT') {
          const id=Number(pathname.split('/').at(-1)), payload=JSON.parse(request.postData);
          const index=datasets.horarios.findIndex(h=>h.idHorario===id);
          data={...datasets.horarios[index],...payload,avisos:[]}; datasets.horarios[index]=data; writes.push({method:'PUT',id,payload});
        } else if (/\/horarios\/\d+$/.test(pathname) && request.method === 'DELETE') {
          const id=Number(pathname.split('/').at(-1)); datasets.horarios=datasets.horarios.filter(h=>h.idHorario!==id); data={avisos:[]}; writes.push({method:'DELETE',id});
        } else if (pathname.endsWith('/academico/aulas')) { data = aulas; if (failRooms) status = 500; }
        else data = datasets[pathname.split('/').at(-1)] || [];
      }
      await send('Fetch.fulfillRequest', { requestId, responseCode: request.method === 'OPTIONS' ? 204 : status,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' }],
        body: Buffer.from(JSON.stringify({ success: status === 200, data, message: status === 500 ? 'No se pudieron cargar las aulas.' : message })).toString('base64') });
    } catch (error) {
      // Navigating away may cancel an intercepted request before its mock is sent.
      if (error.code !== -32602 || error.message !== 'Invalid InterceptionId.') errors.push(error.stack || JSON.stringify(error));
    }
  });
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const wait = async expr => { for (let n = 0; n < 150; n++) { if (await evaluate(expr)) return; await delay(100); } throw Error(`Timeout: ${expr}\n${await evaluate('document.body.innerText')}`); };
  const click = async label => { const expr = `[...document.querySelectorAll('button,summary')].find(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled&&b.getClientRects().length)`; await wait(`Boolean(${expr})`); await evaluate(`${expr}.click()`); };
  const field = async (label, value) => { await evaluate(`(()=>{const l=[...document.querySelectorAll('label')].find(l=>l.getClientRects().length&&l.querySelector(':scope > span')?.textContent===${JSON.stringify(label)});const e=l.querySelector('input,select');Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`); };
  const fieldValue = label => evaluate(`(()=>{const l=[...document.querySelectorAll('label')].find(l=>l.getClientRects().length&&l.querySelector(':scope > span')?.textContent===${JSON.stringify(label)});return l.querySelector('input,select').value;})()`);
  const key = async (key,code=key) => { await send('Input.dispatchKeyEvent',{type:'keyDown',key,code}); await send('Input.dispatchKeyEvent',{type:'keyUp',key,code}); };
  const oneDialog = async () => assert.equal(await evaluate('[...document.querySelectorAll("[role=dialog]")].filter(d=>d.getClientRects().length).length'),1,'Solo hay un diálogo visible');
  const closeSchedule = async () => { await click('Volver al mapa'); await wait('document.querySelector("[data-room-schedule-modal]") === null'); };
  const screenshot = async (name,selector) => {
    const clip = selector ? await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height,scale:1};})()`) : undefined;
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: Boolean(clip), ...(clip ? {clip} : {}) }); fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(r.data, 'base64'));
  };
  const navigate = async route => { await send('Page.navigate', { url: origin + route }); await wait('document.querySelector("h1") !== null'); };
  const map = async () => { await navigate('/admin/aulas'); await click('Ubicación'); await wait('document.querySelector(".subsuelo-map") !== null'); };
  const polygonClick = async code => {
    const point = await evaluate(`(()=>{const p=document.querySelector('svg [aria-label="Abrir horario del aula ${code}"] polygon');p.scrollIntoView({block:'center',behavior:'instant'});const r=p.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
  };
  const roomReady = code => wait(`document.querySelector('[data-room-schedule-modal="${code}"] [role=dialog] h3')?.textContent === 'Horario del aula ${code}'`);
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `const OriginalDate=Date;window.Date=class extends OriginalDate {constructor(...args){super(...(args.length?args:['2026-11-15T16:00:00Z']));}static now(){return Date.parse('2026-11-15T16:00:00Z');}};` });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
  await map();
  assert.equal(await evaluate('document.querySelectorAll(".subsuelo-legend li").length'), 9);
  assert.equal(await evaluate('document.querySelectorAll("svg [role=button]").length'), 4);
  await screenshot('ubicacion-escritorio');
  await screenshot('plano-subsuelo','.subsuelo-map');
  const floors = [{name:'Planta baja',floor:0,code:'PB-A1'},{name:'Primer piso',floor:1,code:'P1-A2'},{name:'Segundo piso',floor:2},{name:'Tercer piso',floor:3,code:'P3-LAB2'},{name:'Cuarto piso',floor:4,code:'P4-A4'},{name:'Quinto piso',floor:5,code:'P5-A5'},{name:'Sexto piso',floor:6}];
  for (const floor of floors) {
    await evaluate(`document.querySelector('button[aria-label="${floor.name}"]').click()`);
    await wait(`document.querySelector('.subsuelo-map')?.dataset.floor === '${floor.floor}'`);
    await screenshot('plano-piso-'+floor.floor,'.subsuelo-map');
    if (floor.code) {
      await polygonClick(floor.code); await roomReady(floor.code); await oneDialog();
      assert.equal(await evaluate('location.pathname'),'/admin/aulas');
      const scroll=await evaluate('scrollY');
      await closeSchedule();
      assert.equal(await evaluate('document.querySelector(".subsuelo-map").dataset.floor'),String(floor.floor));
      assert.equal(await evaluate('scrollY'),scroll,'Cerrar conserva la posición en el mapa');
    }
  }
  await evaluate(`document.querySelector('button[aria-label="Todas las aulas"]').click()`);
  await wait('document.querySelectorAll(".subsuelo-map").length === 8');
  await map();
  for (const code of ['SS-A1', 'SS-A2', 'SS-A3', 'SS-A4']) {
    await polygonClick(code); await roomReady(code);
    assert.equal(await evaluate('location.pathname'),'/admin/aulas'); await oneDialog();
    await closeSchedule();
  }
  await polygonClick('SS-A1'); await roomReady('SS-A1');
  await screenshot('horario-modal-mapa');
  await click('Asignar en esta aula');
  await wait('document.querySelector("[role=dialog] h3")?.textContent === "Asignar horario"'); await oneDialog();
  assert.equal(await evaluate(`[...document.querySelectorAll('label')].find(l=>l.querySelector(':scope > span')?.textContent==='Aula · sesión 1').querySelector('select').value`), 'SS-A1');
  await screenshot('asignacion-desde-mapa');
  await field('Materia', 'INF-111'); await field('Docente', '1');
  failSave=true; await click('Guardar'); await wait('document.querySelector("[role=alert]")?.textContent.includes("El aula ya tiene")');
  assert.equal(await fieldValue('Materia'),'INF-111'); assert.equal(await fieldValue('Aula · sesión 1'),'SS-A1');
  failSave=false; await click('Guardar');
  await roomReady('SS-A1'); await wait('document.querySelector(".room-session") !== null'); await oneDialog();
  assert.equal(writes.length, 1); assert.ok(writes[0].sesiones.every(s => s.aula === 'SS-A1'));
  assert.equal(await evaluate('location.pathname'),'/admin/aulas');
  await screenshot('horario-modal-guardado');
  await evaluate(`document.querySelector('[aria-label="Asignar Martes 10:00 en SS-A1"]').click()`);
  await wait('document.querySelector("[role=dialog] h3")?.textContent === "Asignar horario"');
  assert.equal(await fieldValue('Día · sesión 1'),'MARTES'); assert.equal(await fieldValue('Inicio · sesión 1'),'10:00');
  await click('Cancelar'); await roomReady('SS-A1');
  await evaluate('document.querySelector(".room-session").click()');
  await wait('document.querySelector("[role=dialog] h3")?.textContent === "Nueva reserva temporal"');
  await evaluate(`document.querySelector('[aria-label="Editar asignación de Docente de prueba en SS-A1"]').click()`);
  await wait('document.querySelector("[role=dialog] h3")?.textContent === "Editar sesión"');
  await field('Fin · sesión 1','09:00'); await click('Guardar'); await roomReady('SS-A1');
  assert.equal(writes.filter(w=>w.method==='PUT').length,1);
  await evaluate('document.querySelector(".room-session").click()');
  await wait('document.querySelector("[role=dialog] h3")?.textContent === "Nueva reserva temporal"');
  await evaluate(`document.querySelector('[aria-label="Editar asignación de Docente de prueba en SS-A1"]').click()`);
  await click('Eliminar sesión'); await wait('document.querySelectorAll("[role=dialog]").length === 2'); await oneDialog();
  await click('Cancelar'); await wait('document.querySelector("[role=dialog] h3")?.textContent === "Editar sesión"');
  assert.equal(await fieldValue('Fin · sesión 1'),'09:00');
  await click('Eliminar sesión'); await click('Eliminar'); await roomReady('SS-A1');
  assert.equal(writes.filter(w=>w.method==='DELETE').length,1);
  assert.equal(await evaluate('document.querySelectorAll(".room-session").length'),1);
  await closeSchedule();
  assert.equal(await evaluate('document.querySelector(".subsuelo-room.is-selected .subsuelo-room-code").textContent'), 'SS-A1');
  await polygonClick('SS-A2'); await roomReady('SS-A2'); await closeSchedule();
  await navigate('/admin/aulas');
  await wait(`document.querySelector('[aria-label="Ver ubicación de SS-A3"]') !== null`);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Ver ubicación de P4-A1"]') !== null`), true);
  await evaluate(`document.querySelector('[aria-label="Ver ubicación de SS-A3"]').click()`);
  await wait('document.querySelector(".subsuelo-room.is-selected") !== null');
  assert.equal(await evaluate('document.querySelector(".subsuelo-room.is-selected .subsuelo-room-code").textContent'), 'SS-A3');
  for (const key of ['Enter', ' ']) {
    await evaluate(`document.querySelector('svg [aria-label="Abrir horario del aula SS-A4"]').focus()`);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key === ' ' ? 'Space' : 'Enter', windowsVirtualKeyCode: key === ' ' ? 32 : 13 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key === ' ' ? 'Space' : 'Enter', windowsVirtualKeyCode: key === ' ' ? 32 : 13 });
    await roomReady('SS-A4'); await closeSchedule();
    assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'),'Abrir horario del aula SS-A4');
  }
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await screenshot('ubicacion-movil','.subsuelo-map');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, 'La página no desborda en móvil');
  await polygonClick('SS-A2'); await roomReady('SS-A2');
  await screenshot('horario-modal-movil');
  assert.equal(await evaluate('document.querySelector("[role=dialog]").scrollWidth <= document.querySelector("[role=dialog]").clientWidth'),true);
  await click('Asignar en esta aula'); await wait('document.querySelector("[role=dialog] h3")?.textContent === "Asignar horario"');
  await screenshot('asignacion-mapa-movil');
  await key('Escape'); await roomReady('SS-A2'); await key('Escape'); await wait('document.querySelector("[role=dialog]") === null');
  assert.equal(await evaluate('document.body.style.overflow'),'');
  datasets.periodos=[]; await map(); await polygonClick('SS-A2'); await roomReady('SS-A2');
  assert.equal(await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Asignar en esta aula").disabled'),true);
  await closeSchedule(); datasets.periodos=[period];
  audience='aulas-only'; await map(); await polygonClick('SS-A1'); await roomReady('SS-A1');
  assert.equal(await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Asignar en esta aula").disabled'),true);
  assert.equal(await evaluate('document.querySelector("button.room-session") === null'),true);
  await closeSchedule(); audience='admin';
  aulas = aulas.filter(a => a.codigo !== 'SS-A4'); aulas[0].estado = 'mantenimiento';
  await map();
  assert.equal(await evaluate('document.querySelector("svg [aria-disabled=true]").getAttribute("tabindex")'), '-1');
  assert.equal(await evaluate('document.querySelector(".subsuelo-legend-room:disabled") !== null'), true);
  await evaluate('document.querySelector(".subsuelo-legend-room:not(:disabled)").click()'); await roomReady('SS-A1');
  assert.equal(await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Asignar en esta aula").disabled'), true);
  failRooms = true;
  await navigate('/admin/aulas'); await click('Ubicación'); await wait('document.querySelector("[role=alert]") !== null');
  assert.equal(await evaluate('document.querySelector(".subsuelo-map") === null'), true);
  failRooms = false; await click('Reintentar'); await wait('document.querySelector(".subsuelo-map") !== null');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
  await click('Publicar en portal público');
  await click('Publicar en portal del estudiante');
  await wait('document.body.innerText.includes("Retirar en portal del estudiante")');
  assert.equal(publication.publico,true); assert.equal(publication.estudiantes,true);
  await screenshot('publicacion-admin');
  await navigate('/admin/aulas'); await click('Ubicación'); await wait('document.body.innerText.includes("Retirar en portal público")');
  audience = 'anonymous'; await navigate('/ubicacion'); await wait('document.querySelector(".subsuelo-map") !== null');
  await wait(`document.querySelector('.kardex-desktop-nav a[href="/horarios"]') !== null`);
  assert.equal(await evaluate('location.pathname'),'/horarios','El enlace anterior lleva al apartado unificado');
  assert.equal(await evaluate(`document.querySelector('.kardex-desktop-nav a[href="/horarios"]').textContent`),'Horarios y ubicación');
  assert.equal(await evaluate(`document.querySelector('.kardex-desktop-nav a[href="/ubicacion"]')`),null,'Hay una sola opción pública');
  assert.equal(await evaluate('document.querySelectorAll(".subsuelo-map").length'),8,'El público ve todos los pisos al entrar');
  assert.equal(await evaluate(`(()=>{const f=document.querySelector('.building-floor-filters').getBoundingClientRect(), p=document.querySelector('.building-floor-plans').getBoundingClientRect();return f.right<=p.left && Math.abs(f.top-p.top)<2;})()`),true,'Los filtros están a la izquierda del plano en escritorio');
  assert.equal(await evaluate('document.querySelector(".subsuelo-map [role=button],.subsuelo-legend button") !== null'),true);
  assert.equal(await evaluate('document.getElementById("horarios-busqueda") !== null'),true,'El buscador se mantiene junto a los planos');
  await screenshot('horarios-ubicacion-publico');
  await polygonClick('SS-A2'); await wait('document.querySelector("[role=dialog]") !== null'); await oneDialog();
  assert.equal(await evaluate('document.querySelector("[role=dialog] h3").textContent'),'Horario del aula SS-A2');
  assert.equal(await evaluate('document.querySelector("[role=dialog]").textContent.includes("Capacidad del aula: Por confirmar")'),true);
  const publicScroll=await evaluate('scrollY');
  await click('Volver al plano'); await wait('document.querySelector("[role=dialog]") === null');
  assert.equal(await evaluate('scrollY'),publicScroll);
  assert.equal(await evaluate('document.querySelectorAll(".subsuelo-map").length'),8);
  await navigate('/ubicacion?piso=-1&aula=SS-A1');
  await wait('document.querySelector("[role=dialog] .room-session") !== null');
  assert.equal(await evaluate('location.pathname'),'/horarios');
  assert.equal(await evaluate('document.querySelector("[role=dialog] .room-session").textContent.includes("Docente de prueba")'),true);
  assert.equal(await evaluate('document.querySelector("[role=dialog]").textContent.includes("Capacidad del aula: 45 estudiantes")'),true);
  assert.equal(await evaluate('document.querySelector(".room-slot,button.room-session") === null'),true,'El público solo consulta');
  await screenshot('horario-publico-modal');
  await key('Escape'); await wait('document.querySelector("[role=dialog]") === null');
  await evaluate(`document.querySelector('button[aria-label="Cuarto piso"]').click()`);
  await wait('document.querySelector(".subsuelo-map")?.dataset.floor === "4"');
  await screenshot('filtros-laterales-plano','.building-locations');
  await polygonClick('P4-A1'); await wait('document.querySelector("[role=dialog] .room-timetable") !== null');
  schedulesPublished=false; await evaluate(`window.dispatchEvent(new Event('focus'))`);
  await wait('document.querySelector("[role=dialog]")?.textContent.includes("Horarios aún no publicados")');
  assert.equal(await evaluate('document.querySelector("[role=dialog] .room-timetable")'),null,'Retirar horarios elimina la consulta abierta');
  await click('Volver al plano');
  await navigate('/ubicacion'); await wait(`document.querySelector('.kardex-desktop-nav a[href="/horarios"]') !== null`);
  assert.equal(await evaluate('document.querySelectorAll(".subsuelo-map").length'),8,'Los planos conservan su control de publicación');
  schedulesPublished=true; await evaluate(`window.dispatchEvent(new Event('focus'))`); await wait('document.getElementById("horarios-busqueda") !== null');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate(`document.querySelector('button[aria-label="Planta baja"]').click()`); await screenshot('ubicacion-publica-movil');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
  assert.equal(await evaluate(`document.querySelector('.building-floor-filters').getBoundingClientRect().bottom<=document.querySelector('.building-floor-plans').getBoundingClientRect().top`),true,'En móvil los filtros están arriba del plano');
  await polygonClick('PB-A1'); await wait('document.querySelector("[role=dialog] .room-timetable") !== null');
  assert.equal(await evaluate('document.querySelector("[role=dialog]").textContent.includes("Capacidad del aula: 32 estudiantes")'),true);
  await screenshot('horario-publico-modal-movil');
  assert.equal(await evaluate('document.querySelector("[role=dialog]").scrollWidth <= document.querySelector("[role=dialog]").clientWidth'),true);
  await key('Escape'); await wait('document.querySelector("[role=dialog]") === null');
  assert.equal(await evaluate('document.querySelector(".subsuelo-map").dataset.floor'),'0');
  await evaluate(`document.querySelector('button[aria-label="Abrir menú"]').click()`);
  assert.equal(await evaluate(`document.querySelector('.kardex-mobile-nav a[href="/horarios"]').textContent.includes('Horarios y ubicación')`),true);
  schedulesPublished=false;
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
  audience = 'student'; await navigate('/usuario/ubicacion'); await wait('document.querySelector(".subsuelo-map") !== null');
  await polygonClick('SS-A2'); await wait('document.querySelector(".location-room-schedule [role=dialog]") !== null'); await oneDialog();
  assert.equal(await evaluate('document.querySelector("[role=dialog] h3").textContent'),'Horario del aula SS-A2');
  const studentScroll=await evaluate('scrollY');
  assert.equal(await evaluate('document.querySelector(".room-slot,button.room-session") === null'),true,'Consulta estudiantil sin asignación');
  await click('Volver al plano'); await wait('document.querySelector("[role=dialog]") === null');
  assert.equal(await evaluate('scrollY'),studentScroll,'Cerrar conserva la posición en el mapa del estudiante');
  await evaluate(`document.querySelector('button[aria-label="Cuarto piso"]').click()`); await polygonClick('P4-A1');
  await wait('document.querySelector("[role=dialog] h3")?.textContent === "Horario del aula P4-A1"');
  await key('Escape'); await wait('document.querySelector("[role=dialog]") === null');
  assert.equal(await evaluate('document.querySelector(".subsuelo-map").dataset.floor'),'4');
  await evaluate(`document.querySelector('button[aria-label="Todas las aulas"]').click()`); await polygonClick('P4-A1');
  await wait('document.querySelector("[role=dialog]") !== null'); await click('Volver al plano');
  assert.equal(await evaluate('document.querySelectorAll(".subsuelo-map").length'),8,'El filtro de todos los pisos se conserva al cerrar');
  await navigate('/usuario/ubicacion?piso=-1&aula=SS-A1'); await wait('document.querySelector(".room-session") !== null');
  await oneDialog();
  assert.equal(await evaluate('document.querySelector("[role=dialog]").textContent.includes("Capacidad del aula: 45 estudiantes")'),true);
  assert.equal(await evaluate('document.querySelector(".room-session").tagName'),'DIV');
  assert.equal(await evaluate('document.querySelector(".room-session").textContent.includes("Docente de prueba")'),true);
  await screenshot('horario-estudiante-modal');
  await send('Page.reload'); await wait('document.querySelector(".location-room-schedule [role=dialog]") !== null');
  await evaluate(`document.querySelector('[role=dialog] button.btn-secondary').focus()`); await key('Tab');
  assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'),'Cerrar','El foco permanece en la ventana');
  await evaluate(`document.querySelector('[role=dialog] [aria-label="Cerrar"]').click()`); await wait('document.querySelector("[role=dialog]") === null');
  await evaluate(`document.querySelector('svg [aria-label="Abrir horario del aula SS-A2"]').focus()`); await key('Enter');
  await wait('document.querySelector("[role=dialog]") !== null'); await key('Escape'); await wait('document.querySelector("[role=dialog]") === null');
  assert.equal(await evaluate('document.activeElement.getAttribute("aria-label")'),'Abrir horario del aula SS-A2');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await polygonClick('SS-A2'); await wait('document.querySelector("[role=dialog]") !== null');
  await screenshot('horario-estudiante-modal-movil');
  assert.equal(await evaluate('document.querySelector("[role=dialog]").scrollWidth <= document.querySelector("[role=dialog]").clientWidth'),true);
  await key('Escape'); await wait('document.querySelector("[role=dialog]") === null');
  assert.equal(await evaluate('document.body.style.overflow'),'');
  datasets.periodos=[]; await navigate('/usuario/ubicacion?piso=-1&aula=SS-A2');
  await wait('document.querySelector("[role=dialog]")?.textContent.includes("No hay un periodo académico activo")');
  datasets.periodos=[period];
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false });
  audience = 'admin'; await map(); await click('Retirar en portal público');
  await wait('document.body.innerText.includes("Publicar en portal público")');
  assert.equal(publication.publico,false); assert.equal(publication.estudiantes,true);
  audience = 'anonymous'; await navigate('/ubicacion'); await wait('document.body.innerText.includes("Ubicación aún no publicada")');
  assert.equal(await evaluate('document.querySelector(".subsuelo-map") === null'),true);
  assert.equal(await evaluate(`document.querySelector('.kardex-desktop-nav a[href="/horarios"]') === null`),true);
  audience = 'student'; await navigate('/usuario/ubicacion'); await wait('document.querySelector(".subsuelo-map") !== null');
  await polygonClick('SS-A2'); await wait('document.querySelector("[role=dialog]") !== null');
  publication.estudiantes=false; await evaluate(`window.dispatchEvent(new Event('focus'))`);
  await wait('document.body.innerText.includes("Ubicación aún no publicada")');
  assert.equal(await evaluate('document.querySelector("[role=dialog]") === null && document.body.style.overflow === ""'),true,'Retirar publicación cierra la consulta abierta');
  publication.estudiantes=true;
  audience = 'admin'; await map(); await click('Retirar en portal del estudiante');
  await wait('document.body.innerText.includes("Publicar en portal del estudiante")');
  audience = 'student'; await navigate('/usuario/ubicacion'); await wait('document.body.innerText.includes("Ubicación aún no publicada")');
  assert.equal(await evaluate('document.querySelector(".subsuelo-map") === null'),true);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'OK', floors:8, keyboard: 'Enter + Space', assignment: 'SS-A1 guardada con API simulada', mobile: true, missingRoomDisabled: true, maintenanceReadOnly: true, loadFailureAndRetry: true, publicationWrites:publicationWrites.length,publicScheduleAndMap:true,studentScheduleModal:true,unpublishIndependent:true,screenshots: output }));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (send && ws?.readyState === 1) { try { await send('Browser.close'); } catch {} }
  ws?.close(); chrome?.kill(); server.close();
});
