const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/admin/schedule/room-assignment.ts');
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
const { readRoomAssignment, roomAssignmentUrl } = compiled.exports;

test('conserva dos aulas, minutos, fecha y periodo al abrir la asignación desde otra página', () => {
  const request = { aulas: ['P1-A1', 'P2-A'], periodo: '8', dia: 'LUNES', inicio: '09:30', fin: '11:15', fecha: '2026-10-12' };
  assert.deepEqual(readRoomAssignment(new URL(roomAssignmentUrl(request), 'http://localhost').searchParams), request);
});
test('admite enlaces anteriores y descarta intervalos, fechas y días inválidos', () => {
  assert.deepEqual(readRoomAssignment(new URLSearchParams('aula=A&aula=A&periodo=8')), { aulas: ['A'], periodo: '8' });
  for (const query of ['dia=DOMINGO&inicio=09:00&fin=10:00', 'dia=LUNES&inicio=09:00&fin=08:00', 'dia=LUNES&inicio=06:30&fin=10:00', 'dia=LUNES&inicio=09:99&fin=22:00']) {
    assert.deepEqual(readRoomAssignment(new URLSearchParams('aula=A&periodo=8&' + query)), { aulas: ['A'], periodo: '8' });
  }
  for (const fecha of ['2026-02-30', '2026-10-13', 'invalid']) {
    const request = readRoomAssignment(new URLSearchParams('aula=A&periodo=8&dia=LUNES&inicio=09:30&fin=10:00&fecha=' + fecha));
    assert.equal(request.fecha, undefined);
    assert.equal(request.inicio, '09:30');
  }
});
