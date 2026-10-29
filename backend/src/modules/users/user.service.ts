import { prisma } from "../../database/prisma";
import { ApiError } from "../../utils/apiError";
import { hashPassword } from "../../utils/password";
import { UserRepository } from "./user.repository";
import { RoleRepository, ROLES_SUBADMIN, rolesActivos } from "../roles/role.repository";
import { CrearSubadminInput, CrearEstudianteInput } from "./user.validation";
import { Prisma } from "@prisma/client";

type UsuarioConRoles = NonNullable<Awaited<ReturnType<UserRepository["findByIdWithRoles"]>>>;
function perfil(usuario: UsuarioConRoles) {
  return {
    idUsuario: usuario.idUsuario.toString(), nombreCompleto: usuario.nombreCompleto,
    correo: usuario.correo, estado: usuario.estado.toLowerCase(),
    correoVerificado: usuario.correoVerificado, debeCambiarPassword: usuario.debeCambiarPassword,
    permisos: (usuario.permisos ?? []).map(({ modulo, desde, hasta }) => ({ modulo, desde, hasta })),
    fechaCreacion: usuario.fechaCreacion, roles: rolesActivos(usuario.roles),
    ciRegistrado: Boolean(usuario.estudiante?.ci),
  };
}

export class UserService {
  private repository = new UserRepository();
  private roleRepository = new RoleRepository();

