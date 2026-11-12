import { Router } from "express";
import { idSchema, solicitarFichaSchema } from "../fichas/ficha.validation";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authRateLimiter, atencionPollingLimiter } from "../../middlewares/rateLimit.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { EstudianteService } from "./estudiante.service";
import { auxiliaturaService } from "./auxiliatura.service";
import { auxiliarCarnetService } from "../academico/auxiliar-carnet.service";

export { solicitarFichaSchema } from "../fichas/ficha.validation";

const router = Router();
const service = new EstudianteService();
router.use(requireAuth);
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
router.get("/auxiliatura", atencionPollingLimiter, asyncHandler(async (req, res) => sendSuccess(res, await auxiliaturaService.consultar(req.user!.idUsuario))));
router.get("/auxiliatura/carnet", atencionPollingLimiter, asyncHandler(async (req, res) => sendSuccess(res, await auxiliarCarnetService.emitirParaUsuario(req.user!.idUsuario))));
router.get("/atencion", atencionPollingLimiter, asyncHandler(async (req, res) => {
  const [fichas, jornadas] = await Promise.all([service.fichas(req.user!.idUsuario), service.jornadas(req.user!.idUsuario)]);
  return sendSuccess(res, { fichas, jornadas });
}));
router.get("/perfil", asyncHandler(async (req, res) => sendSuccess(res, await service.perfil(req.user!.idUsuario))));
router.get("/catalogo-horario", asyncHandler(async (req, res) => sendSuccess(res, await service.catalogoHorario(req.user!.idUsuario))));
router.get("/horarios-aulas", atencionPollingLimiter, asyncHandler(async (req, res) => sendSuccess(res, await service.horariosAulas(req.user!.idUsuario))));
router.get("/jornadas", asyncHandler(async (req, res) => sendSuccess(res, await service.jornadas(req.user!.idUsuario))));
router.get("/fichas", asyncHandler(async (req, res) => sendSuccess(res, await service.fichas(req.user!.idUsuario))));
router.post("/fichas/:id/cancelar", asyncHandler(async (req, res) => sendSuccess(res, await service.cancelar(req.user!.idUsuario, idSchema.parse(req.params.id)), "Ficha cancelada")));
router.post("/fichas", authRateLimiter, asyncHandler(async (req, res) => {
  const ficha = await service.solicitar(req.user!.idUsuario, solicitarFichaSchema.parse(req.body));
  return sendSuccess(res, ficha, "Ficha de atención registrada", 201);
}));
export default router;
