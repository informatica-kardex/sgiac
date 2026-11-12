// node -r ts-node/register/transpile-only --test --test-isolation=none tests/fichas-jornadas.test.cjs
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const prisma = {};
require.cache[require.resolve('../src/database/prisma')] = { exports: { prisma } };
const { FichaRepository } = require('../src/modules/fichas/ficha.repository');
const { EstudianteService } = require('../src/modules/estudiantes/estudiante.service');
const { jornadaVigente, jornadaDTO, fichaDTO } = require('../src/modules/fichas/ficha.shared');
const { jornadaSchema, programarJornadasSchema, puestoSchema, siguienteSchema } = require('../src/modules/fichas/ficha.validation');
const admin = new FichaRepository(), estudiante = new EstudianteService();
const input = { idTramite: '1', identificador: 'KAR', fecha: '2026-11-04', horaInicio: '08:00', horaFin: '12:00', modoCupo: 'MANUAL', cupoTotal: 3, minutosPorEstudiante: 10, puesto: 'Kardex', estado: 'ACTIVO' };
let jornadas, fichas, historial, puestos, transacciones, locks;
const tramite = { id_tramite: 1n, nombre: 'Trámite', identificador: 'KAR', activo: true };
const perfil = { id_estudiante: 23n, nombres: 'Ana', apellidos: 'Pérez', ru: '123', correo_institucional: 'ana@example.test', usuario: { estado: 'ACTIVO', nombreCompleto: 'Ana Pérez' } };
const incluirJornada = j => ({ ...j, tramite, puestos: (j.puestos ?? []).map(p => ({ ...p, puesto: puestos.find(actual => actual.id_puesto === p.id_puesto) })),
  ficha_atencion: fichas.filter(f => f.id_jornada === j.id_jornada).map(f => ({ ...f, historial_ficha: historial.filter(h => h.id_ficha === f.id_ficha && h.estado === 'LLAMADA').sort((a, b) => Number(b.id_historial_ficha - a.id_historial_ficha)).slice(0, 1) })),
  _count: { ficha_atencion: fichas.filter(f => f.id_jornada === j.id_jornada).length, historial_ficha: historial.filter(h => h.id_jornada === j.id_jornada).length },
});
const incluirFicha = f => ({ ...f, estudiante: perfil, jornada_atencion: incluirJornada(jornadas.find(j => j.id_jornada === f.id_jornada)), historial_ficha: historial.filter(h => h.id_ficha === f.id_ficha).sort((a, b) => Number(b.id_historial_ficha - a.id_historial_ficha)).slice(0, 1) });
const coincide = (f, where) => Object.entries(where).every(([key, value]) => {
  if (key === 'jornada_atencion') return coincide(jornadas.find(j => j.id_jornada === f.id_jornada), value);
  if (value instanceof Date) return f[key].getTime() === value.getTime();
  if (value && typeof value === 'object') return value.notIn ? !value.notIn.includes(f[key]) : value.in ? value.in.includes(f[key]) : value.not ? f[key] !== value.not : value.gte ? f[key] >= value.gte : false;
  return f[key] === value;
});
const dbError = code => new Prisma.PrismaClientKnownRequestError(code, { code, clientVersion: '5' });
beforeEach(t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-11-03T14:00:00Z') });
  jornadas = []; fichas = []; historial = []; transacciones = 0; locks = [];
  puestos = [{ id_puesto: 1n, nombre: 'Kardex', activo: true }, { id_puesto: 2n, nombre: 'Ventanilla 2', activo: true }, { id_puesto: 3n, nombre: 'Ventanilla 3', activo: true }];
  const tx = {
    $queryRaw: async (sql, ...args) => { locks.push({ sql: sql.join('?'), args }); return []; },
    tramite_atencion: { findUnique: async () => tramite },
    puesto_atencion: {
      findMany: async ({ where }) => puestos.filter(p => coincide(p, where)).sort((a, b) => Number(a.id_puesto - b.id_puesto)),
      findUnique: async ({ where }) => puestos.find(p => coincide(p, where)) ?? null,
      update: async ({ where, data }) => {
        const p = puestos.find(p => coincide(p, where)); if (!p) throw dbError('P2025');
        if (data.nombre && puestos.some(other => other.id_puesto !== p.id_puesto && other.nombre === data.nombre)) throw dbError('P2002');
        Object.assign(p, data); return p;
      },
      upsert: async ({ where, create, update }) => {
        const existing = puestos.find(p => p.nombre === where.nombre);
        if (existing) { Object.assign(existing, update); return existing; }
        const p = { ...create, id_puesto: BigInt(puestos.length + 1), activo: true }; puestos.push(p); return p;
      },
    },
    jornada_puesto: {
      count: async ({ where }) => jornadas.filter(j => coincide(j, where.jornada) && j.puestos.some(p => p.id_puesto === where.id_puesto)).length,
    },
    jornada_atencion: {
      findUnique: async ({ where }) => { const j = jornadas.find(j => j.id_jornada === where.id_jornada); return j ? incluirJornada(j) : null; },
      findMany: async () => jornadas.map(incluirJornada),
      create: async ({ data }) => {
        if (jornadas.some(j => j.fecha.getTime() === data.fecha.getTime() && (j.id_tramite === data.id_tramite || j.identificador === data.identificador))) {
          throw new Prisma.PrismaClientKnownRequestError('Duplicado', { code: 'P2002', clientVersion: '5', meta: { target: ['fecha', 'id_tramite'] } });
        }
        const j = { ...data, puestos: data.puestos.create, id_jornada: BigInt(jornadas.length + 1) }; jornadas.push(j); return incluirJornada(j);
      },
      update: async ({ where, data }) => { const j = jornadas.find(j => j.id_jornada === where.id_jornada); Object.assign(j, data, data.puestos ? { puestos: data.puestos.create } : {}); return incluirJornada(j); },
      delete: async ({ where }) => {
        assert.ok(locks.some(lock => lock.sql.includes('jornada_atencion') && lock.sql.includes('FOR UPDATE') && lock.args[0] === where.id_jornada));
        const j = jornadas.find(j => j.id_jornada === where.id_jornada);
        jornadas = jornadas.filter(j => j.id_jornada !== where.id_jornada);
        return j;
      },
    },
    ficha_atencion: {
      findFirst: async ({ where, include, orderBy }) => {
        const matches = fichas.filter(f => coincide(f, where));
        if (orderBy?.numero_ficha) matches.sort((a, b) => a.numero_ficha - b.numero_ficha);
        const f = matches[0]; return f ? include ? incluirFicha(f) : f : null;
      },
      count: async ({ where }) => fichas.filter(f => coincide(f, where)).length,
      aggregate: async ({ where }) => ({ _max: { numero_ficha: Math.max(0, ...fichas.filter(f => coincide(f, where)).map(f => f.numero_ficha)) } }),
      create: async ({ data }) => { const f = { ...data, id_ficha: BigInt(fichas.length + 1) }; fichas.push(f); return f; },
      findUnique: async ({ where }) => fichas.find(f => coincide(f, where)) ?? null,
      update: async ({ where, data }) => { const f = fichas.find(f => coincide(f, where)); Object.assign(f, data); return f; },
      findUniqueOrThrow: async ({ where }) => incluirFicha(fichas.find(f => f.id_ficha === where.id_ficha)),
    },
    historial_ficha: { create: async ({ data }) => { historial.push({ ...data, id_historial_ficha: BigInt(historial.length + 1), fecha_hora: new Date() }); } },
  };
  let queue = Promise.resolve();
  Object.assign(prisma, tx, {
    estudiante: { findUnique: async () => perfil },
    $transaction: fn => {
      transacciones++;
      const operation = queue.then(async () => {
        const snapshot = structuredClone({ jornadas, fichas, historial, puestos });
        try { return await fn(tx); }
        catch (e) { ({ jornadas, fichas, historial, puestos } = snapshot); throw e; }
      });
      queue = operation.catch(() => {});
      return operation;
    },
  });
});

