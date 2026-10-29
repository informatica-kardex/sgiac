const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-access'; process.env.JWT_REFRESH_SECRET = 'test-refresh';
const prisma = { usuario: {}, comunicado: {}, categoria_comunicado: {}, adjunto_comunicado: {}, historial_comunicado: {}, bitacora: {}, $transaction() {}, $queryRaw: async () => [] };
require('../src/database/prisma').prisma = prisma;
const { credentialVersion, signAccessToken } = require('../src/utils/jwt');
const { ComunicadoService } = require('../src/modules/comunicados/comunicado.service');
const { rutaArchivo, detectarArchivo } = require('../src/modules/comunicados/comunicado.files');
const { crearComunicadoSchema } = require('../src/modules/comunicados/comunicado.validation');
const service = new ComunicadoService();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6dV8AAAAASUVORK5CYII=', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
let rows, attachments, categories, histories, directory, server, base, failSave, nextAttachment;
function expanded(row) { return row ? { ...row, adjunto_comunicado: attachments.filter(a => a.id_comunicado === row.id_comunicado), categoria_comunicado: categories.find(c => c.id_categoria_comunicado === row.id_categoria_comunicado) } : null; }
function file(buffer, name = 'imagen.png', mime = 'image/png') { return { buffer, originalname: name, mimetype: mime, size: buffer.length }; }
const input = (extra = {}) => crearComunicadoSchema.parse({ titulo: 'Comunicado de prueba', categoria: 'Academico', contenido: 'Texto de prueba', tipo: 'texto', estado: 'publicado', ...extra });
beforeEach(async () => {
  rows = []; attachments = []; categories = []; histories = []; failSave = false; nextAttachment = 1n;
  directory = await fs.mkdtemp(path.join(__dirname, '.tmp-comunicados-'));
  process.env.COMUNICADOS_UPLOAD_DIR = directory;
  prisma.usuario.findUnique = async ({ where }) => ({ idUsuario: BigInt(where.idUsuario), correo: 'test@example.test', estado: 'ACTIVO', correoVerificado: true, debeCambiarPassword: false,
    permisos: [{ modulo: BigInt(where.idUsuario) === 2n ? 'comunicados' : 'fichas', desde: null, hasta: null }],
    roles: [{ estado: 'ACTIVO', rol: { estado: 'ACTIVO', nombre: BigInt(where.idUsuario) === 1n ? 'ADMINISTRADOR' : BigInt(where.idUsuario) === 2n ? 'SUBADMINISTRADOR' : 'SUBADMINISTRADOR' } }] });
  prisma.categoria_comunicado.upsert = async ({ where, create }) => {
    let c = categories.find(c => c.nombre === where.nombre);
    if (!c) { c = { ...create, id_categoria_comunicado: BigInt(categories.length + 1) }; categories.push(c); } return c;
  };
  prisma.comunicado.findMany = async ({ where } = {}) => rows.filter(r => !where || r.estado === where.estado).map(expanded);
  prisma.comunicado.findUnique = async ({ where }) => expanded(rows.find(r => r.id_comunicado === where.id_comunicado));
  prisma.comunicado.findUniqueOrThrow = async args => { const r = await prisma.comunicado.findUnique(args); if (!r) throw Error('missing'); return r; };
  prisma.comunicado.create = async ({ data }) => {
    if (failSave) throw Error('database unavailable');
    const row = { ...data, id_comunicado: BigInt(rows.length + 1), fecha_creacion: new Date(), fecha_vencimiento: null }; rows.push(row); return row;
  };
  prisma.comunicado.update = async ({ where, data }) => Object.assign(rows.find(r => r.id_comunicado === where.id_comunicado), data);
  prisma.comunicado.delete = async ({ where }) => { rows = rows.filter(r => r.id_comunicado !== where.id_comunicado); attachments = attachments.filter(a => a.id_comunicado !== where.id_comunicado); };
  prisma.adjunto_comunicado.create = async ({ data }) => { const a = { ...data, id_adjunto: nextAttachment++ }; attachments.push(a); return a; };
  prisma.adjunto_comunicado.deleteMany = async ({ where }) => { attachments = attachments.filter(a => a.id_comunicado !== where.id_comunicado || (where.id_adjunto && !where.id_adjunto.in.includes(a.id_adjunto))); };
  prisma.adjunto_comunicado.findFirst = async ({ where }) => {
    const a = attachments.find(a => a.id_adjunto === where.id_adjunto && a.id_comunicado === where.id_comunicado);
    return a ? { ...a, comunicado: rows.find(r => r.id_comunicado === a.id_comunicado) } : null;
  };
  prisma.historial_comunicado.create = async ({ data }) => { histories.push(data); return data; };
  prisma.bitacora.create = async () => ({});
  let queue = Promise.resolve();
  prisma.$transaction = fn => {
    const operation = queue.then(async () => {
      const snapshot = structuredClone({ rows, attachments, categories, histories });
      try { return await fn(prisma); }
      catch (e) { ({ rows, attachments, categories, histories } = snapshot); throw e; }
    });
    queue = operation.catch(() => {}); return operation;
  };
  const express = require('express');
  const app = express(); app.use(require('helmet')()); app.use(express.json());
  app.use('/api/comunicados', require('../src/modules/comunicados/comunicado.routes').default);
  app.use(require('../src/middlewares/error.middleware').errorMiddleware);
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  const allowedPrefix = path.join(__dirname, '.tmp-comunicados-');
  assert.ok(path.resolve(directory).startsWith(allowedPrefix));
  await fs.rm(directory, { recursive: true, force: true });
  delete process.env.COMUNICADOS_UPLOAD_DIR;
});
function token(id) { return signAccessToken({ credentialVersion: credentialVersion(null), idUsuario: String(id), correo: 'test@example.test', roles: ['ADMINISTRADOR'] }); }
async function request(route = '', { actor, method = 'GET', body, headers = {} } = {}) {
  return fetch(base + '/api/comunicados' + route, { method, body, headers: { ...headers, ...(actor ? { Authorization: `Bearer ${token(actor)}` } : {}) } });
}
function multipart(values, buffer, name = 'documento.pdf', type = 'application/pdf') {
  const form = new FormData(); for (const [k,v] of Object.entries(values)) form.append(k, v);
  if (buffer) form.append('archivo', new Blob([buffer], { type }), name);
  return form;
}

