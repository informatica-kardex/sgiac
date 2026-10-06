import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { AulaService } from "./aula.service";
import { actualizarAulaSchema, crearAulaSchema } from "./aula.validation";

const aulaService = new AulaService();

export const aulaController = {
  listar: asyncHandler(async (_req, res) => {
    const aulas = await aulaService.listar();
    return sendSuccess(res, aulas, "Aulas obtenidas");
  }),

  obtener: asyncHandler(async (req, res) => {
    const aula = await aulaService.obtener(req.params.id);
    return sendSuccess(res, aula, "Aula obtenida");
  }),

  crear: asyncHandler(async (req, res) => {
    const data = crearAulaSchema.parse(req.body);
    const aula = await aulaService.crear(data);
    return sendSuccess(res, aula, "Aula creada", 201);
  }),

  actualizar: asyncHandler(async (req, res) => {
    const data = actualizarAulaSchema.parse(req.body);
    const aula = await aulaService.actualizar(req.params.id, data);
    return sendSuccess(res, aula, "Aula actualizada");
  }),

  eliminar: asyncHandler(async (req, res) => {
    await aulaService.eliminar(req.params.id);
    return sendSuccess(res, null, "Aula eliminada");
  }),
};