test('valida fechas múltiples, duplicados, fechas inexistentes y horarios', () => {
  assert.equal(programarJornadasSchema.parse({ jornadas: [input, { ...input, fecha: '2026-11-06' }] }).jornadas.length, 2);
  for (const lista of [[], [input, input], [{ ...input, fecha: '2026-02-30' }], [{ ...input, horaFin: '07:00' }], Array(61).fill(input)]) {
    assert.equal(programarJornadasSchema.safeParse({ jornadas: lista }).success, false);
  }
});

test('programa días independientes en una transacción con cupos manuales y calculados', async () => {
  const result = await admin.programarJornadas([input, { ...input, fecha: '2026-11-06', modoCupo: 'TIEMPO' }], '42');
  assert.deepEqual(result.map(j => [j.fecha, j.cupoTotal, j.disponibles]), [['2026-11-04', 3, 3], ['2026-11-06', 24, 24]]);
  assert.equal(transacciones, 1);
  assert.ok(locks.every(lock => lock.sql.includes('FOR UPDATE')));
});

test('cada día conserva su horario y calcula su propio cupo aunque otros repitan horario', async () => {
  const result = await admin.programarJornadas([
    { ...input, modoCupo: 'TIEMPO' },
    { ...input, fecha: '2026-11-05', modoCupo: 'TIEMPO', horaInicio: '14:00', horaFin: '15:30' },
    { ...input, fecha: '2026-11-06', modoCupo: 'TIEMPO' },
  ], '42');
  assert.deepEqual(result.map(j => [j.horaInicio, j.horaFin, j.cupoTotal]), [['08:00', '12:00', 24], ['14:00', '15:30', 9], ['08:00', '12:00', 24]]);
  assert.equal(transacciones, 1);
});

