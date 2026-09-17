import { Router } from "express";
import { fichaController } from "./ficha.controller";
import { requireAuth, requireAdmin } from "../../middlewares/auth.middleware";
import { authRateLimiter } from "../../middlewares/rateLimit.middleware";

const router = Router();

// Registro publico de una solicitud de atencion (formulario de
// contacto de "Atención Kardex" en el portal público).
router.post("/", authRateLimiter, fichaController.crear);

// Gestion administrativa de las fichas (bandeja de atencion)
const soloAdmin = [
  requireAuth,
  requireAdmin("ADMINISTRADOR", "SUBADMINISTRADOR_ATENCION"),
];

router.get("/", ...soloAdmin, fichaController.listar);
router.get("/:id", ...soloAdmin, fichaController.obtener);
router.patch("/:id", ...soloAdmin, fichaController.actualizar);

export default router;
