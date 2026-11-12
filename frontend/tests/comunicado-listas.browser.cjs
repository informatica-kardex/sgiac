// Compilar el frontend y ejecutar: node frontend/tests/comunicado-listas.browser.cjs
// Navegador real con API y sesión simuladas; no modifica comunicados reales.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const root = path.resolve(process.env.COMUNICADOS_TEST_BUILD || 'frontend/dist');
const output = path.resolve('.preview-comunicados/listas-regresion');
fs.mkdirSync(output, { recursive: true });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let session = 'admin', records, origin, chrome, ws;
const mutations = [], errors = [];
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/pdfjs.mjs' || pathname === '/pdf.worker.mjs') {
    res.setHeader('Content-Type', 'text/javascript');
    return res.end(fs.readFileSync(path.resolve('frontend/node_modules/pdfjs-dist/build', pathname === '/pdfjs.mjs' ? 'pdf.mjs' : 'pdf.worker.mjs')));
  }
  const file = path.resolve(root, '.' + (/^\/(assets|images|fonts)\//.test(pathname) ? pathname : '/index.html'));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  records = [{ idComunicado: '1', titulo: 'Regresión de conversión a listas', encabezado: 'COMUNICADO', tipo: 'texto', contenido: 'Introducción\n\n- Lista anterior\n\n**Primer párrafo**\n\n_Segundo párrafo_\n\nTercer párrafo\n\nFinal sin seleccionar', resumen: '', categoria: 'Académico', estado: 'publicado', fechaPublicacion: '2026-11-03T12:00:00.000Z', adjuntos: [] }];
  chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9385', '--user-data-dir=' + path.join(output, 'chrome'), 'about:blank'], { stdio: 'ignore', windowsHide: true });
  chrome.on('error', error => errors.push(error.message));
  let tabs;
  for (let i = 0; i < 60; i++) { try { tabs = await fetch('http://127.0.0.1:9385/json').then(r => r.json()); break; } catch { await delay(150); } }
  assert.ok(tabs, 'Chrome debe iniciar');
  ws = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => { pending.set(++id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  ws.addEventListener('message', async event => {
    const message = JSON.parse(event.data);
    if (message.id) { const item = pending.get(message.id); pending.delete(message.id); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); return; }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.method !== 'Fetch.requestPaused') return;
    try {
      const { request, requestId } = message.params;
      const route = new URL(request.url).pathname;
      let data = [], status = 200;
      if (route.endsWith('/auth/refresh')) { status = session ? 200 : 401; data = { accessToken: 'preview-token', session: { id: 1, expiresAt: Date.now() + 3600000 } }; }
      else if (route.endsWith('/auth/activity')) data = { session: { id: 1, expiresAt: Date.now() + 3600000 } };
      else if (route.endsWith('/auth/me')) data = { idUsuario: '1', nombreCompleto: 'Usuario de prueba', roles: [session === 'admin' ? 'ADMINISTRADOR' : 'ESTUDIANTE'], correoVerificado: true, debeCambiarPassword: false, permisos: [] };
      else if (route.includes('/comunicados')) {
        if (['POST', 'PUT'].includes(request.method)) {
          const entries = await evaluate('window.__ultimoFormulario');
          const fields = Object.fromEntries(entries.filter(e => e[0] !== 'archivo'));
          mutations.push({ method: request.method, fields });
          const index = request.method === 'POST' ? records.length : records.findIndex(r => r.idComunicado === route.split('/').at(-1));
          const old = records[index];
          data = { ...records[0], ...old, ...fields, mayusculas: fields.mayusculas !== 'false', tamanoLetra: Number(fields.tamanoLetra) || 13,
            idComunicado: old?.idComunicado || String(index + 1), adjuntos: [] };
          records[index] = data;
        } else data = route.endsWith('/comunicados') ? records : records.find(r => r.idComunicado === route.split('/').at(-1));
      } else if (route.endsWith('/telegram')) data = { available: false, url: null };
      await send('Fetch.fulfillRequest', { requestId, responseCode: request.method === 'OPTIONS' ? 204 : status, responseHeaders: [
        { name: 'Content-Type', value: 'application/json' }, { name: 'Access-Control-Allow-Origin', value: origin }, { name: 'Access-Control-Allow-Credentials', value: 'true' }, { name: 'Access-Control-Allow-Headers', value: 'authorization,content-type' }, { name: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,OPTIONS' },
      ], body: Buffer.from(JSON.stringify({ success: status < 400, data })).toString('base64') });
    } catch (error) { errors.push(error.message); }
  });
  const wait = async expression => {
    for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await delay(100); }
    throw new Error('No se cumplió: ' + expression + '\n' + await evaluate('document.body.innerText'));
  };
  const click = async label => { await wait(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === ${JSON.stringify(label)})`); await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}).click()`); };
  const navigate = async route => { await send('Page.navigate', { url: origin + route }); await wait('!!document.querySelector("main h1")'); };
  const screenshot = async name => { await delay(500); const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(result.data, 'base64')); };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `const send = XMLHttpRequest.prototype.send; XMLHttpRequest.prototype.send = function(body) { if (body instanceof FormData) window.__ultimoFormulario = [...body].map(([key, value]) => [key, value instanceof File ? value.name : value]); return send.call(this, body); };` });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*' }] });
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });

  const select = async (first, last = first, reverse = false) => {
    await evaluate(`(() => {
      const editor = document.querySelector('.comunicado-editor-contenido'); editor.focus();
      const find = text => { const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT); let node;
        while (node = walker.nextNode()) { const index = node.textContent.indexOf(text); if (index >= 0) return { node, index }; }
        throw new Error('Texto no encontrado: ' + text);
      };
      const from = find(${JSON.stringify(first)}), to = find(${JSON.stringify(last)});
      const start = [from.node, from.index], end = [to.node, to.index + ${last.length}];
      const selection = getSelection(); selection.removeAllRanges();
      selection.setBaseAndExtent(...(${reverse} ? end : start), ...(${reverse} ? start : end));
    })()`);
    await delay(150);
  };
  const toolbar = async (label, floating = false) => {
    const selector = `${floating ? '.comunicado-editor-burbuja' : '.comunicado-editor-barra'} button[aria-label="${label}"]`;
    await wait(`!!document.querySelector(${JSON.stringify(selector)}) && getComputedStyle(document.querySelector(${JSON.stringify(selector)}).parentElement).visibility !== 'hidden'`);
    const { x, y } = await evaluate(`(() => {
      const button = document.querySelector(${JSON.stringify(selector)}); button.scrollIntoView({ block: 'nearest' });
      const rect = button.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })()`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await delay(100);
  };
  const editorJSON = () => evaluate(`document.querySelector('.comunicado-editor-contenido').editor.getJSON()`);
  const currentText = () => evaluate(`document.querySelector('input[name="contenido"]').value`);
  const key = async (key, code, text) => {
    const windowsVirtualKeyCode = { Enter: 13, ArrowRight: 39 }[key];
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode, ...(text ? { text } : {}) });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode });
  };
  const checkList = async (type, count) => {
    await wait(`document.querySelectorAll('.comunicado-editor-contenido ${type} li').length === ${count}`);
    const json = await editorJSON();
    const contents = json.content;
    assert.equal(contents[0].content[0].text, 'Introducción');
    assert.equal(contents.at(-1).content[0].text, 'Final sin seleccionar');
    assert.ok(await evaluate(`!!document.querySelector('.comunicado-editor-contenido strong') && !!document.querySelector('.comunicado-editor-contenido em')`));
  };

  await navigate('/admin/comunicados'); await click('Editar');
  await wait(`!!document.querySelector('.comunicado-editor-contenido')`);
  const original = await currentText();
  const originalDoc = await editorJSON();
  await select('Primer párrafo', 'Tercer párrafo');
  await toolbar('Lista numerada', true);
  await checkList('ol', 3);
  assert.equal(await evaluate(`document.querySelectorAll('.comunicado-editor-contenido ul li').length`), 1);
  const numbered = await currentText();
  assert.ok(numbered.includes('1. **Primer párrafo**\n2. _Segundo párrafo_\n3. Tercer párrafo'));
  await screenshot('seleccion-convertida-a-lista');
  await toolbar('Deshacer');
  assert.deepEqual(await editorJSON(), originalDoc);
  assert.equal(await evaluate(`document.querySelectorAll('.comunicado-editor-contenido ol').length`), 0);
  assert.equal(await currentText(), original);
  await toolbar('Rehacer'); await checkList('ol', 3);
  await select('Primer párrafo', 'Tercer párrafo');
  await toolbar('Lista numerada', true);
  await wait(`document.querySelectorAll('.comunicado-editor-contenido ol').length === 0`);
  await select('Primer párrafo', 'Tercer párrafo', true);
  await toolbar('Lista con viñetas');
  await checkList('ul', 4);
  // La nueva lista se une a las viñetas anteriores y conserva todo el texto seleccionado.
  await select('Lista anterior', 'Tercer párrafo');
  await toolbar('Lista numerada');
  await checkList('ol', 4);
  await select('Lista anterior', 'Tercer párrafo');
  await toolbar('Lista numerada');
  await wait(`document.querySelectorAll('.comunicado-editor-contenido li').length === 0`);
  await select('Primer párrafo', 'Tercer párrafo');
  await toolbar('Lista con viñetas', true);
  await checkList('ul', 3);
  // Un cursor sin selección permite seguir escribiendo y salir de una lista con Enter.
  await select('Tercer párrafo'); await key('ArrowRight', 'ArrowRight');
  await wait(`document.querySelector('.comunicado-editor-contenido').editor.state.selection.empty`);
  await key('Enter', 'Enter', '\r'); await send('Input.insertText', { text: 'Cuarto elemento' });
  await checkList('ul', 4);
  await key('Enter', 'Enter', '\r'); await key('Enter', 'Enter', '\r');
  await send('Input.insertText', { text: 'Texto fuera de lista' });
  await toolbar('Lista numerada'); await checkList('ol', 1);
  const saved = await currentText();
  const beforeSave = await editorJSON();
  await wait(`!!document.querySelector('img[alt^="Vista previa"]') && !document.querySelector('[aria-busy="true"]')`);
  await click('Guardar'); await wait('!document.querySelector("[role=dialog]")');
  assert.equal(mutations.at(-1).fields.contenido, saved);
  await click('Editar'); await wait(`!!document.querySelector('.comunicado-editor-contenido')`);
  assert.deepEqual(await editorJSON(), beforeSave);
  assert.equal(await currentText(), saved);
  await click('Cancelar');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await click('Editar'); await wait(`!!document.querySelector('.comunicado-editor-contenido')`);
  await select('Primer párrafo', 'Tercer párrafo');
  await toolbar('Quitar formato');
  await select('Primer párrafo', 'Tercer párrafo');
  await toolbar('Lista numerada', true);
  await wait(`document.querySelectorAll('.comunicado-editor-contenido ol li').length >= 3`);
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth`));
  assert.deepEqual(errors, []);
  console.log('OK: varios párrafos a viñetas/numeración, selección inversa, ambas barras, quitar y volver a aplicar, Enter, deshacer/rehacer, guardar, vista previa y móvil.');

  const downloads = new Map();
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Browser.downloadWillBegin') downloads.set(message.params.guid, { name: message.params.suggestedFilename });
    if (message.method === 'Browser.downloadProgress' && message.params.state === 'completed') downloads.get(message.params.guid).complete = true;
  });
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: output, eventsEnabled: true });
  const previewReady = () => wait(`!!document.querySelector('img[alt^="Vista previa"]') && !document.querySelector('[aria-busy="true"]')`);
  const setSize = async value => {
    await evaluate(`(() => { const input = document.querySelector('input[aria-label="Tamaño de letra"]'); input.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await delay(100);
  };
  assert.equal(await evaluate(`document.querySelector('button[aria-label="Todo en mayúsculas"]').getAttribute('aria-pressed')`), 'true');
  assert.equal(await evaluate(`document.querySelector('input[aria-label="Tamaño de letra"]').value`), '13');
  assert.equal(await evaluate(`!!document.querySelector('.comunicado-editor-fuente')`), false);
  await toolbar('Todo en mayúsculas');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.comunicado-editor-contenido')).textTransform`), 'none');
  await setSize('18');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.comunicado-editor-contenido')).fontSize`), '24px');
  await setSize(''); await toolbar('Todo en mayúsculas');
  assert.equal(await evaluate(`document.querySelector('input[aria-label="Tamaño de letra"]').value`), '18');
  await toolbar('Todo en mayúsculas');
  await setSize('100'); await toolbar('Todo en mayúsculas');
  assert.equal(await evaluate(`document.querySelector('input[aria-label="Tamaño de letra"]').value`), '18');
  await toolbar('Todo en mayúsculas');
  await setSize('16'); await key('Enter', 'Enter', '\r');
  assert.ok(await evaluate(`!!document.querySelector('[role="dialog"]')`));
  await evaluate(`document.querySelector('.comunicado-editor-contenido').editor.commands.setContent({ type:'doc',content:[
    {type:'paragraph',content:[{type:'text',text:'Aviso para Estudiantes',marks:[{type:'bold'},{type:'italic'}]}]},
    {type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Primer punto de la lista'}]}]}]}
  ]})`);
  await previewReady();
  const imageBefore = await evaluate(`document.querySelector('img[alt^="Vista previa"]').src`);
  await evaluate(`document.querySelector('.comunicado-editor-contenido').editor.chain().focus('end').insertContent(' final').run()`);
  // Guardar inmediatamente después de teclear conserva el último carácter.
  await click('Guardar'); await wait('!document.querySelector("[role=dialog]")');
  assert.equal(mutations.at(-1).fields.mayusculas, 'false');
  assert.equal(mutations.at(-1).fields.tamanoLetra, '16');
  assert.ok(mutations.at(-1).fields.contenido.endsWith(' final'));
  await click('Editar'); await wait(`!!document.querySelector('.comunicado-editor-contenido')`);
  assert.equal(await evaluate(`document.querySelector('button[aria-label="Todo en mayúsculas"]').getAttribute('aria-pressed')`), 'false');
  assert.equal(await evaluate(`document.querySelector('input[aria-label="Tamaño de letra"]').value`), '16');
  await previewReady();
  assert.notEqual(await evaluate(`document.querySelector('img[alt^="Vista previa"]').src`), imageBefore);
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  await screenshot('editor-tipografia');
  await click('Descargar imagen');
  for (let i=0; i<100 && ![...downloads.values()].some(d => d.complete && d.name.endsWith('.png')); i++) await delay(100);
  assert.ok([...downloads.values()].some(d => d.complete && d.name.endsWith('.png')));
  await click('Cancelar'); await click('+ Nuevo comunicado');
  await wait(`!!document.querySelector('.comunicado-editor-contenido')`);
  assert.equal(await evaluate(`document.querySelector('input[aria-label="Tamaño de letra"]').value`), '13');
  assert.equal(await evaluate(`document.querySelector('button[aria-label="Todo en mayúsculas"]').getAttribute('aria-pressed')`), 'true');
  await click('Cancelar');
  session = null;
  await navigate('/comunicados/1'); await wait(`!!document.querySelector('.comunicado-documento-texto')`);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.comunicado-documento-texto')).textTransform`), 'none');
  assert.ok(Math.abs(Number.parseFloat(await evaluate(`getComputedStyle(document.querySelector('.comunicado-documento-texto')).fontSize`)) - 16 * 4 / 3) < .01);
  await click('Descargar');
  for (let i=0; i<150 && ![...downloads.values()].some(d => d.complete && d.name.endsWith('.pdf')); i++) await delay(100);
  const pdf = [...downloads.values()].find(d => d.complete && d.name.endsWith('.pdf'));
  assert.ok(pdf);
  const base64 = fs.readFileSync(path.join(output, pdf.name)).toString('base64');
  const items = await evaluate(`(async () => {
    const pdfjs = await import('/pdfjs.mjs'); pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.mjs';
    const doc = await pdfjs.getDocument({ data: Uint8Array.from(atob(${JSON.stringify(base64)}),c=>c.charCodeAt(0)) }).promise;
    const page=await doc.getPage(1), text=await page.getTextContent(); await page.getOperatorList();
    return text.items.filter(i=>i.str?.trim()).map(i=>({text:i.str,size:Math.hypot(i.transform[0],i.transform[1]),font:page.commonObjs.get(i.fontName).name}));
  })()`);
  const aviso=items.find(i=>i.text.includes('Aviso'));
  assert.ok(aviso); assert.equal(aviso.size,16); assert.ok(/BoldItalic/.test(aviso.font));
  assert.ok(items.some(i=>i.text.includes('Estudiantes')));
  const punto=items.find(i=>i.text.includes('Primer')); assert.ok(punto); assert.equal(punto.size,16);
  assert.deepEqual(errors, []);
  console.log('OK: mayúsculas reversibles, tamaño editable, límites, valores iniciales, guardado inmediato, PNG y PDF con la tipografía elegida.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  ws?.close(); chrome?.kill(); await new Promise(resolve => server.close(resolve));
});
