const fs=require('node:fs'),path=require('node:path');
const d=require('./data/horarios-ii-2026.json');
const resultPath=path.join(__dirname,'data/resultado-horarios-ii-2026.json');
const result=fs.existsSync(resultPath)?JSON.parse(fs.readFileSync(resultPath,'utf8')):null;
const groups=new Map([...d.assignments,...d.sinDocente].map(g=>[g.key,g]));
const clean=v=>String(v??'—').replaceAll('|',' / ').replaceAll('\n',' ');
const table=(headers,rows)=>['| '+headers.join(' | ')+' |','| '+headers.map(()=>'---').join(' | ')+' |',...rows.map(row=>'| '+row.map(clean).join(' | ')+' |')].join('\n');
const name=k=>{const g=groups.get(k);return g?`${g.siglas.join(' / ')} · ${g.grupo} · ${g.materia}`:k;};
const time=s=>s.dia?`${s.dia} ${s.horaInicio}${s.horaFin?'–'+s.horaFin:''}`:'Sin sesión identificada';
const output=['# Informe de carga de horarios II/2026','',
'Fuente principal: **HORARIOS PASANTES PRACTICA PARA COLAR.pdf**, nueve páginas, encabezado “Horarios de inscripción segundo 2026”. Docentes, materias, paralelos, días, horas y aulas provienen de este documento.','',
'Apoyo: **horarios 2-2026.pdf**, preparado a partir del anterior. Se consultó únicamente para identificar el rol de las sesiones (docente/AUX). Sus aulas diferentes no reemplazan las del original. Algunas tablas de apoyo dicen 1/2026; sus encabezados se conservan en la evidencia JSON y no determinan el periodo de la carga.','',
'## Resultado','',
result?`Última ejecución: **${result.modo}**. Añadió ${result.docentesNuevos} docentes, ${result.asignacionesNuevas} asignaciones y ${result.horariosNuevos} sesiones semanales; reconoció ${result.horariosYaPresentes} sesiones ya existentes. Nuevas aulas: ${result.aulasNuevas.join(', ')||'ninguna'}. Periodos creados: ${result.periodosNuevos.join(', ')||'ninguno'}.`:'La base de datos aún no se ha modificado con este importador.','',
result?.reemplazarII2026?'Se sustituyeron los datos previos de II/2026 con respaldo local anterior a la transacción.':'Se conserva lo que ya estaba guardado. La sustitución de las asignaciones, horarios y vinculación de auxiliar de prueba de II/2026 requiere confirmación; no se realizó.','',
`El PDF identifica **${new Set(d.assignments.map(a=>a.docente)).size} docentes y ${d.assignments.length} asignaciones**. La conciliación admite **${d.assignments.flatMap(a=>a.sesiones).length} sesiones**, excluye **${d.excluded.length} sesiones señaladas AUX** y deja **${d.pending.filter(p=>p.dia).length} variantes de sesión pendientes**. Además, **${d.sinDocente.length} paralelos no tienen docente identificado**. Los pendientes no son clases confirmadas ni se atribuyen al titular. Una asignación puede quedar creada sin horario para completarla después. Los conteos de variantes incluyen alternativas que aparecen en distintas menciones.`, '',
'I/2027 se creó inicialmente vacío y fue retirado el 04/10/2026 por solicitud del usuario, tras comprobar que no tenía asignaciones ni cierre. Solo queda II/2026; el importador ya no crea periodos futuros. Las materias, aulas, docentes y el registro del auxiliar son globales y se conservan. No se importaron auxiliares, contactos, capacidades ni equipamiento inventados.','',
'## Diferencias con los datos de prueba del sistema','',
'Estas diferencias son entre la base de datos anterior a la carga y el PDF original; no son una afirmación de docentes diferentes entre los dos PDF.','',
table(['Materia / paralelo','Docente anterior en el sistema','Docente del PDF original'],d.collisions.map(c=>[name(c.grupo),c.actual,c.pdf])),'',
'## Pendientes por los datos existentes','',
result?.pendientesBD.length?table(['Materia / paralelo','Sesión','Aula','Motivo'],result.pendientesBD.map(p=>[name(p.grupo),time(p),p.aula,p.motivo])):'Ninguno en la última ejecución.','',
'## Criterios de conciliación','',
'- Las materias se vinculan por su identidad y nombre normalizado; las siglas de una misma materia se conservan. Las dos materias llamadas INF-244 siguen separadas.','- Se conserva la letra del paralelo del original. “Sin Docente” o nombres vacíos no se convierten en personas.','- Una sesión AUX requiere coincidencia de materia, paralelo, día y hora con una marca explícita del PDF de apoyo. Una tercera sesión sin rol confirmado queda pendiente.','- Cuando hay más de dos posibles sesiones, solo se retienen dos si están corroboradas por el PDF de apoyo o son comunes a todas las entradas no vacías de esa misma materia/paralelo en el original. El resto se informa para revisión; no se eligen las dos primeras.','- Las aulas múltiples y los cruces se dejan pendientes. Si materias con nombres distintos comparten docente, aula y hora, no se fusionan ni se inserta una doble ocupación: hace falta confirmar cómo registrar la clase compartida.','- Los valores 11:59 del original se conservan; no se redondean a 12:00. Las fechas exactas no se inventan para clases semanales.','',
'## Horarios del PDF que necesitan revisión','',
table(['Materia / paralelo','Docente','Página original','Sesión','Aulas del original','Motivo'],d.pending.map(p=>{const g=groups.get(p.grupo);return [name(p.grupo),g?.docente||'Sin docente',g?.paginas.join(', '),time(p),(p.aulas??[]).join(' + '),p.motivo];})),'',
'## Cruces encontrados dentro del original','',
'Se dejaron pendientes ambas ocupaciones de cada cruce. Varias parecen clases compartidas de materias diferentes; otras indican aulas distintas para el mismo docente.','',
table(['Sesión','Primera materia / paralelo','Aula','Segunda materia / paralelo','Aula','Docente(s)'],d.conflicts.map(({a,b})=>[time(a),name(a.grupo),a.aula,name(b.grupo),b.aula,a.docente===b.docente?a.docente:`${a.docente} / ${b.docente}`])),'',
'## Sesiones AUX excluidas','',
table(['Materia / paralelo','Página original','Sesión','Aula original','Evidencia de apoyo'],d.excluded.map(p=>[name(p.grupo),groups.get(p.grupo)?.paginas.join(', '),time(p),p.aulas.join(' + '),p.evidencia.map(e=>`p. ${e.pagina}: ${e.texto} (${e.aula}; encabezado ${e.periodo})`).join('; ')])),'',
'## Aulas diferentes en el PDF derivado','',
'Se registra la diferencia para revisión. Si la sesión superó los demás controles, se utiliza el aula del original solicitado por el usuario. Una fila aquí también puede estar pendiente por otro motivo.','',
table(['Materia / paralelo','Sesión','Aula original','Aula(s) en el derivado'],d.observations.map(p=>[name(p.grupo),time(p),p.aulas.join(' + '),p.evidencia.map(e=>`${e.aula} (p. ${e.pagina})`).join('; ')])),'',
'## Trazabilidad','',
`- SHA-256 original: \`${d.fuente.sha256}\`.`,`- SHA-256 apoyo: \`${d.apoyo.sha256}\`.`,
'- Datos conciliados, líneas originales, páginas y evidencia: `backend/prisma/data/horarios-ii-2026.json`.','- Importador: `backend/prisma/importar-horarios-pdf.ts`. Por defecto muestra una vista previa sin cambios; `--apply` hace una carga aditiva e idempotente.','- Antes de cada aplicación se guarda una copia de las tablas académicas en `backend/prisma/backups/`. La transacción usa el mismo bloqueo que la API y revierte ante errores.','- El archivo `resultado-horarios-ii-2026.json` registra el resultado de la última aplicación y la ruta del respaldo.',''];
fs.writeFileSync(path.join(__dirname,'../../referencias/INFORME-CARGA-II-2026.md'),output.join('\n'));
console.log('Informe generado: referencias/INFORME-CARGA-II-2026.md');