test('elimina una jornada vacía activa o pausada sin eliminar las demás', async () => {
  const [primera, segunda] = await admin.programarJornadas([input, { ...input, fecha: '2026-11-05', estado: 'INACTIVO' }], '42');
  await admin.borrarJornada(segunda.idJornada);
  assert.deepEqual(jornadas.map(j => String(j.id_jornada)), [primera.idJornada]);
  await assert.rejects(estudiante.solicitar('42', { idJornada: segunda.idJornada, detalle: '' }), { statusCode: 404 });
  await admin.borrarJornada(primera.idJornada);
  assert.equal(jornadas.length, 0);
  assert.equal((await admin.guardarJornada(input, '42')).fecha, input.fecha, 'La fecha vuelve a estar libre para el trámite');
});

test('rechaza eliminar una jornada con fichas de cualquier estado y conserva el historial', async () => {
  const j = await admin.guardarJornada(input, '42');
  await estudiante.solicitar('42', { idJornada: j.idJornada, detalle: '' });
  for (const estado of ['GENERADA', 'CONFIRMADA', 'EN ESPERA', 'REPROGRAMADA', 'LLAMADA', 'ATENDIDA', 'NO PRESENTADA', 'CANCELADA']) {
    fichas[0].estado_actual = estado;
    await assert.rejects(admin.borrarJornada(j.idJornada), { statusCode: 409 });
    assert.equal(jornadas.length, 1); assert.equal(fichas.length, 1); assert.equal(historial.length, 1);
  }
});

test('rechaza eliminar una jornada inexistente o con historial asociado', async () => {
  await assert.rejects(admin.borrarJornada('999'), { statusCode: 404 });
  const j = await admin.guardarJornada(input, '42');
  historial.push({ id_jornada: BigInt(j.idJornada) });
  await assert.rejects(admin.borrarJornada(j.idJornada), { statusCode: 409 });
  assert.equal(jornadas.length, 1);
});

test('un conflicto en la última fecha revierte todo el lote y conserva lo existente', async () => {
  await admin.guardarJornada({ ...input, fecha: '2026-11-06' }, '42');
  await assert.rejects(admin.programarJornadas([input, { ...input, fecha: '2026-11-06' }], '42'), { statusCode: 409 });
  assert.deepEqual(jornadas.map(j => j.fecha.toISOString().slice(0, 10)), ['2026-11-06']);
});

test('rechaza fechas pasadas y horarios sin cupo, también al programar varios días', async () => {
  await assert.rejects(admin.programarJornadas([{ ...input, fecha: '2026-11-02' }, input], '42'), { statusCode: 400 });
  await assert.rejects(admin.guardarJornada({ ...input, modoCupo: 'TIEMPO', minutosPorEstudiante: 480 }, '42'), { statusCode: 400 });
  assert.equal(jornadas.length, 0);
});

