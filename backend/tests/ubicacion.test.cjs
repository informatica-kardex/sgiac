// node -r ts-node/register/transpile-only --test tests/ubicacion.test.cjs
// Isolated publication files and API fixtures; no database or real publication.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { ZodError } = require('zod');
const cache = (name,exports) => { const file = require.resolve(name); require.cache[file] = {id:file,filename:file,loaded:true,exports}; };
let reads = 0, scheduleReads = 0, periodReads = 0;
const room = {codigo_ambiente:'SS-A1',nombre:'SS Aula 1',lugar:'INFORMATICA',piso:-1,capacidad:45};
const period = {id_periodo:1n,gestion:2026,periodo:'II',estado:'ACTIVO',fecha_inicio:new Date('2026-07-01'),fecha_fin:new Date('2026-12-31')};
const schedule = {idHorario:1,idAsignacion:'1',idDocente:'1',idAuxiliar:null,esAuxiliar:false,responsable:'Docente',fecha:null,motivo:'PRIVATE',avisos:['PRIVATE'],reubicaciones:[{correo:'PRIVATE'}],siglas:['INF-111'],codigoMateria:'INF-111',materia:'Programación',docente:'Docente',aula:'SS-A1',dia:'LUNES',horaInicio:'08:00',horaFin:'10:00',grupo:'A',idPeriodo:'1',periodo:'II/2026',lugar:'INFORMATICA',piso:-1};
cache('../src/database/prisma',{prisma:{ambiente:{findMany:async()=>{reads++;return [room];}},periodo_academico:{findMany:async()=>{periodReads++;return [period];}}}});
cache('../src/modules/horarios/horario.repository',{HorarioRepository:class {async findAll(){scheduleReads++;return [schedule,{...schedule,aula:'OTRO',lugar:'LASIN'}];}}});
cache('../src/modules/estudiantes/estudiante.service',{EstudianteService:class {async horariosAulas(id){assert.equal(id,'student');return {aulas:[{codigo:'SS-A1',nombre:'SS Aula 1',lugar:'INFORMATICA',piso:-1},{codigo:'OTRO',nombre:'Otro',lugar:'LASIN',piso:1}],periodos:[],horarios:[schedule]};}}});
const {ApiError} = require('../src/utils/apiError');
cache('../src/middlewares/auth.middleware',{
  requireAuth:(req,_res,next)=>{const role=req.headers.authorization;if(!['admin','student'].includes(role))return next(ApiError.unauthorized());req.user={idUsuario:role};next();},
  requirePermission:()=> (req,_res,next)=> req.user?.idUsuario==='admin' ? next() : next(ApiError.forbidden()),
});
cache('../src/modules/aulas/aula.controller',{aulaController:Object.fromEntries(['listar','obtener','crear','actualizar','eliminar'].map(key=>[key,(_req,res)=>res.json({success:true})]))});
const {createLocationPublicationStore,locationPublication,publishedLocations,publishedSchedule,publicacionUbicacionInput} = require('../src/modules/aulas/ubicacion.service');
const routes = require('../src/modules/aulas/aula.routes').default;
const directories=[];
let server;
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));for(const directory of directories)await fs.rm(directory,{recursive:true,force:true});});
const store = async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sgiac-ubicacion-'));directories.push(dir);return {dir,store:createLocationPublicationStore(dir)};};

test('la publicación es explícita, persistente y permite retirar cada portal',async()=>{
  const {dir,store:s}=await store();
  assert.deepEqual(await s.read(),{publico:false,estudiantes:false,actualizadoEn:null});
  await s.save({publico:true,estudiantes:false});
  assert.equal((await createLocationPublicationStore(dir).read()).publico,true);
  await s.save({publico:false,estudiantes:true});
  const saved=await s.read();assert.equal(saved.publico,false);assert.equal(saved.estudiantes,true);assert.ok(saved.actualizadoEn);
  assert.deepEqual((await fs.readdir(dir)),['publicacion.json']);
  assert.throws(()=>publicacionUbicacionInput.parse({publico:'false',estudiantes:true}),ZodError);
  assert.throws(()=>publicacionUbicacionInput.parse({publico:true,estudiantes:true,otro:true}),ZodError);
  await fs.writeFile(path.join(dir,'publicacion.json'),'invalid');
  await assert.rejects(s.read());
});
test('ubicación pública solo devuelve planos; estudiantes conservan horarios sin datos internos',async()=>{
  const {store:s}=await store();locationPublication.read=s.read;locationPublication.save=s.save;
  const previous=reads;
  assert.deepEqual(await publishedLocations('publico'),{publicado:false,aulas:[],periodos:[],horarios:[]});
  assert.equal(reads,previous);
  await s.save({publico:true,estudiantes:false});
  const data=await publishedLocations('publico');
  assert.equal(data.publicado,true);assert.deepEqual(data.horarios,[]);assert.deepEqual(data.periodos,[]);assert.equal(data.aulas[0].codigo,'SS-A1');
  assert.equal(data.aulas[0].capacidad,45);
  assert.equal(scheduleReads,0);assert.equal(periodReads,0);
  assert.equal(JSON.stringify(data).includes('PRIVATE'),false);
  assert.equal(publishedSchedule(schedule).motivo,'');
  assert.equal('reubicaciones' in publishedSchedule(schedule),false);
  assert.equal((await publishedLocations('estudiantes','student')).publicado,false);
  await s.save({publico:false,estudiantes:true});
  assert.equal((await publishedLocations('publico')).publicado,false);
  const student=await publishedLocations('estudiantes','student');
  assert.equal(student.aulas.length,1);assert.equal(student.horarios.length,1);
  assert.equal(JSON.stringify(student).includes('PRIVATE'),false);
});
test('rutas separadas: público sin sesión, estudiante autenticado y publicación con permiso de aulas',async()=>{
  const {store:s}=await store();locationPublication.read=s.read;locationPublication.save=s.save;
  const app=express();app.use(express.json());app.use('/aulas',routes);
  app.use((error,_req,res,_next)=>res.status(error.statusCode || (error instanceof ZodError ? 400 : 500)).json({message:error.message}));
  server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  const request=(route,role,method='GET',body)=>fetch(origin+'/aulas/ubicacion/'+route,{method,headers:{'Content-Type':'application/json',...(role?{Authorization:role}:{})},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await request('visibilidad')).status,200);
  assert.equal((await request('publico')).status,200);
  assert.equal((await request('estudiantes')).status,401);
  assert.equal((await request('config')).status,401);
  assert.equal((await request('config','student','PUT',{publico:true,estudiantes:true})).status,403);
  assert.equal((await request('config','admin','PUT',{publico:'true',estudiantes:false})).status,400);
  assert.equal((await request('config','admin','PUT',{publico:true,estudiantes:true})).status,200);
  assert.equal((await (await request('publico')).json()).data.publicado,true);
  assert.equal((await request('estudiantes')).status,401);
  assert.equal((await request('estudiantes','student')).status,200);
  await request('config','admin','PUT',{publico:false,estudiantes:false});
  const closed=(await (await request('publico')).json()).data;
  assert.equal(closed.publicado,false);assert.deepEqual(closed.aulas,[]);assert.deepEqual(closed.horarios,[]);
});
