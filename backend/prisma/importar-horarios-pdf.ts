import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '../src/database/prisma';

type Sesion = { dia: string; horaInicio: string; horaFin: string; aula: string };
type Asignacion = { key: string; codigoMateria: string; materia: string; docente: string; grupo: string; sesiones: Sesion[];
  fuentes: { docente: string; horarios: { dias: string[]; horaInicio: string; horaFin: string; aulas: string[] }[] }[] };
type Datos = { version: number; fuente: { archivo: string; sha256: string }; apoyo: { archivo: string; sha256: string };
  assignments: Asignacion[]; pending: unknown[]; excluded: unknown[] };
const datos: Datos = JSON.parse(readFileSync(join(__dirname, 'data/horarios-ii-2026.json'), 'utf8'));
const catalogo: { aulas: { codigo: string; nombre: string; lugar: string; piso: number | null; tipo: string }[] } = JSON.parse(readFileSync(join(__dirname,'data/catalogo-pdf.json'),'utf8'));
const correcciones: Record<string, string> = JSON.parse(readFileSync(join(__dirname, 'data/aulas-kardex.json'), 'utf8')).codigosAnterioresHorarios;
const normal = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const json = (v: unknown) => JSON.stringify(v, (_, x) => typeof x === 'bigint' ? String(x) : x, 2);
const hash = (v: unknown) => createHash('sha256').update(json(v)).digest('hex');
const hh = (d: Date) => d.toISOString().slice(11, 16);
const bloqueFecha = (s: string) => new Date(`1970-01-01T${s}:00.000Z`);
const key = (codigo: string, grupo: string) => `${codigo}|${grupo}`;
type Ocupacion = Sesion & { grupo: string; docente: string; auxiliar: boolean; existente?: string };
const coincide = (a: Ocupacion, b: Ocupacion) => a.dia === b.dia && a.horaInicio < b.horaFin && a.horaFin > b.horaInicio &&
  (a.aula === b.aula || a.grupo === b.grupo || (!a.auxiliar && !b.auxiliar && a.docente === b.docente));

function validarFuente() {
  if (datos.version !== 1) throw Error('Versión de datos no admitida.');
  for (const fuente of [datos.fuente, datos.apoyo]) {
    const sha = createHash('sha256').update(readFileSync(join(__dirname, '../../referencias', fuente.archivo))).digest('hex');
    if (sha !== fuente.sha256) throw Error(`Cambió el PDF ${fuente.archivo}; vuelve a conciliarlo antes de cargar.`);
  }
  const ocupaciones: Ocupacion[] = [], claves = new Set<string>();
  for (const a of datos.assignments) {
    if (claves.has(a.key) || a.key !== key(a.codigoMateria, a.grupo)) throw Error(`Asignación duplicada o inválida: ${a.key}`);
    claves.add(a.key);
    if (!a.docente || normal(a.docente) === 'SIN DOCENTE' || !a.fuentes.some(f => f.docente === a.docente)) throw Error(`Docente sin respaldo en el original: ${a.key}`);
    if (a.sesiones.length > 2) throw Error(`Revisar sesiones adicionales: ${a.key}`);
    for (const s of a.sesiones) {
      if (!['LUNES','MARTES','MIERCOLES','JUEVES','VIERNES','SABADO'].includes(s.dia) ||
        !/^\d{2}:\d{2}$/.test(s.horaInicio) || !/^\d{2}:\d{2}$/.test(s.horaFin) || s.horaInicio < '07:00' || s.horaFin > '22:00' || s.horaInicio >= s.horaFin) throw Error(`Intervalo inválido: ${a.key}`);
      if (!a.fuentes.some(f => f.horarios.some(h => h.dias.includes(s.dia) && h.horaInicio === s.horaInicio && h.horaFin === s.horaFin && h.aulas.length === 1 && h.aulas[0] === s.aula))) throw Error(`Horario sin respaldo inequívoco en el original: ${a.key}`);
      const o = { ...s, grupo: a.key, docente: normal(a.docente), auxiliar: false };
      if (ocupaciones.some(h => coincide(h, o))) throw Error(`Cruce no conciliado: ${a.key} ${s.dia} ${s.horaInicio}`);
      ocupaciones.push(o);
    }
  }
}