  async crearEstudiante(input: CrearEstudianteInput, actor: bigint) {
    const contrasenaHash = await hashPassword(input.ci);
    try {
      return await prisma.$transaction(async tx => {
        const rol = await tx.rol.findUnique({ where: { nombre: 'CONSULTA_INTERNA' } });
        if (!rol || rol.estado !== 'ACTIVO') throw ApiError.conflict('El rol de estudiante no está disponible.');
        const existente = await tx.estudiante.findFirst({ where: { OR: [{ ci: input.ci }, { ru: input.ru }, { correo_institucional: input.correo }] } });
        if (existente && (existente.id_usuario || existente.ci !== input.ci || existente.ru !== input.ru || existente.correo_institucional !== input.correo)) {
          throw ApiError.conflict('Ya existe un estudiante con ese CI, RU o correo. Revisa sus datos antes de crear la cuenta.');
        }
        const usuario = await tx.usuario.create({ data: {
          nombreCompleto: `${input.nombres} ${input.apellidos}`, correo: input.correo, contrasenaHash,
          estado: 'ACTIVO', debeCambiarPassword: true, correoVerificado: false,
          roles: { create: { idRol: rol.idRol } },
        } });
        const data = { nombres: input.nombres, apellidos: input.apellidos, ci: input.ci, ru: input.ru,
          correo_institucional: input.correo, carrera: input.mencion, id_usuario: usuario.idUsuario };
        const estudiante = existente
          ? await tx.estudiante.update({ where: { id_estudiante: existente.id_estudiante }, data })
          : await tx.estudiante.create({ data });
        await tx.bitacora.create({ data: { accion: 'ESTUDIANTE_CREADO', entidadAfectada: 'usuario',
          idRegistroAfectado: String(usuario.idUsuario), detalle: 'Cuenta institucional creada por el administrador; contraseña temporal y verificación de correo pendientes', idUsuario: actor } });
        return { idUsuario: String(usuario.idUsuario), idEstudiante: String(estudiante.id_estudiante) };
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw ApiError.conflict('Ya existe una cuenta o estudiante con ese correo, CI o RU.');
      throw e;
    }
  }

  async resetearPassword(idUsuario: bigint, ci: string | undefined, actor: bigint) {
    if (idUsuario === actor) throw ApiError.forbidden("No puedes restablecer tu propia contraseña desde esta opción");
    return prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id_usuario FROM usuario WHERE id_usuario = ${idUsuario} FOR UPDATE`;
      const usuario = await tx.usuario.findUnique({ where: { idUsuario }, include: { estudiante: true, roles: { include: { rol: true } } } });
      if (!usuario) throw ApiError.notFound("Usuario no encontrado");
      if (usuario.roles.some(r => r.rol.nombre === "ADMINISTRADOR")) throw ApiError.forbidden("No puedes restablecer la contraseña de un administrador");
      const temporal = usuario.estudiante?.ci || ci;
      if (!temporal) throw ApiError.badRequest("Ingresa el CI del subadministrador para restablecer su contraseña");
      const contrasenaHash = await hashPassword(temporal);
      await tx.usuario.update({ where: { idUsuario }, data: { contrasenaHash, debeCambiarPassword: true } });
      await tx.refreshToken.updateMany({ where: { idUsuario, revocado: false }, data: { revocado: true } });
      await tx.passwordResetToken.updateMany({ where: { idUsuario, usado: false }, data: { usado: true } });
      await tx.bitacora.create({ data: { accion: "ADMIN_RESET_PASSWORD", entidadAfectada: "usuario",
        idRegistroAfectado: idUsuario.toString(), detalle: "Contraseña temporal restablecida al CI; cambio obligatorio al ingresar", idUsuario: actor } });
      return { mensaje: "Contraseña restablecida al CI. Debe iniciar sesión y cambiarla antes de continuar." };
    });
  }

  async obtenerPerfil(idUsuario: bigint | number) {
    const usuario = await this.repository.findByIdWithRoles(idUsuario);
    if (!usuario) throw ApiError.notFound("Usuario no encontrado");
    return perfil(usuario);
  }

  async listarUsuarios() {
    return (await this.repository.findAllWithRoles()).map(perfil);
  }

  private async validarCuentaEditable(idUsuario: bigint | number, actor: bigint) {
    if (BigInt(idUsuario) === actor) throw ApiError.forbidden("No puedes cambiar tu propia cuenta desde esta opción");
    const usuario = await this.repository.findByIdWithRoles(idUsuario);
    if (!usuario) throw ApiError.notFound("Usuario no encontrado");
    if (usuario.roles.some(r => r.rol.nombre === "ADMINISTRADOR")) {
      throw ApiError.forbidden("Esta opción permite gestionar subadministradores y usuarios, no administradores");
    }
    return usuario;
  }

  async crearSubadmin(input: CrearSubadminInput, actor: bigint) {
    const rol = await this.roleRepository.findByNombre("SUBADMINISTRADOR");
    if (!rol || rol.estado.toUpperCase() !== "ACTIVO") throw ApiError.badRequest("El rol Subadministrador no está disponible. Aplica la migración de permisos.");
    if (await this.repository.findByCorreo(input.correo)) throw ApiError.conflict("Ya existe una cuenta con este correo");
    const contrasenaHash = await hashPassword(input.ci);
    return prisma.$transaction(async tx => {
      const usuario = await tx.usuario.create({
        data: {
          nombreCompleto: input.nombreCompleto, correo: input.correo, contrasenaHash,
          estado: "ACTIVO", debeCambiarPassword: true, correoVerificado: false,
          roles: { create: { idRol: rol.idRol, estado: "ACTIVO" } },
          permisos: { create: input.permisos },
        },
        include: { permisos: true, estudiante: { select: { ci: true } }, roles: { include: { rol: true } } },
      });
      await tx.bitacora.create({ data: {
        accion: "SUBADMIN_CREADO", entidadAfectada: "usuario", idRegistroAfectado: usuario.idUsuario.toString(),
        detalle: JSON.stringify({ rol: rol.nombre, permisos: input.permisos }), idUsuario: actor,
      } });
      return perfil(usuario);
    });
  }

  async cambiarEstado(idUsuario: bigint | number, estado: "activo" | "inactivo", actor: bigint) {
    await this.validarCuentaEditable(idUsuario, actor);
    await prisma.$transaction(async tx => {
      await tx.usuario.update({ where: { idUsuario }, data: { estado: estado.toUpperCase() } });
      await tx.refreshToken.updateMany({ where: { idUsuario, revocado: false }, data: { revocado: true } });
      await tx.bitacora.create({ data: {
        accion: "USUARIO_ESTADO_CAMBIADO", entidadAfectada: "usuario", idRegistroAfectado: idUsuario.toString(),
        detalle: `Estado: ${estado}`, idUsuario: actor,
      } });
    });
    return this.obtenerPerfil(idUsuario);
  }

  async asignarPermisos(idUsuario: bigint | number, permisos: CrearSubadminInput["permisos"], actor: bigint) {
    await this.validarCuentaEditable(idUsuario, actor);
    await prisma.$transaction(async tx => {
      // Serializa dos ediciones simultáneas de la misma cuenta.
      await tx.$queryRaw`SELECT id_usuario FROM usuario WHERE id_usuario = ${idUsuario} FOR UPDATE`;
      const usuario = await tx.usuario.findUnique({ where: { idUsuario }, include: { roles: { include: { rol: true } } } });
      if (!usuario || usuario.roles.some(r => r.rol.nombre === "ADMINISTRADOR") ||
          !rolesActivos(usuario.roles).some(r => ROLES_SUBADMIN.includes(r))) {
        throw ApiError.forbidden("Solo puedes asignar funciones a un subadministrador");
      }
      await tx.permisoUsuario.deleteMany({ where: { idUsuario } });
      if (permisos.length) await tx.permisoUsuario.createMany({ data: permisos.map(p => ({ ...p, idUsuario })) });
      await tx.bitacora.create({ data: {
        accion: "SUBADMIN_PERMISOS_CAMBIADOS", entidadAfectada: "usuario", idRegistroAfectado: idUsuario.toString(),
        detalle: JSON.stringify({ permisos }), idUsuario: actor,
      } });
    });
    return this.obtenerPerfil(idUsuario);
  }
}
