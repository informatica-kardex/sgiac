# Fichas y atención de Kardex

Implementado en `backend/` y `frontend/` (la copia `sistema/` no se utiliza).

## Uso

1. En **Administrador → Fichas y atención → Tipos de trámite**, crear, editar o eliminar los motivos de atención. Inicialmente existen historial/récord, adición/retiro y choque de horarios.
2. En **Atención y cupos**, elegir la fecha y **Programar jornada**. Se permite una jornada por trámite y fecha, con horario y puesto de atención.
3. Elegir **Calcular según tiempo** (duración del horario / minutos por estudiante, redondeando hacia abajo) o **Límite manual**. Por ejemplo, 08:00–12:00 a 10 minutos produce 24 fichas. El límite es por trámite y día; los resúmenes muestran la suma de todos los trámites del día.
4. El estudiante abre **Mis fichas → Solicitar nueva ficha**, selecciona trámite y jornada y pulsa **Generar mi ficha**. No introduce nombre ni correo: se obtienen de su cuenta autenticada. El detalle es opcional.
5. El administrador selecciona la jornada y pulsa **Llamar siguiente**. Atiende siempre al menor número pendiente. **Volver a llamar** repite el anuncio; **Finalizar atención** y **No se presentó** concluyen el turno. Después se llama al siguiente.
6. `/atencion` y las fichas del estudiante muestran únicamente el turno actual por trámite. Se actualizan cada cinco segundos, sin botones para presentar en TV, multimedia ni controles de voz.

El código `J<jornada>-<número>` distingue las colas. El tablero público muestra código, trámite y puesto; nunca nombre, correo, RU o detalle. En su ficha privada, el estudiante ve su nombre, estado, personas delante y espera aproximada. Las estimaciones son orientativas, desde el inicio de la jornada o el turno actual; no constituyen citas a una hora exacta.

La fecha y el horario utilizan Bolivia (UTC−4), independientemente de la zona horaria del servidor. Los llamados se habilitan el día de la jornada desde la hora inicial. Se puede terminar la cola después del cierre del horario; no se aceptan nuevas reservas después de la hora final. No se atienden fichas futuras.

## Reglas y concurrencia

### Pantalla para televisión

Desde el panel administrativo, abrir **Atención → Configurar TV → Presentar en TV**. Solo el administrador y los subadministradores con permiso vigente de fichas acceden a los controles. El visor `/atencion/pantalla` permanece público para la computadora o Smart TV de recepción, sin botones, navegación ni opciones de configuración.

Distribución: último llamado y ventanilla a la izquierda, contenido informativo/multimedia a la derecha y cinco llamados recientes en una franja inferior. El resaltado dura unos segundos y respeta la preferencia de movimiento reducido del navegador.

El historial se obtiene de `historial_ficha`: permanece al recargar y al finalizar una atención. Los rellamados actualizan la posición sin duplicar la ficha. En una atención ya concluida se indica su estado para no pedir al estudiante que vuelva a pasar.

En **Configurar TV** se activa/desactiva la voz, se envía una prueba de voz, se actualiza el contenido de las pantallas y se publican o retiran archivos. Hasta 20 archivos PNG/JPG/WebP/MP4/WebM, de 100 MB como máximo cada uno, en orden de carga. Los cambios llegan a todas las pantallas conectadas al mismo backend cada cinco segundos, incluso en otras computadoras. Todas las operaciones de configuración y subida verifican permisos en el servidor.

Los videos son silenciosos para no interferir con los llamados. Las imágenes cambian cada 12 segundos y los videos al terminar o a los 45 segundos. Sin archivos publicados, se alternan comunicados públicos; sin comunicados disponibles, aparecen consejos de Kardex. No se muestran noticias ni clima de fuentes externas.

La configuración y los archivos se conservan en `backend/uploads/tv` (o `TV_UPLOAD_DIR`) al recargar, cerrar el navegador o reiniciar el backend. Incluir esta carpeta en el almacenamiento persistente y las copias de seguridad del servidor. El guardado JSON es atómico y serializa las operaciones de una instancia de Express; despliegues con múltiples instancias requieren almacenamiento y coordinación compartidos.

Pantalla completa: mover la ventana al televisor y pulsar **F11** allí. El navegador exige interacción local para ciertas funciones; si bloquea la voz, hacer un clic en la TV para habilitar el audio y después usar **Probar voz en TV** desde el panel. La configuración no se realiza en el visor.

La pantalla advierte cuando pierde conexión y vuelve a consultar automáticamente. **Esta vista no requiere cambios adicionales en la estructura de la BD.**

