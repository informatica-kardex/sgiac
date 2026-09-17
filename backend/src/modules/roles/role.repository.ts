import { prisma } from "../../database/prisma";

// Nombre del rol asignado por defecto a todo usuario que se
// registra por el formulario publico.
export const ROL_POR_DEFECTO = "CONSULTA_INTERNA";

// Roles con acceso al panel administrativo (/admin).
export const ROLES_ADMINISTRATIVOS = [
  "ADMINISTRADOR",
  "SUBADMINISTRADOR_ACADEMICO",
  "SUBADMINISTRADOR_ATENCION",
] as const;

export const ROLES_SISTEMA = [
  "ADMINISTRADOR",
  "SUBADMINISTRADOR_ACADEMICO",
  "SUBADMINISTRADOR_ATENCION",
  "CONSULTA_INTERNA",
] as const;

export class RoleRepository {
  async findByNombre(nombre: string) {
    return prisma.rol.findUnique({ where: { nombre } });
  }

  async findAll() {
    return prisma.rol.findMany({ where: { estado: "activo" } });
  }

  async findById(idRol: bigint | number) {
    return prisma.rol.findUnique({ where: { idRol } });
  }

  async asignarRolAUsuario(idUsuario: bigint | number, idRol: bigint | number) {
    return prisma.usuarioRol.create({
      data: { idUsuario, idRol },
    });
  }

  async obtenerRolesDeUsuario(idUsuario: bigint | number) {
    const relaciones = await prisma.usuarioRol.findMany({
      where: { idUsuario },
      include: { rol: true },
    });
    return relaciones.map((r) => r.rol);
  }
}
