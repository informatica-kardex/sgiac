import { Router } from 'express';
import { requireAuth, requirePermission } from '../../middlewares/auth.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/apiResponse';
import { ApiError } from '../../utils/apiError';
import { idSchema } from '../users/user.validation';
import { AuditRepository } from './audit.repository';
import { auditQuerySchema, csvCell } from './audit.query';

const router = Router();
const repository = new AuditRepository();
router.use(requireAuth, requirePermission('auditoria'));
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
router.get('/', asyncHandler(async (req, res) => sendSuccess(res, await repository.list(auditQuerySchema.parse(req.query)))));
router.get('/filtros', asyncHandler(async (_req, res) => sendSuccess(res, await repository.filters())));
router.get('/exportar', asyncHandler(async (req, res) => {
  const rows = await repository.export(auditQuerySchema.parse(req.query));
  if (rows.length > 10000) throw ApiError.badRequest('La exportación supera 10.000 eventos. Reduce el rango de fechas o aplica más filtros.');
  const columns = ['ID', 'Fecha UTC', 'Acción', 'Tipo', 'Resultado', 'Entidad', 'Registro', 'Usuario ID', 'Usuario', 'Correo', 'Detalle'];
  const lines = rows.map(row => [row.idBitacora, row.fechaHora.toISOString(), row.accion, row.tipo, row.resultado,
    row.entidadAfectada, row.idRegistroAfectado, row.idUsuario, row.usuario?.nombreCompleto,
    row.usuario?.correo, JSON.stringify(row.detalle)].map(csvCell).join(';'));
  res.setHeader('Content-Disposition', `attachment; filename="auditoria-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.type('text/csv; charset=utf-8').send('\uFEFF' + [columns.map(csvCell).join(';'), ...lines].join('\r\n'));
}));
router.get('/:id', asyncHandler(async (req, res) => {
  const row = await repository.detail(idSchema.parse(req.params.id));
  if (!row) throw ApiError.notFound('Evento de auditoría no encontrado');
  return sendSuccess(res, row);
}));
export default router;