test('abre exactamente a medianoche de Bolivia del día anterior y cierra al finalizar', async t => {
  await admin.guardarJornada(input, '42');
  const j = jornadas[0];
  for (const [now, disponible] of [
    ['2026-11-03T03:59:59Z', false], ['2026-11-03T04:00:00Z', true],
    ['2026-11-04T03:59:59Z', true], ['2026-11-04T11:00:00Z', true],
    ['2026-11-04T15:59:59Z', true], ['2026-11-04T16:00:00Z', false], ['2026-11-05T04:00:00Z', false],
  ]) { t.mock.timers.setTime(new Date(now).getTime()); assert.equal(jornadaVigente(j), disponible, now); }
});

test('la apertura cruza correctamente mes, año y febrero bisiesto', async t => {
  await admin.guardarJornada(input, '42');
  for (const [fecha, apertura] of [['2027-01-01', '2026-12-31'], ['2028-03-01', '2028-02-29']]) {
    const j = { ...jornadas[0], fecha: new Date(fecha) };
    t.mock.timers.setTime(new Date(`${apertura}T03:59:59Z`).getTime()); assert.equal(jornadaVigente(j), false);
    t.mock.timers.setTime(new Date(`${apertura}T04:00:00Z`).getTime()); assert.equal(jornadaVigente(j), true);
  }
});

test('oculta jornadas lejanas y rechaza reservarlas enviando su ID directamente', async () => {
  const [abierta, futura] = await admin.programarJornadas([input, { ...input, fecha: '2026-11-06' }], '42');
  assert.deepEqual((await estudiante.jornadas('42')).map(j => j.idJornada), [abierta.idJornada]);
  await assert.rejects(estudiante.solicitar('42', { idJornada: futura.idJornada, detalle: '' }), { statusCode: 409 });
  assert.equal(fichas.length, 0);
});

test('una no presentada permite otra ficha al final de la cola y conserva su historial y cupo', async () => {
  const j = await admin.guardarJornada(input, '42');
  const booking = { idJornada: j.idJornada, detalle: 'Nuevo intento' };
  await estudiante.solicitar('42', booking);
  fichas[0].estado_actual = 'NO PRESENTADA';
  fichas.push({ ...fichas[0], id_ficha: 2n, id_estudiante: 24n, numero_ficha: 2, estado_actual: 'GENERADA' });
  const nueva = await estudiante.solicitar('42', booking);
  assert.equal(nueva.codigo, 'KAR-003');
  assert.equal(nueva.delante, 1);
  assert.equal(nueva.jornada.disponibles, 0);
  assert.equal(fichas[0].estado_actual, 'NO PRESENTADA');
  assert.equal(historial.length, 2);
  await assert.rejects(estudiante.solicitar('42', booking), { statusCode: 409 });
});

test('una no presentada no libera cupo ni permite exceder el límite', async () => {
  const j = await admin.guardarJornada({ ...input, cupoTotal: 1 }, '42');
  const booking = { idJornada: j.idJornada, detalle: '' };
  await estudiante.solicitar('42', booking); fichas[0].estado_actual = 'NO PRESENTADA';
  await assert.rejects(estudiante.solicitar('42', booking), /agotaron los cupos/);
  assert.equal(fichas.length, 1);
  assert.equal(jornadaDTO(incluirJornada(jornadas[0])).disponibles, 0);
});

test('las pendientes, llamadas y atendidas siguen bloqueando otra ficha aunque haya ausencias anteriores', async () => {
  const j = await admin.guardarJornada({ ...input, cupoTotal: 10 }, '42');
  const booking = { idJornada: j.idJornada, detalle: '' };
  await estudiante.solicitar('42', booking); fichas[0].estado_actual = 'NO PRESENTADA';
  await estudiante.solicitar('42', booking);
  for (const estado of ['GENERADA', 'CONFIRMADA', 'EN ESPERA', 'REPROGRAMADA', 'LLAMADA', 'ATENDIDA']) {
    fichas[1].estado_actual = estado;
    await assert.rejects(estudiante.solicitar('42', booking), /Ya tienes una ficha/);
    assert.equal(fichas.length, 2);
  }
});

