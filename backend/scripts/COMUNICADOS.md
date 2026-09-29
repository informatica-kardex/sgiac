# Comunicados de texto, imagen y PDF

El administrador y el subadministrador académico pueden crear, editar, publicar, archivar y eliminar comunicados. El subadministrador de atención conserva los permisos de su rol y no puede publicar comunicados.

En **Comunicados → Nuevo comunicado**, selecciona Texto, Imagen o Documento PDF. Indica título, categoría y estado. El texto es obligatorio solo para publicaciones de texto; una imagen o PDF puede tener una descripción opcional. Se admite un archivo JPG, PNG, WebP o PDF de hasta 10 MB. El formulario muestra una vista previa y permite reemplazar el archivo al editar.

El portal muestra únicamente publicaciones vigentes. Las imágenes se visualizan en las tarjetas y en el detalle; los PDF se abren en un visor en el detalle y también pueden abrirse en otra pestaña o descargarse. Los archivos de borradores y archivados requieren una sesión administrativa con permisos de comunicación.

## Persistencia y BD

No se modificó el esquema y no hay SQL que ejecutar. El módulo utiliza las tablas existentes `comunicado`, `categoria_comunicado`, `adjunto_comunicado` e `historial_comunicado`. Las eliminaciones se registran en `bitacora`. Los comunicados de ejemplo en memoria ya no alimentan el portal ni los reportes.

El resumen de las tarjetas se obtiene del texto; el formato se obtiene del MIME del adjunto. Las categorías nuevas se crean al guardar un comunicado. El usuario autor se toma de la sesión validada por el servidor.

Los archivos se guardan en `backend/uploads/comunicados`, con nombres aleatorios. La carpeta no se expone como directorio público: la API comprueba los permisos y la publicación antes de entregar cada archivo. Al reemplazar o eliminar se retira el archivo anterior; si falla el guardado en BD se limpia el archivo nuevo.

Conserva esta carpeta junto con la BD para respaldar los comunicados. En un despliegue con almacenamiento efímero, monta un volumen persistente y configura `COMUNICADOS_UPLOAD_DIR` con su ruta. En varios servidores, todos deben compartir ese volumen.

## API

- `POST /api/comunicados`, `PUT /api/comunicados/:id`: `multipart/form-data` con `titulo`, `categoria`, `tipo` (`texto`, `imagen`, `pdf`), `contenido`, `estado` y el archivo opcional `archivo`. Las publicaciones de texto también aceptan JSON.
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

Las pruebas usan una BD simulada y archivos temporales eliminados al finalizar. Incluyen solicitudes HTTP multipart, permisos, lectura inline, rangos de PDF, descarga, archivos falsos y demasiado grandes, reemplazo, borradores y limpieza ante fallos. No crean comunicados en la BD configurada en `.env`.
