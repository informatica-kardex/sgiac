import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middlewares/auth.middleware";
import { authRateLimiter } from "../../middlewares/rateLimit.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { EstudianteService } from "./estudiante.service";

export const solicitarFichaSchema = z.object({
  idJornada: z.string().regex(/^[1-9]\d{0,18}$/).refine(v => BigInt(v) <= 9223372036854775807n),
  motivo: z.string().trim().min(3, "Indica el motivo de atención").max(150),
  detalle: z.string().trim().min(5, "Describe tu solicitud").max(2000),
});

const router = Router();
const service = new EstudianteService();
router.use(requireAuth);
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
router.get("/perfil", asyncHandler(async (req, res) => sendSuccess(res, await service.perfil(req.user!.idUsuario))));
router.get("/jornadas", asyncHandler(async (req, res) => sendSuccess(res, await service.jornadas(req.user!.idUsuario))));
router.get("/fichas", asyncHandler(async (req, res) => sendSuccess(res, await service.fichas(req.user!.idUsuario))));
router.post("/fichas", authRateLimiter, asyncHandler(async (req, res) => {
  const ficha = await service.solicitar(req.user!.idUsuario, solicitarFichaSchema.parse(req.body));
  return sendSuccess(res, ficha, "Ficha de atención registrada", 201);
}));
export default router;
