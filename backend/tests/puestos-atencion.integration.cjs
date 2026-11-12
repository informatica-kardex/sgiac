// Desde backend: node -r ts-node/register/transpile-only tests/puestos-atencion.integration.cjs
// PostgreSQL local con la migración de puestos aplicada. Solo crea y elimina datos propios.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mock } = require('node:test');
const { env } = require('../src/config/env');
assert.notEqual(env.nodeEnv, 'production', 'Esta prueba requiere una base local de desarrollo');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.databaseUrl).hostname), 'Esta prueba solo admite PostgreSQL local');
const { prisma } = require('../src/database/prisma');
const { FichaService } = require('../src/modules/fichas/ficha.service');
const { EstudianteService } = require('../src/modules/estudiantes/estudiante.service');
const admin = new FichaService(), student = new EstudianteService();
const runId = randomUUID().replaceAll('-', '');
const prefix = `__PUESTOS_${runId}`;
const fecha = '2099-12-01';
const userIds = [], studentIds = [], tramiteIds = [], jornadaIds = [], puestoIds = [];
const checks = [];
mock.timers.enable({ apis: ['Date'], now: new Date(`${fecha}T14:00:00Z`) });

async function crearJornada(input, actor) {
  const j = await admin.guardarJornada(input, actor);
  jornadaIds.push(BigInt(j.idJornada));
  return j;
}

