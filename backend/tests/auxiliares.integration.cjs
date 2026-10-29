// Prueba HTTP y BD real. Todos los datos y cambios se revierten al terminar.
const assert = require('node:assert/strict');
const db = require('../dist/database/prisma');
const original = db.prisma;
const app = require('../dist/app').default;
const { signAccessToken, credentialVersion } = require('../dist/utils/jwt');
const { comparePassword } = require('../dist/utils/password');
const { HorarioRepository } = require('../dist/modules/horarios/horario.repository');
const rollback = new Error('TEST_ROLLBACK');
let server;
const prefix = 'AX' + Date.now();
const token = u => signAccessToken({ idUsuario: String(u.idUsuario), correo: u.correo, roles: [], credentialVersion: credentialVersion(u.contrasenaHash) });
(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    await original.$transaction(async tx => {
      db.prisma = new Proxy(tx, { get: (target, key) => key === '$transaction' ? fn => fn(tx) : target[key] });
      const adminRole = await tx.rol.findUniqueOrThrow({ where: { nombre: 'ADMINISTRADOR' } });
      const actor = await tx.usuario.create({ data: { nombreCompleto: prefix, correo: prefix + '@example.test', correoVerificado: true, roles: { create: { idRol: adminRole.idRol } } } });
      const adminToken = token(actor);
      const call = async (method, path, body, status = 200, access = adminToken) => {
        const r = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method,
          headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: 'Bearer ' + access } : {}) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        const result = await r.json();
        assert.equal(r.status, status, method + ' ' + path + ': ' + result.message);
        return result.data;
      };
      const periodo = await tx.periodo_academico.create({ data: { gestion: 2099, periodo: prefix, fecha_inicio: new Date('2099-01-01'), fecha_fin: new Date('2099-12-31') } });
      const docente = await tx.docente.create({ data: { nombre_completo: prefix } });
      const materia = await tx.materia.create({ data: { codigo_materia: prefix, nombre: prefix } });
      const paralelo = await tx.paralelo.create({ data: { id_docente: docente.id_docente, codigo_materia: materia.codigo_materia, id_periodo: periodo.id_periodo, nombre_paralelo: 'A' } });
      const input = { nombres: 'Ana', apellidos: prefix, ci: prefix, ru: prefix, correo: prefix.toLowerCase() + '@umsa.bo', mencion: 'Sistemas' };
      const ids = await call('POST', '/users/estudiantes', input, 201);
      const usuario = await tx.usuario.findUniqueOrThrow({ where: { idUsuario: BigInt(ids.idUsuario) } });
      assert.equal(usuario.debeCambiarPassword, true);
      assert.equal(usuario.correoVerificado, false);
      assert.ok(await comparePassword(input.ci, usuario.contrasenaHash));
      await call('POST', '/users/estudiantes', input, 409);
      const sinCuenta = { ...input, ci: prefix + '2', ru: prefix + '2', correo: prefix.toLowerCase() + '2@umsa.bo' };
      const ficha = await tx.estudiante.create({ data: { nombres: sinCuenta.nombres, apellidos: sinCuenta.apellidos, ci: sinCuenta.ci, ru: sinCuenta.ru, correo_institucional: sinCuenta.correo } });
      const cuentaExistente = await call('POST', '/users/estudiantes', sinCuenta, 201);
      assert.equal(cuentaExistente.idEstudiante, String(ficha.id_estudiante), 'Crear cuenta para ficha existente no duplica al estudiante');
      const candidate = (await call('GET', '/academico/auxiliares/estudiantes')).find(e => e.idEstudiante === ids.idEstudiante);
      assert.equal(candidate.motivoNoDisponible, '');
      await call('POST', '/academico/auxiliares', { nombreCompleto: 'Manual' }, 400);
      const enable = { idEstudiante: ids.idEstudiante, idAsignacion: String(paralelo.id_paralelo) };
      const aux = await call('POST', '/academico/auxiliares', enable, 201);
      await call('POST', '/academico/auxiliares', enable, 409);
      assert.equal((await call('GET', '/academico/auxiliares')).find(a => a.idAuxiliar === aux.idAuxiliar).asignaciones[0].idAsignacion, enable.idAsignacion);
      await tx.usuario.update({ where: { idUsuario: usuario.idUsuario }, data: { estado: 'INACTIVO' } });
      await call('POST', `/academico/auxiliares/${aux.idAuxiliar}/asignaciones`, { idAsignacion: enable.idAsignacion }, 409);
      await tx.usuario.update({ where: { idUsuario: usuario.idUsuario }, data: { estado: 'ACTIVO', correoVerificado: true, debeCambiarPassword: false } });
      const studentToken = token(usuario);
      await call('GET', '/academico/auxiliares/estudiantes', undefined, 403, studentToken);
      await call('DELETE', '/academico/auxiliares', undefined, 403, studentToken);
      await call('POST', '/users/estudiantes', input, 403, studentToken);
      const subRole = await tx.rol.findUniqueOrThrow({ where: { nombre: 'SUBADMINISTRADOR' } });
      const sub = await tx.usuario.create({ data: { nombreCompleto: prefix, correo: 'sub' + prefix + '@example.test', correoVerificado: true, roles: { create: { idRol: subRole.idRol } }, permisos: { create: { modulo: 'docentes' } } } });
      await call('DELETE', `/academico/auxiliares/${aux.idAuxiliar}`, undefined, 403, token(sub));
      await tx.permisoUsuario.create({ data: { idUsuario: sub.idUsuario, modulo: 'auxiliares' } });
      await call('GET', '/academico/auxiliares/estudiantes', undefined, 200, token(sub));
      const aula = await tx.ambiente.create({ data: { codigo_ambiente: prefix, nombre: prefix, tipo: 'AULA' } });
      await tx.usuario.update({ where: { idUsuario: usuario.idUsuario }, data: { estado: 'INACTIVO' } });
      await assert.rejects(new HorarioRepository().create({ idAsignacion: enable.idAsignacion, idAuxiliar: aux.idAuxiliar, aula: aula.codigo_ambiente, dia: 'MARTES', horaInicio: '07:00', horaFin: '08:00' }), { statusCode: 409 });
      await tx.usuario.update({ where: { idUsuario: usuario.idUsuario }, data: { estado: 'ACTIVO' } });
      const bloque = await tx.bloque_horario.findFirstOrThrow();
      const horario = await tx.horario.create({ data: { id_auxiliar: BigInt(aux.idAuxiliar), es_auxiliar: true, id_paralelo: paralelo.id_paralelo, codigo_ambiente: aula.codigo_ambiente, id_bloque: bloque.id_bloque, dia_semana: 'LUNES' } });
      await call('DELETE', `/academico/auxiliares/${aux.idAuxiliar}`, undefined, 409);
      await call('DELETE', '/academico/auxiliares', undefined, 409);
      assert.equal((await tx.auxiliar.findUniqueOrThrow({ where: { id_auxiliar: BigInt(aux.idAuxiliar) } })).estado, 'ACTIVO');
      await tx.horario.delete({ where: { id_horario: horario.id_horario } });
      await call('DELETE', `/academico/auxiliares/${aux.idAuxiliar}`);
      assert.equal((await tx.usuario.findUniqueOrThrow({ where: { idUsuario: usuario.idUsuario } })).estado, 'ACTIVO');
      assert.equal(await tx.auxiliar_asignacion.count({ where: { id_auxiliar: BigInt(aux.idAuxiliar) } }), 0);
      assert.equal((await call('POST', '/academico/auxiliares', enable, 201)).idAuxiliar, aux.idAuxiliar);
      // Aísla la baja masiva en esta transacción que siempre se revierte.
      await tx.auxiliar.updateMany({ where: { id_auxiliar: { not: BigInt(aux.idAuxiliar) } }, data: { estado: 'INACTIVO' } });
      assert.equal((await call('DELETE', '/academico/auxiliares')).cantidad, 1);
      assert.equal((await call('GET', '/academico/auxiliares/estudiantes')).find(e => e.idEstudiante === ids.idEstudiante).idAuxiliar, null);
      console.log('AUXILIARES_HTTP_OK: cuenta institucional, CI temporal, selección, duplicados, permisos, horarios, baja individual y masiva, reactivación.');
      throw rollback;
    }, { timeout: 60000 });
  } catch (e) { if (e !== rollback) throw e; }
  console.log('DATOS_DE_PRUEBA_REVERTIDOS');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  db.prisma = original;
  if (server) { server.closeAllConnections(); await new Promise(r => server.close(r)); }
  await original.$disconnect();
});