test('conserva la posibilidad existente de reservar después de cancelar', async () => {
  const j = await admin.guardarJornada({ ...input, cupoTotal: 1 }, '42');
  const booking = { idJornada: j.idJornada, detalle: '' };
  await estudiante.solicitar('42', booking); fichas[0].estado_actual = 'CANCELADA';
  assert.equal((await estudiante.solicitar('42', booking)).numero, 2);
});

test('una no presentada no permite reservar jornadas pausadas ni vencidas', async t => {
  const j = await admin.guardarJornada(input, '42');
  const booking = { idJornada: j.idJornada, detalle: '' };
  await estudiante.solicitar('42', booking); fichas[0].estado_actual = 'NO PRESENTADA';
  jornadas[0].estado = 'INACTIVO';
  await assert.rejects(estudiante.solicitar('42', booking), { statusCode: 409 });
  jornadas[0].estado = 'ACTIVO'; t.mock.timers.setTime(new Date('2026-11-04T16:00:00Z').getTime());
  await assert.rejects(estudiante.solicitar('42', booking), { statusCode: 409 });
});

test('editar una jornada emitida conserva las restricciones de horario e identificador', async () => {
  const j = await admin.guardarJornada(input, '42');
  await estudiante.solicitar('42', { idJornada: j.idJornada, detalle: '' });
  for (const cambio of [{ identificador: 'OTRO' }, { horaInicio: '09:00' }]) {
    await assert.rejects(admin.guardarJornada(jornadaSchema.parse({ ...input, ...cambio }), '42', j.idJornada), { statusCode: 409 });
  }
  const editada = await admin.guardarJornada({ ...input, cupoTotal: 5 }, '42', j.idJornada);
  assert.equal(editada.disponibles, 4);
});

test('valida selección de puestos, nombres y puesto obligatorio al llamar', () => {
  for (const idPuestos of [['1'], ['1', '2', '3']]) {
    assert.deepEqual(jornadaSchema.parse({ ...input, puesto: undefined, idPuestos }).idPuestos, idPuestos);
  }
  for (const idPuestos of [[], ['1', '1'], ['0'], ['no-id'], Array.from({ length: 51 }, (_, i) => String(i + 1))]) {
    assert.equal(jornadaSchema.safeParse({ ...input, puesto: undefined, idPuestos }).success, false);
  }
  assert.equal(jornadaSchema.safeParse({ ...input, puesto: undefined }).success, false);
  assert.equal(puestoSchema.parse({ nombre: '  Encargada de Kardex  ' }).nombre, 'Encargada de Kardex');
  for (const nombre of ['', ' ', 'A', 'A'.repeat(81)]) assert.equal(puestoSchema.safeParse({ nombre }).success, false);
  assert.equal(siguienteSchema.safeParse({}).success, false);
  assert.equal(siguienteSchema.safeParse({ idPuesto: '0' }).success, false);
  assert.deepEqual(siguienteSchema.parse({ idPuesto: '2' }), { idPuesto: '2' });
});

test('una jornada guarda uno, varios o todos los puestos y calcula la capacidad simultánea', async () => {
  const one = await admin.guardarJornada({ ...input, puesto: undefined, idPuestos: ['2'], modoCupo: 'TIEMPO' }, '42');
  assert.equal(one.cupoTotal, 24); assert.deepEqual(one.idPuestos, ['2']); assert.equal(one.puesto, 'Ventanilla 2');
  const several = await admin.guardarJornada({ ...input, puesto: undefined, idPuestos: ['3', '1'], modoCupo: 'TIEMPO' }, '42', one.idJornada);
  assert.equal(several.cupoTotal, 48); assert.deepEqual(several.idPuestos, ['1', '3']);
  assert.deepEqual(several.puestos.map(p => p.nombre), ['Kardex', 'Ventanilla 3']);
  const all = await admin.guardarJornada({ ...input, puesto: undefined, idPuestos: ['1', '2', '3'], modoCupo: 'TIEMPO' }, '42', one.idJornada);
  assert.equal(all.cupoTotal, 72);
  const manual = await admin.guardarJornada({ ...input, puesto: undefined, idPuestos: ['1', '2', '3'] }, '42', one.idJornada);
  assert.equal(manual.cupoTotal, 3, 'El cupo manual es el total de la jornada, no se multiplica');
});

