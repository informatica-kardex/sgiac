const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-access';
process.env.JWT_REFRESH_SECRET = 'test-refresh';
let active = true, reads = 0;
require('../src/database/prisma').prisma = {
  estudiante: { findUnique: async ({ where }) => { assert.equal(where.id_usuario, 42n); return active ? { usuario: { estado: 'ACTIVO' } } : null; } },
  periodo_academico: { findMany: async ({ where }) => {
    reads++; assert.deepEqual(where, { estado: 'ACTIVO' });
    return [{ id_periodo: 7n, periodo: 'II', gestion: 2026, fecha_inicio: new Date('2026-07-01'), fecha_fin: new Date('2026-12-31') }];
  } },
};
const { EstudianteService } = require('../src/modules/estudiantes/estudiante.service');
const service = new EstudianteService();
test('catálogo por mención y semestre entrega solo datos de planificación', async () => {
  const result = await service.catalogoHorario('42');
  assert.ok(result.menciones.some(m => m.id === 'SOFTWARE'));
  assert.ok(result.materias.some(m => m.planes.some(p => p.mencion === 'SOFTWARE' && p.semestre === 1)));
  assert.deepEqual(result.periodos, [{ id: '7', nombre: 'II/2026', desde: '2026-07-01', hasta: '2026-12-31' }]);
  assert.deepEqual(Object.keys(result).sort(), ['materias', 'menciones', 'periodos']);
  assert.ok(result.materias.every(m => Object.keys(m).sort().join() === 'nombre,planes,siglas'));
});
test('requiere perfil de estudiante activo antes de consultar periodos', async () => {
  active = false; const previous = reads;
  await assert.rejects(service.catalogoHorario('42'), { statusCode: 403 });
  assert.equal(reads, previous);
});
