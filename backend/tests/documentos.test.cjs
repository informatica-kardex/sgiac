// Sin conexiones externas: reglas, validación, permisos y bot público/personal.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { disponibleDocumento, estimarRecojo, comprobarTransicion, codigoDocumento } = require('../src/modules/documentos/documento.rules');
const { documentoId, configuracionDocumentoSchema, solicitarDocumentoSchema, accionDocumentoSchema } = require('../src/modules/documentos/documento.validation');
const { tienePermiso } = require('../src/modules/roles/permissions');
const { TelegramFaqBot } = require('../src/modules/telegram/telegram.bot');
const tipo = { nombre: 'Récord académico', identificador: 'REC', descripcion: '', habilitado: true, desde: null, hasta: null, plazoHoras: 48, cupoDiario: 30, lugar: 'Kardex', requisitos: '', correoHabilitado: true, horaInicio: '08:00', horaFin: '16:00', diasAtencion: [1,2,3,4,5] };

test('periodo inclusivo al inicio, exclusivo al cierre y desactivación manual', () => {
  const t = { ...tipo, desde: new Date('2026-10-22T12:00:00Z'), hasta: new Date('2026-10-23T12:00:00Z') };
  assert.equal(disponibleDocumento(t, new Date('2026-10-22T11:59:59Z')), false);
  assert.equal(disponibleDocumento(t, t.desde), true);
  assert.equal(disponibleDocumento(t, t.hasta), false);
  assert.equal(disponibleDocumento({ ...t, habilitado: false }, t.desde), false);
});
test('48 horas que terminan en sábado pasan a lunes a las 08:00 de Bolivia', () => {
  assert.equal(estimarRecojo(tipo, new Date('2026-10-22T14:00:00Z')).toISOString(), '2026-10-26T12:00:00.000Z');
});
test('antes de apertura, al cierre y dentro de horario; recojo automático sin nuevo plazo de preparación', () => {
  const t = { ...tipo, plazoHoras: 0 };
  assert.equal(estimarRecojo(t, new Date('2026-10-22T10:00:00Z')).toISOString(), '2026-10-22T12:00:00.000Z');
  assert.equal(estimarRecojo(t, new Date('2026-10-22T20:00:00Z')).toISOString(), '2026-10-23T12:00:00.000Z');
  assert.equal(estimarRecojo(t, new Date('2026-10-22T15:15:00Z')).toISOString(), '2026-10-22T15:15:00.000Z');
});
test('no entrega antes de lista ni cancela una solicitud ya preparada', () => {
  assert.throws(() => comprobarTransicion('SOLICITADA', 'ENTREGAR'), { statusCode: 409 });
  assert.throws(() => comprobarTransicion('EN_PREPARACION', 'CANCELAR'), { statusCode: 409 });
  assert.throws(() => comprobarTransicion('ENTREGADA', 'LISTA'), { statusCode: 409 });
  comprobarTransicion('SOLICITADA', 'CANCELAR'); comprobarTransicion('LISTA', 'LISTA'); comprobarTransicion('LISTA', 'ENTREGAR');
});
test('IDs malformados se rechazan sin excepciones BigInt y códigos conservan IDs grandes', () => {
  for (const id of ['abc', '', '-1', '0', '1.5', '9223372036854775808']) assert.equal(documentoId.safeParse(id).success, false);
  assert.equal(documentoId.parse('9007199254740993'), '9007199254740993');
  assert.equal(codigoDocumento(9007199254740993n, new Date('2027-01-01T01:00:00Z')), 'DOC-2026-9007199254740993');
});
test('validación impide periodos parciales, horarios invertidos, días vacíos e identificadores inválidos', () => {
  for (const cambio of [{ desde: '2026-10-22T12:00:00Z' }, { horaFin: '07:00' }, { diasAtencion: [] }, { diasAtencion: [1,1] }, { identificador: '' }, { identificador: '123' }, { identificador: 'REC ABC' }, { identificador: 'R'.repeat(21) }, { demoraRecojoMinutos: 1441 }])
    assert.equal(configuracionDocumentoSchema.safeParse({ ...tipo, ...cambio }).success, false);
  assert.equal(configuracionDocumentoSchema.parse(tipo).demoraRecojoMinutos, 60);
});
test('configuración no exige hojas, normaliza identificador y lo utiliza en el código', () => {
  const config = configuracionDocumentoSchema.parse({ ...tipo, identificador: ' rec ', hojas: 5 });
  assert.equal(config.identificador, 'REC'); assert.equal('hojas' in config, false);
  assert.equal(codigoDocumento(123n, new Date('2026-10-23T12:00:00Z'), config.identificador), 'REC-2026-000123');
});
test('identidad, hojas y estado del solicitante no se aceptan desde el cliente', () => {
  const s = solicitarDocumentoSchema.parse({ idTipo: '1', motivo: 'Beca Comedor', idEstudiante: '55', estado: 'LISTA', hojas: 0 });
  assert.deepEqual(s, { idTipo: '1', motivo: 'Beca Comedor', detalle: '' });
});
test('marcar listo admite fecha automática, requiere hojas y rechazo exige motivo', () => {
  assert.equal(accionDocumentoSchema.safeParse({ accion: 'LISTA', version: 1, hojas: 2, lugar: 'Kardex', requisitos: '' }).success, true);
  assert.equal(accionDocumentoSchema.safeParse({ accion: 'LISTA', version: 1, lugar: 'Kardex' }).success, false);
  for (const hojas of [null, '', -1, 1.5, 101]) assert.equal(accionDocumentoSchema.safeParse({ accion: 'LISTA', version: 1, hojas, lugar: 'Kardex', requisitos: '' }).success, false);
  assert.equal(accionDocumentoSchema.safeParse({ accion: 'RECHAZAR', version: 1, observacion: '' }).success, false);
});
test('documentos requiere asignación específica y vigencia para subadministradores', () => {
  assert.equal(tienePermiso({ roles: ['ADMINISTRADOR'] }, 'documentos'), true);
  assert.equal(tienePermiso({ roles: ['SUBADMINISTRADOR'], permisos: [{ modulo: 'fichas', desde: null, hasta: null }] }, 'documentos'), false);
  assert.equal(tienePermiso({ roles: ['SUBADMINISTRADOR'], permisos: [{ modulo: 'documentos', desde: null, hasta: null }] }, 'documentos'), true);
  assert.equal(tienePermiso({ roles: ['CONSULTA_INTERNA'], permisos: [{ modulo: 'documentos', desde: null, hasta: null }] }, 'documentos'), false);
});
test('bot público sigue respondiendo sin vinculación y comandos personales no consultan FAQ', async () => {
  const messages = []; let faqCalls = 0, personalCalls = 0;
  const api = { call: async (method, payload) => { if (method === 'sendMessage') messages.push(payload.text); } };
  const bot = new TelegramFaqBot(api, async () => { faqCalls++; return []; }, async (_id, input) => { personalCalls++; return input === '/misdocumentos' ? { text: 'Vincula voluntariamente', buttons: [] } : null; });
  const update = (text, type = 'private') => ({ update_id: 1, message: { text, chat: { id: 100, type } } });
  await bot.handle(update('/start faq')); assert.equal(faqCalls, 1);
  await bot.handle(update('/misdocumentos')); assert.equal(faqCalls, 1); assert.equal(messages.at(-1), 'Vincula voluntariamente');
  await bot.handle(update('/start sgiac_secreto', 'group')); assert.equal(personalCalls, 2);
});
