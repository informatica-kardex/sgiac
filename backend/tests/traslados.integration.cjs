// node -r ts-node/register/transpile-only tests/traslados.integration.cjs
// Todas las escrituras ocurren dentro de una transacción que SIEMPRE se revierte.
// No envía correos, no cambia asignaciones existentes y no deja datos de prueba.
const assert = require('node:assert/strict');
const { prisma } = require('../src/database/prisma');
const { HorarioRepository } = require('../src/modules/horarios/horario.repository');
const prefix = `TRAS-${Date.now()}`;
const rollback = new Error('ROLLBACK_VERIFICACION_TRASLADOS');
const repo = new HorarioRepository();
(async () => {
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(20260930, 1)`;
      const period = await tx.periodo_academico.create({ data: { gestion: 2098, periodo: prefix, fecha_inicio: new Date('2098-01-01'), fecha_fin: new Date('2098-12-31') } });
      const teacher = await tx.docente.create({ data: { nombre_completo: prefix } });
      const materia = await tx.materia.create({ data: { codigo_materia: prefix, nombre: prefix } });
      const asignacion = await tx.paralelo.create({ data: { id_docente: teacher.id_docente, codigo_materia: materia.codigo_materia, id_periodo: period.id_periodo, nombre_paralelo: 'A' } });
      const aux = await tx.auxiliar.create({ data: { nombre_completo: prefix, correo: 'sin-envio@example.test' } });
      await tx.auxiliar_asignacion.create({ data: { id_auxiliar: aux.id_auxiliar, id_paralelo: asignacion.id_paralelo } });
      for (const suffix of ['A','B','C']) await tx.ambiente.create({ data: { codigo_ambiente: `${prefix}-${suffix}`, nombre: `${prefix}-${suffix}`, tipo: 'AULA', lugar: 'INFORMATICA', capacidad: 40 } });
      const fecha = new Date('2098-01-01T00:00:00Z'); while (fecha.getUTCDay() !== 1) fecha.setUTCDate(fecha.getUTCDate() + 1);
      const input = { idAsignacion: String(asignacion.id_paralelo), aula: `${prefix}-A`, dia: 'LUNES', horaInicio: '08:00', horaFin: '10:00' };
      const base = await repo.createInTransaction(tx, { ...input, esAuxiliar: true, idAuxiliar: String(aux.id_auxiliar) });
      const reserva = await repo.createInTransaction(tx, { ...input, fecha: fecha.toISOString().slice(0,10), motivo: 'Prueba con rollback', reubicaciones: [{ idHorario: base.idHorario, aula: `${prefix}-B` }] });
      const original = await tx.horario.findUnique({ where: { id_horario: BigInt(base.idHorario) }, include: { traslados: true } });
      assert.equal(original.fecha, null); assert.equal(original.id_auxiliar, aux.id_auxiliar); assert.equal(original.codigo_ambiente, `${prefix}-A`);
      assert.equal(original.traslados.length, 1); assert.equal(original.traslados[0].id_reserva_origen, BigInt(reserva.idHorario));
      assert.equal(original.traslados[0].codigo_ambiente, `${prefix}-B`);
      assert.equal(reserva.reubicaciones[0].idHorario, base.idHorario);
      const otra = await repo.createInTransaction(tx, { ...input, aula: `${prefix}-C`, fecha: fecha.toISOString().slice(0,10), motivo: 'Segunda aula temporal del mismo docente' });
      assert.notEqual(otra.idHorario, reserva.idHorario); assert.equal(otra.idDocente, reserva.idDocente); assert.equal(otra.fecha, reserva.fecha);
      await assert.rejects(repo.createInTransaction(tx, { ...input, fecha: fecha.toISOString().slice(0,10), motivo: 'Reserva duplicada' }), { statusCode: 409 });
      throw rollback;
    }, { timeout: 30000 });
  } catch (error) { if (error !== rollback) throw error; }
  assert.equal(await prisma.materia.count({ where: { codigo_materia: prefix } }), 0);
  assert.equal(await prisma.ambiente.count({ where: { codigo_ambiente: { startsWith: prefix } } }), 0);
  console.log('TRASLADOS_POSTGRES_OK: relaciones persistentes, original intacto, reserva del titular, traslado, conflicto y rollback completo.');
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
