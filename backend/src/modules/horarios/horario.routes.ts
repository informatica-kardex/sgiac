import { Router } from "express";
import { horarioController } from "./horario.controller";
import { requireAuth, requirePermission } from "../../middlewares/auth.middleware";

const router = Router();

// Consulta publica (usada por /horarios en el portal publico)
router.get("/", horarioController.listar);
router.get("/:id", horarioController.obtener);

// Mutaciones exclusivas del panel administrativo
router.post('/lote', requireAuth, requirePermission('horarios'), horarioController.crearLote);
router.post(
  "/",
  requireAuth,
  requirePermission("horarios"),
  horarioController.crear
);
router.put(
  "/:id",
  requireAuth,
  requirePermission("horarios"),
  horarioController.actualizar
);
router.delete(
  "/:id",
  requireAuth,
  requirePermission("horarios"),
  horarioController.eliminar
);

export default router;
