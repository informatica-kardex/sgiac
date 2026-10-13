const { createHash } = require('node:crypto');
const fuente = require('./data/revision-horarios-ii-2026-fuentes.json');
const original = require('./data/horarios-ii-2026.json');
const confirmaciones = require('./data/revision-horarios-ii-2026-confirmaciones.json');
const codigos = require('./data/aulas-kardex.json').codigosAnterioresHorarios;
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const gradoPattern = /\b(P\.Ph\.D\.?|Ph\.D\.?|M\.Sc\.?|MGr\.|Lic\.|Ing\.|Dra?\.)\s+(.+)$/i;
const mismaHora = (a,b) => a.dia === b.dia && a.horaInicio === b.horaInicio && a.horaFin === b.horaFin;
const traslapa = (a,b) => a.dia === b.dia && a.horaInicio < b.horaFin && a.horaFin > b.horaInicio;

function conciliar(db, { incluirCpu = false } = {}) {
  const periodo = db.periodo_academico.find(p => p.periodo === 'II' && p.gestion === 2026);
  if (!periodo || periodo.estado !== 'ACTIVO') throw Error('II/2026 debe existir y estar activo.');
  const pendientes = [], sesiones = [], evidenciaGrados = new Map();
  const asignaciones = original.assignments.map(a => ({ ...a,
    idDocente: db.docente.find(d=>norm(d.nombre_completo)===norm(a.docente))?.id_docente,
    idAsignacion: db.paralelo.find(p=>p.id_periodo===periodo.id_periodo&&p.codigo_materia===a.codigoMateria&&p.nombre_paralelo===a.grupo)?.id_paralelo,
  }));
  if (incluirCpu) {
    const docente = db.docente.find(d=>norm(d.nombre_completo)==='REYNALDO JAVIER ZEBALLOS DAZA');
    if (!docente) throw Error('No se identifica a Reynaldo Zeballos.');
    const p = db.paralelo.find(p=>p.codigo_materia==='CPU'&&p.id_periodo===periodo.id_periodo);
    asignaciones.push({key:'CPU|SIN PARALELO',codigoMateria:'CPU',materia:'Curso Preuniversitario',grupo:'SIN PARALELO',docente:docente.nombre_completo,idDocente:docente.id_docente,idAsignacion:p?.id_paralelo,siglas:['C.P.U.'],fuentes:[],sesiones:[]});
  }
  for (const celda of fuente.celdas) {
    const c = {...celda};
    // Require a whole parallel token: the L of Lic. is not parallel L.
    c.refs = [...norm(c.texto).matchAll(/([A-Z]{3})\s*-\s*(\d{3})(?:\s+([A-Z]{1,2}(?:\s*,\s*[A-Z]{1,2})*)(?=\s|\/|$))?/g)].flatMap(m=>(m[3]?.split(/\s*,\s*/)??[null]).map(grupo=>({sigla:`${m[1]}-${m[2]}`,grupo})));
    const grado = c.texto.match(gradoPattern);
    const tokens = grado ? norm(grado[2]).split(' ') : [];
    const personas = tokens.length ? db.docente.filter(d=>tokens.every(t=>norm(d.nombre_completo).split(' ').includes(t))) : [];
    const docente = personas.length === 1 ? personas[0] : null;
    if (docente && grado) {
      const literal = grado[1].endsWith('.') ? grado[1] : grado[1]+'.';
      const evidencias = evidenciaGrados.get(docente.id_docente) ?? [];
      evidencias.push({grado:literal,pagina:c.pagina,texto:c.texto}); evidenciaGrados.set(docente.id_docente,evidencias);
    }
    if (!c.refs.length && !c.texto.startsWith('C.P.U.')) {
      pendientes.push({tipo:'anotacion',motivo:'No identifica una clase',...c}); continue;
    }
    let matches = asignaciones.filter(a=>c.refs.some(r=>a.siglas.includes(r.sigla)&&(!r.grupo||r.grupo===a.grupo)));
    if (c.texto.startsWith('C.P.U.')) matches = incluirCpu ? asignaciones.filter(a=>a.codigoMateria==='CPU') : [];
    if (docente) matches = matches.filter(a=>a.idDocente===docente.id_docente);
    // Without a parallel, use corroboration from the inscription PDF.
    if (c.refs.some(r=>!r.grupo) && matches.length > 1) matches = matches.filter(a=>a.fuentes.some(f=>f.horarios.some(h=>h.dias.includes(c.dia)&&h.horaInicio===c.horaInicio&&h.horaFin===c.horaFin&&h.aulas.some(aula=>(codigos[aula]??aula)===c.aula))));
    if (!matches.length || (!c.auxiliar && (!docente || new Set(matches.map(a=>a.idDocente)).size>1))) {
      pendientes.push({tipo:'identidad',motivo:'Falta identificar de forma única la materia, el paralelo o el responsable',...c}); continue;
    }
    if (!db.ambiente.some(a=>a.codigo_ambiente===c.aula&&a.estado==='DISPONIBLE')) {
      pendientes.push({tipo:'aula',motivo:'Aula ausente o no habilitada',...c}); continue;
    }
    const grupoFuente = matches.map(a=>a.key).sort().join('+');
    for (const a of matches) {
      if (!a.idDocente || (!a.idAsignacion && a.codigoMateria!=='CPU')) throw Error(`Asignación inexistente: ${a.key}`);
      sesiones.push({ key:a.key, idAsignacion:a.idAsignacion, idDocente:a.idDocente, aula:c.aula, dia:c.dia,
        horaInicio:c.horaInicio,horaFin:c.horaFin,esAuxiliar:c.auxiliar,idAuxiliar:null,
        grupoFuente, pagina:c.pagina, texto:c.texto, periodoRotulo:c.periodo });
    }
  }
  // Consecutive cells are a single class only when every academic identity agrees.
  const merged = [];
  for (const s of sesiones.sort((a,b)=>a.aula.localeCompare(b.aula)||a.dia.localeCompare(b.dia)||a.key.localeCompare(b.key)||a.horaInicio.localeCompare(b.horaInicio))) {
    const prev = merged[merged.length-1];
    if (prev && prev.aula===s.aula&&prev.dia===s.dia&&prev.key===s.key&&prev.esAuxiliar===s.esAuxiliar&&prev.grupoFuente===s.grupoFuente&&prev.horaFin===s.horaInicio) prev.horaFin=s.horaFin;
    else merged.push({...s});
  }
  for (const s of merged) {
    const partners = merged.filter(t=>mismaHora(s,t)&&s.grupoFuente===t.grupoFuente&&s.esAuxiliar===t.esAuxiliar);
    s.sesionCompartida = partners.length>1 ? hash(['PDF-II-2026',s.grupoFuente,s.dia,s.horaInicio,s.horaFin,s.esAuxiliar]).slice(0,48) : null;
  }
  // A slash in the manual PDF is not evidence that two different subjects
  // may occupy the same room or teacher. Keep catalogue identities separate.
  const compartidas = (a,b) => a.key.split('|')[0]===b.key.split('|')[0] && a.sesionCompartida && a.sesionCompartida===b.sesionCompartida && mismaHora(a,b) && a.esAuxiliar===b.esAuxiliar;
  // C.P.U.'s assigned teacher is its coordinator (confirmed by the user),
  // so only its classrooms/parallel are occupied, not a teaching agenda.
  const choque = (a,b) => traslapa(a,b) && !compartidas(a,b) && (a.aula===b.aula || a.key===b.key ||
    (!a.esAuxiliar&&!b.esAuxiliar&&!a.key.startsWith('CPU|')&&!b.key.startsWith('CPU|')&&a.idDocente===b.idDocente));
  const conflictosFuente = new Set();
  for(let i=0;i<merged.length;i++) for(let j=i+1;j<merged.length;j++) if(choque(merged[i],merged[j])) {
    conflictosFuente.add(merged[i]);conflictosFuente.add(merged[j]);
    pendientes.push({tipo:'cruce-pdf',motivo:'Dos clases distintas se superponen en el PDF manual',a:merged[i],b:merged[j]});
  }
  const candidatos = merged.filter(s=>!conflictosFuente.has(s));
  const existentes = db.horario.filter(h=>h.estado==='ASIGNADO').map(h=>{
    const p=db.paralelo.find(p=>p.id_paralelo===h.id_paralelo),b=db.bloque_horario.find(b=>b.id_bloque===h.id_bloque);
    return {id:h.id_horario,idAsignacion:p.id_paralelo,key:`${p.codigo_materia}|${p.nombre_paralelo}`,idDocente:p.id_docente,aula:h.codigo_ambiente,dia:h.dia_semana,horaInicio:b.hora_inicio.slice(11,16),horaFin:b.hora_fin.slice(11,16),esAuxiliar:Boolean(h.es_auxiliar||h.id_auxiliar),idAuxiliar:h.id_auxiliar,sesionCompartida:h.sesion_compartida??null,fecha:h.fecha,idPeriodo:p.id_periodo};
  });
  // Reversibly withdraw only imported shared rows that exactly match the
  // conflicting source evidence. Never cancel unrelated administrator edits.
  const retiros = existentes.filter(h=>h.idPeriodo===periodo.id_periodo&&!h.fecha&&!h.idAuxiliar&&h.sesionCompartida&&
    merged.some(s=>conflictosFuente.has(s)&&s.key===h.key&&s.aula===h.aula&&mismaHora(s,h)&&s.esAuxiliar===h.esAuxiliar&&s.sesionCompartida===h.sesionCompartida)&&
    existentes.some(t=>t.id!==h.id&&t.sesionCompartida===h.sesionCompartida&&t.key.split('|')[0]!==h.key.split('|')[0]&&traslapa(h,t)))
    .map(h=>({id:h.id,antes:h,motivo:'Carga retirada: cruce entre materias distintas en los PDF; horario correcto pendiente de confirmar (revisión Excel 12/10/2026).'}));
  const anteriores = existentes.filter(h=>!retiros.some(r=>r.id===h.id));
  const cambiosDocentes = asignaciones.filter(a=>a.idAsignacion&&db.paralelo.find(p=>p.id_paralelo===a.idAsignacion).id_docente!==a.idDocente&&candidatos.some(s=>s.key===a.key&&!s.esAuxiliar)).map(a=>({idAsignacion:a.idAsignacion,antes:db.paralelo.find(p=>p.id_paralelo===a.idAsignacion).id_docente,despues:a.idDocente,key:a.key,nombre:a.docente}));
  for(const h of anteriores) {const cambio=cambiosDocentes.find(c=>c.idAsignacion===h.idAsignacion);if(cambio)h.idDocente=cambio.despues;}
  const altas=[], cambios=[], usados=new Set();
  for (const s of candidatos) {
    const elegibles = anteriores.filter(h=>h.idPeriodo===periodo.id_periodo&&!h.fecha&&h.key===s.key&&h.dia===s.dia&&!usados.has(h.id));
    let actual = elegibles.find(h=>mismaHora(h,s)&&h.aula===s.aula&&h.esAuxiliar===s.esAuxiliar);
    if (!actual) actual = elegibles.find(h=>traslapa(h,s)&&!h.idAuxiliar && !candidatos.some(t=>t!==s&&t.key===h.key&&mismaHora(h,t)&&h.aula===t.aula&&h.esAuxiliar===t.esAuxiliar));
    if (!actual && !s.esAuxiliar && cambiosDocentes.some(c=>c.idAsignacion===s.idAsignacion)) {
      const a=asignaciones.find(a=>a.key===s.key);
      // Correct the old demonstration session only when correcting its wrong
      // teacher and neither PDF supports that original time and classroom.
      const incorrectas=anteriores.filter(h=>h.idAsignacion===s.idAsignacion&&!h.fecha&&!h.idAuxiliar&&!h.esAuxiliar&&!usados.has(h.id)&&
        !candidatos.some(t=>t.key===h.key&&mismaHora(h,t)&&h.aula===t.aula)&&
        !a.fuentes.some(f=>f.horarios.some(t=>t.dias.includes(h.dia)&&t.horaInicio===h.horaInicio&&t.horaFin===h.horaFin&&t.aulas.some(room=>(codigos[room]??room)===h.aula))));
      if(incorrectas.length===1)actual=incorrectas[0];
    }
    if (actual) {
      usados.add(actual.id);
      // Preserve a known assistant on an otherwise identical assistant session.
      s.idAuxiliar = s.esAuxiliar&&actual.esAuxiliar ? actual.idAuxiliar : null;
      const igual = ['aula','dia','horaInicio','horaFin','esAuxiliar','idAuxiliar','sesionCompartida'].every(k=>actual[k]===s[k]);
      if (!igual) cambios.push({id:actual.id,antes:actual,despues:s});
    } else altas.push(s);
  }
  let propuestas = [...altas.map(s=>({tipo:'alta',despues:s})),...cambios.map(c=>({tipo:'cambio',...c}))];
  // Check the final state, not a transient ordering of room moves. If one move
  // is blocked, restore its old slot and re-check the remaining proposals.
  let changed=true;
  while(changed) {
    changed=false;
    const estado = anteriores.map(h=>({...h,...propuestas.find(p=>p.id===h.id)?.despues})).concat(propuestas.filter(p=>p.tipo==='alta').map(p=>p.despues));
    const reject=new Set();
    for(const p of propuestas) for(const h of estado) {
      if(p.id&&h.id===p.id || h===p.despues)continue;
      if(h.fecha && (h.fecha.slice(0,10)<periodo.fecha_inicio.slice(0,10)||h.fecha.slice(0,10)>periodo.fecha_fin.slice(0,10)))continue;
      if(choque(p.despues,h)) { reject.add(p);pendientes.push({tipo:'cruce-bd',motivo:'Cruce con otra sesión conservada',propuesta:p.despues,actual:h}); }
    }
    if(reject.size){propuestas=propuestas.filter(p=>!reject.has(p));changed=true;}
  }
  const grados=[];
  for(const [idDocente,evidencia] of evidenciaGrados) {
    const values=[...new Set(evidencia.map(e=>e.grado))],actual=db.docente.find(d=>d.id_docente===idDocente);
    const confirmado=confirmaciones.grados.find(g=>norm(g.nombre)===norm(actual.nombre_completo));
    if(confirmado){
      if(actual.grado_academico!==confirmado.grado)grados.push({idDocente,nombre:actual.nombre_completo,antes:actual.grado_academico,despues:confirmado.grado,evidencia,confirmacion:confirmado.evidencia});
      continue;
    }
    if(values.length!==1) {pendientes.push({tipo:'grado',motivo:'El PDF atribuye grados distintos al mismo docente',idDocente,nombre:actual.nombre_completo,evidencia});continue;}
    if(actual.grado_academico!==values[0])grados.push({idDocente,nombre:actual.nombre_completo,antes:actual.grado_academico,despues:values[0],evidencia});
  }
  return { fuentes:fuente.fuentes, idPeriodo:periodo.id_periodo,incluirCpu,grados,cambiosDocentes,propuestas,retiros,pendientes,
    cpu:incluirCpu&&!db.materia.some(m=>m.codigo_materia==='CPU')?asignaciones.find(a=>a.codigoMateria==='CPU'):null,
    resumen:{celdasPDF:fuente.celdas.length,grados:grados.length,docentesCorregidos:cambiosDocentes.length,altas:propuestas.filter(p=>p.tipo==='alta').length,cambios:propuestas.filter(p=>p.tipo==='cambio').length,altasAuxiliares:propuestas.filter(p=>p.tipo==='alta'&&p.despues.esAuxiliar).length,pendientes:pendientes.length,
      retiros:retiros.length,lasin:propuestas.filter(p=>p.despues.aula.startsWith('LASIN')).length} };
}
module.exports = { conciliar, norm, hash };
if(require.main===module){
  const fs=require('node:fs'),path=require('node:path');
  const db=JSON.parse(fs.readFileSync(path.resolve('.preview-academico/revision-2026/actual.json'),'utf8'));
  const result=conciliar(db,{incluirCpu:process.argv.includes('--cpu')});
  fs.writeFileSync(path.resolve('.preview-academico/revision-2026/plan.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result.resumen,null,2));
  console.log('Pendientes:',JSON.stringify(result.pendientes,null,2));
}
