import { axiosClient } from "./axiosClient";
import { ApiEnvelope, UsuarioAdmin, PermisoUsuario } from "./types";

export interface CrearEstudianteInput { nombres: string; apellidos: string; ci: string; ru: string; correo: string; mencion: string }

export const usersApi = {
  crearEstudiante: (input: CrearEstudianteInput) => axiosClient.post<ApiEnvelope<{ idUsuario: string; idEstudiante: string }>>('/users/estudiantes', input),
  resetearPassword: (id: string, ci?: string) =>
    axiosClient.post<ApiEnvelope<{ mensaje: string }>>(`/users/${id}/reset-password`, { ci }),
  crear: (input: { nombreCompleto: string; correo: string; ci: string; permisos: PermisoUsuario[] }) =>
    axiosClient.post<ApiEnvelope<UsuarioAdmin>>("/users", input),
  listar: () => axiosClient.get<ApiEnvelope<UsuarioAdmin[]>>("/users"),
  cambiarEstado: (id: string, estado: "activo" | "inactivo") =>
    axiosClient.patch<ApiEnvelope<unknown>>(`/users/${id}/estado`, { estado }),
  asignarPermisos: (id: string, permisos: PermisoUsuario[]) =>
    axiosClient.patch<ApiEnvelope<UsuarioAdmin>>(`/users/${id}/permisos`, { permisos }),
};
