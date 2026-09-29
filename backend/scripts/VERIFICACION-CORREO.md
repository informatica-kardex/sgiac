# Confirmación de correo y contraseñas

- Estudiantes: crear cuenta → pantalla de confirmación → código de 6 dígitos → iniciar sesión.
- Subadministradores: ingresar con correo y CI → confirmar correo → cambiar contraseña temporal → pantalla de éxito → iniciar sesión con la nueva contraseña.
- Las cuentas existentes con `correo_verificado = false` también deben verificar su correo. Las sesiones pendientes solo pueden consultar su perfil y cerrar sesión; el servidor bloquea los módulos y el cambio de contraseña.
- Los códigos vencen a los 15 minutos. Un reenvío requiere esperar 60 segundos y anula los anteriores. La confirmación es de un solo uso y limita intentos incorrectos por cuenta.
- Si el envío falla después del registro, la cuenta queda pendiente. Se puede reenviar el código sin volver a crearla; también se puede retomar desde el login.
- El medidor se completa con 8 caracteres o más, mayúscula, minúscula, número y símbolo. No exige 12 ni 14 caracteres. La misma política se valida en registro, cambio y recuperación; el login sigue aceptando el CI temporal y las contraseñas anteriores.

## Mailtrap Email Sending

En `backend/.env`:

```dotenv
MAIL_PROVIDER="mailtrap-sending"
MAILTRAP_SENDING_TOKEN="token API del dominio verificado"
MAILTRAP_SENDING_FROM="SGIAC <acceso@tu-dominio-verificado>"
```

Obtén el token en **Sending Domains → dominio verificado → Integration → API → Transactional Stream**. El remitente debe pertenecer al dominio verificado. Esta integración usa `https://send.api.mailtrap.io/api/send`, no la bandeja Sandbox. Las variables anteriores de SMTP y Sandbox se conservan y no se usan cuando el proveedor seleccionado es `mailtrap-sending`.

Reinicia el backend al completar las variables. No se imprimen códigos ni credenciales en los logs. Si faltan token o remitente, la aplicación informa que el envío no está configurado y conserva la cuenta pendiente.

Referencia oficial: https://docs.mailtrap.io/email-api-smtp/setup/api-integration

## BD y pruebas

No requiere SQL ni migraciones. Reutiliza `usuario.correo_verificado` y `email_verification_token`. Los nuevos códigos se almacenan como hash SHA-256 en la columna `codigo` existente (TEXT). Los códigos emitidos por la versión anterior deben reenviarse.

Pruebas sin escribir en la BD ni enviar correos reales:

```powershell
node -r ts-node/register/transpile-only --test tests/email-verification.test.cjs
node -r ts-node/register/transpile-only --test tests/subadmins.test.cjs
node -r ts-node/register/transpile-only --test tests/login-security.test.cjs
node -r ts-node/register/transpile-only --test tests/estudiantes.test.cjs
node -r ts-node/register/transpile-only --test tests/mail.test.cjs
```