test('texto persiste mediante repositorio real y una nueva instancia lo recupera', async () => {
  const c = await service.guardar(input(), 1n);
  assert.equal(c.idComunicado, '1'); assert.equal(c.tipo, 'texto'); assert.deepEqual(c.adjuntos, []);
  assert.equal((await new ComunicadoService().listarPublicados())[0].contenido, 'Texto de prueba');
  assert.equal(rows[0].id_usuario, 1n); assert.equal(histories[0].id_usuario, 1n);
});
test('imagen sin texto guarda bytes en disco y metadatos en tablas existentes', async () => {
  const c = await service.guardar(input({ tipo: 'imagen', contenido: '' }), 2n, undefined, file(PNG));
  assert.equal(c.tipo, 'imagen'); assert.equal(c.adjuntos[0].tipo, 'image/png');
  assert.deepEqual(await fs.readFile(rutaArchivo(attachments[0].url_archivo)), PNG);
  const response = await fetch(base + c.adjuntos[0].url);
  assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /image\/png/);
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'cross-origin');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), PNG);
});
test('PDF multipart del subadmin se visualiza inline, permite rangos y descarga', async () => {
  const response = await request('', { actor: 2, method: 'POST', body: multipart(input({ tipo: 'pdf', contenido: '' }), PDF) });
  assert.equal(response.status, 201); const c = (await response.json()).data;
  const pdf = await fetch(base + c.adjuntos[0].url);
  assert.equal(pdf.status, 200); assert.match(pdf.headers.get('content-type'), /application\/pdf/);
  assert.match(pdf.headers.get('content-disposition'), /^inline/); assert.equal(pdf.headers.get('x-frame-options'), null);
  assert.match(pdf.headers.get('content-security-policy'), /frame-ancestors/);
  const range = await fetch(base + c.adjuntos[0].url, { headers: { Range: 'bytes=0-4' } });
  assert.equal(range.status, 206); assert.equal(await range.text(), '%PDF-');
  const download = await fetch(base + c.adjuntos[0].url + '?descargar=1');
  assert.match(download.headers.get('content-disposition'), /^attachment/);
});
test('borradores y archivados ocultan metadatos y archivos incluso con enlace directo', async () => {
  const c = await service.guardar(input({ tipo: 'pdf', contenido: '', estado: 'borrador' }), 1n, undefined, file(PDF, 'aviso.pdf'));
  assert.equal((await request('/1')).status, 404);
  assert.equal((await fetch(base + c.adjuntos[0].url)).status, 404);
  assert.equal((await request('/1', { actor: 1 })).status, 200);
  assert.equal((await request('/1?publico=1', { actor: 1 })).status, 404);
  assert.equal((await request('?publico=1', { actor: 1 }).then(r => r.json())).data.length, 0);
  await service.guardar({ estado: 'publicado' }, 1n, 1n);
  assert.equal((await fetch(base + c.adjuntos[0].url)).status, 200);
  await service.guardar({ estado: 'archivado' }, 1n, 1n);
  assert.equal((await fetch(base + c.adjuntos[0].url)).status, 404);
});
test('solo admin y subadmin con función comunicados publican; token con rol antiguo no eleva permisos', async () => {
  for (const actor of [undefined, 3]) {
    const result = await request('', { actor, method: 'POST', body: multipart(input()) });
    assert.equal(result.status, actor ? 403 : 401);
  }
  assert.equal(rows.length, 0); assert.equal((await fs.readdir(directory)).length, 0);
  assert.equal((await request('', { actor: 1, method: 'POST', body: multipart(input()) })).status, 201);
});
test('rechaza archivos falsos, tipo incorrecto, SVG, vacios y publicaciones sin contenido', async () => {
  for (const f of [file(Buffer.from('<script>bad</script>'), 'x.png'), file(Buffer.from('<svg></svg>'), 'x.svg'), file(Buffer.alloc(0))]) {
    await assert.rejects(service.guardar(input({ tipo: 'imagen' }), 1n, undefined, f), { statusCode: 400 });
  }
  await assert.rejects(service.guardar(input({ tipo: 'imagen' }), 1n, undefined, file(PDF)), { statusCode: 400 });
  await assert.rejects(service.guardar(input({ tipo: 'pdf', contenido: '' }), 1n), { statusCode: 400 });
  await assert.rejects(service.guardar(input({ contenido: '' }), 1n), { statusCode: 400 });
  assert.equal(rows.length, 0); assert.deepEqual(await fs.readdir(directory), []);
});
test('limita cada carga a 10 MB y los comunicados PDF a un archivo sin residuos', async () => {
  const large = await request('', { actor: 1, method: 'POST', body: multipart(input({ tipo: 'pdf' }), Buffer.alloc(10 * 1024 * 1024 + 1)) });
  assert.equal(large.status, 413);
  const form = multipart(input({ tipo: 'pdf' }), PDF); form.append('archivo', new Blob([PDF]), 'otro.pdf');
  assert.equal((await request('', { actor: 1, method: 'POST', body: form })).status, 400);
  assert.equal(rows.length, 0); assert.deepEqual(await fs.readdir(directory), []);
});
test('editar conserva archivo, permite reemplazarlo y convertir a texto; elimina archivos retirados', async () => {
  const c = await service.guardar(input({ tipo: 'imagen', contenido: '' }), 1n, undefined, file(PNG));
  const anterior = attachments[0].url_archivo;
  await service.guardar({ titulo: 'Titulo actualizado' }, 1n, 1n);
  assert.equal(attachments[0].url_archivo, anterior);
  const pdf = await service.guardar({ tipo: 'pdf' }, 1n, 1n, file(PDF, 'nuevo.pdf'));
  assert.equal(pdf.tipo, 'pdf'); await assert.rejects(fs.access(rutaArchivo(anterior)), { code: 'ENOENT' });
  const actualizado = await service.guardar({ tipo: 'texto', contenido: 'Nuevo texto' }, 1n, 1n);
  assert.equal(actualizado.tipo, 'texto'); assert.deepEqual(actualizado.adjuntos, []);
  assert.deepEqual(await fs.readdir(directory), []);
});
test('fallo de BD limpia el archivo nuevo y no deja metadatos parciales', async () => {
  failSave = true;
  await assert.rejects(service.guardar(input({ tipo: 'imagen' }), 1n, undefined, file(PNG)), /database unavailable/);
  assert.equal(rows.length, 0); assert.equal(categories.length, 0); assert.deepEqual(await fs.readdir(directory), []);
});
test('eliminar quita metadata y archivo y la ruta no acepta traversal', async () => {
  await service.guardar(input({ tipo: 'pdf' }), 1n, undefined, file(PDF, 'aviso.pdf'));
  await service.eliminar(1n, 1n);
  assert.equal(rows.length, 0); assert.equal(attachments.length, 0); assert.deepEqual(await fs.readdir(directory), []);
  assert.throws(() => rutaArchivo('../.env'), { statusCode: 404 });
  assert.throws(() => detectarArchivo(Buffer.from('%PDF-1.7 invalid')));
});
test('publico no ve comunicados vencidos o programados', async () => {
  await service.guardar(input(), 1n);
  rows[0].fecha_vencimiento = new Date(Date.now() - 10000);
  assert.equal((await service.listarPublicados()).length, 0);
  await assert.rejects(service.obtener(1n, true), { statusCode: 404 });
  rows[0].fecha_vencimiento = null; rows[0].fecha_publicacion = new Date(Date.now() + 100000);
  assert.equal((await service.listarPublicados()).length, 0);
});

