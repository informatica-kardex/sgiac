import { tienePermiso } from "../roles/permissions";
﻿import { Request } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { ComunicadoService } from "./comunicado.service";
import { actualizarComunicadoSchema, crearComunicadoSchema } from "./comunicado.validation";
import { idSchema } from "../users/user.validation";
import { rutaArchivo } from "./comunicado.files";
import { env } from "../../config/env";
import { ApiError } from "../../utils/apiError";

const service = new ComunicadoService();
function esAdministrativo(req: Request) {
  return req.query.publico !== "1" && tienePermiso(req.user, "comunicados");
}
export const comunicadoController = {
  listar: asyncHandler(async (req, res) => sendSuccess(res, esAdministrativo(req) ? await service.listarTodos() : await service.listarPublicados(), "Comunicados obtenidos")),
  obtener: asyncHandler(async (req, res) => sendSuccess(res, await service.obtener(idSchema.parse(req.params.id), !esAdministrativo(req)), "Comunicado obtenido")),
  archivo: asyncHandler(async (req, res, next) => {
    const archivo = await service.archivo(idSchema.parse(req.params.id), idSchema.parse(req.params.adjunto), !esAdministrativo(req));
    res.setHeader("Content-Type", archivo.tipo_archivo || "application/octet-stream");
    const nombre = encodeURIComponent(archivo.nombre_archivo).replace(/['()*]/g, c => `%${c.charCodeAt(0).toString(16)}`);
    res.setHeader("Content-Disposition", `${req.query.descargar === "1" ? "attachment" : "inline"}; filename*=UTF-8''${nombre}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.removeHeader("X-Frame-Options");
    res.setHeader("Content-Security-Policy", `frame-ancestors 'self' ${new URL(env.frontendUrl).origin}`);
    res.sendFile(rutaArchivo(archivo.url_archivo), error => {
      if (!error) return;
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return next(ApiError.notFound("Archivo no encontrado"));
      next(error);
    });
  }),
  crear: asyncHandler(async (req, res) => sendSuccess(res,
    await service.guardar(crearComunicadoSchema.parse(req.body), BigInt(req.user!.idUsuario), undefined, req.files as Express.Multer.File[]), "Comunicado creado", 201)),
  actualizar: asyncHandler(async (req, res) => sendSuccess(res,
    await service.guardar(actualizarComunicadoSchema.parse(req.body), BigInt(req.user!.idUsuario), idSchema.parse(req.params.id), req.files as Express.Multer.File[]), "Comunicado actualizado")),
  eliminar: asyncHandler(async (req, res) => {
    await service.eliminar(idSchema.parse(req.params.id), BigInt(req.user!.idUsuario));
    return sendSuccess(res, null, "Comunicado eliminado");
  }),
  publicar: asyncHandler(async (req, res) => sendSuccess(res,
    await service.guardar({ estado: "publicado" }, BigInt(req.user!.idUsuario), idSchema.parse(req.params.id)), "Comunicado publicado")),
  archivar: asyncHandler(async (req, res) => sendSuccess(res,
    await service.guardar({ estado: "archivado" }, BigInt(req.user!.idUsuario), idSchema.parse(req.params.id)), "Comunicado archivado")),
};
