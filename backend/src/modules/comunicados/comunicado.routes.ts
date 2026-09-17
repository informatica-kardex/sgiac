import { Router } from "express";
import { comunicadoController } from "./comunicado.controller";
import { requireAuth, requireAdmin, optionalAuth } from "../../middlewares/auth.middleware";

const router = Router();

// Consulta publica: solo devuelve comunicados en estado "publicado"
// salvo que la peticion incluya un access token valido (panel admin).
router.get("/", optionalAuth, comunicadoController.listar);
router.get("/:id", optionalAuth, comunicadoController.obtener);

const soloAdmin = [
  requireAuth,
  requireAdmin("ADMINISTRADOR", "SUBADMINISTRADOR_ACADEMICO"),
];

router.post("/", ...soloAdmin, comunicadoController.crear);
router.put("/:id", ...soloAdmin, comunicadoController.actualizar);
router.delete("/:id", ...soloAdmin, comunicadoController.eliminar);
router.patch("/:id/publicar", ...soloAdmin, comunicadoController.publicar);
router.patch("/:id/archivar", ...soloAdmin, comunicadoController.archivar);

export default router;
