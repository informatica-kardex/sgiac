# Gestión académica

**Actualización aplicada el 12/10/2026:** [informe vigente de horarios II/2026](../../referencias/INFORME-REVISION-HORARIOS-II-2026.md). Hay 417 sesiones activas, 71 auxiliarías, 42 sesiones en LASIN y 79 grados docentes. C.P.U. tiene ocho ocupaciones de aula y un coordinador; no ocupa su agenda docente. Se corrigieron tres titulares y cinco sesiones. Las 34 sesiones añadidas que superponían materias distintas se conservaron como CANCELADO, con motivo y sin publicación, tras revisar los Excel. Los pendientes de las secciones históricas siguientes deben consultarse en el informe vigente.

Se aplicó `migrations/20261012000000_horarios_auxiliares_compartidos/migration.sql`: `es_auxiliar` permite identificar la auxiliaría sin inventar una persona y `sesion_compartida` identifica una misma materia que ocupa varias aulas según las fuentes. El servidor rechaza superposiciones entre materias distintas incluso si conservan un marcador compartido. El formulario permite «Auxiliar por designar». Auxiliares usan plateado; C.P.U. azul fijo; las otras asignaciones no repiten color dentro de un mismo horario.

`npm run prisma:revisar:horarios` realiza una revisión sin escrituras. Para aplicar, exige `--apply --expected-current-sha=<huella>` y conserva un respaldo académico completo, verifica los SHA-256 de los siete Excel y ambos PDF, y valida el estado final y la idempotencia. Esta carga ya está aplicada en este entorno. `node prisma/generar-informe-revision.cjs` regenera el informe leyendo la base sin modificarla.

Implementación del 30/09/2026. La migración y la muestra **ya se aplicaron a la base configurada en este entorno**. No es necesario volver a ejecutar el SQL aquí. Reinicia el backend después de actualizar el código y el cliente Prisma.

Actualización del 02/10/2026: también se aplicó `migrations/20261001000000_reservas_auxiliares/migration.sql`. Añade las tablas `auxiliar` y `auxiliar_asignacion` (con RLS), y los campos `horario.fecha`, `horario.motivo` y `horario.id_auxiliar`, con sus relaciones e índices. Una fecha nula representa una clase semanal; una fecha concreta, una reserva de un solo día. Las clases anteriores conservan su carácter semanal y sus datos. No se cambiaron permisos ni se crearon cuentas de auxiliares: son registros académicos administrados con el permiso de Docentes.

También se aplicó `migrations/20261002000000_lasin_siglas_compartidas/migration.sql`: habilita `LASIN` en la restricción de `ambiente.lugar` y cambia la clave primaria de `materia_sigla` a `(codigo_materia, sigla)`, con índice por sigla. Permite que dos materias distintas conserven la misma sigla real. El identificador interno sigue enlazando asignaciones y horarios; nunca se debe usar una sigla por sí sola para identificar una materia. No se eliminaron registros ni se modificaron permisos.

## Cambios en la base de datos

Archivo: `migrations/20260930000000_gestion_academica/migration.sql`.

- `docente`: agrega `correo` y `telefono`, opcionales.
- `ambiente`: agrega `lugar` (`ANTIGUO`, `PABELLONES`, `INFORMATICA`) y `piso`, opcionales para conservar ambientes anteriores. Las altas nuevas requieren un lugar. Piso −1 = subsuelo; 0 = planta baja; NULL = no corresponde / sin confirmar.
- `materia_sigla`: nueva tabla con una sigla única por fila y relación con `materia`. Incluye la sigla principal y las equivalentes. Se habilita RLS; el acceso se realiza mediante el backend autenticado.
- `permiso_usuario`: amplía la restricción de módulos para incluir `docentes` y `materias`. No concede automáticamente permisos nuevos a subadministradores.
- Se reutilizan `materia`, `docente`, `paralelo`, `periodo_academico`, `bloque_horario`, `horario` y `ambiente`. No se eliminaron tablas ni datos existentes.

