# Portal público y estudiantil

Se restauró la presentación anterior al rediseño general: portada y fotos, navegación, secciones del inicio, páginas de comunicados, preguntas frecuentes, horarios, información, atención y pie de página.

## Arma tu horario

Es la única mejora del rediseño que se conserva. El planificador permite:

1. Seleccionar mención y semestre y añadir materias del catálogo académico existente.
2. Usar «Añadir clase» o «Elegir día y hora» con la materia precargada. La cuadrícula también permite colocar clases directamente. Aula, grupo y docente son opcionales.
3. Seleccionar un periodo y marcar la versión personal para verla al entrar al inicio. Requiere clases y ausencia de cruces; no equivale a una inscripción oficial.

Las opciones de duplicar, renombrar, crear o eliminar versiones están en «Otras versiones y opciones». En móvil se abre un día a la vez, con opción de ver toda la semana.

El catálogo proviene de `GET /api/estudiantes/catalogo-horario`, que requiere un estudiante activo. Las versiones permanecen en `localStorage`, separadas por cuenta, con la misma clave v1 compatible con los horarios anteriores. Se conservan al cerrar sesión; no se sincronizan entre dispositivos. La preferencia muestra un aviso discreto en el inicio únicamente cuando existe un horario elegido. Sus clases de hoy se calculan en hora de Bolivia y dentro del periodo guardado.

Los estilos del planificador están en `src/styles/schedule-planner.css`; no se carga el rediseño general del portal.

## Verificación

- Frontend: `npm run build` y `node tests/schedule-planner.test.cjs`.
- Backend: `npm run build` y `node -r ts-node/register/transpile-only tests/planner-catalog.test.cjs`.
- Desde la raíz tras compilar: `node .preview-portal/check.cjs` verifica la estructura anterior y su navegación; `node frontend/tests/schedule-planner.browser.cjs` verifica el catálogo, formulario, versiones, recordatorio, guardado, errores y móvil.

Las pruebas de navegador utilizan API simulada y perfiles de Chrome de prueba; no escriben en la base de datos.
