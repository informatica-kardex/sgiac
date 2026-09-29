# Subadministradores

Desde **Subadministradores → Añadir subadministrador**, el administrador registra nombre completo, correo y CI. Existe un único rol **Subadministrador**. Consulta interna se conserva para estudiantes y no se ofrece como opción en esta gestión ni en Roles y permisos.

El checklist permite asignar independientemente aulas, horarios, comunicados, preguntas frecuentes, atención Kardex y reportes. Crear cuentas, gestionar estudiantes, asignar funciones, auditoría y configuración permanecen a cargo del administrador.

Cada función tiene su propia vigencia:

- **Sin límite de tiempo:** activa hasta que el administrador la retire.
- **Desde / hasta:** fecha y hora locales del navegador, enviadas a la API con zona horaria. El inicio está incluido y el fin excluido. El periodo se cumple una sola vez; no es un horario diario recurrente.
- Desmarcar una función la retira. Guardar una lista vacía deja la cuenta sin funciones, con acceso únicamente a su página de inicio.

**Asignar funciones** reemplaza las asignaciones anteriores. El servidor consulta los permisos y el estado actuales en cada petición; un JWT anterior no conserva privilegios retirados. El vencimiento se comprueba en el servidor, sin depender de tareas programadas ni de cerrar sesión. Las asignaciones vencidas siguen visibles para el administrador, pero no autorizan acceso. La interfaz revalida al navegar, enfocar la ventana y cada 30 segundos, y comprueba el horario de la ruta abierta cada segundo.

El primer ingreso sigue usando correo y CI como contraseña temporal, confirmación del correo y cambio obligatorio de contraseña. El CI se cifra; no se guarda en texto plano. Las operaciones sobre cuentas administradoras están protegidas.

## Base de datos

Migración: `prisma/migrations/20260928000000_subadmin_permissions/migration.sql`.

- Crea `permiso_usuario` con clave por usuario y módulo y campos opcionales `desde` / `hasta` (TIMESTAMPTZ).
- Valida módulos e intervalos en la base y habilita RLS sin políticas públicas; el backend usa su conexión de servicio.
- Crea el rol `SUBADMINISTRADOR` y convierte las asignaciones antiguas, conservando las funciones que estaban activas y uniendo ambos conjuntos cuando corresponda.
- Retira las asignaciones de los dos roles anteriores y deja sus registros inactivos. No cambia contraseñas ni asignaciones de administrador o estudiante.
- La creación de cuentas, asignación de funciones y registro de auditoría son transaccionales.

Esta base existente no usa un historial completo de Prisma Migrate. Desde `backend`, ejecutar una sola vez:

```powershell
node scripts/migrate-subadmin-permissions.cjs --check
node scripts/migrate-subadmin-permissions.cjs --apply
npm.cmd run prisma:generate
```

`--check` ejecuta la migración, valida que conserve las funciones y revierte la transacción. `--apply` valida y confirma. La migración se debe ejecutar antes de iniciar el backend actualizado; si Prisma no puede reemplazar su DLL en Windows, detener el backend, generar y volver a iniciarlo. No utilizar `db push` como sustituto: no convierte las asignaciones existentes.

## Verificación

Desde `backend`:

```powershell
npm.cmd run build
node -r ts-node/register/transpile-only --test tests/permissions.test.cjs tests/subadmins.test.cjs tests/comunicados.test.cjs tests/password-recovery.test.cjs tests/email-verification.test.cjs
```

Las pruebas usan persistencia simulada. Cubren límites horarios, zonas horarias, retirada inmediata con sesiones abiertas, validación de entradas, protección de administradores y estudiantes, creación, cambio de contraseña y autorización HTTP.
