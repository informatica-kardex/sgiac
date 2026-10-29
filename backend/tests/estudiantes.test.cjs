// node -r ts-node/register/transpile-only --test tests/estudiantes.test.cjs
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-access';
process.env.JWT_REFRESH_SECRET = 'test-refresh';
const prisma = {
  estudiante: { findUnique() {}, findFirst() {} },
  usuario: { create() {} }, rol: { findUnique() {} },
  ficha_atencion: { findMany() {} }, jornada_atencion: { findMany() {} }, $transaction() {},
};
require('../src/database/prisma').prisma = prisma;
const { EstudianteService, ahoraBolivia } = require('../src/modules/estudiantes/estudiante.service');
const { registerSchema } = require('../src/modules/auth/auth.validation');
const { solicitarFichaSchema } = require('../src/modules/estudiantes/estudiante.routes');
const { AuthRepository } = require('../src/modules/auth/auth.repository');
let student, jornada, tx, calls;
const service = new EstudianteService();
const input = { idJornada: '7', motivo: 'Certificado', detalle: 'Solicito certificado de notas.' };
beforeEach(t => {
  student = { id_estudiante: 23n, id_usuario: 42n, nombres: 'Ana', apellidos: 'Pérez', ci: '123', ru: '456', correo_institucional: 'ana@example.test', carrera: 'Sistemas', usuario: { estado: 'ACTIVO' } };
  jornada = { id_jornada: 7n, fecha: new Date('2099-10-01T00:00:00Z'), hora_inicio: new Date('1970-01-01T08:00:00Z'), hora_fin: new Date('1970-01-01T16:00:00Z'), cupo_total: 2, estado: 'ACTIVO' };
  calls = [];
  tx = {
    $queryRaw: async () => { calls.push('lock'); },
    jornada_atencion: { findUnique: async () => jornada },
    ficha_atencion: {
      findFirst: async () => null, count: async () => 1,
      aggregate: async () => ({ _max: { numero_ficha: 3 } }),
      create: async ({ data }) => { calls.push(data); return { ...data, id_ficha: 99n, jornada_atencion: jornada }; },
    },
    historial_ficha: { create: async ({ data }) => { calls.push(data); } },
  };
  t.mock.method(prisma.estudiante, 'findUnique', async ({ where }) => { assert.equal(where.id_usuario, 42n); return student; });
  t.mock.method(prisma, '$transaction', async fn => fn(tx));
  t.mock.method(prisma.rol, 'findUnique', async () => ({ idRol: 4n, nombre: 'CONSULTA_INTERNA' }));
});

test('registro acepta mención sin semestre ni gestión y persiste en la columna existente', async t => {
  const data = registerSchema.parse({ nombres: 'Ana', apellidos: 'Pérez', ci: '123', ru: '456', mencion: ' Sistemas ', correo: 'ana@example.test', contrasena: 'Password123!', confirmarContrasena: 'Password123!' });
  assert.equal(data.mencion, 'Sistemas');
  t.mock.method(prisma.estudiante, 'findFirst', async () => null);
  t.mock.method(prisma.usuario, 'create', async ({ data: user }) => {
    assert.equal(user.estudiante.create.carrera, 'Sistemas');
    assert.equal('semestre' in user.estudiante.create, false);
    assert.equal('gestion' in user.estudiante.create, false);
  });
  await new AuthRepository().crearEstudiante(data, 'hash');
});
test('perfil devuelve solo datos del estudiante autenticado', async () => {
  assert.deepEqual(await service.perfil('42'), { nombres: 'Ana', apellidos: 'Pérez', ci: '123', ru: '456', correo: 'ana@example.test', mencion: 'Sistemas' });
});
test('cuenta sin perfil o inactiva no puede solicitar ni consultar', async () => {
  student.usuario.estado = 'INACTIVO';
  await assert.rejects(service.solicitar('42', input), { statusCode: 403 });
  student = null;
  await assert.rejects(service.fichas('42'), { statusCode: 403 });
});
test('historial se filtra por ID del estudiante y conserva IDs bigint como texto', async t => {
  t.mock.method(prisma.ficha_atencion, 'findMany', async ({ where }) => {
    assert.deepEqual(where, { id_estudiante: 23n });
    return [{ id_ficha: 9007199254740993n, numero_ficha: 1, motivo_atencion: 'Notas', estado_actual: 'GENERADA', fecha_generacion: new Date('2026-09-24'), jornada_atencion: jornada }];
  });
  const result = await service.fichas('42');
  assert.equal(result[0].idFicha, '9007199254740993');
});
test('solicitud bloquea jornada, numera sin reutilizar fichas y guarda historial', async () => {
  const result = await service.solicitar('42', input);
  assert.equal(calls[0], 'lock');
  assert.equal(calls[1].id_estudiante, 23n);
  assert.equal(calls[1].id_jornada, 7n);
  assert.equal(calls[1].numero_ficha, 4);
  assert.equal(calls[2].id_usuario, 42n);
  assert.equal(calls[2].id_ficha, 99n);
  assert.equal(result.idFicha, '99');
  assert.equal(result.estado, 'GENERADA');
});
test('rechaza duplicado sin crear otra ficha', async () => {
  tx.ficha_atencion.findFirst = async () => ({ id_ficha: 1n });
  await assert.rejects(service.solicitar('42', input), { statusCode: 409 });
  assert.deepEqual(calls, ['lock']);
});
test('rechaza jornadas llenas', async () => {
  tx.ficha_atencion.count = async () => 2;
  await assert.rejects(service.solicitar('42', input), { statusCode: 409 });
  assert.deepEqual(calls, ['lock']);
});
test('rechaza jornadas inexistentes, inactivas o vencidas', async () => {
  jornada.estado = 'INACTIVO';
  await assert.rejects(service.solicitar('42', input), { statusCode: 409 });
  jornada.estado = 'ACTIVO'; jornada.fecha = new Date('2020-01-01');
  await assert.rejects(service.solicitar('42', input), { statusCode: 409 });
  jornada = null;
  await assert.rejects(service.solicitar('42', input), { statusCode: 409 });
});
test('lista disponibilidad real sin cupos negativos y excluye jornada vencida', async t => {
  t.mock.method(prisma.jornada_atencion, 'findMany', async () => [
    { ...jornada, _count: { ficha_atencion: 5 } },
    { ...jornada, fecha: new Date('2020-01-01'), _count: { ficha_atencion: 0 } },
  ]);
  const result = await service.jornadas('42');
  assert.equal(result.length, 1);
  assert.equal(result[0].disponibles, 0);
});
test('validación descarta identidad enviada por cliente y rechaza ID fuera de rango', () => {
  const data = solicitarFichaSchema.parse({ ...input, idEstudiante: '100', estado: 'ATENDIDA' });
  assert.deepEqual(data, input);
  assert.equal(solicitarFichaSchema.safeParse({ ...input, idJornada: '9223372036854775808' }).success, false);
  assert.equal(solicitarFichaSchema.safeParse({ ...input, motivo: '   ' }).success, false);
});
test('fecha local de Bolivia cruza correctamente la medianoche UTC', () => {
  assert.deepEqual(ahoraBolivia(new Date('2026-09-25T02:30:00Z')), { fecha: '2026-09-24', hora: '22:30:00' });
});
