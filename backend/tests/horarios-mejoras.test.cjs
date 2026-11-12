// Ejecutar con: node -r ts-node/register/transpile-only --test tests/horarios-mejoras.test.cjs
// Datos en memoria: no consulta PostgreSQL ni envía correos reales.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const frontendCache = new Map();
function frontend(relative) {
  const file = path.resolve(__dirname, '../../frontend/src', relative);
  if (frontendCache.has(file)) return frontendCache.get(file);
  const module = { exports: {} }; frontendCache.set(file, module.exports);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function('require', 'module', 'exports', source)(name => name.startsWith('.') ? frontend(path.relative(path.resolve(__dirname, '../../frontend/src'), path.resolve(path.dirname(file), name + '.ts'))) : require(name), module, module.exports);
  return module.exports;
}
const { searchRooms, EMPTY_ROOM_SEARCH } = frontend('admin/schedule/room-search.ts');
const { semesterSessions } = frontend('admin/schedule/semester.ts');
const { searchSchedulePeople, EMPTY_PEOPLE_FILTERS } = frontend('admin/schedule/people-search.ts');
const period = { idPeriodo: '1', estado: 'ACTIVO', fechaInicio: '2026-07-01', fechaFin: '2026-12-31', periodo: 'II', gestion: 2026 };
const rooms = ['A1', 'A2', 'A3'].map(codigo => ({ codigo, nombre: codigo, capacidad: 40, tipo: 'AULA', lugar: 'INFORMATICA', piso: 1, estado: 'disponible' }));
const dto = (id, extra = {}) => ({ idHorario: id, idPeriodo: '1', idAsignacion: '1', idDocente: '1', idAuxiliar: null, responsable: 'Ana Docente', docente: 'Ana Docente', aula: 'A1', materia: 'Programación', codigoMateria: 'INF-111', siglas: ['INF-111'], grupo: 'A', dia: 'LUNES', horaInicio: '08:00', horaFin: '10:00', fecha: null, ...extra });
const available = horarios => ({ horarios, periodos: [period], periodId: '1', today: '2026-11-11' });
test('filtra docentes y auxiliares por día, hora exacta e intervalos que se cruzan', () => {
  const rows = [dto(1), dto(2, { esAuxiliar: true, idAuxiliar: '7', responsable: 'Julia Auxiliar', horaInicio: '09:00', horaFin: '11:00' }), dto(3, { dia: 'MARTES' }), dto(4, { horaInicio: '10:00', horaFin: '12:00' }), dto(5, { fecha: '2026-11-09' })];
  const find = filters => searchSchedulePeople(rows, '1', '2026-11-11', { ...EMPTY_PEOPLE_FILTERS, ...filters }).sessions.map(h => h.idHorario);
  assert.deepEqual(find({ day: 'LUNES', start: '08:00', end: '10:00' }), [1, 2]);
  assert.deepEqual(find({ start: '08:30' }), [1, 3]);
  assert.deepEqual(find({ day: 'LUNES', start: '10:00' }), [4, 2]);
  assert.deepEqual(find({ day: 'LUNES', role: 'auxiliar' }), [2]);
  assert.equal(searchSchedulePeople(rows, '1', '2026-11-11', { ...EMPTY_PEOPLE_FILTERS, start: '12:00', end: '10:00' }).sessions.length, 0);
});
test('buscar solo lunes devuelve las franjas libres, sin exigir horas ni declarar libre todo el día', () => {
  const r = searchRooms(rooms, { ...EMPTY_ROOM_SEARCH, day: 'LUNES' }, available([dto(1)]));
  assert.equal(r.availabilityError, ''); assert.equal(r.flexibleTime, true); assert.equal(r.adequate.length, 3);
  assert.deepEqual(r.freeWindows.get('A1'), [{ start: '07:00', end: '08:00' }, { start: '10:00', end: '22:00' }]);
  const occupied = searchRooms([rooms[0]], { ...EMPTY_ROOM_SEARCH, day: 'LUNES' }, available([dto(1, { horaInicio: '07:00', horaFin: '22:00' })]));
  assert.equal(occupied.adequate.length, 0); assert.ok(occupied.alternatives.length);
});
test('si no hay aula ofrece mismo día a otra hora y otro día a la misma hora conservando filtros', () => {
  const result = searchRooms(rooms, { ...EMPTY_ROOM_SEARCH, students: '35', type: 'AULA', place: 'INFORMATICA', day: 'LUNES', start: '08:00', end: '10:00' }, available(rooms.map((a,i) => dto(i, { aula: a.codigo }))));
  assert.equal(result.adequate.length, 0);
  assert.ok(result.alternatives.some(s => s.kind === 'same-day' && s.day === 'LUNES' && s.start === '10:00' && s.end === '12:00'));
  assert.ok(result.alternatives.some(s => s.kind === 'other-day' && s.day === 'MARTES' && s.start === '08:00' && s.end === '10:00'));
  assert.ok(result.alternatives.every(s => s.room.capacidad >= 35));
});
test('alternativas de una fecha conservan modalidad temporal y respetan fin de periodo', () => {
  const r = searchRooms([rooms[0]], { ...EMPTY_ROOM_SEARCH, date: '2026-12-28', day: 'LUNES', start: '08:00', end: '10:00' }, available([dto(1)]));
  assert.ok(r.alternatives.some(s => s.date === '2026-12-29' && s.start === '08:00'));
  assert.ok(r.alternatives.every(s => s.date >= '2026-12-28' && s.date <= period.fechaFin));
});
test('la disponibilidad respeta traslados por fecha, reservas, otros periodos y bordes contiguos', () => {
  const rows = [dto(1, { esAuxiliar: true, traslados: [{ fecha: '2026-11-16', aula: 'A2' }] }), dto(2, { aula: 'A2', fecha: '2026-11-16', idHorarioBase: 1 })];
  const filter = { ...EMPTY_ROOM_SEARCH, date: '2026-11-16', day: 'LUNES', start: '08:00', end: '10:00' };
  assert.deepEqual(searchRooms(rooms, filter, available(rows)).adequate.map(a => a.codigo), ['A1', 'A3']);
  assert.deepEqual(searchRooms(rooms, { ...filter, date: '2026-11-23' }, available(rows)).adequate.map(a => a.codigo), ['A2', 'A3']);
  assert.equal(searchRooms(rooms, { ...filter, start: '10:00', end: '12:00' }, available(rows)).adequate.length, 3);
  const other = { ...available(rows), periodos: [period, { ...period, idPeriodo: '2' }], horarios: [dto(3, { idPeriodo: '2' })] };
  assert.equal(searchRooms([rooms[0]], filter, other).adequate.length, 0);
});
test('al día siguiente desaparece solo la reserva y se conserva el auxiliar semanal', () => {
  const rows = [dto(1, { esAuxiliar: true, responsable: 'Julia Auxiliar' }), dto(2, { fecha: '2026-11-16' }), dto(3, { fecha: '2026-11-16', aula: 'A2', idHorarioBase: 1 })];
  assert.deepEqual(semesterSessions(rows, 'A1', period, '2026-11-16').map(h => h.idHorario), [1, 2]);
  assert.deepEqual(semesterSessions(rows, 'A1', period, '2026-11-17').map(h => h.idHorario), [1]);
  assert.deepEqual(semesterSessions(rows, 'A2', period, '2026-11-17'), []);
});

