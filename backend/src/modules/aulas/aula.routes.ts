import { Router } from "express";
import { aulaController } from "./aula.controller";
import { requireAuth, requirePermission } from "../../middlewares/auth.middleware";
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/apiResponse';
import { locationPublication, publishedLocations, publicacionUbicacionInput } from './ubicacion.service';

const router = Router();

router.use((_req,res,next) => { res.setHeader('Cache-Control','no-store'); next(); });
router.get('/ubicacion/visibilidad', asyncHandler(async (_req,res) => sendSuccess(res,await locationPublication.read())));
router.get('/ubicacion/publico', asyncHandler(async (_req,res) => sendSuccess(res,await publishedLocations('publico'))));
router.get('/ubicacion/estudiantes', requireAuth, asyncHandler(async (req,res) => sendSuccess(res,await publishedLocations('estudiantes',req.user!.idUsuario))));

router.use(requireAuth, requirePermission("aulas"));

router.get('/ubicacion/config', asyncHandler(async (_req,res) => sendSuccess(res,await locationPublication.read())));
router.put('/ubicacion/config', asyncHandler(async (req,res) => sendSuccess(res,await locationPublication.save(publicacionUbicacionInput.parse(req.body)),'Publicación de ubicación actualizada')));

router.get("/", aulaController.listar);
router.get("/:id", aulaController.obtener);
router.post("/", aulaController.crear);
router.put("/:id", aulaController.actualizar);
router.delete("/:id", aulaController.eliminar);

export default router;
