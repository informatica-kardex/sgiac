import { Router } from "express";
import { userController } from "./user.controller";
import { requireAuth, requireAdmin } from "../../middlewares/auth.middleware";

const router = Router();

// Todo el modulo de usuarios es exclusivo del panel administrativo.
router.use(requireAuth, requireAdmin("ADMINISTRADOR"));

router.get("/", userController.listar);
router.post("/", userController.crear);
router.patch("/:id/estado", userController.cambiarEstado);
router.patch("/:id/permisos", userController.asignarPermisos);
router.post("/:id/reset-password", userController.resetearPassword);

export default router;
