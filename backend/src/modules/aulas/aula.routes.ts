import { Router } from "express";
import { aulaController } from "./aula.controller";
import { requireAuth, requirePermission } from "../../middlewares/auth.middleware";

const router = Router();

router.use(requireAuth, requirePermission("aulas"));

router.get("/", aulaController.listar);
router.get("/:id", aulaController.obtener);
router.post("/", aulaController.crear);
router.put("/:id", aulaController.actualizar);
router.delete("/:id", aulaController.eliminar);

export default router;
