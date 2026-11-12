// node -r ts-node/register/transpile-only --test tests/auxiliar-carnet.test.cjs
// Base simulada; no modifica datos ni envía notificaciones.
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/database/prisma');
const { env } = require('../src/config/env');
env.auxiliarCarnetSecret = 'carnet-test-secret-only';
let auxiliar, horarios, consultas, consultasHorario, asignaciones, consultasPropietario, consultasMaterias;
db.prisma = {
  auxiliar: {
    findUnique: async ({ where }) => { consultas++; return auxiliar?.id_auxiliar === where.id_auxiliar ? auxiliar : null; },
    findFirst: async ({ where }) => { consultasPropietario.push(where); return auxiliar?.estudiante?.id_usuario === where.estudiante.id_usuario ? auxiliar : null; },
  },
  paralelo: { findMany: async args => { consultasMaterias.push(args); return asignaciones; } },
  horario: { findMany: async args => { consultasHorario.push(args); return horarios; } },
};
const { auxiliarCarnetService: service } = require('../src/modules/academico/auxiliar-carnet.service');
const ahora = new Date('2026-11-10T02:30:00Z'); // Sigue siendo lunes 9 en Bolivia.
beforeEach(() => {
  consultas = 0; consultasHorario = []; consultasPropietario = []; consultasMaterias = [];
  auxiliar = { id_auxiliar: 7n, id_estudiante: 12n, estado: 'ACTIVO', estudiante: {
    nombres: 'Ana María', apellidos: 'Pérez', ru: '123456', correo_institucional: 'ana@umsa.bo',
    id_usuario: 44n, usuario: { estado: 'ACTIVO', correo: 'ana@umsa.bo' },
  } };
  horarios = [{
    id_horario: 20n, id_paralelo: 23n, dia_semana: 'LUNES', fecha: null, codigo_ambiente: 'A-101',
    bloque_horario: { hora_inicio: new Date('1970-01-01T08:00:00Z'), hora_fin: new Date('1970-01-01T10:00:00Z') },
    ambiente: { lugar: 'INFORMATICA', piso: 1 },
    paralelo: { nombre_paralelo: 'A', materia: { nombre: 'Programación' }, periodo_academico: {
      periodo: 'II', gestion: 2026, fecha_inicio: new Date('2026-07-01'), fecha_fin: new Date('2026-12-20'),
    } },
  }];
  asignaciones = [{ id_paralelo: 23n, id_docente: 4n, id_periodo: 3n, codigo_materia: 'INF-111', nombre_paralelo: 'A', estado: 'ACTIVO',
    materia: { nombre: 'Programación', siglas: [{ sigla: 'INF-111' }] }, docente: { nombre_completo: 'Docente titular' },
    periodo_academico: { periodo: 'II', gestion: 2026, fecha_inicio: new Date('2026-07-01'), fecha_fin: new Date('2026-12-20') } }];
});

test('carnet estable: datos del estudiante y referencia que no es una sesión', async () => {
  const c = await service.emitir('7');
  assert.equal(c.nombreCompleto, 'Ana María Pérez');
  assert.equal(c.ru, '123456');
  assert.deepEqual(c.materias, ['Programación']);
  assert.match(c.token, /^7\.[A-Za-z0-9_-]{43}$/);
  assert.equal(c.token, (await service.emitir('7')).token);
  assert.ok(!c.token.includes(c.ru));
});

test('el carnet incluye materias vinculadas sin horario, sin duplicarlas por paralelo', async () => {
  horarios = [];
  asignaciones.push({ ...asignaciones[0], id_paralelo: 24n, nombre_paralelo: 'B' },
    { ...asignaciones[0], codigo_materia: 'INF-112', materia: { nombre: 'Fundamentos digitales' } });
  const c = await service.emitir('7');
  assert.deepEqual(c.materias, ['Programación', 'Fundamentos digitales']);
  const filtro = consultasMaterias[0].where;
  assert.deepEqual(filtro.auxiliares, { some: { id_auxiliar: 7n } });
  assert.equal(filtro.estado, 'ACTIVO');
  assert.equal(filtro.materia.estado, 'ACTIVO');
  assert.equal(filtro.docente.estado, 'ACTIVO');
  assert.equal(filtro.periodo_academico.estado, 'ACTIVO');
  assert.ok(filtro.periodo_academico.fecha_fin.gte instanceof Date);
  asignaciones = [];
  assert.deepEqual((await service.emitir('7')).materias, []);
  assert.equal((await service.emitir('7')).token, c.token);
});