test('crea varias imágenes por multipart y devuelve todos los adjuntos en orden', async () => {
  const form = multipart(input({ tipo: 'imagen', contenido: '' }));
  for (const name of ['primera.png', 'segunda.png', 'tercera.png']) form.append('archivo', new Blob([PNG], { type: 'image/png' }), name);
  const response = await request('', { actor: 1, method: 'POST', body: form });
  assert.equal(response.status, 201);
  const c = (await response.json()).data;
  assert.deepEqual(c.adjuntos.map(a => a.nombre), ['primera.png', 'segunda.png', 'tercera.png']);
  assert.equal((await fs.readdir(directory)).length, 3);
  const saved = await new ComunicadoService().obtener(BigInt(c.idComunicado));
  assert.deepEqual(saved.adjuntos, c.adjuntos);
  for (const adj of c.adjuntos) assert.equal((await fetch(base + adj.url)).status, 200);
});

test('editar añade nuevas imágenes y retira solo las indicadas; conserva archivos e identificadores restantes', async () => {
  const c = await service.guardar(input({ tipo: 'imagen' }), 1n, undefined, [file(PNG, 'primera.png'), file(PNG, 'segunda.png')]);
  const oldKeys = attachments.map(a => a.url_archivo);
  const form = multipart({ adjuntosEliminar: JSON.stringify([c.adjuntos[0].idAdjunto]) }, PNG, 'tercera.png', 'image/png');
  const result = await request('/1', { actor: 2, method: 'PUT', body: form });
  assert.equal(result.status, 200);
  const updated = (await result.json()).data;
  assert.deepEqual(updated.adjuntos.map(a => a.nombre), ['segunda.png', 'tercera.png']);
  assert.equal(updated.adjuntos[0].idAdjunto, c.adjuntos[1].idAdjunto);
  await assert.rejects(fs.access(rutaArchivo(oldKeys[0])), { code: 'ENOENT' });
  await fs.access(rutaArchivo(oldKeys[1]));
  assert.equal((await fetch(base + c.adjuntos[0].url)).status, 404);
  assert.equal((await fetch(base + c.adjuntos[1].url)).status, 200);
  assert.equal((await fs.readdir(directory)).length, 2);
});

