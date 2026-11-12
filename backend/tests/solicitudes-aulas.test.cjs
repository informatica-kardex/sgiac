// Service contract tests with an isolated transactional store (no DB connection).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const dbPath = require.resolve('../dist/database/prisma');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { prisma: {} } };
const shared = require('../dist/modules/academico/academico.shared');
const { HorarioRepository } = require('../dist/modules/horarios/horario.repository');
const { solicitudAulaService: service } = require('../dist/modules/solicitudes-aulas/solicitud-aula.service');
const { Prisma } = require('@prisma/client');
const period = { id_periodo: 1n, gestion: 2099, periodo: 'II', estado: 'ACTIVO', fecha_inicio: new Date('2099-01-01'), fecha_fin: new Date('2099-12-31') };
const paralelo = { id_paralelo: 1n, id_periodo: 1n, id_docente: 1n, codigo_materia: 'INF-111', nombre_paralelo: 'A', estado: 'ACTIVO', periodo_academico: period, docente: { estado: 'ACTIVO', nombre_completo: 'Ana' }, materia: { nombre: 'Programación', estado: 'ACTIVO', siglas: [{ sigla: 'INF-111' }] } };
const auxiliar = { id_auxiliar: 2n, estado: 'ACTIVO', estudiante: { correo_institucional: 'aux@umsa.bo', usuario: { correo: 'aux@umsa.bo', estado: 'ACTIVO' } } };
const sesion = { dia: 'LUNES', fecha: '2099-02-02', horaInicio: '10:00', horaFin: '12:00' };
let state, failSecond, hasTransfers;
function reset(agenda) {
  failSecond = false;
  hasTransfers = false;
  state = { horarios: [], solicitud: { id: 1n, idSolicitante: 10n, idAuxiliar: 2n, idParalelo: 1n, version: 1, estado: 'PENDIENTE', numeroEstudiantes: 20, actividad: 'CLASE_TEORICA', reserva: { aula: 'A1', agenda }, propuesta: null, paralelo, historial: [], creadaEn: new Date(), actualizadaEn: new Date() } };
}
shared.academicTransaction = async callback => {
  const draft = structuredClone(state);
  const tx = {
    auxiliar: { findUnique: async () => auxiliar }, paralelo: { findUnique: async () => paralelo }, auxiliar_asignacion: { findUnique: async () => ({}) },
    ambiente: { findMany: async () => ['A1', 'A2'].map(codigo_ambiente => ({ codigo_ambiente, lugar: 'INFORMATICA', tipo: 'AULA', estado: 'DISPONIBLE', capacidad: 40 })) },
    horario: { findMany: async ({ where }) => where.traslados && hasTransfers ? [{ id_horario: 1n }] : [], update: async ({ where, data }) => Object.assign(draft.horarios.find(h => h.id_horario === where.id_horario), data), deleteMany: async () => { draft.horarios = []; } },
    solicitudAula: { findUnique: async () => draft.solicitud, update: async ({ data }) => {
      draft.solicitud = { ...draft.solicitud, ...data, version: draft.solicitud.version + data.version.increment, propuesta: data.propuesta === Prisma.DbNull ? null : data.propuesta ?? draft.solicitud.propuesta }; return draft.solicitud;
    } }, bitacora: { create: async () => ({}) },
    addSession(input) {
      if (failSecond && draft.horarios.length === 1) throw new Error('Conflicto en la segunda sesión');
      const id = BigInt(draft.horarios.length + 1); draft.horarios.push({ ...input, id_horario: id }); return { idHorario: Number(id) };
    },
  };
  const result = await callback(tx); state = draft; return result;
};
HorarioRepository.prototype.createInTransaction = async (tx, input) => tx.addSession(input);

for (const [alcance, sesiones] of [['DIA', [sesion]], ['DOS_DIAS', [sesion, { ...sesion, fecha: '2099-02-09' }]], ['SEMESTRE', [{ ...sesion, fecha: null }, { ...sesion, fecha: null, dia: 'MIERCOLES' }]]]) {
  test(`approval automatically saves every ${alcance} session once with its request and auxiliary`, async () => {
    reset({ alcance, sesiones });
    const result = await service.revisar('20', '1', { version: 1, accion: 'APROBAR' });
    assert.equal(result.estado, 'APROBADA');
    assert.deepEqual(state.horarios.map(h => ({ dia: h.dia, fecha: h.fecha, horaInicio: h.horaInicio, horaFin: h.horaFin })), sesiones);
    assert.ok(state.horarios.every(h => h.aula === 'A1' && h.id_solicitud_aula === 1n && h.idAuxiliar === '2' && h.idAsignacion === '1'));
    await assert.rejects(service.revisar('20', '1', { version: 2, accion: 'APROBAR' }), e => e.statusCode === 409);
    assert.equal(state.horarios.length, sesiones.length);
    await service.revisar('20', '1', { version: 2, accion: 'CANCELAR', comentario: 'Cancelar las sesiones de prueba.' });
    assert.equal(state.horarios.length, 0);
  });
}
test('an alternative reserves its new room only when accepted by its owner', async () => {
  reset({ alcance: 'DIA', sesiones: [sesion] });
  const propuesta = { ...state.solicitud.reserva, aula: 'A2' };
  await service.revisar('20', '1', { version: 1, accion: 'PROPONER', propuesta, comentario: 'Proponer otra aula disponible.' });
  assert.equal(state.horarios.length, 0);
  await assert.rejects(service.responder('30', '1', { version: 2, aceptar: true }), e => e.statusCode === 404);
  await service.responder('10', '1', { version: 2, aceptar: true });
  assert.equal(state.horarios[0].aula, 'A2'); assert.equal(state.solicitud.estado, 'APROBADA');
});
test('a second-session failure leaves neither partial schedules nor an approved request', async () => {
  reset({ alcance: 'DOS_DIAS', sesiones: [sesion, { ...sesion, fecha: '2099-02-09' }] }); failSecond = true;
  await assert.rejects(service.revisar('20', '1', { version: 1, accion: 'APROBAR' }), /segunda sesión/);
  assert.equal(state.horarios.length, 0); assert.equal(state.solicitud.estado, 'PENDIENTE');
});
test('cancelar una solicitud con traslados requiere retirar sus reservas docentes sin borrar la clase base', async () => {
  reset({ alcance: 'SEMESTRE', sesiones: [{ ...sesion, fecha: null }] });
  await service.revisar('20', '1', { version: 1, accion: 'APROBAR' }); hasTransfers = true;
  await assert.rejects(service.revisar('20', '1', { version: 2, accion: 'CANCELAR', comentario: 'Cancelar solicitud con traslado.' }), e => e.statusCode === 409 && /traslados/.test(e.message));
  assert.equal(state.horarios.length, 1); assert.equal(state.solicitud.estado, 'APROBADA');
});
