import { prisma } from "../../database/prisma";

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
      include: { roles: { include: { rol: true } } },
    });
  }

  async findByIdWithRolesByCorreo(correo: string) {
    return prisma.usuario.findUnique({
      where: { correo },
      include: { roles: { include: { rol: true } } },
    });
  }

  async findAllWithRoles() {
    return prisma.usuario.findMany({
      include: { roles: { include: { rol: true } } },
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

  async actualizarContrasena(idUsuario: bigint | number, contrasenaHash: string) {
    return prisma.usuario.update({
      where: { idUsuario },
      data: { contrasenaHash, debeCambiarPassword: false },
    });
  }

  async actualizarEstado(idUsuario: bigint | number, estado: string) {
    return prisma.usuario.update({
      where: { idUsuario },
      data: { estado },
    });
  }
}
