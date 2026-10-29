const { test } = require('node:test');
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const filename = path.resolve(__dirname, '../src/utils/fichaIdentificador.ts');
const compiled = new Module(filename, module);
compiled.paths = module.paths;
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
const { sugerirIdentificador, identificadorDisponible } = compiled.exports;

test('sugiere iniciales del trámite ignorando conectores y acentos', () => {
  assert.equal(sugerirIdentificador('Historial o récord académico'), 'HRA');
  assert.equal(sugerirIdentificador('Adición o retiro de materias'), 'ARM');
  assert.equal(sugerirIdentificador('Choque de horarios'), 'CH');
  assert.equal(sugerirIdentificador('Títulos'), 'TIT');
});

test('conserva el identificador personalizado del trámite al proponerlo para jornadas', () => {
  assert.equal(identificadorDisponible('HISTORIAL'), 'HISTORIAL');
  assert.equal(identificadorDisponible('HISTORIAL', ['HISTORIAL', 'HISTORIAL2']), 'HISTORIAL3');
  const largo = 'A'.repeat(20);
  assert.equal(identificadorDisponible(largo, [largo]), `${'A'.repeat(19)}2`);
});

test('evita identificadores ocupados y produce sugerencias válidas', () => {
  assert.equal(sugerirIdentificador('Choque de horarios', ['CH', 'ch2', 'CH3']), 'CH4');
  assert.equal(sugerirIdentificador(''), '');
  for (const nombre of ['2026', '!!!', 'de la', '123 título', 'A', 'Ñandú', 'uno dos tres cuatro cinco seis']) {
    assert.match(sugerirIdentificador(nombre), /^[A-Z][A-Z0-9]{0,19}$/);
  }
});