Para otra instalación que ya tenga el esquema previo y las migraciones anteriores, ejecuta **una sola vez**, desde `backend`:

```sh
npx prisma db execute --file prisma/migrations/20260930000000_gestion_academica/migration.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/migrations/20261001000000_reservas_auxiliares/migration.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/migrations/20261002000000_lasin_siglas_compartidas/migration.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/migrations/20261004000000_grado_docente/migration.sql --schema prisma/schema.prisma
npx prisma db execute --file prisma/migrations/20261012000000_horarios_auxiliares_compartidos/migration.sql --schema prisma/schema.prisma
npm run prisma:generate
npm run prisma:seed:academico
```

Se utilizó `db execute`, como actualización del esquema existente; no se hizo `db push`, reset ni un despliegue de todo el historial de migraciones. El SQL contiene una transacción y no debe repetirse en una base donde ya fue aplicado. El seed es independiente del seed de usuarios y no modifica contraseñas ni cuentas.

## Muestra del PDF

Fuente: `referencias/HORARIOS PASANTES PRACTICA PARA COLAR.pdf`, páginas 1, 2, 7 y 8. Se cargaron 5 docentes, 5 materias, 6 siglas, 8 ambientes, 5 asignaciones y 11 clases del segundo periodo de 2026. Incluye Programación I, Fundamentos Digitales, Estadística I, Álgebra Lineal y Simulación de Sistemas (`INF-381` / `DAT-318`).

Los contactos se dejaron vacíos y la capacidad en 0 (por confirmar). Los pisos SS/PB/Pn se interpretaron como subsuelo/planta baja/piso n. El piso del aula `04-02-09` quedó sin confirmar; el Pabellón G no requiere elegir piso. Las fechas julio–diciembre del periodo son de prueba. No se importó el PDF completo ni sus aparentes repeticiones de horarios.

El seed puede ejecutarse nuevamente: omite las entidades y clases existentes; no sobrescribe las ediciones administrativas. Si una clase nueva de la muestra entra en conflicto con una edición posterior, el proceso informa el conflicto en lugar de reemplazarla.

## Uso

1. En **Materias**, registra el nombre, sigla principal y equivalentes separadas por comas. Una sigla puede aparecer en materias distintas: verifica también el nombre. Los identificadores internos y sus asignaciones permanecen separados.
2. En **Docentes**, registra los datos y usa **Asignar materia** para elegir materia y periodo. El servidor asigna el siguiente paralelo automáticamente (A, B… Z, AA…). La secuencia es independiente para cada materia y periodo y respeta los paralelos existentes. No se duplica una asignación del mismo docente a la misma materia en el mismo periodo. Las solicitudes simultáneas reciben letras distintas.
3. En **Aulas**, las cinco tarjetas de lugar filtran la tabla: Todos los lugares, Edificio antiguo, Pabellones, LASIN y Edificio de Informática. Informática añade tarjetas para **Todas las aulas** y sus pisos. Registra lugar, piso opcional, tipo, capacidad y estado.
4. En **Docentes → Auxiliares**, **Vincular materia** pide primero una materia del catálogo completo de materias activas, ordenado por plan de estudios. Luego ofrece solo las asignaciones de esa materia con docente, paralelo y periodo activos, excluyendo las ya vinculadas a ese auxiliar. Si no hay asignaciones disponibles, explica el motivo y deshabilita Guardar. Cambiar materia limpia la asignación anterior. La vinculación identifica materia, docente titular, paralelo y periodo; no crea otro paralelo. Un auxiliar puede tener varias vinculaciones. La lista permite filtrar por materia vinculada o **Sin materia vinculada**, combinarlo con búsqueda por nombre, materia, sigla o docente, y limpiar los filtros.
5. En **Horarios**, selecciona una de las cuatro tarjetas de lugar. En Informática aparece antes la selección de **Todas las aulas** o un piso: primero a quinto, además de subsuelo, planta baja u otros niveles registrados. Los pisos sin aulas muestran un mensaje. Al seleccionar un aula, su horario abre una vista propia desde arriba, sin las tarjetas delante. **Volver a las aulas** conserva lugar y piso. Dentro de **Asignar horario**, elige primero materia y después docente o auxiliar y paralelo. Puedes crear periodos desde esta pantalla.
6. En **Ver Horarios**, **Todos los lugares** muestra directamente los horarios completos de todas las aulas del periodo. **Abrir aula** permite consultar una sola. Las otras cuatro tarjetas llevan a la selección de aula, con el mismo paso de pisos para Informática. Al seleccionar el aula se abre su horario en una vista propia; el botón Volver regresa a las aulas o a todos los horarios según la selección anterior. Se muestran capacidad, ubicación y equipamiento registrado. **Modificar horario** abre Horarios conservando aula, piso y periodo. Está disponible para usuarios con permiso de Horarios y periodos activos. La consulta está disponible para administradores y subadministradores con algún permiso académico vigente.
7. **Imprimir / PDF** abre la vista previa de todas las aulas del lugar y piso elegidos; **Imprimir aula** abre únicamente el aula seleccionada. El visor permite zoom, descarga, abrir el PDF e imprimir cuando el usuario lo decide. El documento contiene solo horarios del semestre, en carta vertical (216 × 279 mm), dos aulas por hoja; una cantidad impar deja la última aula sola. Capacidad, equipamiento, tarjetas, menús y acciones no forman parte del documento. Se incluyen las reservas vigentes y futuras del periodo.

