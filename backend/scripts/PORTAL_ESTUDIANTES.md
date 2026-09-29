# Portal de estudiantes y registro

Se trabaja sobre `frontend/` y `backend/` en la raíz de F:\sgiac.

## Cuenta creada directamente en la BD

- Correo: `estudiante.prueba@example.test`
- Contraseña de prueba: `Estudiante2026!Kardex`
- CI: `PRUEBA-240926`
- RU: `PRUEBA-2026-001`
- Mención: Ingeniería de Sistemas
- Rol: `CONSULTA_INTERNA`, sin permisos administrativos.
- Acceso: `/login`.

El script **crear_estudiante_prueba.sql ya fue ejecutado** en la BD configurada en `backend/.env`.
Puede volver a ejecutarse: conserva la contraseña y los datos de la cuenta existente.
El dominio `example.test` identifica cuentas de prueba y no es un buzón real.
La cuenta no requiere 2FA y no se marca falsamente como correo verificado.

## Cambios en la base de datos

No se agregaron ni eliminaron tablas o columnas. El script:

1. Sincroniza las secuencias de las tablas de autenticación para evitar colisiones de IDs después de cargas manuales. No retrocede una secuencia adelantada.
2. Crea el usuario, su estudiante, su relación de rol y una entrada de bitácora.
3. Conserva los demás usuarios y datos.

La Mención se guarda en la columna existente `estudiante.carrera`.
Los nuevos registros dejan `semestre` y `gestion` en NULL. Los valores históricos se conservan.
No se modificó `.env`.

El error original de unicidad no se reprodujo con una inserción de diagnóstico, que fue revertida. Al revisar la BD solo existía el administrador. Se sincronizaron las secuencias y se comprobó un registro nuevo completo.

## Verificación realizada

- Frontend y backend compilan.
- Registro mediante Chrome y formulario real: HTTP 201; usuario, estudiante, mención y rol comprobados en PostgreSQL.
- Cuenta creada por formulario: `registro.frontend.0295001085@example.test`, con la misma contraseña de prueba indicada arriba.
- Repetir correo, CI o RU devuelve HTTP 409 con un mensaje específico.
- Inicio de sesión, restauración de sesión, perfil, horarios y navegación móvil comprobados en navegador.
- La prueba de navegador controla el CAPTCHA solo dentro de su proceso y simula un fallo de correo. No se ha verificado la entrega real de correo. El formulario informa correctamente que la cuenta sí fue creada.
- 11 pruebas de estudiantes y 16 pruebas existentes de seguridad de login pasaron.
- Una prueba con PostgreSQL verificó creación de ficha, historial, privacidad entre estudiantes, cupos y duplicados. La jornada y ficha temporales se revirtieron al terminar; las secuencias pueden tener saltos normales.

Capturas: `../../.preview-estudiantes/`.

## Fichas y disponibilidad

Las fichas del estudiante se guardan en `ficha_atencion` y `historial_ficha`, vinculadas a su perfil y a una `jornada_atencion` activa. El servidor toma la identidad de la sesión y bloquea la jornada durante la asignación del número y cupo.

La BD actualmente no tiene jornadas configuradas. Kardex debe cargar fechas, horario, cupo y responsable en `jornada_atencion` antes de que haya turnos disponibles. El portal muestra un estado vacío hasta entonces; no crea horarios de atención ficticios.

El módulo administrativo y el formulario de contacto público existentes siguen usando su repositorio de demostración en memoria. Las nuevas fichas del estudiante tienen persistencia propia en las tablas reales; conectar la bandeja administrativa a esas tablas queda pendiente de la parte administrativa.

## Ejecutar la aplicación

Reiniciar el backend (`npm run dev` dentro de `backend`) y el frontend (`npm run dev` dentro de `frontend`).

Pruebas locales desde `backend`:

```powershell
node -r ts-node/register/transpile-only tests/estudiantes.test.cjs
node -r ts-node/register/transpile-only tests/login-security.test.cjs
node scripts/verificar_fichas_transaccion.cjs
```

La prueba de navegador requiere compilar ambos proyectos y Chrome instalado. Crea una cuenta real de prueba si no existe el sufijo seleccionado:

```powershell
$env:TEST_STUDENT_SUFFIX='0295001085'
node scripts/verificar_portal_estudiante.cjs
```
