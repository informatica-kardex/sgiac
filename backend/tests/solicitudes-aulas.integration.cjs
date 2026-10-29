// node tests/solicitudes-aulas.integration.cjs (después de compilar y migrar).
// Crea datos aislados, prueba HTTP y concurrencia real, y retira solo sus propios datos.
const assert = require('node:assert/strict');
const { prisma: db } = require('../dist/database/prisma');
const app = require('../dist/app').default;
const { signAccessToken, credentialVersion } = require('../dist/utils/jwt');
const { HorarioRepository } = require('../dist/modules/horarios/horario.repository');
const { agendaSchema } = require('../dist/modules/solicitudes-aulas/solicitud-aula.validation');
const prefix = 'SA' + Date.now(), users = [], auxiliaries = [], teachers = [], rooms = [], subjects = [], periods = [], assignments = [];
let server, adminToken;
const token = u => signAccessToken({ idUsuario: String(u.idUsuario), correo: u.correo, roles: [], credentialVersion: credentialVersion(u.contrasenaHash) });
async function call(method, path, body, expected = 200, access = adminToken) {
  const r = await fetch(`http://127.0.0.1:${server.address().port}/api/solicitudes-aulas${path}`, { method, headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: 'Bearer ' + access } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const json = await r.json();
  if (expected !== null) assert.equal(r.status, expected, `${method} ${path}: ${json.message}`);
  return expected === null ? { status: r.status, data: json.data } : json.data;
}
const date = '2099-02-02'; // lunes
const day = (start = '09:00', end = '10:00') => ({ alcance: 'DIA', sesiones: [{ dia: 'LUNES', fecha: date, horaInicio: start, horaFin: end }] });
(async () => {
  assert.equal(new Date(date + 'T12:00:00Z').getUTCDay(), 1);
  const role = await db.rol.findUniqueOrThrow({ where: { nombre: 'ADMINISTRADOR' } });
  const admin = await db.usuario.create({ data: { nombreCompleto: prefix, correo: prefix + '@example.test', correoVerificado: true, roles: { create: { idRol: role.idRol } } } }); users.push(admin.idUsuario); adminToken = token(admin);
  const period = await db.periodo_academico.create({ data: { gestion: 2099, periodo: prefix, fecha_inicio: new Date('2099-01-01'), fecha_fin: new Date('2099-12-31') } }); periods.push(period.id_periodo);
  const students = [];
  for (let i = 0; i < 3; i++) {
    const u = await db.usuario.create({ data: { nombreCompleto: `${prefix} Auxiliar ${i}`, correo: `${prefix.toLowerCase()}${i}@umsa.bo`, correoVerificado: true,
      estudiante: { create: { nombres: prefix, apellidos: `Auxiliar ${i}`, ci: prefix + i, ru: prefix + i, correo_institucional: `${prefix.toLowerCase()}${i}@umsa.bo` } } }, include: { estudiante: true } }); users.push(u.idUsuario);
    const docente = await db.docente.create({ data: { nombre_completo: prefix + i } }); teachers.push(docente.id_docente);
    const materia = await db.materia.create({ data: { codigo_materia: prefix + i, nombre: prefix + i } }); subjects.push(materia.codigo_materia);
    const p = await db.paralelo.create({ data: { id_docente: docente.id_docente, codigo_materia: materia.codigo_materia, id_periodo: period.id_periodo, nombre_paralelo: 'A' } }); assignments.push(p.id_paralelo);
    let a = null;
    if (i < 2) { a = await db.auxiliar.create({ data: { id_estudiante: u.estudiante.id_estudiante, nombre_completo: u.nombreCompleto, correo: u.correo, asignaciones: { create: { id_paralelo: p.id_paralelo } } } }); auxiliaries.push(a.id_auxiliar); }
    students.push({ u, a, p, token: token(u) });
  }
  for (const [i, lugar, capacidad, estado] of [[0, 'INFORMATICA', 40, 'DISPONIBLE'], [1, 'LASIN', 40, 'DISPONIBLE'], [2, 'ANTIGUO', 40, 'DISPONIBLE'], [3, 'LASIN', 2, 'DISPONIBLE'], [4, 'LASIN', 40, 'MANTENIMIENTO'], [5, 'LASIN', 40, 'DISPONIBLE']]) {
    const codigo = `${prefix}-${i}`; await db.ambiente.create({ data: { codigo_ambiente: codigo, nombre: codigo, lugar, capacidad, estado, tipo: i === 5 ? 'LABORATORIO' : 'AULA' } }); rooms.push(codigo);
  }
  const [a, b, normal] = students;
  const repo = new HorarioRepository();
  const busy = await repo.create({ idAsignacion: String(normal.p.id_paralelo), aula: rooms[0], ...day().sesiones[0], motivo: 'Prueba de ocupación' });
  server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
  assert.equal((await call('GET', '/perfil', undefined, 200, a.token)).datos.ci, a.u.estudiante.ci);
  assert.equal((await call('GET', '/perfil', undefined, 200, normal.token)).habilitado, false);
  await call('GET', '/admin', undefined, 403, a.token);
  const input = { idAsignacion: String(a.p.id_paralelo), celular: '71234567', numeroEstudiantes: 20, actividad: 'CLASE_TEORICA', detalle: 'Clase con los estudiantes', reserva: { aula: rooms[1], agenda: day() } };
  await call('POST', '', input, 403, normal.token);
  await call('POST', '', { ...input, nombre: 'Identidad inyectada' }, 400, a.token);
  const availability = await call('POST', '/disponibilidad', { idAsignacion: input.idAsignacion, numeroEstudiantes: 20, actividad: input.actividad, agenda: day() }, 200, a.token);
  assert.ok(availability.every(x => x.tipo === 'AULA'));
  assert.equal(availability.some(x => x.codigo === rooms[5]), false);
  const labAvailability = await call('POST', '/disponibilidad', { idAsignacion: input.idAsignacion, numeroEstudiantes: 20, actividad: 'PRACTICA_LABORATORIO', agenda: day() }, 200, a.token);
  assert.ok(labAvailability.every(x => x.tipo === 'LABORATORIO'));
  assert.ok(labAvailability.some(x => x.codigo === rooms[5]));
  await call('POST', '', { ...input, actividad: 'EXAMEN' }, 400, a.token);
  await call('POST', '', { ...input, actividad: 'PRACTICA_LABORATORIO' }, 400, a.token);
  await call('POST', '', { ...input, reserva: { ...input.reserva, aula: rooms[5] } }, 400, a.token);
  assert.equal(availability.find(x => x.codigo === rooms[0]).disponible, false);
  assert.equal(availability.find(x => x.codigo === rooms[1]).disponible, true);
  assert.equal(availability.some(x => x.codigo === rooms[2]), false);
  assert.equal(availability.find(x => x.codigo === rooms[3]).disponible, false);
  assert.equal(availability.find(x => x.codigo === rooms[4]).disponible, false);
  await call('POST', '', { ...input, reserva: { ...input.reserva, aula: rooms[2] } }, 400, a.token);
  await call('POST', '', { ...input, reserva: { ...input.reserva, aula: rooms[0] } }, 409, a.token);
  let s = await call('POST', '', input, 201, a.token);
  assert.equal(s.nombre, a.u.nombreCompleto); assert.equal(s.ru, a.u.estudiante.ru);
  assert.equal(await db.horario.count({ where: { id_solicitud_aula: BigInt(s.id) } }), 0);
  await call('POST', '', input, 409, a.token);
  await call('POST', `/${s.id}/cancelar`, { version: s.version }, 404, b.token);
  assert.equal((await call('GET', '/mias', undefined, 200, b.token)).length, 0);
  s = await call('POST', `/admin/${s.id}/revisar`, { version: s.version, accion: 'APROBAR' });
  assert.equal(s.estado, 'APROBADA');
  const reserved = await db.horario.findMany({ where: { id_solicitud_aula: BigInt(s.id) } }); assert.equal(reserved.length, 1); assert.equal(reserved[0].publicado, true);
  await call('POST', `/admin/${s.id}/revisar`, { version: 1, accion: 'APROBAR' }, 409);
  await assert.rejects(repo.delete(Number(reserved[0].id_horario)), { statusCode: 409 });
  await assert.rejects(repo.update(Number(reserved[0].id_horario), { aula: rooms[0] }), { statusCode: 409 });
  s = await call('POST', `/admin/${s.id}/revisar`, { version: s.version, accion: 'CANCELAR', comentario: 'Cancelada para continuar la prueba.' });
  assert.equal(s.estado, 'CANCELADA'); assert.equal(await db.horario.count({ where: { id_solicitud_aula: BigInt(s.id) } }), 0);
  let alt = await call('POST', '', { ...input, reserva: { aula: rooms[1], agenda: day('11:00', '12:00') } }, 201, a.token);
  const proposal = { aula: rooms[0], agenda: day('11:00', '12:00') };
  alt = await call('POST', `/admin/${alt.id}/revisar`, { version: alt.version, accion: 'PROPONER', propuesta: proposal, comentario: 'Este ambiente cuenta con el equipo necesario.' });
  await call('POST', `/admin/${alt.id}/revisar`, { version: alt.version, accion: 'APROBAR' }, 409);
  await call('POST', `/${alt.id}/responder`, { version: alt.version, aceptar: true }, 404, b.token);
  const taken = await repo.create({ idAsignacion: String(normal.p.id_paralelo), aula: rooms[0], ...day('11:00', '12:00').sesiones[0], motivo: 'Cambio posterior a la propuesta' });
  await call('POST', `/${alt.id}/responder`, { version: alt.version, aceptar: true }, 409, a.token);
  assert.equal(await db.horario.count({ where: { id_solicitud_aula: BigInt(alt.id) } }), 0);
  await repo.delete(taken.idHorario);
  alt = await call('POST', `/${alt.id}/responder`, { version: alt.version, aceptar: true }, 200, a.token);
  assert.equal(alt.estado, 'APROBADA'); assert.equal(alt.reserva.aula, rooms[1]); assert.equal(alt.propuesta.aula, rooms[0]);
  assert.equal((await db.horario.findFirstOrThrow({ where: { id_solicitud_aula: BigInt(alt.id) } })).codigo_ambiente, rooms[0]);
  let decline = await call('POST', '', { ...input, reserva: { aula: rooms[1], agenda: day('13:00', '14:00') } }, 201, a.token);
  decline = await call('POST', `/admin/${decline.id}/revisar`, { version: decline.version, accion: 'PROPONER', propuesta: { aula: rooms[0], agenda: day('13:00', '14:00') }, comentario: 'Cambio de aula para esta sesión.' });
  decline = await call('POST', `/${decline.id}/responder`, { version: decline.version, aceptar: false, comentario: 'Necesito equipos de laboratorio.' }, 200, a.token);
  assert.equal(decline.estado, 'PENDIENTE'); assert.equal(decline.propuesta, null); assert.equal(decline.historial.length, 3);
  decline = await call('POST', `/admin/${decline.id}/revisar`, { version: decline.version, accion: 'RECHAZAR', comentario: 'No hay equipos disponibles para la actividad.' }); assert.equal(decline.estado, 'RECHAZADA');
  const semester = { alcance: 'SEMESTRE', sesiones: [{ dia: 'LUNES', fecha: null, horaInicio: '07:00', horaFin: '08:00' }, { dia: 'MIERCOLES', fecha: null, horaInicio: '07:00', horaFin: '08:00' }] };
  assert.equal(agendaSchema.safeParse({ ...semester, sesiones: [semester.sesiones[0], semester.sesiones[0]] }).success, false);
  const punctual = await repo.create({ idAsignacion: String(normal.p.id_paralelo), aula: rooms[0], dia: 'MIERCOLES', fecha: '2099-02-04', horaInicio: '07:30', horaFin: '08:00', motivo: 'Reserva puntual contra semestre' });
  const semAvail = await call('POST', '/disponibilidad', { idAsignacion: input.idAsignacion, numeroEstudiantes: 20, actividad: input.actividad, agenda: semester }, 200, a.token);
  assert.equal(semAvail.find(x => x.codigo === rooms[0]).disponible, false);
  await repo.delete(punctual.idHorario);
  let sem = await call('POST', '', { ...input, reserva: { aula: rooms[0], agenda: semester } }, 201, a.token);
  sem = await call('POST', `/admin/${sem.id}/revisar`, { version: sem.version, accion: 'APROBAR' });
  assert.equal(await db.horario.count({ where: { id_solicitud_aula: BigInt(sem.id), fecha: null } }), 2);
  // Dos auxiliares piden el mismo hueco antes de reservarlo: solo una aprobación puede ganar.
  const raceInput = { ...input, reserva: { aula: rooms[1], agenda: day('15:00', '16:00') } };
  const r1 = await call('POST', '', raceInput, 201, a.token);
  const r2 = await call('POST', '', { ...raceInput, idAsignacion: String(b.p.id_paralelo) }, 201, b.token);
  const race = await Promise.all([r1, r2].map(r => call('POST', `/admin/${r.id}/revisar`, { version: r.version, accion: 'APROBAR' }, null)));
  assert.deepEqual(race.map(r => r.status).sort(), [200, 409]);
  assert.equal(await db.horario.count({ where: { id_solicitud_aula: { in: [BigInt(r1.id), BigInt(r2.id)] } } }), 1);
  // El tipo de ambiente también se valida al proponer y al aceptar una alternativa.
  let lab = await call('POST', '', { ...input, actividad: 'PRACTICA_LABORATORIO', reserva: { aula: rooms[5], agenda: day('17:00', '18:00') } }, 201, a.token);
  const adminLabs = await call('POST', `/admin/${lab.id}/disponibilidad`, lab.reserva.agenda);
  assert.ok(adminLabs.every(x => x.tipo === 'LABORATORIO'));
  await call('POST', `/admin/${lab.id}/revisar`, { version: lab.version, accion: 'PROPONER', propuesta: { ...lab.reserva, aula: rooms[1] }, comentario: 'No debe permitir un aula teórica.' }, 400);
  lab = await call('POST', `/admin/${lab.id}/revisar`, { version: lab.version, accion: 'PROPONER', propuesta: lab.reserva, comentario: 'Laboratorio disponible para la práctica.' });
  await db.ambiente.update({ where: { codigo_ambiente: rooms[5] }, data: { tipo: 'AULA' } });
  await call('POST', `/${lab.id}/responder`, { version: lab.version, aceptar: true }, 400, a.token);
  assert.equal(await db.horario.count({ where: { id_solicitud_aula: BigInt(lab.id) } }), 0);
  await db.ambiente.update({ where: { codigo_ambiente: rooms[5] }, data: { tipo: 'LABORATORIO' } });
  lab = await call('POST', `/${lab.id}/responder`, { version: lab.version, aceptar: true }, 200, a.token);
  assert.equal(lab.estado, 'APROBADA');
  // Dos fechas pueden caer en el mismo día de la semana. Ambas deben estar libres.
  const first = day('18:00', '19:00').sesiones[0], second = { ...first, fecha: '2099-02-09' };
  const twoDays = { alcance: 'DOS_DIAS', sesiones: [first, second] };
  assert.equal(agendaSchema.safeParse(twoDays).success, true);
  for (const sesiones of [[first], [first, first], [first, second, first], [first, { ...second, dia: 'MARTES' }], [first, { ...second, fecha: null }]]) {
    await call('POST', '', { ...input, reserva: { aula: rooms[1], agenda: { ...twoDays, sesiones } } }, 400, a.token);
  }
  let secondTaken = await repo.create({ idAsignacion: String(normal.p.id_paralelo), aula: rooms[1], ...second, motivo: 'Ocupación del segundo día' });
  const twoAvailability = await call('POST', '/disponibilidad', { idAsignacion: input.idAsignacion, numeroEstudiantes: 20, actividad: input.actividad, agenda: twoDays }, 200, a.token);
  assert.equal(twoAvailability.find(x => x.codigo === rooms[1]).disponible, false);
  await call('POST', '', { ...input, reserva: { aula: rooms[1], agenda: twoDays } }, 409, a.token);
  await repo.delete(secondTaken.idHorario);
  let two = await call('POST', '', { ...input, reserva: { aula: rooms[1], agenda: twoDays } }, 201, a.token);
  secondTaken = await repo.create({ idAsignacion: String(normal.p.id_paralelo), aula: rooms[1], ...second, motivo: 'Ocupación posterior del segundo día' });
  await call('POST', `/admin/${two.id}/revisar`, { version: two.version, accion: 'APROBAR' }, 409);
  assert.equal(await db.horario.count({ where: { id_solicitud_aula: BigInt(two.id) } }), 0);
  await repo.delete(secondTaken.idHorario);
  two = await call('POST', `/admin/${two.id}/revisar`, { version: two.version, accion: 'APROBAR' });
  const twoSessions = await db.horario.findMany({ where: { id_solicitud_aula: BigInt(two.id) } });
  assert.deepEqual(twoSessions.map(s => s.fecha.toISOString().slice(0, 10)).sort(), ['2099-02-02', '2099-02-09']);
  two = await call('POST', `/admin/${two.id}/revisar`, { version: two.version, accion: 'CANCELAR', comentario: 'Cancelar las dos fechas reservadas.' });
  assert.equal(await db.horario.count({ where: { id_solicitud_aula: BigInt(two.id) } }), 0);
  await repo.delete(busy.idHorario);
  console.log('SOLICITUDES_AULAS_OK: identidad, permisos, edificios, tipo de aula, capacidad, dos fechas distintas, conflictos sin reservas parciales, aprobación, alternativa, rechazo, cancelación, semestre y concurrencia.');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  if (server) { server.closeAllConnections(); await new Promise(r => server.close(r)); }
  try {
    await db.$transaction(async tx => {
      await tx.horario.deleteMany({ where: { id_paralelo: { in: assignments } } });
      await tx.solicitudAula.deleteMany({ where: { idSolicitante: { in: users } } });
      await tx.auxiliar.deleteMany({ where: { id_auxiliar: { in: auxiliaries } } });
      await tx.paralelo.deleteMany({ where: { id_paralelo: { in: assignments } } });
      await tx.materia.deleteMany({ where: { codigo_materia: { in: subjects } } });
      await tx.docente.deleteMany({ where: { id_docente: { in: teachers } } });
      await tx.ambiente.deleteMany({ where: { codigo_ambiente: { in: rooms } } });
      await tx.periodo_academico.deleteMany({ where: { id_periodo: { in: periods } } });
      await tx.bitacora.deleteMany({ where: { idUsuario: { in: users } } });
      await tx.estudiante.deleteMany({ where: { id_usuario: { in: users } } });
      await tx.usuario.deleteMany({ where: { idUsuario: { in: users } } });
    });
    console.log('DATOS_DE_PRUEBA_RETIRADOS');
  } finally { await db.$disconnect(); }
});