test('rechaza puestos inexistentes, retirados, duplicados y capacidad calculada excesiva sin guardar', async () => {
  puestos[1].activo = false;
  for (const idPuestos of [['999'], ['1', '2'], ['1', '999'], ['1', '1'], []]) {
    await assert.rejects(admin.guardarJornada({ ...input, puesto: undefined, idPuestos }, '42'), { statusCode: 400 });
  }
  for (let i = 4; i < 20; i++) puestos.push({ id_puesto: BigInt(i), nombre: `Puesto ${i}`, activo: true });
  await assert.rejects(admin.guardarJornada({ ...input, puesto: undefined, idPuestos: puestos.filter(p => p.activo).map(p => String(p.id_puesto)), modoCupo: 'TIEMPO', minutosPorEstudiante: 1, horaInicio: '07:00', horaFin: '22:00' }, '42'), { statusCode: 400 });
  assert.equal(jornadas.length, 0);
});

test('una jornada con fichas conserva los puestos aunque cambie su orden de selección o nombre', async () => {
  const values = { ...input, puesto: undefined, idPuestos: ['1', '2'] };
  const j = await admin.guardarJornada(values, '42');
  await estudiante.solicitar('42', { idJornada: j.idJornada, detalle: '' });
  for (const idPuestos of [['1'], ['2', '3'], ['1', '2', '3']]) {
    await assert.rejects(admin.guardarJornada({ ...values, idPuestos }, '42', j.idJornada), { statusCode: 409 });
  }
  await admin.guardarPuesto('Oficina de Kardex', '1');
  const edited = await admin.guardarJornada({ ...values, idPuestos: ['2', '1'], estado: 'INACTIVO' }, '42', j.idJornada);
  assert.equal(edited.estado, 'INACTIVO'); assert.deepEqual(edited.idPuestos, ['1', '2']);
  assert.equal(edited.puestos[0].nombre, 'Oficina de Kardex'); assert.equal(edited.emitidas, 1);
});

async function colaParaHoy(t, count = 3, idPuestos = ['1', '2']) {
  const j = await admin.guardarJornada({ ...input, puesto: undefined, idPuestos, cupoTotal: count }, '42');
  await estudiante.solicitar('42', { idJornada: j.idJornada, detalle: 'Prueba de atención' });
  for (let i = 1; i < count; i++) fichas.push({ ...fichas[0], id_ficha: BigInt(i + 1), id_estudiante: BigInt(i + 23), numero_ficha: i + 1 });
  t.mock.timers.setTime(new Date('2026-11-04T14:00:00Z').getTime());
  return j;
}

test('dos puestos atienden la misma cola en orden; repetir una petición no duplica ni salta fichas', async t => {
  const j = await colaParaHoy(t);
  assert.equal(fichaDTO(incluirFicha(fichas[1])).esperaMinutos, 0, 'El segundo estudiante cabe en la primera tanda de dos puestos');
  assert.equal(fichaDTO(incluirFicha(fichas[2])).esperaMinutos, 10, 'El tercero espera una tanda, no dos');
  locks = [];
  const [first, repeat, second] = await Promise.all([
    admin.siguiente(j.idJornada, '42', '1'), admin.siguiente(j.idJornada, '43', '1'), admin.siguiente(j.idJornada, '44', '2'),
  ]);
  assert.equal(first.codigo, 'KAR-001'); assert.equal(repeat.idFicha, first.idFicha);
  assert.equal(second.codigo, 'KAR-002'); assert.notEqual(second.idFicha, first.idFicha);
  assert.equal(first.idPuesto, '1'); assert.equal(first.puesto, 'Kardex'); assert.equal(second.puesto, 'Ventanilla 2');
  assert.equal(historial.filter(h => h.estado === 'LLAMADA').length, 2);
  assert.equal(fichas[2].estado_actual, 'GENERADA');
  assert.equal(locks.length, 6);
  for (let i = 0; i < locks.length; i += 2) {
    assert.match(locks[i].sql, /puesto_atencion.*FOR UPDATE/);
    assert.match(locks[i + 1].sql, /jornada_atencion.*FOR UPDATE/);
  }
  await admin.accion(first.idFicha, 'FINALIZAR', '42');
  const third = await admin.siguiente(j.idJornada, '42', '1');
  assert.equal(third.codigo, 'KAR-003'); assert.equal(third.idPuesto, '1');
});

