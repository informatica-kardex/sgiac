import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/apiResponse';
import { solicitudAulaService as s } from './solicitud-aula.service';

const router = Router();
router.use(requireAuth);
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
router.get('/perfil', asyncHandler(async (req, res) => sendSuccess(res, await s.perfil(req.user!.idUsuario))));
router.get('/mias', asyncHandler(async (req, res) => sendSuccess(res, await s.listar(req.user!.idUsuario))));
router.post('/disponibilidad', asyncHandler(async (req, res) => sendSuccess(res, await s.disponibles(req.user!.idUsuario, req.body))));
router.get('/admin', requireAdmin('ADMINISTRADOR'), asyncHandler(async (_req, res) => sendSuccess(res, await s.listar())));
router.post('/admin/:id/disponibilidad', requireAdmin('ADMINISTRADOR'), asyncHandler(async (req, res) => sendSuccess(res, await s.disponiblesAdmin(req.params.id, req.body))));
router.post('/admin/:id/revisar', requireAdmin('ADMINISTRADOR'), asyncHandler(async (req, res) => sendSuccess(res, await s.revisar(req.user!.idUsuario, req.params.id, req.body))));
router.post('/', asyncHandler(async (req, res) => sendSuccess(res, await s.crear(req.user!.idUsuario, req.body), 'Solicitud enviada a Kardex', 201)));
router.post('/:id/responder', asyncHandler(async (req, res) => sendSuccess(res, await s.responder(req.user!.idUsuario, req.params.id, req.body))));
router.post('/:id/cancelar', asyncHandler(async (req, res) => sendSuccess(res, await s.cancelar(req.user!.idUsuario, req.params.id, req.body))));
export default router;
