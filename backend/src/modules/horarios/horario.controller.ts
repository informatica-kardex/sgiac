import { z } from "zod";
const parseId = (id: string) => z.coerce.number().int().positive().safe().parse(id);
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { HorarioService } from "./horario.service";
import { actualizarHorarioSchema, crearHorarioSchema, crearLoteHorarioSchema } from "./horario.validation";
import { HorarioRepository } from './horario.repository';

const horarioService = new HorarioService();

export const horarioController = {
  crearLote: asyncHandler(async (req, res) => {
    const { sesiones } = crearLoteHorarioSchema.parse(req.body);
    return sendSuccess(res, await new HorarioRepository().createMany(sesiones), 'Sesiones guardadas', 201);
  }),
  listar: asyncHandler(async (_req, res) => {
    const horarios = await horarioService.listar();
    return sendSuccess(res, horarios, "Horarios obtenidos");
  }),

  obtener: asyncHandler(async (req, res) => {
    const horario = await horarioService.obtener(parseId(req.params.id));
    return sendSuccess(res, horario, "Horario obtenido");
  }),

  crear: asyncHandler(async (req, res) => {
    const data = crearHorarioSchema.parse(req.body);
    const horario = await horarioService.crear(data);
    return sendSuccess(res, horario, "Horario creado", 201);
  }),

  actualizar: asyncHandler(async (req, res) => {
    const data = actualizarHorarioSchema.parse(req.body);
    const horario = await horarioService.actualizar(parseId(req.params.id), data);
    return sendSuccess(res, horario, "Horario actualizado");
  }),

  eliminar: asyncHandler(async (req, res) => {
    await horarioService.eliminar(parseId(req.params.id));
    return sendSuccess(res, null, "Horario eliminado");
  }),
};
