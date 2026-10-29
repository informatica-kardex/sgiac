import { Router } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { telegramService } from "./telegram.service";
import { telegramVinculo } from "./telegram.vinculo";
import { requireAuth } from "../../middlewares/auth.middleware";
import { documentosMutationLimiter, atencionPollingLimiter } from "../../middlewares/rateLimit.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { z } from "zod";

const router = Router();
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
router.get("/", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  return sendSuccess(res, telegramService.getPublicInfo());
});
router.get("/vinculo", requireAuth, atencionPollingLimiter, asyncHandler(async (req, res) => sendSuccess(res, { ...await telegramVinculo.estado(req.user!.idUsuario), ...telegramService.getPublicInfo() })));
router.post("/vinculo", requireAuth, documentosMutationLimiter, asyncHandler(async (req, res) => {
  z.object({ consentimiento: z.literal(true) }).parse(req.body);
  return sendSuccess(res, await telegramVinculo.crear(req.user!.idUsuario, telegramService.getPublicInfo().url));
}));
router.delete("/vinculo", requireAuth, asyncHandler(async (req, res) => sendSuccess(res, await telegramVinculo.desvincular(req.user!.idUsuario))));

export default router;
