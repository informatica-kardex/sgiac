import { Router } from "express";
import { horarioController } from "./horario.controller";
import { requireAuth, requireAdmin } from "../../middlewares/auth.middleware";

const router = Router();

// Consulta publica (usada por /horarios en el portal publico)
router.get("/", horarioController.listar);
router.get("/:id", horarioController.obtener);

// Mutaciones exclusivas del panel administrativo
router.post(
  "/",
  requireAuth,
  requireAdmin("ADMINISTRADOR", "SUBADMINISTRADOR_ACADEMICO"),
  horarioController.crear
);
router.put(
  "/:id",
  requireAuth,
  requireAdmin("ADMINISTRADOR", "SUBADMINISTRADOR_ACADEMICO"),
  horarioController.actualizar
);
router.delete(
  "/:id",
  requireAuth,
  requireAdmin("ADMINISTRADOR", "SUBADMINISTRADOR_ACADEMICO"),
  horarioController.eliminar
);

export default router;
