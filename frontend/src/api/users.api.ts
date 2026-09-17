import { axiosClient } from "./axiosClient";
import { ApiEnvelope, UsuarioAdmin } from "./types";

export const usersApi = {
  listar: () => axiosClient.get<ApiEnvelope<UsuarioAdmin[]>>("/users"),
  cambiarEstado: (id: number, estado: "activo" | "inactivo") =>
    axiosClient.patch<ApiEnvelope<unknown>>(`/users/${id}/estado`, { estado }),
  asignarRol: (id: number, idRol: number) =>
    axiosClient.patch<ApiEnvelope<unknown>>(`/users/${id}/rol`, { idRol }),
};
