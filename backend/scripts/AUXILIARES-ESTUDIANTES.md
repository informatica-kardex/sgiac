# Auxiliares vinculados a estudiantes

La sección `/admin/auxiliares` tiene acceso propio en el menú. El administrador también puede habilitar y quitar auxiliares desde `/admin/estudiantes`, donde puede crear cuentas institucionales con CI temporal, verificación de correo y cambio de contraseña obligatorio.

El alta recibe únicamente `idEstudiante` e `idAsignacion`. El servidor toma la identidad de la ficha del estudiante, exige una cuenta institucional activa y valida la materia, docente, paralelo y periodo. La relación única `auxiliar.id_estudiante` permite consultar la habilitación desde la cuenta (`usuario.estudiante.auxiliar`) para futuras funciones, sin convertir al estudiante en administrador.

La baja conserva la cuenta y el registro histórico del auxiliar, cambia su estado a `INACTIVO` y retira sus vinculaciones. Puede habilitarse nuevamente utilizando el mismo registro. Si tiene horarios o reservas asignados en un periodo activo, primero deben retirarse en Horarios. La baja masiva se realiza en una transacción y no quita ninguno si hay un impedimento. Los registros antiguos se conservan y ofrecen la acción **Vincular estudiante**.

Los subadministradores necesitan el permiso independiente `auxiliares`; el permiso `docentes` no lo concede. La creación de cuentas sigue siendo exclusiva del administrador.

Para otra instalación, desde `backend/`:

```powershell
node scripts/migrate-auxiliares.cjs --check
node scripts/migrate-auxiliares.cjs --apply
npm run prisma:generate
npm run build
```

Reiniciar el backend después de regenerar Prisma. No usar `migrate reset` ni `db push` sobre esta base existente.

Verificación:

```powershell
node -r ts-node/register/transpile-only tests/auxiliares.test.cjs
node tests/auxiliares.integration.cjs
```

La prueba de integración usa HTTP y la base configurada dentro de una transacción que siempre se revierte; no envía correos.

## Carnet y QR del horario

En **Administrador → Auxiliares → Carnet y QR**, un administrador o subadministrador con permiso `auxiliares` puede generar el carnet de un auxiliar con cuenta activa. El PDF tiene dos caras de 85,6 × 54 mm: nombre, RU y correo institucional en el frente, y QR en el reverso. Imprimir al 100 %, sin ajustar a página. No requiere nuevas dependencias ni migraciones de base de datos.

El QR abre `/auxiliares/carnet/:referencia`. Esta página es independiente, no aparece en el menú ni en las secciones del portal, no lista auxiliares y se marca `noindex`. Quien tenga el QR o su enlace puede consultar sin cuenta ni aplicación adicional; necesita conexión al sitio. No es una credencial de acceso al sistema.

### Mi auxiliatura (cuenta del estudiante)

El auxiliar habilitado accede desde **Mi inicio → Mi auxiliatura** o desde el menú de su cuenta estudiantil. La ruta privada es `/usuario/mi-auxiliatura`. Si tiene una sola asignación vigente, se abre directamente; con varias elige materia, paralelo y periodo. Allí consulta el docente titular, la vigencia, sus horarios y reservas confirmadas, y las solicitudes de esa materia. Puede crear una solicitud con la materia preseleccionada, revisar alternativas y seguir el proceso existente. El enlace a todas sus solicitudes conserva el acceso al historial de otros periodos.

**Mi carnet de auxiliar** permite descargar, imprimir y consultar el mismo carnet personal que obtiene el administrador: es válido para todas las materias del auxiliar. Su QR conserva la consulta pública de todas sus asignaciones vigentes. Seleccionar otra materia filtra el espacio privado y las solicitudes; no cambia ni invalida el QR.