test('rechaza llamar desde puestos no habilitados o retirados y conserva toda la cola', async t => {
  const j = await colaParaHoy(t, 2, ['1']);
  await assert.rejects(admin.siguiente(j.idJornada, '42', '2'), { statusCode: 400 });
  await assert.rejects(admin.siguiente(j.idJornada, '42', '999'), { statusCode: 400 });
  puestos[0].activo = false;
  await assert.rejects(admin.siguiente(j.idJornada, '42', '1'), { statusCode: 400 });
  assert.ok(fichas.every(f => f.estado_actual === 'GENERADA'));
  assert.equal(historial.filter(h => h.estado === 'LLAMADA').length, 0);
});

test('un puesto ocupado en otro trámite exige finalizar su ficha antes de llamar otra', async t => {
  const first = await colaParaHoy(t, 2, ['1', '2']);
  const second = await admin.guardarJornada({ ...input, idTramite: '2', identificador: 'DOC', puesto: undefined, idPuestos: ['1', '2'] }, '42');
  fichas.push({ ...fichas[0], id_ficha: 3n, id_jornada: BigInt(second.idJornada), numero_ficha: 1 });
  const call = await admin.siguiente(first.idJornada, '42', '1');
  await assert.rejects(admin.siguiente(second.idJornada, '42', '1'), /otro trámite/);
  assert.equal(fichas.find(f => f.id_ficha === 3n).estado_actual, 'GENERADA');
  await admin.accion(call.idFicha, 'AUSENTE', '42');
  const next = await admin.siguiente(second.idJornada, '42', '1');
  assert.equal(next.codigo, 'DOC-001');
});

test('el tablero expone todos los puestos llamados y un renombrado conserva el destino anunciado', async t => {
  const j = await colaParaHoy(t);
  const one = await admin.siguiente(j.idJornada, '42', '1');
  await admin.siguiente(j.idJornada, '42', '2');
  await admin.guardarPuesto('Oficina académica', '1');
  const repeated = await admin.accion(one.idFicha, 'RELLAMAR', '42');
  assert.equal(repeated.puesto, 'Kardex');
  assert.equal(repeated.jornada.puestos[0].nombre, 'Oficina académica');
  const board = await admin.tablero();
  assert.deepEqual(board.jornadas[0].actuales.map(f => [f.codigo, f.puesto]), [['KAR-001', 'Kardex'], ['KAR-002', 'Ventanilla 2']]);
  assert.deepEqual(board.jornadas[0].siguientes, ['KAR-003']);
  assert.equal(board.ultimosLlamados[0].codigo, 'KAR-001'); assert.equal(board.ultimosLlamados[0].puesto, 'Kardex');
});

test('crear, renombrar y retirar puestos conserva referencias históricas y reactiva el mismo identificador', async t => {
  const nuevo = await admin.guardarPuesto('Encargada de Kardex');
  assert.equal(nuevo.idPuesto, '4');
  await admin.guardarPuesto('Coordinación', nuevo.idPuesto);
  assert.ok((await admin.puestos()).some(p => p.nombre === 'Coordinación'));
  await assert.rejects(admin.guardarPuesto('Ventanilla 2', nuevo.idPuesto), { statusCode: 409 });
  const j = await admin.guardarJornada({ ...input, puesto: undefined, idPuestos: ['4'] }, '42');
  await assert.rejects(admin.borrarPuesto('4'), { statusCode: 409 });
  assert.equal(puestos.find(p => p.id_puesto === 4n).activo, true);
  t.mock.timers.setTime(new Date('2026-11-05T14:00:00Z').getTime());
  await admin.borrarPuesto('4');
  assert.ok(!(await admin.puestos()).some(p => p.idPuesto === '4'));
  assert.equal(jornadas[0].puestos[0].id_puesto, 4n);
  assert.equal((await admin.jornadas(j.fecha))[0].puestos[0].nombre, 'Coordinación');
  const reactivado = await admin.guardarPuesto('Coordinación');
  assert.equal(reactivado.idPuesto, '4'); assert.equal(puestos.length, 4);
  await assert.rejects(admin.borrarPuesto('999'), { statusCode: 404 });
});