Los archivos públicos de TV permiten su visualización desde el origen del portal aunque este use otro puerto o dominio (`Cross-Origin-Resource-Policy: cross-origin` solo en la ruta de medios). Las respuestas parciales de video conservan esta cabecera. Si un archivo falla temporalmente, el visor reintenta automáticamente; **Actualizar TV** reinicia también el contenido.

- Cupo y numeración se asignan en transacciones con bloqueo de la jornada. Las solicitudes concurrentes no sobrepasan el límite ni repiten números.
- Una ficha vigente por estudiante y jornada, incluso cuando ya fue atendida o no se presentó. Para otro trámite puede solicitar otra ficha.
- El estudiante puede cancelar una ficha pendiente de hoy o futura. Libera el cupo; el número no se reutiliza. Si solicita de nuevo queda al final de la cola.
- Las atendidas y no presentadas consumen cupo diario. No se permite reducir el cupo por debajo de las fichas vigentes.
- Con fichas emitidas no se cambia la fecha, horario, trámite ni puesto de la jornada. Sí se puede ajustar cupo/duración o pausar.
- Pausar detiene reservas y nuevos llamados; permite finalizar la atención actual y conserva la cola.
- Eliminar un trámite lo archiva, pausa sus jornadas actuales/futuras y conserva las fichas. Se impide eliminarlo si tiene turnos pendientes actuales/futuros. Su nombre queda reservado en el catálogo histórico.
- Cada generación, cancelación, llamado, rellamado y conclusión se registra en `historial_ficha` con el usuario autenticado. El cliente no elige el responsable.
- Dos operadores llamando simultáneamente reciben la misma ficha actual. Finalizar una ficha ya concluida da conflicto; nunca modifica al siguiente estudiante.
- Los reportes de fichas consultan PostgreSQL, no datos simulados.
- Las actualizaciones automáticas usan límites de frecuencia separados del resto de la navegación, con control por cuenta en las consultas privadas.

## Cambios de BD

Migración: `prisma/migrations/20260929000000_fichas_atencion/migration.sql`.

- Nueva tabla `tramite_atencion`: nombre, descripción, activo. RLS habilitado; acceso mediante el backend, igual que las tablas existentes.
- `jornada_atencion`: `id_tramite` (nullable para jornadas antiguas), `modo_cupo`, `minutos_por_estudiante`, `puesto`.
- Índice único por `(fecha, id_tramite)` e índice de búsqueda de fichas por jornada/estado.
- Tres trámites iniciales. No crea jornadas, no modifica usuarios ni elimina fichas existentes. No cambia los estados admitidos por la BD.

Esta migración **se aplicó a la BD configurada en `backend/.env` durante la implementación**. Para otra instalación, desde `backend/`:

```powershell
node scripts/migrate-fichas.cjs --check
node scripts/migrate-fichas.cjs --apply
npx prisma generate
npm run build
```

`--check` ejecuta y revierte la migración. El script es idempotente y utiliza el mismo mecanismo SQL explícito que las migraciones anteriores de esta BD existente; no establece un historial base para `prisma migrate deploy`. No ejecutar `migrate reset` ni usar `db push` para sustituirlo.

Reiniciar el backend en ejecución después de regenerar Prisma. No fue necesario agregar dependencias.

## Verificación

```powershell
cd backend
npm run build
node scripts/verificar_atencion.cjs
cd ../frontend
npm run build
cd ..
node .preview-fichas/check.cjs
node .preview-fichas/check-tv.cjs
node .preview-fichas/check-tv-media.cjs
```

La prueba de backend utiliza PostgreSQL y HTTP reales: crea cuentas y jornadas sintéticas identificadas por un prefijo único, prueba concurrencia y permisos, y elimina exclusivamente esos registros al terminar. Las secuencias avanzan. No depende de cuentas de prueba preexistentes; necesita el rol `ADMINISTRADOR` creado por la instalación.

La prueba visual usa Chrome sin interfaz, API simulada y archivos de `frontend/dist`. Cubre cálculo de cupos, generación sin identidad manual, atención, tablero, privacidad y móvil. Guarda capturas en `.preview-fichas/`.

`check-tv-media.cjs` prueba imágenes y videos contra HTTP real, incluyendo las cabeceras de Helmet y el servicio de archivos, con frontend y backend en orígenes distintos. Verifica carga de imagen, reproducción y repetición de video, rangos HTTP y recuperación de fallos de red. Usa archivos temporales propios; no modifica la BD ni los archivos publicados por el usuario.
