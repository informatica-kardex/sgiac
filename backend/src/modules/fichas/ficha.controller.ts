import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { FichaService } from "./ficha.service";
import { accionFichaSchema, fechaSchema, idSchema, jornadaSchema, programarJornadasSchema, tramiteSchema, puestoSchema, siguienteSchema } from "./ficha.validation";
import { ahoraBolivia } from "./ficha.shared";
import { tvService } from "./tv.service";

const service = new FichaService();
export const fichaController = {
  panel: asyncHandler(async (req, res) => {
    const fecha = fechaSchema.parse(req.query.fecha ?? ahoraBolivia().fecha);
    const [jornadas, fichas, tramites, puestos] = await Promise.all([service.jornadas(fecha), service.findAll(fecha), service.tramites(), service.puestos()]);
    return sendSuccess(res, { jornadas, fichas, tramites, puestos });
  }),
  tablero: asyncHandler(async (_req, res) => {
    const [tablero, tv] = await Promise.all([service.tablero(), tvService.obtener()]);
    return sendSuccess(res, { ...tablero, tv });
  }),
  tramites: asyncHandler(async (_req, res) => sendSuccess(res, await service.tramites())),
  puestos: asyncHandler(async (_req, res) => sendSuccess(res, await service.puestos())),
  crearPuesto: asyncHandler(async (req, res) => sendSuccess(res, await service.guardarPuesto(puestoSchema.parse(req.body).nombre), "Puesto creado", 201)),
  editarPuesto: asyncHandler(async (req, res) => sendSuccess(res, await service.guardarPuesto(puestoSchema.parse(req.body).nombre, idSchema.parse(req.params.id)), "Puesto actualizado")),
  borrarPuesto: asyncHandler(async (req, res) => sendSuccess(res, await service.borrarPuesto(idSchema.parse(req.params.id)), "Puesto retirado; historial conservado")),
  crearTramite: asyncHandler(async (req, res) => sendSuccess(res, await service.guardarTramite(tramiteSchema.parse(req.body)), "Trámite creado", 201)),
  editarTramite: asyncHandler(async (req, res) => sendSuccess(res, await service.guardarTramite(tramiteSchema.parse(req.body), idSchema.parse(req.params.id)), "Trámite actualizado")),
  borrarTramite: asyncHandler(async (req, res) => sendSuccess(res, await service.borrarTramite(idSchema.parse(req.params.id)), "Trámite eliminado; historial conservado")),
  jornadas: asyncHandler(async (req, res) => sendSuccess(res, await service.jornadas(fechaSchema.parse(req.query.fecha ?? ahoraBolivia().fecha)))),
  crearJornada: asyncHandler(async (req, res) => sendSuccess(res, await service.guardarJornada(jornadaSchema.parse(req.body), req.user!.idUsuario), "Jornada creada", 201)),
  programarJornadas: asyncHandler(async (req, res) => sendSuccess(res, await service.programarJornadas(programarJornadasSchema.parse(req.body).jornadas, req.user!.idUsuario), "Jornadas programadas", 201)),
  editarJornada: asyncHandler(async (req, res) => sendSuccess(res, await service.guardarJornada(jornadaSchema.parse(req.body), req.user!.idUsuario, idSchema.parse(req.params.id)), "Jornada actualizada")),
  borrarJornada: asyncHandler(async (req, res) => sendSuccess(res, await service.borrarJornada(idSchema.parse(req.params.id)), "Jornada eliminada")),
  listar: asyncHandler(async (req, res) => sendSuccess(res, await service.findAll(fechaSchema.parse(req.query.fecha ?? ahoraBolivia().fecha)))),
  siguiente: asyncHandler(async (req, res) => sendSuccess(res, await service.siguiente(idSchema.parse(req.params.id), req.user!.idUsuario, siguienteSchema.parse(req.body).idPuesto), "Turno llamado")),
  accion: asyncHandler(async (req, res) => sendSuccess(res, await service.accion(idSchema.parse(req.params.id), accionFichaSchema.parse(req.body).accion, req.user!.idUsuario), "Atención actualizada")),
};