test('el mismo QR muestra cambios de aula, hora, fecha y eliminación sin reemitirse', async () => {
  const { token } = await service.emitir('7');
  assert.equal((await service.consultar(token, ahora)).horarios[0].aula, 'A-101');
  horarios[0].codigo_ambiente = 'LASIN-2';
  horarios[0].bloque_horario.hora_inicio = new Date('1970-01-01T14:00:00Z');
  horarios[0].fecha = new Date('2026-11-16');
  const updated = await service.consultar(token, ahora);
  assert.equal(updated.horarios[0].aula, 'LASIN-2');
  assert.equal(updated.horarios[0].horaInicio, '14:00');
  assert.equal(updated.horarios[0].fecha, '2026-11-16');
  horarios = [];
  assert.deepEqual((await service.consultar(token, ahora)).horarios, []);
});

test('la respuesta pública excluye RU, CI, correo, teléfono, usuario, motivo y token', async () => {
  const { token } = await service.emitir('7');
  const data = await service.consultar(token, ahora);
  assert.deepEqual(Object.keys(data).sort(), ['consultadoEn', 'horarios', 'nombreCompleto']);
  for (const key of ['ru', 'ci', 'correo', 'telefono', 'estudiante', 'usuario', 'motivo', 'token']) {
    assert.ok(!JSON.stringify(data).includes(`"${key}"`));
  }
  assert.ok(!JSON.stringify(data).includes('ana@umsa.bo'));
});

test('consulta solo asignaciones publicadas, vinculadas y activas; excluye reservas pasadas en hora boliviana', async () => {
  const { token } = await service.emitir('7');
  await service.consultar(token, ahora);
  const { where } = consultasHorario[0];
  assert.equal(where.id_auxiliar, 7n);
  assert.equal(where.estado, 'ASIGNADO');
  assert.equal(where.publicado, true);
  assert.deepEqual(where.OR, [{ fecha: null }, { fecha: { gte: new Date('2026-11-09') } }]);
  assert.deepEqual(where.paralelo.auxiliares, { some: { id_auxiliar: 7n } });
  assert.deepEqual(where.paralelo.periodo_academico, { estado: 'ACTIVO', fecha_fin: { gte: new Date('2026-11-09') } });
});

test('rechaza referencias manipuladas y formatos inválidos sin divulgar identidad', async () => {
  const { token } = await service.emitir('7');
  for (const value of ['', '7', '../7', '0.' + 'A'.repeat(43), '1'.repeat(20) + '.' + 'A'.repeat(43)]) {
    const previo = consultas;
    await assert.rejects(service.consultar(value), { statusCode: 404 });
    assert.equal(consultas, previo);
  }
  await assert.rejects(service.consultar(token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A')), { statusCode: 404 });
  assert.equal(consultasHorario.length, 0);
  auxiliar.id_estudiante = 13n;
  await assert.rejects(service.consultar(token), { statusCode: 404 });
});

test('la baja del auxiliar, cuenta inactiva, desvinculada o inexistente deshabilita la consulta', async () => {
  const { token } = await service.emitir('7');
  const original = structuredClone(auxiliar);
  for (const a of [null, { ...original, estado: 'INACTIVO' }, { ...original, estudiante: null },
    { ...original, estudiante: { ...original.estudiante, usuario: null } },
    { ...original, estudiante: { ...original.estudiante, usuario: { estado: 'INACTIVO' } } }]) {
    auxiliar = a;
    await assert.rejects(service.emitir('7'), { statusCode: 404 });
    await assert.rejects(service.consultar(token), { statusCode: 404 });
  }
});

test('el auxiliar obtiene su mismo carnet desde su sesión, sin privilegios administrativos', async () => {
  const propio = await service.emitirParaUsuario('44');
  assert.deepEqual(propio, await service.emitir('7'));
  assert.deepEqual(consultasPropietario[0], { estudiante: { id_usuario: 44n } });
  await assert.rejects(service.emitirParaUsuario('45'), { statusCode: 403 });
  for (const estado of ['INACTIVO', 'BLOQUEADO']) {
    auxiliar.estado = estado;
    await assert.rejects(service.emitirParaUsuario('44'), { statusCode: 403 });
  }
});

test('el acceso personal rechaza cuentas ajenas, no institucionales o desvinculadas', async () => {
  for (const correo of ['ana@gmail.com', 'otra@umsa.bo']) {
    auxiliar.estudiante.usuario.correo = correo;
    await assert.rejects(service.emitirParaUsuario('44'), { statusCode: 403 });
  }
  auxiliar.estudiante.usuario = null;
  await assert.rejects(service.emitirParaUsuario('44'), { statusCode: 403 });
});

// Integración HTTP con autenticación simulada y los permisos reales del router.
const express = require('express');
const auth = require('../src/middlewares/auth.middleware');
const originalRequireAuth = auth.requireAuth;
auth.requireAuth = (req, res, next) => {
  if (!req.headers.authorization) return res.status(401).json({ success: false });
  req.user = { idUsuario: req.headers.authorization === 'student45' ? '45' : '44', roles: [req.headers.authorization.startsWith('student') ? 'CONSULTA_INTERNA' : req.headers.authorization === 'admin' ? 'ADMINISTRADOR' : 'SUBADMINISTRADOR'],
    correoVerificado: true, debeCambiarPassword: false, permisos: [{ modulo: req.headers.authorization === 'auxiliares' ? 'auxiliares' : 'docentes', desde: null, hasta: null }] };
  next();
};
const router = require('../src/modules/academico/academico.routes').default;
const estudiantesRouter = require('../src/modules/estudiantes/estudiante.routes').default;
auth.requireAuth = originalRequireAuth;
const app = express();
app.use('/api/academico', router);
app.use('/api/estudiantes', estudiantesRouter);
app.use(require('../src/middlewares/error.middleware').errorMiddleware);
const server = app.listen(0, '127.0.0.1');
after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));

