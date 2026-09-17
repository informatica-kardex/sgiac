import { Router } from "express";
import { roleController } from "./role.controller";
import { requireAuth, requireAdmin } from "../../middlewares/auth.middleware";

const router = Router();

router.use(requireAuth, requireAdmin("ADMINISTRADOR"));

router.get("/", roleController.listar);

export default router;
