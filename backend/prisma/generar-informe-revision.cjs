// Read-only database report. Academic source files and applied plans supply
// the audit trail; no corrections are inferred from absent spreadsheet cells.
const fs=require('node:fs'),path=require('node:path');
const {prisma}=require('../dist/database/prisma');
const first=require('./data/resultado-revision-horarios-ii-2026-inicial.json');
const result=require('./data/resultado-revision-horarios-ii-2026.json');
const review=require('./data/vista-previa-revision-horarios-ii-2026.json');
const original=require('./data/horarios-ii-2026.json');
const pensums=require('./data/revision-pensums-ii-2026.json');
const clean=s=>String(s??'').replace(/\|/g,' · ').replace(/\n/g,' ');
const rows=items=>items.map(r=>'| '+r.map(clean).join(' | ')+' |').join('\n');
(async()=>{
  const [teachers,schedules,subjects,assignments]=await Promise.all([
    prisma.docente.findMany({orderBy:{nombre_completo:'asc'}}),
    prisma.horario.findMany({include:{paralelo:true}}),prisma.materia.findMany(),prisma.paralelo.findMany()
  ]);
  const active=schedules.filter(h=>h.estado==='ASIGNADO');
  const groups=new Map();
  for(const p of review.pendientes.filter(p=>p.tipo==='cruce-pdf')){
    const key=[p.a.idDocente,p.a.dia,p.a.horaInicio,p.a.horaFin].join('|');
    const g=groups.get(key)??{dia:p.a.dia,inicio:p.a.horaInicio,fin:p.a.horaFin,docente:teachers.find(t=>String(t.id_docente)===p.a.idDocente)?.nombre_completo,entries:new Map()};
    for(const s of [p.a,p.b])g.entries.set(s.key,{key:s.key,aula:s.aula});
    groups.set(key,g);
  }
  const consolidated=new Map();
  for(const g of groups.values()){
    const entries=[...g.entries.values()].sort((a,b)=>a.key.localeCompare(b.key));
    const key=JSON.stringify([g.docente,g.inicio,g.fin,entries]);
    const c=consolidated.get(key)??{...g,entries,dias:[]};c.dias.push(g.dia);consolidated.set(key,c);
  }
  const identity=key=>{const a=original.assignments.find(a=>a.key===key);return a?`${a.siglas.join(' / ')} ${a.grupo}: ${a.materia}`:key;};
  const report=`# Revisión de horarios II/2026 — 12/10/2026

**Cambios aplicados a la base configurada.** Este informe actualiza el informe de carga anterior. Se revisaron las 406 celdas no vacías del PDF manual, el PDF de inscripción y los siete Excel de convalidación de la carpeta referencias.

## Resultado vigente

- **${active.length} sesiones activas**, frente a las 299 anteriores a esta revisión: 152 altas iniciales y 34 registros de esa carga retirados después de revisar los cruces entre materias distintas. Se corrigieron además cinco sesiones existentes y tres asignaciones con titular incorrecto.
- **${active.filter(h=>h.es_auxiliar||h.id_auxiliar).length} sesiones de auxiliaría**. Todas usan fondo plateado. Las fuentes no nombran a sus auxiliares: se muestra «Auxiliar por designar» cuando corresponde. Se conservó el auxiliar ya registrado y su vínculo.
- **${teachers.filter(d=>d.grado_academico).length} docentes con grado** delante del nombre. Boris Fernando Alfaro Bazán lleva **Ing.**, confirmado por el usuario. Los otros grados proceden literalmente del manual, incluidos MGr. y P.Ph.D.; no se aumentaron credenciales.
- **Curso Preuniversitario (C.P.U.)** registrado como materia, con ocho ocupaciones de aula y color azul fijo. Reynaldo Javier Zeballos Daza figura como coordinador, según la aclaración del usuario. La coordinación no bloquea su agenda docente; sí se validan aula y paralelo.
- Colores distintos entre asignaciones ordinarias diferentes dentro de cada aula. Una misma asignación conserva su color entre días y aulas. Auxiliares y C.P.U. mantienen sus colores comunes.
- **Imprimir / PDF abre primero una vista previa** con visor, zoom, descarga e impresión. Carta vertical, dos aulas por página; no se abre automáticamente el diálogo de impresión.

| Aula | Sesiones activas |
| --- | ---: |
${rows(['LASIN-1','LASIN-2','LASIN-3'].map(a=>[a,active.filter(h=>h.codigo_ambiente===a).length]))}

LASIN pasa de cinco a **${active.filter(h=>h.codigo_ambiente.startsWith('LASIN')).length} sesiones activas**. En LASIN-2 quedan pendientes martes y jueves 10:00–12:00 por el cruce entre TIC-251 e INF-263, descrito abajo. Las dos celdas contiguas de AUX INF-131 B del viernes en LASIN-3 se representan como una sesión 10:00–14:00.

## Qué aclaran los Excel

Se leyeron todas las hojas de los siete libros, incluyendo los encabezados y coordenadas de celda. A/B corresponde al plan 1998; C/D al plan ajustado. Las tablas **no contienen días, horas, paralelos ni nombres de docentes o auxiliares**, y no son una lista exhaustiva de todas las materias de los planes. Una convalidación desde una materia antigua no demuestra que dos materias actuales deban impartirse simultáneamente.

| Evidencia del Excel | Consecuencia para los horarios |
| --- | --- |
| Redes, C45/D45: TIC-247, Laboratorio de redes | No convierte Redes II (SEG-252 / INF-333 en el PDF) en la misma materia. Los cruces de Franz y Roberto quedan sin aceptar. |
| Redes, C60/D60: TIC-253, Dirección de proyectos informáticos; C71/D71: INF-315, Preparación y evaluación de proyectos; Ingeniería, C71/D71: SIS-253, Preparación y evaluación de proyectos | SIS-253 / INF-315 son la misma materia por nombre; TIC-253 es otra. No se permite doble ocupación. |
| Industrial, C31/D31: INF-318, Computación en la Nube; Redes, C42/D42: TIC-323, Servicios en la Nube | Los Excel conservan nombres y convalidaciones diferentes; no autorizan a compartir la misma clase. |
| Software, C63/D63: INF-263, Desarrollo de app multimedia | TIC-251, Aplicaciones y servicios multimedia, figura con otro nombre en ambos PDF. No hay equivalencia explícita entre ambas en estos Excel. |
| Computación, C40/D40: COM-311, Sistemas Estocásticos | DAT-262, Procesos estocásticos y análisis de series de tiempo, no queda identificado como la misma materia. |
| IA, C94/D94: DAT-241, Programación distribuida y paralela; Computación, C95/D95: COM-263, Computación Paralela | Ambas convalidan INF-322 del plan 1998 en menciones distintas. Esto no confirma una clase conjunta ni incluye a SIS-371, Sistemas Distribuidos. |
| Computación, C32/D32 y C79/D79: COM-323, Computabilidad y Complejidad Algorítmica | No es Introducción a las Redes y Telecomunicaciones (TIC-135). |
| Industrial y Software, C93/D93: INF-244, Introducción a la robótica; IA, Ingeniería y Redes, C43/D43: INF-244, Base de datos II | La misma sigla identifica materias distintas. Se mantienen separadas y se distinguen por nombre y titular, sin duplicar la celda. |
| Software e Ingeniería, C38/D38: INF-251, Ingeniería de software I; todos los libros, C4/D4 o C5/D5: INF-111, Programación I | Confirman la materia, pero no indican los dos paralelos AUX ausentes del manual. |

## Cruces aún pendientes de horario correcto

Los dos PDF repiten estos cruces. No se inventó un cambio de docente, día o aula para resolverlos. **Ninguna de estas ocupaciones contradictorias está publicada como sesión activa.** Las 34 que se habían añadido como compartidas se conservan en la base con estado CANCELADO, motivo de revisión y publicación desactivada; no se borraron personas, materias, asignaciones ni registros.

${groups.size} franjas por docente, resumidas en ${consolidated.size} casos:

| Días y horas | Docente | Materias y aulas que compiten |
| --- | --- | --- |
${rows([...consolidated.values()].map(g=>[`${g.dias.join(' / ')} ${g.inicio}–${g.fin}`,g.docente,g.entries.map(e=>`${identity(e.key)} (${e.aula})`).join('; ')]))}

La presencia de dos siglas de **la misma materia** sigue siendo válida. Por ejemplo TIC-254 / SEG-264 significa Redes Inalámbricas; no debe confundirse con TIC-381, Administración de Centros de Datos y de Red. Los Excel revisados no proporcionan un horario alternativo para el cruce de Boris Alfaro.

## Otros datos faltantes

| Dato | Fuente y estado |
| --- | --- |
${rows(review.pendientes.filter(p=>p.tipo==='identidad').map(p=>[`${p.texto}, ${p.dia} ${p.horaInicio}–${p.horaFin}, ${p.aula}`,`Manual, página ${p.pagina}: falta paralelo; no se deduce del pensum`]))}

La anotación «ojito» del manual no se convirtió en una clase. No hay grado respaldado por las fuentes para estos ${teachers.filter(t=>!t.grado_academico).length} docentes:

${teachers.filter(t=>!t.grado_academico).map(t=>'- '+t.nombre_completo).join('\n')}

## Respaldo y comprobación

- Antes de la carga: [respaldo académico inicial](../backend/prisma/backups/${path.basename(first.respaldo)}).
- Antes de retirar cruces: [respaldo académico de la revisión](../backend/prisma/backups/${path.basename(result.respaldo)}).
- [Resultado de la carga inicial](../backend/prisma/data/resultado-revision-horarios-ii-2026-inicial.json), [corrección posterior](../backend/prisma/data/resultado-revision-horarios-ii-2026.json) y [última vista previa sin escrituras](../backend/prisma/data/vista-previa-revision-horarios-ii-2026.json).
- [Celdas de los Excel y SHA-256](../backend/prisma/data/revision-pensums-ii-2026.json), [celdas de los PDF](../backend/prisma/data/revision-horarios-ii-2026-fuentes.json) y [confirmaciones del usuario](../backend/prisma/data/revision-horarios-ii-2026-confirmaciones.json).
- Verificación transaccional de **todos los horarios activos**: no hay cruces no autorizados por aula, paralelo o docente. La misma materia puede ocupar varias aulas cuando lo respaldan las fuentes; los auxiliares y la coordinación se validan según su rol.
- Repetición del conciliador: cero altas, cambios, retiros, cambios de titular y grados pendientes de aplicar. Los ${review.pendientes.length} avisos documentales restantes corresponden a 23 comparaciones de pares en las ${groups.size} franjas contradictorias, dos paralelos sin identificar y una anotación.
- Compilación de backend y frontend; pruebas de conciliación, cruces, colores y navegador. Validación visual con datos reales leídos sin escrituras, en escritorio, móvil y PDF.
- [PDF de LASIN para revisar](../.preview-academico/revision-2026/LASIN-II-2026.pdf).

Para repetir solo la revisión desde backend: \`npm run prisma:revisar:horarios\`. Aplicar exige \`--apply --expected-current-sha=<huella>\`, respaldo y una transacción. El proceso aborta si cambian los PDF o Excel revisados. No es necesario volver a aplicar esta carga.
`;
  fs.writeFileSync(path.join(__dirname,'../../referencias/INFORME-REVISION-HORARIOS-II-2026.md'),report);
  console.log(JSON.stringify({activos:active.length,grados:teachers.filter(d=>d.grado_academico).length,sinGrado:teachers.filter(d=>!d.grado_academico).map(t=>t.nombre_completo),franjas:groups.size,casos:consolidated.size,materias:subjects.length,asignaciones:assignments.length,excel:pensums.archivos.length},null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
