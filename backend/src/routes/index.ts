import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import userRoutes from "../modules/users/user.routes";
import roleRoutes from "../modules/roles/role.routes";
import aulaRoutes from "../modules/aulas/aula.routes";
import horarioRoutes from "../modules/horarios/horario.routes";
import comunicadoRoutes from "../modules/comunicados/comunicado.routes";
import faqRoutes from "../modules/faq/faq.routes";
import fichaRoutes from "../modules/fichas/ficha.routes";
import reporteRoutes from "../modules/reportes/reporte.routes";

const router = Router();

// ------------------------------------------------------------
// Registro central de rutas de la API.
// ------------------------------------------------------------

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/roles", roleRoutes);
router.use("/aulas", aulaRoutes);
router.use("/horarios", horarioRoutes);
router.use("/comunicados", comunicadoRoutes);
router.use("/faq", faqRoutes);
router.use("/fichas", fichaRoutes);
router.use("/reportes", reporteRoutes);

router.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "SGIAC API operativa",
    timestamp: new Date().toISOString(),
  });
});

export default router;
