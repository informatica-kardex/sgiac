import { Router } from "express";
import { prisma } from "../../database/prisma";
import { requireAdmin, requireAuth } from "../../middlewares/auth.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { ahoraBolivia, PENDIENTES } from "../fichas/ficha.shared";
import { Permiso, tienePermiso } from "../roles/permissions";

export async function solicitudesPendientes(usuario: { roles: string[]; permisos?: Permiso[] }, now = new Date()) {
  const { fecha, hora } = ahoraBolivia(now);
  const hoy = new Date(`${fecha}T00:00:00Z`);
  const [aulas, documentos, fichas] = await Promise.all([
    usuario.roles.includes("ADMINISTRADOR")
      ? prisma.solicitudAula.count({ where: { estado: "PENDIENTE" } }) : 0,
    tienePermiso(usuario, "documentos", now.getTime())
      ? prisma.solicitudDocumento.count({ where: { estado: "SOLICITADA" } }) : 0,
    tienePermiso(usuario, "fichas", now.getTime())
      ? prisma.ficha_atencion.count({ where: {
        estado_actual: { in: PENDIENTES },
        jornada_atencion: { estado: "ACTIVO", OR: [
          { fecha: { gt: hoy } },
          { fecha: hoy, hora_fin: { gt: new Date(`1970-01-01T${hora}Z`) } },
        ] },
      } }) : 0,
  ]);
  return { "solicitudes-aulas": aulas, documentos, fichas };
}

const router = Router();
router.use(requireAuth, requireAdmin());
router.get("/pendientes", asyncHandler(async (req, res) => {
  sendSuccess(res, await solicitudesPendientes(req.user!));
}));
export default router;
