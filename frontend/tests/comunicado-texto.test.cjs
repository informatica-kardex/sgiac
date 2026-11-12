// node --test frontend/tests/comunicado-texto.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../src/utils/comunicadoTexto.ts'), 'utf8');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const parse = value => JSON.parse(JSON.stringify(context.exports.fragmentosFormato(value)));
const blocks = value => JSON.parse(JSON.stringify(context.exports.bloquesTexto(value)));
const editorContext = { exports: {}, require: () => context.exports };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/utils/comunicadoEditor.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, editorContext);
const { documentoEditor, textoEditor } = editorContext.exports;

test('conserva texto, acentos y negritas de comunicados anteriores', () => {
  assert.deepEqual(parse('Fecha: **mañana**.'), [
    { text: 'Fecha: ', bold: false, italics: false },
    { text: 'mañana', bold: true, italics: false },
    { text: '.', bold: false, italics: false },
  ]);
});

test('cursiva y negrita se pueden combinar y anidar', () => {
  assert.deepEqual(parse('***importante***'), [{ text: 'importante', bold: true, italics: true }]);
  assert.deepEqual(parse('**fecha *obligatoria* mañana**'), [
    { text: 'fecha ', bold: true, italics: false },
    { text: 'obligatoria', bold: true, italics: true },
    { text: ' mañana', bold: true, italics: false },
  ]);
  assert.deepEqual(parse('*fecha **obligatoria** mañana*'), [
    { text: 'fecha ', bold: false, italics: true },
    { text: 'obligatoria', bold: true, italics: true },
    { text: ' mañana', bold: false, italics: true },
  ]);
});

test('marcas incompletas y HTML permanecen como texto', () => {
  for (const value of ['**sin cerrar', '<script>alert(1)</script>', '*'.repeat(50000)]) {
    assert.deepEqual(parse(value), [{ text: value, bold: false, italics: false }]);
  }
});

test('distingue párrafos, viñetas y listas numeradas manteniendo su inicio', () => {
  assert.deepEqual(blocks('Introducción\r\nSegunda línea\r\n\r\n- Uno\n• **Dos**\n\n3. Tres\n4. *Cuatro*\n\nFinal'), [
    { tipo: 'parrafo', texto: 'Introducción\nSegunda línea' },
    { tipo: 'lista', ordenada: false, inicio: 1, items: ['Uno', '**Dos**'] },
    { tipo: 'lista', ordenada: true, inicio: 3, items: ['Tres', '*Cuatro*'] },
    { tipo: 'parrafo', texto: 'Final' },
  ]);
  assert.deepEqual(blocks('  \n '), []);
  assert.deepEqual(blocks('  - Uno\n  - Dos'), [
    { tipo: 'lista', ordenada: false, inicio: 1, items: ['Uno', 'Dos'] },
  ]);
});

test('guardar y reabrir conserva combinaciones contiguas de negrita y cursiva y caracteres literales', () => {
  const caracteres = documento => {
    const salida = [];
    const visitar = nodo => {
      if (nodo.type === 'text') for (const letra of nodo.text) salida.push([letra, (nodo.marks || []).map(m => m.type).sort().join(',')]);
      else if (nodo.type === 'hardBreak') salida.push(['\n', '']);
      else for (const hijo of nodo.content || []) visitar(hijo);
    };
    visitar(documento);
    return salida;
  };
  for (let combinacion = 0; combinacion < 256; combinacion++) {
    const content = Array.from({ length: 4 }, (_, index) => {
      const formato = (combinacion >> (index * 2)) & 3;
      return { type: 'text', text: ['Árbol', '*literal*_dato_\\', ' ', 'final'][index], marks: [
        ...(formato & 1 ? [{ type: 'bold' }] : []), ...(formato & 2 ? [{ type: 'italic' }] : []),
      ] };
    });
    const documento = { type: 'doc', content: [{ type: 'paragraph', content }] };
    assert.deepEqual(caracteres(documentoEditor(textoEditor(documento))), caracteres(documento), textoEditor(documento));
  }
});

test('listas, saltos internos y párrafos vacíos sobreviven al guardado', () => {
  const texto = 'Introducción\n\n\n\n- **Uno**\n  Segunda línea\n- _Dos_\n\n3. Tres\n4. Cuatro\n\nFinal\n\n';
  assert.deepEqual(JSON.parse(JSON.stringify(documentoEditor(textoEditor(documentoEditor(texto))))), JSON.parse(JSON.stringify(documentoEditor(texto))));
  assert.deepEqual(blocks(texto)[1], { tipo: 'parrafo', texto: '' });
  assert.equal(blocks(texto)[2].items[0], '**Uno**\nSegunda línea');
});

test('texto literal que parece una lista no se convierte al reabrir', () => {
  const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '3. No es lista\n- Tampoco\n<script>texto</script>' }] }] };
  const guardado = textoEditor(doc);
  assert.equal(blocks(guardado).length, 1);
  assert.equal(blocks(guardado)[0].tipo, 'parrafo');
  assert.equal(parse(blocks(guardado)[0].texto).map(f => f.text).join(''), doc.content[0].content[0].text);
});
