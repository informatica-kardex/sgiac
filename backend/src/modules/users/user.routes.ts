import { Router } from "express";
import { userController } from "./user.controller";
import { requireAuth, requireAdmin, requirePermission } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { ApiError } from "../../utils/apiError";
import { prisma } from "../../database/prisma";
import { idSchema } from "./user.validation";

const router = Router();

router.use(requireAuth);

// Delegar estudiantes nunca permite gestionar otras cuentas administrativas.
const cuentaEditable = asyncHandler(async (req, res, next) => {
  if (req.user!.roles.includes('ADMINISTRADOR')) return next();
  requirePermission('estudiantes')(req, res, async error => {
    if (error) return next(error);
    try {
      const usuario = await prisma.usuario.findUnique({ where: { idUsuario: idSchema.parse(req.params.id) },
        include: { roles: { include: { rol: true } }, estudiante: true } });
      if (!usuario || usuario.roles.some(r => ['ADMINISTRADOR', 'SUBADMINISTRADOR'].includes(r.rol.nombre)) ||
          (!usuario.estudiante && !usuario.roles.some(r => r.rol.nombre === 'CONSULTA_INTERNA'))) {
        return next(ApiError.forbidden('Solo puedes gestionar cuentas de estudiantes'));
      }
      next();
    } catch (error) { next(error); }
  });
});

router.get("/", requireAdmin("ADMINISTRADOR"), userController.listar);
router.get("/estudiantes", requirePermission('estudiantes'), userController.listarEstudiantes);
router.post("/", requireAdmin("ADMINISTRADOR"), userController.crear);
router.post("/estudiantes", requirePermission('estudiantes'), userController.crearEstudiante);
router.patch("/:id/estado", cuentaEditable, userController.cambiarEstado);
router.patch("/:id/permisos", requireAdmin("ADMINISTRADOR"), userController.asignarPermisos);
router.post("/:id/reset-password", cuentaEditable, userController.resetearPassword);

export default router;
