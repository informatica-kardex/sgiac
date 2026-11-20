// Datos y archivos aislados: no consulta la base de datos ni publica horarios reales.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { ZodError } = require('zod');
const cache = (name, exports) => { const file = require.resolve(name); require.cache[file] = { id: file, filename: file, loaded: true, exports }; };
let reads = 0;
const period = { id_periodo: 1n, gestion: 2026, periodo: 'II', estado: 'ACTIVO', fecha_inicio: new Date('2026-07-01'), fecha_fin: new Date('2026-12-31') };
const schedule = { idHorario: 1, idPeriodo: '1', aula: 'LASIN-1', docente: 'Ana', responsable: 'Ana', motivo: 'INTERNO', avisos: ['INTERNO'], reubicaciones: ['INTERNO'] };
cache('../src/database/prisma', { prisma: {
  ambiente: { findMany: async () => { reads++; return [{ codigo_ambiente: 'LASIN-1', nombre: 'Laboratorio', lugar: 'LASIN', piso: 1, capacidad:36 }]; } },
  periodo_academico: { findMany: async () => [period] },
} });
cache('../src/modules/horarios/horario.repository', { HorarioRepository: class { async findAll(temporary) { assert.equal(temporary, true); return [schedule, { ...schedule, idPeriodo: '2' }]; } } });
cache('../src/modules/estudiantes/estudiante.service', { EstudianteService: class { async horariosAulas(id) { assert.equal(id, 'student'); return { aulas: [], periodos: [], horarios: [schedule] }; } } });
cache('../src/modules/horarios/horario.controller', { horarioController: Object.fromEntries(['listar', 'obtener', 'crear', 'crearLote', 'actualizar', 'eliminar'].map(key => [key, (_req, res) => res.json({ success: true })])) });
cache('../src/modules/horarios/horario.import', { horarioImport: {} });
const { ApiError } = require('../src/utils/apiError');
const auth = require('../src/middlewares/auth.middleware');
auth.requireAuth = (req, _res, next) => {
  const role = req.headers.authorization;
  if (!['admin', 'student', 'aulas-only'].includes(role)) return next(ApiError.unauthorized());
  req.user = { idUsuario: role, roles: [role === 'admin' ? 'ADMINISTRADOR' : role === 'student' ? 'CONSULTA_INTERNA' : 'SUBADMINISTRADOR'], permisos: role === 'aulas-only' ? [{ modulo: 'aulas', desde: null, hasta: null }] : [], correoVerificado: true, debeCambiarPassword: false };
  next();
};
const { createLocationPublicationStore, locationPublication } = require('../src/modules/aulas/ubicacion.service');
const { schedulePublication, publishedSchedules } = require('../src/modules/horarios/horario.publicacion');
const routes = require('../src/modules/horarios/horario.routes').default;
const directories = [];
let server;
after(async () => { if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } for (const dir of directories) await fs.rm(dir, { recursive: true, force: true }); });
const isolated = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sgiac-horarios-publicacion-')); directories.push(dir);
  const store = createLocationPublicationStore(dir);
  schedulePublication.read = store.read; schedulePublication.save = store.save;
  return { dir, store };
};

test('publicar y retirar cada portal persiste sin modificar ubicación ni exponer datos internos', async () => {
  const { dir, store } = await isolated();
  locationPublication.read = async () => { throw Error('No debe consultar ni modificar la publicación de ubicación'); };
  assert.deepEqual(await publishedSchedules('publico'), { publicado: false, aulas: [], periodos: [], horarios: [] });
  assert.equal(reads, 0);
  await store.save({ publico: true, estudiantes: false });
  assert.equal((await createLocationPublicationStore(dir).read()).publico, true);
  const data = await publishedSchedules('publico');
  assert.equal(data.publicado, true); assert.equal(data.aulas[0].codigo, 'LASIN-1'); assert.equal(data.horarios.length, 1);
  assert.equal(data.aulas[0].capacidad,36);
  assert.equal(JSON.stringify(data).includes('INTERNO'), false);
  assert.equal((await publishedSchedules('estudiantes', 'student')).publicado, false);
  await store.save({ publico: false, estudiantes: true });
  const before = reads;
  assert.equal((await publishedSchedules('publico')).publicado, false); assert.equal(reads, before);
  assert.equal((await publishedSchedules('estudiantes', 'student')).publicado, true);
  await store.save({ publico: true, estudiantes: true });
  assert.equal((await publishedSchedules('publico')).publicado, true);
  assert.equal((await publishedSchedules('estudiantes', 'student')).publicado, true);
});

test('la ruta pública exige publicación y la configuración exige permiso de horarios', async () => {
  await isolated();
  const app = express(); app.use(express.json()); app.use('/horarios', routes);
  app.use((error, _req, res, _next) => res.status(error.statusCode || (error instanceof ZodError ? 400 : 500)).json({ message: error.message }));
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const request = (route, role, method = 'GET', body) => fetch(`http://127.0.0.1:${server.address().port}/horarios/publicacion/${route}`, {
    method, headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: role } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal((await request('visibilidad')).status, 200);
  assert.equal((await request('config')).status, 401);
  for (const role of ['student', 'aulas-only']) {
    assert.equal((await request('config', role)).status, 403);
    assert.equal((await request('config', role, 'PUT', { publico: true, estudiantes: true })).status, 403);
  }
  assert.equal((await request('config', 'admin', 'PUT', { publico: 'true', estudiantes: false })).status, 400);
  assert.equal((await request('config', 'admin', 'PUT', { publico: true, estudiantes: false, otro: true })).status, 400);
  assert.equal((await request('config', 'admin', 'PUT', { publico: true, estudiantes: false })).status, 200);
  const response = await request('publico'); assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal((await response.json()).data.publicado, true);
  await request('config', 'admin', 'PUT', { publico: false, estudiantes: true });
  assert.deepEqual((await (await request('publico')).json()).data, { publicado: false, aulas: [], periodos: [], horarios: [] });
});
