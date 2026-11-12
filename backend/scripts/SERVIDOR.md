# Publicar SGIAC con una sola dirección

La compilación de producción está preparada para servir el portal, el panel y la API desde el mismo dominio. El QR toma automáticamente la dirección desde la que se abre el sistema. No necesita guardar una IP de la computadora ni requiere `VITE_PUBLIC_SITE_URL` para este modo.

## Archivos y compilación

Conservar las carpetas hermanas `backend/` y `frontend/`. Desde cada una ejecutar `npm ci` y `npm run build`; en el backend también generar Prisma con `npm run prisma:generate` antes de compilar. Las dependencias de desarrollo son necesarias durante la compilación.

En el servidor deben quedar `backend/dist/`, las dependencias de ejecución y el cliente generado de Prisma, además de `frontend/dist/`. Mantener también los archivos/directorios de datos persistentes que ya utilice la instalación. No ejecutar seeds ni reinicializar la base para habilitar el QR.

`frontend/.env.production` configura `/api` y deja vacío el origen del QR. Tiene prioridad sobre `.env` al compilar con `npm run build`. No copiar una variable `VITE_API_URL` de localhost en el entorno del hosting: las variables suministradas por el hosting tienen prioridad sobre los archivos. Las variables `VITE_*` son públicas, nunca deben contener claves.

## Variables del backend

Conservar la conexión a la base y las claves existentes. Configurar:

```env
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://tu-dominio-real
COOKIE_SECURE=true
```

El dominio es un ejemplo: debe ser el asignado a esta instalación. La URL se usa también en correos y CORS. No incluir `/api` ni una ruta adicional.

Mantener una clave persistente `AUXILIAR_CARNET_SECRET` para firmar los carnets. Si ya se imprimieron sin esa variable, el sistema utiliza `JWT_SECRET`: conservar esa clave efectiva para no invalidarlos. No regenerarla en cada despliegue. Cada réplica del backend debe usar la misma clave.

## Arranque y HTTPS

Ejecutar `npm start` desde `backend/` mediante el gestor de procesos del servidor o su plataforma de alojamiento. Con `NODE_ENV=production`, el backend publica automáticamente `frontend/dist/`, si existe, y mantiene `/api` para sus rutas actuales. Los enlaces directos de React, incluidos los QR, reciben `index.html` sin necesidad de una regla SPA adicional.

El servicio HTTP escucha en `PORT`. El servidor o plataforma debe terminar HTTPS con un certificado válido y dirigir el dominio a ese servicio. No usar `vite dev` ni `vite preview` como servidor de producción. Si hay un proxy inverso, preservar el streaming de `/api/events` y configurar los límites de peticiones/IP según la infraestructura, como en el despliegue actual de la API.

Esta preparación no publica el sitio, no registra un dominio ni instala un certificado. Esos datos dependen del servidor elegido. Si el alojamiento es solo estático o separa frontend y backend, necesitará además su servicio de API, la configuración CORS correspondiente y sus propias reglas de rutas; el modo incluido aquí utiliza un único servicio Node.

## Verificación antes de entregar carnets

1. Abrir el dominio HTTPS definitivo; comprobar `/api/health`.
2. Iniciar sesión y abrir **Auxiliares → Carnet y QR**.
3. Comprobar que el enlace contiene el dominio definitivo. Abrirlo en incógnito y recargar esa dirección directamente.
4. Descargar el PDF y escanearlo. Puede hacerlo una cámara que admita QR; para comprobar la consulta desde la misma laptop también sirve **Ver horario público**. Si el QR contiene localhost, solo abrirá en la computadora que ejecuta ese servicio.
5. Guardar un cambio de aula desde el administrador y pulsar **Actualizar horario** en la consulta. El enlace impreso se conserva.

La consulta permanece fuera de los menús del portal. El servidor añade `noindex` también a la respuesta HTML de los QR. Los carnets generados con direcciones locales deben regenerarse desde el dominio definitivo; luego, los cambios de horario no requieren reimprimir.

Referencias de configuración: [entornos de Vite](https://vite.dev/guide/env-and-mode#env-files), [archivos estáticos de Express](https://expressjs.com/en/starter/static-files.html), [políticas HTTP de Helmet](https://helmetjs.github.io/).
