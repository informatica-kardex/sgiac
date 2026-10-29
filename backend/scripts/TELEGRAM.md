# Asistente de preguntas frecuentes en Telegram

> **Actualización 22/10/2026:** el mismo bot admite vinculación voluntaria desde la sesión del estudiante, `/misdocumentos`, `/desvincular` y avisos personales de recojo. El menú público sigue funcionando sin vínculo. Para esta ampliación sí se requieren las tablas de [Solicitudes de documentos](DOCUMENTOS-ACADEMICOS.md).

El botón está en `/faq`, `/usuario/faq` y la sección de preguntas del inicio.
Abre `https://t.me/<usuario_del_bot>?start=faq`. Telegram muestra **Iniciar**;
al pulsarlo, SGIAC responde automáticamente con el menú. La web no puede
omitir esa confirmación de Telegram.

## Activación

1. En Telegram abre [@BotFather](https://t.me/BotFather), envía `/newbot` y
   elige nombre y usuario para un bot dedicado a SGIAC.
2. Copia su token en `backend/.env`:

   ```dotenv
   TELEGRAM_BOT_TOKEN="pega_aqui_el_token_de_BotFather"
   ```

3. Reinicia el backend con `npm run dev` (o `npm run build` y `npm start`
   en producción). El backend valida el token, obtiene el usuario real y
   registra los comandos y el menú. No hace falta configurar el usuario
   en el frontend ni instalar paquetes. Las preguntas públicas no requieren tablas nuevas; la vinculación y los avisos personales requieren las migraciones del módulo de documentos.
4. Busca `Telegram: asistente @... iniciado.` en la consola. En `/faq`,
   el botón se habilita cuando el bot puede recibir mensajes. La página
   vuelve a comprobar la disponibilidad cada 30 segundos.
5. Pulsa **Abrir bot en Telegram**, luego **Iniciar**. Prueba una categoría,
   una pregunta, **Volver al menú** y una búsqueda como `contraseña`.

El token se guarda solamente en el backend: no lo pongas en variables
`VITE_*`, capturas, enlaces públicos o commits. Vaciarlo y reiniciar
desactiva la integración. Sin token o con problemas de conexión, la página
mantiene disponibles sus preguntas y muestra el botón deshabilitado.

## Respuestas y operación

- `/start`, `/menu` y `/ayuda` muestran categorías y botones de preguntas.
- Se pueden escribir preguntas o palabras; la búsqueda ignora tildes y
  mayúsculas. Las respuestas son las publicadas en SGIAC, sin generación por IA.
- Las listas largas tienen paginación. Una respuesta extensa se divide en
  mensajes respetando el límite de Telegram y conserva los botones al final.
- El bot consulta `FaqService.listarPublicadas()` para cada interacción.
  Cambios, borradores y eliminaciones del administrador se reflejan en la
  siguiente consulta, incluso al pulsar un botón antiguo.
- **El repositorio FAQ actual sigue en memoria (`faq.mock.ts`)**: sus cambios
  administrativos se pierden al reiniciar el backend, igual que antes de esta
  integración. El bot comparte ese repositorio; no añade otra copia de respuestas.
- El backend debe permanecer ejecutándose y tener salida HTTPS a
  `api.telegram.org`. Usa long polling: funciona localmente sin dominio público
  ni túnel. En producción requiere un proceso persistente y **una sola instancia
  consumidora por token**. No es adecuado para funciones que se suspenden entre peticiones.
- Solo responde en chats privados. No almacena conversaciones. Cuando el estudiante confirma voluntariamente la vinculación, guarda la asociación entre su cuenta y el identificador del chat; `/desvincular` elimina esa asociación.
- `GET /api/telegram` devuelve únicamente `{ available, url }` dentro del sobre
  habitual de la API; nunca devuelve credenciales.
- Los fallos de red se reintentan con espera creciente y se respeta `retry_after`.
  Un token inválido o un conflicto con otra instancia requiere corregir la causa
  y reiniciar. Si ya existe un webhook, el bot no lo elimina: utiliza otro bot
  dedicado o retira esa integración desde su configuración antes de reiniciar.
- El cursor de recepción reside en memoria. Una interrupción tras responder y
  antes de confirmar la actualización puede repetir esa última respuesta al
  reiniciar; no se descartan intencionalmente mensajes pendientes.

## Verificación

Desde `backend`:

```sh
npm run test:telegram
npm run build
```

Las pruebas simulan Telegram y no envían mensajes reales. Cubren arranque,
menú, búsqueda, paginación, borradores, cambios administrativos, mensajes
largos, callbacks, cancelación, credenciales, conflictos y endpoint público.
La prueba real requiere el token y pulsar **Iniciar** desde una cuenta Telegram.

Referencias oficiales: [creación del bot](https://core.telegram.org/bots/tutorial#obtain-your-bot-token),
[enlaces de inicio](https://core.telegram.org/api/links#bot-links),
[Bot API](https://core.telegram.org/bots/api).