El frente también imprime las materias vinculadas en periodos activos que no hayan finalizado, incluso si todavía no tienen horarios. No repite una materia por tener varios paralelos. La vista previa incluye la lista completa; en la tarjeta se resumen nombres muy largos y listas extensas para conservar las dos caras y el tamaño físico. Para reflejar cambios en las materias impresas hay que volver a descargar el PDF; el enlace QR sigue siendo el mismo.

`GET /api/estudiantes/auxiliatura` y `GET /api/estudiantes/auxiliatura/carnet` requieren la sesión verificada del usuario y resuelven el auxiliar mediante `estudiante.id_usuario`. No aceptan un identificador de auxiliar para consultar carnets ajenos ni conceden permisos administrativos. Al retirar la habilitación se oculta el acceso, el servidor rechaza el carnet personal y la página informa de la baja. Si solo se retira una materia, deja de aparecer en el selector. Sin materias vigentes se muestra el estado vacío y se conserva el carnet personal mientras la cuenta siga habilitada.

La consulta pública expone únicamente el nombre y las asignaciones académicas: aula, ubicación, día, horas, materia, paralelo y vigencia. No expone CI, RU, correo, teléfono ni motivos de reservas. Lee directamente los horarios publicados y las reservas asignadas; excluye reservas pasadas, periodos finalizados y relaciones inactivas. Los horarios semanales futuros indican sus fechas de vigencia. Se actualiza cada 30 segundos, al volver a la pestaña, al recuperar conexión o al pulsar Actualizar. Ante errores oculta la asignación anterior hasta poder confirmarla. Cambiar o retirar un horario desde los flujos existentes se refleja en el mismo QR. Dar de baja al auxiliar o su cuenta deshabilita la consulta; reactivar la misma identidad permite usar nuevamente su carnet.

### Dirección para escanear desde celulares

La producción está preparada para un solo dominio: `frontend/.env.production` utiliza `/api`, el QR toma el origen del sitio y el backend con `NODE_ENV=production` sirve `frontend/dist/` junto con la API. Ver [preparación del servidor](SERVIDOR.md). No se ha publicado el sistema ni configurado un dominio real.

Antes de entregar carnets definitivos, el frontend y la API deben ser accesibles desde los teléfonos:

- En `frontend/.env`, `VITE_PUBLIC_SITE_URL=https://tu-dominio-del-sistema` fija el origen del enlace impreso. Sin esta variable se usa el origen del panel que genera el carnet. El sistema avisa si apunta a localhost.
- `VITE_API_URL` debe apuntar a la API accesible desde ese sitio. `FRONTEND_URL` del backend debe coincidir con el origen del frontend para CORS. En producción usar HTTPS en ambos.
- Recompilar el frontend después de cambiar sus variables. El servidor Node incluido ya devuelve `index.html` al abrir directamente `/auxiliares/carnet/*`. Si se aloja el frontend por separado, configurar esa misma regla en el hosting.
- Conservar el dominio usado en los carnets impresos. Una dirección localhost solo funciona en la computadora que ejecuta el sistema. Para pruebas en red local, usar la IP accesible del equipo, servir Vite con `--host` y configurar API/CORS para ese origen.

La referencia lleva una firma HMAC con contexto propio y vinculada al estudiante. No caduca por el cierre de sesión ni al editar horarios. Opcionalmente definir una clave aleatoria y persistente `AUXILIAR_CARNET_SECRET` en `backend/.env` **antes de imprimir** para independizarla de las claves de sesión. Si se omite usa `JWT_SECRET`. Cambiar la clave efectiva invalida los QR anteriores y requiere reimprimir. No poner claves del backend en variables `VITE_*`.

Verificación sin modificar datos reales:

```powershell
# Desde backend/
node -r ts-node/register/transpile-only --test tests/auxiliar-carnet.test.cjs tests/auxiliares.test.cjs tests/teacher-schedules.test.cjs tests/schedule-responsibility.test.cjs
npm run build
# Desde frontend/
npm run build
# Desde la raíz, con Chrome instalado:
node frontend/tests/auxiliar-carnet.browser.cjs
```
