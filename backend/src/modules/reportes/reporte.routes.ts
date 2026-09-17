import { Router } from "express";
import { reporteController } from "./reporte.controller";
import { requireAuth, requireAdmin } from "../../middlewares/auth.middleware";

const router = Router();

router.use(requireAuth, requireAdmin());

router.get("/dashboard", reporteController.dashboard);
router.get("/comunicados-por-categoria", reporteController.comunicadosPorCategoria);
router.get("/fichas-por-estado", reporteController.fichasPorEstado);
router.get("/aulas-por-estado", reporteController.aulasPorEstado);

export default router;
