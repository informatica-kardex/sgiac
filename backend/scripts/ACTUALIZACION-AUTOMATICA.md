# Actualización automática y solicitudes de aulas

`GET /api/events` envía avisos SSE a sesiones autenticadas. Una escritura HTTP correcta avisa después de terminar su respuesta; los errores, las lecturas de disponibilidad y la renovación de sesión no generan avisos. Los mensajes no contienen registros ni datos personales. Cada pantalla vuelve a consultar sus endpoints con los permisos habituales.

El cliente se reconecta con espera progresiva y renueva el token mediante el interceptor existente. La conexión se abre de nuevo cada minuto para verificar la sesión. El proxy debe permitir streaming sin buffering (se envía `X-Accel-Buffering: no`). Reiniciar el backend permite activar esta ruta si se estaba ejecutando una compilación anterior.

Los módulos académicos, panel, usuarios, comunicados, preguntas frecuentes, roles y reportes refrescan en segundo plano, también al volver a la pestaña o recuperar conexión. Conservan filtros y formularios. Las bandejas que usan `usePolling` reciben los mismos avisos. Hay consultas periódicas de respaldo: 10 segundos para solicitudes de aulas, 60 segundos para catálogos administrativos, y los intervalos propios de documentos y atención. Las lecturas automáticas tienen un límite separado del presupuesto de escrituras e inicio de sesión.

Los avisos SSE son locales a la instancia del servidor. Con varias instancias, las consultas periódicas recuperan cambios de otras instancias; para avisos inmediatos entre todas se necesitaría un bus compartido. Los cambios directos en la base de datos también se recuperan mediante esas consultas.

La aprobación conserva la transacción que crea y vincula todas las sesiones de una solicitud, sea un día, dos fechas o todo el semestre. Una alternativa reserva sus sesiones al ser aceptada por el auxiliar. Al aprobar desde el panel, se abre automáticamente **Ver Horarios** con el aula y periodo reservados; las solicitudes aprobadas también tienen un enlace a ese horario. Cancelar elimina las sesiones asociadas.

Después de compilar ambos proyectos, desde la raíz:

```sh
node --test backend/tests/realtime.test.cjs backend/tests/solicitudes-aulas.test.cjs
node frontend/tests/live-schedules.browser.cjs
node frontend/tests/academic-semester.browser.cjs
```

Estas pruebas usan datos simulados. El navegador comprueba notificaciones SSE producidas por otra sesión, aprobación con dos fechas, actualización de admin/subadmin, orden de lugares, horarios de todas las aulas, filtros y conservación de un formulario abierto. Las capturas quedan en `.preview-academico/live-schedules/`.