async function main() {
  validarFuente();
  // Validar primero contra el original y traducir solo los códigos que se guardan.
  for (const a of datos.assignments) for (const s of a.sesiones) s.aula = correcciones[s.aula] ?? s.aula;
  catalogo.aulas = catalogo.aulas.map(a => correcciones[a.codigo] ? { ...a, codigo: correcciones[a.codigo], nombre: correcciones[a.codigo] } : a);
  const aplicar = process.argv.includes('--apply'), reemplazar = process.argv.includes('--replace-ii-2026');
  const esperado = process.argv.find(a => a.startsWith('--expected-current-sha='))?.split('=')[1];
  if (aplicar && reemplazar && !esperado) throw Error('La sustitución requiere --expected-current-sha=<huella de la vista previa>.');
  const resultado = await prisma.$transaction(async tx => {
    // Mismo bloqueo que la API: no se insertan clases mientras se comprueban cruces.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(20260930, 1)`;
    const [periodos, materias, siglas, aulas, docentes, paralelos, horarios, bloques, auxiliares, vinculos] = await Promise.all([
      tx.periodo_academico.findMany({orderBy:{id_periodo:'asc'}}), tx.materia.findMany({orderBy:{codigo_materia:'asc'}}),
      tx.materia_sigla.findMany({orderBy:[{codigo_materia:'asc'},{sigla:'asc'}]}), tx.ambiente.findMany({orderBy:{codigo_ambiente:'asc'}}),
      tx.docente.findMany({orderBy:{id_docente:'asc'}}), tx.paralelo.findMany({orderBy:{id_paralelo:'asc'}}),
      tx.horario.findMany({orderBy:{id_horario:'asc'}}), tx.bloque_horario.findMany({orderBy:{id_bloque:'asc'}}),
      tx.auxiliar.findMany({orderBy:{id_auxiliar:'asc'}}), tx.auxiliar_asignacion.findMany({orderBy:[{id_auxiliar:'asc'},{id_paralelo:'asc'}]}),
    ]);
    const periodo = periodos.find(p => p.gestion === 2026 && p.periodo === 'II');
    if (aulas.some(a => a.codigo_ambiente === 'P3-LAB4')) throw Error('Ejecuta primero importar-aulas-kardex.ts para corregir la numeración de los laboratorios.');
    if (periodo && periodo.estado !== 'ACTIVO') throw Error('II/2026 no está activo. No se altera un periodo cerrado.');
    const anteriores = paralelos.filter(p => p.id_periodo === periodo?.id_periodo), ids = new Set(anteriores.map(p => String(p.id_paralelo)));
    const horariosAntes = horarios.filter(h => ids.has(String(h.id_paralelo))), vinculosAntes = vinculos.filter(v => ids.has(String(v.id_paralelo)));
    const huellaActual = hash({ periodo, asignaciones: anteriores, horarios: horariosAntes, vinculos: vinculosAntes });
    if (aplicar && reemplazar && esperado !== huellaActual) throw Error('II/2026 cambió desde la vista previa. No se sustituyó ningún dato.');
    const nuevasAulas = catalogo.aulas.filter(a => !aulas.some(r => r.codigo_ambiente === a.codigo));
    for (const a of datos.assignments) {
      const m = materias.find(m => m.codigo_materia === a.codigoMateria);
      if (!m || normal(m.nombre) !== normal(a.materia) || m.estado !== 'ACTIVO') throw Error(`Revisar catálogo: ${a.materia}`);
      if (a.sesiones.some(s => !aulas.some(r => r.codigo_ambiente === s.aula && r.estado === 'DISPONIBLE') && !nuevasAulas.some(r => r.codigo === s.aula))) throw Error(`Aula inexistente o no disponible: ${a.key}`);
    }
    const nuevosDocentes = [...new Set(datos.assignments.map(a => a.docente))].filter(nombre => {
      const encontrados = docentes.filter(d => normal(d.nombre_completo) === normal(nombre));
      if (encontrados.length > 1 || encontrados.some(d => d.estado !== 'ACTIVO')) throw Error(`Revisar docente duplicado/inactivo: ${nombre}`);
      return !encontrados.length;
    });
    const pendientesBD: { grupo: string; motivo: string; dia?: string; horaInicio?: string; aula?: string; existente?: string }[] = [];
    const asignaciones: Asignacion[] = [], nuevasAsignaciones: Asignacion[] = [];
    for (const a of datos.assignments) {
      const actuales = reemplazar ? [] : anteriores.filter(p => key(p.codigo_materia, p.nombre_paralelo) === a.key);
      if (actuales.length > 1) throw Error(`Paralelo repetido en base de datos: ${a.key}`);
      const actual = actuales[0];
      if (actual && (actual.estado !== 'ACTIVO' || normal(docentes.find(d => d.id_docente === actual.id_docente)!.nombre_completo) !== normal(a.docente))) {
        pendientesBD.push({grupo:a.key,motivo:'Asignación existente con otro docente/estado; conservada'}); continue;
      }
      asignaciones.push(a); if (!actual) nuevasAsignaciones.push(a);
    }
    const inicio = periodo?.fecha_inicio ?? new Date('2026-07-01T00:00:00Z'), fin = periodo?.fecha_fin ?? new Date('2026-12-31T00:00:00Z');
    const ocupadas: Ocupacion[] = [];
    for (const h of horarios) {
      if (reemplazar && ids.has(String(h.id_paralelo))) continue;
      const p = paralelos.find(p => p.id_paralelo === h.id_paralelo)!, periodoH = periodos.find(x => x.id_periodo === p.id_periodo)!;
      if (h.estado !== 'ASIGNADO' || p.estado !== 'ACTIVO' || periodoH.estado !== 'ACTIVO' || periodoH.fecha_inicio > fin || periodoH.fecha_fin < inicio || (h.fecha && (h.fecha < inicio || h.fecha > fin))) continue;
      const b = bloques.find(b => b.id_bloque === h.id_bloque)!;
      ocupadas.push({dia:h.dia_semana,horaInicio:hh(b.hora_inicio),horaFin:hh(b.hora_fin),aula:h.codigo_ambiente,
        docente:normal(docentes.find(d => d.id_docente === p.id_docente)!.nombre_completo),auxiliar:!!h.id_auxiliar,
        grupo:p.id_periodo === periodo?.id_periodo ? key(p.codigo_materia,p.nombre_paralelo) : `otro-periodo:${p.id_paralelo}`,existente:String(h.id_horario)});
    }
    const nuevasSesiones: { asignacion: Asignacion; sesion: Sesion }[] = [];
    let horariosYaPresentes = 0;
    for (const a of asignaciones) for (const s of a.sesiones) {
      const actual = reemplazar ? undefined : anteriores.find(p => key(p.codigo_materia,p.nombre_paralelo) === a.key);
      if (actual && horariosAntes.some(h => h.id_paralelo === actual.id_paralelo && h.codigo_ambiente === s.aula && h.dia_semana === s.dia && h.estado === 'ASIGNADO' && !h.fecha && !h.id_auxiliar && bloques.some(b => b.id_bloque === h.id_bloque && hh(b.hora_inicio) === s.horaInicio && hh(b.hora_fin) === s.horaFin))) { horariosYaPresentes++; continue; }
      const o = {...s,grupo:a.key,docente:normal(a.docente),auxiliar:false}, choque = ocupadas.find(h => coincide(o,h));
      if (choque) { pendientesBD.push({grupo:a.key,dia:s.dia,horaInicio:s.horaInicio,aula:s.aula,motivo:'Cruce con horario existente; conservado',existente:choque.existente}); continue; }
      nuevasSesiones.push({asignacion:a,sesion:s}); ocupadas.push(o);
    }
    let respaldo: string | undefined;
    if (aplicar) {
      const carpeta = join(__dirname, 'backups'); mkdirSync(carpeta,{recursive:true});
      respaldo = join(carpeta, `antes-horarios-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}.json`);
      writeFileSync(respaldo,json({periodos,materias,siglas,aulas,docentes,paralelos,horarios,bloques,auxiliares,vinculos}),{flag:'wx'});
      const p = periodo ?? await tx.periodo_academico.create({data:{gestion:2026,periodo:'II',fecha_inicio:inicio,fecha_fin:fin}});
      if (nuevasAulas.length) await tx.ambiente.createMany({data:nuevasAulas.map(a=>({codigo_ambiente:a.codigo,nombre:a.nombre,lugar:a.lugar,piso:a.piso,tipo:a.tipo,capacidad:0}))});
      if (reemplazar) {
        await tx.horario.deleteMany({where:{id_paralelo:{in:anteriores.map(a=>a.id_paralelo)}}});
        await tx.auxiliar_asignacion.deleteMany({where:{id_paralelo:{in:anteriores.map(a=>a.id_paralelo)}}});
        await tx.paralelo.deleteMany({where:{id_periodo:p.id_periodo}});
      }
      if (nuevosDocentes.length) await tx.docente.createMany({data:nuevosDocentes.map(nombre_completo=>({nombre_completo}))});
      const todosDocentes = await tx.docente.findMany();
      if (nuevasAsignaciones.length) await tx.paralelo.createMany({data:nuevasAsignaciones.map(a=>({codigo_materia:a.codigoMateria,nombre_paralelo:a.grupo,id_periodo:p.id_periodo,id_docente:todosDocentes.find(d=>normal(d.nombre_completo)===normal(a.docente))!.id_docente}))});
      const todasAsignaciones = await tx.paralelo.findMany({where:{id_periodo:p.id_periodo}});
      let next = Math.max(0,...bloques.map(b=>b.id_bloque));
      const nuevosBloques: typeof bloques = [];
      for (const {sesion:s} of nuevasSesiones) if (![...bloques,...nuevosBloques].some(b=>hh(b.hora_inicio)===s.horaInicio&&hh(b.hora_fin)===s.horaFin)) nuevosBloques.push({id_bloque:++next,hora_inicio:bloqueFecha(s.horaInicio),hora_fin:bloqueFecha(s.horaFin)});
      if (nuevosBloques.length) await tx.bloque_horario.createMany({data:nuevosBloques});
      if (nuevasSesiones.length) await tx.horario.createMany({data:nuevasSesiones.map(({asignacion:a,sesion:s})=>({
        id_paralelo:todasAsignaciones.find(p=>key(p.codigo_materia,p.nombre_paralelo)===a.key)!.id_paralelo,
        codigo_ambiente:s.aula,dia_semana:s.dia,id_bloque:[...bloques,...nuevosBloques].find(b=>hh(b.hora_inicio)===s.horaInicio&&hh(b.hora_fin)===s.horaFin)!.id_bloque,
        fecha:null,id_auxiliar:null,estado:'ASIGNADO',publicado:true,
      }))});
      const protegidosAntes = hash([materias,siglas,aulas,docentes,auxiliares]);
      const protegidosDespues = hash(await Promise.all([
        tx.materia.findMany({orderBy:{codigo_materia:'asc'}}),tx.materia_sigla.findMany({orderBy:[{codigo_materia:'asc'},{sigla:'asc'}]}),
        tx.ambiente.findMany({where:{codigo_ambiente:{in:aulas.map(a=>a.codigo_ambiente)}},orderBy:{codigo_ambiente:'asc'}}),tx.docente.findMany({where:{id_docente:{in:docentes.map(d=>d.id_docente)}},orderBy:{id_docente:'asc'}}),
        tx.auxiliar.findMany({orderBy:{id_auxiliar:'asc'}}),
      ]));
      if (protegidosAntes !== protegidosDespues) throw Error('Cambió un catálogo protegido: se revierte toda la carga.');
    }
    return {modo:aplicar?'APLICADO':'VISTA PREVIA',fuente:datos.fuente.archivo,reemplazarII2026:reemplazar,huellaActual,respaldo,
      aulasNuevas:nuevasAulas.map(a=>a.codigo),docentesNuevos:nuevosDocentes.length,docentesIdentificadosPDF:new Set(datos.assignments.map(a=>a.docente)).size,
      asignacionesNuevas:nuevasAsignaciones.length,horariosNuevos:nuevasSesiones.length,horariosYaPresentes,
      retirados:reemplazar?{asignaciones:anteriores.length,horarios:horariosAntes.length,vinculosAuxiliar:vinculosAntes.length}:null,
      periodosNuevos:!periodo?['II/2026']:[],
      catalogosConservados:{materias:materias.length,aulas:aulas.length,docentesPrevios:docentes.length,auxiliares:auxiliares.length},
      auxiliaresImportados:0,horariosAuxiliaresImportados:0,sesionesAuxiliaresExcluidas:datos.excluded.length,pendientesBD};
  },{timeout:60000,maxWait:15000});
  if (aplicar) writeFileSync(join(__dirname,'data/resultado-horarios-ii-2026.json'),json(resultado));
  console.log(json(resultado));
}
main().catch(e=>{console.error(e instanceof Error ? e.message : 'Error de importación');process.exitCode=1;}).finally(()=>prisma.$disconnect());
