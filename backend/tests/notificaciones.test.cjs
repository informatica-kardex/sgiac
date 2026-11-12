const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-access';
process.env.JWT_REFRESH_SECRET = 'test-refresh';
const calls = [];
require('../src/database/prisma').prisma = Object.fromEntries([
  ['solicitudAula', 2], ['solicitudDocumento', 3], ['ficha_atencion', 4],
].map(([model, total]) => [model, { count: async query => { calls.push({ model, query }); return total; } }]));
const { solicitudesPendientes } = require('../src/modules/notificaciones/notificacion.routes');
const { registerSchema } = require('../src/modules/auth/auth.validation');
const { crearEstudianteSchema, crearSubadminSchema } = require('../src/modules/users/user.validation');
const now = new Date('2026-11-04T02:30:00Z');
beforeEach(() => { calls.length = 0; });

test('administrador recibe los pendientes de aulas, documentos y jornadas vigentes de Bolivia', async () => {
  assert.deepEqual(await solicitudesPendientes({ roles: ['ADMINISTRADOR'] }, now), { 'solicitudes-aulas': 2, documentos: 3, fichas: 4 });
  assert.deepEqual(calls[0].query.where, { estado: 'PENDIENTE' });
  assert.deepEqual(calls[1].query.where, { estado: 'SOLICITADA' });
  const where = calls[2].query.where;
  assert.ok(!where.estado_actual.in.includes('ATENDIDA'));
  assert.ok(!where.estado_actual.in.includes('CANCELADA'));
  assert.equal(where.jornada_atencion.estado, 'ACTIVO');
  assert.equal(where.jornada_atencion.OR[0].fecha.gt.toISOString(), '2026-11-03T00:00:00.000Z');
  assert.equal(where.jornada_atencion.OR[1].hora_fin.gt.toISOString(), '1970-01-01T22:30:00.000Z');
});

test('subadministrador solo consulta los módulos con permiso vigente', async () => {
  const usuario = { roles: ['SUBADMINISTRADOR'], permisos: [
    { modulo: 'documentos', desde: null, hasta: null },
    { modulo: 'fichas', desde: '2026-01-01', hasta: '2026-11-01' },
  ] };
  assert.deepEqual(await solicitudesPendientes(usuario, now), { 'solicitudes-aulas': 0, documentos: 3, fichas: 0 });
  assert.deepEqual(calls.map(call => call.model), ['solicitudDocumento']);
  usuario.permisos[0] = { modulo: 'documentos', desde: '2026-12-01', hasta: '2026-12-31' };
  calls.length = 0;
  assert.deepEqual(await solicitudesPendientes(usuario, now), { 'solicitudes-aulas': 0, documentos: 0, fichas: 0 });
  assert.equal(calls.length, 0);
});

test('un estudiante no puede consultar contadores administrativos', async () => {
  assert.deepEqual(await solicitudesPendientes({ roles: ['CONSULTA_INTERNA'], permisos: [{ modulo: 'documentos', desde: null, hasta: null }] }), { 'solicitudes-aulas': 0, documentos: 0, fichas: 0 });
  assert.equal(calls.length, 0);
});

test('las tres altas exigen celular válido y normalizan el prefijo internacional', () => {
  const estudiante = { nombres: 'Ana', apellidos: 'Pérez', ci: '123', ru: '456', mencion: 'Sistemas', correo: 'ana@umsa.bo' };
  for (const [schema, body] of [
    [registerSchema, { ...estudiante, contrasena: 'Password123!', confirmarContrasena: 'Password123!' }],
    [crearEstudianteSchema, estudiante],
    [crearSubadminSchema, { nombreCompleto: 'Ana Pérez', ci: '123', correo: 'ana@umsa.bo', permisos: [] }],
  ]) {
    for (const celular of [undefined, '', '    ', '123', 'abcdefghi', '+591-ABC12345678', '1234567890123456']) {
      assert.equal(schema.safeParse({ ...body, celular }).success, false, `Rechaza ${celular}`);
    }
    assert.equal(schema.parse({ ...body, celular: ' +591 (7123)-4567 ' }).celular, '+59171234567');
    assert.equal(schema.parse({ ...body, celular: '71234567' }).celular, '71234567');
  }
});
