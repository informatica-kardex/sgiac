const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/user/schedule/planner.ts');
const compiled = new Module(filename, module);
compiled.paths = module.paths;
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
const { emptyPlanner, newVersion, readPlanner, savePlanner, storageKey, groupCourses, findConflicts, hoursPerWeek } = compiled.exports;
const lesson = (changes = {}) => ({ idHorario: 1, materia: 'Programación I', docente: 'Docente', aula: 'A-1', grupo: 'A', dia: 'LUNES', horaInicio: '08:00', horaFin: '09:30', ...changes });

test('restaura varias versiones y aísla los datos por cuenta', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const data = emptyPlanner();
  data.versions[0].lessons = [lesson()];
  const copy = newVersion('Otra opción', data.versions[0].lessons);
  data.versions.push(copy); data.activeId = copy.id;
  savePlanner(storage, 'student-a', data);
  assert.deepEqual(readPlanner(storage, 'student-a'), data);
  assert.equal(readPlanner(storage, 'student-b').versions[0].lessons.length, 0);
  copy.lessons[0].aula = 'Otra';
  assert.equal(data.versions[0].lessons[0].aula, 'A-1');
  assert.equal(readPlanner(storage, 'student-a').versions[1].lessons[0].aula, 'A-1');
});
test('agrupa todas las sesiones de una materia y distingue los grupos', () => {
  const courses = groupCourses([lesson(), lesson({ idHorario: 2, dia: 'MIERCOLES' }), lesson({ idHorario: 3, grupo: 'B' })]);
  assert.equal(courses.length, 2);
  assert.equal(courses[0].slots.length, 2);
  assert.equal(hoursPerWeek(courses[0].slots), 3);
});
test('detecta solapamientos parciales y contenidos, sin confundir días ni clases consecutivas', () => {
  const a = lesson();
  assert.equal(findConflicts([a, lesson({ idHorario: 2, horaInicio: '09:00', horaFin: '10:00' })]).length, 1);
  assert.equal(findConflicts([a, lesson({ idHorario: 2, horaInicio: '08:15', horaFin: '09:00' })]).length, 1);
  assert.equal(findConflicts([a, lesson({ idHorario: 2, horaInicio: '09:30', horaFin: '10:00' })]).length, 0);
  assert.equal(findConflicts([a, lesson({ idHorario: 2, dia: 'MARTES' })]).length, 0);
});
test('datos dañados o incompatibles no se reemplazan silenciosamente', () => {
  for (const raw of ['{', '{"schema":2}', JSON.stringify({ ...emptyPlanner(), activeId: 'missing' })]) {
    const storage = { getItem: () => raw, setItem: () => assert.fail('No debe sobrescribir') };
    assert.throws(() => readPlanner(storage, 'student-a'));
  }
  assert.notEqual(storageKey('a'), storageKey('b'));
});
test('errores de cuota o privacidad se propagan para mostrar el fallo de guardado', () => {
  assert.throws(() => savePlanner({ setItem() { throw new Error('QuotaExceededError'); } }, 'a', emptyPlanner()), /QuotaExceeded/);
  assert.throws(() => readPlanner({ getItem() { throw new Error('SecurityError'); } }, 'a'), /SecurityError/);
});

test('conserva materias pendientes, copia la lista y recupera materias de versiones antiguas', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const data = emptyPlanner();
  data.versions[0].subjects = ['Programación I', 'Álgebra'];
  data.versions[0].lessons = [lesson()];
  savePlanner(storage, 'student', data);
  assert.deepEqual(readPlanner(storage, 'student').versions[0].subjects, ['Programación I', 'Álgebra']);
  const copy = newVersion('Copia', data.versions[0].lessons, data.versions[0].subjects);
  copy.subjects.push('Física');
  assert.equal(data.versions[0].subjects.length, 2);
  delete data.versions[0].subjects;
  storage.setItem(storageKey('student'), JSON.stringify(data));
  assert.deepEqual(readPlanner(storage, 'student').versions[0].subjects, ['Programación I']);
});

test('marca una versión por periodo y restaura la preferencia sin cambiar de cuenta', () => {
  const { chooseSemesterSchedule } = compiled.exports;
  const data = emptyPlanner();
  const v = data.versions[0];
  v.lessons = [lesson()];
  v.context = { mention: 'SOFTWARE', semester: '1', period: { id: '7', nombre: 'II/2026', desde: '2026-07-01', hasta: '2026-12-31' } };
  const chosen = chooseSemesterSchedule(data, v.id);
  assert.equal(chosen.preferredId, v.id);
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  savePlanner(storage, 'a', chosen);
  assert.equal(readPlanner(storage, 'a').preferredId, v.id);
  assert.deepEqual(readPlanner(storage, 'a').versions[0].context, v.context);
  assert.equal(readPlanner(storage, 'b').preferredId, undefined);
});
test('no elige como horario una versión vacía, sin periodo o con cruces', () => {
  const { chooseSemesterSchedule } = compiled.exports;
  const data = emptyPlanner(), v = data.versions[0];
  assert.throws(() => chooseSemesterSchedule(data, v.id), /al menos una clase/);
  v.lessons = [lesson()];
  assert.throws(() => chooseSemesterSchedule(data, v.id), /periodo/);
  v.context = { mention: 'SOFTWARE', semester: '1', period: { id: '1', nombre: 'II/2026', desde: '2026-07-01', hasta: '2026-12-31' } };
  v.lessons.push(lesson({ idHorario: 2, materia: 'Álgebra' }));
  assert.throws(() => chooseSemesterSchedule(data, v.id), /cruces/);
});
