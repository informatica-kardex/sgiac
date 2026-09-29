import { Router } from "express";
import { comunicadoController } from "./comunicado.controller";
import { requireAuth, requirePermission, optionalAuth } from "../../middlewares/auth.middleware";
import { uploadComunicado } from "./comunicado.files";

const router = Router();

// Consulta publica: solo devuelve comunicados en estado "publicado"
// salvo que la peticion incluya un access token valido (panel admin).
router.get("/", optionalAuth, comunicadoController.listar);
router.get("/:id", optionalAuth, comunicadoController.obtener);
router.get("/:id/archivos/:adjunto", optionalAuth, comunicadoController.archivo);

const soloAdmin = [
  requireAuth,
  requirePermission("comunicados"),
];

router.post("/", ...soloAdmin, uploadComunicado, comunicadoController.crear);
router.put("/:id", ...soloAdmin, uploadComunicado, comunicadoController.actualizar);
router.delete("/:id", ...soloAdmin, comunicadoController.eliminar);
router.patch("/:id/publicar", ...soloAdmin, comunicadoController.publicar);
router.patch("/:id/archivar", ...soloAdmin, comunicadoController.archivar);

export default router;
