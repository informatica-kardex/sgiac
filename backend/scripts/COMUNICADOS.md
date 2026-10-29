# Comunicados de texto, imagen y PDF

El administrador y los subadministradores con la función Comunicados vigente pueden crear, editar, publicar, archivar y eliminar comunicados.

En **Comunicados → Nuevo comunicado**, selecciona Texto, Imágenes o Documento PDF. Indica título, categoría y estado. El texto es obligatorio solo para publicaciones de texto; las imágenes o el PDF pueden tener una descripción opcional. Se admiten hasta **10 imágenes JPG, PNG o WebP, de 10 MB cada una**, o un solo PDF de hasta 10 MB.

El formulario permite seleccionar varias imágenes juntas o añadirlas por partes. Cada miniatura incluye **Retirar**. Al editar se conservan las imágenes existentes salvo las retiradas explícitamente; las nuevas se añaden al final. Las retiradas se hacen efectivas al guardar, y cancelar conserva la publicación original. Un comunicado de imágenes debe conservar al menos una; también se puede cambiar a Texto o PDF. El PDF mantiene la opción de reemplazar su archivo.

El portal muestra únicamente publicaciones vigentes. Con varias imágenes, las tarjetas y el detalle muestran un carrusel que avanza **cada 5 segundos**, vuelve al principio y tiene flechas, indicadores y pausa. Se detiene mientras se usa el teclado, se pasa el cursor sobre él o se oculta la pestaña; respeta la preferencia de movimiento reducido. Con una imagen no hay rotación ni controles. En el detalle se descarga la imagen que se está mostrando. Funciona tanto en el portal público como en el del estudiante.

Los PDF se abren en un visor en el detalle y también pueden abrirse en otra pestaña o descargarse. Los archivos de borradores y archivados requieren una sesión administrativa con permisos de comunicación.

## Persistencia y BD

No se modificó el esquema y no hay SQL que ejecutar. El módulo utiliza las tablas existentes `comunicado`, `categoria_comunicado`, `adjunto_comunicado` e `historial_comunicado`. Las eliminaciones se registran en `bitacora`. Los comunicados de ejemplo en memoria ya no alimentan el portal ni los reportes.

El resumen de las tarjetas se obtiene del texto; el formato se obtiene del MIME del adjunto. Las categorías nuevas se crean al guardar un comunicado. El usuario autor se toma de la sesión validada por el servidor.

Los archivos se guardan en `backend/uploads/comunicados`, con nombres aleatorios. La carpeta no se expone como directorio público: la API comprueba los permisos y la publicación antes de entregar cada archivo. Las retiradas se validan dentro de la transacción y solo pueden referirse a archivos del comunicado editado. Al guardar correctamente se limpian los archivos retirados; si falla la carga o la transacción se limpian todos los archivos nuevos del lote y se conservan los anteriores. El orden es el de carga, por `id_adjunto` ascendente.

Conserva esta carpeta junto con la BD para respaldar los comunicados. En un despliegue con almacenamiento efímero, monta un volumen persistente y configura `COMUNICADOS_UPLOAD_DIR` con su ruta. En varios servidores, todos deben compartir ese volumen.

## API

- `POST /api/comunicados`, `PUT /api/comunicados/:id`: `multipart/form-data` con `titulo`, `categoria`, `tipo` (`texto`, `imagen`, `pdf`), `contenido`, `estado` y uno o varios campos `archivo` (mismo nombre repetido). El campo de tipo sigue siendo `imagen`, incluso con varias imágenes.
- En `PUT`, `adjuntosEliminar` es una lista JSON de identificadores, por ejemplo `["12","15"]`. Omitirla conserva los adjuntos compatibles. También se admite una lista nativa al editar con JSON sin subir archivos. El límite de 10 cuenta las imágenes conservadas más las nuevas, y las ediciones simultáneas se serializan por comunicado.
- `GET /api/comunicados?publico=1`: solo publicados, incluso si el visitante tiene sesión administrativa.
- `GET /api/comunicados/:id?publico=1`: detalle público.
- `GET /api/comunicados/:id/archivos/:adjunto`: archivo inline, con verificación de acceso. `descargar=1` entrega como descarga.

Carga multipart implementada con [Multer](https://expressjs.com/en/resources/middleware/multer/), restringida a las rutas de escritura después de comprobar la sesión y el rol. Se comprueba también la firma del contenido del archivo; no se confía solo en su nombre o MIME declarado.

## Verificación

```powershell
cd backend
npm.cmd run build
node -r ts-node/register/transpile-only --test tests/comunicados.test.cjs
```

Las pruebas usan una BD simulada y archivos temporales eliminados al finalizar. Incluyen solicitudes HTTP multipart, permisos, lectura inline, rangos de PDF, descarga, archivos falsos y demasiado grandes, reemplazo, borradores, múltiples imágenes, retiradas selectivas, límites, ediciones simultáneas y limpieza ante fallos. No crean comunicados en la BD configurada en `.env`.

Para verificar el formulario, la rotación, navegación, pausa, descarga, móvil y movimiento reducido, compila el frontend y ejecuta desde la raíz `node frontend/tests/comunicados-gallery.browser.cjs`. Usa Chrome sin ventana y una API simulada; las capturas se guardan en `.preview-comunicados/galeria`.