test('HTTP: lectura anónima sin caché; emitir exige permiso auxiliares y los demás catálogos siguen privados', async () => {
  const { token } = await service.emitir('7');
  const base = `http://127.0.0.1:${server.address().port}/api/academico`;
  const publicResponse = await fetch(`${base}/auxiliares/carnet/${token}`);
  assert.equal(publicResponse.status, 200);
  assert.match(publicResponse.headers.get('cache-control'), /no-store/);
  assert.match(publicResponse.headers.get('x-robots-tag'), /noindex/);
  const data = await publicResponse.json();
  assert.equal(data.data.horarios[0].aula, 'A-101');
  for (const path of ['/auxiliares', '/horarios', '/auxiliares/7/carnet']) {
    assert.equal((await fetch(base + path)).status, 401);
  }
  assert.equal((await fetch(`${base}/auxiliares/7/carnet`, { headers: { Authorization: 'docentes' } })).status, 403);
  for (const role of ['admin', 'auxiliares']) {
    assert.equal((await fetch(`${base}/auxiliares/7/carnet`, { headers: { Authorization: role } })).status, 200);
  }
  auxiliar.estado = 'INACTIVO';
  const response = await fetch(`${base}/auxiliares/carnet/${token}`);
  assert.equal(response.status, 404);
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('HTTP: Mi auxiliatura requiere sesión y no permite elegir el carnet de otro usuario', async () => {
  const base = `http://127.0.0.1:${server.address().port}/api`;
  for (const path of ['/estudiantes/auxiliatura', '/estudiantes/auxiliatura/carnet']) assert.equal((await fetch(base + path)).status, 401);
  const headers = { Authorization: 'student44' };
  const res = await fetch(base + '/estudiantes/auxiliatura', { headers });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control'), /no-store/);
  const { data } = await res.json();
  assert.equal(data.perfil.habilitado, true);
  assert.equal(data.perfil.asignaciones[0].idAsignacion, '23');
  assert.equal(data.horarios[0].idAsignacion, '23');
  assert.ok(consultasHorario.every(q => q.where.id_auxiliar === 7n));
  const carnet = await (await fetch(base + '/estudiantes/auxiliatura/carnet?idAuxiliar=999&idUsuario=45', { headers })).json();
  assert.equal(carnet.data.idAuxiliar, '7', 'Los parámetros no sustituyen la identidad autenticada');
  assert.equal((await fetch(base + '/academico/auxiliares/7/carnet', { headers })).status, 403);
  assert.equal((await fetch(base + '/estudiantes/auxiliatura/carnet', { headers: { Authorization: 'student45' } })).status, 403);
  const ajeno = await (await fetch(base + '/estudiantes/auxiliatura', { headers: { Authorization: 'student45' } })).json();
  assert.deepEqual(ajeno.data, { perfil: { habilitado: false, datos: null, asignaciones: [] }, horarios: [] });
  auxiliar.estado = 'INACTIVO';
  assert.equal((await fetch(base + '/estudiantes/auxiliatura/carnet', { headers })).status, 403);
  const baja = await (await fetch(base + '/estudiantes/auxiliatura', { headers })).json();
  assert.equal(baja.data.perfil.habilitado, false);
  assert.deepEqual(baja.data.horarios, []);
});
