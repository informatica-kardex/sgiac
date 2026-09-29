const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tienePermiso } = require('../src/modules/roles/permissions');
const { asignarPermisosSchema, crearSubadminSchema } = require('../src/modules/users/user.validation');
const user = permisos => ({ roles: ['SUBADMINISTRADOR'], permisos });
const start = '2026-09-28T08:00:00-04:00';
const end = '2026-09-28T10:00:00-04:00';
const timed = { modulo: 'aulas', desde: start, hasta: end };

test('periodo: antes, inicio incluido, fin excluido y después; zona horaria explícita', () => {
  assert.equal(tienePermiso(user([timed]), 'aulas', Date.parse(start) - 1), false);
  assert.equal(tienePermiso(user([timed]), 'aulas', Date.parse('2026-09-28T12:00:00Z')), true);
  assert.equal(tienePermiso(user([timed]), 'aulas', Date.parse(end) - 1), true);
  assert.equal(tienePermiso(user([timed]), 'aulas', Date.parse(end)), false);
  assert.equal(tienePermiso(user([timed]), 'aulas', Date.parse(end) + 1), false);
});
test('sin límite, sin funciones, función distinta y rol estudiante', () => {
  const permiso = { modulo: 'aulas', desde: null, hasta: null };
  assert.equal(tienePermiso(user([permiso]), 'aulas'), true);
  assert.equal(tienePermiso(user([]), 'aulas'), false);
  assert.equal(tienePermiso(user([permiso]), 'fichas'), false);
  assert.equal(tienePermiso({ roles: ['CONSULTA_INTERNA'], permisos: [permiso] }, 'aulas'), false);
  assert.equal(tienePermiso({ roles: ['ADMINISTRADOR'] }, 'aulas'), true);
  assert.equal(tienePermiso(user([{ ...permiso, desde: start }]), 'aulas'), false);
});
test('rechaza funciones administrativas, duplicados, fechas parciales, inválidas e intervalos invertidos', () => {
  for (const permisos of [
    [{ modulo: 'roles' }], [{ modulo: 'CONSULTA_INTERNA' }], [timed, timed],
    [{ ...timed, hasta: null }], [{ ...timed, desde: null }],
    [{ ...timed, hasta: start }], [{ ...timed, desde: end, hasta: start }],
    [{ ...timed, desde: 'ayer' }], [{ ...timed, desde: '2026-09-28T08:00:00' }],
  ]) assert.equal(asignarPermisosSchema.safeParse({ permisos }).success, false);
  assert.equal(asignarPermisosSchema.safeParse({ permisos: [] }).success, true);
  assert.equal(asignarPermisosSchema.safeParse({ permisos: [timed] }).success, true);
  assert.equal(crearSubadminSchema.safeParse({ nombreCompleto: 'Ana Pérez', correo: 'a@test.com', ci: '1', permisos: [], idRol: '4' }).success, false);
});
