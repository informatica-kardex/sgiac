El ingreso es único en `/login`, mediante `/api/auth/login` y `/api/auth/login/verify`. El perfil devuelto por el servidor determina el área: estudiante o panel de administrador/subadministrador. `/admin/login` redirige al mismo formulario; los endpoints administrativos anteriores permanecen como compatibilidad y usan la misma lógica de credenciales.

La sesión vence tras **3 minutos de inactividad**, con un aviso **30 segundos antes** y la opción de continuar. Solo la interacción con la página visible o el botón de continuar llama a `/api/auth/activity`; el polling, `/auth/me` y la renovación de tokens no extienden el plazo. El servidor comprueba el vencimiento en cada acceso protegido y limita la duración absoluta a ocho horas. El plazo y el cierre se sincronizan entre pestañas. Al volver de una suspensión o recargar, se conserva el vencimiento del servidor.

Se reutiliza la tabla `refresh_token`: `expira_en` guarda el vencimiento por inactividad y `creado_en` el comienzo de la sesión. **Este cambio no requiere migración de base de datos.** Los tokens anteriores requieren volver a iniciar sesión una vez. Cada access token queda ligado a una sesión revocable; el refresh rota de forma atómica sin modificar el vencimiento. Las cookies son de sesión y httpOnly; el refresh ya no se expone en JSON. En producción, las cookies siempre usan Secure y requieren HTTPS.

Los roles, el estado de la cuenta, el correo confirmado, la contraseña temporal y los permisos vigentes se validan en el servidor. El registro público conserva exclusivamente el rol de estudiante. Los horarios ya no se cargan en el portal público y `/api/horarios` requiere autenticación, incluso para leer un detalle.

El CAPTCHA contiene seis caracteres (letras y números), vence a los cinco minutos y admite un único intento. No distingue mayúsculas de minúsculas.

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
node -r ts-node/register/transpile-only tests/session-security.test.cjs
node -r ts-node/register/transpile-only tests/subadmins.test.cjs
```

Prueba de navegador desde la raíz (Chrome instalado; API simulada, sin usar cuentas reales):

```powershell
cd frontend
node node_modules/vite/bin/vite.js build --outDir ../.preview-auth/dist
cd ..
node frontend/tests/session-security.browser.cjs
```

Los controles de vencimiento en servidor y comprobación de permisos por petición siguen las guías de [sesiones](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) y [autorización](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) de OWASP.
