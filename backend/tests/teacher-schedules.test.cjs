// Datos simulados: no abre conexiones ni modifica la base de datos.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const dbPath = require.resolve('../dist/database/prisma');
let calls = 0;
const row = (id, idDocente, estadoPeriodo, extra = {}) => ({
  id_horario: BigInt(id), id_paralelo: BigInt(id), codigo_ambiente: 'A1', dia_semana: 'LUNES', estado: 'ASIGNADO',
  fecha: null, motivo: null, id_auxiliar: null, auxiliar: null,
  bloque_horario: { hora_inicio: new Date('1970-01-01T08:00:00Z'), hora_fin: new Date('1970-01-01T10:00:00Z') }, ambiente: { lugar: 'INFORMATICA', piso: 1 },
  paralelo: { id_docente: BigInt(idDocente), codigo_materia: 'INF-111', nombre_paralelo: 'A', id_periodo: BigInt(id), materia: { nombre: 'Programación', siglas: [{ sigla: 'INF-111' }] }, docente: { nombre_completo: 'Ana', grado_academico: 'Lic.' }, periodo_academico: { estado: estadoPeriodo, gestion: 2026, periodo: 'II' } }, ...extra,
});
const rows = [row(1, 1, 'ACTIVO'), row(2, 1, 'INACTIVO', { fecha: new Date('2025-10-01T00:00:00Z'), motivo: 'Examen anterior' }), row(3, 1, 'ACTIVO', { id_auxiliar: 2n, auxiliar: { nombre_completo: 'Julia' } }), row(4, 2, 'ACTIVO')];
const prisma = {
  docente: { findUnique: async ({ where }) => where.id_docente === 1n ? { id_docente: 1n } : null },
  horario: { findMany: async ({ where }) => { calls++; return rows.filter(h => h.paralelo.id_docente === where.paralelo.id_docente && (!where.estado || h.estado === where.estado) && (!where.paralelo.periodo_academico?.estado || h.paralelo.periodo_academico.estado === where.paralelo.periodo_academico.estado)); } },
};
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { prisma } };
const { HorarioRepository } = require('../dist/modules/horarios/horario.repository');
const repository = new HorarioRepository();
test('consulta solo el docente indicado e incluye periodos inactivos, reservas anteriores y auxiliares', async () => {
  const schedules = await repository.findByDocente('1');
  assert.deepEqual(schedules.map(h => h.idHorario), [1, 2, 3]);
  assert.equal(schedules[1].fecha, '2025-10-01');
  assert.equal(schedules[2].responsable, 'Julia');
  assert.equal(schedules[0].estado, 'ASIGNADO');
});
test('rechaza identificadores inválidos y docentes inexistentes sin consultar horarios', async () => {
  const before = calls;
  await assert.rejects(repository.findByDocente('abc'));
  await assert.rejects(repository.findByDocente('0'));
  await assert.rejects(repository.findByDocente('2'), e => e.statusCode === 404);
  assert.equal(calls, before);
});
