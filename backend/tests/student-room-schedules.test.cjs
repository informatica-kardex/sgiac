// Datos simulados: no usa ni modifica la base de datos.
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/database/prisma');
let estudiante, consultas, incluirTemporales;
db.prisma = {
  estudiante: { findUnique: async args => { consultas.push(['estudiante', args]); return estudiante; } },
  ambiente: { findMany: async args => { consultas.push(['aulas', args]); return [
    { codigo_ambiente: 'SS-A1', nombre: 'Aula 1', lugar: 'INFORMATICA', piso: -1, inventarioInterno: 'privado' },
    { codigo_ambiente: 'SS-A2', nombre: 'Aula 2', lugar: 'INFORMATICA', piso: -1 },
  ]; } },
  periodo_academico: { findMany: async args => { consultas.push(['periodos', args]); return [
    { id_periodo: 3n, gestion: 2026, periodo: 'II', estado: 'ACTIVO', fecha_inicio: new Date('2026-07-01'), fecha_fin: new Date('2026-12-31') },
  ]; } },
};
require('../src/modules/horarios/horario.repository').HorarioRepository.prototype.findAll = async temporales => {
  incluirTemporales = temporales;
  return [{ idHorario: 1, aula: 'SS-A1', idPeriodo: '3', materia: 'Programación', fecha: '2026-11-16', motivo: 'Detalle interno de solicitud' }];
};
const { EstudianteService } = require('../src/modules/estudiantes/estudiante.service');
const service = new EstudianteService();
beforeEach(() => { estudiante = { id_estudiante: 12n, usuario: { estado: 'ACTIVO' } }; consultas = []; incluirTemporales = false; });

test('consulta todas las aulas, incluso vacías, y las reservas sin motivos internos', async () => {
  const data = await service.horariosAulas('44');
  assert.deepEqual(consultas[0][1].where, { id_usuario: 44n });
  assert.deepEqual(data.aulas.map(a => a.codigo), ['SS-A1', 'SS-A2']);
  assert.equal(data.horarios.length, 1);
  assert.equal(data.horarios[0].fecha, '2026-11-16');
  assert.equal(incluirTemporales, true);
  assert.equal(data.horarios[0].motivo, '');
  assert.ok(!JSON.stringify(data).includes('privado'));
  assert.ok(!JSON.stringify(data).includes('Detalle interno'));
  assert.equal(data.periodos[0].fechaInicio, '2026-07-01');
  assert.deepEqual(consultas.find(([key]) => key === 'periodos')[1].where, { estado: 'ACTIVO' });
});

test('exige un perfil estudiantil activo antes de consultar aulas', async () => {
  for (const perfil of [null, { usuario: null }, { usuario: { estado: 'INACTIVO' } }]) {
    estudiante = perfil; consultas = [];
    await assert.rejects(service.horariosAulas('44'), { statusCode: 403 });
    assert.deepEqual(consultas.map(([key]) => key), ['estudiante']);
  }
});

const express = require('express');
const auth = require('../src/middlewares/auth.middleware');
const original = auth.requireAuth;
auth.requireAuth = (req, res, next) => {
  if (!req.headers.authorization) return res.sendStatus(401);
  req.user = { idUsuario: '44', roles: ['CONSULTA_INTERNA'], correoVerificado: true, debeCambiarPassword: false, permisos: [] };
  next();
};
const router = require('../src/modules/estudiantes/estudiante.routes').default;
const aulasRouter = require('../src/modules/aulas/aula.routes').default;
auth.requireAuth = original;
const app = express();
app.use('/api/estudiantes', router);
app.use('/api/aulas', aulasRouter);
app.use(require('../src/middlewares/error.middleware').errorMiddleware);
const server = app.listen(0, '127.0.0.1');
after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));

test('HTTP: requiere sesión, no almacena la consulta y no concede acceso administrativo', async () => {
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const url = `${base}/estudiantes/horarios-aulas`;
  assert.equal((await fetch(url)).status, 401);
  const headers = { Authorization: 'student' };
  const response = await fetch(url, { headers });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal((await response.json()).data.aulas.length, 2);
  assert.equal((await fetch(`${base}/aulas`, { headers })).status, 403);
  assert.equal((await fetch(url, { method: 'POST', headers })).status, 404);
  estudiante = null;
  assert.equal((await fetch(url, { headers })).status, 403);
});
