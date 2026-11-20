# Auditoría

La pantalla `/admin/auditoria` consulta la tabla existente `bitacora`. El administrador tiene acceso y puede delegar `auditoria` con vigencia. La API solo permite listar, consultar y exportar; no hay operaciones de edición o borrado.

Se registran las solicitudes de la API: accesos, cambios de contraseña y seguridad, creación/actualización/eliminación en los módulos, importaciones, acciones de atención y TV, trámites, solicitudes de aulas, vínculos Telegram, consultas, descargas, errores de validación, permisos denegados y límites de solicitudes. Se conservan los eventos internos existentes y se relacionan con el evento HTTP mediante `requestId`; no son operaciones duplicadas, sino el detalle interno y el resultado de la solicitud.

Cada evento HTTP incluye método, ruta, usuario, roles, IP de la conexión, navegador, resultado, código HTTP, duración, parámetros, entrada, resumen/respuesta y metadatos de archivos. Los cambios de estado y permisos de usuarios también conservan valores anteriores y posteriores. Un error HTTP no implica que todos los efectos parciales de la operación se hayan revertido.

No se guardan contraseñas, hashes, tokens, cookies, códigos de verificación, CI usado como contraseña temporal ni contenido binario. Los cuerpos y colecciones tienen límites de tamaño; los truncamientos se indican. Las lecturas guardan solo un resumen. Se omiten los latidos (`health`, `events`, `auth/activity`, `auth/me`, captcha, pendientes y tablero público), OPTIONS y el listado/filtros de la bitácora cuando tienen éxito; sus errores sí se registran. Exportar y abrir un evento quedan registrados.

Se guardan fechas UTC; la pantalla filtra y muestra fechas de Bolivia (UTC−04:00). Los filtros se aplican en el servidor y hay paginación. La exportación CSV incluye todos los resultados filtrados hasta 10.000; si se supera el límite se pide acotar filtros, sin exportación parcial silenciosa. Las celdas se protegen frente a fórmulas de hojas de cálculo.

Instalación desde `backend`:

```powershell
node scripts/migrate-auditoria-permisos.cjs --check
node scripts/migrate-auditoria-permisos.cjs --apply
```

La migración amplía la restricción de módulos e incorpora índices a la bitácora sin cambiar permisos ni eventos. No requiere regenerar Prisma porque no añade campos. No usar `migrate deploy` sobre una base con migraciones históricas aplicadas manualmente.

El registro HTTP se escribe al finalizar la respuesta. Los errores de persistencia se informan en el servidor como `[AUDITORIA]` sin interrumpir la operación principal. No reconstruye historia ausente ni observa SQL ejecutado externamente, scripts ajenos a la API o acciones del bot en segundo plano sin registro explícito. La bitácora es de solo lectura para la aplicación, no constituye un registro inmutable frente al propietario de la base de datos.

Pruebas sin conexiones externas: `node -r ts-node/register/transpile-only tests/audit.test.cjs` y `node -r ts-node/register/transpile-only tests/delegated-permissions.test.cjs`.