## Catálogo completo del PDF, cargado el 02/10/2026

`data/catalogo-pdf.json` guarda los nombres, siglas, aulas, páginas de origen y SHA-256 del PDF de nueve páginas. Se agruparon los nombres iguales normalizando tildes y espacios, conservando las distintas siglas; se corrigió únicamente la errata DEEP LERNING / DEEP LEARNING. Resultado: **114 materias, 158 siglas distintas (159 relaciones) y 28 aulas**. Las dos materias con INF-244 permanecen separadas.

La importación añadió **109 materias, 153 relaciones de siglas y 19 aulas** a las existentes. Conservó exactamente los 6 docentes, 8 asignaciones y 10 horarios anteriores (comparación de todos sus campos dentro de la transacción). Tampoco sobrescribió capacidades, equipamiento ni otros datos de aulas existentes. Las aulas nuevas tienen capacidad 0, presentada como “Por confirmar”; el PDF no incluye capacidades ni inventario. Distribución: 21 aulas de Informática, 3 del edificio antiguo, 3 de LASIN y Pabellón G.

El importador es independiente del seed de muestra: **no crea docentes ni horarios**. Coincide materias por nombre normalizado y aulas por código; aborta si hay materias homónimas ambiguas. Si se renombraron materias después de la carga, revisa la vista previa antes de repetirla. Ejecutar desde `backend`:

```sh
npm run prisma:importar:catalogo             # Vista previa, sin escrituras
npm run prisma:importar:catalogo -- --apply  # Aplicar altas y siglas faltantes
```

La segunda ejecución de la vista previa tras importar dio cero altas y cero siglas pendientes. No vuelvas a ejecutar el seed de muestra para esta carga: el seed sí incluye clases de prueba.

## Referencias de las siete menciones

Se revisaron los siete Excel de `referencias/TABLA CONVALIDACION 3 PLANES`. Son tablas de convalidación desde el plan 1998 hacia planes ajustados; las equivalencias con materias antiguas no se importaron como si fueran siglas adicionales del catálogo actual. Identifican estas menciones:

- Informática Industrial.
- Desarrollo de Software e Innovación Tecnológica.
- Inteligencia Artificial y Ciencia de Datos.
- Ingeniería de Sistemas.
- Redes y Tecnologías de la Información.
- Seguridad de la Información.
- Ciencias de la Computación.

Los archivos de Industrial y Desarrollo de Software asignan INF-244 a Introducción a la Robótica (C93/D93); los de IA, Ingeniería y Redes lo asignan a Base de Datos II (C43/D43). Esto confirma la necesidad de conservar ambas identidades, sin inventar otra sigla. Los encabezados de Ingeniería, Redes y Seguridad mencionan 2020, mientras el título general indica 2023; se conserva la fuente sin decidir automáticamente el año.

