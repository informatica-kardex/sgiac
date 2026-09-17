import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { UserService } from "./user.service";

const userService = new UserService();

const estadoSchema = z.object({
  estado: z.enum(["activo", "inactivo"]),
});

const asignarRolSchema = z.object({
  idRol: z.number().int().positive(),
});

export const userController = {
  listar: asyncHandler(async (_req, res) => {
    const usuarios = await userService.listarUsuarios();
    return sendSuccess(res, usuarios, "Usuarios obtenidos");
  }),

  cambiarEstado: asyncHandler(async (req, res) => {
    const idUsuario = Number(req.params.id);
    const { estado } = estadoSchema.parse(req.body);
    const usuario = await userService.cambiarEstado(idUsuario, estado);
    return sendSuccess(res, usuario, "Estado actualizado");
  }),

  asignarRol: asyncHandler(async (req, res) => {
    const idUsuario = Number(req.params.id);
    const { idRol } = asignarRolSchema.parse(req.body);
    const relacion = await userService.asignarRol(idUsuario, idRol);
    return sendSuccess(res, relacion, "Rol asignado correctamente");
  }),
};
