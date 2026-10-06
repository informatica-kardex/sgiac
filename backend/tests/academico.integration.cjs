// Ejecutar tras build y migración: node tests/academico.integration.cjs
// Usa registros temporales identificados por un prefijo único y los retira al finalizar.
const assert = require('node:assert/strict');
const { prisma } = require('../dist/database/prisma');
const app = require('../dist/app').default;
const { signAccessToken, credentialVersion } = require('../dist/utils/jwt');
const { HorarioRepository } = require('../dist/modules/horarios/horario.repository');
const { AulaRepository } = require('../dist/modules/aulas/aula.repository');
const prefix = `TEST-${Date.now()}`;
const users = [], teachers = [], subjects = [], rooms = [], periods = [], blocks = [];
let server, base;
async function request(path, method='GET', body, token) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type':'application/json', ...(token ? { Authorization:`Bearer ${token}` } : {}) }, ...(body ? { body:JSON.stringify(body) } : {}) });
  return { status:res.status, ...(await res.json()) };
}
async function user(role, permission) {
  const rol = await prisma.rol.findUniqueOrThrow({ where:{ nombre:role } });
  const u = await prisma.usuario.create({ data:{ nombreCompleto:prefix, correo:`${prefix}-${users.length}@example.test`, correoVerificado:true, roles:{ create:{ idRol:rol.idRol } }, ...(permission ? { permisos:{ create:{ modulo:permission } } } : {}) } });
  users.push(u.idUsuario);
  return signAccessToken({ idUsuario:String(u.idUsuario), correo:u.correo, roles:[role], credentialVersion:credentialVersion(u.contrasenaHash) });
}
(async () => {
  server = app.listen(0,'127.0.0.1'); await new Promise(r => server.once('listening',r)); base=`http://127.0.0.1:${server.address().port}/api`;
  const admin=await user('ADMINISTRADOR'), sub=await user('SUBADMINISTRADOR','horarios');
  assert.equal((await request('/academico/docentes')).status,401);
  assert.equal((await request('/academico/docentes','GET',null,sub)).status,200);
  assert.equal((await request('/academico/docentes','POST',{nombreCompleto:'Bloqueado'},sub)).status,403);
  assert.equal((await request('/academico/auxiliares','POST',{nombreCompleto:'Bloqueado'},sub)).status,403);
  assert.equal((await request('/academico/horarios')).status,401);
  assert.equal((await request('/horarios/lote','POST',{sesiones:[]},sub)).status,400);
  assert.equal((await request('/aulas','POST',{},sub)).status,403);
  assert.equal((await request('/horarios/no-es-id','PUT',{},admin)).status,400);
  // Periodo exclusivo de la prueba, sin modificar el periodo de la muestra.
  const period=await prisma.periodo_academico.create({ data:{gestion:2099,periodo:prefix.slice(-18),fecha_inicio:new Date('2099-01-01'),fecha_fin:new Date('2099-12-31')} }); periods.push(period.id_periodo);
  for (let i=0;i<2;i++) {
    const d=await request('/academico/docentes','POST',{nombreCompleto:`${prefix} Docente ${i}`,gradoAcademico:i?'Lic.':'M.Sc.'},admin); assert.equal(d.status,201); teachers.push(BigInt(d.data.idDocente));
    const codigo=`${prefix}-${i}`;
    const m=await request('/academico/materias','POST',{codigo,nombre:`${prefix} Materia ${i}`,siglas:[`${codigo}-EQ`]},admin); assert.equal(m.status,201); subjects.push(codigo);
    const a=await request('/aulas','POST',{codigo,nombre:`${prefix} Aula ${i}`,lugar:i?'PABELLONES':'INFORMATICA',piso:i?null:1,capacidad:0,equipamiento:[{nombre:`${prefix} Proyector`,cantidad:1}]},admin); assert.equal(a.status,201); rooms.push(codigo);
    assert.deepEqual(a.data.equipamiento,[{nombre:`${prefix} Proyector`,cantidad:1}]);
  }
  // Inventarios independientes, cantidades válidas y compatibilidad con clientes que omiten el campo.
  const inventory=[{nombre:`${prefix} Proyector`,cantidad:2},{nombre:`${prefix} Cámara`,cantidad:1}];
  const updatedRoom=await request(`/aulas/${rooms[0]}`,'PUT',{capacidad:30,equipamiento:inventory},admin);
  assert.equal(updatedRoom.status,200); assert.equal(updatedRoom.data.equipamiento.length,2);
  assert.equal((await request(`/aulas/${rooms[0]}`,'PUT',{nombre:`${prefix} Aula editada`},admin)).status,200);
  let savedRoom=await new AulaRepository().findById(rooms[0]);
  assert.equal(savedRoom.equipamiento.find(e=>e.nombre.endsWith('Proyector')).cantidad,2,'Una edición sin inventario conserva cantidades');
  for(const invalid of [[{nombre:'',cantidad:1}],[{nombre:'Data',cantidad:0}],[{nombre:'Data',cantidad:1.5}],[{nombre:'Cámara',cantidad:1},{nombre:' camara ',cantidad:2}]]) {
    assert.equal((await request(`/aulas/${rooms[0]}`,'PUT',{capacidad:999,equipamiento:invalid},admin)).status,400);
  }
  assert.equal((await new AulaRepository().findById(rooms[0])).capacidad,30,'Un inventario inválido no modifica la capacidad');
  assert.equal((await request(`/aulas/${rooms[0]}`,'PUT',{equipamiento:[inventory[1]]},admin)).status,200);
  assert.deepEqual((await new AulaRepository().findById(rooms[1])).equipamiento,[{nombre:`${prefix} Proyector`,cantidad:1}],'Quitar un equipo de un aula no afecta otra');
  assert.equal((await request(`/aulas/${rooms[0]}`,'PUT',{equipamiento:[]},admin)).status,200);
  assert.deepEqual((await new AulaRepository().findById(rooms[0])).equipamiento,[],'La lista vacía retira todos los equipos');
  assert.equal((await request('/academico/materias','PUT',{codigo:subjects[1],nombre:'Otra materia',siglas:[`${subjects[0]}-EQ`]},admin)).status,404); // Ruta incompleta no escribe.
  assert.equal((await request(`/academico/materias/${subjects[1]}`,'PUT',{codigo:subjects[1],nombre:'Otra materia',siglas:[`${subjects[0]}-EQ`]},admin)).status,200);
  const shared = await request('/academico/materias','POST',{codigo:subjects[0],nombre:`${prefix} Otra mención`,siglas:[]},admin);
  assert.equal(shared.status,201,'La misma sigla puede corresponder a otra materia');
  subjects.push(shared.data.codigo);
  assert.notEqual(shared.data.codigo,subjects[0],'Las materias conservan identidades distintas');
  const catalog = (await request('/academico/materias','GET',null,admin)).data;
  assert.deepEqual(catalog.find(m=>m.codigo===shared.data.codigo).siglas,[subjects[0]],'Se muestra la sigla real, no el identificador interno');
  assert.equal(catalog.find(m=>m.codigo===shared.data.codigo).siglaPrincipal,subjects[0]);
  assert.equal((await request(`/academico/materias/${shared.data.codigo}`,'PUT',{codigo:shared.data.codigo,nombre:`${prefix} Otra mención editada`,siglas:[]},admin)).status,200);
  assert.deepEqual((await request('/academico/materias','GET',null,admin)).data.find(m=>m.codigo===shared.data.codigo).siglas,[subjects[0]],'Editar conserva la sigla real sin exponer el código interno');
  const otherMention = await request('/academico/asignaciones','POST',{idDocente:String(teachers[0]),codigoMateria:shared.data.codigo,idPeriodo:String(period.id_periodo)},admin);
  assert.equal(otherMention.status,201);
  assert.equal(otherMention.data.grupo,'A');
  assert.deepEqual(otherMention.data.siglas,[subjects[0]]);
  const assignments=[];
  for(let i=0;i<2;i++) { const a=await request('/academico/asignaciones','POST',{idDocente:String(teachers[i]),codigoMateria:subjects[i],idPeriodo:String(period.id_periodo),grupo:'A'},admin); assert.equal(a.status,201); assignments.push(a.data.idAsignacion); }
  const ds=await request('/academico/docentes','GET',null,admin); assert.ok(ds.data.find(d=>d.idDocente===String(teachers[0])).asignaciones.some(a=>a.codigoMateria===subjects[0]));
  assert.equal(ds.data.find(d=>d.idDocente===String(teachers[0])).gradoAcademico,'M.Sc.');
  assert.equal(ds.data.find(d=>d.idDocente===String(teachers[0])).nombreConGrado,`M.Sc. ${prefix} Docente 0`);
  assert.equal(ds.data.find(d=>d.idDocente===String(teachers[0])).asignaciones[0].docente,`M.Sc. ${prefix} Docente 0`);
  assert.equal((await request(`/academico/docentes/${teachers[0]}`,'PUT',{nombreCompleto:`${prefix} Docente 0`,gradoAcademico:'x'.repeat(31)},admin)).status,400);
  assert.equal((await request(`/academico/docentes/${teachers[0]}`,'PUT',{nombreCompleto:`${prefix} Docente 0`},admin)).status,200);
  assert.equal((await prisma.docente.findUnique({where:{id_docente:teachers[0]}})).grado_academico,'M.Sc.','Un cliente anterior no borra el grado al omitir el campo');
  assert.equal((await request(`/academico/docentes/${teachers[0]}`,'PUT',{nombreCompleto:`${prefix} Docente 0`,gradoAcademico:'Ph.D.'},admin)).status,200);
  assert.equal((await request('/academico/asignaciones','POST',{idDocente:String(teachers[0]),codigoMateria:subjects[0],idPeriodo:String(period.id_periodo)},admin)).status,409);
  const body={idAsignacion:assignments[0],aula:rooms[0],dia:'SABADO',horaInicio:'07:00',horaFin:'08:00'};
  const created=await request('/horarios','POST',body,sub); assert.equal(created.status,201); const id=created.data.idHorario;
  assert.equal(created.data.responsable,`Ph.D. ${prefix} Docente 0`);assert.equal(created.data.docente,created.data.responsable);
  assert.equal((await request('/horarios','POST',{...body,idAsignacion:assignments[1],horaInicio:'07:30',horaFin:'08:30'},admin)).status,409,'No cruzar aula');
  assert.equal((await request('/horarios','POST',{...body,aula:rooms[1],horaInicio:'07:30',horaFin:'08:30'},admin)).status,409,'No cruzar docente en otra aula');
  assert.equal((await request('/horarios','POST',{...body,horaInicio:'08:00',horaFin:'07:00'},admin)).status,400);
  assert.equal((await request('/horarios','POST',{...body,horaInicio:'06:59'},admin)).status,400);
  assert.equal((await request('/horarios','POST',{...body,horaFin:'22:01'},admin)).status,400);
  assert.equal((await request(`/horarios/${id}`,'PUT',{horaInicio:'07:15',horaFin:'08:00'},admin)).status,200,'Editar excluye el mismo registro');
  assert.equal((await request('/horarios','POST',{...body,horaInicio:'08:00',horaFin:'09:00'},admin)).status,201,'Bloques adyacentes permitidos');
  assert.equal((await request('/horarios','POST',{...body,horaInicio:'21:00',horaFin:'22:00'},admin)).status,201,'Última hora');
  assert.equal((await request(`/aulas/${rooms[0]}`,'DELETE',null,admin)).status,409);
  assert.equal((await request(`/academico/asignaciones/${assignments[0]}`,'DELETE',null,admin)).status,409);
  assert.equal((await request(`/academico/docentes/${teachers[0]}`,'PUT',{nombreCompleto:`${prefix} Docente`,estado:'INACTIVO'},admin)).status,409);
  assert.equal((await request(`/aulas/${rooms[0]}`,'PUT',{estado:'mantenimiento'},admin)).status,409);
  const parallel=await Promise.all([0,1].map(i=>request('/horarios','POST',{...body,idAsignacion:assignments[i],dia:'LUNES',horaInicio:'12:00',horaFin:'14:00'},admin)));
  assert.deepEqual(parallel.map(p=>p.status).sort(),[201,409],'Dos escrituras simultáneas no deben reservar la misma aula');
  assert.equal((await new AulaRepository().findById(rooms[0])).piso,1);
  assert.ok((await new HorarioRepository().findAll()).some(h=>h.idHorario===id),'Persistencia en un repositorio nuevo');
  assert.equal((await request(`/horarios/${id}`,'DELETE',null,admin)).status,200);
  assert.equal((await request(`/horarios/${id}`)).status,404);
  console.log('ACADEMICO_OK: permisos, catálogos, equivalencias, asignación, persistencia, edición, eliminación, límites horarios, choques y concurrencia.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
  // Solo IDs creados por esta ejecución; ningún dato existente se elimina.
  const hs=await prisma.horario.findMany({where:{paralelo:{id_periodo:{in:periods}}},select:{id_bloque:true}}); blocks.push(...hs.map(h=>h.id_bloque));
  await prisma.horario.deleteMany({where:{paralelo:{id_periodo:{in:periods}}}});
  await prisma.paralelo.deleteMany({where:{id_periodo:{in:periods}}});
  await prisma.periodo_academico.deleteMany({where:{id_periodo:{in:periods}}});
  await prisma.ambiente.deleteMany({where:{codigo_ambiente:{in:rooms}}});
  await prisma.equipamiento.deleteMany({where:{nombre:{startsWith:prefix},ambiente_equipamiento:{none:{}}}});
  await prisma.materia.deleteMany({where:{codigo_materia:{in:subjects}}});
  await prisma.docente.deleteMany({where:{id_docente:{in:teachers}}});
  await prisma.usuario.deleteMany({where:{idUsuario:{in:users}}});
  server?.close(); await prisma.$disconnect();
});
