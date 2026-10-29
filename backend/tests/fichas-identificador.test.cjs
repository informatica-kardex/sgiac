// node -r ts-node/register/transpile-only --test tests/fichas-identificador.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { jornadaSchema, tramiteSchema } = require('../src/modules/fichas/ficha.validation');
const { codigoFicha } = require('../src/modules/fichas/ficha.shared');
const jornada = { idTramite: '1', identificador: 'KAR', fecha: '2099-12-01', horaInicio: '08:00', horaFin: '12:00', modoCupo: 'MANUAL', cupoTotal: 24, minutosPorEstudiante: 10, puesto: 'Kardex' };

test('identificador normaliza mayúsculas y espacios exteriores', () => {
  assert.equal(jornadaSchema.parse({ ...jornada, identificador: ' kar2 ' }).identificador, 'KAR2');
  assert.equal(jornadaSchema.safeParse({ ...jornada, identificador: 'A' }).success, true);
  assert.equal(jornadaSchema.safeParse({ ...jornada, identificador: 'A'.repeat(20) }).success, true);
  assert.equal(tramiteSchema.parse({ nombre: 'Adición o retiro', identificador: ' arm ' }).identificador, 'ARM');
});

test('el trámite requiere identificador y ambos formularios rechazan códigos inválidos', () => {
  for (const identificador of [undefined, null, '', '   ', '1A', 'A B', 'KAR-01', 'Á', 'A'.repeat(21), '<script>', 123]) {
    assert.equal(tramiteSchema.safeParse({ nombre: 'Trámite de prueba', identificador }).success, false, String(identificador));
    if (identificador !== undefined) assert.equal(jornadaSchema.safeParse({ ...jornada, identificador }).success, false, String(identificador));
  }
  assert.equal(jornadaSchema.safeParse({ ...jornada, identificador: undefined }).success, true, 'La jornada puede heredar el identificador guardado en el trámite');
});

test('formato de ficha usa identificador y conserva números mayores que 999', () => {
  const j = { id_jornada: 7n, identificador: 'KAR' };
  assert.equal(codigoFicha(j, 1), 'KAR-001');
  assert.equal(codigoFicha(j, 12), 'KAR-012');
  assert.equal(codigoFicha(j, 1000), 'KAR-1000');
});

test('las jornadas anteriores conservan su código y la precisión de IDs grandes', () => {
  assert.equal(codigoFicha({ id_jornada: 7n, identificador: null }, 3), 'J7-003');
  assert.equal(codigoFicha({ id_jornada: 9007199254740993n, identificador: null }, 1), 'J9007199254740993-001');
});