La clasificación de las **114 materias existentes** está en `src/modules/academico/data/planes-estudio.json`. Se contrastaron por nombre las tablas ajustadas con las siete páginas de la [malla 2023 publicada por la carrera](http://informatica.umsa.bo/static/pdf/malla2023.pdf), guardada en `referencias/malla2023-oficial.pdf`. Las tablas de convalidación no son listados exhaustivos; se usan para contrastar las materias del catálogo y añadir Taller de Proyecto (sexto semestre). Se mantienen las siglas del PDF de horarios, porque cambian respecto a la malla original. El archivo registra la fuente de cada relación. No se importaron otras asignaturas, docentes ni horarios de la malla oficial.

`GET /api/academico/menciones` devuelve las siete opciones. `GET /api/academico/materias` añade `planes`, `semestrePromedio` y `ordenPromedio`. La vista general promedia los semestres conocidos entre las menciones y desempata con el orden dentro del semestre; una mención seleccionada usa su propio semestre y orden. Las electivas sin semestre fijo aparecen después de las materias semestrales. Las materias sin correspondencia por nombre siguen visibles al final de General como “Sin plan asociado”; para incorporar o renombrar una, actualiza también su entrada del catálogo curricular. No se infiere una mención por el prefijo de una sigla. La carga cubre Software (59), Sistemas (55), Computación (53), Datos (51), Seguridad (52), Redes (52) e Industrial (38), con materias comunes incluidas en cada filtro. No requiere migración de base de datos.

Las páginas **Horarios** y **Ver Horarios** comparten un horario fijo del semestre, sin selector de semana ni fechas en los encabezados. El formato sigue `referencias/horarios 2-2026.pdf`: bloques de dos horas de 08:00 a 22:00, sigla/paralelo y responsable, con tonos claros. Se añaden límites intermedios si una sesión comienza o termina a otra hora; las clases desde 07:00 también se conservan. El editor siempre permite lunes a sábado; la consulta y la impresión añaden sábado cuando tiene ocupaciones. La duración inicial de una sesión es de dos horas, ajustable hasta las 22:00.

En **Asignar horario**, primero se elige la materia (en orden curricular) y luego solo aparecen sus docentes activos asignados en el periodo seleccionado. Al cambiar la materia o el tipo de responsable se limpian el responsable y el paralelo anteriores. Para auxiliarías se muestran únicamente los auxiliares activos vinculados a esa materia; si tienen varios paralelos, se elige el paralelo y docente correspondiente. Una única asignación se selecciona automáticamente.

El formulario ampliado abre **dos sesiones** con días sugeridos distintos y las mismas horas iniciales. En escritorio se muestran lado a lado y en móvil se apilan. Cada sesión admite su propio día, aula y horas; se puede quitar un día si solo se necesita uno. **Añadir otro día** conserva la posibilidad de registrar tres o más sesiones del mismo responsable y asignación. Todo el conjunto se valida y guarda en una transacción: un cruce cancela el conjunto completo. Una vez guardadas, las sesiones se editan o eliminan individualmente; editar abre únicamente la sesión seleccionada.

Para exámenes u otras actividades puntuales, elige **Reserva temporal**, indica motivo y una o más fechas concretas dentro del periodo. Solo ocupan el aula esas fechas. Se muestran todas las reservas vigentes y futuras del semestre con sigla/paralelo, responsable y **RESERVADO · dd/mm/aaaa**. Las reservas de distintas fechas que comparten una franja se apilan dentro de su celda, sin ocultarse entre sí. Se retiran de la vista al terminar su fecha en `America/La_Paz`; la pantalla se actualiza a medianoche y al recuperar el foco. Antes de imprimir se actualiza la fecha de forma síncrona. Los registros pasados se conservan en la base de datos y no bloquean otras fechas.

**Ver Horarios → Imprimir / PDF** utiliza el lugar y piso seleccionados, aunque haya un aula abierta. El botón **Imprimir aula** permite previsualizar solo esa aula. Se genera un PDF vectorial con texto seleccionable, mostrado en un visor nativo dentro de un diálogo; no se llama a `window.print()`. Cada hoja carta vertical contiene dos horarios, cada uno en media hoja; una selección impar deja libre la segunda mitad de la última hoja. Cada tabla se mide y reduce proporcionalmente si las reservas o los nombres largos exceden su mitad, conservando todo el contenido. Capacidad, equipamiento y controles administrativos se excluyen. Los colores de una asignatura/paralelo/responsable se mantienen entre días y entre pantalla e impresión. El visor permite reintentar errores y libera sus recursos al cerrarse.

Los cruces de aula, responsable (docente o auxiliar) y paralelo se comprueban por día, intervalo y fechas reales, incluso entre periodos activos cuyas fechas coinciden. Un auxiliar no ocupa la agenda del titular, pero el mismo paralelo no puede tener dos clases simultáneas. Dos solicitudes simultáneas no pueden reservar el mismo espacio. Los intervalos contiguos están permitidos. Se bloquean las bajas de aulas/asignaciones referenciadas y las desvinculaciones de auxiliares con horarios registrados.

El portal público y los reportes consumen las clases semanales persistidas, incluidas las auxiliarías. Las reservas temporales se consultan en el horario administrativo con su fecha; no se presentan como clases semanales permanentes en el portal. El endpoint autenticado `/api/academico/horarios` devuelve ambas modalidades para el horario administrativo. Las escrituras por varios días utilizan `POST /api/horarios/lote` con hasta 24 sesiones.

## Carga de docentes y horarios del PDF original (03/10/2026)

La fuente es `referencias/HORARIOS PASANTES PRACTICA PARA COLAR.pdf`. El archivo `data/horarios-ii-2026.json` conserva las líneas de origen, páginas, docentes, paralelos y decisiones de conciliación, con SHA-256 de ambos PDF. El PDF derivado `horarios 2-2026.pdf` aporta evidencia de sesiones AUX; no reemplaza los datos del original. El informe legible está en `referencias/INFORME-CARGA-II-2026.md`.

La carga aditiva creó 82 docentes (88 en total), 174 asignaciones y 287 sesiones semanales. Reconoció 8 sesiones existentes del PDF. Añadió P3-LAB4, conservando las otras 28 aulas. II/2026 conserva sus registros anteriores y queda con 182 asignaciones y 299 horarios, incluido el horario de auxiliar de prueba previo. No se importaron auxiliares ni vínculos nuevos. Se conservaron exactamente todos los campos de los registros anteriores, comprobados después de la carga.

Inicialmente se creó I/2027 vacío para pruebas. El 04/10/2026 se retiró por solicitud del usuario, después de comprobar que no tenía asignaciones ni cierre. Solo quedó II/2026. Se guardó respaldo de la fila retirada y se verificó que los otros periodos, asignaciones y horarios no cambiaran. El importador ya no crea periodos futuros: el usuario puede crearlos manualmente desde Horarios. Materias, aulas y docentes siguen siendo catálogos globales.

La conciliación considera 302 sesiones aptas en el original, excluye 57 sesiones marcadas AUX y deja 80 variantes de sesión pendientes por cruces, aulas múltiples o rol incierto; también informa 15 paralelos sin docente. Tres asignaciones anteriores tienen docentes distintos (INF-111 B, INF-112 B y C), y un horario previo impide cargar una sesión TRA-256 C. Su sustitución está pendiente de confirmación del usuario. Las sesiones con aulas distintas entre los dos PDF conservan el aula del original solicitado y se documentan como observaciones.

```sh
npm run prisma:importar:horarios             # Vista previa aditiva; no escribe
npm run prisma:importar:horarios -- --apply  # Altas que no chocan con los datos actuales
node prisma/generar-informe-horarios.cjs     # Actualiza el informe desde el resultado guardado
```

La repetición de la vista previa tras esta carga dio cero altas de docentes, aulas, asignaciones y horarios. El importador conserva contactos y otros campos existentes; no inventa capacidades, contactos ni docentes sin identificar. Crea un respaldo local completo de las tablas académicas en `prisma/backups/` antes de escribir. El bloqueo de la transacción coincide con el de la API, y un fallo revierte el conjunto. Comprueba contra el original cada docente y sesión del conjunto conciliado y valida que no haya cruces antes de insertar.

Solo si se autoriza expresamente sustituir II/2026: ejecutar una vista previa con `--replace-ii-2026`, revisar sus conteos y usar `--apply --replace-ii-2026 --expected-current-sha=<huellaActual>`. La huella impide sustituir datos que hayan cambiado desde la revisión. Este modo retira asignaciones, horarios y vínculos de auxiliares exclusivamente de II/2026; conserva personas y catálogos. No borra ni copia asignaciones en I/2027.

En **Auxiliares → Vincular materia**, el buscador filtra las materias activas por nombre o sigla, sin exigir tildes. Buscar no cambia silenciosamente la selección anterior: se mantiene identificada como seleccionada aunque quede fuera de los resultados. Al abrir de nuevo el formulario se limpia la búsqueda.

Se verificaron la compilación de ambos proyectos, las pruebas de semestre y el flujo completo en Chrome con API simulada. La verificación de base de datos confirmó I/2027 vacío, ausencia de nuevos auxiliares, conservación de todos los registros anteriores y 287 sesiones nuevas sin cruces. Las 439 variantes de sesión de los grupos con docente del original tienen exactamente una decisión: 302 aceptadas, 57 AUX excluidas y 80 pendientes.

## Buscador de aulas por necesidades (04/10/2026)

**Aulas**, **Ver horarios** y **Horarios** incluyen el botón **Buscar aula**. La búsqueda abarca todos los edificios, incluso si la pantalla tenía otro lugar seleccionado. Combina cantidad de estudiantes, tipo (aula/laboratorio), lugar, equipamiento registrado y texto por código, nombre, ubicación o equipo, sin exigir tildes. Por defecto muestra ambientes habilitados; esto no implica que estén libres en una franja horaria, que se consulta al abrir su horario.

Para un grupo de 30, primero aparecen capacidades de 30 o más, ordenadas de menor a mayor. Las capacidades menores se consultan opcionalmente en otra sección, con el número de plazas que faltan. Una capacidad 0 o desconocida se muestra como **Por confirmar**, nunca como capacidad suficiente. También puede desplegarse por separado al buscar una cantidad. No se inventaron ni modificaron capacidades o inventario. Los equipos con cantidad cero no se ofrecen como disponibles. Para obtener recomendaciones por capacidad hay que completar los valores reales desde **Aulas → Editar**.

Los resultados muestran capacidad, tipo, lugar, piso, estado y cantidades del equipamiento. **Ver aula** lleva al registro filtrado en Aulas; **Ver horario** abre directamente la vista del ambiente en las otras dos secciones. Se conservan la consulta e impresión del semestre y el bloqueo de asignaciones en aulas no habilitadas. El buscador funciona también con ambientes cuya ubicación falta confirmar. Admite teclado, cierre con Escape y vista móvil.

La prueba `frontend/tests/room-search.test.cjs` comprueba capacidad suficiente, cercanía, separación de capacidades insuficientes/desconocidas, combinación de filtros y valores inválidos. `academic-semester.browser.cjs` verifica la selección en las tres páginas, impresión del aula elegida, equipos con cantidades, filtros sin resultados, estado de mantenimiento y presentación móvil con una API simulada, sin cambiar datos reales.

## Grados académicos, filtros de docentes y colores (04/10/2026)

Se aplicó `20261004000000_grado_docente/migration.sql` y se regeneró Prisma. `docente.grado_academico` es opcional, de hasta 30 caracteres. El formulario de alta/edición permite Lic., M.Sc., Ph.D., Ing., M.Eng., MBA, Dr., Dra. y **Otro grado**. No se atribuyeron grados no confirmados a los docentes existentes. El nombre permanece separado del grado; la API devuelve `gradoAcademico` y `nombreConGrado`. Asignaciones, auxiliares vinculados al titular, formularios de horario, pantalla y PDF usan el nombre con grado. Omitir el campo desde un cliente anterior conserva el grado; enviar una cadena vacía lo retira.

La pantalla Docentes tiene dos desplegables con búsqueda: **Filtrar por materia** (nombre o sigla) y **Filtrar por docente** (nombre, grado, especialidad o correo). Las búsquedas ignoran tildes. Al elegir materia, el segundo desplegable ofrece sus docentes; cambiar materia limpia la elección anterior. Incluye **Sin materias asignadas**, vacíos claros, limpieza de filtros y manejo con flechas, Enter, Tab y Escape.

Horarios y Ver horarios usan una paleta de 24 colores vivos, con tonos fluorescentes. Se resuelven colisiones entre asignaciones del mismo periodo; si la paleta se agota, se generan tonos adicionales sin repeticiones exactas. Se conserva el color entre días, aulas y PDF. La clave distingue materia, paralelo, titular y auxiliar. La prueba de 200 asignaciones verificó colores distintos, independencia del orden de entrada y contraste mínimo de 4.5:1 con el texto oscuro. Los horarios continúan imprimiéndose en dos mitades de hoja carta.

## Comandos de verificación

```sh
npm run build
node tests/academico.integration.cjs
node tests/reservas-auxiliares.integration.cjs
```

La prueba de integración utiliza registros temporales para comprobar permisos, siglas compartidas con identidades distintas, relaciones, persistencia, choques, edición, eliminación, límites y concurrencia. También se verificó el frontend compilado en Chrome con la API real: altas de materia/docente/aula, asignación, filtros por lugar, ocupación de otros docentes, conflictos visibles, edición, eliminación y diseño móvil. Las cuentas y registros temporales de estas pruebas se retiraron al finalizar.

La actualización añade pruebas de paralelos concurrentes y transición Z→AA, reservas en distintas fechas, cruces entre periodos, cruce entre clase semanal y reserva, rechazo de fechas inválidas, rollback de lotes, vinculación y conflictos de auxiliares. La prueba de navegador `.preview-academico/browser-reservas.cjs` verificó A/B automáticos, carga por aula, dos horas por defecto, varias aulas y horas en un conjunto, reservas que desaparecen al cambiar de semana, auxiliarías, edición y eliminación. Los datos de estas pruebas también se retiraron.

Las pruebas antiguas de navegador en `.preview-academico/browser-visor.cjs` y `browser-reservas.cjs` documentan la interfaz anterior con selector de semana. La regresión de la nueva interfaz está en `frontend/tests/academic-semester.browser.cjs`; usa una API simulada y no modifica registros reales. Comprueba las siete menciones, las 114 materias, ambas identidades INF-244, reservas vencidas y futuras, cambio de fecha, edición con minutos, móvil y los PDF carta de una o todas las aulas. También verifica las cinco tarjetas de Aulas y Ver Horarios, las cuatro de Horarios, tarjetas de pisos, pisos vacíos, apertura del aula sin desplazamiento, regreso conservando el piso y Todos los lugares con horarios completos. Incluye impresión por lugar, piso o aula. En auxiliares comprueba filtros por materia y sin vinculaciones, búsqueda sin tildes, catálogo completo al vincular, exclusión de asignaciones inactivas o ya vinculadas, limpieza al cambiar materia y guardado de la vinculación correcta. Conserva las comprobaciones de materia antes de docente en horarios, filtros por asignación/periodo/estado, auxiliares y paralelos, dos días iniciales en columnas, guardado de tres días con aulas y horas diferentes, reducción a una reserva y edición de una sola sesión. Los PDF y capturas quedan en `.preview-academico/semestre/`.

Desde la raíz, después de compilar ambos proyectos:

```sh
node frontend/tests/academic-semester.test.cjs
node frontend/tests/room-search.test.cjs
node frontend/tests/academic-semester.browser.cjs
```
