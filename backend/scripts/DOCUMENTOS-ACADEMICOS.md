# Solicitudes de documentos académicos

## Acceso y puesta en marcha

- Administrador: `/admin/documentos` → **Documentos y periodos**.
- Estudiante: `/usuario/documentos`, desde **Mis documentos** en el menú o el inicio.
- En Subadministradores, asigna la función **Gestionar solicitudes de documentos** al personal encargado, con vigencia opcional. Puede preparar, asignar responsables, marcar listo, reprogramar, rechazar y registrar entregas. Solo ADMINISTRADOR configura documentos y periodos.
- Récord académico e historial académico se crean deshabilitados. El administrador define y habilita cada periodo; por ejemplo, la convocatoria de Beca Comedor.

El módulo registra solicitudes y entrega de documentos físicos. No genera notas ni imprime automáticamente el récord: el personal utiliza su procedimiento académico de impresión y después marca **Documento impreso y listo**.

## Flujo

1. El administrador configura nombre, identificador de fichas, campaña, apertura/cierre de solicitudes, cupo diario, plazo estimado (24, 48 u otras horas), lugar, requisitos, días y horas de atención, correo y espera mínima después de marcar listo. No configura hojas por adelantado.
2. El estudiante solicita desde su sesión. Su identidad sale de la cuenta, nunca del formulario. Recibe un código `identificador-año-secuencia` (por ejemplo, `REC-2026-000001`) y una ficha imprimible. No puede mantener dos solicitudes activas del mismo tipo. La cantidad de hojas permanece pendiente hasta que el documento esté listo.
3. La bandeja compartida muestra filas compactas con apellidos y nombres, ordenadas por apellidos. Al pulsar una fila se abre un detalle breve que destaca CI y nombre. Se puede buscar por ficha, RU, CI, nombre, apellido o motivo y filtrar por estado. Al iniciar preparación se asigna al operador si aún no tenía responsable. La asignación, los avisos y el historial están en **Más opciones y seguimiento**.
4. Una vez impreso, el encargado pulsa **Marcar impreso y listo**, ingresa obligatoriamente la cantidad de hojas que debe traer el estudiante (0 si no necesita hojas) y confirma con **Marcar listo y notificar**. No necesita escribir una fecha: el servidor suma la espera mínima configurada y ajusta a la próxima apertura en Bolivia. **Cambiar fecha o indicaciones** permite una programación excepcional.
5. La confirmación se muestra en Mis documentos y en el inicio del estudiante. Se encolan correo (si estaba habilitado al solicitar) y Telegram (solo con vinculación voluntaria activa). Los mensajes indican ficha, desde qué fecha/hora recoger, lugar y hojas.
6. El personal verifica identidad y ficha antes de **Registrar entrega**. Cada cambio conserva su historial. El estudiante puede cancelar únicamente mientras está SOLICITADA; un rechazo requiere motivo.

El plazo de preparación se cuenta en horas corridas; si termina fuera del horario, la estimación pasa a la siguiente apertura. Es una estimación, no una confirmación para acudir. El recojo confirmado se calcula al marcar listo, aunque la preparación haya terminado antes o después de esa estimación. Los días configurados son semanales; los feriados excepcionales se gestionan reprogramando.

Nombre, código de ficha, requisitos, lugar y preferencia de correo se conservan en cada solicitud. Editar la configuración se aplica a solicitudes nuevas; cambiar el identificador no renumera fichas emitidas. El identificador debe ser único entre tipos, comenzar con una letra y contener hasta 20 letras o números. Los horarios y margen vigentes se usan al calcular automáticamente el recojo. Las solicitudes pendientes siguen accesibles aunque el periodo cierre o el documento se deshabilite.

## Telegram público y vinculación personal

Se reutiliza el mismo bot existente. `/start faq`, `/menu`, categorías y búsqueda siguen disponibles sin sesión ni vínculo.

