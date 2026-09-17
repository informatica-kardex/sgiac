import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { FichaService } from "./ficha.service";
import { actualizarFichaSchema, crearFichaSchema } from "./ficha.validation";

const fichaService = new FichaService();

export const fichaController = {
  listar: asyncHandler(async (_req, res) => {
    const fichas = await fichaService.listar();
    return sendSuccess(res, fichas, "Fichas de atención obtenidas");
  }),

  obtener: asyncHandler(async (req, res) => {
    const ficha = await fichaService.obtener(Number(req.params.id));
    return sendSuccess(res, ficha, "Ficha obtenida");
  }),

  // Este endpoint es publico: cualquier persona puede generar una
  // ficha de atencion Kardex sin necesidad de iniciar sesion.
  crear: asyncHandler(async (req, res) => {
    const data = crearFichaSchema.parse(req.body);
    const ficha = await fichaService.crear(data);
    return sendSuccess(res, ficha, "Ficha de atención registrada", 201);
  }),

  actualizar: asyncHandler(async (req, res) => {
    const data = actualizarFichaSchema.parse(req.body);
    const ficha = await fichaService.actualizar(Number(req.params.id), data);
    return sendSuccess(res, ficha, "Ficha de atención actualizada");
  }),
};
