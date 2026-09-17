import { ApiError } from "../../utils/apiError";
import { UserRepository } from "./user.repository";
import { RoleRepository } from "../roles/role.repository";

export class UserService {
  private repository = new UserRepository();
  private roleRepository = new RoleRepository();

  async obtenerPerfil(idUsuario: bigint | number) {
    const usuario = await this.repository.findByIdWithRoles(idUsuario);

    if (!usuario) {
      throw ApiError.notFound("Usuario no encontrado");
    }

    return {
      idUsuario: usuario.idUsuario,
      nombreCompleto: usuario.nombreCompleto,
      correo: usuario.correo,
      estado: usuario.estado,
      correoVerificado: usuario.correoVerificado,
      debeCambiarPassword: usuario.debeCambiarPassword,
      fechaCreacion: usuario.fechaCreacion,
      roles: usuario.roles.map((r) => r.rol.nombre),
    };
  }

  // Usado por el panel administrativo: /admin/usuarios
  async listarUsuarios() {
    const usuarios = await this.repository.findAllWithRoles();
    return usuarios.map((usuario) => ({
      idUsuario: usuario.idUsuario,
      nombreCompleto: usuario.nombreCompleto,
      correo: usuario.correo,
      estado: usuario.estado,
      correoVerificado: usuario.correoVerificado,
      fechaCreacion: usuario.fechaCreacion,
      roles: usuario.roles.map((r) => r.rol.nombre),
    }));
  }

  async cambiarEstado(idUsuario: bigint | number, estado: "activo" | "inactivo") {
    const usuario = await this.repository.findById(idUsuario);
    if (!usuario) {
      throw ApiError.notFound("Usuario no encontrado");
    }
    return this.repository.actualizarEstado(idUsuario, estado);
  }

  async asignarRol(idUsuario: bigint | number, idRol: bigint | number) {
    const usuario = await this.repository.findById(idUsuario);
    if (!usuario) {
      throw ApiError.notFound("Usuario no encontrado");
    }
    const rol = await this.roleRepository.findById(idRol);
    if (!rol) {
      throw ApiError.notFound("Rol no encontrado");
    }
    return this.roleRepository.asignarRolAUsuario(idUsuario, idRol);
  }
}