En Mis documentos, el estudiante marca su consentimiento y genera un enlace. Abre Telegram y pulsa **Iniciar**. El enlace contiene un secreto aleatorio de 256 bits, vence en 10 minutos y sirve una sola vez. La BD solo guarda su hash; generar uno nuevo invalida el anterior. Un chat pertenece a una sola cuenta. Nunca se reconoce a un estudiante por un RU/CI escrito en el bot ni por su nombre de Telegram.

- `/misdocumentos`: hasta cinco solicitudes activas de la cuenta vinculada.
- `/desvincular`: elimina la asociación y cancela enlaces pendientes. También se puede desvincular desde la sesión.
- Los grupos no procesan vínculos ni consultas personales.
- Se comprueba que la cuenta sigue activa, verificada y sin cambio obligatorio de contraseña.
- Si se vincula después de que un aviso fue omitido por falta de vínculo, puede consultar `/misdocumentos`; los avisos posteriores se enviarán al chat vinculado.

Se conserva `TELEGRAM_BOT_TOKEN` en el backend y una sola instancia del consumidor del bot. No se requiere otro bot. Consulta [la guía de Telegram](TELEGRAM.md). Enlaces implementados según [Deep Linking de Telegram](https://core.telegram.org/bots/features#deep-linking); mensajes mediante [sendMessage](https://core.telegram.org/bots/api#sendmessage).

## Avisos y recuperación de fallos

El estado LISTA y sus avisos se guardan en la misma transacción. El backend procesa la cola cada 30 segundos. Los fallos de cada canal son independientes y se reintentan con espera creciente (hasta cinco intentos); el personal puede reintentar los avisos en ERROR. Los envíos completados no se vuelven a procesar. La entrega o reprogramación invalida avisos pendientes obsoletos.

La cola persiste tras reinicios y utiliza bloqueos para evitar procesamiento simultáneo. Como los proveedores externos no participan en la transacción de PostgreSQL, una caída exacta después del envío y antes de confirmar la BD puede repetir el aviso. No se promete entrega exactamente una vez. Las notificaciones requieren que el backend permanezca en ejecución.

El correo usa la configuración existente de `sendMail`. Con Mailtrap Sandbox el mensaje llega al sandbox; para entrega real utiliza el proveedor real configurado. Las pruebas no envían correos ni mensajes reales.

## Base de datos

Se agregan `tipo_documento`, `solicitud_documento`, `evento_documento`, `correo_documento` (avisos por canal) y `vinculo_telegram`, con RLS sin políticas públicas. Se amplía la restricción del permiso `documentos`. No se modifican fichas de atención ni datos académicos existentes.

Desde `backend`, para otro entorno:

```sh
node scripts/migrate-documentos.cjs --check
node scripts/migrate-documentos.cjs --apply
npm run prisma:generate
npm run build
```

Las migraciones ya se aplicaron en el entorno de trabajo de esta implementación. El script incluye `20261023000000_documentos_identificador_hojas`: asigna identificadores iniciales `DOC` más el ID del tipo, conserva los códigos emitidos y permite hojas pendientes hasta marcar listo. Los valores antiguos de hojas de solicitudes sin fecha de recojo no se muestran como confirmados. El script `--check` valida y revierte; `--apply` confirma. No se usa `prisma migrate reset` ni se recrea la base.

## Verificación

```sh
# backend
npm run test:documentos
npm run test:documentos:integration
npm run test:telegram
node -r ts-node/register/transpile-only tests/permissions.test.cjs
npm run build
# frontend
npm run build
# raíz, con Chrome instalado en Windows
node frontend/tests/documentos.browser.cjs
```

La integración usa PostgreSQL real dentro de una transacción que siempre se revierte: identidad, aislamiento entre estudiantes, identificadores únicos y preservación de fichas, orden por apellidos, cupos, duplicados, permisos HTTP/JWT, estados, hora automática, hojas obligatorias al marcar listo, enlaces de un uso, vencimiento, chat único, desvinculación, avisos, reintentos e historial. Los proveedores se simulan. La prueba de navegador usa API simulada y comprueba configuración sin hojas iniciales, identificador, bandeja compacta, detalle CI/nombre, solicitud, consentimiento, subadministrador, móvil e impresión; guarda capturas y una ficha PDF en `.preview-documentos`.
