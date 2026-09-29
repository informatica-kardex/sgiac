import { prisma } from "../../database/prisma";

// Nombre del rol asignado por defecto a todo usuario que se
// registra por el formulario publico.
export const ROL_POR_DEFECTO = "CONSULTA_INTERNA";

// Roles con acceso al panel administrativo (/admin).
export const ROLES_ADMINISTRATIVOS = [
  "ADMINISTRADOR",
  "SUBADMINISTRADOR",
] as const;

export const ROLES_SISTEMA = [
  "ADMINISTRADOR",
  "SUBADMINISTRADOR",
  "CONSULTA_INTERNA",
] as const;

export const ROLES_SUBADMIN = ["SUBADMINISTRADOR"];

export function rolesActivos(relaciones: { estado: string; rol: { estado: string; nombre: string } }[]) {
  return relaciones.filter(r => r.estado.toUpperCase() === "ACTIVO" && r.rol.estado.toUpperCase() === "ACTIVO")
    .map(r => r.rol.nombre);
}

export class RoleRepository {
  async findByNombre(nombre: string) {
    return prisma.rol.findUnique({ where: { nombre } });
  }

  async findAll() {
    return prisma.rol.findMany({ where: { estado: { equals: "ACTIVO", mode: "insensitive" }, nombre: { in: [...ROLES_ADMINISTRATIVOS] } } });
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