(async () => {
  for (let i = 0; i < 5; i++) {
    const u = await prisma.usuario.create({ data: { nombreCompleto: `${prefix} Persona ${i}`, correo: `${runId}.${i}@example.test`, correoVerificado: true } });
    userIds.push(u.idUsuario);
    if (i) {
      const s = await prisma.estudiante.create({ data: { nombres: `Prueba ${i}`, apellidos: prefix, ci: `PT${runId.slice(0, 20)}${i}`, ru: `PR${runId.slice(0, 20)}${i}`, correo_institucional: u.correo, id_usuario: u.idUsuario } });
      studentIds.push(s.id_estudiante);
    }
  }
  const [actor, ...students] = userIds.map(String);
  const puestos = [];
  for (let i = 1; i <= 3; i++) {
    const p = await admin.guardarPuesto(`${prefix} Puesto ${i}`);
    puestoIds.push(BigInt(p.idPuesto)); puestos.push(p);
  }
  const tramites = [];
  for (let i = 0; i < 2; i++) {
    const t = await admin.guardarTramite({ nombre: `${prefix} Trámite ${i}`, descripcion: 'Prueba sintética de atención simultánea', identificador: `P${runId.slice(0, 12).toUpperCase()}${i}` });
    tramiteIds.push(BigInt(t.idTramite)); tramites.push(t);
  }
  const input = {
    idTramite: tramites[0].idTramite, identificador: tramites[0].identificador,
    fecha, horaInicio: '08:00', horaFin: '16:00', modoCupo: 'MANUAL', cupoTotal: 4,
    minutosPorEstudiante: 10, idPuestos: puestos.slice(0, 2).map(p => p.idPuesto), estado: 'ACTIVO',
  };
  const first = await crearJornada(input, actor);
  const second = await crearJornada({ ...input, idTramite: tramites[1].idTramite, identificador: tramites[1].identificador, modoCupo: 'TIEMPO' }, actor);
  assert.equal(second.cupoTotal, 96, 'Dos puestos aportan 48 cupos cada uno');
  assert.deepEqual(first.idPuestos, input.idPuestos);
  checks.push('selección persistida y cupo de dos puestos');

  // Reservas independientes usan sus propias conexiones/transacciones y el mismo bloqueo SQL.
  const reservations = await Promise.all(students.map(id => student.solicitar(id, { idJornada: first.idJornada, detalle: 'Cola concurrente' })));
  const ordered = reservations.sort((a, b) => a.numero - b.numero);
  assert.deepEqual(ordered.map(f => f.numero), [1, 2, 3, 4]);
  assert.equal(new Set(ordered.map(f => f.idFicha)).size, 4);
  checks.push('reservas concurrentes sin repetir números');

  const calls = await Promise.all([
    admin.siguiente(first.idJornada, actor, puestos[0].idPuesto),
    admin.siguiente(first.idJornada, actor, puestos[1].idPuesto),
  ]);
  assert.deepEqual(calls.map(f => f.numero).sort(), [1, 2], 'Cada puesto recibe una ficha distinta respetando el orden');
  assert.equal(new Set(calls.map(f => f.idFicha)).size, 2);
  assert.equal(new Set(calls.map(f => f.idPuesto)).size, 2);
  const repeated = await Promise.all(Array.from({ length: 5 }, () => admin.siguiente(first.idJornada, actor, puestos[0].idPuesto)));
  const firstPuestoCall = calls.find(f => f.idPuesto === puestos[0].idPuesto);
  assert.ok(repeated.every(f => f.idFicha === firstPuestoCall.idFicha));
  assert.equal(await prisma.historial_ficha.count({ where: { id_jornada: BigInt(first.idJornada), estado: 'LLAMADA' } }), 2);
  await assert.rejects(admin.siguiente(first.idJornada, actor, puestos[2].idPuesto), { statusCode: 400 });
  checks.push('llamados SQL concurrentes, repetición idempotente y restricción por puesto');

  const board = await admin.tablero();
  const shown = board.jornadas.find(j => j.idJornada === first.idJornada);
  assert.equal(shown.actuales.length, 2);
  assert.deepEqual(shown.actuales.map(f => f.codigo).sort(), calls.map(f => f.codigo).sort());
  assert.deepEqual(shown.siguientes, ordered.slice(2).map(f => f.codigo));
  const thirdStudent = reservations.find(f => f.numero === 3);
  const thirdOwner = await prisma.ficha_atencion.findUniqueOrThrow({ where: { id_ficha: BigInt(thirdStudent.idFicha) }, select: { estudiante: { select: { id_usuario: true } } } });
  const thirdUpdated = (await student.fichas(String(thirdOwner.estudiante.id_usuario))).find(f => f.idFicha === thirdStudent.idFicha);
  assert.equal(thirdUpdated.esperaMinutos, 10, 'Dos llamados previos ocupan una tanda de dos puestos');
  checks.push('tablero con dos destinos y estimación paralela');

  await student.solicitar(students[0], { idJornada: second.idJornada, detalle: 'Segundo trámite' });
  await assert.rejects(admin.siguiente(second.idJornada, actor, puestos[0].idPuesto), { statusCode: 409 });
  const sameDayCalled = await prisma.ficha_atencion.count({ where: { id_puesto: puestoIds[0], estado_actual: 'LLAMADA', jornada_atencion: { fecha: new Date(fecha) } } });
  assert.equal(sameDayCalled, 1);
  await admin.accion(firstPuestoCall.idFicha, 'FINALIZAR', actor);
  // Dos trámites compiten por el mismo puesto libre: solo uno obtiene la atención.
  const competing = await Promise.allSettled([
    admin.siguiente(first.idJornada, actor, puestos[0].idPuesto),
    admin.siguiente(second.idJornada, actor, puestos[0].idPuesto),
  ]);
  assert.equal(competing.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(competing.find(r => r.status === 'rejected').reason.statusCode, 409);
  assert.equal(await prisma.ficha_atencion.count({ where: { id_puesto: puestoIds[0], estado_actual: 'LLAMADA', jornada_atencion: { fecha: new Date(fecha) } } }), 1);
  checks.push('un puesto bloquea llamados simultáneos entre trámites');

  const announced = calls.find(f => f.idPuesto === puestos[1].idPuesto);
  const renamed = `${prefix} Oficina académica`;
  await admin.guardarPuesto(renamed, puestos[1].idPuesto);
  const recalled = await admin.accion(announced.idFicha, 'RELLAMAR', actor);
  assert.equal(recalled.puesto, puestos[1].nombre, 'El destino que ya fue anunciado no cambia');
  assert.equal(recalled.jornada.puestos.find(p => p.idPuesto === puestos[1].idPuesto).nombre, renamed);
  const saved = await prisma.ficha_atencion.findUniqueOrThrow({ where: { id_ficha: BigInt(announced.idFicha) } });
  assert.equal(saved.puesto_llamado, puestos[1].nombre);
  assert.equal((await admin.tablero()).ultimosLlamados.find(f => f.codigo === announced.codigo).puesto, puestos[1].nombre);
  await assert.rejects(admin.borrarPuesto(puestos[1].idPuesto), { statusCode: 409 });
  await assert.rejects(admin.guardarJornada({ ...input, idPuestos: [puestos[0].idPuesto] }, actor, first.idJornada), { statusCode: 409 });
  await admin.borrarPuesto(puestos[2].idPuesto);
  assert.equal((await prisma.puesto_atencion.findUniqueOrThrow({ where: { id_puesto: puestoIds[2] } })).activo, false);
  assert.equal((await admin.guardarPuesto(puestos[2].nombre)).idPuesto, puestos[2].idPuesto, 'Reactivar conserva el identificador');
  checks.push('renombrado conserva anuncios e historial; retiro protegido y reactivación');

  console.log(`PUESTOS_INTEGRACION_OK: ${checks.join('; ')}.`);
})().catch(error => {
  console.error('PUESTOS_INTEGRACION_FALLO:', error instanceof assert.AssertionError ? error.message : error.code || error.name || 'Error');
  process.exitCode = 1;
}).finally(async () => {
  try {
    // Todos los filtros contienen exclusivamente IDs registrados por esta ejecución.
    await prisma.$transaction(async tx => {
      await tx.historial_ficha.deleteMany({ where: { id_jornada: { in: jornadaIds } } });
      await tx.ficha_atencion.deleteMany({ where: { id_jornada: { in: jornadaIds } } });
      await tx.jornada_puesto.deleteMany({ where: { id_jornada: { in: jornadaIds } } });
      await tx.jornada_atencion.deleteMany({ where: { id_jornada: { in: jornadaIds } } });
      await tx.tramite_atencion.deleteMany({ where: { id_tramite: { in: tramiteIds } } });
      await tx.puesto_atencion.deleteMany({ where: { id_puesto: { in: puestoIds } } });
      await tx.estudiante.deleteMany({ where: { id_estudiante: { in: studentIds } } });
      await tx.usuario.deleteMany({ where: { idUsuario: { in: userIds } } });
    });
    console.log('PUESTOS_DATOS_SINTETICOS_ELIMINADOS');
  } catch (error) {
    console.error('PUESTOS_LIMPIEZA_FALLO:', error.code || error.name || 'Error'); process.exitCode = 1;
  } finally { mock.timers.reset(); await prisma.$disconnect(); }
});
