// HTTP real contra archivos temporales; no accede a la base de datos.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const { frontendProduccion } = require('../src/frontend');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgiac-frontend-test-'));
fs.mkdirSync(path.join(root, 'assets'));
fs.mkdirSync(path.join(root, 'api'));
fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><div id="root">SGIAC</div>');
fs.writeFileSync(path.join(root, 'assets', 'index-test.js'), 'window.test = true;');
fs.writeFileSync(path.join(root, '.env'), 'secret=must-not-be-served');
fs.writeFileSync(path.join(root, 'api', 'private'), 'must-not-shadow-api');
const app = express();
app.use(helmet());
app.use(frontendProduccion(root));
app.get('/api/health', (_req, res) => res.json({ success: true }));
app.use((_req, res) => res.status(404).json({ success: false }));
const server = app.listen(0, '127.0.0.1');
after(async () => {
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  // El único destino de limpieza es la carpeta temporal creada por esta prueba.
  const resolved = fs.realpathSync(root), temp = fs.realpathSync(os.tmpdir());
  if (!resolved.startsWith(temp + path.sep) || !path.basename(resolved).startsWith('sgiac-frontend-test-')) throw new Error('Directorio de prueba fuera de tmp');
  fs.rmSync(resolved, { recursive: true, force: true });
});
const get = route => fetch(`http://127.0.0.1:${server.address().port}${route}`, { headers: { Accept: 'text/html' } });

test('abre directamente el QR firmado y las rutas de React', async () => {
  for (const url of ['/', '/admin/auxiliares', '/auxiliares/carnet/7.' + 'A'.repeat(43)]) {
    const res = await get(url);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(await res.text(), /SGIAC/);
    assert.match(res.headers.get('content-security-policy'), /worker-src 'self' blob:/);
  }
  const res = await get('/auxiliares/carnet/7.' + 'A'.repeat(43));
  assert.match(res.headers.get('cache-control'), /no-store/);
  assert.match(res.headers.get('x-robots-tag'), /noindex/);
});

test('la API conserva JSON y sus 404, aunque exista un archivo con el mismo nombre', async () => {
  assert.deepEqual(await (await get('/api/health')).json(), { success: true });
  for (const url of ['/api', '/api/no-existe', '/api/private']) {
    const res = await get(url);
    assert.equal(res.status, 404); assert.deepEqual(await res.json(), { success: false });
  }
});

test('sirve archivos compilados y no publica archivos ocultos ni confunde recursos ausentes con HTML', async () => {
  const res = await get('/assets/index-test.js');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /javascript/);
  assert.match(res.headers.get('cache-control'), /immutable/);
  for (const url of ['/.env', '/%2eenv', '/assets/no-existe.js', '/images/no-existe.png', '/fonts/no-existe.ttf']) {
    const missing = await get(url);
    assert.equal(missing.status, 404, url);
    assert.ok(!(await missing.text()).includes('secret='));
  }
});

test('sin frontend compilado deja continuar al servidor de API', () => {
  let next = false;
  frontendProduccion(path.join(root, 'missing'))({}, {}, () => { next = true; });
  assert.equal(next, true);
});
