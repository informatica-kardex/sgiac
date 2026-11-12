// Isolated catalogue and transaction fixtures. Never connects to the real database.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const prismaPath = require.resolve('../dist/database/prisma');
let db, failWrite = false, locks = 0, queue = Promise.resolve();
const period = { id_periodo: 1n, gestion: 2026, periodo: 'II', estado: 'ACTIVO', fecha_inicio: new Date('2026-07-01'), fecha_fin: new Date('2026-12-31') };
const material = (codigo, nombre, siglas = [codigo]) => ({ codigo_materia: codigo, nombre, siglas: siglas.map(sigla => ({ sigla, codigo_materia: codigo })), estado: 'ACTIVO' });
const teacher = (id, nombre) => ({ id_docente: BigInt(id), nombre_completo: nombre, grado_academico: null, estado: 'ACTIVO' });
const assignment = (id, code = 'INF-111', idTeacher = 1n, grupo = 'A') => ({ id_paralelo: BigInt(id), codigo_materia: code, id_docente: idTeacher, nombre_paralelo: grupo, id_periodo: 1n, estado: 'ACTIVO' });
const block = { id_bloque: 1, hora_inicio: new Date('1970-01-01T10:00:00Z'), hora_fin: new Date('1970-01-01T12:00:00Z') };
const sessions = (room = 'SS-A1') => ['LUNES', 'MIERCOLES'].map(dia => ({ dia, aula: room, horaInicio: '10:00', horaFin: '12:00' }));
const group = (extra = {}) => ({ key: 'g1', pagina: 1, materia: 'Programación I', siglas: ['INF-111'], docente: 'ANA PEREZ', paralelo: 'A', sesiones: sessions(), ...extra });
const input = (...grupos) => ({ idPeriodo: '1', grupos: grupos.length ? grupos : [group()] });
function row(dia = 'LUNES', extra = {}) {
  const a = db.asignaciones[0];
  return { id_horario: 1n, id_paralelo: a.id_paralelo, codigo_ambiente: 'SS-A1', dia_semana: dia, fecha: null,
    estado: 'ASIGNADO', es_auxiliar: false, id_auxiliar: null, bloque_horario: block, paralelo: { ...a, periodo_academico: period }, ...extra };
}
function hydrate(h) { return { ...h, bloque_horario: db.bloques.find(b => b.id_bloque === h.id_bloque) ?? h.bloque_horario,
  paralelo: h.paralelo ?? { ...db.asignaciones.find(a => a.id_paralelo === h.id_paralelo), periodo_academico: db.periodo } }; }
