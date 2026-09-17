import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { HorarioService } from "./horario.service";
import { actualizarHorarioSchema, crearHorarioSchema } from "./horario.validation";

const horarioService = new HorarioService();

export const horarioController = {
  listar: asyncHandler(async (_req, res) => {
    const horarios = await horarioService.listar();
    return sendSuccess(res, horarios, "Horarios obtenidos");
  }),

  obtener: asyncHandler(async (req, res) => {
    const horario = await horarioService.obtener(Number(req.params.id));
    return sendSuccess(res, horario, "Horario obtenido");
  }),

  crear: asyncHandler(async (req, res) => {
    const data = crearHorarioSchema.parse(req.body);
    const horario = await horarioService.crear(data);
    return sendSuccess(res, horario, "Horario creado", 201);
  }),

  actualizar: asyncHandler(async (req, res) => {
    const data = actualizarHorarioSchema.parse(req.body);
    const horario = await horarioService.actualizar(Number(req.params.id), data);
    return sendSuccess(res, horario, "Horario actualizado");
  }),

  eliminar: asyncHandler(async (req, res) => {
    await horarioService.eliminar(Number(req.params.id));
    return sendSuccess(res, null, "Horario eliminado");
  }),
};