const db = require('../src/database/prisma');
const mail = require('../src/utils/mail');
let rows, sent, failMail, nextId;
const p = { id_periodo: 1n, estado: 'ACTIVO', gestion: 2026, periodo: 'II', fecha_inicio: new Date('2026-07-01'), fecha_fin: new Date('2026-12-31') };
const assignments = [1,2,3].map(n => ({ id_paralelo: BigInt(n), id_docente: BigInt(n), id_periodo: 1n, codigo_materia: 'INF-'+n, nombre_paralelo: 'A', estado: 'ACTIVO', materia: { nombre: 'Materia '+n, estado: 'ACTIVO', siglas: [{ sigla: 'INF-'+n }] }, docente: { nombre_completo: 'Docente '+n, estado: 'ACTIVO' }, periodo_academico: p }));
const aux = { id_auxiliar: 7n, nombre_completo: 'Julia Auxiliar', correo: 'julia@example.test', estado: 'ACTIVO' };
const at = h => new Date(`1970-01-01T${h}:00Z`);
let blocks;
const make = (id, extra = {}) => ({ id_horario: BigInt(id), id_paralelo: 1n, id_bloque: 1, codigo_ambiente: 'A1', dia_semana: 'LUNES', fecha: null, estado: 'ASIGNADO', publicado: true, es_auxiliar: true, id_auxiliar: 7n, sesion_compartida: null, id_horario_base: null, id_reserva_origen: null, ...extra });
function hydrate(r, deep = true) {
  if (!r) return null;
  return { ...r, paralelo: assignments.find(a => a.id_paralelo === r.id_paralelo), bloque_horario: blocks.find(b => b.id_bloque === r.id_bloque), ambiente: { lugar: 'INFORMATICA', piso: 1 }, auxiliar: r.id_auxiliar ? aux : null,
    horario_base: rows.find(h => h.id_horario === r.id_horario_base) ?? null,
    reserva_origen: r.id_reserva_origen ? { paralelo: assignments.find(a => a.id_paralelo === rows.find(h => h.id_horario === r.id_reserva_origen)?.id_paralelo) } : null,
    traslados: rows.filter(h => h.id_horario_base === r.id_horario),
    reubicaciones: deep ? rows.filter(h => h.id_reserva_origen === r.id_horario).map(h => hydrate(h, false)) : [],
  };
}
function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some(v => matches(row, v));
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('not' in value) return row[key] !== value.not;
      if ('notIn' in value) return !value.notIn.includes(row[key]);
      if ('lt' in value || 'gt' in value) return (!('lt' in value) || row[key] < value.lt) && (!('gt' in value) || row[key] > value.gt);
      return row[key] && matches(row[key], value);
    }
    return row[key] === value;
  });
}
const tx = {
  $executeRaw: async () => 0,
  paralelo: { findUnique: async ({ where }) => assignments.find(a => a.id_paralelo === where.id_paralelo) },
  ambiente: { findUnique: async ({ where }) => rooms.some(a => a.codigo === where.codigo_ambiente) ? { estado: 'DISPONIBLE' } : null },
  auxiliar_asignacion: { findUnique: async () => ({ auxiliar: aux }) },
  bloque_horario: { findFirst: async ({ where }) => blocks.find(b => +b.hora_inicio === +where.hora_inicio && +b.hora_fin === +where.hora_fin), aggregate: async () => ({ _max: { id_bloque: blocks.length } }), create: async ({ data }) => { blocks.push(data); return data; } },
  horario: {
    findUnique: async ({ where }) => hydrate(rows.find(r => r.id_horario === where.id_horario)),
    findMany: async ({ where }) => rows.map(r => hydrate(r)).filter(r => matches(r, where)),
    create: async ({ data }) => { const r = make(nextId++, data); rows.push(r); return hydrate(r); },
    update: async ({ where, data }) => { const r = rows.find(r => r.id_horario === where.id_horario); Object.assign(r, data); return hydrate(r); },
    deleteMany: async ({ where }) => { rows = rows.filter(r => !matches(r, where)); },
    delete: async ({ where }) => { rows = rows.filter(r => r.id_horario !== where.id_horario); },
  },
};
db.prisma = { ...tx, $transaction: async fn => { const original = structuredClone(rows); const originalBlocks = structuredClone(blocks); try { return await fn(tx); } catch (e) { rows = original; blocks = originalBlocks; throw e; } } };
mail.sendMail = async message => { if (failMail) throw new Error('Mail unavailable'); sent.push(message); };
const { HorarioRepository } = require('../src/modules/horarios/horario.repository');
const repo = new HorarioRepository();
const reservation = { idAsignacion: '2', aula: 'A1', dia: 'LUNES', fecha: '2026-11-16', horaInicio: '08:00', horaFin: '09:00', motivo: 'Examen', reubicaciones: [{ idHorario: 1, aula: 'A2' }] };
beforeEach(() => { rows = [make(1)]; blocks = [{ id_bloque: 1, hora_inicio: at('08:00'), hora_fin: at('10:00') }]; sent = []; failMail = false; nextId = 10; });
test('reserva docente mantiene auxiliar semanal, crea traslado de sesión completa y avisa después de guardar', async () => {
  const original = structuredClone(rows[0]); const h = await repo.create(reservation);
  assert.deepEqual(rows[0], original); assert.equal(rows.length, 3);
  const moved = rows.find(r => r.id_horario_base === 1n);
  assert.equal(moved.codigo_ambiente, 'A2'); assert.equal(moved.id_bloque, 1); assert.equal(moved.id_reserva_origen, BigInt(h.idHorario));
  assert.deepEqual(h.reubicaciones, [{ idHorario: 1, aula: 'A2', responsable: 'Julia Auxiliar' }]);
  assert.equal(sent.length, 1); assert.match(sent[0].text, /A1.*Docente 2.*16\/11\/2026/); assert.match(sent[0].text, /A2, de 08:00 a 10:00/);
  const listed = await repo.findAll(true); assert.deepEqual(listed.find(r => r.idHorario === 1).traslados, [{ fecha: '2026-11-16', aula: 'A2' }]);
});
test('no convierte una clase semanal en temporal mediante edición', async () => {
  await assert.rejects(repo.update(1, reservation), e => e.statusCode === 409 && /semanal/.test(e.message)); assert.equal(rows.length, 1); assert.equal(rows[0].fecha, null);
});
test('el titular puede reservar varias aulas temporales conservando el traslado de su auxiliar', async () => {
  const h = await repo.create({ ...reservation, idAsignacion: '1' });
  assert.equal(rows.length, 3); assert.equal(h.idAsignacion, '1');
  await repo.create({ ...reservation, idAsignacion: '1', aula: 'A3', reubicaciones: [] });
  assert.equal(rows.length, 4); assert.equal(rows[0].fecha, null);
  await assert.rejects(repo.create({ ...reservation, idAsignacion: '1', aula: 'A2', reubicaciones: [] }), { statusCode: 409 });
});
test('varias reservas de un docente en la misma fecha y hora se guardan como registros independientes', async () => {
  rows = [];
  const inputs = ['A1', 'A2'].map(aula => ({ ...reservation, aula, reubicaciones: [] }));
  const result = await repo.createMany(inputs);
  assert.equal(result.length, 2); assert.notEqual(result[0].idHorario, result[1].idHorario);
  assert.deepEqual(result.map(h => h.aula), ['A1', 'A2']);
  await repo.update(result[0].idHorario, { aula: 'A3' });
  assert.equal(rows.find(h => h.id_horario === BigInt(result[1].idHorario)).codigo_ambiente, 'A2');
  await assert.rejects(repo.update(result[0].idHorario, { aula: 'A2' }), { statusCode: 409 });
  await repo.delete(result[0].idHorario); assert.equal(rows.length, 1); assert.equal(rows[0].codigo_ambiente, 'A2');
});
test('la excepción de varias aulas no permite duplicar aula ni superponer clases semanales del docente', async () => {
  rows = [];
  await assert.rejects(repo.createMany([{ ...reservation, reubicaciones: [] }, { ...reservation, reubicaciones: [] }]), { statusCode: 409 });
  assert.equal(rows.length, 0);
  rows = [make(2, { id_paralelo: 2n, es_auxiliar: false, id_auxiliar: null, codigo_ambiente: 'A2' })];
  await assert.rejects(repo.create({ ...reservation, reubicaciones: [] }), { statusCode: 409 });
  rows[0].fecha = new Date(reservation.fecha);
  await assert.rejects(repo.create({ ...reservation, fecha: null, reubicaciones: [] }), { statusCode: 409 });
});
test('puede añadir un aula con traslado después de otra reserva temporal del mismo docente', async () => {
  await repo.create({ ...reservation, aula: 'A3', reubicaciones: [] });
  await repo.create(reservation);
  assert.equal(rows.length, 4); assert.equal(rows[0].codigo_ambiente, 'A1');
  assert.equal(rows.find(h => h.id_horario_base === 1n).codigo_ambiente, 'A2');
});
test('rechaza superposición sobre docente, auxiliar temporal, auxiliar pendiente y traslado omitido o falsificado', async () => {
  for (const base of [make(1, { es_auxiliar: false, id_auxiliar: null }), make(1, { fecha: new Date('2026-11-16') }), make(1, { id_auxiliar: null })]) {
    rows = [base]; await assert.rejects(repo.create({ ...reservation, reubicaciones: [] }), e => e.statusCode === 409); assert.equal(rows.length, 1);
  }
  rows = [make(1)];
  await assert.rejects(repo.create({ ...reservation, reubicaciones: [] }), { statusCode: 409 });
  await assert.rejects(repo.create({ ...reservation, reubicaciones: [{ idHorario: 99, aula: 'A2' }] }), { statusCode: 400 });
  await assert.rejects(repo.create({ ...reservation, reubicaciones: [{ idHorario: 1, aula: 'A1' }] }), { statusCode: 409 });
  assert.equal(sent.length, 0);
});
test('un conflicto en destino o en el segundo día revierte toda la reserva sin avisos', async () => {
  rows.push(make(2, { id_paralelo: 3n, id_auxiliar: null, es_auxiliar: false, codigo_ambiente: 'A2' }));
  await assert.rejects(repo.create(reservation), { statusCode: 409 }); assert.equal(rows.length, 2); assert.equal(sent.length, 0);
  rows = [make(1)];
  await assert.rejects(repo.createMany([reservation, { ...reservation, reubicaciones: [], motivo: 'Duplicada' }]), { statusCode: 409 });
  assert.equal(rows.length, 1); assert.equal(sent.length, 0);
});
test('edita reserva reubicando al auxiliar y cancelarla devuelve su aula; no edita traslado aislado', async () => {
  const h = await repo.create(reservation); const moved = rows.find(r => r.id_horario_base);
  await assert.rejects(repo.update(Number(moved.id_horario), { aula: 'A3' }), { statusCode: 409 });
  await assert.rejects(repo.delete(Number(moved.id_horario)), { statusCode: 409 });
  await assert.rejects(repo.delete(1), { statusCode: 409 });
  await repo.update(h.idHorario, { reubicaciones: [{ idHorario: 1, aula: 'A3' }] });
  assert.equal(rows.find(r => r.id_horario_base).codigo_ambiente, 'A3'); assert.equal(rows[0].fecha, null);
  await repo.delete(h.idHorario); assert.equal(rows.length, 1); assert.equal(rows[0].codigo_ambiente, 'A1'); assert.match(sent.at(-1).text, /canceló o modificó/);
});
test('el retorno se bloquea si otra reserva posterior ocupa la sesión semanal', async () => {
  const h = await repo.create(reservation);
  const second = await repo.create({ ...reservation, idAsignacion: '3', horaInicio: '09:00', horaFin: '10:00', reubicaciones: [] });
  await assert.rejects(repo.delete(h.idHorario), e => e.statusCode === 409 && /devolver/.test(e.message));
  assert.equal(rows.length, 4);
  await repo.delete(second.idHorario); await repo.delete(h.idHorario); assert.equal(rows.length, 1);
});
test('fallo del correo informa al admin y mantiene reserva y aviso persistente', async () => {
  failMail = true; const h = await repo.create(reservation);
  assert.equal(rows.length, 3); assert.equal(h.avisos.length, 1); assert.match(h.avisos[0], /No se pudo enviar/); assert.equal(h.reubicaciones.length, 1);
});
