import { prisma } from "../../database/prisma";
import { ApiError } from "../../utils/apiError";

export interface CreateUsuarioInput {
  nombreCompleto: string;
  correo: string;
  contrasenaHash: string;
  debeCambiarPassword?: boolean;
}

export class UserRepository {
  async findByCorreo(correo: string) {
    return prisma.usuario.findUnique({
      where: { correo },
    });
  }

  async findById(idUsuario: bigint | number) {
    return prisma.usuario.findUnique({
      where: { idUsuario },
    });
  }

  async findByIdWithRoles(idUsuario: bigint | number) {
    return prisma.usuario.findUnique({
      where: { idUsuario },
      include: { permisos: true, estudiante: { select: { ci: true } }, roles: { include: { rol: true } } },
    });
  }

  async findByIdWithRolesByCorreo(correo: string) {
    return prisma.usuario.findUnique({
      where: { correo },
      include: { permisos: true, estudiante: { select: { ci: true } }, roles: { include: { rol: true } } },
    });
  }

  async findAllWithRoles() {
    return prisma.usuario.findMany({
      include: { permisos: true, estudiante: { select: { ci: true } }, roles: { include: { rol: true } } },
      orderBy: { fechaCreacion: "desc" },
    });
  }

  async create(input: CreateUsuarioInput) {
    return prisma.usuario.create({
      data: {
        nombreCompleto: input.nombreCompleto,
        correo: input.correo,
        contrasenaHash: input.contrasenaHash,
        estado: "activo",
        correoVerificado: false,
        debeCambiarPassword: input.debeCambiarPassword ?? false,
      },
    });
  }

  async marcarCorreoVerificado(idUsuario: bigint | number) {
    return prisma.usuario.update({
      where: { idUsuario },
      data: { correoVerificado: true },
    });
  }

  async actualizarContrasena(idUsuario: bigint | number, contrasenaHash: string, hashAnterior: string) {
    return prisma.$transaction(async tx => {
      const changed = await tx.usuario.updateMany({
        where: { idUsuario, contrasenaHash: hashAnterior, estado: "ACTIVO" },
        data: { contrasenaHash, debeCambiarPassword: false },
      });
      if (changed.count !== 1) throw ApiError.conflict("La cuenta cambió. Inicia sesión nuevamente antes de cambiar la contraseña.");
      await tx.passwordResetToken.updateMany({ where: { idUsuario, usado: false }, data: { usado: true } });
      await tx.refreshToken.updateMany({ where: { idUsuario, revocado: false }, data: { revocado: true } });
    });
  }

  async actualizarEstado(idUsuario: bigint | number, estado: string) {
    return prisma.usuario.update({
      where: { idUsuario },
      data: { estado },
    });
  }
}
