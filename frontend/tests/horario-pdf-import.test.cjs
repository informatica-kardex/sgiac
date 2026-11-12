const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const filename = path.resolve(__dirname, '../src/admin/schedule/pdf-import.ts');
const compiled = new Module(filename, module);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
const { parseSchedulePages, automaticSessions, normalizePdfRoom } = compiled.exports;
const item = (text, x, y, width = 20) => ({ text, x, y, width });
const header = [item('PARALELO', 45, 90, 45), item('DOCENTE', 176, 90), item('HORARIO', 407, 90), item('HORARIOS DE INSCRIPCION SEGUNDO 2026', 200, 60)];
const page = (...items) => ({ items: [...header, ...items] });
const subject = (name = 'INF-111 - PROGRAMACION I', y = 110) => item(name, 44, y);
const group = (letter, y, teacher = 'ANA PEREZ') => [item(letter, 64, y, 7), item(teacher, 92, y - 1.4)];
const hours = (text, y, x = 285) => item(text, x, y);

test('ignora texto duplicado fuera de la columna y conserva días, responsable y aula', () => {
  const result = parseSchedulePages([page(subject(), ...group('A', 125), hours('MARTES y JUEVES de 10:00:00 a 12:00:00 - P4-Lab1', 124),
    hours('LUNES y MIERCOLES de 10:00:00 a 12:00:00 - SS-A1', 139, 42), ...group('B', 140, 'OTRO DOCENTE'), hours('LUNES y MIERCOLES de 10:00:00 a 12:00:00 - SS-A1', 139))]);
  assert.equal(result.grupos.length, 2);
  assert.deepEqual(result.grupos[0].sesiones.map(s => s.dia), ['MARTES', 'JUEVES']);
  assert.equal(result.grupos[1].docente, 'OTRO DOCENTE');
  assert.equal(result.grupos[1].sesiones[0].aula, 'SS-A1');
  assert.deepEqual(automaticSessions(result.grupos[0]), [0, 1]);
  assert.deepEqual(result.periodo, { gestion: 2026, periodo: 'II' });
});
test('no elige arbitrariamente entre tres sesiones ni admite 119 minutos o cuatro horas', () => {
  const result = parseSchedulePages([page(subject(), ...group('A', 125), hours('LUNES y MIERCOLES de 10:00:00 a 12:00:00 - SS-A1', 124),
    hours('VIERNES de 10:00:00 a 12:00:00 - SS-A1', 134), hours('MARTES de 10:00:00 a 11:59:00 - SS-A1', 144), hours('JUEVES de 12:00:00 a 16:00:00 - SS-A1', 154))]);
  assert.deepEqual(automaticSessions(result.grupos[0]), []);
  assert.equal(result.grupos[0].sesiones.filter(s => s.excluida).length, 2);
});
test('excluye AUX explícito y deja dos sesiones titulares', () => {
  const result = parseSchedulePages([page(subject(), ...group('A', 125), hours('LUNES y MIERCOLES de 10:00:00 a 12:00:00 - SS-A1', 124), hours('AUX: VIERNES de 10:00:00 a 12:00:00 - SS-A1', 134))]);
  assert.deepEqual(automaticSessions(result.grupos[0]), [0, 1]);
  assert.match(result.grupos[0].sesiones[2].excluida, /Auxiliar/);
});
test('no asigna aulas múltiples por orden ni corrige silenciosamente códigos de laboratorios', () => {
  const result = parseSchedulePages([page(subject(), ...group('A', 125), hours('MARTES y JUEVES de 10:00:00 a 12:00:00 - LASIN 1 y LASIN 2', 124))]);
  assert.deepEqual(automaticSessions(result.grupos[0]), []);
  assert.deepEqual(result.grupos[0].sesiones[0].aulas, ['LASIN-1', 'LASIN-2']);
  assert.equal(normalizePdfRoom('P3-Lab3'), 'P3-LAB3');
});
test('conserva encabezados y aulas partidas entre páginas', () => {
  const result = parseSchedulePages([page(subject(), ...group('A', 125), hours('MARTES y JUEVES de 10:00:00 a 12:00:00 - AULA 04-02-09 (EDIF.', 124)),
    page(hours('ANTIGUO)', 100), subject('INF-112 - FUNDAMENTOS DIGITALES', 120), ...group('A', 135), hours('LUNES y MIERCOLES de 10:00:00 a 12:00:00 - PB-A1', 134)),
    page(...group('B', 110, 'OTRO DOCENTE'), hours('LUNES y MIERCOLES de 14:00:00 a 16:00:00 - PB-A1', 109))]);
  assert.equal(result.grupos[0].sesiones[0].aula, '04-02-09');
  assert.equal(result.grupos[0].errores.length, 0);
  assert.equal(result.grupos[2].materia, 'FUNDAMENTOS DIGITALES');
});
test('reúne equivalencias por nombre y mantiene distintas materias con INF-244', () => {
  const result = parseSchedulePages([page(subject('INF-244 - BASE DE DATOS II'), ...group('A', 125), hours('MARTES y JUEVES de 10:00:00 a 12:00:00 - SS-A1', 124),
    subject('INF-252 - BASE DE DATOS II', 150), ...group('A', 165), hours('MARTES y JUEVES de 10:00:00 a 12:00:00 - SS-A1', 164),
    subject('INF-244 - INTRODUCCION A LA ROBOTICA', 190), ...group('A', 205), hours('LUNES y MIERCOLES de 10:00:00 a 12:00:00 - SS-A1', 204))]);
  assert.equal(result.grupos.length, 2);
  assert.deepEqual(result.grupos[0].siglas, ['INF-244', 'INF-252']);
  assert.equal(result.grupos[0].sesiones.length, 2);
});
test('informa páginas incompatibles y evita arrastrar una materia a través de una página ilegible', () => {
  const result = parseSchedulePages([page(subject()), { items: [item('imagen', 1, 1)] }, page(...group('A', 110))]);
  assert.equal(result.grupos.length, 0);
  assert.equal(result.avisos.length, 2);
});
test('lee las nueve páginas reales de Horarios Helen sin depender del número de materias', async () => {
  const { getDocument, Util } = await import('../node_modules/pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: new Uint8Array(fs.readFileSync(path.resolve(__dirname, '../../referencias/Horarios Helen.pdf'))), useSystemFonts: true });
  try {
    const doc = await task.promise, pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const p = await doc.getPage(n), viewport = p.getViewport({ scale: 1 }), content = await p.getTextContent();
      pages.push({ items: content.items.filter(i => i.str?.trim()).map(i => { const t = Util.transform(viewport.transform, i.transform); return item(i.str, t[4], t[5], i.width); }) });
    }
    const result = parseSchedulePages(pages);
    assert.equal(doc.numPages, 9); assert.equal(result.grupos.length, 198); assert.deepEqual(result.avisos, []);
    const calculus = result.grupos.find(g => g.materia === 'CALCULO IV');
    assert.equal(calculus.errores.length, 0); assert.equal(calculus.sesiones[0].aula, '04-01-05');
    assert.equal(result.grupos.filter(g => g.errores.length).length, 16);
    for (const g of result.grupos) {
      const selected = automaticSessions(g);
      if (selected.length) { assert.equal(selected.length, 2); assert.notEqual(g.sesiones[selected[0]].dia, g.sesiones[selected[1]].dia); }
    }
    console.log(`PDF real: ${result.grupos.length} grupos; ${result.grupos.filter(g => automaticSessions(g).length).length} con selección automática antes de validar catálogo y cruces.`);
  } finally { await task.destroy(); }
});
