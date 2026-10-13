const {test}=require('node:test');
const assert=require('node:assert/strict');
const {conciliar,hash}=require('../prisma/conciliar-horarios-manuales.cjs');
const source=require('../prisma/data/horarios-ii-2026.json');
const manual=require('../prisma/data/revision-horarios-ii-2026-fuentes.json');
function fixture(){
  const names=[...new Set(source.assignments.map(a=>a.docente))];
  const docente=names.map((nombre_completo,i)=>({id_docente:String(i+1),nombre_completo,grado_academico:null}));
  return {periodo_academico:[{id_periodo:'1',periodo:'II',gestion:2026,estado:'ACTIVO',fecha_inicio:'2026-07-01',fecha_fin:'2026-12-31'}],
    docente,materia:source.assignments.map(a=>({codigo_materia:a.codigoMateria})),
    paralelo:source.assignments.map((a,i)=>({id_paralelo:String(i+1),id_periodo:'1',codigo_materia:a.codigoMateria,nombre_paralelo:a.grupo,id_docente:docente.find(d=>d.nombre_completo===a.docente).id_docente})),
    ambiente:[...new Set(manual.celdas.map(c=>c.aula))].map(codigo_ambiente=>({codigo_ambiente,estado:'DISPONIBLE'})),horario:[],bloque_horario:[]};
}
function simulate(db,plan){
  const after=structuredClone(db);
  for(const g of plan.grados)after.docente.find(d=>d.id_docente===g.idDocente).grado_academico=g.despues;
  for(const c of plan.cambiosDocentes)after.paralelo.find(p=>p.id_paralelo===c.idAsignacion).id_docente=c.despues;
  for(const r of plan.retiros)Object.assign(after.horario.find(h=>h.id_horario===r.id),{estado:'CANCELADO',publicado:false,sesion_compartida:null,motivo:r.motivo});
  if(plan.cpu){after.materia.push({codigo_materia:'CPU'});after.paralelo.push({id_paralelo:'9000',codigo_materia:'CPU',nombre_paralelo:'SIN PARALELO',id_docente:plan.cpu.idDocente,id_periodo:'1'});}
  for(const [i,p] of plan.propuestas.entries()){
    const s=p.despues;
    let b=after.bloque_horario.find(b=>b.hora_inicio.slice(11,16)===s.horaInicio&&b.hora_fin.slice(11,16)===s.horaFin);
    if(!b){b={id_bloque:after.bloque_horario.length+1,hora_inicio:`1970-01-01T${s.horaInicio}:00.000Z`,hora_fin:`1970-01-01T${s.horaFin}:00.000Z`};after.bloque_horario.push(b);}
    const row={id_horario:p.id??String(10000+i),id_paralelo:s.idAsignacion??'9000',codigo_ambiente:s.aula,dia_semana:s.dia,id_bloque:b.id_bloque,estado:'ASIGNADO',fecha:null,id_auxiliar:s.idAuxiliar,es_auxiliar:s.esAuxiliar,sesion_compartida:s.sesionCompartida};
    if(p.id)Object.assign(after.horario.find(h=>h.id_horario===p.id),row);else after.horario.push(row);
  }
  return after;
}
test('incluye LASIN, AUX pendientes, C.P.U. y las clases compartidas sin inventar personas',()=>{
  const db=fixture(),plan=conciliar(db,{incluirCpu:true});
  assert.equal(plan.grados.length,79);
  assert.equal(plan.cpu.docente,'REYNALDO JAVIER ZEBALLOS DAZA');
  const rows=plan.propuestas.map(p=>p.despues);
  assert.equal(rows.filter(h=>h.key==='CPU|SIN PARALELO').length,8);
  assert.ok(rows.filter(h=>h.aula.startsWith('LASIN')).length>=40);
  assert.ok(rows.some(h=>h.esAuxiliar&&h.aula==='LASIN-2'&&h.key==='INF-113|C'));
  assert.ok(rows.filter(h=>h.esAuxiliar).every(h=>h.idAuxiliar===null));
  const shared=rows.filter(h=>h.key==='INF-113|C'&&h.dia==='LUNES');
  assert.deepEqual(shared.map(h=>h.aula),['LASIN-1','LASIN-2']);
  assert.ok(shared[0].sesionCompartida&&shared[0].sesionCompartida===shared[1].sesionCompartida);
  assert.equal(plan.grados.find(p=>p.nombre.includes('BORIS')).despues,'Ing.');
  assert.ok(!plan.pendientes.some(p=>p.tipo==='grado'&&p.nombre.includes('BORIS')));
  assert.ok(!rows.some(h=>['TIC-251|A','INF-263|A'].includes(h.key)),'No acepta materias distintas como clase compartida');
  assert.ok(plan.pendientes.some(p=>p.texto==='AUX INF - 251'));
  const again=conciliar(simulate(db,plan),{incluirCpu:true});
  assert.equal(again.propuestas.length,0,'La carga no se duplica al repetirla');
  assert.equal(again.grados.length,0);
  assert.equal(again.cambiosDocentes.length,0);
});
test('retira de forma reversible un cruce importado y conserva la evidencia y las demás sesiones',()=>{
  const db=fixture();
  db.bloque_horario.push({id_bloque:1,hora_inicio:'1970-01-01T10:00:00.000Z',hora_fin:'1970-01-01T12:00:00.000Z'});
  const token=hash(['PDF-II-2026','INF-263|A+TIC-251|A','MARTES','10:00','12:00',false]).slice(0,48);
  for(const [i,code] of ['TIC-251','INF-263'].entries())db.horario.push({id_horario:String(i+1),id_paralelo:db.paralelo.find(p=>p.codigo_materia===code).id_paralelo,dia_semana:'MARTES',codigo_ambiente:'LASIN-2',id_bloque:1,estado:'ASIGNADO',fecha:null,id_auxiliar:null,es_auxiliar:false,sesion_compartida:token});
  const plan=conciliar(db,{incluirCpu:true});
  assert.deepEqual(plan.retiros.map(r=>r.id),['1','2']);
  const after=simulate(db,plan);
  assert.ok(after.horario.filter(h=>['1','2'].includes(h.id_horario)).every(h=>h.estado==='CANCELADO'&&h.motivo));
  const again=conciliar(after,{incluirCpu:true});
  assert.equal(again.retiros.length,0);assert.equal(again.propuestas.length,0);
  db.horario[0].codigo_ambiente='OTRA-AULA';
  assert.ok(!conciliar(db,{incluirCpu:true}).retiros.some(r=>r.id==='1'),'No retira ediciones ajenas a la fuente importada');
});
test('un auxiliar sin designar ocupa aula y paralelo, sin ocupar la agenda del titular',()=>{
  const db=fixture();
  const assignment=db.paralelo.find(p=>p.codigo_materia==='INF-113'&&p.nombre_paralelo==='C');
  db.bloque_horario.push({id_bloque:1,hora_inicio:'1970-01-01T10:00:00.000Z',hora_fin:'1970-01-01T12:00:00.000Z'});
  db.horario.push({id_horario:'1',id_paralelo:assignment.id_paralelo,dia_semana:'VIERNES',codigo_ambiente:'LASIN-2',id_bloque:1,estado:'ASIGNADO',fecha:null,es_auxiliar:true,id_auxiliar:null,sesion_compartida:null});
  const plan=conciliar(db,{incluirCpu:true});
  assert.equal(plan.propuestas.filter(p=>p.despues.key==='INF-113|C'&&p.despues.dia==='VIERNES'&&p.despues.aula==='LASIN-2').length,0,'Reconoce la auxiliaría que ya existe');
});
