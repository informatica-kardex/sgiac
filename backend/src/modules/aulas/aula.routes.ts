import { Router } from "express";
import { aulaController } from "./aula.controller";
import { requireAuth, requireAdmin } from "../../middlewares/auth.middleware";

const router = Router();

router.use(requireAuth, requireAdmin("ADMINISTRADOR", "SUBADMINISTRADOR_ACADEMICO"));

router.get("/", aulaController.listar);
router.get("/:id", aulaController.obtener);
router.post("/", aulaController.crear);
router.put("/:id", aulaController.actualizar);
router.delete("/:id", aulaController.eliminar);

export default router;
