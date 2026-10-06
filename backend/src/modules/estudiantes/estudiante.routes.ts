import { Router } from "express";
import { idSchema, solicitarFichaSchema } from "../fichas/ficha.validation";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authRateLimiter, atencionPollingLimiter } from "../../middlewares/rateLimit.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { EstudianteService } from "./estudiante.service";

export { solicitarFichaSchema } from "../fichas/ficha.validation";

const router = Router();
const service = new EstudianteService();
router.use(requireAuth);
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
router.get("/atencion", atencionPollingLimiter, asyncHandler(async (req, res) => {
  const [fichas, jornadas] = await Promise.all([service.fichas(req.user!.idUsuario), service.jornadas(req.user!.idUsuario)]);
  return sendSuccess(res, { fichas, jornadas });
}));
router.get("/perfil", asyncHandler(async (req, res) => sendSuccess(res, await service.perfil(req.user!.idUsuario))));
router.get("/jornadas", asyncHandler(async (req, res) => sendSuccess(res, await service.jornadas(req.user!.idUsuario))));
router.get("/fichas", asyncHandler(async (req, res) => sendSuccess(res, await service.fichas(req.user!.idUsuario))));
router.post("/fichas/:id/cancelar", asyncHandler(async (req, res) => sendSuccess(res, await service.cancelar(req.user!.idUsuario, idSchema.parse(req.params.id)), "Ficha cancelada")));
router.post("/fichas", authRateLimiter, asyncHandler(async (req, res) => {
  const ficha = await service.solicitar(req.user!.idUsuario, solicitarFichaSchema.parse(req.body));
  return sendSuccess(res, ficha, "Ficha de atención registrada", 201);
}));
export default router;
