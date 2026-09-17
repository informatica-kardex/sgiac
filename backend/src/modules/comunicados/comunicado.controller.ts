import { Request } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { ComunicadoService } from "./comunicado.service";
import {
  actualizarComunicadoSchema,
  crearComunicadoSchema,
} from "./comunicado.validation";

const comunicadoService = new ComunicadoService();

// Determina si la peticion viene de un usuario autenticado con
// sesion administrativa (para decidir si se muestran tambien los
// comunicados en estado "borrador"/"archivado").
function esSolicitudAdministrativa(req: Request): boolean {
  return Boolean(req.user);
}

export const comunicadoController = {
  listar: asyncHandler(async (req, res) => {
    const comunicados = esSolicitudAdministrativa(req)
      ? await comunicadoService.listarTodos()
      : await comunicadoService.listarPublicados();
    return sendSuccess(res, comunicados, "Comunicados obtenidos");
  }),

  obtener: asyncHandler(async (req, res) => {
    const comunicado = await comunicadoService.obtener(Number(req.params.id));
    return sendSuccess(res, comunicado, "Comunicado obtenido");
  }),

  crear: asyncHandler(async (req, res) => {
    const data = crearComunicadoSchema.parse(req.body);
    const comunicado = await comunicadoService.crear(data);
    return sendSuccess(res, comunicado, "Comunicado creado", 201);
  }),

  actualizar: asyncHandler(async (req, res) => {
    const data = actualizarComunicadoSchema.parse(req.body);
    const comunicado = await comunicadoService.actualizar(Number(req.params.id), data);
    return sendSuccess(res, comunicado, "Comunicado actualizado");
  }),

  eliminar: asyncHandler(async (req, res) => {
    await comunicadoService.eliminar(Number(req.params.id));
    return sendSuccess(res, null, "Comunicado eliminado");
  }),

  publicar: asyncHandler(async (req, res) => {
    const comunicado = await comunicadoService.publicar(Number(req.params.id));
    return sendSuccess(res, comunicado, "Comunicado publicado");
  }),

  archivar: asyncHandler(async (req, res) => {
    const comunicado = await comunicadoService.archivar(Number(req.params.id));
    return sendSuccess(res, comunicado, "Comunicado archivado");
  }),
};
