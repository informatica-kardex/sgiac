// Dry run by default. Applies only a reviewed fingerprint inside the same lock
// used by academic writes; keeps a complete local backup before changing data.
const fs = require('node:fs');
const path = require('node:path');
const { prisma } = require('../dist/database/prisma');
const { conciliar, hash } = require('./conciliar-horarios-manuales.cjs');
const source = require('./data/revision-horarios-ii-2026-fuentes.json');
const pensums = require('./data/revision-pensums-ii-2026.json');
const { createHash } = require('node:crypto');
const { compartenFecha } = require('../dist/modules/horarios/horario.fechas');
const serial = data => JSON.parse(JSON.stringify(data,(_,v)=>typeof v==='bigint'?String(v):v));
const tables = {periodo_academico:'id_periodo',materia:'codigo_materia',materia_sigla:['codigo_materia','sigla'],docente:'id_docente',ambiente:'codigo_ambiente',paralelo:'id_paralelo',bloque_horario:'id_bloque',horario:'id_horario',auxiliar:'id_auxiliar',auxiliar_asignacion:['id_auxiliar','id_paralelo']};
async function snapshot(tx) {
  const result={};
  for(const [table,keys] of Object.entries(tables))result[table]=serial(await tx[table].findMany({orderBy:[keys].flat().map(k=>({[k]:'asc'}))}));
  return result;
}
function comprobarCruces(db, ids, docentesCambiados) {
  const rows=db.horario.filter(h=>h.estado==='ASIGNADO').map(h=>{
    const p=db.paralelo.find(p=>p.id_paralelo===h.id_paralelo),period=db.periodo_academico.find(t=>t.id_periodo===p.id_periodo),b=db.bloque_horario.find(b=>b.id_bloque===h.id_bloque);
    return {...h,p,period,b,aux:Boolean(h.es_auxiliar||h.id_auxiliar)};
  }).filter(h=>h.period.estado==='ACTIVO');
  for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
    const a=rows[i],b=rows[j];
    if(!ids.includes(a.id_horario)&&!ids.includes(b.id_horario)&&!docentesCambiados.includes(a.id_paralelo)&&!docentesCambiados.includes(b.id_paralelo))continue;
    if(a.dia_semana!==b.dia_semana||a.b.hora_inicio>=b.b.hora_fin||a.b.hora_fin<=b.b.hora_inicio)continue;
    if(!compartenFecha({fecha:a.fecha?new Date(a.fecha):null,inicio:new Date(a.period.fecha_inicio),fin:new Date(a.period.fecha_fin),dia:a.dia_semana},{fecha:b.fecha?new Date(b.fecha):null,inicio:new Date(b.period.fecha_inicio),fin:new Date(b.period.fecha_fin),dia:b.dia_semana}))continue;
    const compartida=a.p.codigo_materia===b.p.codigo_materia&&a.sesion_compartida&&a.sesion_compartida===b.sesion_compartida&&a.b.hora_inicio===b.b.hora_inicio&&a.b.hora_fin===b.b.hora_fin&&a.fecha===b.fecha&&a.aux===b.aux&&a.id_auxiliar===b.id_auxiliar&&(a.aux||a.p.id_docente===b.p.id_docente);
    if(compartida)continue;
    const responsable=a.aux&&b.aux?a.id_auxiliar&&a.id_auxiliar===b.id_auxiliar:!a.aux&&!b.aux&&a.p.codigo_materia!=='CPU'&&b.p.codigo_materia!=='CPU'&&a.p.id_docente===b.p.id_docente;
    if(a.codigo_ambiente===b.codigo_ambiente||a.id_paralelo===b.id_paralelo||responsable)throw Error(`Cruce no resuelto entre ${a.id_horario} y ${b.id_horario}; se revierte la carga.`);
  }
}
async function main() {
  for(const f of source.fuentes)if(createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../../referencias',f.archivo))).digest('hex')!==f.sha256)throw Error('Cambió la fuente '+f.archivo);
  for(const f of pensums.archivos)if(createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../../referencias',f.ruta))).digest('hex')!==f.sha256)throw Error('Cambió el Excel '+f.archivo+'; revisa nuevamente los cruces.');
  const aplicar=process.argv.includes('--apply'),incluirCpu=process.argv.includes('--cpu');
  const expected=process.argv.find(a=>a.startsWith('--expected-current-sha='))?.split('=')[1];
  if(aplicar&&!expected)throw Error('Falta --expected-current-sha de la vista previa.');
  const result=await prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(20260930, 1)`;
    const before=await snapshot(tx),huella=hash(before),plan=conciliar(before,{incluirCpu});
    if(aplicar&&expected!==huella)throw Error('Los datos cambiaron desde la revisión. Genera otra vista previa.');
    let respaldo=null;
    if(aplicar){
      const folder=path.join(__dirname,'backups');fs.mkdirSync(folder,{recursive:true});
      respaldo=path.join(folder,`antes-revision-manual-${new Date().toISOString().replace(/[:.]/g,'-')}.json`);
      fs.writeFileSync(respaldo,JSON.stringify(before,null,2),{flag:'wx'});
      for(const g of plan.grados)await tx.docente.update({where:{id_docente:BigInt(g.idDocente)},data:{grado_academico:g.despues}});
      for(const c of plan.cambiosDocentes)await tx.paralelo.update({where:{id_paralelo:BigInt(c.idAsignacion)},data:{id_docente:BigInt(c.despues)}});
      let cpuId;
      if(plan.cpu){
        await tx.materia.create({data:{codigo_materia:'CPU',nombre:'Curso Preuniversitario',siglas:{create:{sigla:'C.P.U.'}}}});
        const cpu=await tx.paralelo.create({data:{codigo_materia:'CPU',nombre_paralelo:'SIN PARALELO',id_docente:BigInt(plan.cpu.idDocente),id_periodo:BigInt(plan.idPeriodo)}});
        cpuId=cpu.id_paralelo;
      }
      let next=Math.max(0,...before.bloque_horario.map(b=>b.id_bloque));
      const bloques=[...before.bloque_horario];
      const changedIds=[];
      for(const r of plan.retiros)await tx.horario.update({where:{id_horario:BigInt(r.id)},data:{estado:'CANCELADO',publicado:false,sesion_compartida:null,motivo:r.motivo}});
      for(const p of plan.propuestas){
        const s=p.despues;
        let bloque=bloques.find(b=>b.hora_inicio.slice(11,16)===s.horaInicio&&b.hora_fin.slice(11,16)===s.horaFin);
        if(!bloque){
          bloque=serial(await tx.bloque_horario.create({data:{id_bloque:++next,hora_inicio:new Date(`1970-01-01T${s.horaInicio}:00.000Z`),hora_fin:new Date(`1970-01-01T${s.horaFin}:00.000Z`)}}));bloques.push(bloque);
        }
        const data={id_paralelo:s.idAsignacion?BigInt(s.idAsignacion):cpuId,codigo_ambiente:s.aula,dia_semana:s.dia,id_bloque:bloque.id_bloque,
          es_auxiliar:s.esAuxiliar,id_auxiliar:s.idAuxiliar?BigInt(s.idAuxiliar):null,sesion_compartida:s.sesionCompartida,fecha:null,estado:'ASIGNADO',publicado:true};
        const saved=p.tipo==='cambio'?await tx.horario.update({where:{id_horario:BigInt(p.id)},data}):await tx.horario.create({data});
        changedIds.push(String(saved.id_horario));
      }
      const after=await snapshot(tx);
      comprobarCruces(after,after.horario.map(h=>h.id_horario),plan.cambiosDocentes.map(c=>c.idAsignacion));
      // Only the explicitly listed fields/records may change.
      for(const [table,keys] of Object.entries(tables))for(const row of before[table]){
        const found=after[table].find(x=>[keys].flat().every(k=>x[k]===row[k]));
        if(!found)throw Error(`Se perdió un registro de ${table}; se revierte la carga.`);
        const expectedRow={...row};
        if(table==='docente'){const g=plan.grados.find(g=>g.idDocente===row.id_docente);if(g)expectedRow.grado_academico=g.despues;}
        if(table==='paralelo'){const c=plan.cambiosDocentes.find(c=>c.idAsignacion===row.id_paralelo);if(c)expectedRow.id_docente=c.despues;}
        if(table==='horario'){const r=plan.retiros.find(r=>r.id===row.id_horario);if(r)Object.assign(expectedRow,{estado:'CANCELADO',publicado:false,sesion_compartida:null,motivo:r.motivo});}
        if(table==='horario'&&changedIds.includes(row.id_horario))continue;
        if(hash(expectedRow)!==hash(found))throw Error(`Cambió un registro protegido de ${table}; se revierte la carga.`);
      }
      const again=conciliar(after,{incluirCpu});
      if(again.propuestas.length||again.retiros.length||again.grados.length||again.cambiosDocentes.length)throw Error('La carga no es idempotente; se revierte para revisar.');
      plan.verificacion={idempotente:true,registrosPreviosConservados:true,horariosTotales:after.horario.length,auxiliarias:after.horario.filter(h=>h.es_auxiliar||h.id_auxiliar).length,
        horariosActivos:after.horario.filter(h=>h.estado==='ASIGNADO').length,
        lasin:Object.fromEntries(['LASIN-1','LASIN-2','LASIN-3'].map(a=>[a,after.horario.filter(h=>h.codigo_ambiente===a&&h.estado==='ASIGNADO').length]))};
    }
    return {modo:aplicar?'APLICADO':'VISTA PREVIA',huella,respaldo,...plan};
  },{timeout:120000,maxWait:15000});
  const file=path.join(__dirname,'data',aplicar?'resultado-revision-horarios-ii-2026.json':'vista-previa-revision-horarios-ii-2026.json');
  fs.writeFileSync(file,JSON.stringify(result,null,2));
  console.log(JSON.stringify({modo:result.modo,huella:result.huella,respaldo:result.respaldo,...result.resumen,verificacion:result.verificacion,informe:file},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
