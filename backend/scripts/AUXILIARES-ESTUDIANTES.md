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
