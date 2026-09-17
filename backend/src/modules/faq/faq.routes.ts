import { Router } from "express";
import { faqController } from "./faq.controller";
import { requireAuth, requireAdmin, optionalAuth } from "../../middlewares/auth.middleware";

const router = Router();

router.get("/", optionalAuth, faqController.listar);

const soloAdmin = [
  requireAuth,
  requireAdmin("ADMINISTRADOR", "SUBADMINISTRADOR_ACADEMICO"),
];

router.post("/", ...soloAdmin, faqController.crear);
router.put("/:id", ...soloAdmin, faqController.actualizar);
router.delete("/:id", ...soloAdmin, faqController.eliminar);

export default router;
