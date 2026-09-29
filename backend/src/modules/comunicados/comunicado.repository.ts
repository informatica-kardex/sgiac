import { Prisma } from "@prisma/client";
import { prisma } from "../../database/prisma";
import { ApiError } from "../../utils/apiError";
import { ArchivoGuardado } from "./comunicado.files";
import { ActualizarComunicadoInput, CrearComunicadoInput } from "./comunicado.validation";

const include = { adjunto_comunicado: true, categoria_comunicado: true } as const;
type Registro = Prisma.comunicadoGetPayload<{ include: typeof include }>;
export const esPublicado = (c: { estado: string; fecha_publicacion: Date | null; fecha_vencimiento: Date | null }) =>
  c.estado === "PUBLICADO" && (!c.fecha_publicacion || c.fecha_publicacion <= new Date()) && (!c.fecha_vencimiento || c.fecha_vencimiento > new Date());
const tipoRegistro = (c: Registro) => c.adjunto_comunicado.some(a => a.tipo_archivo === "application/pdf") ? "pdf" as const
  : c.adjunto_comunicado.some(a => a.tipo_archivo?.startsWith("image/")) ? "imagen" as const : "texto" as const;
function dto(c: Registro) {
  return {
    idComunicado: c.id_comunicado.toString(), titulo: c.titulo, contenido: c.contenido,
    resumen: c.contenido.slice(0, 300), tipo: tipoRegistro(c), categoria: c.categoria_comunicado.nombre,
    estado: c.estado.toLowerCase(), fechaPublicacion: (c.fecha_publicacion || c.fecha_creacion).toISOString(),
    adjuntos: c.adjunto_comunicado.map(a => ({ idAdjunto: a.id_adjunto.toString(), nombre: a.nombre_archivo,
      tipo: a.tipo_archivo, url: `/api/comunicados/${c.id_comunicado}/archivos/${a.id_adjunto}` })),
  };
}

export class ComunicadoRepository {
  async findAllPublicados() {
    return (await prisma.comunicado.findMany({ where: { estado: "PUBLICADO" }, include, orderBy: { fecha_publicacion: "desc" } }))
      .filter(esPublicado).map(dto);
  }
  async findAll() {
    return (await prisma.comunicado.findMany({ include, orderBy: { fecha_creacion: "desc" } })).map(dto);
  }
  async findById(id: bigint, publico = false) {
    const c = await prisma.comunicado.findUnique({ where: { id_comunicado: id }, include });
    if (!c || (publico && !esPublicado(c))) throw ApiError.notFound("Comunicado no encontrado");
    return dto(c);
  }
  async findArchivo(id: bigint, idAdjunto: bigint, publico: boolean) {
    const archivo = await prisma.adjunto_comunicado.findFirst({
      where: { id_adjunto: idAdjunto, id_comunicado: id }, include: { comunicado: true },
    });
    if (!archivo || (publico && !esPublicado(archivo.comunicado))) throw ApiError.notFound("Archivo no encontrado");
    return archivo;
  }

  async guardar(input: CrearComunicadoInput | ActualizarComunicadoInput, actor: bigint, id?: bigint, archivo?: ArchivoGuardado) {
    return prisma.$transaction(async tx => {
      if (id) await tx.$queryRaw`SELECT id_comunicado FROM comunicado WHERE id_comunicado = ${id} FOR UPDATE`;
      const anterior = id ? await tx.comunicado.findUnique({ where: { id_comunicado: id }, include }) : null;
      if (id && !anterior) throw ApiError.notFound("Comunicado no encontrado");
      const tipo = input.tipo ?? (anterior ? tipoRegistro(anterior) : "texto");
      const contenido = input.contenido ?? anterior?.contenido ?? "";
      const mantieneArchivo = anterior?.adjunto_comunicado.some(a => tipo === "pdf" ? a.tipo_archivo === "application/pdf" : tipo === "imagen" && a.tipo_archivo?.startsWith("image/"));
      if (tipo === "texto" && !contenido.trim()) throw ApiError.badRequest("Escribe el texto del comunicado");
      if (tipo === "texto" && archivo) throw ApiError.badRequest("Selecciona Imagen o PDF para adjuntar un archivo");
      if (tipo !== "texto" && !archivo && !mantieneArchivo) throw ApiError.badRequest("Adjunta el archivo del comunicado");
      if (archivo && (tipo === "pdf" ? archivo.mime !== "application/pdf" : !archivo.mime.startsWith("image/"))) throw ApiError.badRequest("El archivo no corresponde al tipo seleccionado");
      const categoria = input.categoria ? await tx.categoria_comunicado.upsert({
        where: { nombre: input.categoria }, create: { nombre: input.categoria, estado: "ACTIVO" }, update: {},
      }) : anterior?.categoria_comunicado;
      if (!categoria || categoria.estado !== "ACTIVO") throw ApiError.badRequest("Selecciona una categoría activa");
      const estado = input.estado?.toUpperCase() ?? anterior?.estado ?? "BORRADOR";
      const reemplaza = Boolean(archivo) || tipo === "texto";
      const retirados = reemplaza ? anterior?.adjunto_comunicado.map(a => a.url_archivo) ?? [] : [];
      const data = {
        titulo: input.titulo ?? anterior!.titulo, contenido, estado,
        id_categoria_comunicado: categoria.id_categoria_comunicado,
        fecha_publicacion: estado === "PUBLICADO" && anterior?.estado !== "PUBLICADO" ? new Date() : anterior?.fecha_publicacion ?? null,
        fecha_archivado: estado === "ARCHIVADO" ? new Date() : null,
      };
      const registro = id
        ? await tx.comunicado.update({ where: { id_comunicado: id }, data })
        : await tx.comunicado.create({ data: { ...data, id_usuario: actor } });
      if (reemplaza && id) await tx.adjunto_comunicado.deleteMany({ where: { id_comunicado: id } });
      if (archivo) await tx.adjunto_comunicado.create({ data: {
        id_comunicado: registro.id_comunicado, nombre_archivo: archivo.nombre, tipo_archivo: archivo.mime, url_archivo: archivo.clave,
      } });
      await tx.historial_comunicado.create({ data: {
        id_comunicado: registro.id_comunicado, id_usuario: actor,
        accion: id ? "ACTUALIZACION" : "CREACION", estado_anterior: anterior?.estado, estado_nuevo: estado,
      } });
      const completo = await tx.comunicado.findUniqueOrThrow({ where: { id_comunicado: registro.id_comunicado }, include });
      return { comunicado: dto(completo), retirados };
    });
  }

  async delete(id: bigint, actor: bigint) {
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id_comunicado FROM comunicado WHERE id_comunicado = ${id} FOR UPDATE`;
      const c = await tx.comunicado.findUnique({ where: { id_comunicado: id }, include });
      if (!c) throw ApiError.notFound("Comunicado no encontrado");
      await tx.bitacora.create({ data: { accion: "COMUNICADO_ELIMINADO", entidadAfectada: "comunicado", idRegistroAfectado: id.toString(), idUsuario: actor } });
      await tx.comunicado.delete({ where: { id_comunicado: id } });
      return c.adjunto_comunicado.map(a => a.url_archivo);
    });
  }
}