const tx = {
  $executeRaw: async strings => { assert.match(strings.join(''), /pg_advisory_xact_lock\(20260930, 1\)/); locks++; },
  periodo_academico: { findUnique: async () => db.periodo },
  materia: { findMany: async () => db.materias, create: async ({ data }) => { const m = material(data.codigo_materia, data.nombre, []); db.materias.push(m); return m; } },
  materia_sigla: { createMany: async ({ data }) => { data.forEach(s => db.materias.find(m => m.codigo_materia === s.codigo_materia).siglas.push(s)); } },
  docente: { findMany: async () => db.docentes, create: async ({ data }) => { const d = { ...teacher(db.docentes.length + 1, data.nombre_completo), ...data }; db.docentes.push(d); return d; } },
  ambiente: { findMany: async () => db.aulas },
  paralelo: { findMany: async () => db.asignaciones, create: async ({ data }) => { const a = { ...data, id_paralelo: BigInt(db.asignaciones.length + 1), estado: 'ACTIVO' }; db.asignaciones.push(a); return a; } },
  bloque_horario: { findMany: async () => [...db.bloques], create: async ({ data }) => { db.bloques.push(data); return data; } },
  horario: { findMany: async () => db.horarios.map(hydrate), createMany: async ({ data }) => {
    if (failWrite) throw Error('Fallo simulado al escribir');
    db.horarios.push(...data.map((h, i) => ({ ...h, id_horario: BigInt(db.horarios.length + i + 1) })));
  } },
};
const prisma = { $transaction: fn => {
  const run = queue.then(async () => { const before = structuredClone(db); try { return await fn(tx); } catch (e) { db = before; throw e; } });
  queue = run.catch(() => {}); return run;
} };
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: { prisma } };
const { importScheduleSchema, planScheduleImport, horarioImport } = require('../dist/modules/horarios/horario.import');
beforeEach(() => {
  db = { periodo: structuredClone(period), materias: [material('INF-111', 'PROGRAMACION I')], docentes: [teacher(1, 'Ana Pérez')],
    aulas: ['SS-A1', 'SS-A2'].map(codigo_ambiente => ({ codigo_ambiente, estado: 'DISPONIBLE' })), asignaciones: [assignment(1)], horarios: [], bloques: [block] };
  failWrite = false; locks = 0;
});
const plan = (body = input()) => planScheduleImport(importScheduleSchema.parse(body), db);
test('valida dos horas, dos días distintos, límites, auxiliares y campos inesperados en el servidor', () => {
  for (const sesiones of [sessions().slice(0, 1), [...sessions(), sessions()[0]], sessions().map(s => ({ ...s, dia: 'LUNES' })),
    sessions().map(s => ({ ...s, horaFin: '11:59' })), sessions().map(s => ({ ...s, horaInicio: '06:00', horaFin: '08:00' })),
    sessions().map(s => ({ ...s, idAuxiliar: '1' }))]) assert.throws(() => importScheduleSchema.parse(input(group({ sesiones }))));
  assert.throws(() => importScheduleSchema.parse(input(group({ docente: 'Sin Docente' }))));
  assert.throws(() => importScheduleSchema.parse(input(group(), group())));
});
test('usa nombres sin tildes y reconoce los planes, sin fusionar las dos identidades INF-244', () => {
  db.materias.push(material('BD2', 'BASE DE DATOS II', ['INF-244']), material('ROBOTICA', 'INTRODUCCION A LA ROBOTICA', ['INF-244']));
  const p = plan(input(group({ materia: 'Introducción a la robótica', siglas: ['INF-244'] })));
  assert.equal(p.grupos[0].codigoMateria, 'ROBOTICA'); assert.equal(p.grupos[0].idDocente, '1');
  assert.ok(p.grupos[0].planes.length); assert.equal(p.resumen.sesiones, 2);
});
test('señala docentes homónimos, catálogos inactivos y asignaciones con otro docente', () => {
  db.docentes.push(teacher(2, 'ANA PEREZ')); assert.equal(plan().grupos[0].estado, 'REVISAR');
  db.docentes.pop(); db.docentes[0].estado = 'INACTIVO'; assert.equal(plan().resumen.sesiones, 0);
  db.docentes[0].estado = 'ACTIVO'; db.asignaciones[0].id_docente = 3n; assert.equal(plan().resumen.sesiones, 0);
});
test('detecta aula y docente ocupados, incluso en reservas de otros periodos con fechas comunes', () => {
  db.horarios.push(row('LUNES', { id_paralelo: 2n, paralelo: { ...assignment(2, 'INF-112', 2n), periodo_academico: { ...period, id_periodo: 2n } }, fecha: new Date('2026-08-03') }));
  assert.match(plan().grupos[0].errores.join(' '), /Cruce/);
  db.horarios[0].codigo_ambiente = 'SS-A2'; db.horarios[0].paralelo.id_docente = 1n;
  assert.equal(plan().resumen.sesiones, 0);
  db.horarios[0].fecha = new Date('2027-08-02'); db.horarios[0].paralelo.periodo_academico = { ...period, fecha_inicio: new Date('2027-07-01'), fecha_fin: new Date('2027-12-31') };
  assert.equal(plan().resumen.sesiones, 2);
});
test('un auxiliar no ocupa al docente, pero sí ocupa el aula', () => {
  db.horarios.push(row('LUNES', { id_paralelo: 2n, codigo_ambiente: 'SS-A2', es_auxiliar: true }));
  assert.equal(plan().resumen.sesiones, 2);
  db.horarios[0].codigo_ambiente = 'SS-A1'; assert.equal(plan().resumen.sesiones, 0);
});
test('marca ambos grupos que se cruzan en el PDF; paralelos en horas distintas sí se admiten', () => {
  const other = group({ key: 'g2', paralelo: 'B' });
  assert.ok(plan(input(group(), other)).grupos.every(g => g.estado === 'REVISAR'));
  other.sesiones = sessions().map(s => ({ ...s, horaInicio: '12:00', horaFin: '14:00' }));
  assert.equal(plan(input(group(), other)).resumen.sesiones, 4);
});
test('no añade un tercer día a un paralelo y no altera auxiliares existentes', () => {
  db.horarios.push(row('VIERNES')); assert.equal(plan().resumen.sesiones, 0);
  db.horarios[0].es_auxiliar = true; assert.equal(plan().resumen.sesiones, 2);
});
test('completa una sesión faltante y reconoce una carga repetida', async () => {
  db.horarios.push(row());
  const body = input(), preview = await horarioImport.preview(body);
  assert.equal(preview.resumen.sesiones, 1);
  await horarioImport.apply({ datos: body, huella: preview.huella });
  const repeated = await horarioImport.preview(body);
  assert.equal(repeated.resumen.sesiones, 0); assert.equal(repeated.resumen.existentes, 1);
  assert.equal(db.horarios.length, 2); assert.equal(locks, 1);
});
test('crea nuevas materias, docentes y asignaciones conservando otros datos y sin duplicar aliases', async () => {
  const before = structuredClone(db);
  const body = input(group({ materia: 'Nueva materia', siglas: ['NEW-100'], docente: 'Lic. Nuevo Docente' }),
    group({ key: 'g2', materia: 'NUEVA MATERIA', siglas: ['NEW-101'], docente: 'Nuevo Docente', paralelo: 'B', sesiones: sessions().map(s => ({ ...s, horaInicio: '14:00', horaFin: '16:00' })) }));
  const preview = await horarioImport.preview(body);
  assert.equal(preview.resumen.materias, 1); assert.equal(preview.resumen.docentes, 1); assert.deepEqual(db, before, 'Vista previa sin escrituras');
  await horarioImport.apply({ datos: body, huella: preview.huella });
  assert.equal(db.materias.length, 2); assert.equal(db.docentes.length, 2); assert.equal(db.horarios.length, 4);
  assert.deepEqual(db.materias[1].siglas.map(s => s.sigla), ['NEW-100', 'NEW-101']);
  assert.deepEqual(db.materias[0], before.materias[0]); assert.deepEqual(db.docentes[0], before.docentes[0]);
  assert.ok(db.horarios.every(h => !h.es_auxiliar && !h.id_auxiliar && !h.fecha));
});
test('un fallo revierte conjuntamente nuevos catálogos y sesiones', async () => {
  const body = input(group({ materia: 'Nueva materia', siglas: ['NEW-100'], docente: 'Nuevo Docente' }));
  const preview = await horarioImport.preview(body), before = structuredClone(db); failWrite = true;
  await assert.rejects(horarioImport.apply({ datos: body, huella: preview.huella }), /Fallo simulado/);
  assert.deepEqual(db, before);
});
test('vuelve a validar al guardar: cambios de catálogo o cargas concurrentes invalidan la revisión', async () => {
  const body = input(), preview = await horarioImport.preview(body);
  db.aulas[0].estado = 'MANTENIMIENTO';
  await assert.rejects(horarioImport.apply({ datos: body, huella: preview.huella }), e => e.statusCode === 409);
  assert.equal(db.horarios.length, 0);
  db.aulas[0].estado = 'DISPONIBLE';
  const results = await Promise.allSettled([horarioImport.apply({ datos: body, huella: preview.huella }), horarioImport.apply({ datos: body, huella: preview.huella })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(db.horarios.length, 2);
});
test('preserva lo existente y solo guarda los grupos que la vista previa presenta como listos', async () => {
  const body = input(group(), group({ key: 'g2', docente: 'OTRO DOCENTE', paralelo: 'B', sesiones: sessions('NO-EXISTE') }));
  const preview = await horarioImport.preview(body);
  assert.equal(preview.resumen.pendientes, 1); assert.equal(preview.resumen.sesiones, 2);
  await horarioImport.apply({ datos: body, huella: preview.huella });
  assert.equal(db.horarios.length, 2); assert.equal(db.docentes.length, 1);
});
