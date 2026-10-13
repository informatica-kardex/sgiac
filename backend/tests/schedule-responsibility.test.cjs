// In-memory repository checks: no database connections or writes.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require.resolve('../dist/database/prisma');
const period={id_periodo:1n,estado:'ACTIVO',gestion:2026,periodo:'II',fecha_inicio:new Date('2026-07-01'),fecha_fin:new Date('2026-12-31')};
const assignment=(id,code='INF-111')=>({id_paralelo:BigInt(id),id_docente:1n,codigo_materia:code,nombre_paralelo:'A',id_periodo:1n,estado:'ACTIVO',docente:{nombre_completo:'Reynaldo Zeballos',grado_academico:'Ph.D.',estado:'ACTIVO'},materia:{nombre:code,siglas:[{sigla:code}],estado:'ACTIVO'},periodo_academico:period});
const assignments=[assignment(1),assignment(2,'INF-112'),assignment(3,'CPU')];
const block={id_bloque:1,hora_inicio:new Date('1970-01-01T10:00:00Z'),hora_fin:new Date('1970-01-01T12:00:00Z')};
const record=(id,a=1,extra={})=>({id_horario:BigInt(id),id_paralelo:BigInt(a),id_bloque:1,paralelo:assignments[a-1],bloque_horario:block,codigo_ambiente:'A1',ambiente:{estado:'DISPONIBLE',lugar:'LASIN',piso:null},dia_semana:'LUNES',estado:'ASIGNADO',fecha:null,motivo:null,id_auxiliar:null,es_auxiliar:false,auxiliar:null,sesion_compartida:null,...extra});
let rows=[],saved=[];
function matches(row,where){
  return Object.entries(where).every(([key,value])=>{
    if(key==='OR')return value.some(v=>matches(row,v));
    if(value&&typeof value==='object'&&!(value instanceof Date)){
      if('not' in value)return row[key]!==value.not;
      if('lt' in value||'gt' in value)return (!('lt' in value)||row[key]<value.lt)&&(!('gt' in value)||row[key]>value.gt);
      return matches(row[key],value);
    }
    return row[key]===value;
  });
}
const tx={
  $executeRaw:async()=>0,
  paralelo:{findUnique:async({where})=>assignments.find(a=>a.id_paralelo===where.id_paralelo)},
  ambiente:{findUnique:async()=>({estado:'DISPONIBLE'})},
  auxiliar_asignacion:{findUnique:async()=>({auxiliar:{estado:'ACTIVO'}})},
  bloque_horario:{findFirst:async()=>block},
  horario:{findUnique:async({where})=>rows.find(r=>r.id_horario===where.id_horario),findMany:async({where})=>rows.filter(r=>matches(r,where)),
    create:async({data})=>{saved.push(data);return record(100,Number(data.id_paralelo),data);},
    update:async({where,data})=>{saved.push(data);return record(where.id_horario,Number(data.id_paralelo),data);}},
};
require.cache[path]={id:path,filename:path,loaded:true,exports:{prisma:{$transaction:async fn=>fn(tx)}}};
const {HorarioRepository,mapHorario}=require('../dist/modules/horarios/horario.repository');
const repo=new HorarioRepository();
const input={idAsignacion:'1',aula:'A2',dia:'LUNES',horaInicio:'10:00',horaFin:'12:00'};
test('identifica grados, auxiliares pendientes y coordinación sin atribuir clases al titular',()=>{
  assert.equal(mapHorario(record(1)).responsable,'Ph.D. Reynaldo Zeballos');
  const pending=mapHorario(record(1,1,{es_auxiliar:true}));
  assert.equal(pending.responsable,'Auxiliar por designar');assert.equal(pending.esAuxiliar,true);
  const cpu=mapHorario(record(1,3));assert.equal(cpu.esCoordinacion,true);assert.equal(cpu.responsable,'Coord. Ph.D. Reynaldo Zeballos');
});
test('la coordinación CPU no bloquea la clase del docente, ni viceversa',async()=>{
  rows=[record(1,3)];saved=[];await repo.create(input);assert.equal(saved.length,1);
  rows=[record(1,1)];saved=[];await repo.create({...input,idAsignacion:'3'});assert.equal(saved.length,1);
});
test('CPU sí ocupa aula y paralelo; una clase docente común ocupa su agenda',async()=>{
  rows=[record(1,3)];saved=[];
  await assert.rejects(repo.create({...input,aula:'A1'}),e=>e.statusCode===409);
  await assert.rejects(repo.create({...input,idAsignacion:'3'}),e=>e.statusCode===409);
  rows=[record(1,2)];await assert.rejects(repo.create(input),e=>e.statusCode===409);
  assert.equal(saved.length,0);
});
test('auxiliar por designar conserva ocupación de aula y paralelo, sin ocupar agenda docente',async()=>{
  rows=[record(1,2,{es_auxiliar:true})];saved=[];
  await repo.create(input);assert.equal(saved.length,1);
  await assert.rejects(repo.create({...input,aula:'A1'}),e=>e.statusCode===409);
  await assert.rejects(repo.create({...input,idAsignacion:'2'}),e=>e.statusCode===409);
  rows=[record(1,2)];saved=[];
  const pending=await repo.create({...input,esAuxiliar:true});assert.equal(pending.esAuxiliar,true);assert.equal(pending.responsable,'Auxiliar por designar');
});
test('se puede conservar una sesión compartida verificada, pero no falsificarla para crear cruces',async()=>{
  rows=[record(1,1,{sesion_compartida:'pdf-compartida'}),record(2,1,{codigo_ambiente:'A2',sesion_compartida:'pdf-compartida'})];saved=[];
  const edited=await repo.update(1,{...input,aula:'A1'});assert.equal(edited.sesionCompartida,'pdf-compartida');
  await assert.rejects(repo.create({...input,aula:'A3',sesionCompartida:'pdf-compartida'}),e=>e.statusCode===409);
  await assert.rejects(repo.update(1,{...input,aula:'A1',horaInicio:'11:00'}),e=>e.statusCode===409);
});
test('un marcador compartido no permite superponer materias distintas',async()=>{
  rows=[record(1,1,{sesion_compartida:'importada'}),record(2,2,{sesion_compartida:'importada'})];saved=[];
  await assert.rejects(repo.update(1,{...input,aula:'A1'}),e=>e.statusCode===409);
  assert.equal(saved.length,0);
});
