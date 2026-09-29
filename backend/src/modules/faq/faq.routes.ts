import { Router } from "express";
import { faqController } from "./faq.controller";
import { requireAuth, requirePermission, optionalAuth } from "../../middlewares/auth.middleware";

const router = Router();

router.get("/", optionalAuth, faqController.listar);

const soloAdmin = [
  requireAuth,
  requirePermission("faq"),
];

router.post("/", ...soloAdmin, faqController.crear);
router.put("/:id", ...soloAdmin, faqController.actualizar);
router.delete("/:id", ...soloAdmin, faqController.eliminar);

export default router;
