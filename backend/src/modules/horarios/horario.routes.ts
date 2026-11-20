import { Router } from "express";
import { horarioController } from "./horario.controller";
import { requireAuth, requirePermission } from "../../middlewares/auth.middleware";
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/apiResponse';
import { horarioImport } from './horario.import';
import { publishedSchedules, schedulePublication } from './horario.publicacion';

const router = Router();

router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
router.get('/publicacion/visibilidad', asyncHandler(async (_req, res) => sendSuccess(res, await schedulePublication.read())));
router.get('/publicacion/publico', asyncHandler(async (_req, res) => sendSuccess(res, await publishedSchedules('publico'))));
router.get('/publicacion/config', requireAuth, requirePermission('horarios'), asyncHandler(async (_req, res) => sendSuccess(res, await schedulePublication.read())));
router.put('/publicacion/config', requireAuth, requirePermission('horarios'), asyncHandler(async (req, res) =>
  sendSuccess(res, await schedulePublication.save(req.body), 'Publicación de horarios actualizada')));

// La consulta interna conserva sus requisitos de sesión.
router.get("/", requireAuth, horarioController.listar);
router.get("/:id", requireAuth, horarioController.obtener);

// Mutaciones exclusivas del panel administrativo
router.post('/importar-pdf/validar', requireAuth, requirePermission('horarios'), asyncHandler(async (req, res) =>
  sendSuccess(res, await horarioImport.preview(req.body), 'PDF revisado')));
router.post('/importar-pdf/guardar', requireAuth, requirePermission('horarios'), asyncHandler(async (req, res) =>
  sendSuccess(res, await horarioImport.apply(req.body), 'Horarios importados', 201)));
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
