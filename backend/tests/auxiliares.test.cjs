const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/database/prisma');
const { auxiliarSchema } = require('../src/modules/academico/academico.validation');
const { crearEstudianteSchema } = require('../src/modules/users/user.validation');
const { tienePermiso } = require('../src/modules/roles/permissions');
let tx, student, existing, legacy, assignment, writes;
db.prisma = { $transaction: async fn => fn(tx) };
const { auxiliarService: service } = require('../src/modules/academico/auxiliar.service');
const input = { idEstudiante: '12', idAsignacion: '23' };
beforeEach(() => {
  writes = []; existing = null; legacy = null;
  student = { id_estudiante: 12n, id_usuario: 44n, nombres: 'Ana', apellidos: 'Pérez', correo_institucional: 'ana@umsa.bo', usuario: { estado: 'ACTIVO', correo: 'ana@umsa.bo' } };
  assignment = { id_paralelo: 23n, estado: 'ACTIVO', docente: { estado: 'ACTIVO' }, materia: { estado: 'ACTIVO' }, periodo_academico: { estado: 'ACTIVO' } };
  tx = {
    $executeRaw: async () => {}, estudiante: { findUnique: async () => student }, paralelo: { findUnique: async () => assignment },
    auxiliar: {
      findUnique: async ({ where }) => where.id_estudiante ? existing : legacy,
      findMany: async () => [{ id_auxiliar: 7n }, { id_auxiliar: 8n }],
      create: async ({ data }) => { writes.push(['create', data]); return { id_auxiliar: 7n, ...data }; },
      update: async ({ where, data }) => { writes.push(['update', data]); return { ...where, ...data }; },
      updateMany: async args => { writes.push(['deactivate', args]); },
    },
    auxiliar_asignacion: { upsert: async args => writes.push(['link', args]), deleteMany: async args => writes.push(['unlink', args]) },
    horario: { count: async () => 0 },
  };
});

test('no acepta alta manual, identificadores inválidos ni datos personales inyectados', () => {
  for (const body of [{ nombreCompleto: 'Ana Pérez' }, { ...input, idEstudiante: '0' }, { ...input, correo: 'otro@umsa.bo' }, { idEstudiante: '12' }]) assert.equal(auxiliarSchema.safeParse(body).success, false);
});
test('habilita desde la identidad del estudiante y vincula la asignación', async () => {
  assert.deepEqual(await service.guardar(input), { idAuxiliar: '7' });
  assert.equal(writes[0][1].id_estudiante, 12n);
  assert.equal(writes[0][1].nombre_completo, 'Ana Pérez');
  assert.deepEqual(writes[1][1].create, { id_auxiliar: 7n, id_paralelo: 23n });
});
test('rechaza estudiantes inexistentes, sin cuenta, inactivos y correos no institucionales', async () => {
  for (const invalid of [null, { ...student, usuario: null }, { ...student, usuario: { estado: 'INACTIVO', correo: 'ana@umsa.bo' } }, { ...student, usuario: { estado: 'ACTIVO', correo: 'ana@gmail.com' } }, { ...student, usuario: { estado: 'ACTIVO', correo: 'otro@umsa.bo' } }]) {
    student = invalid;
    await assert.rejects(service.guardar(input), e => [404, 409].includes(e.statusCode));
  }
  assert.equal(writes.length, 0);
});
test('rechaza duplicados y permite reactivar el mismo registro', async () => {
  existing = { id_auxiliar: 9n, estado: 'ACTIVO' };
  await assert.rejects(service.guardar(input), { statusCode: 409 });
  existing.estado = 'INACTIVO';
  assert.deepEqual(await service.guardar(input), { idAuxiliar: '9' });
  assert.equal(writes[0][0], 'update');
});
test('rechaza materias, docentes y periodos inactivos antes de habilitar', async () => {
  for (const part of ['docente', 'materia', 'periodo_academico']) {
    assignment[part].estado = 'INACTIVO';
    await assert.rejects(service.guardar(input), { statusCode: 409 });
    assignment[part].estado = 'ACTIVO';
  }
  assert.equal(writes.length, 0);
});
test('vincula registros anteriores sin reemplazar otra identidad', async () => {
  legacy = { id_auxiliar: 30n, id_estudiante: null };
  assert.deepEqual(await service.guardar(input, '30'), { idAuxiliar: '30' });
  legacy.id_estudiante = 90n;
  await assert.rejects(service.guardar(input, '30'), { statusCode: 409 });
});
test('quitar todos es indivisible si alguno tiene horarios vigentes', async () => {
  tx.horario.count = async () => 1;
  await assert.rejects(service.quitar(), { statusCode: 409 });
  assert.equal(writes.length, 0);
});
test('quitar todos retira vínculos y habilitaciones sin borrar estudiantes ni cuentas', async () => {
  assert.deepEqual(await service.quitar(), { cantidad: 2 });
  assert.deepEqual(writes.map(w => w[0]), ['unlink', 'deactivate']);
  assert.deepEqual(writes[1][1].where, { id_auxiliar: { in: [7n, 8n] } });
  assert.deepEqual(writes[1][1].data, { estado: 'INACTIVO' });
});
test('solo el administrador o subadministrador con auxiliares puede gestionar el módulo', () => {
  const permisos = [{ modulo: 'auxiliares', desde: null, hasta: null }];
  assert.equal(tienePermiso({ roles: ['ADMINISTRADOR'] }, 'auxiliares'), true);
  assert.equal(tienePermiso({ roles: ['SUBADMINISTRADOR'], permisos }, 'auxiliares'), true);
  assert.equal(tienePermiso({ roles: ['SUBADMINISTRADOR'], permisos: [{ ...permisos[0], modulo: 'docentes' }] }, 'auxiliares'), false);
  assert.equal(tienePermiso({ roles: ['CONSULTA_INTERNA'], permisos }, 'auxiliares'), false);
});
test('alta administrativa de estudiantes exige correo institucional y datos completos', () => {
  const body = { nombres: 'Ana', apellidos: 'Pérez', ci: '123', ru: '456', correo: 'ANA@UMSA.BO', mencion: 'Sistemas' };
  assert.equal(crearEstudianteSchema.parse(body).correo, 'ana@umsa.bo');
  for (const invalid of [{ ...body, correo: 'ana@gmail.com' }, { ...body, ru: '' }, { ...body, idRol: '1' }]) assert.equal(crearEstudianteSchema.safeParse(invalid).success, false);
});