test('permite retirar imágenes sin añadir otras, pero exige conservar al menos una', async () => {
  const c = await service.guardar(input({ tipo: 'imagen' }), 1n, undefined, [file(PNG), file(PNG)]);
  const response = await request('/1', { actor: 1, method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adjuntosEliminar: [c.adjuntos[0].idAdjunto] }) });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.adjuntos.length, 1);
  const last = await request('/1', { actor: 1, method: 'PUT', body: multipart({ adjuntosEliminar: JSON.stringify([c.adjuntos[1].idAdjunto]) }) });
  assert.equal(last.status, 400);
  assert.equal(attachments.length, 1);
  assert.equal((await fs.readdir(directory)).length, 1);
});

test('rechaza retirar adjuntos de otros comunicados, datos inválidos y selecciones obsoletas', async () => {
  const first = await service.guardar(input({ tipo: 'imagen' }), 1n, undefined, file(PNG));
  const second = await service.guardar(input({ tipo: 'imagen' }), 1n, undefined, file(PNG));
  for (const value of [JSON.stringify([second.adjuntos[0].idAdjunto]), JSON.stringify(['9999']), '[invalid', JSON.stringify(['../archivo']), JSON.stringify([first.adjuntos[0].idAdjunto, first.adjuntos[0].idAdjunto])]) {
    const response = await request('/1', { actor: 1, method: 'PUT', body: multipart({ adjuntosEliminar: value }, PNG, 'nueva.png', 'image/png') });
    assert.equal(response.status, 400);
  }
  assert.equal(attachments.length, 2);
  assert.equal((await fs.readdir(directory)).length, 2);
  assert.equal((await fetch(base + second.adjuntos[0].url)).status, 200);
});

