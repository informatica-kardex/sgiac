// Prueba integral con datos sintéticos propios; limpia únicamente sus registros al terminar.
// Ejecutar desde backend después de npm run build y migrate-fichas.cjs --apply.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const tvTestDir = path.resolve(__dirname, `../.test-tv-${randomUUID()}`);
process.env.TV_UPLOAD_DIR = tvTestDir;
const { prisma } = require('../dist/database/prisma');
const shared = require('../dist/modules/fichas/ficha.shared');
const realClock = shared.ahoraBolivia;
shared.ahoraBolivia = () => ({ fecha: '2099-12-01', hora: '10:00:00' });
const { FichaService } = require('../dist/modules/fichas/ficha.service');
const { EstudianteService } = require('../dist/modules/estudiantes/estudiante.service');
const { idSchema, jornadaSchema, solicitarFichaSchema } = require('../dist/modules/fichas/ficha.validation');
const { signAccessToken, credentialVersion } = require('../dist/utils/jwt');
const admin = new FichaService(), student = new EstudianteService();
const prefix = `__TEST_FICHAS_${randomUUID().slice(0, 8)}`;
const userIds = [], tramiteIds = [];
let server;

(async () => {
  assert.equal(idSchema.safeParse('foo').success, false);
  assert.equal(idSchema.safeParse('9223372036854775808').success, false);
  assert.equal(jornadaSchema.safeParse({ fecha: '2026-02-30' }).success, false);
  assert.deepEqual(solicitarFichaSchema.parse({ idJornada: '1', solicitante: 'Suplantado', motivo: 'Suplantado' }), { idJornada: '1', detalle: '' });
  for (let n = 0; n < 3; n++) {
    const u = await prisma.usuario.create({ data: { nombreCompleto: `${prefix} Persona ${n}`, correo: `${prefix}.${n}@example.test`, correoVerificado: true } });
    userIds.push(u.idUsuario);
    if (n) await prisma.estudiante.create({ data: { nombres: `${prefix} Nombre ${n}`, apellidos: 'Prueba', ci: `${prefix}${n}`, ru: `${prefix}${n}`, correo_institucional: u.correo, id_usuario: u.idUsuario } });
  }
  const role = await prisma.rol.findUniqueOrThrow({ where: { nombre: 'ADMINISTRADOR' } });
  await prisma.usuarioRol.create({ data: { idUsuario: userIds[0], idRol: role.idRol } });
  const [a, s1, s2] = userIds.map(String);
  const identificador = `T${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
  const t1 = await admin.guardarTramite({ nombre: `${prefix} Manual`, descripcion: 'Prueba', identificador }); tramiteIds.push(BigInt(t1.idTramite));
  const t2 = await admin.guardarTramite({ nombre: `${prefix} Tiempo`, descripcion: '', identificador: `${identificador}B` }); tramiteIds.push(BigInt(t2.idTramite));
  assert.equal((await admin.tramites()).find(t => t.idTramite === t1.idTramite).identificador, identificador, 'Persiste el identificador en el trámite');
  await assert.rejects(admin.guardarTramite({ nombre: t2.nombre, descripcion: t2.descripcion, identificador }, t2.idTramite), { statusCode: 409 }, 'No se duplica el identificador entre trámites activos');
  const input = { idTramite: t1.idTramite, identificador, fecha: '2099-12-01', horaInicio: '08:00', horaFin: '16:00', modoCupo: 'MANUAL', cupoTotal: 1, minutosPorEstudiante: 10, puesto: 'Prueba', estado: 'ACTIVO' };
  const j1 = await admin.guardarJornada({ ...input, identificador: undefined }, a);
  assert.equal(j1.identificador, identificador);
  await assert.rejects(admin.guardarJornada({ ...input, idTramite: t2.idTramite }, a), { statusCode: 409 }, 'No se repite el identificador en la misma fecha');
  const booking = { idJornada: j1.idJornada, detalle: '' };
  const races = await Promise.allSettled([student.solicitar(s1, booking), student.solicitar(s2, booking)]);
  assert.equal(races.filter(r => r.status === 'fulfilled').length, 1, 'Debe otorgarse solo el último cupo');
  assert.equal(races.find(r => r.status === 'rejected').reason.statusCode, 409);
  const win = races.findIndex(r => r.status === 'fulfilled');
  const first = races[win].value, winner = [s1, s2][win], loser = [s1, s2][1 - win];
  assert.equal(first.numero, 1);
  assert.equal(first.codigo, `${identificador}-001`);
  assert.match(first.solicitante, /Persona/);
  assert.equal((await student.fichas(loser)).length, 0);
  await assert.rejects(student.cancelar(loser, first.idFicha), { statusCode: 404 });
  await student.cancelar(winner, first.idFicha);
  await assert.rejects(admin.guardarJornada({ ...input, identificador: `${identificador}X` }, a, j1.idJornada), { statusCode: 409 }, 'Una cancelación no permite cambiar el identificador');
  const f1 = await student.solicitar(s1, booking);
  assert.equal(f1.numero, 2, 'Un número cancelado no se reutiliza');
  assert.equal(f1.codigo, `${identificador}-002`);
  await assert.rejects(student.solicitar(s1, booking), { statusCode: 409 });
  await admin.guardarJornada({ ...input, cupoTotal: 2 }, a, j1.idJornada);
  const f2 = await student.solicitar(s2, booking);
  assert.equal(f2.numero, 3);
  assert.equal(f2.delante, 1);
  await assert.rejects(admin.guardarJornada(input, a, j1.idJornada), { statusCode: 409 });
  await assert.rejects(admin.guardarJornada({ ...input, cupoTotal: 2, puesto: 'Otro puesto' }, a, j1.idJornada), { statusCode: 409 });
  await assert.rejects(admin.borrarTramite(t1.idTramite), { statusCode: 409 });
  const calls = await Promise.all([admin.siguiente(j1.idJornada, a), admin.siguiente(j1.idJornada, a)]);
  assert.ok(calls.every(f => f.idFicha === f1.idFicha), 'Dos operadores no saltan ni duplican turnos');
  await assert.rejects(student.cancelar(s1, f1.idFicha), { statusCode: 409 });
  const event1 = (await admin.tablero()).jornadas.find(j => j.idJornada === j1.idJornada).actual.evento;
  await admin.accion(f1.idFicha, 'RELLAMAR', a);
  const board = await admin.tablero();
  const publicJ = board.jornadas.find(j => j.idJornada === j1.idJornada);
  assert.equal(publicJ.actual.codigo, f1.codigo);
  assert.notEqual(publicJ.actual.evento, event1);
  assert.equal(board.ultimosLlamados.filter(h => h.codigo === f1.codigo).length, 1, 'El rellamado no duplica el historial de TV');
  assert.equal(board.ultimosLlamados[0].puesto, input.puesto);
  assert.deepEqual(publicJ.siguientes, [f2.codigo]);
  const publicText = JSON.stringify(board);
  for (const field of ['solicitante', 'correo', 'id_estudiante', 'motivo_atencion', 'Persona']) assert.ok(!publicText.includes(field), 'El tablero no expone datos personales');
  await admin.accion(f1.idFicha, 'FINALIZAR', a);
  const historialTrasFinalizar = (await new FichaService().tablero()).ultimosLlamados;
  assert.equal(historialTrasFinalizar[0].codigo, f1.codigo, 'El historial se recupera de la BD después de finalizar');
  assert.equal(historialTrasFinalizar[0].estado, 'ATENDIDA');
  await assert.rejects(admin.accion(f1.idFicha, 'FINALIZAR', a), { statusCode: 409 });
  assert.equal((await admin.siguiente(j1.idJornada, a)).idFicha, f2.idFicha);
  await admin.accion(f2.idFicha, 'AUSENTE', a);
  assert.deepEqual((await admin.tablero()).ultimosLlamados.map(h => h.codigo), [f2.codigo, f1.codigo], 'Orden de llamados, no de finalización');
  await assert.rejects(admin.siguiente(j1.idJornada, a), { statusCode: 409 });
  assert.equal((await student.fichas(s2))[0].estado, 'NO PRESENTADA');
  assert.equal((await prisma.historial_ficha.findMany({ where: { id_ficha: BigInt(f1.idFicha) } })).length, 4);
  const nuevoIdentificador = `${identificador}N`;
  await admin.guardarTramite({ nombre: t1.nombre, descripcion: t1.descripcion, identificador: nuevoIdentificador }, t1.idTramite);
  assert.equal((await student.fichas(s1)).find(f => f.idFicha === f1.idFicha).codigo, f1.codigo, 'Editar el trámite no cambia las fichas emitidas');
  const nueva = await admin.guardarJornada({ ...input, fecha: '2099-12-04', identificador: undefined }, a);
  assert.equal(nueva.identificador, nuevoIdentificador, 'Las nuevas jornadas heredan el cambio del trámite');

  const legacy = await prisma.jornada_atencion.create({ data: {
    id_tramite: BigInt(t2.idTramite), id_usuario: BigInt(a), fecha: new Date('2099-12-03'),
    hora_inicio: new Date('1970-01-01T08:00:00Z'), hora_fin: new Date('1970-01-01T16:00:00Z'),
    cupo_total: 1, modo_cupo: 'MANUAL', minutos_por_estudiante: 10, puesto: 'Prueba',
  } });
  const legacyId = String(legacy.id_jornada), legacyPrefix = `J${legacyId}`;
  const legacyFicha = await student.solicitar(s1, { idJornada: legacyId, detalle: '' });
  assert.equal(legacyFicha.codigo, `${legacyPrefix}-001`, 'Conserva códigos de jornadas anteriores');
  const legacyInput = { ...input, idTramite: t2.idTramite, fecha: '2099-12-03', identificador: legacyPrefix };
  await admin.guardarJornada({ ...legacyInput, estado: 'INACTIVO' }, a, legacyId);
  assert.equal((await student.fichas(s1)).find(f => f.idFicha === legacyFicha.idFicha).codigo, legacyFicha.codigo);
  await assert.rejects(admin.guardarJornada({ ...legacyInput, idTramite: t1.idTramite }, a), { statusCode: 409 }, 'Un identificador nuevo no colisiona con los códigos anteriores');

  const timed = { ...input, idTramite: t2.idTramite, modoCupo: 'TIEMPO', horaFin: '08:35', fecha: '2099-12-02', cupoTotal: 99 };
  const j2 = await admin.guardarJornada(timed, a);
  assert.equal(j2.identificador, identificador, 'El identificador puede reutilizarse en otra fecha');
  assert.equal((await admin.guardarJornada({ ...timed, identificador: `${identificador}X` }, a, j2.idJornada)).identificador, `${identificador}X`, 'Se puede editar antes de emitir fichas');
  assert.equal(j2.cupoTotal, 3, 'El cupo automático se calcula en el servidor');
  await assert.rejects(admin.siguiente(j2.idJornada, a), { statusCode: 409 });
  await admin.guardarJornada({ ...timed, estado: 'INACTIVO' }, a, j2.idJornada);
  await assert.rejects(student.solicitar(s1, { idJornada: j2.idJornada, detalle: '' }), { statusCode: 409 });
  await admin.guardarJornada(timed, a, j2.idJornada);
  assert.ok((await student.jornadas(s1)).some(j => j.idJornada === j2.idJornada));
  await admin.borrarTramite(t1.idTramite);
  assert.ok(!(await admin.tramites()).some(t => t.idTramite === t1.idTramite));
  assert.equal((await admin.jornadas('2099-12-01')).find(j => j.idJornada === j1.idJornada).estado, 'INACTIVO');
  await assert.rejects(admin.guardarJornada({ ...input, cupoTotal: 2 }, a, j1.idJornada), { statusCode: 409 });
  assert.ok((await student.fichas(s1)).some(f => f.idFicha === f1.idFicha), 'Eliminar trámite conserva el historial');

  // API real: permisos, identidad, validación y acceso anónimo al tablero.
  const app = require('../dist/app').default;
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const token = id => signAccessToken({ idUsuario: id, correo: 'ignored@example.test', roles: [], credentialVersion: credentialVersion(null) });
  const request = async (path, id, method = 'GET', body) => {
    const res = await fetch(base + path, { method, headers: { ...(id ? { Authorization: `Bearer ${token(id)}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, body: await res.json() };
  };
  assert.equal((await request('/fichas/tablero')).status, 200);
  assert.equal((await request('/fichas/panel')).status, 401);
  assert.equal((await request('/fichas/panel', s1)).status, 403);
  assert.equal((await request('/fichas/panel?fecha=2099-12-01', a)).status, 200);
  assert.equal((await request(`/fichas/tramites/${t2.idTramite}`, s1, 'PUT', t2)).status, 403);
  const tramiteActualizado = await request(`/fichas/tramites/${t2.idTramite}`, a, 'PUT', { nombre: t2.nombre, descripcion: t2.descripcion, identificador: ` ${t2.identificador.toLowerCase()} ` });
  assert.equal(tramiteActualizado.status, 200);
  assert.equal(tramiteActualizado.body.data.identificador, t2.identificador, 'La API guarda el identificador editable en mayúsculas');
  assert.equal((await request('/fichas/jornadas/foo/siguiente', a, 'POST')).status, 400);
  assert.equal((await request('/estudiantes/atencion', s1)).status, 200);
  assert.equal((await request('/estudiantes/fichas', null, 'POST', { idJornada: j2.idJornada })).status, 401);
  const apiFicha = await request('/estudiantes/fichas', s1, 'POST', { idJornada: j2.idJornada, solicitante: 'Nombre falso', correo: 'fake@example.test' });
  assert.equal(apiFicha.status, 201);
  assert.equal(apiFicha.body.data.solicitante, `${prefix} Persona 1`);
  // Control de TV: solo administradores y subadministradores con permiso vigente.
  assert.equal((await request('/fichas/tv/config')).status, 401);
  assert.equal((await request('/fichas/tv/config', s1)).status, 403);
  for (const [ruta, method, body] of [['/config', 'PUT', { voz: true }], ['/actualizar', 'POST'], ['/probar-voz', 'POST'], ['/archivos', 'POST'], ['/archivos/00000000-0000-4000-8000-000000000000', 'DELETE']]) {
    assert.equal((await request('/fichas/tv' + ruta, s1, method, body)).status, 403);
  }
  assert.equal((await request('/fichas/tv/config', a, 'PUT', { voz: true })).status, 200);
  const roleSub = await prisma.rol.findUniqueOrThrow({ where: { nombre: 'SUBADMINISTRADOR' } });
  await prisma.usuarioRol.create({ data: { idUsuario: BigInt(s2), idRol: roleSub.idRol } });
  assert.equal((await request('/fichas/tv/config', s2)).status, 403);
  await prisma.permisoUsuario.create({ data: { idUsuario: BigInt(s2), modulo: 'fichas' } });
  assert.equal((await request('/fichas/tv/config', s2)).status, 200);
  assert.equal((await request('/fichas/tv/config', s2, 'PUT', { voz: false })).status, 200);
  const beforeTV = (await request('/fichas/tv/config', a)).body.data;
  assert.equal((await request('/fichas/tv/actualizar', a, 'POST')).status, 200);
  assert.equal((await request('/fichas/tv/probar-voz', s2, 'POST')).status, 200);
  const afterTV = (await request('/fichas/tablero')).body.data.tv;
  assert.notEqual(afterTV.revision, beforeTV.revision);
  assert.notEqual(afterTV.pruebaVoz, beforeTV.pruebaVoz);
  const png = await fs.readFile(path.resolve(__dirname, '../../frontend/public/images/kardex.png'));
  const form = new FormData(); form.append('archivo', new Blob([png], { type: 'image/png' }), 'prueba-tv.png');
  const uploaded = await fetch(base + '/fichas/tv/archivos', { method: 'POST', headers: { Authorization: `Bearer ${token(a)}` }, body: form });
  assert.equal(uploaded.status, 201);
  const media = (await uploaded.json()).data.archivos[0];
  const download = await fetch(base.replace('/api', '') + media.url);
  assert.equal(download.status, 200); assert.equal(download.headers.get('content-type'), 'image/png');
  assert.equal(download.headers.get('cross-origin-resource-policy'), 'cross-origin', 'La TV puede mostrar medios desde otro puerto');
  assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), png);
  const range = await fetch(base.replace('/api', '') + media.url, { headers: { Range: 'bytes=0-15' } });
  assert.equal(range.status, 206); assert.equal((await range.arrayBuffer()).byteLength, 16);
  assert.equal(range.headers.get('cross-origin-resource-policy'), 'cross-origin');
  const bad = new FormData(); bad.append('archivo', new Blob(['<script>alert(1)</script>'], { type: 'image/png' }), 'falsa.png');
  assert.equal((await fetch(base + '/fichas/tv/archivos', { method: 'POST', headers: { Authorization: `Bearer ${token(a)}` }, body: bad })).status, 400);
  const disk = JSON.parse(await fs.readFile(path.join(tvTestDir, 'config.json'), 'utf8'));
  assert.equal(disk.archivos[0].id, media.id);
  assert.equal((await request('/fichas/tv/archivos/' + media.id, s2, 'DELETE')).status, 200);
  assert.equal((await fetch(base.replace('/api', '') + media.url)).status, 404);
  await prisma.permisoUsuario.delete({ where: { idUsuario_modulo: { idUsuario: BigInt(s2), modulo: 'fichas' } } });
  assert.equal((await request('/fichas/tv/config', s2, 'PUT', { voz: true })).status, 403);
  console.log('TV_CONTROL_OK: permisos admin/subadmin/estudiante, publicación, lectura pública y rangos, validación, persistencia, borrado y revocación.');
  console.log('ATENCION_OK: cupo concurrente, numeración, duplicados, identidad, aislamiento, cancelación, FIFO concurrente, rellamado, finalización, ausente, duración, pausa, archivo, historial, privacidad y permisos HTTP.');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  shared.ahoraBolivia = realClock;
  try {
    await prisma.$transaction(async tx => {
      await tx.ficha_atencion.deleteMany({ where: { jornada_atencion: { id_tramite: { in: tramiteIds } } } });
      await tx.jornada_atencion.deleteMany({ where: { id_tramite: { in: tramiteIds } } });
      await tx.tramite_atencion.deleteMany({ where: { id_tramite: { in: tramiteIds } } });
      await tx.estudiante.deleteMany({ where: { id_usuario: { in: userIds } } });
      await tx.usuario.deleteMany({ where: { idUsuario: { in: userIds } } });
    });
    console.log('DATOS_SINTETICOS_ELIMINADOS');
  } finally {
    const files = await fs.readdir(tvTestDir).catch(e => { if (e.code === 'ENOENT') return []; throw e; });
    for (const name of files) {
      assert.match(name, /^(config\.json|[a-f0-9-]{36}\.(png|jpg|webp|mp4|webm|tmp))$/);
      await fs.unlink(path.join(tvTestDir, name));
    }
    await fs.rmdir(tvTestDir).catch(e => { if (e.code !== 'ENOENT') throw e; });
    await prisma.$disconnect();
  }
});
