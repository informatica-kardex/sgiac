El CAPTCHA del login institucional y administrativo contiene seis caracteres (letras y números), vence a los cinco minutos y admite un único intento. No distingue mayúsculas de minúsculas.

El 2FA es opcional y queda desactivado por defecto para cuentas existentes y nuevas. Cada usuario puede activarlo o desactivarlo desde su cuenta; los administradores lo encuentran en Configuración. Ambos cambios requieren la contraseña actual y un código enviado al correo de la cuenta. Solo una confirmación correcta guarda la preferencia en la base de datos.

Para enviar códigos en pruebas, configurar `MAIL_PROVIDER="mailtrap"`, `MAILTRAP_API_TOKEN`, `MAILTRAP_INBOX_ID` y `MAIL_FROM` en `backend/.env`. Se usa la API de Email Sandbox; los mensajes se consultan en la bandeja de Mailtrap. Para envío real, usar `MAIL_PROVIDER="resend"`, `RESEND_API_KEY` y un `MAIL_FROM` de un dominio verificado en Resend. `LOGIN_MAIL_FROM` sigue admitido cuando no se define `MAIL_FROM`. Sin configuración se permite iniciar sesión con 2FA desactivado, pero no activarlo. Los códigos no se devuelven en la API ni se imprimen en consola. Ver los pasos de configuración en la sección 16 del README.

Los códigos vencen a los cinco minutos, admiten cinco intentos y son de un solo uso. Solicitar otro requiere esperar un minuto e invalida el anterior. Los retos se mantienen temporalmente en memoria: reiniciar el backend requiere comenzar el proceso de nuevo. Esta implementación usa una instancia del backend; para varias instancias se necesita un almacén compartido de retos y límites. La preferencia de 2FA sí persiste en PostgreSQL.

Mailtrap también funciona mediante SMTP: usar `MAIL_PROVIDER="smtp"`, un `MAIL_FROM` con formato de correo, `SMTP_HOST="sandbox.smtp.mailtrap.io"`, `SMTP_PORT="587"`, `SMTP_ENCRYPTION="tls"` y el usuario y contraseña de la pestaña SMTP del sandbox en `SMTP_USERNAME` y `SMTP_PASSWORD`. Esta modalidad no necesita `MAILTRAP_API_TOKEN` ni `MAILTRAP_INBOX_ID`. Mantener una sola definición de cada variable. Los códigos se consultan en Mailtrap Sandbox, no en la bandeja real del destinatario.

El backend carga siempre `backend/.env` y respeta las variables definidas por el entorno del proceso. Con `npm run dev`, los cambios del `.env` reinician el servidor; después de incorporar `nodemon.json` a una sesión ya abierta, reiniciar una vez el comando de desarrollo para cargar esa configuración. En producción, reiniciar el proceso después de cambiar las variables. El transporte SMTP utiliza las CA de Node y, cuando la versión de Node lo permite, las CA de confianza del sistema operativo, conservando la validación del certificado y STARTTLS obligatorio. En versiones antiguas de Node, configurar las CA necesarias con `NODE_EXTRA_CA_CERTS` antes de iniciar el proceso.

En una instalación existente sin historial de migraciones, aplicar únicamente la columna nueva desde `backend`:

```powershell
node node_modules/prisma/build/index.js db execute --file prisma/migrations/20260921000000_optional_login_2fa/migration.sql --schema prisma/schema.prisma
node node_modules/prisma/build/index.js generate
```

Pruebas aisladas, sin consultar la base de datos ni enviar correos reales:

```powershell
node -r ts-node/register/transpile-only --test tests/login-security.test.cjs
```
