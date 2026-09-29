// Verifica fichas contra PostgreSQL y revierte TODOS los datos de la prueba.
// Solo avanza las secuencias, como cualquier transacción revertida en PostgreSQL.
const assert = require('node:assert/strict');
const database = require('../dist/database/prisma');
const realPrisma = database.prisma;
const { EstudianteService } = require('../dist/modules/estudiantes/estudiante.service');
const service = new EstudianteService();
const rollback = new Error('ROLLBACK_PRUEBA');
(async () => {
  try {
    await realPrisma.$transaction(async tx => {
      database.prisma = Object.assign(Object.create(tx), { $transaction: fn => fn(tx) });
      const first = await tx.estudiante.findUnique({ where: { correo_institucional: 'estudiante.prueba@example.test' } });
      const second = await tx.estudiante.findFirst({ where: { correo_institucional: { startsWith: 'registro.frontend.' } } });
      assert.ok(first && second, 'Se necesitan los dos estudiantes de prueba');
      const jornada = await tx.jornada_atencion.create({ data: {
        fecha: new Date('2099-12-01'), hora_inicio: new Date('1970-01-01T08:00:00Z'), hora_fin: new Date('1970-01-01T16:00:00Z'),
        cupo_total: 1, estado: 'ACTIVO', id_usuario: first.id_usuario,
      } });
      const input = { idJornada: jornada.id_jornada.toString(), motivo: 'Prueba transaccional', detalle: 'Esta ficha se revierte al terminar la prueba.' };
      const ficha = await service.solicitar(first.id_usuario.toString(), input);
      assert.equal(ficha.numero, 1);
      assert.equal((await service.fichas(first.id_usuario.toString())).filter(f => f.idFicha === ficha.idFicha).length, 1);
      assert.equal((await service.fichas(second.id_usuario.toString())).filter(f => f.idFicha === ficha.idFicha).length, 0);
      assert.equal(await tx.historial_ficha.count({ where: { id_ficha: BigInt(ficha.idFicha) } }), 1);
      await assert.rejects(service.solicitar(first.id_usuario.toString(), input), { statusCode: 409 });
      await assert.rejects(service.solicitar(second.id_usuario.toString(), input), { statusCode: 409 });
      const disponibles = await service.jornadas(second.id_usuario.toString());
      assert.equal(disponibles.find(j => j.idJornada === input.idJornada).disponibles, 0);
      throw rollback;
    }, { timeout: 15000 });
  } catch (e) { if (e !== rollback) throw e; }
  finally { database.prisma = realPrisma; }
  assert.equal(await realPrisma.ficha_atencion.count({ where: { motivo_atencion: { startsWith: 'Prueba transaccional' } } }), 0);
  console.log('FICHAS_BD_OK: persistencia, historial, aislamiento entre estudiantes, duplicados y cupos. Datos de prueba revertidos.');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => realPrisma.$disconnect());