test('la carga inicial y las ediciones respetan el máximo total de 10 imágenes', async () => {
  const form = multipart(input({ tipo: 'imagen' }));
  for (let i = 0; i < 11; i++) form.append('archivo', new Blob([PNG], { type: 'image/png' }), `imagen-${i}.png`);
  assert.equal((await request('', { actor: 1, method: 'POST', body: form })).status, 400);
  assert.equal(rows.length, 0);
  assert.deepEqual(await fs.readdir(directory), []);
  await service.guardar(input({ tipo: 'imagen' }), 1n, undefined, Array.from({ length: 9 }, () => file(PNG)));
  await assert.rejects(service.guardar({}, 1n, 1n, [file(PNG), file(PNG)]), { statusCode: 400 });
  assert.equal(attachments.length, 9);
  assert.equal((await fs.readdir(directory)).length, 9);
  const added = await service.guardar({}, 1n, 1n, file(PNG));
  assert.equal(added.adjuntos.length, 10);
});

test('un archivo inválido en un lote limpia los anteriores sin tocar las imágenes guardadas', async () => {
  await service.guardar(input({ tipo: 'imagen' }), 1n, undefined, file(PNG));
  const before = attachments[0].url_archivo;
  await assert.rejects(service.guardar({}, 1n, 1n, [file(PNG), file(Buffer.from('no es una imagen'))]), { statusCode: 400 });
  assert.deepEqual(await fs.readdir(directory), [before]);
  assert.equal(attachments.length, 1);
});

test('si falla la transacción, recupera las imágenes retiradas y limpia todo el lote nuevo', async t => {
  const original = await service.guardar(input({ tipo: 'imagen' }), 1n, undefined, [file(PNG), file(PNG)]);
  const originalKeys = attachments.map(a => a.url_archivo).sort();
  const create = prisma.adjunto_comunicado.create;
  let added = 0;
  t.mock.method(prisma.adjunto_comunicado, 'create', async args => {
    if (++added === 2) throw Error('attachment failure');
    return create(args);
  });
  await assert.rejects(service.guardar({ adjuntosEliminar: [original.adjuntos[0].idAdjunto] }, 1n, 1n, [file(PNG), file(PNG)]), /attachment failure/);
  assert.deepEqual((await fs.readdir(directory)).sort(), originalKeys);
  assert.deepEqual((await service.obtener(1n)).adjuntos, original.adjuntos);
});

test('ediciones simultáneas no exceden el límite ni reemplazan imágenes conservadas', async () => {
  await service.guardar(input({ tipo: 'imagen' }), 1n, undefined, Array.from({ length: 9 }, () => file(PNG)));
  const results = await Promise.allSettled([service.guardar({}, 1n, 1n, file(PNG)), service.guardar({}, 2n, 1n, file(PNG))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  assert.equal(attachments.length, 10);
  assert.equal((await fs.readdir(directory)).length, 10);
});
