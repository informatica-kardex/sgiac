import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { sendSuccess } from "../../utils/apiResponse";
import { UserService } from "./user.service";
import { asignarPermisosSchema, crearSubadminSchema, idSchema, resetearPasswordSchema } from "./user.validation";

const userService = new UserService();

const estadoSchema = z.object({
  estado: z.enum(["activo", "inactivo"]),
});

export const userController = {
  resetearPassword: asyncHandler(async (req, res) => {
    const resultado = await userService.resetearPassword(idSchema.parse(req.params.id),
      resetearPasswordSchema.parse(req.body).ci, BigInt(req.user!.idUsuario));
    return sendSuccess(res, resultado, "Contraseña restablecida al CI. El cambio al ingresar es obligatorio.");
  }),
  crear: asyncHandler(async (req, res) => {
    const usuario = await userService.crearSubadmin(crearSubadminSchema.parse(req.body), BigInt(req.user!.idUsuario));
    return sendSuccess(res, usuario, "Subadministrador creado. Debe ingresar con su correo y su CI como contraseña temporal.", 201);
  }),
  listar: asyncHandler(async (_req, res) => {
    const usuarios = await userService.listarUsuarios();
    return sendSuccess(res, usuarios, "Usuarios obtenidos");
  }),

  cambiarEstado: asyncHandler(async (req, res) => {
    const idUsuario = idSchema.parse(req.params.id);
    const { estado } = estadoSchema.parse(req.body);
    const usuario = await userService.cambiarEstado(idUsuario, estado, BigInt(req.user!.idUsuario));
    return sendSuccess(res, usuario, "Estado actualizado");
  }),

  asignarPermisos: asyncHandler(async (req, res) => {
    const idUsuario = idSchema.parse(req.params.id);
    const { permisos } = asignarPermisosSchema.parse(req.body);
    const relacion = await userService.asignarPermisos(idUsuario, permisos, BigInt(req.user!.idUsuario));
    return sendSuccess(res, relacion, "Funciones actualizadas correctamente");
  }),
};
